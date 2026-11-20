<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { Icon, Popover, PopoverClose, PopoverContent, PopoverTrigger, Tooltip, TooltipContent, TooltipTrigger } from '@tripo3d/design';
import { useWorkspace } from '~/@feature/workspace';
import { useLocale } from '~/@base/locale';
import { ModelViewport } from '~/@engine/viewer';
import { useBaseProcessing } from '~/@feature/base-processing';
import BasePanel from '~/@feature/base-processing/view/BasePanel.vue';
import BaseViewport from '~/@feature/base-processing/view/BaseViewport.vue';
import { useSegmentation } from '~/@feature/segmentation/use-segmentation';
import SegmentPanel from '~/@feature/segmentation/view/SegmentPanel.vue';
import SegmentViewport from '~/@feature/segmentation/view/SegmentViewport.vue';
import PrintPreparation from '~/@feature/workspace/view/PrintPreparation.vue';
import ModuleTooltip from '~/@base/ui/ModuleTooltip.vue';
import { materialHex, type MaterialRecord } from '~/@feature/materials';
import { filamentName, filamentSubtitle } from '~/@feature/materials/filaments';
import MyFilaments from '~/@feature/materials/view/MyFilaments.vue';
import AddPlanFilament from '~/@feature/materials/view/AddPlanFilament.vue';
const { tr } = useLocale();

const studio = useWorkspace();
const segmentation = useSegmentation(studio);
const baseActive = ref(false);
const base = useBaseProcessing(() => studio.content, () => studio.settings.height, () => baseActive.value);
function openBase() {
  if (studio.busy || segmentation.busy || segmentation.editing || preparingRefine.value) return;
  pickerActive.value = false; addPlanOpen.value = false;
  baseActive.value = true;
}
const inSegment = computed(() => studio.preparation.activeModule === 'segment');
const inMultiColor = computed(() => studio.preparation.activeModule === 'multi-color');
async function navigateModule(target: 'segment' | 'print' | 'multi-color') {
  if (segmentation.busy || segmentation.editing) return;
  if (baseActive.value && target === studio.preparation.activeModule) { baseActive.value = false; return; }
  baseActive.value = false;
  if (inSegment.value && segmentation.confirmed && target !== 'segment') await segmentation.forward(target);
  else await studio.navigateModule(target);
}
const locale = useLocale();
const { t } = locale;
const materialName = (material: MaterialRecord | null) => material ? filamentName(material, locale.language === 'en') : '';
const modelFaces = computed(() => studio.modelInfo?.nf ?? 0);
const modelVertices = computed(() => studio.modelInfo?.nw ?? 0);
const upload = useTemplateRef<HTMLInputElement>('upload');
const restore = useTemplateRef<HTMLInputElement>('restore');
const viewport = useTemplateRef('viewport');
const canvasArea = useTemplateRef<HTMLDivElement>('canvasArea');
const compareDragging = ref(false);
const planSection = useTemplateRef<HTMLElement>('planSection');
const preparingRefine = ref(false);
const pickerActive = ref(false);
const addPlanOpen = ref(false);
function closeAddPlan() { addPlanOpen.value = false; }
function toggleAddPlan() {
  if (refineDisabled.value) return;
  pickerActive.value = false;
  studio.previewFill(null);
  addPlanOpen.value = !addPlanOpen.value;
}
const refineMode = computed(() => studio.settings.tool === 'brush' ? 'brush' : studio.settings.tool === 'fill' ? 'color' : null);
const refineDisabled = computed(() => studio.busy || preparingRefine.value || !studio.content || !studio.regions.length);
const brushSize = computed({
  get: () => Math.round(studio.settings.radius / 12 * 100),
  set: value => { if (Number.isFinite(value)) studio.settings.radius = Math.min(100, Math.max(1, value)) / 100 * 12; },
});
const refineIcons = {
  brush: 'm14 4 6 6M10 14l-2-2L17 3a2.1 2.1 0 0 1 3 3l-9 9-1-1ZM8 14c-5-1-3 5-6 6 5 2 9-1 6-6Z',
  bucket: 'm9 3 10 10-8 8-9-9 8-8M3 12h15M6 2l5 5m9 9s-2 2.5-2 4a2 2 0 0 0 4 0c0-1.5-2-4-2-4Z',
  undo: 'M9 5 4 10l5 5M4 10h9a6 6 0 0 1 6 6v3',
  print: 'M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6ZM17 12h1',
  export: 'M12 3v13m-5-5 5 5 5-5M3 16v5h18v-5',
  close: 'm6 6 12 12M6 18 18 6',
  picker: 'M15 4l5 5M14 5 5 14v3l-3 3 1 1 3-3h3l10-10a2.8 2.8 0 0 0-4-4Z',
};
const myFilamentsOpen = ref(false);
const pendingRegenerate = ref(false);
const inviteDialog = ref(false);

const preferOwned = ref(true);
const ownedIds = ref<string[]>([]);

const ownedMaterials = computed(() => studio.allMaterials.filter(material => ownedIds.value.includes(material.id)));
const paletteFilaments = computed(() => {
  const map = new Map<string, { material: MaterialRecord; count: number; indices: number[] }>();
  studio.regions.forEach((region, index) => {
    const key = region.material.id;
    const current = map.get(key) ?? { material: region.material, count: 0, indices: [] };
    current.count += 1;
    current.indices.push(index);
    map.set(key, current);
  });
  return [...map.values()];
});

