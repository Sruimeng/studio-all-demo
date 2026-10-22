<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { Icon, Popover, PopoverClose, PopoverContent, PopoverTrigger, Tooltip, TooltipContent, TooltipTrigger } from '@tripo3d/design';
import { useWorkspace } from '~/@feature/workspace';
import { useLocale } from '~/@base/locale';
import { ModelViewport } from '~/@engine/viewer';
import { useSegmentation } from '~/@feature/segmentation/use-segmentation';
import SegmentPanel from '~/@feature/segmentation/view/SegmentPanel.vue';
import SegmentViewport from '~/@feature/segmentation/view/SegmentViewport.vue';
import UvAtlas from '~/@feature/workspace/view/UvAtlas.vue';
import PrintPreparation from '~/@feature/workspace/view/PrintPreparation.vue';
import ModuleTooltip from '~/@base/ui/ModuleTooltip.vue';
import type { MaterialRecord } from '~/@feature/materials';

const studio = useWorkspace();
const segmentation = useSegmentation(studio);
const inSegment = computed(() => studio.preparation.activeModule === 'segment');
async function navigateModule(target: 'segment' | 'print' | 'multi-color') {
  if (segmentation.busy || segmentation.editing) return;
  if (inSegment.value && segmentation.confirmed && target !== 'segment') await segmentation.forward(target);
  else await studio.navigatePreparation(target);
}
const locale = useLocale();
const { t } = locale;
const upload = useTemplateRef<HTMLInputElement>('upload');
const restore = useTemplateRef<HTMLInputElement>('restore');
const viewport = useTemplateRef('viewport');
const canvasArea = useTemplateRef<HTMLDivElement>('canvasArea');
const compareDragging = ref(false);
const settingsExpanded = ref(true);
const refineExpanded = ref(false);
const refineMode = ref<'brush' | 'color' | 'uv'>('brush');
const filamentPopover = ref<'library' | 'replace' | null>(null);
const filamentEntry = ref<'sku' | 'color'>('sku');
const filamentQuery = ref('');
const filamentColor = ref('#a6b441');
const replaceMaterialId = ref<string | null>(null);
const pendingRegenerate = ref(false);
const inviteDialog = ref(false);

const preferOwned = ref(true);
const ownedIds = ref<string[]>([]);

