import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Mesh } from 'three';
import { downloadFile } from '~/@base/storage';
import type { useWorkspace } from '~/@feature/workspace/use-workspace';
import { assignFaces, connectedPieces, extractGroup, faceColors, geometryKey, suggestReferenceGeometry, validatePlan } from './geometry';
import { applyPreviewToGeometry, assignPixels, chickenReference, connectedPixels, legacyChickenReference, makeReferenceMask, mergePlanGroups, presetTarget, previewGroupMapping, promptExamples, readReference, referenceGroups, splitProblem, suggestedPrompt, validateMask } from './reference';
import { freshDraft, markerColors, optionsKey, type SegmentDocument, type SegmentMode, type SegmentOptions, type SegmentPlan } from './types';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function useSegmentation(studio: ReturnType<typeof useWorkspace>) {
  const busy = ref(false), processingLabel = ref(''), message = ref(''), error = ref('');
  const stage = ref<'input' | 'plan' | 'result'>('input');
  const view = computed(() => '3d' as const), sourceView = ref(false);
  const displayPlan = shallowRef<SegmentPlan | null>(null);
  const overlay = ref<'overlay' | 'labels'>('labels'), explosion = ref(0);
  const selectedGroups = ref<number[]>([]), selectedFaces = shallowRef<number[]>([]), selectedPixels = shallowRef<number[]>([]), hidden = ref<number[]>([]), solo = ref<number | null>(null);
  const editing = ref(false), editPlan = shallowRef<SegmentPlan | null>(null), history = shallowRef<SegmentPlan[]>([]), future = shallowRef<SegmentPlan[]>([]);
  const baseline2d = shallowRef<SegmentPlan | null>(null), previewing2d = ref(false), editorPrompt = ref(''), confirmPreviewRefresh = ref(false);
  const editorSettings = shallowRef<SegmentOptions | null>(null);
  let initialEditorPlan: SegmentPlan | null = null, initialEditorPrompt = '';
  const editorNewPart = ref<string | null>(null);
  const meshTool = ref<'select' | 'brush' | 'picker'>('select'), meshRadius = ref(50), brushGroup = ref(0), newBrushPart = ref(false);
  const meshHistory = shallowRef<SegmentPlan[]>([]), meshFuture = shallowRef<SegmentPlan[]>([]);
  const selectTool = ref<'region' | 'lasso' | 'brush' | 'pan'>('region'), selectAction = ref<'replace' | 'add' | 'subtract'>('replace'), radius = ref(22), targetGroup = ref(0), newName = ref('');
  const confirmPrompt = ref(false);
  let colors: Float32Array | undefined, inputKey = '', editStage: 'input' | 'plan' | 'result' = 'plan';
  const doc = computed(() => studio.segmentation);
  const mode = computed(() => doc.value?.mode ?? 'parts');
  const draft = computed(() => doc.value?.drafts[mode.value]);
  const options = computed(() => draft.value?.options ?? freshDraft().options);
  const preview2d = computed(() => draft.value?.preview2d ?? false);
  const editorStale = computed(() => !!(editing.value && editPlan.value && editorSettings.value && editPlan.value.optionsKey !== optionsKey(mode.value, { ...editorSettings.value, prompt: editorPrompt.value })));
  const reference = computed(() => doc.value?.reference);
  const splitBlocked = computed(() => splitProblem(draft.value?.plan, reference.value?.id));
  const plan = computed(() => editing.value ? editPlan.value : stage.value === 'result' ? draft.value?.result?.plan ?? null : draft.value?.plan ?? null);
  const recoverable = computed(() => !!draft.value?.previousPlan);
  const staleReason = computed(() => {
    const saved = draft.value?.plan; if (!saved) return '';
    if (saved.mask && saved.mask.referenceId !== reference.value?.id) return '参考图已更新为高清版，请点击“开始拆分”更新分区。原方案会保留，可恢复或下载。';
    return saved.optionsKey !== optionsKey(mode.value, options.value) ? '拆分要求已修改，请点击“开始拆分”更新方案。' : '';
  });
  const stale = computed(() => editing.value ? editorStale.value : !!staleReason.value);
  const confirmed = computed(() => !!draft.value?.result?.confirmed && !stale.value && !splitBlocked.value);
  const supported = computed(() => studio.project?.sourceSample === 'chicken');
  const colorAvailable = computed(() => supported.value && !!reference.value);
  const locked = computed(() => busy.value || studio.busy || studio.prepSaving);
  const resultEditing = computed(() => !!plan.value && !editing.value && !stale.value && !splitBlocked.value);
  const nextGroupId = computed(() => Math.max(-1, ...(plan.value?.groups.map(g => g.id) ?? [])) + 1);
  const editorTarget = computed(() => editorNewPart.value !== null ? { id: nextGroupId.value, name: editorNewPart.value, color: markerColors[nextGroupId.value % markerColors.length]! } : plan.value?.groups.find(g => g.id === targetGroup.value));
  const brushColor = computed(() => newBrushPart.value ? markerColors[nextGroupId.value % markerColors.length]! : plan.value?.groups.find(g => g.id === brushGroup.value)?.color ?? '#83b8ff');
  const canUndo = computed(() => editing.value ? history.value.length > 0 : !stale.value && meshHistory.value.length > 0);
  const canRedo = computed(() => editing.value ? future.value.length > 0 : !stale.value && meshFuture.value.length > 0);
  const pieces = computed(() => !editing.value && plan.value && !plan.value.mappingDirty && !stale.value && studio.content ? connectedPieces(studio.content.mesh, plan.value) : []);
  const displayPieces = computed(() => displayPlan.value && studio.content ? connectedPieces(studio.content.mesh, displayPlan.value) : []);
  const displayPending = computed(() => !!displayPlan.value && (!draft.value?.plan || !!staleReason.value));
  const openPieces = computed(() => pieces.value.filter(p => p.boundary || p.nonManifold).length);
  const groupCounts = computed(() => { const counts = new Map<number, number>(); for (const label of plan.value?.labels ?? []) counts.set(label, (counts.get(label) ?? 0) + 1); return counts; });
  const pixelCounts = computed(() => { const counts = new Map<number, number>(); for (const label of plan.value?.mask?.labels ?? []) if (label >= 0) counts.set(label, (counts.get(label) ?? 0) + 1); return counts; });
  const selected = computed(() => editing.value ? Uint32Array.from(selectedFaces.value) : Uint32Array.from((plan.value?.labels ?? []).flatMap((id, f) => selectedGroups.value.includes(id) ? [f] : [])));

  watch(() => studio.content?.id, () => {
    displayPlan.value = null;
    colors = undefined; inputKey = studio.content ? geometryKey(studio.content.mesh) : '';
    editing.value = false; editPlan.value = null; baseline2d.value = null; previewing2d.value = false; editorPrompt.value = ''; editorSettings.value = null; confirmPreviewRefresh.value = false; selectedGroups.value = []; selectedFaces.value = []; selectedPixels.value = []; hidden.value = []; solo.value = null; explosion.value = 0;
    resetMeshTools();
    message.value = ''; error.value = ''; confirmPrompt.value = false;
    const saved = studio.segmentation;
    if (saved && saved.version === 1 && saved.geometryKey === inputKey && saved.drafts?.parts && saved.drafts?.colors) {
      try { for (const d of Object.values(saved.drafts)) { if (d.plan) validatePlan(d.plan, studio.content!.mesh); if (d.result) validatePlan(d.result.plan, studio.content!.mesh); } }
      catch { error.value = '保存的拆分方案不匹配，已恢复为空白方案。'; studio.segmentation = null; }
    } else if (saved) { error.value = '模型版本已变化，请重新生成拆分方案。'; studio.segmentation = null; }
    if (!studio.segmentation && studio.content) studio.segmentation = { version: 1, geometryKey: inputKey, mode: 'parts', drafts: { parts: freshDraft(), colors: freshDraft() } };
    if (studio.segmentation && studio.project?.sourceSample === 'chicken') {
      const next = copy(studio.segmentation); next.reference = copy(chickenReference);
      for (const m of ['parts', 'colors'] as const) {
        const current = next.drafts[m];
        if (!current.options.prompt.trim() || current.options.prompt.trim() === promptExamples[m][0]) {
          const previousKey = optionsKey(m, current.options);
          current.options.prompt = suggestedPrompt(m);
          // Expanding the default wording preserves any matching saved split and confirmation.
          for (const savedPlan of [current.plan, current.result?.plan, current.previousPlan]) {
            if (savedPlan?.optionsKey === previousKey) savedPlan.optionsKey = optionsKey(m, current.options);
          }
        }
        // Keep the legacy field readable, but the retired detail setting no longer drives new splits.
        current.options.detail = 'standard';
      }
      studio.segmentation = next;
    }
    restoreStage();
    sourceView.value = !draft.value?.plan;
    updateDisplayPlan(draft.value?.plan);
  }, { immediate: true });

  // Keep the last generated mesh visible while settings are being changed,
  // including a mode with no draft yet. It is only a display snapshot: stale
  // results remain unavailable for editing, confirmation and export.
  watch(() => draft.value?.plan, updateDisplayPlan, { flush: 'sync' });

  function updateDisplayPlan(next: SegmentPlan | null | undefined) {
    if (next?.mappingDirty) displayPlan.value = null;
    else if (next && studio.content && next.key === inputKey && next.labels.length === studio.content.mesh.positions.length / 9) displayPlan.value = next;
  }

  function resetMeshTools() { meshHistory.value = []; meshFuture.value = []; meshTool.value = 'select'; newBrushPart.value = false; brushGroup.value = 0; }
  function change(action: (next: SegmentDocument) => void) {
    if (!doc.value) return;
    const next = copy(doc.value); action(next); studio.segmentation = next;
    studio.preparation.engaged = true; studio.saved = false;
  }
  async function persist() {
    const modelId = studio.content?.id;
    // A queued workspace autosave can start while segmentation awaits texture
    // decoding. Finish that snapshot before explicitly saving the latest result.
    if (studio.busy || studio.prepSaving) await new Promise<void>(resolve => {
      const stop = watch(() => studio.busy || studio.prepSaving, pending => { if (!pending) { stop(); resolve(); } });
    });
    if (studio.content?.id !== modelId) { error.value = '模型已切换，请在对应模型中保存。'; return false; }
    const ok = await studio.savePreparation(); error.value = ok ? '' : studio.prepSaveError || studio.failure || '保存失败，请重试。'; return ok;
  }
  async function task(action: () => Promise<void>, label = '正在处理…') {
    if (locked.value) return; busy.value = true; processingLabel.value = label; error.value = ''; message.value = '';
    try { await action(); } catch (e) { error.value = e instanceof Error ? e.message : String(e); } finally { busy.value = false; processingLabel.value = ''; }
  }
  async function showProcessing() {
    await nextTick();
    // Give the dialog time to unmount and the 3D loading overlay a frame to paint.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }
  function restoreStage() {
    stage.value = confirmed.value ? 'result' : draft.value?.plan ? 'plan' : 'input';
    brushGroup.value = plan.value?.groups[0]?.id ?? 0;
  }
  function setMode(next: SegmentMode) {
    if (locked.value || editing.value || (next === 'colors' && !colorAvailable.value)) return;
    resetMeshTools(); change(d => { d.mode = next; }); selectedGroups.value = []; hidden.value = []; solo.value = null; explosion.value = 0;
    confirmPrompt.value = false; error.value = ''; message.value = '';
    restoreStage();
  }
  function setOption<K extends keyof SegmentOptions>(key: K, value: SegmentOptions[K]) {
    if (locked.value || editing.value || options.value[key] === value) return;
    change(d => { const current = d.drafts[mode.value]; current.options[key] = value; if (current.result) current.result.confirmed = false; });
    stage.value = draft.value?.plan ? 'plan' : 'input'; meshTool.value = 'select'; message.value = ''; error.value = '';
  }
  function setPreview2d(value: boolean) {
    if (locked.value || editing.value || draft.value?.preview2d === value) return;
    change(d => { d.drafts[mode.value].preview2d = value; });
  }
  function recognize(confirmed = false) {
    if (locked.value || editing.value || !reference.value) return;
    if (options.value.prompt && options.value.prompt !== suggestedPrompt(mode.value) && !confirmed) { confirmPrompt.value = true; return; }
    confirmPrompt.value = false; setOption('prompt', suggestedPrompt(mode.value));
    message.value = '已填入小鸡参考图的默认拆分要求。';
  }
  async function create2dProposal(settings: SegmentOptions): Promise<SegmentPlan> {
    if (!studio.content || !reference.value) throw new Error('请先选择有生成参考图的小鸡示例。');
    const input = await readReference(reference.value);
    const mask = makeReferenceMask(input.data, input.width, input.height, mode.value, settings, reference.value.id);
    const groups = referenceGroups(mode.value, mask.labels, presetTarget(mode.value, settings.prompt));
    validateMask(mask, groups, reference.value.id);
    // No face labels or mesh extraction until explicit confirmation in the dialog.
    return { key: inputKey, optionsKey: optionsKey(mode.value, settings), labels: [], groups, mask, edited: false, method: 'reference-demo-v1' };
  }
  function commitSplit(next: SegmentPlan, settings: SegmentOptions) {
    change(d => { const value = d.drafts[mode.value]; if (value.plan) value.previousPlan = copy(value.plan); value.options = settings; value.plan = next; value.result = { plan: copy(next), createdAt: new Date().toISOString(), confirmed: false }; });
    stage.value = 'plan'; sourceView.value = false; selectedGroups.value = []; hidden.value = []; solo.value = null; explosion.value = 0;
    resetMeshTools(); brushGroup.value = next.groups[0]?.id ?? 0;
  }
  async function split() {
    if (!supported.value || editing.value || locked.value) return;
    await task(async () => {
      if (!studio.content || !reference.value) throw new Error('请先选择有生成参考图的小鸡示例。');
      const settings = { ...options.value, detail: 'standard' as const };
      await showProcessing();
      if (preview2d.value) {
        const next = await create2dProposal(settings);
        openEditor(next, settings, true); baseline2d.value = next;
        return;
      }
      colors ??= await faceColors(studio.content.mesh);
      const input = await readReference(reference.value);
      const next = suggestReferenceGeometry(studio.content.mesh, mode.value, settings, colors);
      next.mask = makeReferenceMask(input.data, input.width, input.height, mode.value, settings, reference.value.id);
      next.groups = referenceGroups(mode.value, [...next.labels, ...next.mask.labels], presetTarget(mode.value, settings.prompt));
      validateMask(next.mask, next.groups, reference.value.id);
      const count = connectedPieces(studio.content.mesh, next).length;
      if (!count) throw new Error('没有生成有效部件，请调整要求后重试。');
      commitSplit(next, settings);
      if (await persist()) message.value = `已生成 ${count} 个示例表面网格。已进入编辑模式，可多选合并或笔刷精修，再点击 Save 保存确认。`;
      else message.value = '拆分结果已保留在当前草稿中，保存失败，请重试保存。';
    }, preview2d.value ? '生成 2D 分区方案中…' : '拆分中…');
  }
  function restorePrevious() {
    const previous = draft.value?.previousPlan;
    if (!previous || locked.value || editing.value) return;
    change(d => {
      const value = d.drafts[mode.value], old = value.plan;
      value.plan = copy(previous); value.previousPlan = old ?? undefined; value.result = null;
      const settings = JSON.parse(previous.optionsKey);
      value.options = { prompt: settings[1], detail: 'standard', mergeSimilar: settings[3] };
    });
    stage.value = 'plan'; selectedGroups.value = []; hidden.value = []; solo.value = null; resetMeshTools();
  }
  function selectGroup(id: number, additive = false) {
    if (locked.value || !plan.value?.groups.some(g => g.id === id)) return;
    if (editing.value && plan.value.mask) {
      const pixels = plan.value.mask.labels.flatMap((label, i) => label === id ? [i] : []);
      const selected = new Set(selectedPixels.value);
      pickPixels(pixels, additive ? pixels.every(i => selected.has(i)) ? 'subtract' : 'add' : 'replace');
      return;
    }
    selectedGroups.value = additive ? selectedGroups.value.includes(id) ? selectedGroups.value.filter(v => v !== id) : [...selectedGroups.value, id] : [id];
    if (resultEditing.value) { brushGroup.value = id; newBrushPart.value = false; }
  }
  function pickPixels(pixels: number[], action = selectAction.value) {
    if (!plan.value?.mask || locked.value) return;
    const valid = pixels.filter(i => plan.value!.mask!.labels[i] !== undefined && plan.value!.mask!.labels[i]! >= 0);
    if (!editing.value) { if (valid.length) selectGroup(plan.value.mask.labels[valid[0]!]!, action === 'add'); else selectedGroups.value = []; return; }
    const set = new Set(action === 'replace' ? [] : selectedPixels.value);
    for (const i of valid) { if (action === 'subtract') set.delete(i); else set.add(i); }
    selectedPixels.value = [...set];
    // Selection never changes the destination color for assignment or painting.
    selectedGroups.value = [...new Set(selectedPixels.value.map(i => plan.value!.mask!.labels[i]!))];
  }
  function pickRegion(seed: number, action = selectAction.value) {
    if (!plan.value?.mask || locked.value) return;
    // Group IDs define ownership, including disconnected areas of one part.
    pickPixels(connectedPixels(plan.value.mask, seed, true), action);
  }
  function pick(faces: number[], action = selectAction.value) {
    if (locked.value || !plan.value || stale.value) return;
    if (!editing.value) {
      if (!faces.length) selectedGroups.value = [];
      else { const id = plan.value.labels[faces[0]!]; if (id !== undefined) { if (action === 'subtract') selectedGroups.value = selectedGroups.value.filter(g => g !== id); else selectGroup(id, true); } }
      return;
    }
    const set = new Set(action === 'replace' ? [] : selectedFaces.value);
    for (const f of faces) { if (action === 'subtract') set.delete(f); else set.add(f); }
    selectedFaces.value = [...set];
  }
  function beginEdit() {
    if (editing.value || !plan.value?.mask || stale.value || locked.value) return;
    if (plan.value.maskOutdated) { error.value = '3D 笔刷已改变部件归属，参考图分区尚未同步。请撤销笔刷修改，或点击“开始拆分”更新方案后再编辑 2D。'; return; }
    openEditor(plan.value, options.value, false);
  }
  function openEditor(next: SegmentPlan, settings: SegmentOptions, before3d: boolean) {
    meshTool.value = 'select';
    if (!editing.value) { editStage = stage.value; initialEditorPlan = next; initialEditorPrompt = settings.prompt; }
    previewing2d.value = before3d; editorSettings.value = { ...settings }; editorPrompt.value = settings.prompt;
    editPlan.value = copy(next); editing.value = true; stage.value = 'plan'; overlay.value = 'labels'; confirmPreviewRefresh.value = false;
    error.value = ''; newName.value = ''; editorNewPart.value = null; selectTool.value = 'region'; selectAction.value = 'replace';
    selectedGroups.value = []; selectedFaces.value = []; selectedPixels.value = []; history.value = []; future.value = []; hidden.value = []; solo.value = null; targetGroup.value = next.groups[0]!.id;
  }
  function closeEditor() { editing.value = false; editPlan.value = null; baseline2d.value = null; previewing2d.value = false; editorPrompt.value = ''; editorSettings.value = null; initialEditorPlan = null; editorNewPart.value = null; confirmPreviewRefresh.value = false; selectedGroups.value = []; selectedFaces.value = []; selectedPixels.value = []; history.value = []; future.value = []; hidden.value = []; solo.value = null; stage.value = editStage; }
  function hasEditorChanges() { return editing.value && (editorPrompt.value !== initialEditorPrompt || JSON.stringify(editPlan.value) !== JSON.stringify(initialEditorPlan)); }
  function cancelEdit() { if (!editing.value || locked.value) return; closeEditor(); error.value = ''; }
  function setEditorPrompt(value: string) {
    if (!editing.value || locked.value) return;
    editorPrompt.value = value.slice(0, 600); confirmPreviewRefresh.value = false; error.value = '';
  }
  async function refreshPreview(replaceEdited = false) {
    if (!editing.value || !editorSettings.value || locked.value) return;
    if (editPlan.value?.edited && !replaceEdited) { confirmPreviewRefresh.value = true; return; }
    await task(async () => {
      const settings = { ...editorSettings.value!, prompt: editorPrompt.value, detail: 'standard' as const };
      await showProcessing();
      const next = await create2dProposal(settings);
      openEditor(next, settings, true); baseline2d.value = next;
    }, '更新 2D 分区方案中…');
  }
  function updatePlan(next: SegmentPlan) {
    change(d => {
      const value = d.drafts[mode.value]; value.plan = copy(next);
      value.result = splitProblem(next, reference.value?.id) ? null : { plan: copy(next), createdAt: new Date().toISOString(), confirmed: false };
    });
    stage.value = 'plan'; message.value = '分区已更新，请检查后确认拆分结果。';
  }
  async function applyEdit() {
    if (!editing.value || !editPlan.value || locked.value) return;
    if (editorStale.value) { error.value = '拆分要求已修改，请先更新分区方案再确认。'; return; }
    const next = copy(editPlan.value);
    await task(async () => {
      validateMask(next.mask!, next.groups, reference.value?.id);
      if (previewing2d.value) {
        const preview = baseline2d.value;
        if (!preview?.mask) throw new Error('2D 预览已失效，请点击“开始拆分”更新方案。');
        // Validate mapping before closing: unsupported local pixel edits stay
        // recoverable in the dialog, without generating a mismatched 3D result.
        previewGroupMapping(preview.mask, next);
        const settings = { ...editorSettings.value! }, previousHistory = history.value, previousFuture = future.value;
        const originalEditorPlan = initialEditorPlan, originalEditorPrompt = initialEditorPrompt;
        const modelId = studio.content!.id;
        closeEditor();
        let generated: SegmentPlan, count: number;
        try {
          await showProcessing();
          colors ??= await faceColors(studio.content!.mesh);
          if (studio.content?.id !== modelId) throw new Error('模型已切换，请重新生成方案。');
          const geometry = suggestReferenceGeometry(studio.content.mesh, mode.value, settings, colors);
          generated = applyPreviewToGeometry(geometry, preview.mask, next);
          validatePlan(generated, studio.content.mesh);
          count = connectedPieces(studio.content.mesh, generated).length;
          if (!count) throw new Error('没有生成有效部件，请调整 2D 方案后重试。');
        } catch (e) {
          if (studio.content?.id === modelId) { openEditor(next, settings, true); baseline2d.value = preview; history.value = previousHistory; future.value = previousFuture; initialEditorPlan = originalEditorPlan; initialEditorPrompt = originalEditorPrompt; }
          throw e;
        }
        commitSplit(generated, settings);
        if (await persist()) message.value = `已生成 ${count} 个 3D 示例表面网格，请检查并点击 Save 确认。`;
        else message.value = '拆分结果已保留在当前草稿中，保存失败，请重试保存。';
        return;
      }
      validatePlan(next, studio.content!.mesh);
      const changed = JSON.stringify(draft.value?.plan) !== JSON.stringify(next);
      closeEditor();
      if (changed) commitMeshEdit(next);
      message.value = '正在检查分区并更新拆分结果…';
      await showProcessing();
      // Reuse the edited labels for supported whole-group changes. Never regenerate
      // the reference mask here: that would discard the user's local pixel edits.
      if (!next.mappingDirty && !connectedPieces(studio.content!.mesh, next).length) throw new Error('没有有效的拆分部件，请重新调整分区。');
      if (!await persist()) { message.value = '修改已保留在当前草稿中，保存失败，请重试保存。'; return; }
      message.value = next.mappingDirty ? '2D 修改已保存。局部边界需要算法映射到 3D，当前显示原始模型；可继续调整或下载方案。' : confirmed.value ? '拆分结果保持已确认。' : '拆分结果已更新，请检查并确认。';
    }, '拆分中…');
  }
  function setEdit(next: SegmentPlan) { if (!editPlan.value) return; history.value = [...history.value.slice(-19), editPlan.value]; future.value = []; editPlan.value = next; error.value = ''; }
  function chooseEditorTarget(id: number) {
    if (locked.value || !editing.value || !plan.value?.groups.some(g => g.id === id)) return;
    targetGroup.value = id; editorNewPart.value = null;
  }
  function prepareEditorPart(name: string) {
    if (locked.value || !editing.value || !name.trim()) return;
    editorNewPart.value = name.trim().slice(0, 60);
  }
  function syncEditorSelection() {
    const mask = editPlan.value?.mask; if (!mask) return;
    selectedPixels.value = selectedPixels.value.filter(i => mask.labels[i] !== undefined && mask.labels[i]! >= 0);
    selectedGroups.value = [...new Set(selectedPixels.value.map(i => mask.labels[i]!))];
    const ids = new Set(editPlan.value!.groups.map(g => g.id));
    if (!ids.has(targetGroup.value)) targetGroup.value = editPlan.value!.groups[0]!.id;
    hidden.value = hidden.value.filter(id => ids.has(id)); if (solo.value !== null && !ids.has(solo.value)) solo.value = null;
  }
  function editPixels(pixels: number[], clearSelection: boolean, name = editorNewPart.value) {
    if (locked.value || !editPlan.value?.mask) return;
    const current = editPlan.value, mask = current.mask!;
    const valid = [...new Set(pixels)].filter(i => Number.isInteger(i) && i >= 0 && i < mask.labels.length && mask.labels[i]! >= 0);
    if (!valid.length) return;
    try {
      if (name || valid.some(i => mask.labels[i] !== targetGroup.value)) {
        const next = assignPixels(current, valid, targetGroup.value, name ?? undefined);
        if (name) targetGroup.value = next.mask!.labels[valid[0]!]!;
        setEdit(next); editorNewPart.value = null;
      }
      if (clearSelection) selectedPixels.value = [];
      syncEditorSelection();
    } catch (e) { error.value = e instanceof Error ? e.message : String(e); }
  }
  function assign(create = false) {
    if (locked.value || !editPlan.value || !selectedPixels.value.length) return;
    editPixels(selectedPixels.value, true, create ? newName.value || '新部件' : editorNewPart.value); newName.value = '';
  }
  function paintPixels(pixels: number[]) {
    if (!editing.value || !editPlan.value?.mask) return;
    const selection = selectedPixels.value.length ? new Set(selectedPixels.value) : null, mask = editPlan.value.mask;
    editPixels(pixels.filter(i => (!selection || selection.has(i)) && !hidden.value.includes(mask.labels[i]!) && (solo.value === null || mask.labels[i] === solo.value)), false);
  }
  function undo() { if (!editing.value) { travelMeshHistory(false); return; } if (!history.value.length || locked.value) return; future.value = [...future.value, editPlan.value!]; editPlan.value = history.value[history.value.length - 1]!; history.value = history.value.slice(0, -1); editorNewPart.value = null; syncEditorSelection(); error.value = ''; }
  function redo() { if (!editing.value) { travelMeshHistory(true); return; } if (!future.value.length || locked.value) return; history.value = [...history.value, editPlan.value!]; editPlan.value = future.value[future.value.length - 1]!; future.value = future.value.slice(0, -1); editorNewPart.value = null; syncEditorSelection(); error.value = ''; }
  function rename(id: number, name: string) {
    if (!name.trim() || !plan.value || locked.value || stale.value) return;
    const next = copy(plan.value), group = next.groups.find(g => g.id === id); if (!group || group.name === name.trim()) return; group.name = name.trim().slice(0, 60); next.edited = true;
    if (editing.value) setEdit(next);
    else commitMeshEdit(next);
  }
  function merge() {
    if (selectedGroups.value.length < 2 || !plan.value || locked.value || stale.value) return;
    const target = selectedGroups.value[0]!, next = mergePlanGroups(plan.value, selectedGroups.value);
    if (editing.value) { setEdit(next); syncEditorSelection(); }
    else { commitMeshEdit(next); selectedGroups.value = [target]; }
  }
  // Plan snapshots are immutable after commit; share the large reference mask
  // in history rather than cloning it for every brush stroke.
  function commitMeshEdit(next: SegmentPlan) {
    if (!draft.value?.plan) return;
    meshHistory.value = [...meshHistory.value.slice(-19), draft.value.plan]; meshFuture.value = [];
    updatePlan(next); hidden.value = hidden.value.filter(id => next.groups.some(g => g.id === id));
    if (solo.value !== null && !next.groups.some(g => g.id === solo.value)) solo.value = null;
    if (!next.groups.some(g => g.id === brushGroup.value)) brushGroup.value = next.groups[0]!.id;
  }
  function travelMeshHistory(redo: boolean) {
    if (editing.value || stale.value || locked.value || !plan.value) return;
    const from = redo ? meshFuture : meshHistory, to = redo ? meshHistory : meshFuture;
    const next = from.value.at(-1); if (!next) return;
    to.value = [...to.value.slice(-19), plan.value]; from.value = from.value.slice(0, -1);
    updatePlan(next); selectedGroups.value = []; hidden.value = []; solo.value = null;
    newBrushPart.value = false; brushGroup.value = next.groups[0]!.id; error.value = '';
  }
  function setMeshTool(tool: 'select' | 'brush' | 'picker') {
    if (!resultEditing.value || locked.value) return;
    meshTool.value = tool; selectedGroups.value = [];
    if (!plan.value?.groups.some(g => g.id === brushGroup.value)) brushGroup.value = plan.value!.groups[0]!.id;
    if (tool === 'select') newBrushPart.value = false;
  }
  function chooseBrushGroup(id: number) {
    if (!resultEditing.value || locked.value || !plan.value?.groups.some(g => g.id === id)) return;
    brushGroup.value = id; newBrushPart.value = false; meshTool.value = 'brush';
  }
  function pickBrushGroup(face: number) {
    const id = plan.value?.labels[face]; if (id !== undefined) chooseBrushGroup(id);
  }
  function addBrushPart() {
    if (!resultEditing.value || locked.value) return;
    newBrushPart.value = true; meshTool.value = 'brush'; selectedGroups.value = [];
  }
  function setMeshRadius(value: number) { if (Number.isFinite(value)) meshRadius.value = Math.max(1, Math.min(100, Math.round(value))); }
  function paintFaces(faces: number[]) {
    if (!resultEditing.value || locked.value || !plan.value || !faces.length) return;
    try {
      const current = plan.value, id = newBrushPart.value ? nextGroupId.value : brushGroup.value;
      const next = assignFaces(current, faces, id, newBrushPart.value ? `新部件 ${id + 1}` : undefined);
      if (next === current) return;
      validatePlan(next, studio.content!.mesh); commitMeshEdit(next);
      newBrushPart.value = false; brushGroup.value = id; selectedGroups.value = [];
      message.value = '已更新 3D 部件归属，可撤销或 Save。参考图分区尚未同步；切口平整化与封闭仍需算法支持。';
    } catch (e) { error.value = e instanceof Error ? e.message : String(e); }
  }
  function toggleHidden(id: number) { hidden.value = hidden.value.includes(id) ? hidden.value.filter(v => v !== id) : [...hidden.value, id]; }
  function toggleSolo(id: number) { solo.value = solo.value === id ? null : id; }
  async function confirmResult() {
    if (editing.value || stale.value || !draft.value?.plan) return;
    await task(async () => {
      if (splitBlocked.value) throw new Error(splitBlocked.value);
      validatePlan(draft.value!.plan!, studio.content!.mesh);
      validateMask(draft.value!.plan!.mask!, draft.value!.plan!.groups, reference.value?.id);
      if (!pieces.value.length) throw new Error('没有可确认的拆分结果，请点击“开始拆分”生成方案。');
      const previous = draft.value?.result ? copy(draft.value.result) : null;
      change(d => { const value = d.drafts[mode.value]; value.result = { ...value.result, plan: copy(value.plan!), createdAt: value.result?.createdAt ?? new Date().toISOString(), confirmed: true }; });
      if (!await persist()) { change(d => { d.drafts[mode.value].result = previous; }); return; }
      stage.value = 'result';
      message.value = `已确认 ${pieces.value.length} 个独立表面网格，可继续多色或打印准备。`;
    });
  }
  function adjust() { beginEdit(); }
  async function resultFile() {
    if (!confirmed.value || editing.value || !plan.value || !pieces.value.length || !studio.content) throw new Error('请先确认拆分结果。');
    const problem = splitProblem(plan.value, reference.value?.id); if (problem) throw new Error(problem);
    validatePlan(plan.value, studio.content.mesh);
    const root = extractGroup(studio.content.mesh, pieces.value);
    try {
      const buffer = await new GLTFExporter().parseAsync(root, { binary: true });
      if (!(buffer instanceof ArrayBuffer)) throw new Error('GLB 生成失败。');
      return new File([buffer], `${studio.project!.name} · 拆分结果.glb`, { type: 'model/gltf-binary' });
    } finally { root.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } }); }
  }
  async function exportResult() { await task(async () => { const file = await resultFile(); if (!await persist()) return; downloadFile(file, file.name); message.value = '已导出独立网格 GLB。保留原坐标、部件名称；不包含爆炸位移、标记色或原贴图。'; }); }
  async function forward(target: 'print' | 'multi-color') {
    await task(async () => {
      const result = draft.value?.result; if (!result || !confirmed.value || editing.value) throw new Error('请先确认拆分结果。');
      const existing = result.projectId;
      if (existing && studio.projects.some(p => p.id === existing)) { if (!await persist()) return; await studio.openProject(existing); }
      else {
        const sourceId = studio.project!.id, height = studio.settings.height, open = openPieces.value, id = crypto.randomUUID();
        const file = await resultFile(); change(d => { d.drafts[mode.value].result!.projectId = id; });
        if (!await persist()) return;
        await studio.loadSegmentResult(file, sourceId, height, open, id);
      }
      if (studio.failure) throw new Error(studio.failure);
      await studio.navigatePreparation(target);
    });
  }
  async function sample(white = false) { if (locked.value || editing.value) return; await studio.demo(white ? 'white' : 'textured'); if (!studio.failure) await studio.navigatePreparation('segment'); }
  async function selectModel(id: string) {
    if (locked.value || editing.value || id === studio.project?.id) return;
    await task(async () => {
      await studio.openProject(id);
      if (studio.failure) throw new Error(studio.failure);
      await studio.navigatePreparation('segment');
    });
  }
  function exportPlan() {
    if (!plan.value?.mask || !reference.value || editing.value) return;
    if (plan.value.maskOutdated) { error.value = '3D 精修后参考图分区尚未同步，请使用 Export 导出当前 3D 结果。'; return; }
    // An archived low-resolution mask must retain its original source metadata.
    const source = plan.value.mask.referenceId === legacyChickenReference.id ? legacyChickenReference : reference.value;
    if (source.id !== plan.value.mask.referenceId) { error.value = '方案与参考图版本不匹配，请点击“开始拆分”更新方案。'; return; }
    const payload = { version: 1, modelId: studio.project?.id, geometryKey: inputKey, reference: source, mode: mode.value, options: options.value, groups: plan.value.groups, mask: plan.value.mask, requires3dMapping: !!plan.value.mappingDirty };
    downloadFile(new Blob([JSON.stringify(payload)], { type: 'application/json' }), 'chicken-segment-plan.json');
    message.value = '已下载 2D 方案，包含参考图标识、分组与像素归属；不是可打印的模型文件。';
  }
  const ui = { sourceView, overlay, explosion, selectedFaces, selectedPixels, hidden, solo, selectTool, selectAction, radius, targetGroup, newName, confirmPrompt, confirmPreviewRefresh };
  function setUi<K extends keyof typeof ui>(key: K, value: (typeof ui)[K]['value']) { ui[key].value = value; }
  return reactive({ editorTarget, editorNewPart, chooseEditorTarget, prepareEditorPart, paintPixels, hasEditorChanges, setUi, busy, processingLabel, message, error, stage, confirmed, view, sourceView, displayPlan, displayPieces, displayPending, overlay, explosion, selectedGroups, selectedFaces, selectedPixels, selected, hidden, solo, editing, resultEditing, brushGroup, brushColor, meshTool, meshRadius, newBrushPart, canUndo, canRedo, selectTool, selectAction, radius, targetGroup, newName, confirmPrompt, recognize, reference, recoverable, restorePrevious, mode, options, plan, stale, staleReason, supported, colorAvailable, locked, pieces, openPieces, groupCounts, pixelCounts, history, future, preview2d, setPreview2d, previewing2d, editorPrompt, editorStale, setEditorPrompt, refreshPreview, confirmPreviewRefresh, setMode, setOption, split, selectGroup, pick, pickPixels, pickRegion, beginEdit, cancelEdit, applyEdit, assign, undo, redo, rename, merge, setMeshTool, setMeshRadius, chooseBrushGroup, pickBrushGroup, addBrushPart, paintFaces, toggleHidden, toggleSolo, confirmResult, splitBlocked, adjust, exportResult, exportPlan, forward, sample, selectModel, persist });
}
export type SegmentationController = ReturnType<typeof useSegmentation>;
