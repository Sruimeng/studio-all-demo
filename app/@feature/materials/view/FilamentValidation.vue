<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { useLocale } from '~/@base/locale';
import { site } from '~/@base/site';
import { materialSeries, filamentVendors, filamentPreview, createFilamentColor } from '../filaments';
import { cloneMaterial, materialHex } from '../supplier';
import { appearanceTemplates, bindAppearance, inheritAppearance } from '../binding';
import type { FinishId, MaterialRecord } from '../types';
import FilamentSelector from './FilamentSelector.vue';
import FilamentColors from './FilamentColors.vue';
import FilamentColorForm from './FilamentColorForm.vue';
import MaterialEditor from './MaterialEditor.vue';
import AppearanceBinding from './AppearanceBinding.vue';
const props = defineProps<{ materials: MaterialRecord[]; selected: MaterialRecord | null; reference: MaterialRecord | null; busy: boolean; saveMaterial: (material: MaterialRecord) => Promise<boolean> }>();
const emit = defineEmits<{ apply: [material: MaterialRecord]; preview: [material: MaterialRecord | null]; compare: [material: MaterialRecord | null] }>();
const { t } = useLocale();
const vendor = ref<string>(site.vendor ?? 'Polymaker');
const baseMaterial = ref('PLA');
const seriesId = ref(site.seriesId);
const finish = ref<FinishId | undefined>();
const keepColor = ref(true);
const keepFinish = ref(true);
const adding = ref(false);
const editing = shallowRef<MaterialRecord | null>(null);
const series = computed(() => materialSeries.find(item => item.id === seriesId.value));
const colors = computed(() => props.materials.filter(item => {
  const appearance = item.appearance;
  return appearance?.vendor === vendor.value && appearance.baseMaterial === baseMaterial.value && (appearance.seriesId ?? '') === seriesId.value;
}));
watch(() => props.selected, value => {
  adding.value = false;
  const identity = value?.appearance;
  if (!identity || !filamentVendors.includes(identity.vendor)) return;
  vendor.value = identity.vendor; baseMaterial.value = identity.baseMaterial; seriesId.value = identity.seriesId ?? ''; finish.value = identity.templateId;
}, { immediate: true });
function preview() {
  adding.value = false;
  const hex = keepColor.value && props.selected ? materialHex(props.selected) : '#B6B6B6';
  const value = filamentPreview(vendor.value, baseMaterial.value, seriesId.value || undefined, finish.value ?? 'basic', hex);
  emit('apply', props.selected?.appearanceBinding ? inheritAppearance(value, props.selected) : bindAppearance(value, appearanceTemplates.find(item => item.id === `appearance:${finish.value ?? 'basic'}`)!));
}
function selectSeries(id: string) {
  seriesId.value = id;
  finish.value = series.value?.templateId ?? 'basic';
  preview();
}
function selectFamily(nextVendor: string, base: string) {
  vendor.value = nextVendor; baseMaterial.value = base;
  const options = materialSeries.filter(item => item.vendor === nextVendor && item.baseMaterial === base);
  selectSeries((options.find(item => item.templateId === finish.value) ?? options[0])?.id ?? '');
}
function selectColor(color: MaterialRecord) {
  if (keepFinish.value && (props.selected?.appearanceBinding || props.selected?.appearance?.templateId)) {
    emit('apply', inheritAppearance(color, props.selected));
  } else emit('apply', color);
}
function editCurrent() {
  if (!props.selected) return;
  const current = cloneMaterial(props.selected);
  editing.value = current.id.startsWith('preview:') ? createFilamentColor(current, { name: current.name, hex: current.hex, colorCode: current.appearance?.colorCode ?? '', sku: current.appearance?.sku ?? '', source: current.appearance?.source ?? '' }, crypto.randomUUID()) : current;
}
function closeEditor() { editing.value = null; emit('preview', null); }
</script>
<template>
  <aside class="filament-validation">
    <div class="validation-title"><span class="eyebrow">FILAMENT LAB</span><h2>{{ t('Material validation', '材质验证') }}</h2><p>{{ t('Shared finishes. Independent colors.', '通用质感 · 独立颜色') }}</p></div>
    <MaterialEditor v-if="editing" :key="editing.id" :material="editing" :materials="materials" :busy="busy" :save-material="saveMaterial" @close="closeEditor" @preview="emit('preview', $event)" />
    <template v-else>
      <FilamentSelector :vendor="vendor" :base-material="baseMaterial" :series-id="seriesId" :busy="busy" @vendor="selectFamily($event, baseMaterial)" @base="selectFamily(vendor, $event)" @series="selectSeries" />
      <label class="lock-option"><input v-model="keepColor" type="checkbox">{{ t('Keep color when switching series', '切换系列时保持颜色') }}</label>
      <AppearanceBinding v-if="selected" :material="selected" :materials="materials" :busy="busy" @update="emit('apply', $event)" />
      <button v-if="selected && !selected.id.startsWith('preview:')" class="text-button add-color" :disabled="busy" @click="saveMaterial(selected)">{{ t('Save current color and binding locally', '保存当前颜色与绑定到本地') }}</button>
      <section class="finish-section">
        <p v-if="series && !series.templateId" class="preset-note">{{ t('This catalog does not specify a finish. The binding is a local appearance choice.', '该目录未注明具体质感，外观绑定为本地选择。') }}</p>
        <template v-if="series"><a :href="series.source" target="_blank" rel="noopener noreferrer" class="source-link">{{ t('Official series reference', '官方系列资料') }} ↗</a><small v-if="series.aliases?.length" class="alias-note">{{ t('Also known as', '旧称') }} {{ series.aliases.join(' · ') }}</small></template>
        <p v-else class="preset-note">{{ t('Generic experiment. No verified product association.', '通用材质试验，未关联已核实的厂商产品。') }}</p>
      </section>
      <div v-if="selected" class="current-surface">
        <div class="current-heading"><i :style="{ background: materialHex(selected) }" /><span><b>{{ selected.name }}</b><small>{{ materialHex(selected) }} · R {{ selected.roughness.toFixed(2) }} · M {{ selected.metalness.toFixed(2) }}</small></span><button class="text-button" :disabled="busy" @click="editCurrent">{{ t('Adjust', '调整') }}</button></div>
        <p v-if="selected.optics?.transmission" class="preset-note">{{ t('Physical transmission', '物理透射') }} {{ selected.optics.transmission }} · {{ t('Optical thickness', '等效光学厚度') }} {{ selected.optics.thickness }} mm · {{ t('Neutral reference grid', '中性透射参照格') }}</p>
        <button class="compare-action" :disabled="busy" @click="emit('compare', selected)">{{ t('Pin as A · compare with next material', '固定为 A · 与下一款材质对比') }}</button>
      </div>
      <div v-if="reference" class="reference-card"><span>A · {{ reference.appearance?.vendor || reference.supplier?.vendor }} · {{ reference.name }}</span><button class="text-button" :disabled="busy" @click="emit('compare', null)">{{ t('Clear', '清除') }}</button></div>
      <section class="color-section">
        <div class="section-caption"><span>{{ t('SERIES COLORS', '系列颜色') }} <small>{{ colors.length }}</small></span><button class="text-button add-color" :disabled="busy || !selected?.appearance" @click="adding = !adding">{{ adding ? t('Close', '关闭') : t('＋ Add SKU color', '＋ 添加 SKU 颜色') }}</button></div>
        <FilamentColorForm v-if="adding && selected" :key="selected.id" :preview="selected" :materials="materials" :busy="busy" :save-material="saveMaterial" @close="adding = false" />
        <label class="lock-option"><input v-model="keepFinish" type="checkbox">{{ t('Keep finish when switching colors', '切换颜色时保持当前质感') }}</label>
        <FilamentColors :colors="colors" :selected="selected" :busy="busy" @select="selectColor" />
      </section>
    </template>
  </aside>
