import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { createSite } from '../app/@base/site/config';
import type { MaterialRecord } from '../app/@feature/materials/types';
import { emptyLibrary, libraryJSON, mergeLibraries, parseLibrary, type LibraryRevision, type SharedLibrary } from '../app/@feature/materials/sync-contract';
import { supplierMaterials, cloneMaterial } from '../app/@feature/materials/supplier';
import { useMaterialSync } from '../app/@feature/materials/use-material-sync';

const records = vi.hoisted(() => new Map<string, unknown>());
vi.mock('~/@base/site', () => ({ site: createSite('SUNLU'), includesVendor: (vendor: string) => vendor === 'SUNLU' }));
vi.mock('~/@base/storage', () => ({ readRecord: async (key: string) => structuredClone(records.get(key)), writeRecord: async (key: string, value: unknown) => { records.set(key, structuredClone(value)); } }));
const material = (id = 'test', hex = '#112233'): MaterialRecord => ({ version: 2, id, materialId: id, name: id, hex, transparency: 0, metalness: 0, roughness: 0.4, colorSpace: 'srgb', renderRule: 'openpbr-subset-v1' });
const lib = (...materials: MaterialRecord[]): SharedLibrary => ({ ...emptyLibrary('SUNLU'), materials });
const revision = (library = lib(), sha = 'a'.repeat(40)): LibraryRevision => ({ sha, library });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const scopes: ReturnType<typeof effectScope>[] = [];
function client(initial = lib()) {
  let local = initial;
  const scope = effectScope(); scopes.push(scope);
  const sync = scope.run(() => useMaterialSync({ getLibrary: () => local, applyLibrary: async update => { const next = update(local); if (next) local = structuredClone(next); } }))!;
  return { sync, get local() { return local; }, edit(value: SharedLibrary) { local = value; sync.schedule(); } };
}
beforeEach(() => { records.clear(); });
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('shared material contract', () => {
  it('restores canonical source values while retaining adjusted preview values', () => {
    const source = supplierMaterials[0]!; const edit = cloneMaterial(source); edit.hex = '#123456'; edit.supplier!.catalogHex = '#000000'; edit.supplier!.source.parameters.specular_roughness = 0.99;
    const parsed = parseLibrary({ ...lib(), supplierEdits: [edit] }, 'SUNLU');
    expect(parsed.supplierEdits[0]!.supplier).toEqual(source.supplier);
    expect(parsed.supplierEdits[0]!.overrides?.hex).toBe('#123456');
  });
  it('rejects vendor spoofing, duplicate identities and local material IDs matching a catalog SKU', () => {
    expect(() => parseLibrary({ ...lib(), vendor: 'Polymaker' }, 'SUNLU')).toThrow();
    expect(() => parseLibrary(lib(material(), material()), 'SUNLU')).toThrow();
    expect(() => parseLibrary(lib({ ...material(), materialId: supplierMaterials[0]!.materialId }), 'SUNLU')).toThrow();
    expect(() => parseLibrary(lib({ ...material(), appearance: { vendor: 'Polymaker', baseMaterial: 'PLA', origin: 'user' } }), 'SUNLU')).toThrow();
  });
  it('merges independent edits and deletions, but flags conflicting edits to the same material', () => {
    const base = lib(material('one'), material('two'));
    const local = lib(material('one', '#000000'), material('two'));
    const remote = lib(material('one'));
    expect(mergeLibraries(base, local, remote)).toEqual({ library: lib(material('one', '#000000')), conflicts: [] });
    const other = lib(material('one', '#FFFFFF'), material('two'));
    expect(mergeLibraries(base, local, other).conflicts).toEqual(['one']);
    expect(mergeLibraries(base, local, other, true).library).toEqual(local);
  });
  it('ignores object key and library ordering for revision comparisons', () => {
    const a = material('a'); const reversed = Object.fromEntries(Object.entries(a).reverse()) as unknown as MaterialRecord;
    expect(libraryJSON(lib(a, material('b')))).toBe(libraryJSON(lib(material('b'), reversed)));
  });
});