const ownedMaterials = computed(() => studio.allMaterials.filter(material => ownedIds.value.includes(material.id)));
const searchedFilaments = computed(() => {
  const query = filamentQuery.value.trim().toLowerCase();
  return studio.allMaterials.filter(material => !query || material.materialId.toLowerCase().includes(query) || material.name.toLowerCase().includes(query)).slice(0, 8);
});
const planFilaments = computed(() => {
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
function addOwned(material: MaterialRecord) {
  if (!ownedIds.value.includes(material.id)) ownedIds.value = [...ownedIds.value, material.id];
  filamentQuery.value = '';
}
function removeOwned(material: MaterialRecord) { ownedIds.value = ownedIds.value.filter(id => id !== material.id); }
function addClosestColor() {
  const target = filamentColor.value.toLowerCase();
  const hex = (value: string) => value.replace('#', '').match(/.{2}/g)?.map(part => Number.parseInt(part, 16)) ?? [0, 0, 0];
  const wanted = hex(target);
  const nearest = studio.allMaterials.reduce<{ material: MaterialRecord | null; distance: number }>((best, material) => {
    const rgb = hex(material.hex); const distance = rgb.reduce((sum, value, index) => sum + (value - wanted[index]!) ** 2, 0);
    return distance < best.distance ? { material, distance } : best;
  }, { material: null, distance: Number.POSITIVE_INFINITY }).material;
  if (nearest) addOwned(nearest);
}
function normalizeColorCount() {
  const count = Number(studio.colorCount);
  studio.colorCount = Number.isFinite(count) && count > 0 ? Math.min(12, Math.max(1, Math.round(count))) : 4;
}
function returnToPlan() {
  studio.draft = null;
  if (studio.settings.workflow === 'validation') studio.setWorkflow('assignment');
}
function generatePlan() {
  normalizeColorCount();
  returnToPlan();
  void studio.segment({ ownedIds: ownedIds.value, preferOwned: preferOwned.value });
}
function requestGenerate() {
  if (studio.undoCount > 0) pendingRegenerate.value = true;
  else generatePlan();
}
function confirmGenerate() { pendingRegenerate.value = false; generatePlan(); }
function selectPlan(index: number) { returnToPlan(); studio.selectedRegion = index; }
function openReplacement(materialId: string) { returnToPlan(); replaceMaterialId.value = materialId; filamentPopover.value = 'replace'; }
function replacePlanMaterial(material: MaterialRecord) {
  if (replaceMaterialId.value) studio.replaceMaterial(replaceMaterialId.value, material);
  replaceMaterialId.value = null; filamentPopover.value = null;
}
async function startRefine(mode: 'brush' | 'color' | 'uv') {
  if (studio.busy || !studio.content) return;
  returnToPlan();
  await studio.prepareRefinement();
  if (!studio.refinement) return;
  refineMode.value = mode; refineExpanded.value = true; studio.clearSelection();
  if (mode === 'uv' && !studio.refinement.islandCount) { studio.settings.tool = 'orbit'; return; }
  studio.selectionScope = mode === 'color' ? 'color' : 'island';
  if (studio.settings.mode === 'original') studio.settings.mode = 'print';
  studio.settings.tool = mode === 'brush' ? 'brush' : 'select';
}
function finishRefine() { studio.settings.tool = 'orbit'; studio.clearSelection(); }
function chooseRefineFilament(index: number) {
  if (refineMode.value === 'brush') studio.selectedRegion = index;
  else void studio.assignSelection(index);
}
function setSelectionScope(scope: 'island' | 'part') { studio.selectionScope = scope; studio.clearSelection(); }
function toggleRefine() {
  if (refineExpanded.value) { refineExpanded.value = false; finishRefine(); }
  else void startRefine(refineMode.value);
}
function toggleLibrary() { filamentPopover.value = filamentPopover.value === 'library' ? null : 'library'; }
function dismissInvite(addFilaments = false) {
  inviteDialog.value = false;
  if (addFilaments) filamentPopover.value = 'library';
  try { window.sessionStorage.setItem('tripo-filament-invite-seen', '1'); } catch { /* storage can be unavailable */ }
}

// Old saved projects may still be in the removed standalone material preview.
watch(() => studio.settings.workflow, workflow => { if (workflow === 'validation') returnToPlan(); }, { immediate: true });
watch(() => studio.content?.id, () => { refineExpanded.value = false; });

watch(ownedIds, value => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem('tripo-owned-filaments', JSON.stringify(value)); } catch { /* ignore unavailable local storage */ }
}, { deep: true });


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
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') { event.preventDefault(); if (inSegment.value) { if (event.shiftKey) segmentation.redo(); else segmentation.undo(); } else if (!studio.busy && studio.undoCount) void studio.undo(); }
}

