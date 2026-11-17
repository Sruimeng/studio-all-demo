<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@tripo3d/design';
import { useLocale } from '~/@base/locale';
import type { BaseShape } from '~/@engine/base-processing';
import type { BaseProcessingController } from '../index';
import BaseBottomView from './BaseBottomView.vue';
import BaseColorPicker from './BaseColorPicker.vue';
import BaseStyleThumbnail from './BaseStyleThumbnail.vue';
const props = defineProps<{ tool: BaseProcessingController }>();
const tool = props.tool;
const { t } = useLocale();
const stats = computed(() => tool.result?.stats);
const fixed = (v: number) => Number(v.toFixed(2));
const categories = ['Basic', 'Display', 'Fantasy', 'Nature'] as const;
type Category = typeof categories[number] | 'Custom';
const category = ref<Category>('Basic');
const styleNames: Record<BaseShape, [string, string]> = {
  round: ['Round', '圆形'], square: ['Square', '方形'], hexagon: ['Hexagon', '六边形'],
  'black-disc': ['Disc', '圆盘'], 'white-cloud': ['Cloud', '云朵'], custom: ['Custom Base', '自定义底座'],
};
// These categories deliberately reuse the bundled styles until more assets are available.
const styles: Record<Category, BaseShape[]> = {
  Basic: ['round', 'white-cloud', 'square', 'hexagon'], Display: ['black-disc', 'square', 'round', 'white-cloud'],
  Fantasy: ['hexagon', 'black-disc', 'white-cloud', 'round'], Nature: ['white-cloud', 'round', 'black-disc', 'hexagon'], Custom: ['custom'],
};
const visibleStyles = computed(() => styles[category.value]);
const upload = useTemplateRef<HTMLInputElement>('upload');
const colorOpen = ref(false);
const baseColors = ['#ffffff', '#ffdb57', '#87cf9a', '#829efa', '#383a42'];
const customColor = computed(() => !tool.baseAssetOriginal && !baseColors.includes(tool.baseColor));
const rangeStyle = (value: number, min: number, max: number) => ({ '--progress': `${max > min ? Math.max(0, Math.min(100, (value - min) / (max - min) * 100)) : 0}%` });
function numberChanged(event: Event, kind: 'depth' | 'scale' | 'rotation') {
  const input = event.target as HTMLInputElement;
  const value = input.value.trim() ? Number(input.value) : NaN;
  if (kind === 'depth') tool.setDepthMM(value);
  if (kind === 'scale') tool.setBaseScale(value);
  if (kind === 'rotation') tool.setBaseRotationY(value);
  input.value = String(fixed(kind === 'depth' ? tool.depthMM : kind === 'scale' ? tool.baseScale : tool.baseRotationY));
}
function selectColor(color: string) { tool.setBaseColor(color); colorOpen.value = true; }
async function uploadBase(event: Event) {
  const input = event.target as HTMLInputElement, files = Array.from(input.files ?? []); input.value = '';
  if (!files.length) return;
  await tool.importCustomBase(files);
  if (!tool.customBaseError && tool.baseShape === 'custom') category.value = 'Custom';
}
watch(() => [tool.mode, tool.baseShape, tool.source], () => { colorOpen.value = false; });
</script>
<template>
  <section id="base-processing-panel" class="studio-left-panel base-panel">
    <header class="base-panel-heading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1 10h22M5 10l-3 5m8-5-3 5m8-5-3 5m8-5-3 5" /></svg><h1>{{ t('Base Processing', '底面处理') }}</h1></header>
    <nav class="base-mode-tabs" role="tablist" :aria-label="t('Base operation', '底面操作')">
      <button id="base-flatten-tab" type="button" role="tab" aria-controls="base-flatten-content" :aria-selected="tool.mode === 'flatten'" :class="{ active: tool.mode === 'flatten' }" :disabled="tool.busy" @click="tool.setMode('flatten')">{{ t('Flatten', '切平') }}</button>
      <button id="base-add-tab" type="button" role="tab" aria-controls="base-add-content" :aria-selected="tool.mode === 'add'" :class="{ active: tool.mode === 'add' }" :disabled="tool.busy" @click="tool.setMode('add')">{{ t('Add Base', '添加底座') }}</button>
    </nav>
    <div class="base-scroll">
      <div v-if="tool.mode === 'flatten'" id="base-flatten-content" role="tabpanel" aria-labelledby="base-flatten-tab">
        <div class="base-bottom-slot"><BaseBottomView :tool="tool" /></div>
        <fieldset :disabled="tool.busy || !tool.source">
          <section class="base-control-section">
            <label class="base-section-title" for="base-depth">{{ t('Cut depth', '切入深度') }}</label>
            <div class="base-slider-row">
              <input id="base-depth" class="base-range" type="range" :min="tool.depthMin" :max="tool.depthMax" step="any" :value="tool.depthMM" :style="rangeStyle(tool.depthMM, tool.depthMin, tool.depthMax)" @input="tool.setDepthMM(Number(($event.target as HTMLInputElement).value))">
              <div class="base-number"><input type="number" :min="tool.depthMin" :max="tool.depthMax" step="0.1" :value="fixed(tool.depthMM)" :aria-label="t('Cut depth in millimetres', '切入深度毫米')" @change="numberChanged($event, 'depth')" @keydown.enter="($event.target as HTMLInputElement).blur()"><span>mm</span></div>
            </div>
            <label class="base-toggle"><span>{{ t('Reverse retained side', '翻转保留侧') }}</span><input v-model="tool.flip" type="checkbox" role="switch"></label>
            <p v-if="tool.empty" class="base-warning">{{ t('Nothing remains. Reduce the cut depth or reverse the retained side.', '当前方案未保留模型，请减小深度或翻转保留侧。') }}</p>
          </section>
        </fieldset>
        <details v-if="stats" class="base-results">
          <summary>{{ tool.issues ? t('Result · Needs review', '处理结果 · 需要检查') : t('Result · Basic checks passed', '处理结果 · 基础检查通过') }}</summary>
          <dl><div><dt>{{ t('Removed faces', '完全移除面数') }}</dt><dd>{{ stats.removedFaces.toLocaleString() }}</dd></div><div><dt>{{ t('Split faces', '切开面数') }}</dt><dd>{{ stats.splitFaces.toLocaleString() }}</dd></div><div><dt>{{ t('New cap faces', '新增封口面数') }}</dt><dd>{{ stats.capFaces.toLocaleString() }}</dd></div><div><dt>{{ t('Open edges', '开放边') }}</dt><dd>{{ stats.boundary }}</dd></div><div><dt>{{ t('Non-manifold edges', '非流形边') }}</dt><dd>{{ stats.nonManifold }}</dd></div><div><dt>{{ t('Winding / degenerate / duplicate', '朝向 / 退化 / 重复') }}</dt><dd>{{ stats.winding }} / {{ stats.degenerate }} / {{ stats.duplicates }}</dd></div><div v-if="stats.capFaces"><dt>{{ t('Cap deviation', '底面平整误差') }}</dt><dd>{{ stats.capDeviation * tool.scale < 0.001 ? '< 0.001' : fixed(stats.capDeviation * tool.scale) }} mm</dd></div></dl>
        </details>
      </div>
      <fieldset v-else id="base-add-content" role="tabpanel" aria-labelledby="base-add-tab" :disabled="tool.busy || !tool.source">
        <section class="base-style-section">
          <h2 class="base-section-title">{{ t('Base style', '底座样式') }}</h2>
          <div class="base-categories" role="group" :aria-label="t('Base categories', '底座分类')">
            <button v-for="item in categories" :key="item" type="button" :class="{ active: category === item }" :aria-pressed="category === item" @click="category = item">{{ item }}</button>
            <button v-if="tool.customBase" type="button" :class="{ active: category === 'Custom' }" :aria-pressed="category === 'Custom'" @click="category = 'Custom'">{{ t('Custom', '自定义') }}</button>
          </div>
          <div class="base-styles" role="group" :aria-label="t('Base styles', '底座样式')">
            <button v-for="shape in visibleStyles" :key="shape" type="button" class="base-style-card" :class="{ active: tool.baseShape === shape }" :aria-pressed="tool.baseShape === shape" :title="shape === 'custom' ? tool.customBaseName : t(...styleNames[shape])" @click="tool.setBaseShape(shape)">
              <span class="base-style-image"><BaseStyleThumbnail :shape="shape" /></span>
              <span class="base-style-name"><span>{{ t(...styleNames[shape]) }}</span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" :fill="tool.baseShape === shape ? 'currentColor' : 'none'" stroke="currentColor" /><path v-if="tool.baseShape === shape" d="m5 8 2 2 4-4" fill="none" stroke="#26272c" stroke-width="1.5" /></svg></span>
            </button>
          </div>
          <button type="button" class="base-upload" :disabled="tool.customBaseLoading || tool.baseAssetLoading" :title="t('GLB, FBX, OBJ or STL · Up to 150 MB', 'GLB、FBX、OBJ 或 STL · 最大 150 MB')" @click="upload?.click()"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="m10 2 6 6h-4v6H8V8H4ZM4 17h12v1H4Z" /></svg>{{ tool.customBaseLoading ? t('Loading base…', '正在加载底座…') : t('Upload Custom Base', '上传自定义底座') }}</button>
          <input ref="upload" class="hidden-input" type="file" multiple accept=".glb,.fbx,.obj,.stl,.png,.jpg,.jpeg,.webp,.tga,.bmp" @change="uploadBase">
          <p v-if="tool.customBaseError" class="base-warning" role="alert">{{ tool.customBaseError }}</p>
          <div v-if="tool.baseAssetLoading" class="base-processing-status" role="status"><i />{{ t('Loading base…', '正在加载底座…') }}</div>
          <div v-if="tool.baseAssetError" class="base-warning" role="alert"><p>{{ t('Could not load the base.', '底座加载失败。') }}</p><button type="button" class="base-retry" @click="tool.retryBaseAsset()">{{ t('Retry', '重试') }}</button></div>
        </section>
        <section class="base-control-section">
          <label for="base-size" class="base-section-title">{{ t('Scale', '缩放') }}</label>
          <div class="base-slider-row"><input id="base-size" class="base-range" type="range" min="0.25" max="3" step="0.01" :value="tool.baseScale" :aria-valuetext="Math.round(tool.baseScale * 100) + '%'" :style="rangeStyle(tool.baseScale, 0.25, 3)" @input="tool.setBaseScale(Number(($event.target as HTMLInputElement).value))"><div class="base-number"><input type="number" min="0.25" max="3" step="0.01" :value="tool.baseScale.toFixed(2).replace(/0$/, '')" :aria-label="t('Base scale', '底座缩放倍数')" @change="numberChanged($event, 'scale')" @keydown.enter="($event.target as HTMLInputElement).blur()"><span>×</span></div></div>
        </section>
        <section class="base-control-section">
          <label for="base-rotation-y" class="base-section-title">{{ t('Rotation', '旋转') }}</label>
          <div class="base-slider-row"><input id="base-rotation-y" class="base-range" type="range" min="-180" max="180" step="1" :value="tool.baseRotationY" :aria-label="t('Base rotation around Y', '底座绕 Y 轴旋转')" :aria-valuetext="tool.baseRotationY + '°'" :style="rangeStyle(tool.baseRotationY, -180, 180)" @input="tool.setBaseRotationY(Number(($event.target as HTMLInputElement).value))"><div class="base-number"><input type="number" min="-180" max="180" step="1" :value="fixed(tool.baseRotationY)" :aria-label="t('Base Y angle', '底座 Y 轴角度')" @change="numberChanged($event, 'rotation')" @keydown.enter="($event.target as HTMLInputElement).blur()"><span>°</span></div></div>
        </section>
        <section class="base-control-section base-color-section">
          <h2 class="base-section-title">{{ t('Color', '颜色') }}</h2>
          <Popover v-model:open="colorOpen">
            <PopoverAnchor as-child>
              <div class="base-color-swatches" role="group" :aria-label="t('Base colors', '底座颜色')">
                <button v-if="tool.baseIsAsset" type="button" class="base-original-swatch" :class="{ active: tool.baseAssetOriginal }" :aria-label="t('Original appearance', '原始外观')" :title="t('Original appearance', '原始外观')" :aria-pressed="tool.baseAssetOriginal" @click="tool.restoreBaseAppearance(); colorOpen = false"><span class="base-material-sphere" aria-hidden="true" /></button>
                <button v-for="color in baseColors" :key="color" type="button" :style="{ backgroundColor: color }" :class="{ active: !tool.baseAssetOriginal && tool.baseColor === color }" :aria-label="t('Base color ', '底座颜色 ') + color" :title="color.toUpperCase()" :aria-pressed="!tool.baseAssetOriginal && tool.baseColor === color" @click="selectColor(color)" />
                <PopoverTrigger as-child><button type="button" class="base-custom-swatch" :class="{ active: customColor }" :style="customColor ? { background: tool.baseColor } : undefined" :disabled="tool.busy || !tool.source" :aria-label="t('Custom Color', '自定义颜色')" :title="t('Custom Color', '自定义颜色')"><svg v-if="!customColor" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 4v8M4 8h8" /></svg></button></PopoverTrigger>
              </div>
            </PopoverAnchor>
            <PopoverContent class="base-color-popover" side="right" align="end" :side-offset="24" :collision-padding="12" :aria-label="t('Custom Color', '自定义颜色')"><BaseColorPicker :color="tool.baseColor" @change="tool.setBaseColor" @close="colorOpen = false" /></PopoverContent>
          </Popover>
        </section>
      </fieldset>
      <p v-if="tool.failure" class="base-warning" role="alert">{{ tool.failure }}</p>
    </div>
    <footer>
      <template v-if="tool.busy"><div class="base-processing-status" role="status"><i />{{ t('Cutting and checking…', '正在裁切与检查…') }}</div><button type="button" class="base-upload" @click="tool.cancel">{{ t('Cancel', '取消') }}</button></template>
      <button v-else type="button" class="base-primary" :disabled="tool.mode === 'flatten' ? !tool.source || tool.empty : !tool.baseReady" @click="tool.apply"><span>{{ tool.mode === 'flatten' ? t('Apply Cut', '应用裁切') : tool.baseAdded ? t('Base Added', '底座已添加') : t('Add Base', '添加底座') }}</span><span class="base-credits" aria-hidden="true"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="M8 3 5 8h3l-1 5 4-6H8l2-4Z" fill="#f9cf00" /></svg>10</span></button>
    </footer>
  </section>
