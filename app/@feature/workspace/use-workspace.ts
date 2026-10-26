import { computed, markRaw, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { readRecord, writeRecord, writeRecords, downloadFile } from '~/@base/storage';
import { useLocale } from '~/@base/locale';
import { importUSDAMaterials, type MaterialImportResult, withoutLegacySamples, supplierMaterials, cloneMaterial, withOverrides, materialSurface, materialHex, materialProblem, materialsCSV, validateMaterial, type MaterialRecord } from '~/@feature/materials';
import { collectModelResources, disposeModelResources } from '~/@engine/model';
import { loadLocalModel } from '~/@engine/import';
import { toPrintMesh, uvHit } from '~/@engine/print-mesh';
import { MulticolorClient, type RefinementResult, type SelectionScope, type InitResult, type LowResult, type EditResult, type PaletteSlot, type PaletteOptions } from '~/@engine/multicolor';
import type { PrintDisplay, ViewerContent, ViewerHit, ViewerSettings } from '~/@engine/viewer';
import type { SegmentDocument } from '../segmentation/types';
import type { PrintProject, RegionAssignment } from './types';
import { colorResult, inspectMesh, monochromeSTL, newPreparation, restorePreparation, slicers, type Slicer, type PrepTask } from './print-preparation';

const matchingCandidates = supplierMaterials.flatMap(material => {
  const hex = material.supplier?.catalogHex;
  return hex && /^#[\da-f]{6}$/i.test(hex) && !materialProblem(material) ? [{ id: material.id, hex }] : [];
});
const paletteOptions = (N: number, ownedIds: string[] = [], preferOwned = false): PaletteOptions => ({
  mode: 'owned', N, protect: true,
  cands: matchingCandidates.map(candidate => ({ ...candidate, penalty: preferOwned && ownedIds.length && !ownedIds.includes(candidate.id) ? 6 : 0 })),
});

export const useWorkspace = defineStore('workspace', () => {
  const { t } = useLocale();
  const materials = ref<MaterialRecord[]>([]);
  const supplierEdits = ref<MaterialRecord[]>([]);
  const allMaterials = computed(() => [...materials.value, ...supplierMaterials.map(material => {
    const edit = supplierEdits.value.find(item => item.id === material.id);
    return edit ? { ...cloneMaterial(material), ...edit.overrides, overrides: edit.overrides, referenceImage: edit.referenceImage } : material;
  })]);
  const validationMaterial = ref<MaterialRecord | null>(cloneMaterial(supplierMaterials.find(material => material.materialId === 'CA19017')!));
  const checked = ref<string[]>([]); const selectedRegion = ref(0); const draft = ref<MaterialRecord | null>(null);
  const content = shallowRef<ViewerContent | null>(null); const display = shallowRef<PrintDisplay | null>(null);
  const regions = ref<RegionAssignment[]>([]); const project = shallowRef<PrintProject | null>(null);
  const projects = ref<Array<{ id: string; name: string; updatedAt: string }>>([]);
  const busy = ref(false); const status = ref(''); const failure = ref(''); const progress = ref(0); const warnings = ref<string[]>([]);
  const colorCount = ref(4); const precision = ref(4); const scheme = ref<'high' | 'low'>('high');
  const settings = ref<ViewerSettings>({ mode: 'compare', compareSplit: 0.5, height: 80, layers: false, grid: false, tool: 'orbit', radius: 3, workflow: 'assignment', preview: { preset: 'studio-v1', exposure: 1, environmentIntensity: 1, environmentRotation: 0 } });
  const undoCount = ref(0); const saved = ref(true); const modelInfo = shallowRef<InitResult | null>(null);
  const refinement = shallowRef<RefinementResult | null>(null);
  const selection = shallowRef<Uint32Array>(new Uint32Array());
  const selectionScope = ref<SelectionScope>('island');
  const selectionMaterial = computed(() => {
    if (!selection.value.length || !refinement.value) return null;
    const ids = new Set(Array.from(selection.value, f => regions.value[refinement.value!.labels[f]!]?.material.id));
    return ids.size === 1 ? regions.value[refinement.value.labels[selection.value[0]!]!]?.material ?? null : null;
  });
  const selectionIslandCount = computed(() => new Set(Array.from(selection.value, f => refinement.value?.faceIsland[f]).filter(id => id !== undefined && id >= 0)).size);
  function clearSelection() { selection.value = new Uint32Array(); }
  function showRefinement(value: RefinementResult) {
    refinement.value = markRaw(value);
    display.value = { positions: value.positions, labels: value.labels };
  }
  async function prepareRefinement() {
    await operation(async () => {
      if (!client || refinement.value) return;
      status.value = t('Preparing real UV islands…', '正在解析真实 UV 岛…');
      showRefinement(await client.request('prepareRefinement', { scheme: scheme.value }));
    });
  }
  async function selectRefinement(face: number | null, additive = false) {
    if (busy.value || settings.value.tool !== 'select') return;
    if (face === null) { if (!additive) clearSelection(); return; }
    await operation(async () => {
      if (!client || !refinement.value || settings.value.workflow === 'validation') return;
      const groups = regions.value.map(region => regions.value.findIndex(other => other.material.id === region.material.id));
      const result = await client.request('selectRefinement', { face, scope: selectionScope.value, materialGroups: groups });
      if (!additive) selection.value = result.faces;
      else {
        const next = new Set(selection.value);
        const remove = result.faces.length > 0 && result.faces.every(f => next.has(f));
        for (const f of result.faces) { if (remove) next.delete(f); else next.add(f); }
        selection.value = Uint32Array.from(next);
      }
    });
  }
  async function assignSelection(index: number) {
    if (!selection.value.length || !regions.value[index]) return;
    await operation(async () => {
      if (!client || !refinement.value || settings.value.workflow === 'validation') return;
      advance(); selectedRegion.value = index;
      await editResult(await client.request('paintRefinement', { faces: selection.value, label: index }));
    });
  }
  const preparation = ref(newPreparation());
  const segmentation = shallowRef<SegmentDocument | null>(null);
  const prepSaving = ref(false); const prepSaveError = ref(''); const prepDirty = ref(false);
  const prepNotice = ref('');
  let restoringPreparation = false;
  let prepTimer: ReturnType<typeof setTimeout> | undefined;
  let engineGeometryKey = ''; let loadedGeometryKey = '';
  const printMeshCheck = computed(() => inspectMesh(modelInfo.value));
  const printDimensions = computed(() => {
    const b = modelInfo.value?.bbox;
    return b ? { width: (b.maxX - b.minX) * scale.value, depth: (b.maxZ - b.minZ) * scale.value, height: settings.value.height } : { width: 0, depth: 0, height: 0 };
  });
  const currentColorResult = computed(() => colorResult(display.value, regions.value));
  const printColorState = computed(() => {
    const confirmed = preparation.value.confirmedColor;
    if (confirmed) return !currentColorResult.value.problem && confirmed.fingerprint === currentColorResult.value.fingerprint && confirmed.geometryKey === printMeshCheck.value.geometryKey ? 'ready' : 'review';
    return preparation.value.colorStarted ? 'progress' : 'not-started';
  });
  const printSizeReady = computed(() => preparation.value.sizeConfirmedHeight === settings.value.height && Object.values(printDimensions.value).every(n => Number.isFinite(n) && n > 0));
  const printCheckKey = computed(() => `${printMeshCheck.value.geometryKey}:${settings.value.height}:basic-v1`);
  const printCheckReady = computed(() => printSizeReady.value && printMeshCheck.value.available && preparation.value.checkedKey === printCheckKey.value);
  const printCompatibility = computed(() => preparation.value.mode === 'single' || ['Bambu Studio', 'OrcaSlicer'].includes(preparation.value.slicer) ? '' : `${preparation.value.slicer} 的多色映射尚未验证，请选择 Bambu Studio 或 OrcaSlicer。`);
  const printTasks = computed<Exclude<PrepTask, ''>[]>(() => preparation.value.mode === 'multi' ? ['check', 'color'] : ['check']);
  function printTaskDone(task: PrepTask) { return task === 'check' ? printCheckReady.value : task === 'color' && printColorState.value === 'ready'; }
  function expandNextPrintTask() { preparation.value.expanded = printTasks.value.find(task => !printTaskDone(task)) ?? ''; }
  const printTodo = computed(() => {
    if (!content.value) return '请先导入模型';
    if (busy.value || prepSaving.value) return '正在处理或保存，请稍候';
    if (prepSaveError.value) return '保存失败，请重试保存';
    if (!printSizeReady.value) return '待完成：确认顶部模型尺寸，再复核可打印性';
    const names = { check: '复核可打印性', color: '确认分色与耗材' };
    const todo = printTasks.value.filter(task => !printTaskDone(task)).map(task => names[task]);
    if (todo.length) return `待完成：${todo.join('、')}`;
    if (printCompatibility.value) return printCompatibility.value;
    if (preparation.value.mode === 'multi' && currentColorResult.value.problem) return currentColorResult.value.problem;
    return prepDirty.value ? '正在保存最新设置' : '';
  });
  function markPreparationDirty() {
    if (restoringPreparation || !preparation.value.engaged || !project.value) return;
    prepDirty.value = true; saved.value = false; prepNotice.value = '';
    queuePreparationSave();
  }
  function queuePreparationSave() {
    clearTimeout(prepTimer);
    if (!prepDirty.value || !preparation.value.engaged || prepSaveError.value) return;
    prepTimer = setTimeout(() => { if (!busy.value) void savePreparation(); }, 250);
  }
  // Accordion browsing is local UI state, not a model edit; avoid saving a large snapshot on every expansion.
  watch(() => JSON.stringify(preparation.value, (key, value) => key === 'expanded' ? undefined : value), markPreparationDirty, { flush: 'sync' });
  watch(() => currentColorResult.value.fingerprint, markPreparationDirty, { flush: 'sync' });
  watch([colorCount, precision, scheme], markPreparationDirty, { flush: 'sync' });
  watch(segmentation, markPreparationDirty, { flush: 'sync' });
  watch(() => settings.value.height, (height, previous) => {
    if (restoringPreparation || height === previous) return;
    preparation.value.sizeConfirmedHeight = null;
    preparation.value.checkedKey = null;
    if (preparation.value.activeModule === 'print') preparation.value.expanded = 'check';
    markPreparationDirty();
  }, { flush: 'sync' });
  const durations = ref({ load: 0, analyze: 0, segment: 0 });
  let client: MulticolorClient | null = null; let low: LowResult | null = null; let revision = 0; let generation = 0;
  let assignmentView: Pick<ViewerSettings, 'mode' | 'layers' | 'preview'> | null = null;
  function regionFromPaletteSlot(slot: PaletteSlot, index: number): RegionAssignment {
    const candidate = matchingCandidates.find(item => item.id === slot.filamentId);
    const matched = allMaterials.value.findLast(material => material.id === candidate?.id);
    if (!candidate || !matched) throw new Error(t('The palette returned an unknown SKU.', '分色引擎返回了未知 SKU。'));
    return {
      index,
      sourceHex: slot.sourceHex ?? slot.hex,
      match: { basis: 'catalog-hex-d65-deltae00', materialId: candidate.id, hex: candidate.hex, meanDeltaE: slot.de, areaShare: slot.w },
      material: cloneMaterial(matched),
    };
  }
  function assignMaterial(region: RegionAssignment, material: MaterialRecord) {
    region.material = cloneMaterial(material);
    delete region.match;
  }
  const selected = computed(() => settings.value.workflow === 'validation' ? validationMaterial.value : regions.value[selectedRegion.value]?.material ?? materials.value[0] ?? null);
  const surfaces = computed(() => regions.value.map(region => materialSurface(draft.value && region.index === selectedRegion.value ? draft.value : region.material)));
  const validationSurface = computed(() => selected.value ? materialSurface(draft.value ?? selected.value) : null);
  const scale = computed(() => settings.value.height / ((modelInfo.value?.bbox.maxY ?? 1) - (modelInfo.value?.bbox.minY ?? 0) || 1));
  const labelOptions = () => ({ slotHex: regions.value.map(region => region.sourceHex), slotCount: regions.value.length, regionMap: regions.value.map((_, i) => i), precision: precision.value, scale: scale.value });
  const materialData = (items = allMaterials.value) => ({ version: 2, colorSpace: 'srgb', renderRules: [...new Set(items.map(item => item.renderRule))], materials: items, viewerSettings: settings.value, validationMaterial: validationMaterial.value, project: project.value ? { id: project.value.id, name: project.value.name, heightMM: settings.value.height, regions: regions.value } : null });
  watch(settings, () => { saved.value = false; }, { deep: true, flush: 'sync' });
  function report(error: unknown) { failure.value = error instanceof Error ? error.message : String(error); }
  async function operation(action: () => Promise<void>) {
    if (busy.value) return;
    busy.value = true; failure.value = ''; progress.value = 0;
    try { await action(); } catch (error) { report(error); } finally { busy.value = false; progress.value = 0; queuePreparationSave(); }
  }
  function showHigh(labels: Uint8Array | null) { if (labels && content.value) display.value = { positions: content.value.mesh.positions, labels }; }
  function showLow(value: LowResult) { low = markRaw(value); display.value = { positions: value.leaves, labels: value.leafLab, faceMap: value.leafFace }; }
  function advance() { client?.setRevision(++revision); saved.value = false; }
  async function rebuild() {
    if (!client) return;
    if (scheme.value === 'low') showLow(await client.request('lowpoly', { ...labelOptions(), target: 0 }));
    else showHigh((await client.request('label', labelOptions())).label);
  }
  async function segmentInternal(options: { ownedIds?: string[]; preferOwned?: boolean } = {}) {
    if (!client) return;
    const started = performance.now(); advance();
    const palette = await client.request('palette', paletteOptions(colorCount.value, options.ownedIds, options.preferOwned));
    regions.value = palette.slots.map((slot, index) => regionFromPaletteSlot(slot, index));
    selectedRegion.value = Math.min(selectedRegion.value, regions.value.length - 1);
    refinement.value = null; clearSelection();
    await client.request('reset', {}); await rebuild(); undoCount.value = 0;
    durations.value.segment = performance.now() - started;
    status.value = t('Color regions are ready', '分色完成');
  }
  async function loadFiles(files: File[], restore?: PrintProject, sourceSample?: 'chicken' | 'turkey') {
    await operation(async () => {
      const nextPreparation = restorePreparation(restore?.preparation);
      if (preparation.value.engaged && project.value && (prepDirty.value || !saved.value || prepSaveError.value)) await persistProject();
      const own = ++generation;
      status.value = t('Reading model…', '正在读取模型…'); const started = performance.now();
      const loaded = await loadLocalModel(files);
      let candidate: MulticolorClient | null = null;
      let adopted = false;
      try {
        const mesh = await toPrintMesh(loaded.root);
        const id = restore?.id ?? crypto.randomUUID();
        candidate = new MulticolorClient(id, { onProgress: value => { if (own === generation) { progress.value = value.p; status.value = value.text; } } });
        durations.value.load = performance.now() - started;
        const analysis = performance.now();
        const info = await candidate.request('init', mesh);
        durations.value.analyze = performance.now() - analysis;
        const startedSegment = performance.now();
        let nextRegions: RegionAssignment[];
        let nextDisplay: PrintDisplay;
        let nextLow: LowResult | null = null;
        let nextRefinement: RefinementResult | null = null;
        if (restore?.snapshot && restore.regions.length) {
          nextRegions = restore.regions;
          const result = await candidate.request('restore', { snapshot: restore.snapshot });
          nextLow = restore.scheme === 'low' ? result.low : null;
          nextRefinement = result.refinement ?? null;
          if (!nextLow && !result.label) throw new Error('Project has no region labels');
          nextDisplay = nextLow ? { positions: nextLow.leaves, labels: nextLow.leafLab, faceMap: nextLow.leafFace } : { positions: mesh.positions, labels: result.label! };
        } else {
          const palette = await candidate.request('palette', paletteOptions(4));
          nextRegions = palette.slots.map((slot, index) => regionFromPaletteSlot(slot, index));
          const result = await candidate.request('label', { slotHex: nextRegions.map(region => region.sourceHex), precision: 4, scale: 80 / (info.bbox.maxY - info.bbox.minY || 1) });
          nextDisplay = { positions: mesh.positions, labels: result.label };
        }
        const candidateSnapshot = (await candidate.request('snapshot', {})).snapshot;
        if (own !== generation) return;
        restoringPreparation = true;
        clearTimeout(prepTimer);
        client?.dispose(); client = candidate; adopted = true;
        project.value = restore ?? { version: 2, id, name: files.find(file => /\.(glb|fbx)$/i.test(file.name))?.name.replace(/\.(glb|fbx)$/i, '') ?? 'Untitled', updatedAt: new Date().toISOString(), files: files.map(file => ({ name: file.name, path: file.webkitRelativePath || file.name, type: file.type, data: file })), regions: [], height: 80, colorCount: 4, precision: 4, scheme: 'high', snapshot: null };
        if (sourceSample) project.value = { ...project.value, sourceSample };
        segmentation.value = restore?.segmentation ? JSON.parse(JSON.stringify(restore.segmentation)) : null;
        content.value = markRaw({ id: `${id}:${own}`, root: loaded.root, mesh });
        refinement.value = null; clearSelection();
        display.value = markRaw(nextDisplay); low = nextLow ? markRaw(nextLow) : null;
        if (nextRefinement) showRefinement(nextRefinement);
        modelInfo.value = markRaw(info); warnings.value = [...loaded.warnings, ...info.warnings];
        regions.value = nextRegions; selectedRegion.value = 0; draft.value = null;
        scheme.value = restore?.scheme ?? 'high'; settings.value.height = restore?.height ?? 80; colorCount.value = restore?.colorCount ?? 4; precision.value = restore?.precision ?? 4;
        settings.value.tool = 'orbit'; settings.value.mode = 'compare'; settings.value.compareSplit = 0.5; settings.value.grid = false;
        assignmentView = null;
        if (!restore) {
          settings.value.workflow = 'assignment'; settings.value.layers = false;
          settings.value.preview = { preset: 'studio-v1', exposure: 1, environmentIntensity: 1, environmentRotation: 0 };
        }
        if (restore) {
          settings.value = restore.viewerSettings ? JSON.parse(JSON.stringify(restore.viewerSettings)) : { ...settings.value, workflow: 'assignment', preview: { preset: 'studio-v1', exposure: 1, environmentIntensity: 1, environmentRotation: 0 } };
          settings.value.height = restore.height;
          validationMaterial.value = restore.validationMaterial ? cloneMaterial(restore.validationMaterial) : validationMaterial.value;
        }
        preparation.value = nextPreparation; engineGeometryKey = candidateSnapshot.geometryKey; loadedGeometryKey = printMeshCheck.value.geometryKey;
        prepDirty.value = false; prepSaveError.value = ''; prepNotice.value = '';
        revision = 0; undoCount.value = 0;
        durations.value.segment = performance.now() - startedSegment;
        saved.value = Boolean(restore); status.value = t('Ready to create', '可以开始编辑');
      } finally {
        restoringPreparation = false;
        if (!adopted) { candidate?.dispose(); disposeModelResources(collectModelResources(loaded.root)); }
      }
    });
  }
  async function demo(variant: 'textured' | 'white' = 'textured') {
    const white = variant === 'white';
    const response = await fetch(white ? '/samples/stylized-turkey-white.glb' : '/samples/cartoon-chicken-textured.glb');
    if (!response.ok) { report(new Error('Demo asset is missing')); return; }
    await loadFiles([new File([await response.blob()], white ? 'Stylized turkey · white.glb' : 'Cartoon chicken.glb', { type: 'model/gltf-binary' })], undefined, white ? 'turkey' : 'chicken');
  }
  async function validationSample() {
    const response = await fetch('/samples/material-check.glb');
    if (!response.ok) { report(new Error('Validation sample is missing')); return; }
    await loadFiles([new File([await response.blob()], 'Material-check.glb', { type: 'model/gltf-binary' })]);
    if (!failure.value) setWorkflow('validation');
  }
  function setWorkflow(workflow: 'assignment' | 'validation') {
    if (settings.value.workflow === workflow) return;
    if (workflow === 'validation') assignmentView = { mode: settings.value.mode, layers: settings.value.layers, preview: settings.value.preview ? { ...settings.value.preview } : undefined };
    clearSelection();
    settings.value.workflow = workflow; settings.value.tool = 'orbit'; draft.value = null;
    if (workflow === 'validation') {
      settings.value.mode = 'print'; settings.value.layers = false;
      settings.value.preview = { preset: 'validation-v1', exposure: 1, environmentIntensity: 1, environmentRotation: 0 };
    }
    else {
      settings.value.mode = assignmentView?.mode ?? 'compare';
      settings.value.layers = assignmentView?.layers ?? false;
      settings.value.preview = assignmentView?.preview ?? { preset: 'studio-v1', exposure: 1, environmentIntensity: 1, environmentRotation: 0 };
      assignmentView = null;
    }
  }
  const segment = (options: { ownedIds?: string[]; preferOwned?: boolean } = {}) => operation(() => segmentInternal(options));
  async function changeScheme(value: 'high' | 'low') { if (refinement.value) return; if (value === 'low' && !modelInfo.value?.textured) { report(new Error(t('UV mode needs a textured model. Use surface colors for this model.', 'UV 模式需要带贴图的模型。此模型请使用表面分色。'))); return; } await operation(async () => { scheme.value = value; advance(); await rebuild(); }); }
  const editResult = async (result: EditResult) => { undoCount.value = result.left;
    if (result.refinement) { clearSelection(); showRefinement(result.refinement); return; }
    if (refinement.value && result.refinementLabels) { showRefinement({ ...refinement.value, labels: result.refinementLabels }); return; } if (scheme.value === 'low') await rebuild(); else showHigh(result.label); };
  async function stroke(hits: ViewerHit[]) {
    await operation(async () => {
      if (!client || !content.value) return; advance();
      if (refinement.value) await editResult(await client.request('brushRefinement', { hits, label: selectedRegion.value }));
      else if (scheme.value === 'high') await editResult(await client.request('brushHigh', { hits, label: selectedRegion.value }));
      else if (low) {
        const dabs = hits.map(hit => uvHit(hit, low!)).filter((value): value is NonNullable<typeof value> => !!value && value.img >= 0);
        await editResult(await client.request('paintLow', { dabs: dabs.map(dab => ({ ...dab, label: selectedRegion.value })) }));
      }
    });
  }
  async function fill(hit: ViewerHit) {
    await operation(async () => {
      if (!client) return; advance();
      if (scheme.value === 'high') await editResult(await client.request('fillHigh', { seed: hit.face, label: selectedRegion.value, tol: 0 }));
      else if (low) { const uv = uvHit(hit, low); if (uv && uv.img >= 0) await editResult(await client.request('fillLow', { ...uv, label: selectedRegion.value, tol: 0 })); }
    });
  }
  const undo = () => operation(async () => { if (client) { advance(); await editResult(await client.request('undo', {})); } });
  const reset = () => operation(async () => { if (client) { advance(); refinement.value = null; clearSelection(); await editResult(await client.request('reset', {})); } });
  function apply(material: MaterialRecord) {
    if (busy.value) return;
    const problem = materialProblem(material); if (problem) { report(new Error(problem)); return; }
    if (settings.value.workflow === 'validation') validationMaterial.value = cloneMaterial(material);
    else { const region = regions.value[selectedRegion.value]; if (!region) return; assignMaterial(region, material); }
    draft.value = null; saved.value = false;
  }
  function replaceMaterial(materialId: string, material: MaterialRecord) {
    if (busy.value || settings.value.workflow === 'validation') return;
    const problem = materialProblem(material);
    if (problem) { report(new Error(problem)); return; }
    let changed = false;
    for (const region of regions.value) {
      if (region.material.id === materialId) { assignMaterial(region, material); changed = true; }
    }
    if (changed) { draft.value = null; saved.value = false; status.value = t('Filament replaced', '耗材已替换'); }
  }
  async function saveMaterial(material: MaterialRecord) {
    let success = false;
    await operation(async () => {
      const message = validateMaterial(material, allMaterials.value); if (message) throw new Error(message);
      const nextMaterial = withOverrides(material);
      const problem = materialProblem(nextMaterial); if (problem) throw new Error(problem);
      const isSupplier = material.supplier && material.supplier.origin !== 'local-usda';
      const records = isSupplier ? supplierEdits : materials;
      const next = [...records.value.filter(item => item.id !== material.id), nextMaterial];
      await writeRecord(isSupplier ? 'supplier-overrides' : 'materials', JSON.parse(JSON.stringify(next)));
      records.value = next;
      let found = false; for (const region of regions.value) if (region.material.id === material.id) { assignMaterial(region, nextMaterial); found = true; }
      if (settings.value.workflow === 'validation') validationMaterial.value = cloneMaterial(nextMaterial);
      else if (!found && regions.value[selectedRegion.value]) assignMaterial(regions.value[selectedRegion.value]!, nextMaterial);
      saved.value = false; success = true; status.value = t('Material saved locally', '材质已保存到本地');
    });
    return success;
  }
  async function deleteMaterial(id: string): Promise<boolean> {
    let success = false;
    await operation(async () => {
      const material = materials.value.find(item => item.id === id);
      if (!material || (material.supplier && material.supplier.origin !== 'local-usda')) throw new Error(t('Only local materials can be deleted.', '只能删除本地材质。'));
      const next = materials.value.filter(item => item.id !== id);
      await writeRecord('materials', JSON.parse(JSON.stringify(next)));
      materials.value = next;
      checked.value = checked.value.filter(value => value !== id);
      if (draft.value?.id === id) draft.value = null;
      success = true;
      status.value = t('Removed from the library. Applied materials are retained.', '已从材质库删除，已应用的材质保持不变。');
    });
    return success;
  }
  async function importMaterials(files: File[]): Promise<MaterialImportResult> {
    const result: MaterialImportResult = { imported: 0, errors: [] };
    if (busy.value) return result;
    await operation(async () => {
      const additions: MaterialRecord[] = [];
      for (const file of files) {
        try {
          const parsed = await importUSDAMaterials(file);
          for (const material of parsed) {
            const base = material.materialId; let suffix = 1;
            while ([...allMaterials.value, ...additions].some(item => item.materialId.toLowerCase() === material.materialId.toLowerCase())) material.materialId = `${base}-IMPORT-${suffix++}`;
            const error = validateMaterial(material, [...allMaterials.value, ...additions]);
            if (error) throw new Error(error);
            additions.push(material);
          }
        } catch (error) { result.errors.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`); }
      }
      if (!additions.length) return;
      const next = [...materials.value, ...additions];
      try { await writeRecord('materials', JSON.parse(JSON.stringify(next))); }
      catch (error) { result.errors.push(error instanceof Error ? error.message : String(error)); return; }
      materials.value = next; result.imported = additions.length;
      status.value = t(`Imported ${result.imported} materials`, `已导入 ${result.imported} 个材质`);
    });
    return result;
  }
  function setHeight(value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    settings.value.height = Math.min(320, Math.max(10, value)); saved.value = false;
  }
  function exportMaterials(format: 'csv' | 'json') {
    const items = checked.value.length ? allMaterials.value.filter(item => checked.value.includes(item.id)) : allMaterials.value;
    if (format === 'csv') { downloadFile(new Blob([materialsCSV(items)], { type: 'text/csv;charset=utf-8' }), 'tripo-materials.csv'); return; }
    void operation(async () => {
      const assignment = client ? (await client.request('snapshot', {})).snapshot : null;
      downloadFile(new Blob([JSON.stringify({ ...materialData(items), assignment }, null, 2)], { type: 'application/json' }), 'tripo-materials.json');
    });
  }
  async function snapshot(): Promise<PrintProject> {
    if (!project.value || !client) throw new Error(t('Import a model first', '请先导入模型'));
    return { ...project.value, version: 2, updatedAt: new Date().toISOString(), regions: JSON.parse(JSON.stringify(regions.value)), height: settings.value.height, colorCount: colorCount.value, precision: precision.value, scheme: scheme.value, snapshot: (await client.request('snapshot', {})).snapshot, viewerSettings: JSON.parse(JSON.stringify({ ...settings.value, tool: 'orbit' })), validationMaterial: validationMaterial.value ? cloneMaterial(validationMaterial.value) : null, preparation: JSON.parse(JSON.stringify(preparation.value)), segmentation: segmentation.value ? JSON.parse(JSON.stringify(segmentation.value)) : null };
  }
  async function persistProject(input?: PrintProject) {
    prepSaving.value = true;
    try {
      const data = input ?? await snapshot();
      const list = [{ id: data.id, name: data.name, updatedAt: data.updatedAt }, ...projects.value.filter(item => item.id !== data.id)];
      await writeRecords([['projects', JSON.parse(JSON.stringify(list))], ['active-project', data.id], [`project:${data.id}`, data]]);
      projects.value = list; project.value = data; saved.value = true;
      prepDirty.value = false; prepSaveError.value = '';
    } catch (error) {
      prepSaveError.value = error instanceof Error ? error.message : String(error);
      prepDirty.value = true; saved.value = false; throw error;
    } finally { prepSaving.value = false; }
  }
  const save = () => operation(async () => { await persistProject(); status.value = t('Project saved on this device', '项目已保存到此设备'); });
  async function savePreparation() {
    if (busy.value) return false;
    clearTimeout(prepTimer);
    let success = false;
    await operation(async () => { await persistProject(); success = true; });
    return success;
  }
  async function navigatePreparation(target: 'print' | 'multi-color' | 'segment', fromPrint = false) {
    if (busy.value || !content.value) return;
    const previous = restorePreparation(preparation.value);
    await operation(async () => {
      preparation.value.engaged = true;
      preparation.value.activeModule = target;
      preparation.value.origin = fromPrint ? 'print' : null;
      if (fromPrint) preparation.value.colorStarted = true;
      if (target === 'print') expandNextPrintTask();
      settings.value.tool = 'orbit'; clearSelection(); draft.value = null;
      if (fromPrint || target === 'print') setWorkflow('assignment');
      try { await persistProject(); }
      catch (error) { preparation.value = previous; throw error; }
    });
  }
  async function changePrintMode(mode: 'single' | 'multi') {
    if (busy.value || mode === preparation.value.mode) return;
    preparation.value.mode = mode;
    if (mode === 'multi' && printColorState.value !== 'ready') await navigatePreparation('multi-color', true);
    else { expandNextPrintTask(); await savePreparation(); }
  }
  async function changePrintSlicer(slicer: Slicer) {
    if (busy.value || !slicers.includes(slicer)) return;
    preparation.value.slicer = slicer; await savePreparation();
  }
  function setPrintDimension(axis: 'width' | 'depth' | 'height', value: number) {
    if (busy.value) return;
    const original = printDimensions.value[axis];
    if (!Number.isFinite(value) || value <= 0 || original <= 0) { report(new Error('请输入大于 0 的尺寸。')); return; }
    // Ignore a blur of a rounded display value; preserve the exact proportional dimensions.
    if (Math.abs(value - original) < 0.005) return;
    const height = settings.value.height * value / original;
    if (height < 10 || height > 320) { report(new Error('当前 demo 支持模型高度 10–320 mm，请调整尺寸。')); return; }
    setHeight(height);
  }
  async function confirmPrintSize() {
    if (busy.value || !Object.values(printDimensions.value).every(n => Number.isFinite(n) && n > 0)) return;
    preparation.value.sizeConfirmedHeight = settings.value.height;
    expandNextPrintTask(); await savePreparation();
  }
  async function acknowledgePrintCheck() {
    if (busy.value || !printMeshCheck.value.available) return;
    if (!printSizeReady.value) { report(new Error('请先确认顶部模型尺寸，再复核可打印性。')); return; }
    preparation.value.checkedKey = printCheckKey.value;
    expandNextPrintTask(); await savePreparation();
  }
  function validatePrintColors(data: PrintProject) {
    if (currentColorResult.value.problem) throw new Error(currentColorResult.value.problem);
    const state = data.snapshot;
    if (!state || !engineGeometryKey || state.geometryKey !== engineGeometryKey || state.faceCount !== modelInfo.value?.nf || loadedGeometryKey !== printMeshCheck.value.geometryKey || !printMeshCheck.value.available) throw new Error('分色结果与当前模型版本不一致，请重新分色。');
    if (state.refinement) {
      const { sourceFaces, labels, positions } = state.refinement;
      if (labels.length !== sourceFaces.length || positions.length !== labels.length * 9 || new Set(sourceFaces).size !== state.faceCount || sourceFaces.some(f => !Number.isInteger(f) || f < 0 || f >= state.faceCount)) throw new Error('部分打印区域缺少颜色映射，请重新分色。');
    } else if (!state.labels || state.labels.length !== state.faceCount) throw new Error('部分打印区域缺少颜色映射，请重新分色。');
    if (!state.refinement && scheme.value === 'low' && (!display.value?.faceMap || new Set(display.value.faceMap).size !== state.faceCount)) throw new Error('UV 分色未覆盖全部打印区域，请重新分色。');
    const labels = state.refinement?.labels ?? (scheme.value === 'high' ? state.labels : display.value?.labels);
    if (!labels || Array.from(labels).some(index => !Number.isInteger(index) || !regions.value[index]?.material || materialProblem(regions.value[index]!.material))) throw new Error('有打印区域尚未分配有效耗材。');
  }
  async function completePrintColors() {
    if (busy.value || preparation.value.origin !== 'print') return;
    await operation(async () => {
      setWorkflow('assignment');
      const data = await snapshot(); validatePrintColors(data);
      const previous = restorePreparation(preparation.value);
      preparation.value.confirmedColor = { fingerprint: currentColorResult.value.fingerprint, geometryKey: printMeshCheck.value.geometryKey };
      preparation.value.activeModule = 'print'; preparation.value.origin = null;
      expandNextPrintTask();
      settings.value.tool = 'orbit'; clearSelection(); draft.value = null;
      data.preparation = JSON.parse(JSON.stringify(preparation.value));
      try { await persistProject(data); }
      catch (error) { preparation.value = previous; throw error; }
    });
  }
  async function downloadPreparedModel() {
    if (printTodo.value) { report(new Error(printTodo.value)); return; }
    await operation(async () => {
      const data = await snapshot();
      if (!printSizeReady.value || !printCheckReady.value || printCompatibility.value) throw new Error('打印设置已变更，请重新检查清单。');
      let blob: Blob; const multi = preparation.value.mode === 'multi';
      if (multi) {
        validatePrintColors(data);
        if (printColorState.value !== 'ready') throw new Error('请先确认最新分色结果。');
        blob = (await client!.request('export3mf', { scheme: scheme.value, name: data.name, scale: scale.value, filaments: regions.value.map(region => ({ id: region.material.materialId, name: region.material.name, hex: materialHex(region.material), type: region.material.supplier?.materialType || 'Unknown', vendor: region.material.supplier?.vendor || 'Generic' })), materialData: JSON.parse(JSON.stringify(materialData())), withConfig: true, preservePartition: true })).blob;
      } else blob = monochromeSTL(modelInfo.value!, scale.value);
      await persistProject(data);
      downloadFile(blob, `${data.name}.${multi ? '3mf' : 'stl'}`);
      prepNotice.value = `已生成 ${multi ? '3MF' : 'STL'} 并发起下载。请在 ${preparation.value.slicer} 中手动打开文件${multi ? '并核对耗材槽位' : '，单位选择 mm'}。尚未向切片器导入。`;
    });
  }
  async function loadSegmentResult(file: File, sourceId: string, height: number, openPieces: number, id: string) {
    const restored: PrintProject = { version: 2, id, name: file.name.replace(/\.glb$/i, ''), updatedAt: new Date().toISOString(), files: [{ name: file.name, path: file.name, type: file.type, data: file }], regions: [], height, colorCount: 4, precision: 4, scheme: 'high', snapshot: null, preparation: newPreparation(), segmentSourceId: sourceId, segmentOpenPieces: openPieces };
    await loadFiles([file], restored);
    if (!failure.value) await savePreparation();
  }
  async function openProject(id: string) {
    if (busy.value) return;
    if (project.value?.id === id && preparation.value.engaged) { await savePreparation(); return; }
    try {
      const data = await readRecord<PrintProject>(`project:${id}`); if (!data) return;
      if (![1, 2].includes(data.version)) throw new Error('Unsupported project version');
      if (data.viewerSettings) validateSettings(data.viewerSettings);
      data.regions.forEach(validateRegion);
      if (data.validationMaterial) { const error = validateMaterial(data.validationMaterial, []); if (error) throw new Error(error); }
      await loadFiles(data.files.map(file => { const value = new File([file.data], file.name, { type: file.type }); Object.defineProperty(value, 'webkitRelativePath', { value: file.path }); return value; }), data);
      if (!failure.value) await writeRecord('active-project', id);
    } catch (error) { report(error); }
  }
  const backup = () => operation(async () => {
    const data = await snapshot(); const entries: Record<string, Uint8Array> = {};
    const files = await Promise.all(data.files.map(async (file, index) => { const entry = `assets/${index}`; entries[entry] = new Uint8Array(await file.data.arrayBuffer()); return { name: file.name, path: file.path, type: file.type, entry }; }));
    entries['project.json'] = strToU8(JSON.stringify({ ...data, files, materials: materials.value, supplierEdits: supplierEdits.value }));
    downloadFile(new Blob([zipSync(entries) as Uint8Array<ArrayBuffer>]), `${data.name}.tripo.zip`);
  });
  async function restoreBackup(file: File) {
    try {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const json = entries['project.json']; if (!json) throw new Error('Invalid project archive');
      const data = JSON.parse(strFromU8(json));
      if (typeof data?.id !== 'string' || typeof data.name !== 'string' || !['high', 'low'].includes(data.scheme) || !Number.isInteger(data.colorCount) || data.colorCount < 1 || data.colorCount > 12 || !Number.isInteger(data.precision) || data.precision < 1 || data.precision > 6) throw new Error('Invalid project metadata');
      if (![1, 2].includes(data.version) || !Array.isArray(data.files) || !Array.isArray(data.regions) || data.regions.length > 12 || !Number.isFinite(data.height) || data.height < 10 || data.height > 320) throw new Error('Unsupported or invalid project');
      if (data.viewerSettings) validateSettings(data.viewerSettings);
      if (data.validationMaterial) { const error = validateMaterial(data.validationMaterial, []); if (error) throw new Error(error); }
      data.regions.forEach(validateRegion);
      const files = data.files.map((item: { name: string; path: string; type: string; entry: string }) => { if (typeof item.name !== 'string' || typeof item.path !== 'string' || !entries[item.entry]) throw new Error('Missing project asset'); const value = new File([entries[item.entry]! as Uint8Array<ArrayBuffer>], item.name, { type: item.type }); Object.defineProperty(value, 'webkitRelativePath', { value: item.path }); return value; });
      const restored: PrintProject = { ...data, files: files.map((file: File) => ({ name: file.name, path: file.webkitRelativePath, type: file.type, data: file })) };
      const catalog = withoutLegacySamples(Array.isArray(data.materials) ? data.materials as MaterialRecord[] : []);
      for (const material of catalog) { const error = validateMaterial(material, catalog); if (error) throw new Error(error); }
      const edits = Array.isArray(data.supplierEdits) ? data.supplierEdits as MaterialRecord[] : [];
      for (const material of edits) { const error = validateMaterial(material, edits); if (error || !material.supplier) throw new Error(error ?? 'Invalid supplier edit'); }
      await loadFiles(files, restored);
      if (!failure.value) saved.value = false;
      if (!failure.value && Array.isArray(data.materials)) { await writeRecord('materials', catalog); materials.value = catalog; saved.value = false; }
      if (!failure.value && data.version === 2) { await writeRecord('supplier-overrides', edits); supplierEdits.value = edits; }
    } catch (error) { report(error); }
  }
  const export3mf = () => operation(async () => {
    if (!client) return;
    if (settings.value.workflow === 'validation') throw new Error(t('Switch to region assignment before exporting 3MF.', '请切换到区域应用，确认每个区域的耗材后再导出 3MF。'));
    const result = await client.request('export3mf', { scheme: scheme.value, name: project.value?.name ?? 'Tripo', scale: scale.value, filaments: regions.value.map(region => ({ id: region.material.materialId, name: region.material.name, hex: materialHex(region.material), type: region.material.supplier?.materialType || 'Unknown', vendor: region.material.supplier?.vendor || 'Generic', materialVersion: region.material.supplier?.source.sha256 ?? null })), materialData: JSON.parse(JSON.stringify(materialData())), withConfig: true });
    downloadFile(result.blob, `${project.value?.name ?? 'Tripo'}.3mf`); status.value = t('3MF exported', '3MF 已导出');
  });
  const selftest = () => operation(async () => { if (client) { const result = await client.request('selftest', { withConfig: true }); downloadFile(result.blob, 'four-color-selftest.3mf'); } });
  async function initialize() {
    try {
      const stored = await readRecord<MaterialRecord[]>('materials');
      if (stored) {
        for (const material of stored) { const error = validateMaterial(material, stored); if (error) throw new Error(error); }
        const catalog = withoutLegacySamples(stored);
        if (catalog.length !== stored.length) await writeRecord('materials', JSON.parse(JSON.stringify(catalog)));
        materials.value = catalog;
      }
      const edits = await readRecord<MaterialRecord[]>('supplier-overrides');
      if (edits) { for (const material of edits) { const error = validateMaterial(material, edits); if (error) throw new Error(error); } supplierEdits.value = edits; }
      projects.value = await readRecord('projects') ?? [];
    } catch (error) { report(error); }
    const active = await readRecord<string>('active-project').catch(() => undefined);
    if (active && projects.value.some(item => item.id === active)) await openProject(active);
    else await demo();
    // Preserve previous pine work as a local project before opening the new bundled default once.
    const migrated = await readRecord<boolean>('chicken-default-v1').catch(() => false);
    if (!migrated) {
      if (project.value && /^(stylized[ -])?pine[ -]tree$/i.test(project.value.name)) { if (await savePreparation()) await demo(); }
      if (!failure.value) await writeRecord('chicken-default-v1', true);
    }
  }
  onScopeDispose(() => { clearTimeout(prepTimer); generation++; client?.dispose(); });
  return { segmentation, loadSegmentResult, preparation, prepSaving, prepDirty, prepSaveError, prepNotice, printDimensions, printMeshCheck, currentColorResult, printColorState, printSizeReady, printCheckReady, printCompatibility, printTasks, printTaskDone, printTodo, navigatePreparation, changePrintMode, changePrintSlicer, setPrintDimension, confirmPrintSize, acknowledgePrintCheck, completePrintColors, downloadPreparedModel, savePreparation, refinement, selection, selectionScope, selectionMaterial, selectionIslandCount, prepareRefinement, selectRefinement, assignSelection, clearSelection, materials, allMaterials, validationMaterial, validationSurface, checked, content, display, regions, selectedRegion, selected, surfaces, draft, project, projects, busy, status, failure, progress, warnings, colorCount, precision, scheme, settings, undoCount, saved, modelInfo, durations,
    loadFiles, demo, validationSample, setWorkflow, setHeight, segment, changeScheme, stroke, fill, undo, reset, apply, replaceMaterial, saveMaterial, deleteMaterial, importMaterials, exportMaterials, save, openProject, backup, restoreBackup, export3mf, selftest, initialize, report };
});

function validateRegion(region: RegionAssignment, index: number) {
  if (region.index !== index || !/^#[\da-f]{6}$/i.test(region.sourceHex)) throw new Error('Invalid region mapping');
  const error = validateMaterial(region.material, []); if (error) throw new Error(error);
  const match = region.match;
  if (match && (match.basis !== 'catalog-hex-d65-deltae00' || match.materialId !== region.material.id || !/^#[\da-f]{6}$/i.test(match.hex) || !Number.isFinite(match.meanDeltaE) || match.meanDeltaE < 0 || !Number.isFinite(match.areaShare) || match.areaShare < 0 || match.areaShare > 1 + 1e-8)) throw new Error('Invalid color match');
}

function validateSettings(settings: ViewerSettings) {
  const preview = settings.preview;
  if (!['original', 'print', 'compare'].includes(settings.mode) || !['assignment', 'validation'].includes(settings.workflow ?? 'assignment') || !Number.isFinite(settings.compareSplit) || settings.compareSplit < 0.2 || settings.compareSplit > 0.8 || !['orbit', 'brush', 'fill', 'select'].includes(settings.tool) || !Number.isFinite(settings.radius) || settings.radius <= 0 || typeof settings.layers !== 'boolean' || typeof settings.grid !== 'boolean') throw new Error('Invalid viewer settings');
  if (preview && (!['studio-v1', 'validation-v1'].includes(preview.preset) || !Number.isFinite(preview.exposure) || preview.exposure < 0.1 || preview.exposure > 3 || !Number.isFinite(preview.environmentIntensity) || preview.environmentIntensity < 0 || preview.environmentIntensity > 2 || !Number.isFinite(preview.environmentRotation) || preview.environmentRotation < 0 || preview.environmentRotation > 360)) throw new Error('Invalid preview settings');
}