function isOwned(material: MaterialRecord) { return ownedIds.value.includes(material.id); }
function normalizeColorCount() {
  const count = Number(studio.colorCount);
  studio.colorCount = Number.isFinite(count) && count > 0 ? Math.min(12, Math.max(1, Math.round(count))) : 4;
}
function normalizeDetail() {
  const detail = Number(studio.precision);
  studio.precision = Number.isFinite(detail) && detail > 0 ? Math.min(6, Math.max(1, Math.round(detail))) : 4;
}
const separationRangeStyle = (value: number, min: number, max: number) => ({ '--progress': `${Math.max(0, Math.min(100, (value - min) / (max - min) * 100))}%` });
function returnToPlan() {
  studio.draft = null;
  if (studio.settings.workflow === 'validation') studio.setWorkflow('assignment');
}
function generatePlan() {
  normalizeColorCount();
  normalizeDetail();
  finishRefine();
  returnToPlan();
  void studio.segment({ ownedIds: ownedIds.value, preferOwned: preferOwned.value });
}
function requestGenerate() {
  if (studio.undoCount > 0) pendingRegenerate.value = true;
  else generatePlan();
}
function confirmGenerate() { pendingRegenerate.value = false; generatePlan(); }
function selectPlan(index: number) {
  if (studio.busy) return;
  pickerActive.value = false; closeAddPlan();
  returnToPlan(); studio.selectPlanFilament(index);
}
function pickRefinement(materialIndex: number) {
  if (!pickerActive.value || refineDisabled.value) return;
  if (studio.regions[materialIndex]) {
    studio.selectedRegion = materialIndex;
    studio.clearSelection();
  }
  pickerActive.value = false;
}
function togglePicker() {
  if (refineDisabled.value) return;
  closeAddPlan(); pickerActive.value = !pickerActive.value;
  studio.previewFill(null);
}
async function startRefine(mode: 'brush' | 'color') {
  if (refineDisabled.value || studio.preparation.activeModule !== 'multi-color') return;
  if (refineMode.value === mode) { finishRefine(); return; }
  const contentId = studio.content!.id;
  preparingRefine.value = true;
  try {
    returnToPlan();
    if (!studio.refinement) await studio.prepareRefinement();
    if (!studio.refinement || studio.content?.id !== contentId || studio.preparation.activeModule !== 'multi-color') return;
    pickerActive.value = false;
    studio.clearSelection(); studio.selectionScope = 'color';
    studio.settings.tool = mode === 'brush' ? 'brush' : 'fill';
  } finally { preparingRefine.value = false; }
}
function finishRefine() { closeAddPlan(); pickerActive.value = false; studio.settings.tool = 'orbit'; studio.clearSelection(); }
function focusPlanFilament() {
  const row = Array.from(planSection.value?.querySelectorAll<HTMLButtonElement>('.plan-row') ?? []).find(button => button.dataset.materialId === studio.selected?.id);
  row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); row?.focus({ preventScroll: true });
}
function toggleLibrary() { myFilamentsOpen.value = !myFilamentsOpen.value; }
function dismissInvite(addFilaments = false) {
  inviteDialog.value = false;
  if (addFilaments) myFilamentsOpen.value = true;
  try { window.sessionStorage.setItem('tripo-filament-invite-seen', '1'); } catch { /* storage can be unavailable */ }
}

// Old saved projects may still be in the removed standalone material preview.
watch(() => studio.settings.workflow, workflow => { if (workflow === 'validation') returnToPlan(); }, { immediate: true });
watch(() => studio.content?.id, finishRefine);
watch(() => [studio.settings.tool, studio.preparation.activeModule], () => { pickerActive.value = false; closeAddPlan(); });

async function uploadFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (files.length) await studio.loadFiles(files);
}

async function restoreFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await studio.restoreBackup(file);
}

function shortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || baseActive.value) return;
  if (event.key === 'Escape' && pickerActive.value) { event.preventDefault(); pickerActive.value = false; return; }
  if (event.key === 'Escape' && addPlanOpen.value) { event.preventDefault(); closeAddPlan(); return; }
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.key === 'Escape') studio.clearPlanHighlight();
  if (event.key === 'Escape' && !inSegment.value && refineMode.value) {
    finishRefine();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') { event.preventDefault(); if (inSegment.value) { if (event.shiftKey) segmentation.redo(); else segmentation.undo(); } else if (!addPlanOpen.value && !studio.busy && studio.undoCount) void studio.undo(); }
}

function leave(event: BeforeUnloadEvent) {
  if (!studio.saved || base.unsaved) {
    event.preventDefault();
    event.returnValue = '';
  }
}

function updateCompareSplit(event: PointerEvent) {
  if (!compareDragging.value || !canvasArea.value) return;
  const rect = canvasArea.value.getBoundingClientRect();
  studio.settings.compareSplit = Math.min(0.8, Math.max(0.2, (event.clientX - rect.left) / rect.width));
}

function startCompareDrag(event: PointerEvent) {
  if (inMultiColor.value || studio.settings.mode !== 'compare') return;
  compareDragging.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  updateCompareSplit(event);
}

function stopCompareDrag() {
  compareDragging.value = false;
}

type ViewMode = 'original' | 'print' | 'compare';

function modeTitle(mode: ViewMode) {
  return mode === 'original' ? t('Original model', '原模型') : mode === 'print' ? t('Preview', '分色预览') : t('Compare views', '对比视图');
}

function modeDescription(mode: ViewMode) {
  return mode === 'original'
    ? t('Show the imported model with its source materials.', '显示保留原始材质的导入模型。')
    : mode === 'print'
      ? t('Show the material assignments and print appearance.', '显示材质分配和打印外观。')
      : t('Drag the divider to compare the original model and color preview side by side.', '拖动分割线，左右对比原模型与分色预览。');
}

onMounted(() => {
  locale.restore();
  try {
    const saved = window.localStorage.getItem('tripo-owned-filaments');
    if (saved) { const ids: unknown = JSON.parse(saved); if (Array.isArray(ids)) ownedIds.value = [...new Set(ids.filter((id): id is string => typeof id === 'string'))]; }
  } catch { /* ignore unavailable local storage */ }
  void studio.initialize().then(() => {
    if (studio.preparation.activeModule === 'multi-color' && !ownedIds.value.length && !window.sessionStorage.getItem('tripo-filament-invite-seen')) inviteDialog.value = true;
  });
  window.addEventListener('keydown', shortcut);
  window.addEventListener('beforeunload', leave);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', shortcut);
  window.removeEventListener('beforeunload', leave);
});
</script>

