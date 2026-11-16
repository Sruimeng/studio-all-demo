<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { useLocale } from '~/@base/locale';
import { includesVendor, site } from '~/@base/site';
import { cloneMaterial } from '../supplier';
import { emptyWheelFilters, filterWheelEntries, normalizeWheelFilters, wheelEntries, type WheelFilters } from '../color-wheel';
import type { MaterialRecord } from '../types';
import ColorWheelFilters from './ColorWheelFilters.vue';
import ColorWheelChart from './ColorWheelChart.vue';
import ColorWheelCandidates from './ColorWheelCandidates.vue';
import ColorWheelDetails from './ColorWheelDetails.vue';
import ColorWheelAddColor from './ColorWheelAddColor.vue';
import ColorWheelMaterialPreview from './ColorWheelMaterialPreview.vue';
import MaterialEditor from './MaterialEditor.vue';

const props = defineProps<{ active: boolean; materials: MaterialRecord[]; busy: boolean; saveMaterial: (material: MaterialRecord) => Promise<boolean>; canApply: boolean }>();
const emit = defineEmits<{ apply: [material: MaterialRecord] }>();
const { t } = useLocale();
const filters = shallowRef<WheelFilters>({ ...emptyWheelFilters(), vendor: site.vendor ?? '' });
const selectedId = shallowRef('');
const draft = shallowRef<MaterialRecord | null>(null);
const editing = shallowRef<MaterialRecord | null>(null);
const adding = shallowRef(false);
const editorPreview = shallowRef<MaterialRecord | null>(null);
const addPreview = shallowRef<MaterialRecord | null>(null);
const failure = shallowRef('');
const saving = shallowRef(false);
const busy = computed(() => props.busy || saving.value);
const entries = computed(() => wheelEntries(props.materials).filter(entry => includesVendor(entry.vendor)));
const visible = computed(() => filterWheelEntries(entries.value, filters.value, site.vendor));
const selected = computed(() => visible.value.find(entry => entry.id === selectedId.value) ?? null);
const selectedMaterial = computed(() => selected.value?.material ?? null);
const detail = computed(() => draft.value ?? selectedMaterial.value);
const preview = computed(() => adding.value ? addPreview.value : editing.value ? editorPreview.value : detail.value);
const changed = computed(() => !!draft.value && JSON.stringify(draft.value) !== JSON.stringify(selectedMaterial.value));
watch(visible, values => {
  if (!values.some(entry => entry.id === selectedId.value)) selectedId.value = values[0]?.id ?? '';
}, { immediate: true });
watch(selectedMaterial, () => { draft.value = null; });
function changeFilters(next: WheelFilters) {
  filters.value = normalizeWheelFilters(entries.value, { ...next, vendor: site.vendor ?? next.vendor });
  adding.value = false;
}
function resetFilters() { changeFilters({ ...emptyWheelFilters(), vendor: site.vendor ?? '' }); }
function select(id: string) { selectedId.value = id; adding.value = false; editing.value = null; }
function add() {
  if (busy.value) return;
  failure.value = '';
  editing.value = null;
  addPreview.value = null;
  adding.value = true;
}
async function save(material: MaterialRecord): Promise<boolean> {
  if (busy.value) return false;
  const creating = adding.value;
  saving.value = true; failure.value = '';
  try {
    const success = await props.saveMaterial(material);
    if (!success) { failure.value = t('Color could not be saved. Your model has not been changed. Please retry.', '颜色保存失败，模型未更改。请重试。'); return false; }
    if (creating) {
      filters.value = { ...emptyWheelFilters(), vendor: material.appearance!.vendor, base: material.appearance!.baseMaterial, series: material.appearance!.seriesId ?? '' };
      adding.value = false;
    }
    if (creating || selectedId.value === material.id) {
      selectedId.value = material.id;
      draft.value = null;
    }
    return true;
  } catch (error) {
    failure.value = error instanceof Error ? error.message : String(error);
    return false;
  } finally { saving.value = false; }
}
function edit() { if (detail.value) { adding.value = false; editing.value = cloneMaterial(detail.value); editorPreview.value = editing.value; } }
</script>

