import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, reactive } from 'vue';
import { BoxGeometry } from 'three';
import type { PrintMeshInput } from '../app/@engine/multicolor';
import { useSegmentation } from '../app/@feature/segmentation/use-segmentation';
import { downloadFile } from '../app/@base/storage';
import { geometryKey } from '../app/@feature/segmentation/geometry';
import { chickenReference, connectedPixels, legacyChickenReference, suggestedPrompt } from '../app/@feature/segmentation/reference';
import { freshDraft, optionsKey, type SegmentDocument, type SegmentPlan } from '../app/@feature/segmentation/types';

vi.mock('~/@base/storage', () => ({ downloadFile: vi.fn() }));
vi.mock('../app/@feature/segmentation/reference', async importOriginal => ({
  ...await importOriginal<typeof import('../app/@feature/segmentation/reference')>(),
  readReference: async () => ({ width: 2, height: 2, data: new Uint8ClampedArray([50,50,50,255,190,35,35,255,50,50,50,255,50,50,50,255]) }),
}));

const scopes: ReturnType<typeof effectScope>[] = [];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function fixture() {
  const geometry = new BoxGeometry(1, 1, 1).toNonIndexed();
  const positions = geometry.getAttribute('position').array as Float32Array;
  const mesh: PrintMeshInput = { positions, indices: Uint32Array.from({ length: positions.length / 3 }, (_, i) => i), colors: new Float32Array(positions.length).fill(200), uvs: null, faceMat: new Uint32Array(12), materials: [{ image: -1, factor: [1, 1, 1] }], images: [] };
  geometry.dispose();
  const parts = freshDraft(); parts.options.prompt = suggestedPrompt('parts');
  const plan: SegmentPlan = { key: geometryKey(mesh), optionsKey: optionsKey('parts', parts.options), groups: [{ id: 0, name: '身体', color: '#83b8ff' }, { id: 1, name: '鸡冠', color: '#f2bb6b' }], labels: Array.from({ length: 12 }, (_, i) => i < 2 ? 1 : 0), mask: { referenceId: chickenReference.id, width: 2, height: 1, labels: [0, 1] }, edited: false, method: 'reference-demo-v1' };
  parts.plan = plan;
  parts.result = { plan: clone(plan), createdAt: '2026-10-20T00:00:00Z', confirmed: false };
  const document: SegmentDocument = { version: 1, geometryKey: geometryKey(mesh), mode: 'parts', reference: chickenReference, drafts: { parts, colors: freshDraft() } };
  const studio = reactive({
    content: { id: 'model-a', mesh }, project: { id: 'project-a', sourceSample: 'chicken', name: '小鸡' },
    segmentation: document, preparation: { engaged: false }, saved: false,
    busy: false, prepSaving: false, prepSaveError: '', failure: '',
    projects: [{ id: 'confirmed-result', name: '拆分结果' }], settings: { height: 80 },
    savePreparation: vi.fn().mockResolvedValue(true), openProject: vi.fn().mockResolvedValue(undefined),
    loadSegmentResult: vi.fn(), navigatePreparation: vi.fn(),
  });
  return { studio, document };
}
function mount(studio: ReturnType<typeof fixture>['studio']) {
  const scope = effectScope(); scopes.push(scope);
  return scope.run(() => useSegmentation(studio as unknown as Parameters<typeof useSegmentation>[0]))!;
}
beforeEach(() => vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0; }));
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.unstubAllGlobals(); });