</template>
<style scoped>
.filament-validation { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #46484a transparent; padding: 18px 15px; color: #eee; }
.validation-title { margin-bottom: 20px; }
.validation-title h2 { font-size: 18px; font-weight: 500; margin: 7px 0; letter-spacing: -.4px; }
.validation-title p { color: #8e959b; font-size: 11px; margin: 0; }
.eyebrow { color: #b9d59a; font: 9px monospace; letter-spacing: 2px; }
.lock-option { display: flex; align-items: center; gap: 7px; color: #9fa4a9; font-size: 10px; margin: 11px 0; }
.lock-option input { accent-color: #c2ef78; }
.finish-section, .color-section { border-top: 1px solid #373b3f; padding-top: 17px; margin-top: 17px; }
.section-caption { display: flex; align-items: center; justify-content: space-between; font-size: 10px; letter-spacing: .6px; margin-bottom: 12px; color: #c7ccd0; }
.section-caption small { font: 9px monospace; color: #858c91; }
.preset-note { color: #939a9e; font-size: 10px; line-height: 1.65; margin: 10px 0 0; }
.source-link { color: #b5c9a0; display: inline-block; font-size: 10px; margin-top: 10px; }
.alias-note { display: block; color: #92998c; font-size: 10px; margin-top: 5px; }
.current-surface { margin-top: 17px; padding: 11px; background: #292e31; border-radius: 7px; }
.current-heading { display: flex; gap: 8px; align-items: center; }
.current-heading i { width: 25px; height: 25px; border-radius: 5px; flex-shrink: 0; }
.current-heading span { min-width: 0; display: grid; gap: 4px; }
.current-heading b { font-size: 11px; overflow-wrap: anywhere; font-weight: 500; }
.current-heading small { font: 9px monospace; color: #9aa3a8; }
.current-heading button { margin-left: auto; flex-shrink: 0; white-space: nowrap; }
.compare-action { margin-top: 12px; padding: 8px; width: 100%; border: 1px solid #56634a; border-radius: 5px; font-size: 10px; color: #c5d8b0; background: #343d2c; }
.reference-card { display: flex; gap: 5px; align-items: center; padding: 10px 0 0; color: #b9cba8; font-size: 10px; line-height: 1.5; }
.reference-card span { flex: 1; overflow-wrap: anywhere; }
.add-color { color: #bdda9d; font-size: 10px; }
</style>