<template>
  <section class="color-wheel-workspace" data-testid="color-wheel-workspace" :aria-label="t('Color wheel workspace', '色轮工作区')">
    <header class="wheel-header"><div><span class="wheel-eyebrow">MATERIAL COLOR ATLAS</span><h1>{{ t('Color wheel', '色轮') }} <small data-testid="wheel-count">{{ visible.length }} {{ t('color records', '条颜色记录') }}</small></h1></div><button class="add-color-button" type="button" :disabled="busy" @click="add">{{ t('＋ Add color', '＋ 添加颜色') }}</button></header>
    <slot name="status" />
    <div v-if="failure" class="wheel-error" role="alert">{{ failure }}<button type="button" :aria-label="t('Dismiss error', '关闭错误')" @click="failure = ''">×</button></div>
    <div class="wheel-content">
      <ColorWheelFilters :entries="entries" :filters="filters" :busy="busy" @change="changeFilters" @reset="resetFilters" />
      <div class="wheel-main">
        <ColorWheelChart :entries="visible" :layout-entries="entries" :vendor="filters.vendor || site.vendor || ''" :selected="selectedId" @select="select" />
        <ColorWheelCandidates v-if="visible.length" :entries="visible" :selected="selectedId" @select="select" />
        <div v-else class="wheel-empty"><span class="empty-wheel">◯</span><h2>{{ t('No color records', '暂无颜色记录') }}</h2><p>{{ t('No supplied colors match these filters. Clear the filters or add a custom color for this series.', '当前筛选没有颜色。请清除筛选，或为该系列添加自定义颜色。') }}</p><button type="button" @click="resetFilters">{{ t('Clear filters', '清除筛选') }}</button></div>
      </div>
      <aside class="wheel-inspector">
        <ColorWheelMaterialPreview v-if="active" :material="preview" :drafting="adding || !!editing" />
        <div class="inspector-content">
          <template v-if="editing"><p class="inspector-note">{{ t('Library only · model changes require Apply.', '仅编辑材质库 · 应用后才修改模型。') }}</p><MaterialEditor :key="editing.id" :material="editing" :materials="materials" :busy="busy" :save-material="save" @preview="editorPreview = $event" @close="editing = null" /></template>
          <ColorWheelAddColor v-else-if="adding" :initial-filters="filters" :entries="entries" :materials="materials" :selected="detail" :busy="busy" :save-material="save" @preview="addPreview = $event" @close="adding = false" />
          <ColorWheelDetails v-else-if="selected && detail" :entry="selected" :material="detail" :materials="materials" :busy="busy" :can-apply="canApply" :changed="changed" @update="draft = $event" @save="save(detail)" @edit="edit" @apply="emit('apply', $event)" />
          <p v-else class="inspector-note">{{ t('Select a color record to inspect source values and appearance bindings.', '选择颜色记录，查看源色值与外观绑定。') }}</p>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.color-wheel-workspace { min-width: 0; min-height: 0; display: flex; flex-direction: column; background: #1a1e21; color: #e6ecef; border: 1px solid #32383c; border-radius: 0 18px 18px 0; overflow: hidden; }
.wheel-header { display: flex; gap: 18px; align-items: center; justify-content: space-between; padding: 20px 25px; border-bottom: 1px solid #343b40; background: #22272a; }
.wheel-eyebrow { color: #a2bc86; font: 9px monospace; letter-spacing: 2px; }
.wheel-header h1 { margin-top: 6px; font-size: 22px; font-weight: 500; letter-spacing: -.4px; }
.wheel-header small { color: #8f9ba2; font-size: 11px; font-weight: 400; margin-left: 14px; letter-spacing: 0; }
.add-color-button { background: #c2ef78; color: #1e2915; border-radius: 6px; padding: 11px 15px; font-size: 11px; white-space: nowrap; }
.wheel-content { flex: 1; min-height: 0; display: grid; grid-template-columns: 220px minmax(0, 1fr) 290px; }
.wheel-main { min-width: 0; min-height: 0; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; background: #202528; color: #e2e7e8; }
.wheel-inspector { min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; padding: 18px 12px; background: #23292d; border-left: 1px solid #343c41; scrollbar-width: thin; }
.wheel-inspector > .wheel-material-preview { flex-shrink: 0; }
.inspector-content { min-height: 120px; overflow-y: auto; scrollbar-width: thin; }
.inspector-note { color: #9ba9b2; font-size: 10px; line-height: 1.8; margin-bottom: 16px; overflow-wrap: anywhere; }
.wheel-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 22px; background: #613a35; color: #f3ccc6; font-size: 11px; }
.wheel-empty { padding: 28px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; }
.empty-wheel { color: #758665; font-size: 90px; }
.wheel-empty h2 { font-size: 18px; font-weight: 400; }
.wheel-empty p { max-width: 320px; color: #8d9aa3; font-size: 11px; line-height: 1.8; }
.wheel-empty button { color: #c2ddaa; font-size: 11px; }
@media (max-width: 1200px) { .wheel-content { grid-template-columns: 190px minmax(0, 1fr) 255px; } .wheel-header { padding: 16px 18px; } }
@media (max-width: 900px) { .wheel-content { grid-template-columns: 175px minmax(0, 1fr); overflow-y: auto; } .wheel-inspector { grid-column: 1 / -1; display: block; overflow: visible; border-top: 1px solid #343c41; } .inspector-content { overflow: visible; } .wheel-main { overflow-y: visible; overflow-x: clip; } .wheel-header small { display: block; margin: 7px 0 0; } }
</style>