describe('segment split → preview → confirm journey', () => {
  it('requires an explicit re-split for the HD source, keeps manual history and exports old masks with the old reference', async () => {
    const { studio } = fixture(), draft = studio.segmentation.drafts.parts;
    studio.segmentation.reference = legacyChickenReference;
    draft.plan!.mask!.referenceId = legacyChickenReference.id; draft.plan!.edited = true;
    draft.plan!.groups[0]!.name = '手工调整的身体';
    draft.result = { plan: clone(draft.plan!), confirmed: true, createdAt: '2026-10-20T00:00:00Z' };
    const previous = clone(draft.plan), seg = mount(studio);
    expect(seg.reference?.id).toBe(chickenReference.id); expect(seg.stale).toBe(true);
    expect(seg.staleReason).toContain('高清版'); expect(seg.confirmed).toBe(false); expect(seg.pieces).toHaveLength(0);
    expect(studio.savePreparation).not.toHaveBeenCalled();
    seg.beginEdit(); expect(seg.editing).toBe(false);
    await seg.split(); expect(seg.confirmRegenerate).toBe(true); expect(seg.plan).toEqual(previous);
    await seg.split(true); expect(seg.stale).toBe(false); expect(seg.confirmed).toBe(false);
    expect(seg.plan?.mask?.referenceId).toBe(chickenReference.id);
    expect(studio.segmentation.drafts.parts.previousPlan).toEqual(previous);
    expect(mount(studio).stale).toBe(false);
    seg.restorePrevious(); expect(seg.plan).toEqual(previous); expect(seg.stale).toBe(true);
    seg.exportPlan();
    const blob = vi.mocked(downloadFile).mock.calls.at(-1)![0] as Blob;
    const exported = JSON.parse(await blob.text());
    expect(exported.reference.id).toBe(legacyChickenReference.id);
    expect(exported.reference.id).toBe(exported.mask.referenceId);
  });
  it('splits once into a pending 3D preview and restores it without opening the editor or confirming', async () => {
    const { studio } = fixture(); studio.segmentation.drafts.parts.plan = null; studio.segmentation.drafts.parts.result = null;
    const seg = mount(studio); expect(seg.stage).toBe('input');
    await seg.split();
    expect(seg.error).toBe(''); expect(seg.stage).toBe('plan'); expect(seg.view).toBe('3d'); expect(seg.editing).toBe(false);
    expect(seg.pieces.length).toBeGreaterThan(0); expect(seg.confirmed).toBe(false); expect(seg.resultEditing).toBe(true);
    expect(studio.segmentation.drafts.parts.result?.confirmed).toBe(false);
    const reopened = mount(studio); expect(reopened.stage).toBe('plan'); expect(reopened.view).toBe('3d'); expect(reopened.editing).toBe(false); expect(reopened.resultEditing).toBe(true);
    await reopened.forward('print'); expect(studio.navigatePreparation).not.toHaveBeenCalled();
    expect(reopened.error).toContain('请先确认拆分结果');
    await reopened.exportResult(); expect(reopened.error).toContain('请先确认拆分结果');
  });

  it('persists explicit confirmation and restores each mode independently', async () => {
    const { studio } = fixture(); const seg = mount(studio);
    await seg.confirmResult(); expect(seg.confirmed).toBe(true); expect(seg.stage).toBe('result');
    expect(studio.savePreparation).toHaveBeenCalled();
    const reopened = mount(studio); expect(reopened.confirmed).toBe(true); expect(reopened.view).toBe('3d');
    reopened.setMode('colors'); expect(reopened.stage).toBe('input'); expect(reopened.confirmed).toBe(false);
    reopened.setMode('parts'); expect(reopened.stage).toBe('result'); expect(reopened.confirmed).toBe(true);
    studio.segmentation.drafts.parts.result!.projectId = 'confirmed-result';
    await reopened.forward('print'); expect(studio.openProject).toHaveBeenCalledWith('confirmed-result');
    expect(studio.navigatePreparation).toHaveBeenCalledWith('print');
  });

  it('keeps a failed confirmation pending and allows retry without regenerating', async () => {
    const { studio } = fixture(); const seg = mount(studio);
    studio.savePreparation.mockResolvedValueOnce(false); studio.prepSaveError = '磁盘空间不足';
    await seg.confirmResult(); expect(seg.confirmed).toBe(false); expect(seg.stage).toBe('plan');
    expect(seg.error).toBe('磁盘空间不足'); expect(mount(studio).confirmed).toBe(false);
    studio.prepSaveError = ''; await seg.confirmResult(); expect(seg.confirmed).toBe(true); expect(seg.error).toBe('');
  });

  it('retains confirmation for viewing, canceling and applying an unchanged edit', async () => {
    const { studio } = fixture(); const seg = mount(studio); await seg.confirmResult();
    seg.toggleHidden(1); seg.setUi('explosion', 0.5); expect(seg.confirmed).toBe(true);
    seg.beginEdit(); seg.rename(0, '临时名字'); seg.cancelEdit();
    expect(seg.confirmed).toBe(true); expect(seg.plan!.groups[0]!.name).toBe('身体');
    seg.beginEdit(); await seg.applyEdit(); expect(seg.confirmed).toBe(true); expect(seg.stage).toBe('result');
  });

  it('invalidates confirmation and a linked project when applying a merge or rename', async () => {
    const { studio } = fixture(); const seg = mount(studio); await seg.confirmResult();
    studio.segmentation.drafts.parts.result!.projectId = 'confirmed-result';
    seg.beginEdit(); seg.selectGroup(0); seg.selectGroup(1, true); seg.merge(); await seg.applyEdit();
    expect(seg.confirmed).toBe(false); expect(seg.plan!.groups).toHaveLength(1);
    expect(studio.segmentation.drafts.parts.result?.projectId).toBeUndefined();
    expect(seg.splitBlocked).toBe(''); await seg.confirmResult(); expect(seg.confirmed).toBe(true);
    seg.rename(0, '整体'); expect(seg.confirmed).toBe(false); expect(seg.stage).toBe('plan');
  });

  it('blocks confirming or forwarding local pixel changes until 3D mapping exists', async () => {
    const { studio } = fixture(); const seg = mount(studio); await seg.confirmResult();
    seg.beginEdit(); seg.pickPixels([0]); seg.setUi('targetGroup', 1); seg.assign(); await seg.applyEdit();
    expect(seg.plan!.mappingDirty).toBe(true); expect(seg.confirmed).toBe(false); expect(seg.pieces).toHaveLength(0);
    await seg.confirmResult(); expect(seg.error).toContain('映射到 3D'); expect(seg.stage).toBe('plan');
    await seg.forward('multi-color'); expect(studio.loadSegmentResult).not.toHaveBeenCalled();
    expect(studio.navigatePreparation).not.toHaveBeenCalled(); expect(mount(studio).confirmed).toBe(false);
  });

  it('requires a fresh split after changed requirements and preserves the last draft on unsupported input', async () => {
    const { studio } = fixture(); const seg = mount(studio); await seg.confirmResult();
    const previous = clone(seg.plan);
    seg.setOption('prompt', '自定义暂不支持的要求');
    expect(seg.stale).toBe(true); expect(seg.confirmed).toBe(false);
    await seg.confirmResult(); expect(seg.stage).toBe('plan');
    await seg.split(); expect(seg.error).toContain('接入算法'); expect(seg.plan).toEqual(previous);
    const reopened = mount(studio); expect(reopened.confirmed).toBe(false); expect(reopened.stale).toBe(true);
  });

  it('opens legacy results as a review draft and uses standard detail for new splits', async () => {
    const { studio } = fixture(); delete studio.segmentation.drafts.parts.result!.confirmed;
    studio.segmentation.drafts.parts.options.detail = 'fine';
    const seg = mount(studio); expect(seg.stage).toBe('plan'); expect(seg.confirmed).toBe(false);
    await seg.split(); expect(seg.options.detail).toBe('standard'); expect(seg.stale).toBe(false);
  });

  it('closes the editor before processing and locks repeat actions until the edited result is saved', async () => {
    const { studio } = fixture(); const seg = mount(studio);
    let finishSave!: (value: boolean) => void;
    studio.savePreparation.mockReturnValueOnce(new Promise<boolean>(resolve => { finishSave = resolve; }));
    seg.beginEdit(); seg.selectGroup(0); seg.selectGroup(1, true); seg.merge();
    const applying = seg.applyEdit();
    expect(seg.editing).toBe(false); expect(seg.view).toBe('3d');
    expect(seg.busy).toBe(true); expect(seg.processingLabel).toBe('拆分中…');
    seg.beginEdit(); await seg.applyEdit(); await seg.split();
    expect(seg.editing).toBe(false);
    await vi.waitFor(() => expect(studio.savePreparation).toHaveBeenCalledTimes(1));
    expect(seg.busy).toBe(true); expect(seg.plan!.groups).toHaveLength(1);
    finishSave(true); await applying;
    expect(seg.busy).toBe(false); expect(seg.confirmed).toBe(false);
    expect(seg.message).toContain('拆分结果已更新');
  });

  it('keeps invalid edits in the modal and leaves the saved split untouched', async () => {
    const { studio } = fixture(); const seg = mount(studio);
    const original = clone(studio.segmentation.drafts.parts);
    seg.beginEdit(); seg.plan!.mask!.labels[0] = 999;
    await seg.applyEdit();
    expect(seg.editing).toBe(true); expect(seg.busy).toBe(false);
    expect(seg.error).toContain('无效分组'); expect(studio.savePreparation).not.toHaveBeenCalled();
    expect(studio.segmentation.drafts.parts).toEqual(original);
    seg.cancelEdit(); expect(seg.editing).toBe(false); expect(seg.plan).toEqual(original.plan);
  });

  it('retains applied edits after save failure without reporting success and permits saving again', async () => {
    const { studio } = fixture(); const seg = mount(studio);
    studio.savePreparation.mockResolvedValueOnce(false); studio.prepSaveError = '磁盘空间不足';
    seg.beginEdit(); seg.rename(0, '身体整体'); await seg.applyEdit();
    expect(seg.editing).toBe(false); expect(seg.view).toBe('3d'); expect(seg.busy).toBe(false);
    expect(seg.error).toBe('磁盘空间不足'); expect(seg.message).toContain('保存失败');
    expect(seg.plan!.groups[0]!.name).toBe('身体整体'); expect(seg.confirmed).toBe(false);
    studio.prepSaveError = ''; expect(await seg.persist()).toBe(true); expect(seg.error).toBe('');
    seg.beginEdit(); expect(seg.plan!.groups[0]!.name).toBe('身体整体');
  });

  it('opens confirmed results directly in the editor and cancels without losing their confirmation', async () => {
    const { studio } = fixture(); const seg = mount(studio); await seg.confirmResult();
    const original = clone(seg.plan); seg.setUi('overlay', 'overlay'); seg.adjust();
    expect(seg.editing).toBe(true); expect(seg.overlay).toBe('labels'); expect(seg.view).toBe('3d');
    seg.rename(0, '临时修改'); seg.cancelEdit();
    expect(seg.editing).toBe(false); expect(seg.confirmed).toBe(true); expect(seg.plan).toEqual(original);
    expect(seg.stage).toBe('result'); expect(seg.view).toBe('3d');
  });

  it('selects every disconnected area of a clicked part, while retaining local brush and lasso selections', () => {
    const { studio } = fixture();
    studio.segmentation.drafts.parts.plan!.mask = { referenceId: chickenReference.id, width: 7, height: 1, labels: [1, 1, 0, -1, 1, 1, 0] };
    const seg = mount(studio), original = clone(seg.plan);
    seg.beginEdit(); expect(seg.selectTool).toBe('region');
    for (const seed of [0, 4]) {
      seg.pickRegion(seed);
      expect(seg.selectedPixels).toEqual([0, 1, 4, 5]);
      expect(seg.selectedGroups).toEqual([1]); expect(seg.targetGroup).toBe(1);
    }
    seg.pickRegion(2, 'add');
    expect([...seg.selectedPixels].sort()).toEqual([0, 1, 2, 4, 5, 6]);
    expect(seg.selectedGroups).toEqual([1, 0]);
    seg.pickRegion(4, 'subtract');
    expect(seg.selectedPixels).toEqual([2, 6]); expect(seg.selectedGroups).toEqual([0]);
    seg.pickRegion(3); expect(seg.selectedPixels).toEqual([]); expect(seg.selectedGroups).toEqual([]);
    seg.pickPixels([0]); expect(seg.selectedPixels).toEqual([0]);
    expect(seg.plan).toEqual(original); expect(seg.history).toEqual([]);
  });

  it('links pixel selections to their owners through add, subtract and clear without changing the plan', async () => {
    const { studio } = fixture();
    studio.segmentation.drafts.parts.plan!.mask = { referenceId: chickenReference.id, width: 3, height: 2, labels: [-1, 1, 1, 0, 1, 0] };
    const seg = mount(studio); await seg.confirmResult();
    const original = clone(seg.plan); seg.beginEdit();
    const mask = seg.plan!.mask!;
    seg.pickPixels(connectedPixels(mask, 1));
    expect([...seg.selectedPixels].sort()).toEqual([1, 2, 4]);
    expect(seg.selectedGroups).toEqual([1]); expect(seg.targetGroup).toBe(1);
    // Picking a destination must not highlight unrelated source pixels or
    // change their ownership until the user explicitly assigns them.
    seg.setUi('targetGroup', 0);
    expect(seg.selectedGroups).toEqual([1]); expect(seg.plan).toEqual(original);
    seg.pickPixels([3], 'add');
    expect(seg.selectedGroups).toEqual([1, 0]);
    seg.pickPixels([1], 'subtract');
    expect(seg.selectedGroups).toEqual([1, 0]);
    seg.pickPixels([2, 4], 'subtract');
    expect(seg.selectedGroups).toEqual([0]); expect(seg.selectedPixels).toEqual([3]);
    seg.pickPixels([], 'replace');
    expect(seg.selectedGroups).toEqual([]); expect(seg.selectedPixels).toEqual([]);
    seg.pickPixels(connectedPixels(mask, 0));
    expect(seg.selectedGroups).toEqual([]); expect(seg.selectedPixels).toEqual([]);
    await seg.applyEdit();
    expect(seg.confirmed).toBe(true); expect(seg.plan).toEqual(original);
  });
});

