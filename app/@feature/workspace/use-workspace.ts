import { computed, markRaw, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { readRecord, writeRecord, writeRecords, downloadFile } from '~/@base/storage';
import { useLocale } from '~/@base/locale';
import { site } from '~/@base/site';
import { filamentPreview, filamentIdentity, importUSDAMaterials, type MaterialImportResult, withoutLegacySamples, supplierMaterials, cloneMaterial, withOverrides, materialSurface, materialHex, materialProblem, supplierModification, materialsCSV, validateMaterial, type MaterialRecord } from '~/@feature/materials';
import { collectModelResources, disposeModelResources } from '~/@engine/model';
import { loadLocalModel } from '~/@engine/import';
import { toPrintMesh, uvHit } from '~/@engine/print-mesh';
import { MulticolorClient, type InitResult, type LowResult, type EditResult, type PaletteSlot } from '~/@engine/multicolor';
import type { PrintDisplay, ViewerContent, ViewerHit, ViewerSettings } from '~/@engine/viewer';
import type { PrintProject, RegionAssignment } from './types';
import { useMaterialSync, libraryJSON } from '~/@feature/materials';
import { createPreviewQueue } from './preview-queue';
import { useRegionEdit } from './use-region-edit';
import type { SurfacePreview, SurfaceEditResult } from '~/@engine/multicolor';

type SupplierMaterialStore = Record<string, MaterialRecord[]>;

function supplierVendor(material: MaterialRecord): string {
  return material.supplier?.vendor?.trim() || 'Unknown';
}

function groupSupplierEdits(materials: MaterialRecord[]): SupplierMaterialStore {
  return materials.reduce<SupplierMaterialStore>((groups, material) => {
    const vendor = supplierVendor(material);
    (groups[vendor] ??= []).push(material);
    return groups;
  }, {});
}

function normalizeSupplierStore(value: unknown): { edits: MaterialRecord[]; groups: SupplierMaterialStore; migrated: boolean } {
  if (Array.isArray(value)) {
    const edits = value as MaterialRecord[];
    return { edits, groups: groupSupplierEdits(edits), migrated: true };
  }
  if (!value || typeof value !== 'object') throw new Error('Invalid supplier overrides');
  const groups = value as Record<string, unknown>;
  if (Object.values(groups).some(records => !Array.isArray(records))) throw new Error('Invalid supplier overrides');
  const normalized = Object.fromEntries(Object.entries(groups).map(([vendor, records]) => [vendor, records as MaterialRecord[]]));
  return { edits: Object.values(normalized).flat(), groups: normalized, migrated: false };
}

const matchingCandidates = supplierMaterials.flatMap(material => {
  if (material.supplier?.vendor === 'eSUN' && material.supplier.source.spreadsheet === '产品颜色管理.html') return [];
  const hex = material.supplier?.catalogHex;
  return hex && /^#[\da-f]{6}$/i.test(hex) && !materialProblem(material) ? [{ id: material.id, hex }] : [];
});

export const useWorkspace = defineStore('workspace', () => {
  const { t } = useLocale();
  const materials = ref<MaterialRecord[]>([]);
  const supplierEdits = ref<MaterialRecord[]>([]);
  const allMaterials = computed(() => [...materials.value, ...supplierMaterials.map(material => {
    const edit = supplierEdits.value.find(item => item.id === material.id && supplierVendor(item) === supplierVendor(material));
    return edit ? { ...cloneMaterial(material), ...edit.overrides, overrides: edit.overrides, renderRule: edit.renderRule, optics: edit.optics, appearance: edit.appearance ?? material.appearance, appearanceBinding: edit.appearanceBinding, referenceImage: edit.referenceImage } : material;
  })]);
  const initialMaterial = supplierMaterials.find(material => material.materialId === site.materialId);
  const validationMaterial = ref<MaterialRecord | null>(initialMaterial ? cloneMaterial(initialMaterial) : filamentPreview(site.vendor ?? 'Generic', 'PLA', site.seriesId, 'basic', '#B6B6B6'));
  const materialSync = useMaterialSync({
    getLibrary: () => ({ materials: materials.value, supplierEdits: supplierEdits.value }),
    applyLibrary: async update => {
      while (busy.value || previewing.value) await new Promise<void>(resolve => { const stop = watch(() => busy.value || previewing.value, value => { if (!value) { stop(); resolve(); } }); });
      busy.value = true;
      try {
        const library = update({ version: 1, vendor: site.vendor!, materials: materials.value, supplierEdits: supplierEdits.value });
        if (!library) return;
        await writeRecords(JSON.parse(JSON.stringify({ materials: library.materials, 'supplier-overrides': groupSupplierEdits(library.supplierEdits) })));
        materials.value = library.materials; supplierEdits.value = library.supplierEdits;
        if (!draft.value) {
          const current = allMaterials.value.find(item => item.id === validationMaterial.value?.id);
          if (current) validationMaterial.value = cloneMaterial(current);
        }
      } finally { busy.value = false; }
    },
  });
  const validationReference = ref<MaterialRecord | null>(null);
  const referenceSurface = computed(() => validationReference.value ? materialSurface(validationReference.value) : null);
  const checked = ref<string[]>([]); const selectedRegion = ref(0); const draft = ref<MaterialRecord | null>(null);
  const content = shallowRef<ViewerContent | null>(null); const display = shallowRef<PrintDisplay | null>(null);
  const regions = ref<RegionAssignment[]>([]); const project = shallowRef<PrintProject | null>(null);
  const regionSource = ref<'imported' | 'automatic'>('automatic');
  const previewing = ref(false);
  const projects = ref<Array<{ id: string; name: string; updatedAt: string }>>([]);
  const busy = ref(false); const status = ref(''); const failure = ref(''); const progress = ref(0); const warnings = ref<string[]>([]);
  const colorCount = ref(4); const precision = ref(4); const scheme = ref<'high' | 'low'>('high');
  const settings = ref<ViewerSettings>({ mode: 'compare', compareSplit: 0.5, height: 80, layers: false, grid: false, tool: 'orbit', radius: 3, workflow: 'assignment', preview: { preset: 'studio-v1', exposure: 1, environmentIntensity: 1, environmentRotation: 0 } });
  const undoCount = ref(0); const saved = ref(true); const modelInfo = shallowRef<InitResult | null>(null);
  const durations = ref({ load: 0, analyze: 0, segment: 0 });
  let client: MulticolorClient | null = null; let low: LowResult | null = null; let revision = 0; let generation = 0;
  function regionFromPaletteSlot(slot: PaletteSlot, index: number): RegionAssignment {
    if (!matchingCandidates.length && slot.filamentId === null) return { index, sourceHex: slot.sourceHex ?? slot.hex, material: filamentPreview(site.vendor ?? 'Generic', 'PLA', site.seriesId, 'basic', slot.sourceHex ?? slot.hex) };
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
  const surfaces = computed(() => regions.value.map(region => settings.value.appearance === 'ideal'
    ? { hex: region.sourceHex, roughness: 0.65, metalness: 0, transparency: 0 }
    : materialSurface(draft.value && region.index === selectedRegion.value ? draft.value : region.material)));
  const validationSurface = computed(() => selected.value ? materialSurface(draft.value ?? selected.value) : null);
  const scale = computed(() => settings.value.height / ((modelInfo.value?.bbox.maxY ?? 1) - (modelInfo.value?.bbox.minY ?? 0) || 1));
  const labelOptions = () => ({ slotHex: regions.value.map(region => region.sourceHex), slotCount: regions.value.length, regionMap: regions.value.map((_, i) => i), precision: precision.value, scale: scale.value });
  const materialData = (items = allMaterials.value) => ({ version: 2, colorSpace: 'srgb', renderRules: [...new Set(items.map(item => item.renderRule))], materials: items, supplierModifications: items.flatMap(item => { const modification = supplierModification(item); return modification ? [modification] : []; }), viewerSettings: settings.value, validationMaterial: validationMaterial.value, validationReference: validationReference.value, project: project.value ? { id: project.value.id, name: project.value.name, heightMM: settings.value.height, regionSource: regionSource.value, regions: regions.value } : null });
  const manualBindings = new Map<string, MaterialRecord>();
  function rememberBindings() { for (const region of regions.value) if (!region.match) manualBindings.set(region.sourceHex, cloneMaterial(region.material)); }
  function previewRegions(slots: PaletteSlot[]) {
    return slots.map((slot, index) => {
      const region = regionFromPaletteSlot(slot, index), manual = manualBindings.get(region.sourceHex);
      if (manual) assignMaterial(region, manual);
      return region;
    });
  }
  const upstreamDisplay = shallowRef(false);
  const maxColorCount = computed(() => modelInfo.value?.quantization?.maxColorCount ?? 16);
  const editingEnabled = computed(() => !!display.value && settings.value.workflow !== 'validation' && (scheme.value === 'high' || upstreamDisplay.value));
  const editing = useRegionEdit({
    worker: () => client, operation, advance, scale: () => scale.value, label: () => selectedRegion.value,
    enabled: () => editingEnabled.value,
    present(result: SurfaceEditResult) {
      undoCount.value = result.left;
      if (result.surface) showSurface(result.surface, true);
      else if (result.surfaceLabels && upstreamDisplay.value && display.value) display.value = { ...display.value, labels: result.surfaceLabels };
      else showHigh(result.label);
    },
  });
  function showSurface(surface: SurfacePreview, reuse = false) {
    const positions = reuse && upstreamDisplay.value && display.value?.positions.length === surface.positions.length ? display.value.positions : surface.positions;
    const faceMap = reuse && upstreamDisplay.value && display.value?.faceMap?.length === surface.faceMap.length ? display.value.faceMap : surface.faceMap;
    const normals = reuse && upstreamDisplay.value && display.value?.normals ? display.value.normals : surface.normals;
    display.value = { positions, normals, labels: surface.labels, faceMap }; upstreamDisplay.value = true;
  }
  const previewQueue = createPreviewQueue<{ N: number; detail: number }>({
    pending: value => { previewing.value = value; }, error: report,
    async run(options, isCurrent) {
      const worker = client, own = generation;
      if (!worker || !content.value) return;
      rememberBindings();
      worker.setRevision(++revision);
      const started = performance.now();
      const result = await worker.request('preview', { ...options, cands: matchingCandidates, scale: scale.value });
      if (!isCurrent() || own !== generation) return;
      let nextLow: LowResult | null = null;
      if (scheme.value === 'low' && !result.surface) {
        nextLow = await worker.request('lowpoly', { slotHex: result.slots.map(slot => slot.sourceHex ?? slot.hex), precision: options.detail, scale: scale.value, target: 0 });
        if (!isCurrent() || own !== generation) return;
      }
      const selectedHex = regions.value[selectedRegion.value]?.sourceHex;
      const nextRegions = previewRegions(result.slots);
      regions.value = nextRegions; regionSource.value = 'automatic'; draft.value = null;
      selectedRegion.value = Math.max(0, nextRegions.findIndex(region => region.sourceHex === selectedHex));
      editing.clear();
      if (result.surface) showSurface(result.surface); else if (nextLow) showLow(nextLow); else showHigh(result.label);
      colorCount.value = result.actualColorCount ?? result.slots.length;
      undoCount.value = 0; durations.value.segment = performance.now() - started;
      status.value = t('Preview updated', '预览已更新');
    },
  });
  function updateSegmentation(options: { colorCount: number; precision: number }) {
    if (busy.value || !client || settings.value.workflow === 'validation') return;
    if (editing.pending.value || editing.editedCount.value || editing.protectedCount.value) { report(new Error('请先取消候选、清除保护，并撤销或重置局部编辑，再调整分色。')); return; }
    if (!Number.isInteger(options.colorCount) || options.colorCount < 1 || options.colorCount > maxColorCount.value || !Number.isInteger(options.precision) || options.precision < 1 || options.precision > 6) return;
    colorCount.value = options.colorCount; precision.value = options.precision; saved.value = false; failure.value = '';
    previewQueue.schedule({ N: options.colorCount, detail: options.precision });
  }
  watch(settings, () => { saved.value = false; }, { deep: true, flush: 'sync' });
  function report(error: unknown) { failure.value = error instanceof Error ? error.message : String(error); }
  async function operation(action: () => Promise<void>) {
    if (busy.value) return;
    busy.value = true; failure.value = ''; progress.value = 0;
    try { if (previewing.value) await previewQueue.flush(); await action(); } catch (error) { report(error); } finally { busy.value = false; progress.value = 0; }
  }
  function showHigh(labels: Uint8Array | null) { if (labels && content.value) { display.value = { positions: content.value.mesh.positions, normals: content.value.mesh.normals, labels }; upstreamDisplay.value = false; } }
  function showLow(value: LowResult) { low = markRaw(value); display.value = { positions: value.leaves, labels: value.leafLab, faceMap: value.leafFace }; upstreamDisplay.value = false; }
  function advance() { client?.setRevision(++revision); saved.value = false; }
  async function rebuild() {
    if (!client) return;
    if (scheme.value === 'low') showLow(await client.request('lowpoly', { ...labelOptions(), target: 0 }));
    else showHigh((await client.request('label', labelOptions())).label);
  }
  async function segmentInternal() {
    if (!client) return;
    const started = performance.now(); advance();
    if (editing.pending.value || editing.editedCount.value || editing.protectedCount.value) throw new Error('请先取消候选、清除保护，并撤销或重置局部编辑，再重新分色。');
    const result = await client.request('preview', { N: colorCount.value, detail: precision.value, scale: scale.value, cands: matchingCandidates });
    regions.value = result.slots.map(regionFromPaletteSlot); regionSource.value = 'automatic';
    selectedRegion.value = Math.min(selectedRegion.value, regions.value.length - 1);
    editing.clear(); colorCount.value = result.actualColorCount ?? result.slots.length;
    if (result.surface) showSurface(result.surface); else if (scheme.value === 'low') await rebuild(); else showHigh(result.label);
    undoCount.value = 0;
    durations.value.segment = performance.now() - started;
    status.value = t('Color regions are ready', '分色完成');
  }
  const preserveRegions = () => operation(async () => {
    if (!client || !modelInfo.value?.sourceColors?.length) return;
    if (editing.pending.value || editing.editedCount.value || editing.protectedCount.value) throw new Error('请先取消候选、清除保护，并撤销或重置局部编辑，再恢复原分色。');
    const started = performance.now(); advance();
    const result = await client.request('preserve', { cands: matchingCandidates, scale: scale.value });
    rememberBindings(); regions.value = previewRegions(result.slots);
    regionSource.value = 'imported'; scheme.value = 'high'; selectedRegion.value = 0;
    colorCount.value = result.slots.length; precision.value = 6;
    editing.clear(); showHigh(result.label); low = null; undoCount.value = 0; draft.value = null;
    durations.value.segment = performance.now() - started;
    status.value = t('Source color boundaries preserved', '已保留原分色边界');
  });
  async function loadFiles(files: File[], restore?: PrintProject) {
    previewQueue.cancel();
    await operation(async () => {
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
        let nextSurface: SurfacePreview | undefined, restoredEditing: SurfaceEditResult | undefined;
        let generatedCount = 4;
        if (restore?.snapshot && restore.regions.length) {
          nextRegions = restore.regions;
          const result = await candidate.request('restore', { snapshot: restore.snapshot, scheme: restore.scheme });
          nextLow = restore.scheme === 'low' ? result.low : null;
          nextSurface = result.surface; restoredEditing = result.editing;
          if (!nextLow && !result.label) throw new Error('Project has no region labels');
          nextDisplay = nextLow ? { positions: nextLow.leaves, labels: nextLow.leafLab, faceMap: nextLow.leafFace } : { positions: mesh.positions, normals: mesh.normals, labels: result.label! };
        } else if (info.sourceColors?.length) {
          const result = await candidate.request('preserve', { cands: matchingCandidates, scale: 80 / (info.bbox.maxY - info.bbox.minY || 1) });
          nextRegions = result.slots.map(regionFromPaletteSlot);
          nextDisplay = { positions: mesh.positions, normals: mesh.normals, labels: result.label };
        } else {
          const initialCount = Math.min(4, info.quantization?.maxColorCount ?? 16);
          const result = await candidate.request('preview', { N: initialCount, detail: 4, scale: 80 / (info.bbox.maxY - info.bbox.minY || 1), cands: matchingCandidates });
          nextRegions = result.slots.map(regionFromPaletteSlot); nextSurface = result.surface;
          generatedCount = result.actualColorCount ?? result.slots.length;
          nextDisplay = { positions: mesh.positions, normals: mesh.normals, labels: result.label };
        }
        if (own !== generation) return;
        client?.dispose(); client = candidate; adopted = true;
        project.value = restore ?? { version: 2, id, name: files.find(file => /\.(glb|fbx)$/i.test(file.name))?.name.replace(/\.(glb|fbx)$/i, '') ?? 'Untitled', updatedAt: new Date().toISOString(), files: files.map(file => ({ name: file.name, path: file.webkitRelativePath || file.name, type: file.type, data: file })), regions: [], height: 80, colorCount: 4, precision: 4, scheme: 'high', snapshot: null };
        content.value = markRaw({ id: `${id}:${own}`, root: loaded.root, mesh });
        editing.clear(); upstreamDisplay.value = false;
        display.value = markRaw(nextDisplay); low = nextLow ? markRaw(nextLow) : null;
        if (nextSurface) showSurface(nextSurface);
        if (restoredEditing) editing.accept(restoredEditing);
        else if (restore?.snapshot) editing.editedCount.value = restore.snapshot.highPaint?.filter(x => x >= 0).length ?? 0;
        modelInfo.value = markRaw(info); warnings.value = [...loaded.warnings, ...info.warnings];
        regions.value = nextRegions; selectedRegion.value = 0; draft.value = null;
        manualBindings.clear(); rememberBindings();
        regionSource.value = restore ? restore.regionSource ?? 'automatic' : info.sourceColors?.length ? 'imported' : 'automatic';
        scheme.value = restore?.scheme ?? 'high'; settings.value.height = restore?.height ?? 80; colorCount.value = restore?.colorCount ?? (info.sourceColors?.length ? nextRegions.length : generatedCount); precision.value = restore?.precision ?? (info.sourceColors?.length ? 6 : 4);
        settings.value.tool = 'orbit'; settings.value.mode = 'compare'; settings.value.appearance = 'material'; settings.value.compareSplit = 0.5; settings.value.grid = false;
        if (restore) {
          settings.value = restore.viewerSettings ? JSON.parse(JSON.stringify(restore.viewerSettings)) : { ...settings.value, workflow: 'assignment', preview: { preset: 'studio-v1', exposure: 1, environmentIntensity: 1, environmentRotation: 0 } };
          settings.value.height = restore.height;
          validationMaterial.value = restore.validationMaterial ? cloneMaterial(restore.validationMaterial) : validationMaterial.value;
          validationReference.value = restore.validationReference ? cloneMaterial(restore.validationReference) : null;
        }
        revision = 0; undoCount.value = 0;
        durations.value.segment = performance.now() - startedSegment;
        saved.value = Boolean(restore); status.value = regionSource.value === 'imported' ? t('Source color boundaries preserved', '已保留原分色边界') : t('Ready to create', '可以开始编辑');
      } finally {
        if (!adopted) { candidate?.dispose(); disposeModelResources(collectModelResources(loaded.root)); }
      }
    });
  }
  async function demo() {
    const response = await fetch('/samples/atelier.glb');
    if (!response.ok) { report(new Error('Demo asset is missing')); return; }
    await loadFiles([new File([await response.blob()], 'Atelier.glb', { type: 'model/gltf-binary' })]);
  }
  async function preservedSample() {
    const response = await fetch('/samples/atelier-preserved.glb');
    if (!response.ok) { report(new Error('Preserved sample is missing')); return; }
    await loadFiles([new File([await response.blob()], 'Atelier-preserved.glb', { type: 'model/gltf-binary' })]);
    if (!failure.value) { setWorkflow('assignment'); settings.value.mode = 'print'; settings.value.appearance = 'ideal'; }
  }
  async function validationSample() {
    const response = await fetch('/samples/material-check.glb');
    if (!response.ok) { report(new Error('Validation sample is missing')); return; }
    await loadFiles([new File([await response.blob()], 'Material-check.glb', { type: 'model/gltf-binary' })]);
    if (!failure.value) setWorkflow('validation');
  }
  function setWorkflow(workflow: 'assignment' | 'validation') {
    if (editing.pending.value) { report(new Error('请先应用或取消当前编辑预览。')); return; }
    editing.tool.value = 'orbit';
    settings.value.workflow = workflow; settings.value.tool = 'orbit'; draft.value = null;
    if (workflow === 'validation') {
      settings.value.mode = 'print'; settings.value.layers = false;
      settings.value.preview = { preset: 'validation-v1', exposure: 1, environmentIntensity: 1, environmentRotation: 0 };
    }
    else settings.value.preview = { preset: 'studio-v1', exposure: 1, environmentIntensity: 1, environmentRotation: 0 };
  }
  const segment = () => operation(segmentInternal);
  async function changeScheme(value: 'high' | 'low') {
    if (value === scheme.value) return;
    if (value === 'low' && !modelInfo.value?.textured) { report(new Error(t('UV mode needs a textured model. Use surface colors for this model.', 'UV 模式需要带贴图的模型。此模型请使用表面分色。'))); return; }
    await operation(async () => {
      if (!client) return;
      if (editing.pending.value) throw new Error('请先应用或取消当前编辑预览。');
      if (upstreamDisplay.value) { scheme.value = value; return; }
      if (editing.protectedCount.value) throw new Error('请先清除保护再切换旧 UV 模式，避免保护面映射丢失。');
      const snapshot = (await client.request('snapshot', {})).snapshot;
      if (snapshot.highPaint.some(x => x >= 0) || snapshot.lowOverrides.some(map => map?.some(x => x >= 0))) throw new Error('已有局部编辑；请先保存，撤销或重置后再切换模式，避免丢失编辑。');
      scheme.value = value; advance(); editing.clear(); await rebuild();
    });
  }
  const editResult = async (result: EditResult) => { undoCount.value = result.left; if (scheme.value === 'low') await rebuild(); else showHigh(result.label); };
  async function stroke(hits: ViewerHit[]) {
    await operation(async () => {
      if (!client || !content.value) return; advance();
      if (scheme.value === 'high') await editResult(await client.request('brushHigh', { hits, label: selectedRegion.value }));
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
  const undo = () => editingEnabled.value ? editing.undo() : operation(async () => { if (client) { advance(); await editResult(await client.request('undo', {})); } });
  const reset = () => editingEnabled.value ? editing.reset() : operation(async () => { if (client) { advance(); await editResult(await client.request('reset', {})); } });
  function compareMaterial(material: MaterialRecord | null) {
    validationReference.value = material ? cloneMaterial(material) : null;
    if (material) settings.value.mode = 'compare';
    saved.value = false;
  }
  function apply(material: MaterialRecord) {
    if (busy.value) return;
    const problem = materialProblem(material); if (problem) { report(new Error(problem)); return; }
    if (settings.value.workflow === 'validation') validationMaterial.value = cloneMaterial(material);
    else { const region = regions.value[selectedRegion.value]; if (!region) return; assignMaterial(region, material); manualBindings.set(region.sourceHex, cloneMaterial(material)); settings.value.appearance = 'material'; }
    draft.value = null; saved.value = false;
    const current = allMaterials.value.find(item => item.id === material.id);
    const data = (value: MaterialRecord) => libraryJSON({ materials: [withOverrides(value)], supplierEdits: [] });
    if (site.vendor && current && data(current) !== data(material)) void saveMaterial(material, false);
  }
  async function saveMaterial(material: MaterialRecord, activate = true, updateBindings = true) {
    let success = false;
    await operation(async () => {
      const message = validateMaterial(material, allMaterials.value); if (message) throw new Error(message);
      const nextMaterial = withOverrides(material);
      const problem = materialProblem(nextMaterial); if (problem) throw new Error(problem);
      const isSupplier = material.supplier && material.supplier.origin !== 'local-usda';
      if (isSupplier) {
        const groups = groupSupplierEdits(supplierEdits.value);
        const vendor = supplierVendor(nextMaterial);
        groups[vendor] = [...(groups[vendor] ?? []).filter(item => item.id !== nextMaterial.id), nextMaterial];
        const next = Object.values(groups).flat();
        await writeRecord('supplier-overrides', JSON.parse(JSON.stringify(groups)));
        supplierEdits.value = next;
      } else {
        const next = [...materials.value.filter(item => item.id !== nextMaterial.id), nextMaterial];
        await writeRecord('materials', JSON.parse(JSON.stringify(next)));
        materials.value = next;
      }
      if (updateBindings) {
        let found = false; for (const region of regions.value) if (region.material.id === material.id) { assignMaterial(region, nextMaterial); found = true; }
        for (const [hex, bound] of manualBindings) if (bound.id === material.id) manualBindings.set(hex, cloneMaterial(nextMaterial));
        if (settings.value.workflow === 'validation' && (activate || validationMaterial.value?.id === material.id)) validationMaterial.value = cloneMaterial(nextMaterial);
        else if (activate && !found && regions.value[selectedRegion.value]) assignMaterial(regions.value[selectedRegion.value]!, nextMaterial);
      }
      saved.value = false; success = true; status.value = isSupplier ? t(`Saved ${supplierVendor(nextMaterial)} supplier material locally`, `已保存 ${supplierVendor(nextMaterial)} 供应商材质`) : t('Material saved locally', '材质已保存到本地');
      materialSync.schedule();
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
      materialSync.schedule();
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
      materialSync.schedule();
      status.value = t(`Imported ${result.imported} materials`, `已导入 ${result.imported} 个材质`);
    });
    return result;
  }
  function setHeight(value: number) {
    if (editing.pending.value === 'cleanup') { report(new Error('请先应用或取消当前碎色预览，再修改打印高度。')); return; }
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
    return { ...project.value, version: 2, updatedAt: new Date().toISOString(), regions: JSON.parse(JSON.stringify(regions.value)), regionSource: regionSource.value, height: settings.value.height, colorCount: colorCount.value, precision: precision.value, scheme: scheme.value, snapshot: (await client.request('snapshot', {})).snapshot, viewerSettings: JSON.parse(JSON.stringify(settings.value)), validationMaterial: validationMaterial.value ? cloneMaterial(validationMaterial.value) : null, validationReference: validationReference.value ? cloneMaterial(validationReference.value) : null };
  }
  const save = () => operation(async () => {
    const data = await snapshot(); await writeRecord(`project:${data.id}`, data);
    const list = [{ id: data.id, name: data.name, updatedAt: data.updatedAt }, ...projects.value.filter(item => item.id !== data.id)];
    await writeRecord('projects', JSON.parse(JSON.stringify(list))); await writeRecord('active-project', data.id); projects.value = list; project.value = data; saved.value = true; status.value = t('Project saved on this device', '项目已保存到此设备');
  });
  async function openProject(id: string) {
    try {
      const data = await readRecord<PrintProject>(`project:${id}`); if (!data) return;
      if (![1, 2].includes(data.version)) throw new Error('Unsupported project version');
      if (data.regionSource && !['automatic', 'imported'].includes(data.regionSource)) throw new Error('Invalid region source');
      if (data.viewerSettings) validateSettings(data.viewerSettings);
      data.regions.forEach(validateRegion);
      if (data.validationMaterial) { const error = validateMaterial(data.validationMaterial, []); if (error) throw new Error(error); }
      if (data.validationReference) { const error = validateMaterial(data.validationReference, []); if (error) throw new Error(error); }
      await loadFiles(data.files.map(file => { const value = new File([file.data], file.name, { type: file.type }); Object.defineProperty(value, 'webkitRelativePath', { value: file.path }); return value; }), data);
      if (!failure.value) await writeRecord('active-project', id);
    } catch (error) { report(error); }
  }
  const backup = () => operation(async () => {
    const data = await snapshot(); const entries: Record<string, Uint8Array> = {};
    const files = await Promise.all(data.files.map(async (file, index) => { const entry = `assets/${index}`; entries[entry] = new Uint8Array(await file.data.arrayBuffer()); return { name: file.name, path: file.path, type: file.type, entry }; }));
    entries['project.json'] = strToU8(JSON.stringify({ ...data, files, materials: materials.value, supplierEditsByVendor: groupSupplierEdits(supplierEdits.value) }));
    downloadFile(new Blob([zipSync(entries) as Uint8Array<ArrayBuffer>]), `${data.name}.tripo.zip`);
  });
  async function restoreBackup(file: File) {
    try {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const json = entries['project.json']; if (!json) throw new Error('Invalid project archive');
      const data = JSON.parse(strFromU8(json));
      if (typeof data?.id !== 'string' || typeof data.name !== 'string' || !['high', 'low'].includes(data.scheme) || !Number.isInteger(data.colorCount) || data.colorCount < 1 || data.colorCount > 16 || !Number.isInteger(data.precision) || data.precision < 1 || data.precision > 6) throw new Error('Invalid project metadata');
      if (![1, 2].includes(data.version) || !Array.isArray(data.files) || !Array.isArray(data.regions) || data.regions.length > 16 || !Number.isFinite(data.height) || data.height < 10 || data.height > 320) throw new Error('Unsupported or invalid project');
      if (data.regionSource && !['automatic', 'imported'].includes(data.regionSource)) throw new Error('Invalid region source');
      if (data.viewerSettings) validateSettings(data.viewerSettings);
      if (data.validationMaterial) { const error = validateMaterial(data.validationMaterial, []); if (error) throw new Error(error); }
      if (data.validationReference) { const error = validateMaterial(data.validationReference, []); if (error) throw new Error(error); }
      data.regions.forEach(validateRegion);
      const files = data.files.map((item: { name: string; path: string; type: string; entry: string }) => { if (typeof item.name !== 'string' || typeof item.path !== 'string' || !entries[item.entry]) throw new Error('Missing project asset'); const value = new File([entries[item.entry]! as Uint8Array<ArrayBuffer>], item.name, { type: item.type }); Object.defineProperty(value, 'webkitRelativePath', { value: item.path }); return value; });
      const restored: PrintProject = { ...data, files: files.map((file: File) => ({ name: file.name, path: file.webkitRelativePath, type: file.type, data: file })) };
      const catalog = withoutLegacySamples(Array.isArray(data.materials) ? data.materials as MaterialRecord[] : []);
      for (const material of catalog) { const error = validateMaterial(material, catalog); if (error) throw new Error(error); }
      const normalizedSupplier = normalizeSupplierStore(data.supplierEditsByVendor ?? data.supplierEdits ?? []);
      const edits = normalizedSupplier.edits;
      for (const material of edits) { const error = validateMaterial(material, edits); if (error || !material.supplier) throw new Error(error ?? 'Invalid supplier edit'); }
      await loadFiles(files, restored);
      if (!failure.value) saved.value = false;
      if (!failure.value && Array.isArray(data.materials)) { await writeRecord('materials', catalog); materials.value = catalog; saved.value = false; }
      if (!failure.value && data.version === 2) { await writeRecord('supplier-overrides', normalizedSupplier.groups); supplierEdits.value = edits; }
      if (!failure.value) materialSync.schedule();
    } catch (error) { report(error); }
  }
  const export3mf = () => operation(async () => {
    if (!client) return;
    if (settings.value.workflow === 'validation') throw new Error(t('Switch to region assignment before exporting 3MF.', '请切换到区域应用，确认每个区域的耗材后再导出 3MF。'));
    if (upstreamDisplay.value) throw new Error('上游精细标签的网格提交 / 3MF 导出尚未验收；请保存项目或 ZIP。未用旧分色替换已应用编辑。');
    if (editing.pending.value) throw new Error('请先应用或取消当前编辑预览，再导出。');
    const result = await client.request('export3mf', { scheme: scheme.value, name: project.value?.name ?? 'Tripo', scale: scale.value, filaments: regions.value.map(region => ({ id: region.material.materialId, name: region.material.name, hex: materialHex(region.material), catalogHex: region.material.supplier?.catalogHex ?? null, modifications: supplierModification(region.material)?.changes ?? [], ...filamentIdentity(region.material), materialVersion: region.material.supplier?.source.sha256 ?? null })), materialData: JSON.parse(JSON.stringify(materialData())), withConfig: true });
    downloadFile(result.blob, `${project.value?.name ?? 'Tripo'}.3mf`); status.value = t('3MF exported', '3MF 已导出');
  });
  const selftest = () => operation(async () => { if (client) { const result = await client.request('selftest', { withConfig: true }); downloadFile(result.blob, 'four-color-selftest.3mf'); } });
  async function initialize() {
    try {
      const storedMaterials = await readRecord<MaterialRecord[]>('materials');
      if (storedMaterials) {
        for (const material of storedMaterials) { const error = validateMaterial(material, storedMaterials); if (error) throw new Error(error); }
        const catalog = withoutLegacySamples(storedMaterials);
        if (catalog.length !== storedMaterials.length) await writeRecord('materials', JSON.parse(JSON.stringify(catalog)));
        materials.value = catalog;
      }
      const stored = await readRecord<unknown>('supplier-overrides');
      if (stored) {
        const normalized = normalizeSupplierStore(stored);
        for (const material of normalized.edits) { const error = validateMaterial(material, normalized.edits); if (error) throw new Error(error); }
        if (normalized.migrated) await writeRecord('supplier-overrides', normalized.groups);
        supplierEdits.value = normalized.edits;
      }
      projects.value = await readRecord('projects') ?? [];
    } catch (error) { report(error); }
    await materialSync.initialize();
    const active = await readRecord<string>('active-project').catch(() => undefined);
    if (active && projects.value.some(item => item.id === active)) await openProject(active);
    else if (site.vendor) await validationSample();
    else await demo();
  }
  onScopeDispose(() => { generation++; editing.clear(); previewQueue.cancel(); client?.dispose(); });
  return { editing, editingEnabled, upstreamDisplay, maxColorCount, materials, allMaterials, materialSync, validationMaterial, validationReference, referenceSurface, compareMaterial, validationSurface, checked, content, display, regions, regionSource, selectedRegion, selected, surfaces, draft, project, projects, busy, previewing, status, failure, progress, warnings, colorCount, precision, scheme, settings, undoCount, saved, modelInfo, durations,
    loadFiles, demo, preservedSample, validationSample, setWorkflow, setHeight, segment, preserveRegions, updateSegmentation, changeScheme, stroke, fill, undo, reset, apply, saveMaterial, deleteMaterial, importMaterials, exportMaterials, save, openProject, backup, restoreBackup, export3mf, selftest, initialize, report };
});

function validateRegion(region: RegionAssignment, index: number) {
  if (region.index !== index || !/^#[\da-f]{6}$/i.test(region.sourceHex)) throw new Error('Invalid region mapping');
  const error = validateMaterial(region.material, []); if (error) throw new Error(error);
  const match = region.match;
  if (match && (match.basis !== 'catalog-hex-d65-deltae00' || match.materialId !== region.material.id || !/^#[\da-f]{6}$/i.test(match.hex) || !Number.isFinite(match.meanDeltaE) || match.meanDeltaE < 0 || !Number.isFinite(match.areaShare) || match.areaShare < 0 || match.areaShare > 1 + 1e-8)) throw new Error('Invalid color match');
}

function validateSettings(settings: ViewerSettings) {
  if (settings.appearance && !['ideal', 'material'].includes(settings.appearance)) throw new Error('Invalid preview appearance');
  const preview = settings.preview;
  if (!['original', 'print', 'compare'].includes(settings.mode) || !['assignment', 'validation'].includes(settings.workflow ?? 'assignment') || !Number.isFinite(settings.compareSplit) || settings.compareSplit < 0.2 || settings.compareSplit > 0.8 || !['orbit', 'brush', 'fill'].includes(settings.tool) || !Number.isFinite(settings.radius) || settings.radius <= 0 || typeof settings.layers !== 'boolean' || typeof settings.grid !== 'boolean') throw new Error('Invalid viewer settings');
  if (preview && (!['studio-v1', 'validation-v1'].includes(preview.preset) || !Number.isFinite(preview.exposure) || preview.exposure < 0.1 || preview.exposure > 3 || !Number.isFinite(preview.environmentIntensity) || preview.environmentIntensity < 0 || preview.environmentIntensity > 2 || !Number.isFinite(preview.environmentRotation) || preview.environmentRotation < 0 || preview.environmentRotation > 360)) throw new Error('Invalid preview settings');
}
