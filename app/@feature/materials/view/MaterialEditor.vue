<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { useLocale } from '~/@base/locale';
import ModuleTooltip from '~/@base/ui/ModuleTooltip.vue';
import { validateMaterial, rgb } from '../catalog';
import { cloneMaterial, restoreSupplier, withOverrides, materialProblem } from '../supplier';
import { FILAMENT_RULE, OPENPBR_RULE, type MaterialRecord, type ColorMode } from '../types';
import SupplierDetail from './SupplierDetail.vue';
import AppearanceBinding from './AppearanceBinding.vue';

const props = defineProps<{ material: MaterialRecord; materials: MaterialRecord[]; busy: boolean; saveMaterial: (material: MaterialRecord) => Promise<boolean> }>();
const emit = defineEmits<{ close: []; preview: [material: MaterialRecord | null] }>();
const { t } = useLocale();
const draft = ref(cloneMaterial(props.material));
const validation = shallowRef('');
const supplier = computed(() => !!draft.value.supplier);
const filament = computed(() => draft.value.renderRule === FILAMENT_RULE);
const directRoughness = computed(() => draft.value.renderRule === OPENPBR_RULE || filament.value);
const opticalFields = [
  { key: 'transmission' as const, name: 'Transmission / 透射权重', min: 0, max: 1, step: 0.01 },
  { key: 'thickness' as const, name: 'Optical thickness / 等效光学厚度 (mm)', min: 0, max: 100, step: 0.1 },
  { key: 'attenuationDistance' as const, name: 'Attenuation distance / 衰减距离 (mm)', min: 0.1, max: 10000, step: 0.1 },
  { key: 'sheen' as const, name: 'Sheen / 柔光权重', min: 0, max: 1, step: 0.01 },
  { key: 'clearcoat' as const, name: 'Clearcoat / 清漆权重', min: 0, max: 1, step: 0.01 },
];
if (filament.value) draft.value.optics = { transmission: 0, thickness: 1.2, attenuationDistance: 8, sheen: 0, clearcoat: 0, ...draft.value.optics };
const effectiveRoughness = computed(() => Number.isFinite(draft.value.roughness) ? (directRoughness.value ? draft.value.roughness : 0.5 + draft.value.roughness * 0.5).toFixed(3) : '—');
const colorMode = computed({ get: () => draft.value.overrides?.colorMode ?? (draft.value.supplier?.origin === 'local-usda' ? 'linear-srgb' : 'catalog'), set: (value: ColorMode) => { draft.value.overrides = { ...draft.value.overrides, colorMode: value }; } });
const parameters = computed(() => [
  { key: 'transparency' as const, title: t('Transparency', '透明度'), description: t('Preview opacity equals 1 minus transparency. This is not transmission.', '预览不透明度等于 1 减透明度，不等同于物理透射。') },
  { key: 'metalness' as const, title: t('Metalness', '金属度'), description: t('0 is dielectric; 1 is metallic.', '0 为非金属，1 为金属。') },
  { key: 'roughness' as const, title: t('Roughness', '粗糙度'), description: directRoughness.value ? t('Used directly by this preview rule.', '当前预览规则直接使用此值。') : t('Studio uses 0.5 + 0.5 × input roughness.', 'Studio 使用 0.5 + 0.5 × 输入粗糙度。') },
]);
function restore() { draft.value = restoreSupplier(draft.value); validation.value = ''; }
function markAppearanceOverride() { if (draft.value.appearanceBinding) draft.value.appearanceBinding.overridden = true; }
function close() { emit('preview', null); emit('close'); }
async function save() {
  const value = withOverrides({ ...draft.value, name: draft.value.name.trim(), materialId: draft.value.materialId.trim(), hex: draft.value.hex.toUpperCase() });
  const error = validateMaterial(value, props.materials);
  if (error) { validation.value = error; return; }
  if (await props.saveMaterial(value)) close();
}
async function reference(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0]; input.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) { validation.value = t('Choose an image under 5 MB', '请选择 5MB 内的图片'); return; }
  const reader = new FileReader(); reader.onload = () => { draft.value.referenceImage = String(reader.result); }; reader.readAsDataURL(file);
}
watch(draft, value => {
  const material = withOverrides(value);
  emit('preview', validateMaterial(material, []) || materialProblem(material) ? null : material);
}, { deep: true, immediate: true });
</script>
<template>
  <div class="editor-title"><button class="text-button" @click="close">← {{ t('Library', '材质库') }}</button><span>{{ supplier ? t('Local adjustment', '本地调整') : t('Material editor', '材质编辑') }}</span></div>
  <SupplierDetail v-if="supplier" :material="draft" />
  <div class="editor-fields">
    <label>{{ t('Name', '名称') }}<input v-model="draft.name" data-testid="material-name" :readonly="supplier && draft.supplier?.origin !== 'local-usda'"></label>
    <label>{{ t('Material ID / SKU', '材质 ID / SKU') }}<input v-model="draft.materialId" data-testid="material-id" :readonly="supplier && draft.supplier?.origin !== 'local-usda'"></label>
    <template v-if="draft.appearance && !supplier">
      <p class="render-note">{{ draft.appearance.vendor }} · {{ draft.appearance.baseMaterial }} · {{ draft.appearance.templateId || t('Unconfirmed finish', '质感待确认') }} · {{ t('Custom color', '自定义颜色') }}</p>
      <label>{{ t('Color code', '颜色号') }}<input v-model="draft.appearance.colorCode" aria-label="Edit color code"></label>
      <label>{{ t('Sales SKU', '销售 SKU') }}<input v-model="draft.appearance.sku" aria-label="Edit sales SKU"></label>
      <label>{{ t('Color source', '颜色资料来源') }}<input v-model="draft.appearance.source" aria-label="Edit color source"></label>
    </template>
    <ModuleTooltip v-if="draft.supplier?.source.file" :title="t('Color interpretation', '颜色解释方式')" :description="t('Experimental interpretations do not confirm the source color space. Local HEX overrides take priority.', '试验选项不代表源颜色空间已确认。本地 HEX 调整优先。')" side="left">
      <label>{{ t('Color source', '颜色来源') }}<select v-model="colorMode" data-testid="color-mode"><option value="catalog">{{ draft.supplier?.origin === 'local-usda' ? t('Imported preview HEX', '导入时预览 HEX') : t('Catalog HEX', '表格 HEX（默认）') }}</option><option value="linear-srgb">{{ t('Assume linear sRGB (experimental)', '假设线性 sRGB（试验）') }}</option><option value="srgb">{{ t('Assume sRGB (experimental)', '假设 sRGB（试验）') }}</option></select></label>
    </ModuleTooltip>
    <ModuleTooltip v-if="draft.supplier?.status !== 'unmatched'" :title="t('Local color', '本地颜色')" :description="t('Editing HEX overrides the source color. Restore supplier parameters to discard local adjustments.', '修改 HEX 会覆盖预览颜色。恢复供应商参数可清除本地调整。')" side="left">
      <label>{{ t('sRGB HEX', 'sRGB HEX') }}<div class="color-input"><input v-model="draft.hex" type="color" aria-label="Color"><input v-model="draft.hex" aria-label="HEX" maxlength="7"><span>sRGB</span></div></label>
    </ModuleTooltip>
    <div v-if="draft.supplier?.status !== 'unmatched'" class="rgb-row"><span v-for="(value, index) in rgb(draft.hex)" :key="index">{{ ['R', 'G', 'B'][index] }} <b>{{ value }}</b></span></div>
    <AppearanceBinding :material="draft" :materials="materials" :busy="busy" @update="draft = $event" />
    <details class="appearance-adjustments" :open="!draft.appearanceBinding" @input="markAppearanceOverride">
      <summary>{{ t('Advanced appearance adjustments', '高级外观调整') }}</summary>
    <ModuleTooltip v-for="field in parameters" :key="field.key" :title="field.title" :description="field.description" side="left"><label class="parameter"><span>{{ field.title }}<input v-model.number="draft[field.key]" :aria-label="field.key" type="number" min="0" max="1" step="0.01"></span><input v-model.number="draft[field.key]" type="range" min="0" max="1" step="0.01" :aria-label="`${field.key} slider`"></label></ModuleTooltip>
    <label v-if="directRoughness" class="parameter"><span>{{ t('IOR', '折射率') }}<input v-model.number="draft.ior" type="number" min="1" max="3" step="0.01" aria-label="IOR"></span></label>
    <template v-if="filament && draft.optics">
      <label v-for="field in opticalFields" :key="field.key" class="parameter" :title="t('Demo optical parameter. Thickness is an effective approximation, not measured wall thickness.', '演示光学参数；厚度为等效近似，不是模型实测壁厚。')"><span>{{ field.name }}<input v-model.number="draft.optics[field.key]" type="number" :min="field.min" :max="field.max" :step="field.step" :aria-label="field.key"></span></label>
    </template>
    <p class="render-note">{{ directRoughness ? t('Direct roughness', '直接使用粗糙度') : t('Studio effective roughness', 'Studio 渲染粗糙度') }} <b>{{ effectiveRoughness }}</b></p>
    </details>
    <label class="reference-upload"><img v-if="draft.referenceImage" :src="draft.referenceImage" alt="Material reference">{{ t('＋ Reference image (optional)', '＋ 参考图（可选）') }}<input type="file" accept="image/*" @change="reference"></label>
    <button v-if="supplier" class="secondary" :disabled="busy" @click="restore">{{ t('Restore source parameters', '恢复源参数') }}</button>
    <p v-if="validation" role="alert" class="error-message">{{ validation }}</p>
    <div class="button-row"><button class="secondary" :disabled="busy" @click="close">{{ t('Cancel', '取消') }}</button><button class="primary" :disabled="busy || !!materialProblem(draft)" @click="save">{{ t('Save locally', '保存到本地') }}</button></div>
  </div>
</template>
<style scoped>
.editor-fields select { width: 100%; padding: 8px; border: 1px solid #46484a; border-radius: 6px; background: #27292c; }
.editor-fields input[readonly] { color: #999; }
.appearance-adjustments { display: grid; gap: 12px; }
.appearance-adjustments summary { cursor: pointer; color: #b1b9ac; font-size: 11px; padding: 8px 0; }
</style>