function leave(event: BeforeUnloadEvent) {
  if (!studio.saved) {
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
  if (studio.settings.mode !== 'compare') return;
  compareDragging.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  updateCompareSplit(event);
}

function stopCompareDrag() {
  compareDragging.value = false;
}

type ViewMode = 'original' | 'print' | 'compare';

function modeTitle(mode: ViewMode) {
  return mode === 'original' ? t('Original model', '原模型') : mode === 'print' ? t('Material preview', '材质预览') : t('Compare views', '对比视图');
}

function modeDescription(mode: ViewMode) {
  return mode === 'original'
    ? t('Show the imported model with its source materials.', '显示保留原始材质的导入模型。')
    : mode === 'print'
      ? t('Show the material assignments and print appearance.', '显示材质分配和打印外观。')
      : t('Drag the divider to compare source and print materials side by side.', '拖动分割线，左右对比原模型与打印材质。');
}

onMounted(() => {
  locale.restore();
  try {
    const saved = window.localStorage.getItem('tripo-owned-filaments');
    if (saved) ownedIds.value = JSON.parse(saved) as string[];
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
        <span class="header-context">{{ studio.project?.name ?? t('Material Studio', '材质工作台') }}</span>
      </nav>
      <div class="studio-header-actions">
        <ModuleTooltip :title="t('Import model', '导入模型')" :description="t('Upload a GLB or FBX model and its matching textures.', '上传 GLB 或 FBX 模型及配套贴图。')" side="bottom">
          <button class="header-action header-import" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" @click="upload?.click()"><Icon icon="i-tripo:upload" class="size-3.5" />{{ t('Import model', '导入模型') }}</button>
        </ModuleTooltip>
        <input ref="upload" class="hidden-input" type="file" multiple accept=".glb,.fbx,.png,.jpg,.jpeg,.webp,.tga,.bmp" @change="uploadFiles">
        <ModuleTooltip :title="t('Open sample', '打开示例')" :description="t('Load the bundled model for a quick workflow preview.', '打开内置示例模型，快速体验流程。')" side="bottom">
          <button class="header-action" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" @click="studio.demo()">{{ t('Sample', '示例') }}</button>
        </ModuleTooltip>
        <ModuleTooltip :title="t('Projects & backups', '项目与备份')" :description="t('Save, reopen or restore local projects.', '保存、打开或恢复本地项目。')" side="bottom">
          <details class="header-menu"><summary>{{ t('Projects', '项目') }} <Icon icon="i-tripo:caret" class="size-3 rotate-180" /></summary><div class="header-menu-pop"><button type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="studio.save">{{ t('Save project', '保存项目') }}</button><button v-for="item in studio.projects" :key="item.id" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" @click="studio.openProject(item.id)">{{ item.name }}</button><button type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="studio.backup">{{ t('Backup', '备份') }}</button><button type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" @click="restore?.click()">{{ t('Restore', '恢复') }}</button><button type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="studio.selftest">{{ t('3MF self-test', '3MF 自检') }}</button><input ref="restore" class="hidden-input" type="file" accept=".zip" @change="restoreFiles"></div></details>
        </ModuleTooltip>
        <ModuleTooltip :title="t('Language', '语言')" :description="t('Switch the workspace labels between English and Chinese.', '切换工作台的中英文显示。')" side="bottom">
          <button class="header-language" type="button" @click="locale.toggle">{{ locale.language === 'zh' ? '中 / EN' : 'EN / 中' }}</button>
        </ModuleTooltip>
        <ModuleTooltip :title="t('Export 3MF', '导出 3MF')" :description="t('Export the colored model with millimeter scale and material metadata.', '导出带颜色区域、毫米尺寸和材质参数的模型。')" side="bottom">
          <button class="header-export" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || (inSegment ? !segmentation.confirmed || !!studio.prepSaveError : !studio.display || studio.settings.workflow === 'validation')" :title="inSegment ? (segmentation.confirmed ? '导出已确认的拆分结果' : '请先确认拆分结果') : studio.settings.workflow === 'validation' ? t('Assign region filaments before exporting', '请先在区域应用中分配耗材') : '3MF'" @click="inSegment ? segmentation.exportResult() : studio.export3mf()"><Icon icon="i-tripo:download" class="size-3.5" />{{ inSegment ? '导出部件 GLB' : t('Export', '导出') }}</button>
        </ModuleTooltip>
      </div>
    </header>

    <div class="studio-body">
      <aside class="studio-left-shell">
        <nav class="studio-left-menu" aria-label="Studio tools">
          <button class="studio-menu-item" type="button" disabled :title="t('Image · Coming soon', 'Image · 暂未开放')">
            <svg class="studio-module-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8" /><circle cx="8" cy="9" r="1.5" fill="currentColor" stroke="none" /><path d="m4 18 5-5 4 4 3-3 5 5M18 2l1.3 3.7L23 7l-3.7 1.3L18 12l-1.3-3.7L13 7l3.7-1.3Z" /></svg>
            <span>Image</span>
          </button>
          <button class="studio-menu-item" type="button" disabled :title="t('Model · Coming soon', 'Model · 暂未开放')"><Icon icon="i-tripo:generate" /><span>Model</span></button>
          <button class="studio-menu-item studio-menu-segment" :class="{ active: inSegment }" type="button" :disabled="studio.busy || segmentation.busy || !studio.content" :aria-current="inSegment ? 'page' : undefined" aria-controls="segment-panel" title="模型拆分" @click="navigateModule('segment')"><Icon icon="i-tripo:segmentation" /><span>Segment</span><svg class="studio-module-caret" viewBox="0 0 10 6" fill="currentColor" aria-hidden="true"><path d="M0 0h10L5 6Z" /></svg></button>
          <button class="studio-menu-item" type="button" disabled :title="t('Decorate · Coming soon', 'Decorate · 暂未开放')">
            <svg class="studio-module-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.3 2.7a2.1 2.1 0 0 1 3 3L12 16l-4-4ZM6.8 13.8l3.4 3.4c-.2 3.2-2.8 4.7-7.4 4.2 1.6-1.5.4-4.6 4-7.6Z" /></svg>
            <span>Decorate</span>
          </button>
          <button class="studio-menu-item studio-menu-print-start" :class="{ active: studio.preparation.activeModule === 'multi-color' }" type="button" :aria-current="studio.preparation.activeModule === 'multi-color' ? 'page' : undefined" aria-controls="multicolor-panel" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="navigateModule('multi-color')">
            <span class="studio-module-badge" aria-hidden="true">🔥</span>
            <svg class="studio-module-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 10 5-10 5L2 7Zm-10 9 10 5 10-5v3l-10 5-10-5Zm0 6 10 5 10-5v3l-10 5-10-5Z" transform="translate(1 0) scale(.92)" /></svg>
            <span>Multi-color</span>
          </button>
          <button class="studio-menu-item" :class="{ active: studio.preparation.activeModule === 'print' }" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" :aria-current="studio.preparation.activeModule === 'print' ? 'page' : undefined" aria-controls="print-preparation-panel" @click="navigateModule('print')">
            <span class="studio-module-badge" aria-hidden="true">🔥</span>
            <svg class="studio-module-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h18M6 3v16H3v3h18v-3h-3V3M9 4v4h6V4M12 8v3M6 19h12" /><path d="m12 12 3 1.5v3L12 18l-3-1.5v-3Zm0 3v3m-3-4.5 3 1.5 3-1.5" /></svg>
            <span>Print</span>
          </button>
          <span class="studio-menu-spacer" />
          <span class="studio-local-state"><i />LOCAL</span>
        </nav>

        <SegmentPanel v-if="inSegment" :seg="segmentation" />
        <PrintPreparation v-else-if="studio.preparation.activeModule === 'print'" :owned-ids="ownedIds" />
        <section v-else id="multicolor-panel" class="studio-left-panel">
          <div class="studio-panel-title">
            <Icon icon="i-tripo:segmentation" class="size-4" />
            <h1>{{ t('Multicolor print', '多色打印') }}</h1>
          </div>
          <div v-if="studio.preparation.origin === 'print'" class="prep-editor-back-row">
            <button class="prep-editor-back" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" @click="navigateModule('print')">← 返回打印准备</button>
          </div>
          <div class="studio-panel-scroll">
            <button class="filament-library-card" type="button" @click="toggleLibrary"><span><strong>{{ t('My filaments', '我的耗材') }}</strong><small>{{ ownedMaterials.length }} {{ t('saved', '种已保存') }}</small></span><span class="filament-swatches"><i v-for="material in ownedMaterials.slice(0, 7)" :key="material.id" :style="{ background: material.hex }" /><Icon icon="i-tripo:caret" class="size-3 rotate-90" /></span></button>
            <section class="print-section">
              <div class="print-section-heading"><h2>{{ t('Color separation', '分色') }}</h2><button type="button" @click="settingsExpanded = !settingsExpanded">{{ settingsExpanded ? t('Collapse', '收起') : t('Edit', '编辑') }} <Icon icon="i-tripo:caret" :class="settingsExpanded ? 'size-3 rotate-180' : 'size-3'" /></button></div>
              <template v-if="settingsExpanded">
                <label class="print-field"><span>{{ t('Filament count', '耗材数量') }}</span><input v-model.number="studio.colorCount" type="number" min="1" max="12" step="1" :disabled="studio.busy || segmentation.busy || segmentation.editing" @change="normalizeColorCount"></label>
                <label class="studio-range separation-detail"><span>{{ t('Color detail', '分色细节') }}<b>{{ studio.precision }}</b></span><input v-model.number="studio.precision" type="range" min="1" max="6" step="1" :disabled="studio.busy || segmentation.busy || segmentation.editing"></label>
                <p class="print-help">{{ t('Higher values retain finer color details. Applied when you regenerate.', '数值越高，保留越多颜色细节；重新分色后生效。') }}</p>
                <label class="print-switch"><span>{{ t('Use mine first', '优先使用我的耗材') }}</span><input v-model="preferOwned" class="studio-switch" type="checkbox" :disabled="!ownedMaterials.length"></label>
                <p class="print-help">{{ ownedMaterials.length ? t('Prefer close colors from your compatible materials.', '优先匹配兼容的现有耗材。') : t('Add your filaments to enable this option.', '添加耗材后可启用此选项。') }}</p>
                <button class="print-primary" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="requestGenerate"><Icon icon="i-tripo:magic" class="size-4" />{{ studio.regions.length ? t('Regenerate plan', '重新分色') : t('Generate color plan', '生成分色方案') }} <span>⚡ 10</span></button>
              </template>
              <div v-else class="print-summary"><b>{{ studio.colorCount }}</b><span>•</span><span>{{ preferOwned ? t('Use mine first', '优先我的耗材') : t('Best color match', '最佳颜色匹配') }}</span></div>
            </section>
            <section v-if="studio.regions.length" class="print-section plan-section"><div class="print-section-heading"><h2>{{ t('Plan filaments', '方案耗材') }}</h2><span>{{ planFilaments.length }} used</span></div><div class="plan-summary"><span>{{ planFilaments.filter(item => isOwned(item.material)).length }} owned</span><span>{{ planFilaments.filter(item => !isOwned(item.material)).length }} not owned</span></div><details v-for="item in planFilaments" :key="item.material.id" class="plan-row"><summary @click="selectPlan(item.indices[0]!)"><i :style="{ background: item.material.hex }" /><b>{{ item.material.name }}</b><em>{{ isOwned(item.material) ? 'Owned' : 'Not owned' }}</em></summary><div class="plan-detail"><p>Material <strong>{{ item.material.supplier?.materialType ?? 'PLA' }}</strong></p><p>SKU <strong>{{ item.material.materialId }}</strong></p><button type="button" @click="openReplacement(item.material.id)">{{ t('Replace filament', '替换耗材') }}</button></div></details></section>
            <section class="print-section refine-section">
              <button class="refine-heading" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="toggleRefine"><span><Icon icon="i-tripo:magic" />{{ t('Refine colors', '精修分色') }}</span><Icon icon="i-tripo:caret" :class="refineExpanded ? 'size-3 rotate-180' : 'size-3'" /></button>
              <p v-if="!refineExpanded" class="print-help">{{ t('Brush, color regions or real UV islands.', '支持画笔、连续色块和真实 UV 岛改色。') }}</p>
              <template v-else>
                <div class="refine-tabs"><button v-for="mode in (['brush', 'color', 'uv'] as const)" :key="mode" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" :class="{ active: refineMode === mode }" @click="startRefine(mode)">{{ mode === 'brush' ? t('Brush', '画笔') : mode === 'color' ? t('Color region', '色块') : t('UV Edit', 'UV 岛') }}</button></div>
                <template v-if="refineMode === 'uv'">
                  <template v-if="studio.refinement?.islandCount">
                    <label class="print-field">{{ t('Select by', '选择范围') }}<select :value="studio.selectionScope" :disabled="studio.busy || segmentation.busy || segmentation.editing" @change="setSelectionScope(($event.target as HTMLSelectElement).value as 'island' | 'part')"><option value="island">{{ t('UV island', 'UV 岛') }}</option><option value="part">{{ t('Connected part', '独立部件') }}</option></select></label>
                    <UvAtlas :data="studio.refinement" :selection="studio.selection" :colors="studio.regions.map(region => region.material.hex)" :busy="studio.busy || studio.settings.tool !== 'select'" @select="studio.selectRefinement" />
                    <p class="print-help">{{ t('Select in the UV map or on the model. Parts follow connected geometry, not semantic shapes.', '可在展开图或模型上选择。独立部件按几何连接识别，不自动识别树叶等语义。') }}</p>
                  </template>
                  <p v-else class="print-help">{{ t('This model has no valid UV islands. Use Brush or Color region.', '当前模型没有有效 UV 岛，请使用画笔或色块改色。') }}</p>
                </template>
                <p v-else class="print-help">{{ refineMode === 'color' ? t('Click a connected color region on the model, then choose a filament. Shift-click to multi-select.', '点击模型上的连续同色色块，再选耗材。Shift 点击可多选。') : t('Choose a filament, then paint on the model.', '选择耗材后，在模型上涂抹改色。') }}</p>
                <div v-if="refineMode !== 'brush' && studio.selection.length" class="refine-selection-info"><span>{{ refineMode === 'uv' ? t(`${studio.selectionIslandCount} islands selected`, `已选 ${studio.selectionIslandCount} 个 UV 岛`) : t(`${studio.selection.length} faces selected`, `已选 ${studio.selection.length} 个面`) }}</span><button type="button" @click="studio.clearSelection">{{ t('Clear', '清空') }}</button><small>{{ studio.selectionMaterial?.name ?? t('Mixed filaments', '混合耗材') }}</small></div>
                <p v-if="refineMode !== 'brush' && !studio.selection.length" class="print-help">{{ t('Select a region to enable filament assignment.', '先选择区域，再点击下方耗材整块改色。') }}</p>
                <div class="refine-filaments"><button v-for="item in planFilaments" :key="item.material.id" type="button" :disabled="studio.busy || (refineMode !== 'brush' && (!studio.selection.length || studio.settings.tool !== 'select'))" :class="{ active: (refineMode === 'brush' ? studio.selected : studio.selectionMaterial)?.id === item.material.id }" @click="chooseRefineFilament(item.indices[0]!)"><i :style="{ background: item.material.hex }" /><span>{{ item.material.name }}</span></button></div>
                <button v-if="studio.settings.tool === 'orbit'" class="print-secondary" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" @click="startRefine(refineMode)">{{ t('Continue editing', '继续精修') }}</button>
              </template>
            </section>
          </div>
          <footer class="prep-editor-footer">
            <template v-if="studio.preparation.origin === 'print'">
              <p>{{ studio.prepSaving ? '正在保存…' : studio.prepSaveError ? '草稿保存失败，请重试' : studio.prepDirty ? '草稿待保存' : '草稿已保存 · 完成后确认分色' }}</p>
              <button v-if="studio.prepSaveError" class="prep-editor-back" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing" @click="studio.savePreparation">重试保存</button>
              <button class="print-primary" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="studio.completePrintColors">完成并返回打印准备</button>
            </template>
            <button v-else class="prep-editor-back prep-editor-forward" type="button" :disabled="studio.busy || segmentation.busy || segmentation.editing || !studio.content" @click="navigateModule('print')">前往打印准备 →</button>
          </footer>
          <div v-if="filamentPopover" class="filament-popover">
            <div class="popover-heading"><strong>{{ filamentPopover === 'library' ? t('My filaments', '我的耗材') : t('Replace filament', '替换耗材') }}</strong><button type="button" @click="filamentPopover = null">×</button></div>
            <template v-if="filamentPopover === 'library'"><p class="print-help">{{ t('Save the filaments you already own.', '保存你已有的耗材。') }}</p><div v-if="ownedMaterials.length" class="stock-list"><div v-for="material in ownedMaterials" :key="material.id" class="stock-row"><i :style="{ background: material.hex }" /><span>{{ material.name }}<small>{{ material.materialId }}</small></span><button type="button" @click="removeOwned(material)">×</button></div></div><div class="refine-tabs"><button type="button" :class="{ active: filamentEntry === 'sku' }" @click="filamentEntry = 'sku'">By SKU</button><button type="button" :class="{ active: filamentEntry === 'color' }" @click="filamentEntry = 'color'">By color</button></div><template v-if="filamentEntry === 'sku'"><input v-model="filamentQuery" class="popover-input" placeholder="e.g. PLA-001"><button v-for="material in searchedFilaments" :key="material.id" type="button" class="search-choice" @click="addOwned(material)"><i :style="{ background: material.hex }" /><span>{{ material.name }}<small>{{ material.materialId }}</small></span><b>+</b></button></template><template v-else><input v-model="filamentColor" class="popover-input" type="color"><button class="print-secondary" type="button" @click="addClosestColor">+ Add filament</button></template><button class="popover-done" type="button" @click="filamentPopover = null">Done</button></template>
            <template v-else><p class="print-help">{{ t('Replace this filament in all assigned regions.', '替换所有使用该耗材的分区。') }}</p><button v-for="item in studio.allMaterials.slice(0, 8)" :key="item.id" type="button" class="search-choice" @click="replacePlanMaterial(item)"><i :style="{ background: item.hex }" /><span>{{ item.name }}<small>{{ item.materialId }}</small></span></button></template>
          </div>
          <div v-if="pendingRegenerate" class="regenerate-dialog"><strong>{{ t('Replace your refinements?', '重新分色会替换精修结果？') }}</strong><p>{{ t('Generating a new color plan resets brush and UV edits.', '重新生成分色方案会重置画笔和 UV 精修。') }}</p><button type="button" class="print-primary" @click="confirmGenerate">{{ t('Regenerate plan', '重新分色') }}</button><button type="button" class="popover-done" @click="pendingRegenerate = false">{{ t('Keep editing', '继续编辑') }}</button></div>
        </section>
      </aside>

      <section class="studio-viewer-shell">
        <div ref="canvasArea" class="studio-viewer">
          <ClientOnly><ModelViewport v-show="!inSegment" ref="viewport" :content="studio.content" :display="studio.display" :surfaces="studio.surfaces" :settings="studio.settings" :validation-surface="studio.validationSurface" :selection="studio.selection" :busy="studio.busy" @select="studio.selectRefinement" @error="studio.report" @stroke="studio.stroke" @fill="studio.fill" /></ClientOnly>
          <ClientOnly><SegmentViewport v-if="inSegment && studio.content" :key="studio.content.id" :content="studio.content" :seg="segmentation" /></ClientOnly>
          <template v-if="!inSegment">
          <div class="viewer-mode-bar">
            <span>{{ t('Workspace', '工作台') }} <i>/</i> {{ t('Material preview', '材质预览') }}</span>
            <div class="studio-segmented viewer-modes"><ModuleTooltip v-for="mode in (['original', 'print', 'compare'] as const)" :key="mode" :title="modeTitle(mode)" :description="modeDescription(mode)" side="bottom"><button type="button" :class="{ active: studio.settings.mode === mode }" @click="studio.settings.mode = mode">{{ mode === 'original' ? t('Original', '原模型') : mode === 'print' ? t('Material', '材质') : t('Compare', '对比') }}</button></ModuleTooltip></div>
          </div>
          <div class="model-caption"><span>{{ studio.settings.workflow === 'validation' ? 'MATERIAL VALIDATION' : studio.scheme === 'high' ? 'SURFACE COLOR' : 'UV COLOR' }}</span><strong>{{ studio.project?.name }}</strong><small v-if="studio.modelInfo">{{ studio.modelInfo.nf.toLocaleString() }} {{ t('triangles', '三角面') }} · {{ studio.settings.height }} mm</small></div>

          <ModuleTooltip v-if="studio.settings.mode === 'compare'" :title="t('Compare divider', '对比分割线')" :description="t('Drag left or right to compare the source model and material preview. The split is kept between 20% and 80%.', '向左或向右拖动，比较原模型与材质预览。分割位置限制在 20% 到 80%。')" side="bottom"><div class="compare-divider" :style="{ left: `${studio.settings.compareSplit * 100}%` }" role="slider" aria-label="Compare split" :aria-valuenow="Math.round(studio.settings.compareSplit * 100)" aria-valuemin="20" aria-valuemax="80" tabindex="0" @pointerdown="startCompareDrag" @pointermove="updateCompareSplit" @pointerup="stopCompareDrag" @pointercancel="stopCompareDrag"><span>{{ t('Original', '原模型') }}</span><i /><span>{{ t('Material', '材质') }}</span></div></ModuleTooltip>

          <div class="viewer-gizmo">
            <Popover>
              <PopoverTrigger class="gizmo-button"><Tooltip><TooltipTrigger><Icon icon="i-tripo:env" /></TooltipTrigger><TooltipContent side="left">{{ t('Environment', '环境光') }}</TooltipContent></Tooltip></PopoverTrigger>
              <PopoverContent side="left" align="start" :side-offset="16" class="environment-panel">
                <div class="environment-heading"><span>{{ t('Environment', '环境光') }}</span><PopoverClose><Icon icon="i-tripo:close" /></PopoverClose></div>
                <div class="environment-preview"><span>{{ studio.settings.preview?.preset === 'validation-v1' ? t('FIXED VALIDATION', '固定验证环境') : 'STUDIO' }}</span></div>
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
          <ModuleTooltip :title="t('Fit model', '适配视口')" :description="t('Center the model and reset the camera distance.', '将模型居中并重置相机距离。')" side="left">
            <button class="viewer-fit" type="button" @click="viewport?.fit()"><Icon icon="i-tripo:fit" /></button>
          </ModuleTooltip>
          <div v-if="studio.busy" class="progress-card" role="status"><span class="spinner" /><strong>{{ t('Processing model', '正在处理模型') }}</strong><small>{{ studio.status }}</small><div class="progress-track"><i :style="{ width: `${Math.max(5, studio.progress * 100)}%` }" /></div></div>
          <div v-if="studio.failure" role="alert" class="workspace-error"><span>{{ studio.failure }}</span><button type="button" aria-label="Dismiss error" @click="studio.failure = ''"><Icon icon="i-tripo:close" /></button></div>
          <details v-if="studio.warnings.length" class="warnings"><summary>{{ studio.warnings.length }} {{ t('import notes', '条导入提示') }}</summary><p v-for="warning in studio.warnings" :key="warning">{{ warning }}</p></details>

          <div class="print-toolbar" :class="{ editing: studio.settings.tool !== 'orbit' }">
            <template v-if="studio.settings.tool === 'orbit'"><span class="toolbar-pill"><Icon icon="i-tripo:columns-2" />{{ t('Compare', '对比') }}</span><span class="toolbar-divider" /><span class="toolbar-label"><Icon icon="i-tripo:circle-dot" />{{ t('Filament appearance', '耗材效果') }}</span><span class="toolbar-divider" /><button class="toolbar-icon" type="button" :title="t('Preview information', '预览信息')">i</button></template>
            <template v-else-if="refineMode === 'brush'"><button class="toolbar-tool active" type="button" @click="studio.settings.tool = 'brush'"><Icon icon="i-tripo:paintbrush" />{{ t('Brush', '画笔') }}</button><button class="toolbar-chip" type="button" @click="refineExpanded = true">● {{ studio.selected?.name ?? t('Choose filament', '选择耗材') }}</button><label class="toolbar-size">{{ t('Size', '大小') }}<input v-model.number="studio.settings.radius" type="range" min="0.2" max="12" step="0.2"></label><button class="toolbar-icon" type="button" :disabled="studio.busy || !studio.undoCount" @click="studio.undo">↶</button><button class="toolbar-done" type="button" @click="finishRefine">{{ t('Done', '完成') }}</button></template>
            <template v-else><span class="toolbar-label"><Icon icon="i-tripo:cursor" />{{ refineMode === 'color' ? t('Color region', '色块选择') : studio.selectionScope === 'part' ? t('Connected part', '独立部件') : t('UV island', 'UV 岛') }}</span><span class="toolbar-label">{{ t(`${studio.selection.length} faces`, `${studio.selection.length} 个面`) }}</span><button class="toolbar-icon" type="button" :disabled="studio.busy || !studio.undoCount" :title="t('Undo', '撤销')" @click="studio.undo">↶</button><button class="toolbar-chip" type="button" :disabled="!studio.selection.length" @click="studio.clearSelection">{{ t('Clear', '清空选择') }}</button><button class="toolbar-done" type="button" @click="finishRefine">{{ t('Done', '完成') }}</button></template>
          </div>
          </template>
        </div>
      </section>

      <aside class="studio-right-shell" aria-hidden="true"><div class="studio-history-placeholder" /></aside>
    </div>
    <div v-if="inviteDialog" class="print-invite-veil"><section class="print-invite"><div class="invite-icon"><Icon icon="i-tripo:segmentation" /></div><h2>{{ t('Print with what you own', '使用已有耗材打印') }}</h2><p>{{ t('Add your existing filaments by SKU or color. We will use compatible, close matches first.', '按 SKU 或颜色录入现有耗材，分色时会优先使用兼容的相近颜色。') }}</p><button type="button" class="print-primary" @click="dismissInvite(true)">{{ t('Add my filaments', '录入我的耗材') }}</button><button type="button" class="popover-done" @click="dismissInvite()">{{ t('Skip for now', '暂时跳过') }}</button></section></div>
  </main>
</template>

<style scoped>
.prep-editor-back-row{padding:0 20px 10px;flex:none}.prep-editor-footer{margin-top:auto;padding:12px 20px 16px;border-top:1px solid #ffffff14;flex:none}.prep-editor-back{display:block;border:0;background:none;color:#c5c6cb;font-size:11px;padding:5px 0 8px;cursor:pointer}.prep-editor-back:disabled{opacity:.45;cursor:not-allowed}.prep-editor-footer .print-primary{min-height:34px;font-size:11px}.prep-editor-footer p{font-size:10px;color:#94959c;line-height:1.5;margin:0 0 8px}.prep-editor-forward{width:100%;padding:8px 0;text-align:center}.prep-editor-back:focus-visible{outline:2px solid #ffd400;outline-offset:3px}
</style>