<template>
  <main class="studio-shell" @dragover.prevent @drop.prevent="studio.loadFiles(Array.from($event.dataTransfer?.files ?? []))">
    <header class="studio-header">
      <nav class="studio-header-nav">
        <a class="studio-logo" href="/" aria-label="Tripo">
          <Icon icon="i-tripo:tripo" class="size-5" />
          <span>tripo</span>
        </a>
        <button class="workspace-trigger" type="button">
          <span>{{ t('3D Workspace', '3D 工作台') }}</span>
          <Icon icon="i-tripo:caret" class="size-3.5 rotate-180" />
        </button>
        <span class="header-divider" />
        <span class="header-context">{{ tr(studio.project?.name ?? t('Material Studio', '材质工作台')) }}</span>
      </nav>
      <div class="studio-header-actions">
        <button class="header-action header-language-toggle" type="button" :aria-label="t('Switch to Chinese', '切换到英文')" :title="t('Switch to Chinese', '切换到英文')" @click="locale.toggle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18M5 7h14M5 17h14" /></svg>{{ locale.language === 'zh' ? '中 / EN' : 'EN / CN' }}</button>
        <ModuleTooltip :title="t('Import model', '导入模型')" :description="t('Upload a GLB or FBX model and its matching textures.', '上传 GLB 或 FBX 模型及配套贴图。')" side="bottom">
          <button class="header-action header-import" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" @click="upload?.click()"><Icon icon="i-tripo:upload" class="size-3.5" />{{ t('Import model', '导入模型') }}</button>
        </ModuleTooltip>
        <input ref="upload" class="hidden-input" type="file" multiple accept=".glb,.fbx,.png,.jpg,.jpeg,.webp,.tga,.bmp" @change="uploadFiles">
        <ModuleTooltip :title="t('Open sample', '打开示例')" :description="t('Load the bundled model for a quick workflow preview.', '打开内置示例模型，快速体验流程。')" side="bottom">
          <button class="header-action" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" @click="studio.demo()">{{ t('Sample', '示例') }}</button>
        </ModuleTooltip>
        <ModuleTooltip :title="t('Projects & backups', '项目与备份')" :description="t('Save, reopen or restore local projects.', '保存、打开或恢复本地项目。')" side="bottom">
          <details class="header-menu"><summary>{{ t('Projects', '项目') }} <Icon icon="i-tripo:caret" class="size-3 rotate-180" /></summary><div class="header-menu-pop"><button type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="studio.save">{{ t('Save project', '保存项目') }}</button><button v-for="item in studio.projects" :key="item.id" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" @click="studio.openProject(item.id)">{{ tr(item.name) }}</button><button type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="studio.backup">{{ t('Backup', '备份') }}</button><button type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" @click="restore?.click()">{{ t('Restore', '恢复') }}</button><button type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="studio.selftest">{{ t('3MF self-test', '3MF 自检') }}</button><input ref="restore" class="hidden-input" type="file" accept=".zip" @change="restoreFiles"></div></details>
        </ModuleTooltip>

        <ModuleTooltip :title="baseActive ? t('Export STL', '导出 STL') : t('Export 3MF', '导出 3MF')" :description="baseActive ? t('Export the processed model at its current size.', '按当前尺寸导出底面处理结果。') : t('Export the colored model with millimeter scale and material metadata.', '导出带颜色区域、毫米尺寸和材质参数的模型。')" side="bottom">
          <button class="header-export" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || (baseActive ? !base.canExport : inSegment ? !segmentation.confirmed || !!studio.prepSaveError : !studio.display || studio.settings.workflow === 'validation')" :title="tr(baseActive ? 'STL' : inSegment ? (segmentation.confirmed ? '导出已确认的拆分结果' : '请先确认拆分结果') : studio.settings.workflow === 'validation' ? t('Assign region filaments before exporting', '请先在区域应用中分配耗材') : '3MF')" @click="baseActive ? base.exportSTL() : inSegment ? segmentation.exportResult() : studio.export3mf()"><Icon icon="i-tripo:download" class="size-3.5" />{{ tr(!baseActive && inSegment ? '导出部件 GLB' : t('Export', '导出')) }}</button>
        </ModuleTooltip>
      </div>
    </header>

    <div class="studio-body" :class="{ 'studio-body-print': !baseActive && studio.preparation.activeModule === 'print', 'studio-body-base': baseActive }">
      <aside class="studio-left-shell">
        <nav class="studio-left-menu" aria-label="Studio tools">
          <button class="studio-menu-item" type="button" disabled :title="t('Image · Coming soon', 'Image · 暂未开放')">
            <svg class="studio-module-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8" /><circle cx="8" cy="9" r="1.5" fill="currentColor" stroke="none" /><path d="m4 18 5-5 4 4 3-3 5 5M18 2l1.3 3.7L23 7l-3.7 1.3L18 12l-1.3-3.7L13 7l3.7-1.3Z" /></svg>
            <span>Image</span>
          </button>
          <button class="studio-menu-item" type="button" disabled :title="t('Model · Coming soon', 'Model · 暂未开放')"><svg class="studio-module-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m9 6 2.7 6.3L18 15l-6.3 2.7L9 24l-2.7-6.3L0 15l6.3-2.7ZM19 0l1.5 4.5L25 6l-4.5 1.5L19 12l-1.5-4.5L13 6l4.5-1.5Z" transform="translate(1 0) scale(.88)" /></svg><span>Model</span></button>
          <button class="studio-menu-item" :class="{ active: !baseActive && inSegment }" type="button" :disabled="studio.busy || segmentation.busy || !studio.content" :aria-current="!baseActive && inSegment ? 'page' : undefined" aria-controls="segment-panel" :title="tr('模型拆分')" @click="navigateModule('segment')"><svg class="studio-module-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2 22 7 12 12 2 7ZM2 10l8.5 4.3V23L2 18.5Zm20 0-8.5 4.3V23l8.5-4.5Z" /></svg><span>Segment</span></button>
          <button class="studio-menu-item" :class="{ active: !baseActive && studio.preparation.activeModule === 'multi-color' }" type="button" :aria-current="!baseActive && studio.preparation.activeModule === 'multi-color' ? 'page' : undefined" aria-controls="multicolor-panel" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="navigateModule('multi-color')">
            <svg class="studio-module-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10c0-2-1.5-2.7-3.5-2.7H17a2 2 0 0 1-2-2V5c0-1.7-1-3-3-3Z" /><circle cx="7" cy="9" r="1" /><circle cx="7" cy="15" r="1" /><circle cx="12" cy="18" r="1" /><circle cx="11" cy="6" r="1" /></svg>
            <span>Multi-color</span>
          </button>
          <button class="studio-menu-item" :class="{ active: !baseActive && studio.preparation.activeModule === 'print' }" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" :aria-current="!baseActive && studio.preparation.activeModule === 'print' ? 'page' : undefined" aria-controls="print-preparation-panel" @click="navigateModule('print')">
            <svg class="studio-module-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h18M6 3v16H3v3h18v-3h-3V3M9 4v4h6V4M12 8v3M6 19h12" /><path d="m12 12 3 1.5v3L12 18l-3-1.5v-3Zm0 3v3m-3-4.5 3 1.5 3-1.5" /></svg>
            <span>Print</span>
          </button>
          <button class="studio-menu-item" :class="{ active: baseActive }" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || preparingRefine" :aria-current="baseActive ? 'page' : undefined" aria-controls="base-processing-panel" :title="t('Base processing', '底面处理')" @click="openBase">
            <svg class="studio-module-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M1 10h22M5 10l-3 5m8-5-3 5m8-5-3 5m8-5-3 5" /></svg>
            <span>{{ t('Base', '底面处理') }}</span>
          </button>
          <span class="studio-menu-spacer" />
        </nav>

        <BasePanel v-if="baseActive" :tool="base" />
        <SegmentPanel v-else-if="inSegment" :seg="segmentation" />
        <PrintPreparation v-else-if="studio.preparation.activeModule === 'print'" />
        <section v-else id="multicolor-panel" class="studio-left-panel multicolor-panel">
          <div class="studio-panel-title">
            <svg class="multicolor-heading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10c0-2-1.5-2.7-3.5-2.7H17a2 2 0 0 1-2-2V5c0-1.7-1-3-3-3Z" /><circle cx="7" cy="9" r="1" /><circle cx="7" cy="15" r="1" /><circle cx="12" cy="18" r="1" /><circle cx="11" cy="6" r="1" /></svg>
            <h1>{{ t('Multicolor Print', '多色打印') }}</h1>
          </div>
          <div v-if="studio.preparation.origin === 'print'" class="prep-editor-back-row">
            <button class="prep-editor-back" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" @click="navigateModule('print')">{{ tr("← 返回打印准备") }}</button>
          </div>
          <div class="studio-panel-scroll">
            <section class="multicolor-library-card" :aria-label="t('My filaments', '我的耗材')">
              <button class="filament-library-card" type="button" :aria-expanded="myFilamentsOpen" aria-controls="my-filaments-panel" @click="toggleLibrary">
                <span class="multicolor-library-heading"><strong>{{ t('My filaments', '我的耗材') }}</strong><small>{{ t(`${ownedMaterials.length} Saved`, `${ownedMaterials.length} 已保存`) }}</small><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg></span>
                <span class="filament-swatches"><i v-for="material in ownedMaterials.slice(0, 4)" :key="material.id" :style="{ backgroundColor: materialHex(material) }" /><span v-if="ownedMaterials.length > 4" class="multicolor-more-colors">+{{ ownedMaterials.length - 4 }}</span><span v-if="!ownedMaterials.length" class="multicolor-empty-library">{{ t('Add your filaments', '添加我的耗材') }}</span></span>
              </button>
              <label class="multicolor-owned-toggle"><span>{{ t('Use mine first', '优先使用我的耗材') }}</span><input :checked="preferOwned && !!ownedMaterials.length" type="checkbox" role="switch" :disabled="!ownedMaterials.length" :title="!ownedMaterials.length ? t('Add your filaments to enable this option.', '添加耗材后可启用此选项。') : undefined" @change="preferOwned = ($event.target as HTMLInputElement).checked"></label>
            </section>
            <section class="multicolor-separation" :aria-label="t('Color separation', '分色')">
              <div class="multicolor-parameter">
                <label for="multicolor-count-range">{{ t('Filament count', '耗材数量') }}</label>
                <div class="multicolor-slider-row">
                  <input id="multicolor-count-range" v-model.number="studio.colorCount" class="multicolor-range" type="range" min="1" max="12" step="1" :style="separationRangeStyle(studio.colorCount, 1, 12)" :disabled="studio.busy || segmentation.busy || segmentation.editing">
                  <input v-model.number="studio.colorCount" class="multicolor-value" type="number" min="1" max="12" step="1" :aria-label="t('Filament count value', '耗材数量数值')" :disabled="studio.busy || segmentation.busy || segmentation.editing" @change="normalizeColorCount" @keydown.enter="($event.target as HTMLInputElement).blur()">
                </div>
              </div>
              <div class="multicolor-parameter">
                <div class="multicolor-detail-label"><label for="multicolor-detail-range">{{ t('Detail', '细节') }}</label><ModuleTooltip :title="t('Color detail', '分色细节')" :description="t('Higher values preserve finer color details. Matching may take longer.', '数值越高，保留的颜色细节越多，匹配可能需要更长时间。')" side="right"><button class="multicolor-help" type="button" :aria-label="t('About color detail', '了解分色细节')"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><circle cx="8" cy="8" r="6.5" /><path d="M6.4 6a1.7 1.7 0 0 1 3.3.5c0 1.4-1.7 1.3-1.7 2.5M8 11v.2" /></svg></button></ModuleTooltip></div>
                <div class="multicolor-slider-row">
                  <input id="multicolor-detail-range" v-model.number="studio.precision" class="multicolor-range" type="range" min="1" max="6" step="1" :style="separationRangeStyle(studio.precision, 1, 6)" :disabled="studio.busy || segmentation.busy || segmentation.editing">
                  <input v-model.number="studio.precision" class="multicolor-value" type="number" min="1" max="6" step="1" :aria-label="t('Detail value', '细节数值')" :disabled="studio.busy || segmentation.busy || segmentation.editing" @change="normalizeDetail" @keydown.enter="($event.target as HTMLInputElement).blur()">
                </div>
              </div>
              <button class="print-primary multicolor-match" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="requestGenerate"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor" /><path d="m5.5 7 2.3 1.5L10 5.5l2.2 3L14.5 7l-.9 6h-7.2ZM7 15h6" fill="#f9cf00" stroke="#f9cf00" stroke-width="1.1" stroke-linejoin="round" /></svg>{{ studio.busy ? t('Matching…', '匹配中…') : t('Match Filaments', '匹配耗材') }}</button>
            </section>
            <section v-if="studio.regions.length" ref="planSection" class="multicolor-filament-list plan-section">
              <h2>{{ t('Filament List', '耗材列表') }}</h2>
              <button v-for="item in studio.planFilaments" :key="item.material.id" type="button" class="plan-row" :data-material-id="item.material.id" :class="{ active: studio.highlightedFilamentId === item.material.id }" :aria-pressed="studio.highlightedFilamentId === item.material.id" :disabled="studio.busy" :title="`${materialName(item.material)} · ${isOwned(item.material) ? t('In My filaments', '已在我的耗材中') : t('Not in My filaments', '未在我的耗材中')}`" @click="selectPlan(item.indices[0]!)">
                <i :style="{ background: materialHex(item.material) }" />
                <span class="plan-filament-name"><strong>{{ tr(materialName(item.material)) }}</strong><small>{{ tr(filamentSubtitle(item.material, t('Custom', '自定义'))) }}</small></span>
                <svg v-if="isOwned(item.material)" class="multicolor-owned-check" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" role="img" :aria-label="t('In My filaments', '已在我的耗材中')"><path d="m4 10 4 4 8-8" /></svg>
              </button>
            </section>
          </div>
          <footer class="prep-editor-footer">
            <template v-if="studio.preparation.origin === 'print'">
              <p>{{ tr(studio.prepSaving ? '正在保存…' : studio.prepSaveError ? '草稿保存失败，请重试' : studio.prepDirty ? '草稿待保存' : '草稿已保存 · 完成后确认分色') }}</p>
              <button v-if="studio.prepSaveError" class="prep-editor-back" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" @click="studio.savePreparation">{{ tr("重试保存") }}</button>
              <button class="print-primary" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="studio.completePrintColors">{{ tr("完成并返回打印准备") }}</button>
            </template>
            <button v-else class="prep-editor-back prep-editor-forward" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="navigateModule('print')">{{ tr("前往打印准备 →") }}</button>
          </footer>
          <MyFilaments v-if="myFilamentsOpen" v-model:owned-ids="ownedIds" :catalog="studio.allMaterials" :busy="studio.busy" :add-filament="studio.addFilament" @close="myFilamentsOpen = false" />
          <div v-if="pendingRegenerate" class="regenerate-dialog"><strong>{{ t('Replace your refinements?', '重新分色会替换精修结果？') }}</strong><p>{{ t('Generating a new color plan resets your color refinements.', '重新生成分色方案会重置精修结果。') }}</p><button type="button" class="print-primary" @click="confirmGenerate">{{ t('Match Filaments', '重新分色') }}</button><button type="button" class="popover-done" @click="pendingRegenerate = false">{{ t('Keep editing', '继续编辑') }}</button></div>
        </section>
      </aside>

      <section class="studio-viewer-shell">
        <div ref="canvasArea" class="studio-viewer">
          <ClientOnly><ModelViewport v-show="!inSegment && !baseActive" ref="viewport" :content="studio.content" :display="studio.display" :surfaces="studio.surfaces" :settings="studio.viewportSettings" :validation-surface="studio.validationSurface" :selection="studio.selection" :fill-preview="studio.fillPreview" :plan-highlight="studio.planHighlight" :busy="studio.busy" :picker="pickerActive" :editing-blocked="addPlanOpen" @hover="studio.previewFill" @select="studio.selectRefinement" @pick="pickRefinement" @error="studio.report" @stroke="studio.stroke" @fill="studio.fill" /></ClientOnly>
          <ClientOnly><SegmentViewport v-if="!baseActive && inSegment && studio.content" :key="studio.content.id" :content="studio.content" :seg="segmentation" /></ClientOnly>
          <ClientOnly><BaseViewport v-if="baseActive" :tool="base" /></ClientOnly>
          <template v-if="!inSegment && !baseActive">
          <div class="viewer-mode-bar">
            <div v-if="!inMultiColor" class="studio-segmented viewer-modes" role="group" :aria-label="t('Model appearance', '模型外观')"><ModuleTooltip v-for="mode in (['original', 'print', 'compare'] as const)" :key="mode" :title="tr(modeTitle(mode))" :description="modeDescription(mode)" side="bottom"><button type="button" :class="{ active: studio.settings.mode === mode }" :aria-pressed="studio.settings.mode === mode" @click="studio.settings.mode = mode">{{ tr(mode === 'original' ? t('Original', '原模型') : mode === 'print' ? t('Preview', '预览') : t('Compare', '对比')) }}</button></ModuleTooltip></div>
            <dl class="viewer-model-stats" :aria-label="t('Model statistics', '模型信息')">
              <div><dt>{{ t('Topology', '拓扑') }}</dt><dd>{{ t('Triangle', '三角形') }}</dd></div>
              <div><dt>{{ t('Faces', '面数') }}</dt><dd>{{ modelFaces }} / {{ modelFaces }}</dd></div>
              <div><dt>{{ t('Vertices', '顶点数') }}</dt><dd>{{ modelVertices }} / {{ modelVertices }}</dd></div>
            </dl>
          </div>

          <ModuleTooltip v-if="!inMultiColor && studio.settings.mode === 'compare'" :title="t('Compare divider', '对比分割线')" :description="t('Drag left or right to compare the original model and color preview. The split is kept between 20% and 80%.', '向左或向右拖动，比较原模型与分色预览。分割位置限制在 20% 到 80%。')" side="bottom"><div class="compare-divider" :style="{ left: `${studio.settings.compareSplit * 100}%` }" role="slider" aria-label="Compare split" :aria-valuenow="Math.round(studio.settings.compareSplit * 100)" aria-valuemin="20" aria-valuemax="80" tabindex="0" @pointerdown="startCompareDrag" @pointermove="updateCompareSplit" @pointerup="stopCompareDrag" @pointercancel="stopCompareDrag"><span>{{ t('Original', '原模型') }}</span><i /><span>{{ t('Preview', '预览') }}</span></div></ModuleTooltip>

          <div class="viewer-controls">
          <div class="viewer-gizmo">
            <Popover>
              <PopoverTrigger class="gizmo-button"><Tooltip><TooltipTrigger><Icon icon="i-tripo:env" /></TooltipTrigger><TooltipContent side="left">{{ t('Environment', '环境光') }}</TooltipContent></Tooltip></PopoverTrigger>
              <PopoverContent side="left" align="start" :side-offset="16" class="environment-panel">
                <div class="environment-heading"><span>{{ t('Environment', '环境光') }}</span><PopoverClose><Icon icon="i-tripo:close" /></PopoverClose></div>
                <div class="environment-preview"><span>{{ tr(studio.settings.preview?.preset === 'validation-v1' ? t('FIXED VALIDATION', '固定验证环境') : 'STUDIO') }}</span></div>
                <ModuleTooltip :title="t('Environment preset', '环境预设')" :description="t('Choose the studio lighting preset used by the viewer. Studio HDR with ACES tone mapping. Fixed validation locks exposure and environment settings.', 'Studio HDR 配合 ACES 色调映射。固定验证锁定曝光和环境设置。')" side="left"><label v-if="studio.settings.preview">{{ t('Surrounding', '环境') }}<select v-model="studio.settings.preview.preset" :disabled="studio.settings.workflow === 'validation'"><option value="studio-v1">Studio</option><option value="validation-v1">{{ t('Fixed validation', '固定验证') }}</option></select></label></ModuleTooltip>
                <ModuleTooltip :title="t('Environment strength', '环境光强度')" :description="t('Adjust the brightness of the preview environment. This value is visual only and is not exported as material data.', '调整预览环境的亮度。该值只影响显示，不会导出为材质数据。')" side="left"><label>{{ t('Strength', '强度') }}<input v-if="studio.settings.preview" v-model.number="studio.settings.preview.environmentIntensity" type="range" min="0" max="2" step="0.05" :disabled="studio.settings.preview.preset === 'validation-v1'"></label></ModuleTooltip>
                <ModuleTooltip :title="t('Environment rotation', '环境光旋转')" :description="t('Rotate the environment lighting around the model. It does not change baseColor or region assignments.', '旋转模型周围的环境光。不会改变 baseColor 或区域分配。')" side="left"><label>{{ t('Rotation', '旋转') }}<input v-if="studio.settings.preview" v-model.number="studio.settings.preview.environmentRotation" type="range" min="0" max="360" :disabled="studio.settings.preview.preset === 'validation-v1'"></label></ModuleTooltip>
              </PopoverContent>
            </Popover>
            <span class="gizmo-divider" />
            <Tooltip><TooltipTrigger as-child><button class="gizmo-button" type="button" :title="t('Reset camera', '重置相机')" @click="viewport?.fit()"><Icon icon="i-tripo:camera-reset" /></button></TooltipTrigger><TooltipContent side="left">{{ t('Reset camera', '重置相机') }}</TooltipContent></Tooltip>
            <span class="gizmo-divider" />
            <Tooltip><TooltipTrigger as-child><button class="gizmo-button" type="button" :class="{ active: studio.settings.grid }" @click="studio.settings.grid = !studio.settings.grid"><Icon :icon="studio.settings.grid ? 'i-tripo:line-visible' : 'i-tripo:line-invisible'" /></button></TooltipTrigger><TooltipContent side="left">{{ t('Grid', '网格') }}</TooltipContent></Tooltip>
          </div>
          <Popover>
            <PopoverTrigger as-child><button class="viewer-round-button" type="button" :aria-label="t('Viewer help', '视图操作帮助')" :title="t('Viewer help', '视图操作帮助')">?</button></PopoverTrigger>
            <PopoverContent side="left" align="start" :side-offset="12" class="viewer-help-panel">
              <p>{{ t('Drag to rotate', '拖动旋转') }}</p><p>{{ t('Right-drag to pan', '右键拖动平移') }}</p><p>{{ t('Scroll to zoom', '滚轮缩放') }}</p>
            </PopoverContent>
          </Popover>
          <button class="viewer-round-button viewer-undo" type="button" :disabled="studio.busy || !studio.undoCount" :aria-label="t('Undo', '撤销')" :title="t('Undo', '撤销')" @click="studio.undo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5v5h5M4.5 9a8 8 0 1 1-.3 6M12 7v5l3 2" /></svg><i v-if="studio.undoCount" class="viewer-undo-dot" /></button>
          </div>
          <div v-if="studio.busy" class="progress-card" role="status"><span class="spinner" /><strong>{{ t('Processing model', '正在处理模型') }}</strong><small>{{ tr(studio.status) }}</small><div class="progress-track"><i :style="{ width: `${Math.max(5, studio.progress * 100)}%` }" /></div></div>
          <div v-if="studio.failure" role="alert" class="workspace-error"><span>{{ tr(studio.failure) }}</span><button type="button" aria-label="Dismiss error" @click="studio.failure = ''"><Icon icon="i-tripo:close" /></button></div>
          <details v-if="studio.warnings.length" class="warnings"><summary>{{ tr(studio.warnings.length) }} {{ t('import notes', '条导入提示') }}</summary><p v-for="warning in studio.warnings" :key="warning">{{ tr(warning) }}</p></details>

          <div v-if="studio.preparation.activeModule === 'multi-color'" class="print-tools">
            <div v-if="refineMode" class="refine-toolbar" role="toolbar" :aria-label="t('Color refinement tools', '分色精修工具')">
              <div class="add-plan-anchor">
                <button class="toolbar-icon" type="button" :class="{ active: addPlanOpen }" :aria-expanded="addPlanOpen" aria-haspopup="dialog" :disabled="refineDisabled" :title="t('Add filament', '添加耗材')" :aria-label="t('Add filament', '添加耗材')" @click="toggleAddPlan"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button>
                <AddPlanFilament v-if="addPlanOpen" :catalog="studio.allMaterials" :owned-ids="ownedIds" :plan="paletteFilaments.map(item => item.material)" :slot-count="studio.regions.length" :current="studio.selected" :busy="studio.busy" :add="studio.addPlanFilament" @close="closeAddPlan" />
              </div>
              <button class="toolbar-icon refine-picker" type="button" :class="{ active: pickerActive }" :aria-pressed="pickerActive" :disabled="refineDisabled" :title="t('Pick assigned filament', '吸取已分配耗材')" :aria-label="t('Pick assigned filament', '吸取已分配耗材')" @click="togglePicker"><svg viewBox="0 0 24 24"><path :d="refineIcons.picker" /></svg></button>
              <button class="refine-current-color" type="button" :title="materialName(studio.selected)" :aria-label="t('Choose from plan filaments', '从方案耗材选色')" @click="focusPlanFilament"><i :style="{ background: studio.selected ? materialHex(studio.selected) : '#888' }" /></button>
              <span class="toolbar-divider" />
              <template v-if="refineMode === 'brush'">
                <svg class="brush-size-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 16c1-12 6-13 5-3s4 7 6-1 5-10 7-5" /></svg>
                <input v-model.number="brushSize" class="refine-size-slider" type="range" min="1" max="100" :disabled="studio.busy" :aria-label="t('Brush size', '笔刷大小')">
                <input v-model.number="brushSize" class="refine-size-number" type="number" min="1" max="100" :disabled="studio.busy" :aria-label="t('Brush size value', '笔刷大小数值')">
              </template>
              <button class="toolbar-icon" type="button" :title="t('Close tools', '关闭工具')" :aria-label="t('Close tools', '关闭工具')" @click="finishRefine"><svg viewBox="0 0 24 24"><path :d="refineIcons.close" /></svg></button>
            </div>
            <div class="print-toolbar" role="toolbar" :aria-label="t('Multicolor tools', '多色打印工具栏')">
              <button class="toolbar-icon" type="button" :disabled="studio.busy || !studio.undoCount" :title="t('Undo', '撤销')" :aria-label="t('Undo', '撤销')" @click="studio.undo"><svg viewBox="0 0 24 24"><path :d="refineIcons.undo" /></svg></button>
              <span class="toolbar-divider" />
              <button class="toolbar-icon" type="button" :class="{ active: refineMode === 'brush' }" :aria-pressed="refineMode === 'brush'" :disabled="refineDisabled" :title="t('Brush', '画笔')" :aria-label="t('Brush', '画笔')" @click="startRefine('brush')"><svg viewBox="0 0 24 24"><path :d="refineIcons.brush" /></svg></button>
              <Tooltip><TooltipTrigger as-child><button class="toolbar-icon" type="button" :class="{ active: refineMode === 'color' }" :aria-pressed="refineMode === 'color'" :disabled="refineDisabled" :aria-label="t('Color fill', '色块填充')" @click="startRefine('color')"><svg viewBox="0 0 24 24"><path :d="refineIcons.bucket" /></svg></button></TooltipTrigger><TooltipContent side="top">{{ t('Choose a filament, then click a region to fill', '选择耗材，点击色块填充') }}</TooltipContent></Tooltip>
              <span class="toolbar-divider" />
              <button class="toolbar-primary" type="button" :disabled="studio.busy || !studio.content || studio.saved" @click="studio.save">{{ t('Save', '保存') }}</button>
              <button class="toolbar-action" type="button" :disabled="studio.busy || !studio.content" @click="navigateModule('print')"><svg viewBox="0 0 24 24"><path :d="refineIcons.print" /></svg>{{ t('3D Print', '3D 打印') }}</button>
              <span class="toolbar-divider" />
              <button class="toolbar-primary" type="button" :disabled="studio.busy || !studio.display" @click="studio.export3mf"><svg viewBox="0 0 24 24"><path :d="refineIcons.export" /></svg>{{ t('Export', '导出') }}</button>
            </div>
          </div>
          </template>
        </div>
      </section>

      <aside class="studio-right-shell" aria-hidden="true"><div class="studio-history-placeholder" /></aside>
    </div>
    <div v-if="inviteDialog && !baseActive" class="print-invite-veil"><section class="print-invite"><div class="invite-icon"><Icon icon="i-tripo:segmentation" /></div><h2>{{ t('Print with what you own', '使用已有耗材打印') }}</h2><p>{{ t('Add your existing filaments by SKU or color. We will use compatible, close matches first.', '按 SKU 或颜色录入现有耗材，分色时会优先使用兼容的相近颜色。') }}</p><button type="button" class="print-primary" @click="dismissInvite(true)">{{ t('Add my filaments', '录入我的耗材') }}</button><button type="button" class="popover-done" @click="dismissInvite()">{{ t('Skip for now', '暂时跳过') }}</button></section></div>
  </main>
