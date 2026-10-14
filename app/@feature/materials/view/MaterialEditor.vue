<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { useLocale } from '~/@base/locale';
import ModuleTooltip from '~/@base/ui/ModuleTooltip.vue';
import { validateMaterial, rgb } from '../catalog';
import { cloneMaterial, restoreSupplier, withOverrides, materialProblem } from '../supplier';
import { OPENPBR_RULE, type MaterialRecord, type ColorMode } from '../types';
import SupplierDetail from './SupplierDetail.vue';

const props = defineProps<{ material: MaterialRecord; materials: MaterialRecord[]; busy: boolean; saveMaterial: (material: MaterialRecord) => Promise<boolean> }>();
const emit = defineEmits<{ close: []; preview: [material: MaterialRecord | null] }>();
const { t } = useLocale();
const draft = ref(cloneMaterial(props.material));
const validation = shallowRef('');
const supplier = computed(() => !!draft.value.supplier);
const openpbr = computed(() => draft.value.renderRule === OPENPBR_RULE);
const effectiveRoughness = computed(() => Number.isFinite(draft.value.roughness) ? (openpbr.value ? draft.value.roughness : 0.5 + draft.value.roughness * 0.5).toFixed(3) : '—');
const colorMode = computed({ get: () => draft.value.overrides?.colorMode ?? (draft.value.supplier?.origin === 'local-usda' ? 'linear-srgb' : 'catalog'), set: (value: ColorMode) => { draft.value.overrides = { ...draft.value.overrides, colorMode: value }; } });
const parameters = computed(() => [
  { key: 'transparency' as const, title: t('Transparency', '透明度'), description: t('Preview opacity equals 1 minus transparency. This is not transmission.', '预览不透明度等于 1 减透明度，不等同于物理透射。') },
  { key: 'metalness' as const, title: t('Metalness', '金属度'), description: t('0 is dielectric; 1 is metallic.', '0 为非金属，1 为金属。') },
  { key: 'roughness' as const, title: t('Roughness', '粗糙度'), description: openpbr.value ? t('Used directly by the OpenPBR subset preview.', 'OpenPBR 子集预览直接使用此值。') : t('Studio uses 0.5 + 0.5 × input roughness.', 'Studio 使用 0.5 + 0.5 × 输入粗糙度。') },
]);
function restore() { draft.value = restoreSupplier(draft.value); validation.value = ''; }
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
    <ModuleTooltip v-if="draft.supplier?.source.file" :title="t('Color interpretation', '颜色解释方式')" :description="t('Experimental interpretations do not confirm the source color space. Local HEX overrides take priority.', '试验选项不代表源颜色空间已确认。本地 HEX 调整优先。')" side="left">
      <label>{{ t('Color source', '颜色来源') }}<select v-model="colorMode" data-testid="color-mode"><option value="catalog">{{ draft.supplier?.origin === 'local-usda' ? t('Imported preview HEX', '导入时预览 HEX') : t('Catalog HEX', '表格 HEX（默认）') }}</option><option value="linear-srgb">{{ t('Assume linear sRGB (experimental)', '假设线性 sRGB（试验）') }}</option><option value="srgb">{{ t('Assume sRGB (experimental)', '假设 sRGB（试验）') }}</option></select></label>
    </ModuleTooltip>
    <ModuleTooltip v-if="draft.supplier?.status !== 'unmatched'" :title="t('Local color', '本地颜色')" :description="t('Editing HEX overrides the source color. Restore supplier parameters to discard local adjustments.', '修改 HEX 会覆盖预览颜色。恢复供应商参数可清除本地调整。')" side="left">
      <label>{{ t('sRGB HEX', 'sRGB HEX') }}<div class="color-input"><input v-model="draft.hex" type="color" aria-label="Color"><input v-model="draft.hex" aria-label="HEX" maxlength="7"><span>sRGB</span></div></label>
    </ModuleTooltip>
    <div v-if="draft.supplier?.status !== 'unmatched'" class="rgb-row"><span v-for="(value, index) in rgb(draft.hex)" :key="index">{{ ['R', 'G', 'B'][index] }} <b>{{ value }}</b></span></div>
    <ModuleTooltip v-for="field in parameters" :key="field.key" :title="field.title" :description="field.description" side="left"><label class="parameter"><span>{{ field.title }}<input v-model.number="draft[field.key]" :aria-label="field.key" type="number" min="0" max="1" step="0.01"></span><input v-model.number="draft[field.key]" type="range" min="0" max="1" step="0.01" :aria-label="`${field.key} slider`"></label></ModuleTooltip>
    <label v-if="openpbr" class="parameter"><span>{{ t('IOR', '折射率') }}<input v-model.number="draft.ior" type="number" min="1" max="3" step="0.01" aria-label="IOR"></span></label>
    <p class="render-note">{{ openpbr ? t('Direct roughness', '直接使用粗糙度') : t('Studio effective roughness', 'Studio 渲染粗糙度') }} <b>{{ effectiveRoughness }}</b></p>
    <label class="reference-upload"><img v-if="draft.referenceImage" :src="draft.referenceImage" alt="Material reference">{{ t('＋ Reference image (optional)', '＋ 参考图（可选）') }}<input type="file" accept="image/*" @change="reference"></label>
    <button v-if="supplier" class="secondary" :disabled="busy" @click="restore">{{ t('Restore source parameters', '恢复源参数') }}</button>
    <p v-if="validation" role="alert" class="error-message">{{ validation }}</p>
    <div class="button-row"><button class="secondary" :disabled="busy" @click="close">{{ t('Cancel', '取消') }}</button><button class="primary" :disabled="busy || !!materialProblem(draft)" @click="save">{{ t('Save locally', '保存到本地') }}</button></div>
  </div>
</template>
<style scoped>
.editor-fields select { width: 100%; padding: 8px; border: 1px solid #46484a; border-radius: 6px; background: #27292c; }
.editor-fields input[readonly] { color: #999; }
</style>
