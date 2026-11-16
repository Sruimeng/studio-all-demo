import { onScopeDispose, shallowRef } from 'vue';
import { readRecord, writeRecord } from '~/@base/storage';
import { site } from '~/@base/site';
import { emptyLibrary, libraryJSON, mergeLibraries, parseLibrary, type LibraryRevision, type MaterialLibrary, type SharedLibrary } from './sync-contract';

export type MaterialSyncState = 'local' | 'loading' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';
interface SyncOptions { getLibrary: () => MaterialLibrary; applyLibrary: (update: (current: SharedLibrary) => SharedLibrary | undefined) => Promise<void> }
class RevisionConflict extends Error {}

export function useMaterialSync(options: SyncOptions) {
  const enabled = !!site.vendor;
  const state = shallowRef<MaterialSyncState>(enabled ? 'loading' : 'local');
  const error = shallowRef('');
  const conflicts = shallowRef<string[]>([]);
  let base: LibraryRevision | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | undefined;
  let stopped = false;
  let initialized = false;
  const snapshot = () => parseLibrary({ ...options.getLibrary(), version: 1, vendor: site.vendor }, site.vendor!);
  async function request(method: 'GET' | 'PUT', value?: LibraryRevision): Promise<LibraryRevision> {
    const response = await fetch('/api/materials', { method, cache: 'no-store', headers: value ? { 'Content-Type': 'application/json' } : {}, body: value ? JSON.stringify(value) : undefined, signal: AbortSignal.timeout(25000) });
    if (response.status === 409) throw new RevisionConflict();
    if (!response.ok) throw new Error(response.status === 503 ? 'GitHub storage is not configured / GitHub 存储未配置' : response.status === 413 ? 'Material data exceeds 3 MB / 材质数据超过 3MB' : 'Could not sync materials / 材质同步失败，请重试');
    const data = await response.json() as LibraryRevision;
    if (typeof data.sha !== 'string' || !/^[a-f0-9]{40}$/.test(data.sha)) throw new Error('Invalid remote revision');
    return { sha: data.sha, library: parseLibrary(data.library, site.vendor!) };
  }
  async function checkpoint(value: LibraryRevision) {
    await writeRecord('material-sync-base', JSON.parse(JSON.stringify(value)));
    base = value;
  }
  async function reconcile(preferLocal?: boolean) {
    const remote = await request('GET');
    if (stopped) return false;
    let applied = false;
    await options.applyLibrary(current => {
      const merged = mergeLibraries(base?.library ?? emptyLibrary(site.vendor!), current, remote.library, preferLocal);
      if (merged.conflicts.length && preferLocal === undefined) { conflicts.value = merged.conflicts; state.value = 'conflict'; return; }
      applied = true;
      return merged.library;
    });
    if (!applied) return false;
    await checkpoint(remote);
    conflicts.value = [];
    return true;
  }
  async function drain() {
    try {
      error.value = '';
      if (!base && !await reconcile()) return;
      while (!stopped) {
        const library = snapshot();
        if (libraryJSON(library) === libraryJSON(base!.library)) { state.value = 'saved'; return; }
        state.value = 'saving';
        const revision = await request('PUT', { sha: base!.sha, library });
        await checkpoint(revision);
      }
    } catch (cause) {
      if (cause instanceof RevisionConflict) {
        try { if (await reconcile()) { state.value = 'pending'; schedule(); } }
        catch { state.value = 'error'; error.value = 'Could not read the latest materials / 无法读取最新材质'; }
      } else { state.value = 'error'; error.value = cause instanceof Error ? cause.message : String(cause); }
    }
  }
  function flush() {
    clearTimeout(timer);
    if (!enabled || stopped || state.value === 'conflict') return Promise.resolve();
    if (active) return active;
    active = drain().finally(() => { active = undefined; });
    return active;
  }
  function schedule() {
    if (!enabled || stopped || !initialized || state.value === 'conflict') return;
    clearTimeout(timer);
    state.value = 'pending';
    timer = setTimeout(() => { void flush(); }, 1500);
  }
  async function initialize() {
    if (!enabled) return;
    return run(async () => {
      try {
        const stored = await readRecord<LibraryRevision>('material-sync-base');
        if (stored && typeof stored.sha === 'string') base = { sha: stored.sha, library: parseLibrary(stored.library, site.vendor!) };
        if (!await reconcile()) return;
        state.value = 'pending';
      } catch { state.value = 'error'; error.value = 'Could not load shared materials; local changes are retained / 暂未连接共享材质，本地修改已保留'; }
      finally { initialized = true; }
      if (state.value !== 'error') await drain();
    });
  }
  function run(action: () => Promise<void>) {
    if (active) return active;
    active = action().finally(() => { active = undefined; });
    return active;
  }
  function retry() {
    return run(async () => {
      try { state.value = 'loading'; if (!await reconcile()) return; await drain(); }
      catch { state.value = 'error'; error.value = 'Could not reconnect to GitHub / 无法连接 GitHub'; }
    });
  }
  function resolveConflict(preferLocal: boolean) {
    return run(async () => {
      try {
        await writeRecord('material-sync-backup', JSON.parse(JSON.stringify(snapshot())));
        if (!await reconcile(preferLocal)) return;
        state.value = 'pending'; conflicts.value = []; await drain();
      } catch { state.value = 'error'; error.value = 'Could not resolve material conflict / 冲突处理失败，本地修改已保留'; }
    });
  }
  const reconnect = () => { if (initialized && state.value === 'error') void retry(); };
  const warnUnsaved = (event: BeforeUnloadEvent) => {
    if (['pending', 'saving', 'error', 'conflict'].includes(state.value)) { event.preventDefault(); event.returnValue = ''; }
  };
  if (enabled && typeof window !== 'undefined') { window.addEventListener('online', reconnect); window.addEventListener('beforeunload', warnUnsaved); }
  onScopeDispose(() => {
    stopped = true; clearTimeout(timer);
    if (typeof window !== 'undefined') { window.removeEventListener('online', reconnect); window.removeEventListener('beforeunload', warnUnsaved); }
  });
  return { enabled, state, error, conflicts, initialize, schedule, flush, retry, resolveConflict };
}
