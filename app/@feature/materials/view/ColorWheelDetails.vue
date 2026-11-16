<script setup lang="ts">
import { computed } from 'vue';
import { useLocale } from '~/@base/locale';
import { rgb } from '../catalog';
import { materialHex, materialProblem } from '../supplier';
import type { WheelEntry } from '../color-wheel';
import type { MaterialRecord } from '../types';
import AppearanceBinding from './AppearanceBinding.vue';

const props = defineProps<{ entry: WheelEntry; material: MaterialRecord; materials: MaterialRecord[]; busy: boolean; canApply: boolean; changed: boolean }>();
const emit = defineEmits<{ apply: [material: MaterialRecord]; update: [material: MaterialRecord]; edit: []; save: [] }>();
const { t } = useLocale();
const adjusted = computed(() => materialHex(props.material).toUpperCase());
const problem = computed(() => materialProblem(props.material));
const custom = computed(() => props.material.appearance?.origin === 'user');
const reference = computed(() => props.material.supplier?.vendor === 'eSUN' && props.material.supplier.source.spreadsheet === '产品颜色管理.html');
</script>

<template>
  <section class="wheel-details" aria-label="Color record details">
    <span class="detail-eyebrow">{{ custom ? t('CUSTOM COLOR', '自定义颜色') : t('COLOR REFERENCE', '颜色参考') }}</span>
    <h2 class="color-name">{{ material.name }}</h2>
    <p class="color-series">{{ entry.vendor }} · {{ entry.base }}<br>{{ entry.seriesName }}</p>
    <div class="source-swatch" :style="{ background: entry.hex ?? '#34383B' }"><span>{{ t('Source swatch', '源色块') }} · {{ entry.hex ?? t('Not provided', '未提供') }}</span></div>
    <dl class="color-facts">
      <div><dt>{{ t('Source HEX', '源 HEX') }}</dt><dd>{{ entry.hex ?? '—' }}</dd></div>
      <div><dt>RGB · sRGB</dt><dd>{{ entry.hex ? rgb(entry.hex).join(' / ') : '—' }}</dd></div>
      <div v-if="material.supplier?.pantone"><dt>Pantone</dt><dd>{{ material.supplier.pantone }}</dd></div>
      <div><dt>{{ t('Origin', '来源类型') }}</dt><dd>{{ custom ? t('Custom', '自定义') : material.supplier?.origin === 'local-usda' ? 'USDA' : material.supplier ? t('Color catalog', '颜色目录') : t('Local material', '本地材质') }}</dd></div>
      <div v-if="material.appearance?.colorCode"><dt>{{ t('Color code', '颜色号') }}</dt><dd>{{ material.appearance.colorCode }}</dd></div>
      <div v-if="material.supplier?.source.spreadsheet"><dt>{{ t('Source', '源文件') }}</dt><dd>{{ material.supplier.source.spreadsheet }}<template v-if="material.supplier.source.row"> · {{ material.supplier.source.row }}</template></dd></div>
      <div v-else-if="material.appearance?.source"><dt>{{ t('Source', '资料来源') }}</dt><dd>{{ material.appearance.source }}</dd></div>
    </dl>
    <div v-if="adjusted !== entry.hex" class="adjusted-color"><i :style="{ background: adjusted }" /><span>{{ t('Adjusted model HEX', '调整后模型 HEX') }}<b>{{ adjusted }}</b></span></div>
    <p class="detail-note">{{ reference ? t('User-provided color chart · not physically calibrated. No verified sales SKU or measured finish.', '用户提供色表 · 未经实物校准。无已核实销售 SKU 或实测质感。') : t('Screen colors and demo appearances are not physically calibrated.', '屏幕颜色与演示外观未经实物校准。') }}</p>
    <AppearanceBinding :material="material" :materials="materials" :busy="busy" @update="emit('update', $event)" />
    <div class="detail-actions"><button type="button" :disabled="busy" @click="emit('edit')">{{ t('Edit parameters', '编辑参数') }}</button><button v-if="changed" type="button" :disabled="busy || !!problem" @click="emit('save')">{{ t('Save binding', '保存绑定') }}</button></div>
    <p v-if="problem" role="status" class="detail-note">{{ problem }}</p>
    <button class="apply-color" data-testid="wheel-apply" type="button" :disabled="busy || !canApply || !!problem" @click="emit('apply', material)">{{ t('Apply to selected region →', '应用到所选区域 →') }}</button>
    <p class="detail-note">{{ canApply ? t('Only Apply changes the model. Browsing, editing and saving stay in the library.', '仅“应用”会修改模型。浏览、编辑与保存只影响材质库。') : t('Import a model and select a region to apply this color.', '请先导入模型并选择区域，再应用颜色。') }}</p>
  </section>
</template>

<style scoped>
.wheel-details { min-width: 0; }
.detail-eyebrow { color: #bad49e; font: 9px monospace; letter-spacing: 1.7px; }
.color-name { font-size: 18px; font-weight: 500; line-height: 1.5; overflow-wrap: anywhere; margin-top: 10px; }
.color-series { color: #909ca3; font-size: 11px; margin: 10px 0 20px; line-height: 1.8; overflow-wrap: anywhere; }
.source-swatch { height: 140px; border-radius: 9px; border: 1px solid #ffffff1c; position: relative; }
.source-swatch span { position: absolute; bottom: 10px; left: 10px; max-width: calc(100% - 20px); padding: 5px 7px; border-radius: 4px; background: #15191cc9; color: #eee; font: 10px monospace; }
.color-facts { margin-top: 18px; }
.color-facts > div { display: flex; justify-content: space-between; align-items: start; gap: 14px; padding: 10px 0; border-bottom: 1px solid #343b3f; font-size: 10px; }
.color-facts dt { color: #86949c; flex-shrink: 0; }
.color-facts dd { text-align: right; overflow-wrap: anywhere; min-width: 0; color: #d2dbe0; }
.adjusted-color { display: flex; gap: 10px; align-items: center; margin: 15px 0; color: #a0adb5; font-size: 10px; }
.adjusted-color i { width: 34px; height: 34px; border: 1px solid #ffffff2a; border-radius: 5px; }
.adjusted-color b { display: block; margin-top: 5px; color: #d6e1e6; font: 11px monospace; }
.detail-note { color: #8b979e; font-size: 10px; line-height: 1.8; margin-top: 14px; }
.detail-actions { display: flex; gap: 8px; }
.detail-actions button { flex: 1; padding: 9px 5px; border: 1px solid #465047; border-radius: 5px; color: #bdcdb0; font-size: 10px; }
.apply-color { width: 100%; padding: 12px 6px; border-radius: 6px; background: #c2ef78; color: #1d2815; font-size: 11px; font-weight: 600; margin-top: 18px; }
</style>
