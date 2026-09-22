<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { Icon, Popover, PopoverClose, PopoverContent, PopoverTrigger, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip, TooltipContent, TooltipTrigger } from '@tripo3d/design';
import { useWorkspace } from '~/@feature/workspace';
import { useLocale } from '~/@base/locale';
import { ModelViewport } from '~/@engine/viewer';
import { MaterialPanel } from '~/@feature/materials';

const studio = useWorkspace();
const locale = useLocale();
const { t } = locale;
const upload = useTemplateRef<HTMLInputElement>('upload');
const restore = useTemplateRef<HTMLInputElement>('restore');
const viewport = useTemplateRef('viewport');
const canvasArea = useTemplateRef<HTMLDivElement>('canvasArea');
const compareDragging = ref(false);
const rightTab = ref('assets');
const environment = ref('studio');

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

function heightChanged(event: Event) {
  const input = event.target as HTMLInputElement;
  studio.setHeight(input.valueAsNumber);
  input.value = String(studio.settings.height);
}

function check(id: string) {
  studio.checked = studio.checked.includes(id) ? studio.checked.filter(value => value !== id) : [...studio.checked, id];
}

function shortcut(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') event.preventDefault();
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

onMounted(() => {
  locale.restore();
  void studio.initialize();
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
        <button class="header-language" type="button" @click="locale.toggle">{{ locale.language === 'zh' ? '中 / EN' : 'EN / 中' }}</button>
        <button class="header-action" type="button" :disabled="studio.busy || !studio.content" @click="studio.save">{{ t('Save', '保存') }}</button>
        <button class="header-export" type="button" :disabled="studio.busy || !studio.display" @click="studio.export3mf"><Icon icon="i-tripo:download" class="size-3.5" />{{ t('Export', '导出') }}</button>
      </div>
    </header>

    <div class="studio-body">
      <aside class="studio-left-shell">
        <nav class="studio-left-menu" aria-label="Studio tools">
          <button class="studio-menu-item active" type="button"><Icon icon="i-tripo:generate" /><span>{{ t('Model', '模型') }}</span></button>
          <button class="studio-menu-item" type="button"><Icon icon="i-tripo:segmentation" /><span>{{ t('Segment', '分色') }}</span></button>
          <button class="studio-menu-item" type="button"><Icon icon="i-tripo:texture" /><span>{{ t('Texture', '贴图') }}</span></button>
          <button class="studio-menu-item" type="button"><Icon icon="i-tripo:remesh" /><span>{{ t('Retopo', '重拓扑') }}</span></button>
          <span class="studio-menu-spacer" />
          <span class="studio-local-state"><i />LOCAL</span>
        </nav>

        <section class="studio-left-panel">
          <div class="studio-panel-title">
            <Icon icon="i-tripo:segmentation" class="size-4" />
            <h1>{{ t('Multicolor print', '多色打印') }}</h1>
          </div>
          <div class="studio-panel-scroll">
            <button class="studio-upload" type="button" :disabled="studio.busy" @click="upload?.click()">
              <Icon icon="i-tripo:upload" class="size-6" />
              <strong>{{ t('Import model', '导入模型') }}</strong>
              <small>GLB, FBX · {{ t('drag and drop', '拖拽上传') }}</small>
            </button>
            <input ref="upload" class="hidden-input" type="file" multiple accept=".glb,.fbx,.png,.jpg,.jpeg,.webp,.tga,.bmp" @change="uploadFiles">
            <p class="studio-help">{{ t('Select FBX textures together.', 'FBX 配套贴图请一起选择。') }}</p>

            <section class="studio-section">
              <div class="studio-section-heading"><span>01</span><h2>{{ t('Color regions', '颜色区域') }}</h2></div>
              <div class="studio-segmented">
                <button type="button" :class="{ active: studio.scheme === 'high' }" :disabled="studio.busy" @click="studio.changeScheme('high')">{{ t('Surface', '表面') }}</button>
                <button type="button" :class="{ active: studio.scheme === 'low' }" :disabled="studio.busy" @click="studio.changeScheme('low')">{{ t('UV', 'UV') }}</button>
              </div>
              <label class="studio-range"><span>{{ t('Colors', '颜色数') }}<b>{{ studio.colorCount }}</b></span><input v-model.number="studio.colorCount" type="range" min="1" max="12" :disabled="studio.busy"></label>
              <label class="studio-range"><span>{{ t('Detail', '细节') }}<b>{{ studio.precision }}/6</b></span><input v-model.number="studio.precision" type="range" min="1" max="6" :disabled="studio.busy"></label>
              <button class="studio-primary" type="button" :disabled="studio.busy || !studio.content" @click="studio.segment"><Icon icon="i-tripo:magic" class="size-4" />{{ t('Generate regions', '生成分色') }}</button>
            </section>

            <section class="studio-section">
              <div class="studio-section-heading"><span>02</span><h2>{{ t('Print appearance', '打印外观') }}</h2></div>
              <label class="studio-field-row"><span>{{ t('Print height', '打印高度') }}</span><span class="studio-number"><input :value="studio.settings.height" type="number" min="10" max="320" @change="heightChanged">mm</span></label>
              <label class="studio-field-row"><span>{{ t('Layer texture', '层纹效果') }}</span><input v-model="studio.settings.layers" class="studio-switch" type="checkbox" role="switch"></label>
            </section>

            <details class="studio-projects"><summary>{{ t('Projects & backups', '项目与备份') }}<Icon icon="i-tripo:caret" class="size-3 rotate-180" /></summary><button type="button" :disabled="studio.busy" @click="studio.demo">{{ t('Open sample', '打开示例') }}</button><button v-for="item in studio.projects" :key="item.id" type="button" :disabled="studio.busy" @click="studio.openProject(item.id)">{{ item.name }}</button><div class="studio-button-row"><button type="button" :disabled="studio.busy || !studio.content" @click="studio.backup">{{ t('Backup', '备份') }}</button><button type="button" :disabled="studio.busy" @click="restore?.click()">{{ t('Restore', '恢复') }}</button></div><button type="button" :disabled="studio.busy || !studio.content" @click="studio.selftest">{{ t('3MF self-test', '3MF 自检') }}</button></details>
            <input ref="restore" class="hidden-input" type="file" accept=".zip" @change="restoreFiles">
          </div>
        </section>
      </aside>

      <section class="studio-viewer-shell">
        <div ref="canvasArea" class="studio-viewer">
          <ClientOnly><ModelViewport ref="viewport" :content="studio.content" :display="studio.display" :surfaces="studio.surfaces" :settings="studio.settings" @error="studio.report" /></ClientOnly>
          <div class="viewer-mode-bar">
            <span>{{ t('Workspace', '工作台') }} <i>/</i> {{ t('Material preview', '材质预览') }}</span>
            <div class="studio-segmented viewer-modes"><button v-for="mode in (['original', 'print', 'compare'] as const)" :key="mode" type="button" :class="{ active: studio.settings.mode === mode }" @click="studio.settings.mode = mode">{{ mode === 'original' ? t('Original', '原模型') : mode === 'print' ? t('Material', '材质') : t('Compare', '对比') }}</button></div>
          </div>
          <div class="model-caption"><span>{{ studio.scheme === 'high' ? 'SURFACE COLOR' : 'UV COLOR' }}</span><strong>{{ studio.project?.name }}</strong><small v-if="studio.modelInfo">{{ studio.modelInfo.nf.toLocaleString() }} {{ t('triangles', '三角面') }} · {{ studio.settings.height }} mm</small></div>

          <div v-if="studio.settings.mode === 'compare'" class="compare-divider" :style="{ left: `${studio.settings.compareSplit * 100}%` }" role="slider" aria-label="Compare split" :aria-valuenow="Math.round(studio.settings.compareSplit * 100)" aria-valuemin="20" aria-valuemax="80" tabindex="0" @pointerdown="startCompareDrag" @pointermove="updateCompareSplit" @pointerup="stopCompareDrag" @pointercancel="stopCompareDrag"><span>{{ t('Original', '原模型') }}</span><i /><span>{{ t('Material', '材质') }}</span></div>

          <div class="viewer-gizmo">
            <Popover>
              <PopoverTrigger class="gizmo-button"><Tooltip><TooltipTrigger><Icon icon="i-tripo:env" /></TooltipTrigger><TooltipContent side="left">{{ t('Environment', '环境光') }}</TooltipContent></Tooltip></PopoverTrigger>
              <PopoverContent side="left" align="start" :side-offset="16" class="environment-panel">
                <div class="environment-heading"><span>{{ t('Environment', '环境光') }}</span><PopoverClose><Icon icon="i-tripo:close" /></PopoverClose></div>
                <div class="environment-preview"><span>{{ environment.toUpperCase() }}</span></div>
                <label>{{ t('Surrounding', '环境') }}<select v-model="environment"><option value="studio">Studio</option><option value="beach">Beach</option><option value="forest">Forest</option><option value="night">Night</option></select></label>
                <label>{{ t('Strength', '强度') }}<input type="range" min="0" max="2" step="0.05" value="1"></label>
                <label>{{ t('Rotation', '旋转') }}<input type="range" min="0" max="360" value="0"></label>
              </PopoverContent>
            </Popover>
            <span class="gizmo-divider" />
            <Tooltip><TooltipTrigger as-child><button class="gizmo-button" type="button" :title="t('Reset camera', '重置相机')" @click="viewport?.fit()"><Icon icon="i-tripo:camera-reset" /></button></TooltipTrigger><TooltipContent side="left">{{ t('Reset camera', '重置相机') }}</TooltipContent></Tooltip>
            <span class="gizmo-divider" />
            <Tooltip><TooltipTrigger as-child><button class="gizmo-button" type="button" :class="{ active: studio.settings.grid }" @click="studio.settings.grid = !studio.settings.grid"><Icon :icon="studio.settings.grid ? 'i-tripo:line-visible' : 'i-tripo:line-invisible'" /></button></TooltipTrigger><TooltipContent side="left">{{ t('Grid', '网格') }}</TooltipContent></Tooltip>
          </div>
          <button class="viewer-fit" type="button" :title="t('Fit model', '适配视口')" @click="viewport?.fit()"><Icon icon="i-tripo:fit" /></button>
          <div v-if="studio.busy" class="progress-card" role="status"><span class="spinner" /><strong>{{ t('Processing model', '正在处理模型') }}</strong><small>{{ studio.status }}</small><div class="progress-track"><i :style="{ width: `${Math.max(5, studio.progress * 100)}%` }" /></div></div>
          <div v-if="studio.failure" role="alert" class="workspace-error"><span>{{ studio.failure }}</span><button type="button" aria-label="Dismiss error" @click="studio.failure = ''"><Icon icon="i-tripo:close" /></button></div>
          <details v-if="studio.warnings.length" class="warnings"><summary>{{ studio.warnings.length }} {{ t('import notes', '条导入提示') }}</summary><p v-for="warning in studio.warnings" :key="warning">{{ warning }}</p></details>

          <section class="region-tray"><div class="tray-heading"><div><span>COLOR ASSIGNMENT</span><h3>{{ t('A material for every region.', '为每个区域赋予材质') }}</h3></div><strong>{{ studio.regions.length.toString().padStart(2, '0') }} <small>{{ t('regions', '区域') }}</small></strong></div><div class="region-list"><button v-for="region in studio.regions" :key="region.index" class="region-slot" :class="{ active: studio.selectedRegion === region.index }" type="button" @click="studio.selectedRegion = region.index"><span class="region-chip" :style="{ background: region.material.hex }"><b>{{ (region.index + 1).toString().padStart(2, '0') }}</b><i v-if="studio.selectedRegion === region.index">✓</i></span><strong>{{ region.material.name }}</strong><small>{{ region.material.hex }}</small></button></div></section>
        </div>
      </section>

      <aside class="studio-right-shell">
        <Tabs :model-value="rightTab" class="studio-right-tabs" @update:model-value="rightTab = String($event)">
          <TabsList class="studio-right-tab-list"><TabsTrigger value="assets"><Icon icon="i-tripo:assets" /><span>{{ t('Assets', '资产') }}</span></TabsTrigger><TabsTrigger value="properties"><Icon icon="i-tripo:properties" /><span>{{ t('Property', '属性') }}</span></TabsTrigger></TabsList>
          <TabsContent value="assets" class="studio-right-content"><MaterialPanel :materials="studio.materials" :selected="studio.selected" :checked="studio.checked" :busy="studio.busy" :save-material="studio.saveMaterial" @apply="studio.apply" @preview="studio.draft = $event" @check="check" @export="studio.exportMaterials" /></TabsContent>
          <TabsContent value="properties" class="studio-right-content"><div class="properties-panel"><div class="properties-heading"><Icon icon="i-tripo:properties" /><span>{{ t('Material properties', '材质属性') }}</span></div><p>{{ t('Select a region to inspect its current assignment.', '选择一个区域查看当前材质。') }}</p><dl v-if="studio.selected"><div><dt>{{ t('Material ID', '材质 ID') }}</dt><dd>{{ studio.selected.materialId }}</dd></div><div><dt>{{ t('Color', '颜色') }}</dt><dd>{{ studio.selected.hex }}</dd></div><div><dt>{{ t('Transparency', '透明度') }}</dt><dd>{{ studio.selected.transparency.toFixed(2) }}</dd></div><div><dt>{{ t('Metalness', '金属度') }}</dt><dd>{{ studio.selected.metalness.toFixed(2) }}</dd></div><div><dt>{{ t('Roughness', '粗糙度') }}</dt><dd>{{ studio.selected.roughness.toFixed(2) }}</dd></div></dl></div></TabsContent>
        </Tabs>
      </aside>
    </div>
  </main>
</template>