describe('material sync lifecycle', () => {
  it('loads remote material data without generating a redundant write', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(revision(lib(material())))); vi.stubGlobal('fetch', fetcher);
    const c = client(); await c.sync.initialize();
    expect(c.local).toEqual(lib(material())); expect(c.sync.state.value).toBe('saved'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retains offline edits across reload and uploads them on retry', async () => {
    records.set('material-sync-base', revision(lib(material())));
    const fetcher = vi.fn().mockRejectedValue(new Error('offline')); vi.stubGlobal('fetch', fetcher);
    const c = client(lib(material('test', '#556677'))); await c.sync.initialize();
    expect(c.sync.state.value).toBe('error'); expect(c.local.materials[0]!.hex).toBe('#556677');
    fetcher.mockResolvedValueOnce(response(revision(lib(material())))).mockImplementationOnce(async (_url, options) => response({ ...JSON.parse(options.body), sha: 'b'.repeat(40) }));
    await c.sync.retry(); expect(c.sync.state.value).toBe('saved'); expect((records.get('material-sync-base') as LibraryRevision).library).toEqual(c.local);
  });
  it('saves subsequent edits made while the first write is in flight', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(revision())); vi.stubGlobal('fetch', fetcher);
    const c = client(); await c.sync.initialize();
    let finish!: (value: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockImplementationOnce(async (_url, options) => response({ ...JSON.parse(options.body), sha: 'c'.repeat(40) }));
    c.edit(lib(material())); const saving = c.sync.flush(); await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    c.edit(lib(material('test', '#445566'))); finish(response(revision(lib(material()), 'b'.repeat(40)))); await saving;
    expect(fetcher).toHaveBeenCalledTimes(3); expect((records.get('material-sync-base') as LibraryRevision).library.materials[0]!.hex).toBe('#445566'); expect(c.sync.state.value).toBe('saved');
  });
  it('handles stale SHA with a fresh merge and preserves both independent edits', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce(response(revision())).mockResolvedValueOnce(response({}, 409)).mockResolvedValueOnce(response(revision(lib(material('remote')), 'b'.repeat(40)))).mockImplementationOnce(async (_url, options) => response({ ...JSON.parse(options.body), sha: 'c'.repeat(40) })); vi.stubGlobal('fetch', fetcher);
    const c = client(); await c.sync.initialize(); c.edit(lib(material('local'))); await c.sync.flush(); await vi.advanceTimersByTimeAsync(1500);
    expect(c.local.materials.map(item => item.id).sort()).toEqual(['local', 'remote']); expect(c.sync.state.value).toBe('saved');
  });
  it('keeps independent local edits when conflicts use the remote version', async () => {
    records.set('material-sync-base', revision(lib(material())));
    const remote = revision(lib(material('test', '#FFFFFF')), 'b'.repeat(40));
    const fetcher = vi.fn().mockImplementation(async (_url, options) => options.method === 'GET' ? response(remote) : response({ ...JSON.parse(options.body), sha: 'c'.repeat(40) })); vi.stubGlobal('fetch', fetcher);
    const c = client(lib(material('test', '#000000'), material('independent'))); await c.sync.initialize();
    await c.sync.resolveConflict(false);
    expect(c.local).toEqual(lib(material('test', '#FFFFFF'), material('independent'))); expect(c.sync.state.value).toBe('saved');
  });
  it('blocks writes on a same-material conflict and backs up local data before resolution', async () => {
    records.set('material-sync-base', revision(lib(material())));
    const remote = revision(lib(material('test', '#FFFFFF')), 'b'.repeat(40));
    const fetcher = vi.fn().mockImplementation(async (_url, options) => options.method === 'GET' ? response(remote) : response({ ...JSON.parse(options.body), sha: 'c'.repeat(40) })); vi.stubGlobal('fetch', fetcher);
    const c = client(lib(material('test', '#000000'))); await c.sync.initialize();
    expect(c.sync.state.value).toBe('conflict'); expect(c.local.materials[0]!.hex).toBe('#000000'); expect(fetcher).toHaveBeenCalledTimes(1);
    await c.sync.resolveConflict(true); expect(c.sync.state.value).toBe('saved'); expect((records.get('material-sync-backup') as SharedLibrary).materials[0]!.hex).toBe('#000000');
  });
});
