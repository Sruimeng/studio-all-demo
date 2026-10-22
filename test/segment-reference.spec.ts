import { afterEach, describe, expect, it, vi } from 'vitest';
import { assignPixels, chickenReference, connectedPixels, makeReferenceMask, mergePlanGroups, presetTarget, readReference, referenceLabel, splitProblem, suggestedPrompt, validateMask } from '../app/@feature/segmentation/reference';
import { freshDraft, type SegmentPlan } from '../app/@feature/segmentation/types';

function plan(): SegmentPlan {
  return { key: 'mesh-a', optionsKey: 'settings', groups: [{ id: 0, name: '身体', color: '#83b8ff' }, { id: 1, name: '鸡冠', color: '#f2bb6b' }], labels: [0, 1, 1], edited: false, method: 'reference-demo-v1', mask: { referenceId: 'image-a', width: 3, height: 2, labels: [-1, 0, 1, 0, -1, 1] } };
}
describe('reference image segmentation', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('keeps the HD reference at source resolution and never enlarges a smaller image', async () => {
    const context = { drawImage: vi.fn(), getImageData: vi.fn() }, canvas = { width: 0, height: 0, getContext: () => context };
    let imageSize = 1024;
    vi.stubGlobal('Image', class { width = imageSize; height = imageSize; decode = async () => {}; });
    vi.stubGlobal('document', { createElement: () => canvas });
    for (const size of [1024, 600, 2048]) {
      imageSize = size; await readReference(chickenReference);
      expect(canvas.width).toBe(Math.min(size, 1024)); expect(canvas.height).toBe(Math.min(size, 1024));
      expect(context.getImageData).toHaveBeenLastCalledWith(0, 0, canvas.width, canvas.height);
    }
  });
  it('retains cyan reflections on dark surfaces while excluding real background gaps', () => {
    const mask = makeReferenceMask(new Uint8ClampedArray([70,195,200,255,20,28,29,255,70,195,200,255,0,0,0,0]), 4, 1, 'parts', freshDraft().options, 'hd');
    expect(mask.labels).toEqual([-1, 0, -1, -1]);
  });
  it('removes isolated color specks without removing small parts, separate same-part regions or background', () => {
    const width = 256, data = new Uint8ClampedArray(width * width * 4);
    for (let i = 0; i < width * width; i++) data.set([50, 50, 50, 255], i * 4);
    const fill = (x: number, y: number, w: number, h: number, rgb: number[]) => {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) data.set([...rgb, 255], (yy * width + xx) * 4);
    };
    fill(120, 20, 12, 12, [190, 35, 35]); fill(140, 20, 8, 8, [190, 35, 35]);
    fill(100, 40, 1, 1, [190, 35, 35]); fill(130, 65, 1, 1, [230, 130, 60]);
    fill(140, 80, 1, 1, [70, 195, 200]);
    const mask = makeReferenceMask(data, width, width, 'parts', freshDraft().options, 'hd');
    expect(mask.labels[40 * width + 100]).toBe(0);
    expect(mask.labels[25 * width + 125]).toBe(1); expect(mask.labels[23 * width + 143]).toBe(1);
    expect(mask.labels[65 * width + 130]).toBe(2);
    expect(mask.labels[80 * width + 140]).toBe(-1);
  });
  it('excludes the source backdrop and preserves the full foreground', () => {
    const data = new Uint8ClampedArray([70, 195, 200, 255, 160, 20, 25, 255, 50, 50, 50, 255]);
    const mask = makeReferenceMask(data, 3, 1, 'parts', freshDraft().options, 'image-a');
    expect(mask.labels).toEqual([-1, 1, 0]);
    expect(() => validateMask(mask, plan().groups, 'image-a')).not.toThrow();
    expect(() => validateMask(mask, plan().groups, 'image-b')).toThrow('参考图');
  });
  it('selects connected regions without crossing row boundaries or selecting background', () => {
    const mask = { referenceId: 'a', width: 3, height: 2, labels: [0, 1, 0, 0, 1, 0] };
    expect(connectedPixels(mask, 0)).toEqual([0, 3]);
    expect(connectedPixels(mask, 0, true)).toEqual([0, 2, 3, 5]);
    expect(connectedPixels(plan().mask!, 0)).toEqual([]);
  });
  it('saves pixel edits but invalidates 3D mapping instead of exporting stale geometry', () => {
    const original = plan(), next = assignPixels(original, [0, 1, 99], 1);
    expect(next.mask!.labels).toEqual([-1, 1, 1, 0, -1, 1]);
    expect(original.mask!.labels[1]).toBe(0);
    expect(next.labels).toEqual(original.labels);
    expect(next.mappingDirty).toBe(true);
    expect(splitProblem(next, 'image-a')).toContain('2D 边界已修改');
    expect(splitProblem(original, 'image-a')).toBe('');
    expect(splitProblem({ ...original, mask: undefined }, 'image-a')).toContain('参考图');
    expect(assignPixels(original, [1], 0).mappingDirty).toBeUndefined();
    expect(() => assignPixels(original, [0], 1)).toThrow('背景');
    const emptied = assignPixels(original, [2, 5], 0);
    expect(emptied.groups).toHaveLength(1); expect(emptied.labels).toEqual([0, 0, 0]);
    expect(splitProblem(emptied, 'image-a')).toContain('2D 边界已修改');
  });
  it('merges corresponding image groups and mesh groups without requiring remapping', () => {
    const next = mergePlanGroups(plan(), [0, 1]);
    expect(next.groups).toHaveLength(1); expect(next.labels).toEqual([0, 0, 0]);
    expect(next.mask!.labels).toEqual([-1, 0, 0, 0, -1, 0]);
    expect(splitProblem(next, 'image-a')).toBe('');
    expect(mergePlanGroups(assignPixels(plan(), [1], 1), [0, 1]).mappingDirty).toBe(true);
  });
  it('creates valid image-only groups and rejects unsupported free-text interpretation', () => {
    const next = assignPixels(plan(), [2], 0, '新部件');
    expect(next.groups.at(-1)?.name).toBe('新部件'); expect(next.mask!.labels[2]).toBe(2);
    expect(() => validateMask(next.mask!, next.groups)).not.toThrow();
    expect(presetTarget('parts', suggestedPrompt('parts'))).toBeNull();
    expect(presetTarget('parts', '鸡冠单独拆出，其余保持整体。')).toBe(1);
    expect(() => presetTarget('parts', '拆出不存在的帽子')).toThrow('自定义描述已保留');
  });
  it('uses coarse color groups and the similar-color option meaningfully', () => {
    expect(referenceLabel(230, 130, 60, 0.55, 0.27, 'colors', { ...freshDraft().options, detail: 'coarse' })).toBe(7);
    expect(referenceLabel(25, 25, 25, 0.5, 0.5, 'colors', { ...freshDraft().options, mergeSimilar: false })).toBe(8);
    expect(referenceLabel(25, 25, 25, 0.5, 0.5, 'colors', freshDraft().options)).toBe(0);
  });
});
