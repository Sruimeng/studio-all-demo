import { shallowRef } from 'vue';
import type { MulticolorClient, RegionEditTool, SurfaceEditResult } from '~/@engine/multicolor';
import type { ViewerHit } from '~/@engine/viewer';

interface RegionEditOptions {
  worker: () => MulticolorClient | null;
  operation: (action: () => Promise<void>) => Promise<void>;
  advance: () => void;
  scale: () => number;
  label: () => number;
  enabled: () => boolean;
  present: (result: SurfaceEditResult) => void;
}

export function useRegionEdit(options: RegionEditOptions) {
  const tool = shallowRef<RegionEditTool>('orbit');
  const angle = shallowRef(30);
  const areaMM2 = shallowRef(1.5);
  const overlay = shallowRef<Uint8Array | null>(null);
  const pending = shallowRef<'cleanup' | 'selection' | null>(null);
  const selectedCount = shallowRef(0), protectedCount = shallowRef(0), candidateCount = shallowRef(0), editedCount = shallowRef(0);
  let epoch = 0;

  function accept(result: SurfaceEditResult, publishLabels = true) {
    overlay.value = result.overlay; pending.value = result.pending;
    selectedCount.value = result.selectedCount; protectedCount.value = result.protectedCount; candidateCount.value = result.candidateCount;
    editedCount.value = result.editedCount;
    if (publishLabels) options.present(result);
  }
  function clear() {
    epoch++; tool.value = 'orbit'; overlay.value = null; pending.value = null;
    selectedCount.value = 0; protectedCount.value = 0; candidateCount.value = 0; editedCount.value = 0;
  }
  async function run(action: (worker: MulticolorClient) => Promise<SurfaceEditResult>, mutate = false, publishLabels = false) {
    const workerAtStart = options.worker();
    await options.operation(async () => {
      const worker = options.worker(), own = epoch;
      if (!worker || worker !== workerAtStart) return;
      if (!options.enabled()) throw new Error('局部编辑需要表面模式或上游标签预览。旧 UV 编辑请先保存项目，避免丢失编辑。');
      if (mutate) options.advance();
      const result = await action(worker);
      if (own === epoch && worker === options.worker()) accept(result, publishLabels);
    });
  }
  function setArea(value: number) {
    if (!Number.isFinite(value) || value < 0.1 || value > 12) return;
    areaMM2.value = value;
    if (pending.value === 'cleanup') void cancel();
  }
  const detect = () => run(worker => worker.request('editDetect', { areaMM2: areaMM2.value, scale: options.scale() }));
  const pick = (hit: ViewerHit) => {
    const mode = tool.value;
    if (mode === 'orbit') return;
    return run(worker => worker.request('editPick', { seed: hit.face, angle: angle.value, tool: mode }), mode === 'protect' || mode === 'unprotect');
  };
  const apply = () => run(worker => worker.request('editApply', { label: options.label() }), true, true);
  const cancel = () => run(worker => worker.request('editCancel', {}));
  const clearProtection = () => run(worker => worker.request('editClearProtection', {}), true);
  const undo = () => run(worker => worker.request('editUndo', {}), true, true);
  const reset = () => run(worker => worker.request('editReset', {}), true, true);

  return { tool, angle, areaMM2, overlay, pending, selectedCount, protectedCount, candidateCount, editedCount, clear, accept, setArea, detect, pick, apply, cancel, clearProtection, undo, reset };
}
