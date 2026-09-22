<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { Icon, Popover, PopoverClose, PopoverContent, PopoverTrigger, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip, TooltipContent, TooltipTrigger } from '@tripo3d/design';
import { useWorkspace } from '~/@feature/workspace';
import { useLocale } from '~/@base/locale';
import { ModelViewport } from '~/@engine/viewer';
import { MaterialPanel } from '~/@feature/materials';
import ModuleTooltip from '~/@base/ui/ModuleTooltip.vue';

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
        <ModuleTooltip :title="t('Language', '语言')" :description="t('Switch the workspace labels between English and Chinese.', '切换工作台的中英文显示。')" side="bottom">
          <button class="header-language" type="button" @click="locale.toggle">{{ locale.language === 'zh' ? '中 / EN' : 'EN / 中' }}</button>
        </ModuleTooltip>
        <ModuleTooltip :title="t('Save project', '保存项目')" :description="t('Save the model, region assignments and material references locally.', '保存模型、区域分配和材质引用到本地。')" side="bottom">
          <button class="header-action" type="button" :disabled="studio.busy || !studio.content" @click="studio.save">{{ t('Save', '保存') }}</button>
        </ModuleTooltip>
        <ModuleTooltip :title="t('Export 3MF', '导出 3MF')" :description="t('Export the colored model with millimeter scale and material metadata.', '导出带颜色区域、毫米尺寸和材质参数的模型。')" side="bottom">
          <button class="header-export" type="button" :disabled="studio.busy || !studio.display" @click="studio.export3mf"><Icon icon="i-tripo:download" class="size-3.5" />{{ t('Export', '导出') }}</button>
        </ModuleTooltip>
      </div>
    </header>

    <div class="studio-body">
      <aside class="studio-left-shell">
        <nav class="studio-left-menu" aria-label="Studio tools">
          <ModuleTooltip :title="t('Model', '模型')" :description="t('Import and inspect the source model before assigning print materials.', '导入并检查源模型，再分配打印材质。')">
            <button class="studio-menu-item active" type="button"><Icon icon="i-tripo:generate" /><span>{{ t('Model', '模型') }}</span></button>
          </ModuleTooltip>
          <ModuleTooltip :title="t('Segment', '分色')" :description="t('Generate editable surface or UV regions for multicolor printing.', '生成可编辑的表面或 UV 分色区域，用于多色打印。')">
            <button class="studio-menu-item" type="button"><Icon icon="i-tripo:segmentation" /><span>{{ t('Segment', '分色') }}</span></button>
          </ModuleTooltip>
          <ModuleTooltip :title="t('Texture', '贴图')" :description="t('Review source textures and PBR information carried by the model.', '查看模型携带的贴图和 PBR 信息。')">
            <button class="studio-menu-item" type="button"><Icon icon="i-tripo:texture" /><span>{{ t('Texture', '贴图') }}</span></button>
          </ModuleTooltip>
          <ModuleTooltip :title="t('Retopo', '重拓扑')" :description="t('Inspect mesh density and topology before preparing the print.', '在准备打印前检查网格密度和拓扑。')">
            <button class="studio-menu-item" type="button"><Icon icon="i-tripo:remesh" /><span>{{ t('Retopo', '重拓扑') }}</span></button>
          </ModuleTooltip>
          <span class="studio-menu-spacer" />
          <span class="studio-local-state"><i />LOCAL</span>
        </nav>

        <section class="studio-left-panel">
          <div class="studio-panel-title">
            <Icon icon="i-tripo:segmentation" class="size-4" />
            <h1>{{ t('Multicolor print', '多色打印') }}</h1>
          </div>
          <div class="studio-panel-scroll">
            <ModuleTooltip :title="t('Import model', '导入模型')" :description="t('Upload a Tripo GLB or FBX. Select matching FBX textures at the same time.', '上传 Tripo 生成的 GLB 或 FBX；FBX 贴图请同时选择。')" side="right">
              <button class="studio-upload" type="button" :disabled="studio.busy" @click="upload?.click()">
                <Icon icon="i-tripo:upload" class="size-6" />
                <strong>{{ t('Import model', '导入模型') }}</strong>
                <small>GLB, FBX · {{ t('drag and drop', '拖拽上传') }}</small>
              </button>
            </ModuleTooltip>
            <input ref="upload" class="hidden-input" type="file" multiple accept=".glb,.fbx,.png,.jpg,.jpeg,.webp,.tga,.bmp" @change="uploadFiles">
            <p class="studio-help">{{ t('Select FBX textures together.', 'FBX 配套贴图请一起选择。') }}</p>

            <section class="studio-section">
              <div class="studio-section-heading"><span>01</span><h2>{{ t('Color regions', '颜色区域') }}</h2></div>
              <p class="studio-section-description">{{ t('Choose a region method, set the color count and generate editable assignments.', '选择分区方式和颜色数量，生成可编辑的材质分配区域。') }}</p>
              <div class="studio-segmented">
                <ModuleTooltip :title="t('Surface regions', '表面分色')" :description="t('Assign colors by connected mesh faces. This works without UVs and keeps geometric boundaries.', '按连通网格面分配颜色。不依赖 UV，并保留几何边界。')" side="right">
                  <button type="button" :class="{ active: studio.scheme === 'high' }" :disabled="studio.busy" @click="studio.changeScheme('high')">{{ t('Surface', '表面') }}</button>
                </ModuleTooltip>
                <ModuleTooltip :title="t('UV regions', 'UV 分色')" :description="t('Assign colors from the baseColor texture through UVs. Textured models are required.', '通过 UV 读取 baseColor 贴图并分配颜色。需要带贴图的模型。')" side="right">
                  <button type="button" :class="{ active: studio.scheme === 'low' }" :disabled="studio.busy" @click="studio.changeScheme('low')">{{ t('UV', 'UV') }}</button>
                </ModuleTooltip>
              </div>
              <ModuleTooltip :title="t('Color count', '颜色数')" :description="t('Number of available material slots, from 1 to 12. More colors preserve more sampled color groups.', '可用材质槽数量，范围为 1 到 12。颜色越多，保留的采样颜色区域越多。')" side="right">
                <label class="studio-range"><span>{{ t('Colors', '颜色数') }}<b>{{ studio.colorCount }}</b></span><input v-model.number="studio.colorCount" type="range" min="1" max="12" :disabled="studio.busy"></label>
              </ModuleTooltip>
              <ModuleTooltip :title="t('Region detail', '区域细节')" :description="t('Controls small-region cleanup and edge preservation. Higher values keep finer patches but may create more small regions.', '控制小区域清理和边缘保留。数值越高越保留细节，也可能产生更多小区域。')" side="right">
                <label class="studio-range"><span>{{ t('Detail', '细节') }}<b>{{ studio.precision }}/6</b></span><input v-model.number="studio.precision" type="range" min="1" max="6" :disabled="studio.busy"></label>
              </ModuleTooltip>
              <ModuleTooltip :title="t('Generate regions', '生成分色')" :description="t('Analyze baseColor, vertex color or UV samples and assign them to the selected material slots. Viewer lighting is not used.', '分析 baseColor、顶点色或 UV 采样，并分配到材质槽。不会使用 Viewer 光照。')" side="right">
                <button class="studio-primary" type="button" :disabled="studio.busy || !studio.content" @click="studio.segment"><Icon icon="i-tripo:magic" class="size-4" />{{ t('Generate regions', '生成分色') }}</button>
              </ModuleTooltip>
            </section>

            <section class="studio-section">
              <div class="studio-section-heading"><span>02</span><h2>{{ t('Print appearance', '打印外观') }}</h2></div>
              <p class="studio-section-description">{{ t('Set the physical height and toggle the layer texture used in the preview.', '设置打印高度，并控制预览中的层纹效果。') }}</p>
              <ModuleTooltip :title="t('Print height', '打印高度')" :description="t('Physical model height in millimeters. The preview and 3MF export use the same scale.', '模型打印高度，单位为毫米。预览和 3MF 导出使用同一比例。')" side="right">
                <label class="studio-field-row"><span>{{ t('Print height', '打印高度') }}</span><span class="studio-number"><input :value="studio.settings.height" type="number" min="10" max="320" @change="heightChanged">mm</span></label>
              </ModuleTooltip>
              <ModuleTooltip :title="t('Layer texture', '层纹效果')" :description="t('Shows or hides the visual layer shader in the preview. It does not change region labels or print data.', '显示或隐藏预览中的层纹 shader。不改变区域标签或打印数据。')" side="right">
                <label class="studio-field-row"><span>{{ t('Layer texture', '层纹效果') }}</span><input v-model="studio.settings.layers" class="studio-switch" type="checkbox" role="switch"></label>
              </ModuleTooltip>
            </section>

            <details class="studio-projects">
              <ModuleTooltip :title="t('Projects & backups', '项目与备份')" :description="t('Projects stay in this browser. Backups include the model files, region labels and material assignments.', '项目保存在当前浏览器。备份包含模型文件、区域标签和材质分配。')" side="right">
                <summary>{{ t('Projects & backups', '项目与备份') }}<Icon icon="i-tripo:caret" class="size-3 rotate-180" /></summary>
              </ModuleTooltip>
              <p class="studio-section-description">{{ t('Reopen a local project or restore a backup without uploading model data.', '重新打开本地项目，或恢复备份，不上传模型数据。') }}</p>
              <ModuleTooltip :title="t('Open sample', '打开示例')" :description="t('Load the bundled Atelier model to try the workflow without selecting files.', '打开内置 Atelier 示例模型，无需选择文件即可体验流程。')" side="right">
                <button type="button" :disabled="studio.busy" @click="studio.demo">{{ t('Open sample', '打开示例') }}</button>
              </ModuleTooltip>
              <ModuleTooltip v-for="item in studio.projects" :key="item.id" :title="t('Open saved project', '打开已保存项目')" :description="t('Restore this project from IndexedDB, including its model and region assignments.', '从 IndexedDB 恢复此项目，包括模型和区域分配。')" side="right">
                <button type="button" :disabled="studio.busy" @click="studio.openProject(item.id)">{{ item.name }}</button>
              </ModuleTooltip>
              <div class="studio-button-row">
                <ModuleTooltip :title="t('Backup project', '备份项目')" :description="t('Download a ZIP with the model files, materials and current region labels.', '下载包含模型文件、材质和当前区域标签的 ZIP。')" side="right">
                  <button type="button" :disabled="studio.busy || !studio.content" @click="studio.backup">{{ t('Backup', '备份') }}</button>
                </ModuleTooltip>
                <ModuleTooltip :title="t('Restore backup', '恢复备份')" :description="t('Import a previously downloaded project ZIP and continue editing locally.', '导入之前下载的项目 ZIP，继续本地编辑。')" side="right">
                  <button type="button" :disabled="studio.busy" @click="restore?.click()">{{ t('Restore', '恢复') }}</button>
                </ModuleTooltip>
              </div>
              <ModuleTooltip :title="t('3MF self-test', '3MF 自检')" :description="t('Download a four-color validation file to check the color-slot encoding.', '下载四色验证文件，检查色槽编码是否正确。')" side="right">
                <button type="button" :disabled="studio.busy || !studio.content" @click="studio.selftest">{{ t('3MF self-test', '3MF 自检') }}</button>
              </ModuleTooltip>
            </details>
            <input ref="restore" class="hidden-input" type="file" accept=".zip" @change="restoreFiles">
          </div>
        </section>
      </aside>

      <section class="studio-viewer-shell">
        <div ref="canvasArea" class="studio-viewer">
          <ClientOnly><ModelViewport ref="viewport" :content="studio.content" :display="studio.display" :surfaces="studio.surfaces" :settings="studio.settings" @error="studio.report" /></ClientOnly>
          <div class="viewer-mode-bar">
            <span>{{ t('Workspace', '工作台') }} <i>/</i> {{ t('Material preview', '材质预览') }}</span>
            <div class="studio-segmented viewer-modes"><ModuleTooltip v-for="mode in (['original', 'print', 'compare'] as const)" :key="mode" :title="modeTitle(mode)" :description="modeDescription(mode)" side="bottom"><button type="button" :class="{ active: studio.settings.mode === mode }" @click="studio.settings.mode = mode">{{ mode === 'original' ? t('Original', '原模型') : mode === 'print' ? t('Material', '材质') : t('Compare', '对比') }}</button></ModuleTooltip></div>
          </div>
          <div class="model-caption"><span>{{ studio.scheme === 'high' ? 'SURFACE COLOR' : 'UV COLOR' }}</span><strong>{{ studio.project?.name }}</strong><small v-if="studio.modelInfo">{{ studio.modelInfo.nf.toLocaleString() }} {{ t('triangles', '三角面') }} · {{ studio.settings.height }} mm</small></div>

          <ModuleTooltip v-if="studio.settings.mode === 'compare'" :title="t('Compare divider', '对比分割线')" :description="t('Drag left or right to compare the source model and material preview. The split is kept between 20% and 80%.', '向左或向右拖动，比较原模型与材质预览。分割位置限制在 20% 到 80%。')" side="bottom"><div class="compare-divider" :style="{ left: `${studio.settings.compareSplit * 100}%` }" role="slider" aria-label="Compare split" :aria-valuenow="Math.round(studio.settings.compareSplit * 100)" aria-valuemin="20" aria-valuemax="80" tabindex="0" @pointerdown="startCompareDrag" @pointermove="updateCompareSplit" @pointerup="stopCompareDrag" @pointercancel="stopCompareDrag"><span>{{ t('Original', '原模型') }}</span><i /><span>{{ t('Material', '材质') }}</span></div></ModuleTooltip>

          <div class="viewer-gizmo">
            <Popover>
              <PopoverTrigger class="gizmo-button"><Tooltip><TooltipTrigger><Icon icon="i-tripo:env" /></TooltipTrigger><TooltipContent side="left">{{ t('Environment', '环境光') }}</TooltipContent></Tooltip></PopoverTrigger>
              <PopoverContent side="left" align="start" :side-offset="16" class="environment-panel">
                <div class="environment-heading"><span>{{ t('Environment', '环境光') }}</span><PopoverClose><Icon icon="i-tripo:close" /></PopoverClose></div>
                <div class="environment-preview"><span>{{ environment.toUpperCase() }}</span></div>
                <ModuleTooltip :title="t('Environment preset', '环境预设')" :description="t('Choose the studio lighting preset used by the viewer. It changes appearance only, not color segmentation.', '选择 Viewer 使用的环境光预设。它只改变显示效果，不参与分色。')" side="left"><label>{{ t('Surrounding', '环境') }}<select v-model="environment"><option value="studio">Studio</option><option value="beach">Beach</option><option value="forest">Forest</option><option value="night">Night</option></select></label></ModuleTooltip>
                <ModuleTooltip :title="t('Environment strength', '环境光强度')" :description="t('Adjust the brightness of the preview environment. This value is visual only and is not exported as material data.', '调整预览环境的亮度。该值只影响显示，不会导出为材质数据。')" side="left"><label>{{ t('Strength', '强度') }}<input type="range" min="0" max="2" step="0.05" value="1"></label></ModuleTooltip>
                <ModuleTooltip :title="t('Environment rotation', '环境光旋转')" :description="t('Rotate the environment lighting around the model. It does not change baseColor or region assignments.', '旋转模型周围的环境光。不会改变 baseColor 或区域分配。')" side="left"><label>{{ t('Rotation', '旋转') }}<input type="range" min="0" max="360" value="0"></label></ModuleTooltip>
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

          <section class="region-tray"><div class="tray-heading"><div><span>COLOR ASSIGNMENT</span><h3>{{ t('A material for every region.', '为每个区域赋予材质') }}</h3></div><strong>{{ studio.regions.length.toString().padStart(2, '0') }} <small>{{ t('regions', '区域') }}</small></strong></div><div class="region-list"><ModuleTooltip v-for="region in studio.regions" :key="region.index" :title="t('Region material', '区域材质')" :description="t('Select this region to edit or apply a material. The color chip shows its current HEX value.', '选择此区域后可以编辑或应用材质。颜色块显示当前 HEX 值。')" side="top"><button class="region-slot" :class="{ active: studio.selectedRegion === region.index }" type="button" @click="studio.selectedRegion = region.index"><span class="region-chip" :style="{ background: region.material.hex }"><b>{{ (region.index + 1).toString().padStart(2, '0') }}</b><i v-if="studio.selectedRegion === region.index">✓</i></span><strong>{{ region.material.name }}</strong><small>{{ region.material.hex }}</small></button></ModuleTooltip></div></section>
        </div>
      </section>

      <aside class="studio-right-shell">
        <Tabs :model-value="rightTab" class="studio-right-tabs" @update:model-value="rightTab = String($event)">
          <TabsList class="studio-right-tab-list"><ModuleTooltip :title="t('Assets', '资产')" :description="t('Manage material records, apply them to regions and export value tables.', '管理材质档案，将材质应用到区域，并导出数值表。')" side="top"><TabsTrigger value="assets"><Icon icon="i-tripo:assets" /><span>{{ t('Assets', '资产') }}</span></TabsTrigger></ModuleTooltip><ModuleTooltip :title="t('Properties', '属性')" :description="t('Inspect the selected region and its current material parameters.', '查看当前区域及其材质参数。')" side="top"><TabsTrigger value="properties"><Icon icon="i-tripo:properties" /><span>{{ t('Property', '属性') }}</span></TabsTrigger></ModuleTooltip></TabsList>
          <TabsContent value="assets" class="studio-right-content"><MaterialPanel :materials="studio.materials" :selected="studio.selected" :checked="studio.checked" :busy="studio.busy" :save-material="studio.saveMaterial" @apply="studio.apply" @preview="studio.draft = $event" @check="check" @export="studio.exportMaterials" /></TabsContent>
          <TabsContent value="properties" class="studio-right-content"><div class="properties-panel"><div class="properties-heading"><Icon icon="i-tripo:properties" /><span>{{ t('Material properties', '材质属性') }}</span></div><p>{{ t('Select a region to inspect its current assignment.', '选择一个区域查看当前材质。') }}</p><dl v-if="studio.selected"><ModuleTooltip :title="t('Material ID', '材质 ID')" :description="t('Stable user-facing identifier for exports and material references.', '导出和材质引用使用的稳定用户标识。')" side="left"><div><dt>{{ t('Material ID', '材质 ID') }}</dt><dd>{{ studio.selected.materialId }}</dd></div></ModuleTooltip><ModuleTooltip :title="t('Display color', '展示颜色')" :description="t('Saved sRGB HEX value. It is the source color for the region preview.', '已保存的 sRGB HEX 值，是区域预览使用的源颜色。')" side="left"><div><dt>{{ t('Color', '颜色') }}</dt><dd>{{ studio.selected.hex }}</dd></div></ModuleTooltip><ModuleTooltip :title="t('Transparency', '透明度')" :description="t('Preview opacity is 1 minus transparency. This is a display parameter.', '预览不透明度等于 1 减透明度。这是显示参数。')" side="left"><div><dt>{{ t('Transparency', '透明度') }}</dt><dd>{{ studio.selected.transparency.toFixed(2) }}</dd></div></ModuleTooltip><ModuleTooltip :title="t('Metalness', '金属度')" :description="t('Preview metallic response from 0 non-metallic to 1 fully metallic.', '预览金属反射，0 为非金属，1 为完全金属。')" side="left"><div><dt>{{ t('Metalness', '金属度') }}</dt><dd>{{ studio.selected.metalness.toFixed(2) }}</dd></div></ModuleTooltip><ModuleTooltip :title="t('Roughness', '粗糙度')" :description="t('Input roughness value. Studio applies its effective roughness render rule before display.', '输入粗糙度值。Studio 显示前会应用最终粗糙度渲染规则。')" side="left"><div><dt>{{ t('Roughness', '粗糙度') }}</dt><dd>{{ studio.selected.roughness.toFixed(2) }}</dd></div></ModuleTooltip></dl></div></TabsContent>
        </Tabs>
      </aside>
    </div>
  </main>
</template>