</template>

<style scoped>
.header-language-toggle{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.header-language-toggle svg{width:14px;height:14px}.studio-shell:lang(en) .prep-editor-footer .print-primary{white-space:normal}
.prep-editor-back-row{padding:0 20px 10px;flex:none}.prep-editor-footer{margin-top:auto;padding:12px 20px 16px;border-top:1px solid #ffffff14;flex:none}.prep-editor-back{display:block;border:0;background:none;color:#c5c6cb;font-size:11px;padding:5px 0 8px;cursor:pointer}.prep-editor-back:disabled{opacity:.45;cursor:not-allowed}.prep-editor-footer .print-primary{min-height:34px;font-size:11px}.prep-editor-footer p{font-size:10px;color:#94959c;line-height:1.5;margin:0 0 8px}.prep-editor-forward{width:100%;padding:8px 0;text-align:center}.prep-editor-back:focus-visible{outline:2px solid #ffd400;outline-offset:3px}

.multicolor-panel { background: #26272c; color: #f2f2f2; font-size: 12px; }
.multicolor-panel .studio-panel-title { flex: none; }
.multicolor-heading-icon { width: 16px; height: 16px; flex: none; }
.multicolor-library-card { padding: 12px; border-radius: 10px; background: #2d2e33; }
.multicolor-panel .filament-library-card { display: block; min-height: 0; padding: 0; margin: 0; border-radius: 0; background: transparent; }
.multicolor-library-heading { display: flex; align-items: center; gap: 8px; line-height: 18px; }
.multicolor-library-heading strong { flex: 1; font-weight: 400; }
.multicolor-panel .multicolor-library-heading small { margin: 0; font-size: 10px; color: #999; white-space: nowrap; }
.multicolor-library-heading svg { width: 14px; height: 14px; flex: none; }
.multicolor-panel .filament-swatches { min-height: 16px; gap: 4px; margin-top: 4px; }
.multicolor-panel .filament-swatches i { flex: none; width: 16px; height: 16px; background-image: radial-gradient(circle at 32% 24%, #fff9, transparent 55%, #0005 100%); box-shadow: inset 0 0 0 1px #ffffff08; }
.multicolor-empty-library, .multicolor-more-colors { font-size: 10px; color: #999; }
.multicolor-owned-toggle { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 24px; min-height: 20px; cursor: pointer; }
.multicolor-owned-toggle input { appearance: none; flex: none; width: 30px; height: 16px; margin: 0; border-radius: 99px; background: #48494f; cursor: pointer; transition: background .15s; }
.multicolor-owned-toggle input::before { content: ''; display: block; width: 10px; height: 10px; margin: 3px; border-radius: 50%; background: #f2f2f2; transition: transform .15s; }
.multicolor-owned-toggle input:checked { background: #503be3; }
.multicolor-owned-toggle input:checked::before { transform: translateX(14px); }
.multicolor-owned-toggle input:disabled { opacity: .4; cursor: not-allowed; }
.multicolor-separation { margin-top: 16px; }
.multicolor-parameter + .multicolor-parameter { margin-top: 16px; }
.multicolor-parameter label, .multicolor-detail-label { line-height: 18px; }
.multicolor-detail-label { display: flex; align-items: center; gap: 6px; }
.multicolor-help { display: grid; place-items: center; padding: 0; width: 14px; height: 14px; color: #6c6d73; }
.multicolor-help svg { width: 14px; height: 14px; }
.multicolor-help:hover { color: #b5b6bd; }
.multicolor-slider-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; height: 32px; }
.multicolor-range { appearance: none; flex: 1; width: 0; min-width: 0; height: 4px; border: 0; border-radius: 99px; margin: 0; background: linear-gradient(to right, #d5d5d8 var(--progress), #303136 var(--progress)); cursor: pointer; }
.multicolor-range::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; border: 2px solid #f2f2f2; border-radius: 50%; background: #101114; }
.multicolor-range::-moz-range-thumb { width: 10px; height: 10px; border: 2px solid #f2f2f2; border-radius: 50%; background: #101114; }
.multicolor-value { flex: 0 0 72px; min-width: 0; width: 72px; height: 32px; padding: 0 8px; border: 1px solid #ffffff0a; border-radius: 8px; background: transparent; font-size: 12px; text-align: center; appearance: textfield; font-variant-numeric: tabular-nums; }
.multicolor-value::-webkit-inner-spin-button, .multicolor-value::-webkit-outer-spin-button { appearance: none; margin: 0; }
.multicolor-value:focus { border-color: #ffffff40; }
.multicolor-panel .multicolor-match { height: 40px; margin-top: 16px; border-radius: 99px; font-size: 14px; gap: 8px; }
.multicolor-match svg { width: 18px; height: 18px; flex: none; }
.multicolor-match:enabled:hover { background: #ffdc32; }
.multicolor-filament-list { margin-top: 40px; }
.multicolor-filament-list h2 { font-size: 12px; font-weight: 400; line-height: 18px; margin-bottom: 12px; }
.multicolor-panel .plan-row { gap: 8px; padding: 3px 0; margin: 0 0 8px; min-height: 40px; border-radius: 8px; }
.multicolor-panel .plan-row > i { width: 32px; height: 32px; border-radius: 6px; box-shadow: inset 0 0 0 1px #ffffff08; }
.multicolor-panel .plan-row.active { border-color: transparent; background: #ffffff06; }
.multicolor-panel .plan-row.active > i { outline-offset: 1px; }
.multicolor-panel .plan-row:hover:enabled { background: #ffffff06; }
.multicolor-panel .plan-filament-name strong { color: #f2f2f2; font-size: 12px; font-weight: 400; line-height: 18px; }
.multicolor-panel .plan-filament-name small { margin-top: 2px; color: #999; font-size: 10px; line-height: 14px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
.multicolor-owned-check { width: 16px; height: 16px; margin-right: 2px; flex: none; color: #999; }
.multicolor-panel .prep-editor-footer { border-top: 0; }
</style>