describe('Segment 3D result editing', () => {
  it('adds consecutive model clicks, toggles a selected part and clears on blank space without changing the result', async () => {
    const { studio } = fixture(), seg = mount(studio); await seg.confirmResult();
    const initial = clone(seg.plan);
    seg.pick([0]); expect(seg.selectedGroups).toEqual([1]);
    seg.merge(); expect(seg.plan).toEqual(initial); expect(seg.canUndo).toBe(false);
    seg.pick([3]); expect(seg.selectedGroups).toEqual([1, 0]);
    seg.pick([1]); expect(seg.selectedGroups).toEqual([0]);
    seg.pick([]); expect(seg.selectedGroups).toEqual([]);
    expect(seg.plan).toEqual(initial); expect(seg.confirmed).toBe(true);
  });

  it('merges complete 3D and 2D groups, invalidates saved output, and supports undo and redo', async () => {
    const { studio } = fixture(), seg = mount(studio); await seg.confirmResult();
    studio.segmentation.drafts.parts.result!.projectId = 'confirmed-result';
    const initial = clone(seg.plan);
    seg.pick([0]); seg.pick([3]); seg.merge();
    expect(seg.plan!.groups).toHaveLength(1); expect(new Set(seg.plan!.labels)).toEqual(new Set([1]));
    expect(new Set(seg.plan!.mask!.labels)).toEqual(new Set([1]));
    expect(seg.confirmed).toBe(false); expect(seg.canUndo).toBe(true);
    expect(studio.segmentation.drafts.parts.result!.projectId).toBeUndefined();
    seg.undo(); expect(seg.plan).toEqual(initial); expect(seg.canRedo).toBe(true);
    seg.redo(); expect(seg.plan!.groups).toHaveLength(1);
    await seg.confirmResult(); expect(seg.confirmed).toBe(true); expect(seg.resultEditing).toBe(true);
  });

  it('changes only painted faces, preserves the historical mask, and makes each stroke one undo step', async () => {
    const { studio } = fixture(), seg = mount(studio); await seg.confirmResult();
    const initial = clone(seg.plan);
    seg.setMeshTool('brush'); seg.chooseBrushGroup(0); seg.paintFaces([0, 1, 0]);
    expect(seg.error).toBe(''); expect(seg.plan!.labels).toEqual(Array(12).fill(0));
    expect(seg.plan!.mask).toEqual(initial!.mask); expect(seg.plan!.maskOutdated).toBe(true);
    expect(seg.plan!.groups).toHaveLength(2); // A historical 2D group is retained.
    expect(seg.splitBlocked).toBe(''); expect(seg.confirmed).toBe(false);
    seg.undo(); expect(seg.plan).toEqual(initial); expect(seg.canUndo).toBe(false);
    seg.redo(); expect(seg.plan!.maskOutdated).toBe(true);
    await seg.confirmResult(); expect(seg.confirmed).toBe(true);
    const reopened = mount(studio); expect(reopened.plan!.maskOutdated).toBe(true); expect(reopened.confirmed).toBe(true);
    reopened.beginEdit(); expect(reopened.editing).toBe(false); expect(reopened.error).toContain('尚未同步');
    const count = vi.mocked(downloadFile).mock.calls.length;
    reopened.exportPlan(); expect(vi.mocked(downloadFile).mock.calls.length).toBe(count);
  });

  it('creates a new part only on the first valid stroke, then paints subsequent strokes into that part', () => {
    const { studio } = fixture(), seg = mount(studio), initial = clone(seg.plan);
    seg.addBrushPart(); expect(seg.newBrushPart).toBe(true); expect(seg.plan).toEqual(initial);
    seg.paintFaces([]); expect(seg.plan).toEqual(initial); expect(seg.canUndo).toBe(false);
    seg.paintFaces([0]); expect(seg.plan!.groups).toHaveLength(3); expect(seg.brushGroup).toBe(2);
    expect(seg.newBrushPart).toBe(false); expect(seg.plan!.labels[0]).toBe(2);
    seg.paintFaces([1]); expect(seg.plan!.groups).toHaveLength(3); expect(seg.plan!.labels[1]).toBe(2);
    seg.undo(); expect(seg.plan!.labels[1]).toBe(1); expect(seg.plan!.labels[0]).toBe(2);
    seg.undo(); expect(seg.plan).toEqual(initial);
  });

  it('ignores no-op strokes and invalid faces without clearing confirmation or undo history', async () => {
    const { studio } = fixture(), seg = mount(studio); await seg.confirmResult();
    const initial = clone(seg.plan);
    seg.chooseBrushGroup(1); seg.paintFaces([0, 1]);
    expect(seg.plan).toEqual(initial); expect(seg.canUndo).toBe(false); expect(seg.confirmed).toBe(true);
    seg.paintFaces([-1]); expect(seg.error).toContain('有效'); expect(seg.plan).toEqual(initial);
    seg.paintFaces([12]); expect(seg.plan).toEqual(initial); expect(seg.canUndo).toBe(false);
  });

  it('samples a part without editing and clamps the brush size', () => {
    const { studio } = fixture(), seg = mount(studio), initial = clone(seg.plan);
    seg.setMeshTool('picker'); seg.pickBrushGroup(0);
    expect(seg.meshTool).toBe('brush'); expect(seg.brushGroup).toBe(1); expect(seg.brushColor).toBe('#f2bb6b');
    seg.setMeshRadius(0); expect(seg.meshRadius).toBe(1);
    seg.setMeshRadius(150); expect(seg.meshRadius).toBe(100);
    seg.setMeshRadius(NaN); expect(seg.meshRadius).toBe(100);
    expect(seg.plan).toEqual(initial); expect(seg.canUndo).toBe(false);
  });

  it('undoes applied local 2D changes back to valid 3D and clears redo when a new edit is made', async () => {
    const { studio } = fixture(), seg = mount(studio), initial = clone(seg.plan);
    seg.beginEdit(); seg.pickPixels([0]); seg.setUi('targetGroup', 1); seg.assign(); await seg.applyEdit();
    expect(seg.plan!.mappingDirty).toBe(true); expect(seg.resultEditing).toBe(false); expect(seg.canUndo).toBe(true);
    seg.undo(); expect(seg.plan).toEqual(initial); expect(seg.resultEditing).toBe(true);
    seg.chooseBrushGroup(0); seg.paintFaces([0]); expect(seg.canRedo).toBe(false);
  });

  it('isolates edit histories between modes and models', async () => {
    const { studio } = fixture(), seg = mount(studio);
    seg.chooseBrushGroup(0); seg.paintFaces([0]); expect(seg.canUndo).toBe(true);
    seg.setMode('colors'); expect(seg.resultEditing).toBe(false); expect(seg.canUndo).toBe(false);
    seg.setMode('parts'); expect(seg.plan!.labels[0]).toBe(0); expect(seg.canUndo).toBe(false);
    seg.rename(0, '身体整体'); expect(seg.canUndo).toBe(true);
    studio.segmentation = fixture().document; studio.content = { ...studio.content, id: 'model-b' };
    await nextTick();
    expect(seg.canUndo).toBe(false); expect(seg.canRedo).toBe(false); expect(seg.meshTool).toBe('select');
    expect(seg.plan!.groups[0]!.name).toBe('身体');
  });
});
