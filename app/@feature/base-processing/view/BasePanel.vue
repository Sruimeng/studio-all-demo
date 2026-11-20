<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@tripo3d/design';
import { useLocale } from '~/@base/locale';
import type { BaseShape } from '~/@engine/base-processing';
import type { BaseProcessingController } from '../index';
import { textFonts } from '../text-geometry';
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
const directionAxes = ['x', 'y', 'z'] as const;
const upload = useTemplateRef<HTMLInputElement>('upload');
const colorOpen = ref(false), textColorOpen = ref(false), categoryOpen = ref(false);
const uploadedSize = computed(() => {
  const bytes = tool.customBaseSize;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
});
function selectCategory(value: Category) { category.value = value; categoryOpen.value = false; }
const baseColors = ['#ffffff', '#ffdb57', '#87cf9a', '#829efa', '#383a42'];
const customColor = computed(() => !tool.baseAssetOriginal && !baseColors.includes(tool.baseColor));
const textInput = useTemplateRef<HTMLInputElement>('textInput');
const rangeStyle = (value: number, min: number, max: number) => ({ '--progress': `${max > min ? Math.max(0, Math.min(100, (value - min) / (max - min) * 100)) : 0}%` });
function depthChanged(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = input.value.trim() ? Number(input.value) : NaN;
  tool.setDepthMM(value);
  input.value = String(fixed(tool.depthMM));
}
function textChanged(event: Event) {
  if ((event as InputEvent).isComposing) return;
  tool.setTextContent((event.target as HTMLInputElement).value);
}
function selectColor(color: string) { textColorOpen.value = false; tool.setBaseColor(color); colorOpen.value = true; }
async function uploadBase(event: Event) {
  const input = event.target as HTMLInputElement, files = Array.from(input.files ?? []); input.value = '';
  if (!files.length) return;
  await tool.importCustomBase(files);
}
watch(() => [tool.mode, tool.baseShape, tool.source, tool.textAdded], () => { colorOpen.value = false; textColorOpen.value = false; categoryOpen.value = false; });
watch([colorOpen, textColorOpen], ([color, textColor]) => { if (color || textColor) categoryOpen.value = false; });
watch(() => tool.textAdded, added => { if (added) void nextTick(() => { textInput.value?.focus(); textInput.value?.select(); }); });
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
          <section class="base-control-section base-direction-section">
            <h2 class="base-section-title">{{ t('Cut direction', '切割方向') }}</h2>
            <div class="base-direction-buttons" role="group" :aria-label="t('Cut direction', '切割方向')">
              <button v-for="axis in directionAxes" :key="axis" type="button" :class="{ active: tool.direction === axis }" :aria-pressed="tool.direction === axis" :title="t('Plane normal along ', '切面法线沿 ') + axis.toUpperCase()" @click="tool.setDirection(axis)">{{ axis.toUpperCase() }}</button>
            </div>
          </section>
          <section class="base-control-section">
            <label class="base-section-title" for="base-depth">{{ t('Cut depth', '切入深度') }}</label>
            <div class="base-slider-row">
              <input id="base-depth" class="base-range" type="range" :min="tool.depthMin" :max="tool.depthMax" step="any" :value="tool.depthMM" :style="rangeStyle(tool.depthMM, tool.depthMin, tool.depthMax)" @input="tool.setDepthMM(Number(($event.target as HTMLInputElement).value))">
              <div class="base-number"><input type="number" :min="tool.depthMin" :max="tool.depthMax" step="0.1" :value="fixed(tool.depthMM)" :aria-label="t('Cut depth in millimetres', '切入深度毫米')" @change="depthChanged($event)" @keydown.enter="($event.target as HTMLInputElement).blur()"><span>mm</span></div>
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
          <div class="base-style-heading">
            <h2 class="base-section-title">{{ t('Base style', '底座样式') }}</h2>
            <Popover v-model:open="categoryOpen" @update:open="open => { if (open) { colorOpen = false; textColorOpen = false; } }">
              <PopoverTrigger as-child>
                <button type="button" class="base-category-trigger" :disabled="tool.busy || !tool.source" :aria-label="t('Base category: ', '底座分类：') + category" :title="t('Change category', '切换分类')">
                  <span>{{ category === 'Custom' ? t('Custom', '自定义') : category }}</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
                </button>
              </PopoverTrigger>
              <PopoverContent class="base-category-popover" side="right" align="start" :side-offset="24" :avoid-collisions="false" :aria-label="t('Base categories', '底座分类')">
                <div class="base-category-options" role="group" :aria-label="t('Base categories', '底座分类')">
                  <button v-for="item in categories" :key="item" type="button" :class="{ active: category === item }" :aria-pressed="category === item" @click="selectCategory(item)"><span>{{ item }}</span><svg v-if="category === item" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg></button>
                  <button v-if="tool.customBase" type="button" :class="{ active: category === 'Custom' }" :aria-pressed="category === 'Custom'" @click="selectCategory('Custom')"><span>{{ t('Custom', '自定义') }}</span><svg v-if="category === 'Custom'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg></button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div class="base-styles" role="group" :aria-label="t('Base styles', '底座样式')">
            <button v-for="shape in visibleStyles" :key="shape" type="button" class="base-style-card" :class="{ active: tool.baseShape === shape }" :aria-pressed="tool.baseShape === shape" :title="shape === 'custom' ? tool.customBaseName : t(...styleNames[shape])" @click="tool.setBaseShape(shape)">
              <span class="base-style-image"><BaseStyleThumbnail :shape="shape" /></span>
              <span class="base-style-name"><span>{{ t(...styleNames[shape]) }}</span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" :fill="tool.baseShape === shape ? 'currentColor' : 'none'" stroke="currentColor" /><path v-if="tool.baseShape === shape" d="m5 8 2 2 4-4" fill="none" stroke="#26272c" stroke-width="1.5" /></svg></span>
            </button>
          </div>
          <button type="button" class="base-upload base-custom-upload" :class="{ 'has-file': !!tool.customBase, active: tool.baseShape === 'custom' && !!tool.customBase }" :disabled="tool.customBaseLoading || tool.baseAssetLoading" :aria-busy="tool.customBaseLoading" :aria-label="tool.customBase ? t('Reupload custom base', '重新上传底座') : t('Upload Custom Base', '上传自定义底座')" :aria-pressed="tool.baseShape === 'custom' && !!tool.customBase" :title="tool.customBase ? `${tool.customBaseName} · ${uploadedSize} · ${t('Click to reupload', '点击重新上传')}` : t('GLB, FBX, OBJ or STL · Up to 150 MB', 'GLB、FBX、OBJ 或 STL · 最大 150 MB')" @click="categoryOpen = false; upload?.click()">
            <span class="base-upload-name">{{ tool.customBaseLoading ? t('Loading base…', '正在加载底座…') : tool.customBase ? tool.customBaseName : t('Upload Custom Base', '上传自定义底座') }}</span>
            <span v-if="tool.customBase" class="base-upload-size">{{ uploadedSize }}</span>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="m10 2 6 6h-4v6H8V8H4ZM4 17h12v1H4Z" /></svg>
          </button>
          <input ref="upload" class="hidden-input" type="file" multiple accept=".glb,.fbx,.obj,.stl,.png,.jpg,.jpeg,.webp,.tga,.bmp" @change="uploadBase">
          <p v-if="tool.customBaseError" class="base-warning" role="alert">{{ tool.customBaseError }}</p>
          <div v-if="tool.baseAssetLoading" class="base-processing-status" role="status"><i />{{ t('Loading base…', '正在加载底座…') }}</div>
          <div v-if="tool.baseAssetError" class="base-warning" role="alert"><p>{{ t('Could not load the base.', '底座加载失败。') }}</p><button type="button" class="base-retry" @click="tool.retryBaseAsset()">{{ t('Retry', '重试') }}</button></div>
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
        <section class="base-control-section base-text-section">
          <div class="base-text-heading">
            <h2 class="base-section-title">{{ t('Add text', '添加文字') }}</h2>
            <button type="button" class="base-text-toggle" :disabled="!tool.textAdded && !tool.baseReady" :aria-label="tool.textAdded ? t('Remove text', '删除文字') : t('Add text', '添加文字')" :title="tool.textAdded ? t('Remove text', '删除文字') : t('Add text', '添加文字')" @click="tool.textAdded ? tool.removeText() : tool.addText()">
              <svg v-if="!tool.textAdded" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
              <svg v-else viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6h10M8 6V4h4v2m-6 0 .7 10h6.6L14 6M8.5 9v4.5M11.5 9v4.5" /></svg>
            </button>
          </div>
          <Transition name="base-text-reveal">
            <div v-if="tool.textAdded" class="base-text-settings">
              <input ref="textInput" class="base-text-input" type="text" maxlength="32" :value="tool.textContent" :placeholder="t('Enter text', '输入文字')" :aria-label="t('Text content', '文字内容')" @input="textChanged" @compositionend="textChanged">
              <div class="base-text-options">
                <label class="base-font-select" :aria-label="t('Text font', '文字字体')">
                  <span class="base-font-mark" aria-hidden="true">A</span>
                  <select :value="tool.textFont" :aria-label="t('Text font', '文字字体')" :title="tool.textFont" @change="tool.setTextFont(($event.target as HTMLSelectElement).value)">
                    <option v-for="font in textFonts" :key="font" :value="font">{{ font }}</option>
                  </select>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
                </label>
                <Popover v-model:open="textColorOpen" @update:open="open => { if (open) colorOpen = false; }">
                  <PopoverTrigger as-child>
                    <button type="button" class="base-text-color-trigger" :disabled="tool.busy || !tool.source" :aria-label="t('Text color ', '文字颜色 ') + tool.textColor.toUpperCase()" :title="t('Text color ', '文字颜色 ') + tool.textColor.toUpperCase()"><span :style="{ backgroundColor: tool.textColor }" aria-hidden="true" /><strong>{{ tool.textColor.slice(1).toUpperCase() }}</strong></button>
                  </PopoverTrigger>
                  <PopoverContent class="base-color-popover" side="right" align="end" :side-offset="24" :collision-padding="12" :aria-label="t('Text color', '文字颜色')"><BaseColorPicker :color="tool.textColor" @change="tool.setTextColor" @close="textColorOpen = false" /></PopoverContent>
                </Popover>
              </div>
            </div>
          </Transition>
          <p v-if="tool.textSurfaceHint" class="base-warning" role="status">{{ t(...tool.textSurfaceHint.split(' / ') as [string, string]) }}</p>
          <p v-if="tool.textError" class="base-warning" role="alert">{{ tool.textError }}</p>
        </section>
      </fieldset>
      <p v-if="tool.failure" class="base-warning" role="alert">{{ tool.failure }}</p>
    </div>
    <footer>
      <template v-if="tool.busy"><div class="base-processing-status" role="status"><i />{{ t('Cutting and checking…', '正在裁切与检查…') }}</div><button type="button" class="base-upload" @click="tool.cancel">{{ t('Cancel', '取消') }}</button></template>
      <button v-else type="button" class="base-primary" :disabled="tool.mode === 'flatten' ? !tool.source || tool.empty : !tool.baseReady || !tool.textReady" @click="tool.apply"><span>{{ tool.mode === 'flatten' ? t('Apply Cut', '应用裁切') : tool.baseAdded ? t('Base Added', '底座已添加') : t('Add Base', '添加底座') }}</span><span class="base-credits" aria-hidden="true"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="M8 3 5 8h3l-1 5 4-6H8l2-4Z" fill="#f9cf00" /></svg>10</span></button>
    </footer>
  </section>