</template>
<style scoped>
.base-panel{background:#26272c;color:#f2f2f2;font-size:12px;border-radius:0 20px 20px 0}.base-panel-heading{height:48px;display:flex;align-items:center;gap:8px;padding:0 12px;flex:none}.base-panel-heading svg{width:16px;height:16px}.base-panel-heading h1{font-size:12px;font-weight:500}.base-mode-tabs{display:flex;margin:0 12px 16px;height:32px;border-radius:99px;background:#303136;flex:none}.base-mode-tabs button{flex:1;border-radius:99px;color:#f2f2f2;font-size:12px}.base-mode-tabs button.active{background:#f2f2f2;color:#080808;font-weight:500}.base-scroll{min-height:0;overflow:auto;padding:0 12px 20px;flex:1;scrollbar-width:thin;scrollbar-color:#45464b transparent}.base-panel fieldset{padding:0;border:0;margin:0;min-width:0}.base-panel fieldset:disabled{opacity:.5}.base-section-title{display:block;font-size:12px;font-weight:400;margin:0 0 16px;line-height:18px}.base-control-section{margin-top:20px}.base-style-section+.base-control-section{margin-top:22px}.base-style-section>.base-section-title{margin-bottom:12px}.base-slider-row{display:flex;align-items:center;gap:20px;min-height:32px}.base-range{appearance:none;flex:1;width:0;min-width:0;height:4px;margin:0;border:0;border-radius:10px;background:linear-gradient(to right,#d5d5d8 var(--progress),#303136 var(--progress));cursor:pointer}.base-range::-webkit-slider-thumb{appearance:none;width:14px;height:14px;border:2px solid #f2f2f2;border-radius:50%;background:#101114}.base-range::-moz-range-thumb{width:10px;height:10px;border:2px solid #f2f2f2;border-radius:50%;background:#101114}.base-number{display:flex;align-items:center;gap:4px;width:64px;height:32px;padding:0 10px;border:1px solid #ffffff0a;border-radius:8px;color:#999;flex:none}.base-number input{min-width:0;width:100%;padding:0;border:0;outline:none;background:transparent;color:#f2f2f2;font-size:12px;font-variant-numeric:tabular-nums;appearance:textfield}.base-number:focus-within{border-color:#999}.base-number input::-webkit-inner-spin-button{appearance:none}.base-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:18px;line-height:20px}.base-toggle input{appearance:none;width:30px;height:16px;margin:0;border:1px solid #ffffff1a;border-radius:99px;background:#303136;cursor:pointer;flex:none}.base-toggle input:before{content:'';display:block;width:10px;height:10px;border-radius:50%;background:#999;margin:2px;transition:transform .15s}.base-toggle input:checked:before{transform:translateX(14px);background:#f2f2f2}.base-bottom-slot :deep(.base-bottom){position:relative;inset:auto;width:100%;border:0;border-radius:16px;box-shadow:none;background:#2b2c31}.base-bottom-slot :deep(.base-bottom header){height:32px;padding:0 12px;border:0;color:#f2f2f2;font-size:12px}.base-bottom-slot :deep(.base-bottom-key){color:#f2f2f2;font-size:12px}.base-bottom-slot :deep(.base-bottom-key i){width:8px;height:8px;background:#f9cf00}.base-bottom-slot :deep(.base-bottom-canvas){height:auto;aspect-ratio:1;border-radius:16px;overflow:hidden;border:1px solid #ffffff0a}.base-categories{display:flex;gap:8px;overflow:auto;scrollbar-width:none;margin-bottom:12px}.base-categories::-webkit-scrollbar{display:none}.base-categories button{flex:none;height:26px;padding:0 12px;border:1px solid #ffffff1a;border-radius:99px;color:#999;font-size:10px}.base-categories button.active{color:#f2f2f2;border-color:#5843e7;background:#503be326}.base-styles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 8px}.base-style-card{min-width:0;border:1px solid #ffffff0a;border-radius:14px;padding:10px;color:#f2f2f2;text-align:left}.base-style-card:hover:enabled{border-color:#ffffff40}.base-style-card.active{border-color:#5843e7;background:#503be312}.base-style-image{display:block;aspect-ratio:1;overflow:hidden;border-radius:10px;background:radial-gradient(#515357,#27282c)}.base-style-name{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:10px;line-height:16px}.base-style-name>span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.base-style-name svg{width:16px;height:16px;flex:none}.base-upload{display:flex;justify-content:center;align-items:center;gap:6px;width:100%;height:40px;margin-top:12px;border:1px solid #ffffff1a;border-radius:12px;font-size:12px;color:#f2f2f2}.base-upload:hover:enabled{background:#ffffff06}.base-upload svg{width:16px;height:16px}.base-color-swatches{display:flex;gap:8px;flex-wrap:wrap;padding:2px 0}.base-color-swatches button{display:grid;place-items:center;flex:none;width:24px;height:24px;border-radius:50%;border:0;box-shadow:inset 0 0 0 1px #ffffff10}.base-color-swatches button.active{outline:1.5px solid #f2f2f2;outline-offset:2px}.base-original-swatch{background:#1d1e22}.base-material-sphere{display:block;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 32% 24%,#ffffff80,transparent 48%,#00000080 100%),repeating-conic-gradient(#e9e9ef 0% 25%,#727786 0% 50%) 50% / 9px 9px}.base-custom-swatch{background:conic-gradient(#edb99a,#f3e6ab,#a5d4bc,#b2c2eb,#d4b6db,#edb99a);color:#26272c}.base-custom-swatch svg{width:16px;height:16px}.base-color-popover{padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;z-index:60}.base-panel footer{padding:16px 12px 18px;flex:none}.base-primary{width:100%;height:40px;display:flex;justify-content:center;align-items:center;gap:8px;border-radius:99px;background:#f9cf00;color:#080808;font-size:14px;font-weight:600}.base-primary:hover:enabled{background:#ffdc32}.base-credits{display:flex;align-items:center;gap:3px}.base-credits svg{width:16px;height:16px}.base-warning{font-size:11px;line-height:1.6;color:#e8bd70;margin-top:10px}.base-retry{color:#c6bcff;text-decoration:underline;margin-top:6px}.base-results{margin-top:20px;font-size:10px;color:#b4b7c0}.base-results summary{cursor:pointer}.base-results dl{display:grid;gap:7px;margin-top:12px}.base-results dl div{display:flex;justify-content:space-between;gap:8px}.base-processing-status{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11px;color:#b4b7c0}.base-processing-status i{width:12px;height:12px;border:2px solid #ffffff20;border-top-color:#f2f2f2;border-radius:50%;animation:base-spin .8s linear infinite}@keyframes base-spin{to{transform:rotate(360deg)}}
</style>
