import { describe, expect, it, vi } from 'vitest';
import { useRegionEdit } from '../app/@feature/workspace/use-region-edit';
import type { MulticolorClient, SurfaceEditResult } from '../app/@engine/multicolor';

const result = (update: Partial<SurfaceEditResult> = {}): SurfaceEditResult => ({
  label: new Uint8Array([0, 1]), overlay: new Uint8Array(2), selectedCount: 0, protectedCount: 0, candidateCount: 0, editedCount: 0, pending: null, left: 0, ...update,
});

function fixture() {
  let worker = { request: vi.fn().mockResolvedValue(result()) } as unknown as MulticolorClient;
  const present = vi.fn(), advance = vi.fn();
  let flush = Promise.resolve(), label = 1;
  const edit = useRegionEdit({
    worker: () => worker, operation: async action => { await flush; await action(); }, advance,
    scale: () => 2, label: () => label, enabled: () => true, present,
  });
  return { edit, present, advance, request: vi.mocked(worker.request), flush: (value: Promise<void>) => { flush = value; }, label: (value: number) => { label = value; }, replace: () => { worker = { request: vi.fn() } as unknown as MulticolorClient; edit.clear(); } };
}

describe('region editing coordination', () => {
  it('detects with physical scale without committing and applies the current color only once', async () => {
    const { edit, request, advance, label } = fixture();
    request.mockResolvedValueOnce(result({ overlay: new Uint8Array([0, 1]), candidateCount: 1, pending: 'cleanup' }));
    edit.areaMM2.value = 0.7; await edit.detect();
    expect(request).toHaveBeenLastCalledWith('editDetect', { areaMM2: 0.7, scale: 2 });
    expect(advance).not.toHaveBeenCalled(); expect(edit.candidateCount.value).toBe(1);
    label(0); await edit.apply();
    expect(request).toHaveBeenLastCalledWith('editApply', { label: 0 }); expect(advance).toHaveBeenCalledTimes(1);
    expect(edit.pending.value).toBeNull();
  });

  it('passes geometric seed, bounded sensitivity and add/exclude/protection tools to the worker', async () => {
    const { edit, request, advance } = fixture();
    const hit = { face: 1, point: [0, 0, 0] as [number, number, number], radius: 1 };
    edit.angle.value = 17; edit.tool.value = 'select'; await edit.pick(hit);
    expect(request).toHaveBeenLastCalledWith('editPick', { seed: 1, angle: 17, tool: 'select' });
    expect(advance).not.toHaveBeenCalled();
    edit.tool.value = 'protect'; await edit.pick(hit); expect(advance).toHaveBeenCalledTimes(1);
    edit.tool.value = 'exclude'; await edit.pick(hit);
    expect(request).toHaveBeenLastCalledWith('editPick', { seed: 1, angle: 17, tool: 'exclude' });
    edit.tool.value = 'orbit'; request.mockClear(); await edit.pick(hit); expect(request).not.toHaveBeenCalled();
  });

  it('waits for the latest segmentation before dispatch and drops actions from a replaced project', async () => {
    const { edit, request, flush, replace, present } = fixture();
    let release!: () => void; flush(new Promise(resolve => { release = resolve; }));
    const detection = edit.detect(); expect(request).not.toHaveBeenCalled();
    release(); await detection; expect(request).toHaveBeenCalledTimes(1);
    let finish!: (value: SurfaceEditResult) => void;
    request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = edit.detect(); await Promise.resolve(); await Promise.resolve();
    replace(); present.mockClear(); finish(result({ pending: 'cleanup', candidateCount: 1 })); await pending;
    expect(present).not.toHaveBeenCalled(); expect(edit.pending.value).toBeNull(); expect(edit.overlay.value).toBeNull();
  });

  it('cancels stale cleanup plans when changing area and never marks cancel as a committed edit', async () => {
    const { edit, request, advance } = fixture();
    edit.accept(result({ pending: 'cleanup', candidateCount: 1 })); edit.setArea(2.4);
    await Promise.resolve(); await Promise.resolve();
    expect(request).toHaveBeenLastCalledWith('editCancel', {}); expect(advance).not.toHaveBeenCalled();
    await edit.cancel(); expect(edit.pending.value).toBeNull();
    edit.setArea(NaN); expect(edit.areaMM2.value).toBe(2.4);
  });
});