</template>
<style scoped>
.base-panel{background:#26272c;color:#f2f2f2;font-size:12px;border-radius:0 20px 20px 0}.base-panel-heading{height:48px;display:flex;align-items:center;gap:8px;padding:0 12px;flex:none}.base-panel-heading svg{width:16px;height:16px}.base-panel-heading h1{font-size:12px;font-weight:500}.base-mode-tabs{display:flex;margin:0 12px 16px;height:32px;border-radius:99px;background:#303136;flex:none}.base-mode-tabs button{flex:1;border-radius:99px;color:#f2f2f2;font-size:12px}.base-mode-tabs button.active{background:#f2f2f2;color:#080808;font-weight:500}.base-scroll{min-height:0;overflow:auto;padding:0 12px 20px;flex:1;scrollbar-width:thin;scrollbar-color:#45464b transparent}.base-panel fieldset{padding:0;border:0;margin:0;min-width:0}.base-panel fieldset:disabled{opacity:.5}.base-section-title{display:block;font-size:12px;font-weight:400;margin:0 0 16px;line-height:18px}.base-control-section{margin-top:20px}.base-direction-section{margin-top:20px}.base-direction-buttons{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.base-direction-buttons button{height:32px;border:1px solid #ffffff1a;border-radius:8px;background:#303136;color:#b8bac4;font-size:12px;font-weight:500}.base-direction-buttons button:hover:enabled{border-color:#ffffff40;color:#f2f2f2}.base-direction-buttons button.active{border-color:#5843e7;background:#5843e7;color:#fff}.base-style-section+.base-control-section{margin-top:22px}.base-slider-row{display:flex;align-items:center;gap:20px;min-height:32px}.base-range{appearance:none;flex:1;width:0;min-width:0;height:4px;margin:0;border:0;border-radius:10px;background:linear-gradient(to right,#d5d5d8 var(--progress),#303136 var(--progress));cursor:pointer}.base-range::-webkit-slider-thumb{appearance:none;width:14px;height:14px;border:2px solid #f2f2f2;border-radius:50%;background:#101114}.base-range::-moz-range-thumb{width:10px;height:10px;border:2px solid #f2f2f2;border-radius:50%;background:#101114}.base-number{display:flex;align-items:center;gap:4px;width:64px;height:32px;padding:0 10px;border:1px solid #ffffff0a;border-radius:8px;color:#999;flex:none}.base-number input{min-width:0;width:100%;padding:0;border:0;outline:none;background:transparent;color:#f2f2f2;font-size:12px;font-variant-numeric:tabular-nums;appearance:textfield}.base-number:focus-within{border-color:#999}.base-number input::-webkit-inner-spin-button{appearance:none}.base-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:18px;line-height:20px}.base-toggle input{appearance:none;width:30px;height:16px;margin:0;border:1px solid #ffffff1a;border-radius:99px;background:#303136;cursor:pointer;flex:none}.base-toggle input:before{content:'';display:block;width:10px;height:10px;border-radius:50%;background:#999;margin:2px;transition:transform .15s}.base-toggle input:checked:before{transform:translateX(14px);background:#f2f2f2}.base-bottom-slot :deep(.base-bottom){position:relative;inset:auto;width:100%;border:0;border-radius:16px;box-shadow:none;background:#2b2c31}.base-bottom-slot :deep(.base-bottom header){height:32px;padding:0 12px;border:0;color:#f2f2f2;font-size:12px}.base-bottom-slot :deep(.base-bottom-key){color:#f2f2f2;font-size:12px}.base-bottom-slot :deep(.base-bottom-key i){width:8px;height:8px;background:#f9cf00}.base-bottom-slot :deep(.base-bottom-canvas){height:auto;aspect-ratio:1;border-radius:16px;overflow:hidden;border:1px solid #ffffff0a}.base-styles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 8px}.base-style-card{min-width:0;border:1px solid #ffffff0a;border-radius:14px;padding:10px;color:#f2f2f2;text-align:left}.base-style-card:hover:enabled{border-color:#ffffff40}.base-style-card.active{border-color:#5843e7;background:#503be312}.base-style-image{display:block;aspect-ratio:1;overflow:hidden;border-radius:10px;background:radial-gradient(#515357,#27282c)}.base-style-name{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:10px;line-height:16px}.base-style-name>span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.base-style-name svg{width:16px;height:16px;flex:none}.base-upload{display:flex;justify-content:center;align-items:center;gap:6px;width:100%;height:40px;margin-top:12px;border:1px solid #ffffff1a;border-radius:12px;font-size:12px;color:#f2f2f2}.base-upload:hover:enabled{background:#ffffff06}.base-upload svg{width:16px;height:16px}.base-color-swatches{display:flex;gap:8px;flex-wrap:wrap;padding:2px 0}.base-color-swatches button{display:grid;place-items:center;flex:none;width:24px;height:24px;border-radius:50%;border:0;box-shadow:inset 0 0 0 1px #ffffff10}.base-color-swatches button.active{outline:1.5px solid #f2f2f2;outline-offset:2px}.base-original-swatch{background:#1d1e22}.base-material-sphere{display:block;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 32% 24%,#ffffff80,transparent 48%,#00000080 100%),repeating-conic-gradient(#e9e9ef 0% 25%,#727786 0% 50%) 50% / 9px 9px}.base-custom-swatch{background:conic-gradient(#edb99a,#f3e6ab,#a5d4bc,#b2c2eb,#d4b6db,#edb99a);color:#26272c}.base-custom-swatch svg{width:16px;height:16px}.base-color-popover{padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;z-index:60}.base-panel footer{padding:16px 12px 18px;flex:none}.base-primary{width:100%;height:40px;display:flex;justify-content:center;align-items:center;gap:8px;border-radius:99px;background:#f9cf00;color:#080808;font-size:14px;font-weight:600}.base-primary:hover:enabled{background:#ffdc32}.base-credits{display:flex;align-items:center;gap:3px}.base-credits svg{width:16px;height:16px}.base-warning{font-size:11px;line-height:1.6;color:#e8bd70;margin-top:10px}.base-retry{color:#c6bcff;text-decoration:underline;margin-top:6px}.base-results{margin-top:20px;font-size:10px;color:#b4b7c0}.base-results summary{cursor:pointer}.base-results dl{display:grid;gap:7px;margin-top:12px}.base-results dl div{display:flex;justify-content:space-between;gap:8px}.base-processing-status{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11px;color:#b4b7c0}.base-processing-status i{width:12px;height:12px;border:2px solid #ffffff20;border-top-color:#f2f2f2;border-radius:50%;animation:base-spin .8s linear infinite}@keyframes base-spin{to{transform:rotate(360deg)}}
.base-style-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;min-height:26px}.base-style-heading .base-section-title{margin:0}.base-category-trigger{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px;border:1px solid #ffffff1a;border-radius:99px;color:#999;font-size:10px;background:transparent}.base-category-trigger svg{width:12px;height:12px;transition:transform .15s}.base-category-trigger[data-state=open] svg{transform:rotate(180deg)}.base-category-trigger:hover:enabled,.base-category-trigger[data-state=open]{color:#f2f2f2;border-color:#ffffff40}.base-category-trigger:focus-visible{outline:2px solid #9b89ff;outline-offset:2px}
:global(.base-category-popover){width:152px!important;padding:6px!important;border:1px solid #ffffff12!important;border-radius:12px!important;background:#2b2c31!important;box-shadow:0 8px 28px #0004!important;color:#f2f2f2;z-index:60}.base-category-options{display:grid;gap:2px}.base-category-options button{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;height:34px;padding:0 10px;border-radius:7px;font-size:12px;text-align:left;color:#b4b5bd;background:transparent}.base-category-options button:hover{background:#ffffff08;color:#f2f2f2}.base-category-options button.active{background:#503be326;color:#d4caff}.base-category-options button:focus-visible{outline:1px solid #9b89ff;outline-offset:-1px}.base-category-options svg{width:14px;height:14px;flex:none}
.base-custom-upload{gap:10px;padding:0 11px;height:42px}.base-custom-upload.has-file{justify-content:flex-start}.base-custom-upload.active{border-color:#7954ff;background:#503be326}.base-custom-upload.active:hover:enabled{background:#503be338}.base-upload-name{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:left}.base-custom-upload.has-file .base-upload-name{flex:1}.base-upload-size{flex:none;font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap}.base-custom-upload svg{flex:none}.base-custom-upload:focus-visible{outline:2px solid #9b89ff;outline-offset:2px}
.base-text-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:28px}.base-text-heading .base-section-title{margin:0}.base-text-toggle{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:7px;background:transparent;color:#74767d;transition:background .15s}.base-text-toggle svg{width:20px;height:20px}.base-text-toggle:hover:enabled{background:#ffffff0a}.base-text-toggle:focus-visible{outline:1px solid #a4a5aa;outline-offset:2px}.base-text-settings{padding-top:12px}.base-text-input{display:block;box-sizing:border-box;width:100%;min-width:0;height:36px;padding:0 12px;border:1px solid #ffffff10;border-radius:9px;background:transparent;color:#f2f2f2;font-size:12px;outline:none;transition:border-color .15s}.base-text-input:focus{border-color:#8b8d95}.base-text-options{display:grid;grid-template-columns:minmax(0,1fr) 86px;align-items:center;gap:8px;margin-top:14px}.base-font-select{position:relative;display:flex;align-items:center;min-width:0;height:32px;padding:0 9px;gap:7px;border-radius:99px;background:#33343a}.base-font-mark{flex:none;font:700 18px Georgia,serif;color:#74767d}.base-font-select select{appearance:none;min-width:0;width:100%;padding:0 15px 0 0;border:0;outline:0;background:transparent;color:#e8e8eb;font-size:11px;cursor:pointer;text-overflow:ellipsis}.base-font-select option{background:#33343a;color:#f2f2f2}.base-font-select svg{position:absolute;right:8px;width:13px;height:13px;color:#74767d;pointer-events:none}.base-font-select:focus-within{outline:1px solid #8b8d95}.base-text-color-trigger{display:flex;align-items:center;gap:6px;min-width:0;height:32px;padding:3px 9px 3px 3px;border:0;border-radius:99px;background:#33343a}.base-text-color-trigger>span{flex:none;width:26px;height:26px;border-radius:50%;box-shadow:inset 0 0 0 1px #ffffff12}.base-text-color-trigger strong{font-size:10px;line-height:1;font-weight:400;font-variant-numeric:tabular-nums;color:#e8e8eb}.base-text-color-trigger:focus-visible{outline:1px solid #8b8d95}.base-text-color-trigger:hover{background:#3b3c42}.base-text-reveal-enter-active{transition:opacity .16s ease,transform .16s ease}.base-text-reveal-leave-active{transition:opacity .1s ease}.base-text-reveal-enter-from{opacity:0;transform:translateY(-4px)}.base-text-reveal-leave-from{pointer-events:none}.base-text-reveal-leave-to{opacity:0}@media(prefers-reduced-motion:reduce){.base-text-reveal-enter-active,.base-text-reveal-leave-active{transition:none}}
</style>
