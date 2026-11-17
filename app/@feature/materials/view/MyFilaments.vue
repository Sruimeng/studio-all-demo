<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useLocale } from '~/@base/locale';
import { FilamentSample } from '~/@engine/viewer';
import { colorQuery, customFilament, filamentBrand, filamentDescription, filamentName, filamentSubtitle, filamentType, filamentTypes } from '../filaments';
import { emptyFilamentFilters, filamentAttribute, filamentColorsFor, filamentFilterOptions, filamentGroupKey, groupFilaments, type FilamentFilterKey, type FilamentGroup } from '../filament-browser';
import { materialHex, materialSurface } from '../supplier';
import { OPENPBR_RULE, type MaterialRecord } from '../types';

const props = defineProps<{ catalog: MaterialRecord[]; ownedIds: string[]; busy: boolean; addFilament: (material: MaterialRecord) => Promise<boolean> }>();
const emit = defineEmits<{ close: []; 'update:ownedIds': [ids: string[]] }>();
const locale = useLocale(), { t, tr } = locale;
const mode = ref<'owned' | 'filter' | 'preview' | 'custom'>('owned');
const selectedId = ref(''), chosenBrand = ref(''), chosenType = ref('');
const lastViewed = new Map<string, string>();
const name = ref(''), type = ref('PLA'), color = ref('#A6B441'), saving = ref(false), error = ref(false);
const deleting = ref<MaterialRecord | null>(null);
const panel = useTemplateRef<HTMLDialogElement>('panel'), confirmation = useTemplateRef<HTMLDialogElement>('confirmation');
const ownedList = useTemplateRef<HTMLDivElement>('ownedList'), resultsList = useTemplateRef<HTMLDivElement>('resultsList');
const typeInput = useTemplateRef<HTMLSelectElement>('typeInput'), nameInput = useTemplateRef<HTMLInputElement>('nameInput');
const owned = computed(() => props.ownedIds.flatMap(id => { const material = props.catalog.find(item => item.id === id); return material ? [material] : []; }));
const ownedGroups = computed(() => groupFilaments(owned.value));
const colorsReady = computed(() => !!chosenBrand.value && !!chosenType.value);
const results = computed(() => filamentColorsFor(props.catalog, chosenBrand.value, chosenType.value));
const selected = computed(() => props.catalog.find(item => item.id === selectedId.value));
const selectedGroupId = computed(() => selected.value ? filamentGroupKey(selected.value) : '');
const detailKeys: FilamentFilterKey[] = ['brand', 'series', 'material', 'finish'];
const isOwned = computed(() => !!selected.value && props.ownedIds.includes(selected.value.id));
const validColor = computed(() => colorQuery(color.value));
const automaticName = computed(() => `${type.value} ${validColor.value || '#A6B441'}`);
const materialTypes = computed(() => [...new Set([...filamentTypes, ...props.catalog.map(filamentType).filter(Boolean)])]);
const surface = computed(() => mode.value !== 'custom' && selected.value ? materialSurface(selected.value) : {
  hex: mode.value === 'custom' ? validColor.value || '#A6B441' : '#919397',
  transparency: 0, metalness: 0, roughness: .45, renderRule: OPENPBR_RULE,
});
const labels = computed(() => ({ brand: t('Brand', '品牌'), material: t('Material', '材质'), finish: t('Finish', '光泽'), series: t('Series', '系列') }));
const brands = computed(() => filamentFilterOptions(props.catalog, emptyFilamentFilters(), 'brand'));
const brandTypes = computed(() => filamentFilterOptions(props.catalog, { ...emptyFilamentFilters(), brand: chosenBrand.value }, 'material'));
const displayName = (material: MaterialRecord) => tr(filamentName(material, locale.language === 'en'));
const swatchLabel = (material: MaterialRecord) => [filamentBrand(material), filamentDescription(material), displayName(material), materialHex(material), props.ownedIds.includes(material.id) ? t('Owned', '已拥有') : ''].filter(Boolean).join(' · ');
function attributeLabel(key: FilamentFilterKey, value: string) {
  if (key !== 'finish') return tr(value || '—');
  const finishes: Record<string, string> = { matte: t('Matte', '哑光'), silk: t('Silk', '丝绸'), glossy: t('Glossy', '亮光'), satin: t('Satin', '缎面'), metallic: t('Metallic', '金属光泽'), unspecified: '—' };
  return finishes[value] || tr(value || '—');
}
function detailValue(key: FilamentFilterKey) {
  if (mode.value === 'custom') return key === 'material' ? type.value : key === 'brand' ? t('Custom', '自定义') : '—';
  return selected.value ? attributeLabel(key, filamentAttribute(selected.value, key)) : '—';
}
function groupTitle(group: FilamentGroup) {
  return [group.custom ? t('Custom', '自定义') : tr(group.brand) || t('Unbranded', '未标注品牌'), group.material,
    !group.custom && group.finish !== 'unspecified' ? attributeLabel('finish', group.finish) : '',
    group.showSeries ? tr(group.series) || t('Unspecified series', '未标注系列') : '',
  ].filter(Boolean).join(' ');
}
let previousFocus: HTMLElement | null = null;
onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (owned.value[0]) chooseOwned(owned.value[0]);
  else mode.value = 'filter';
  panel.value?.showModal();
  panel.value?.focus({ preventScroll: true });
});
onBeforeUnmount(() => {
  confirmation.value?.close(); panel.value?.close();
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
});
watch(deleting, async value => {
  error.value = false;
  if (value) { await nextTick(); confirmation.value?.showModal(); }
  else confirmation.value?.close();
});
function close() { if (!saving.value && !deleting.value) emit('close'); }
function clearColor() {
  selectedId.value = ''; mode.value = 'filter'; error.value = false;
  if (resultsList.value) resultsList.value.scrollTop = 0;
}
async function changeBrand(value: string) {
  chosenBrand.value = value; chosenType.value = ''; clearColor();
  await nextTick(); typeInput.value?.focus();
}
function changeType(value: string) { chosenType.value = value; clearColor(); }
function editChoices() { if (!saving.value) clearColor(); }
function choose(material: MaterialRecord, source: 'owned' | 'preview') {
  if (saving.value) return;
  selectedId.value = material.id; mode.value = source; error.value = false;
  lastViewed.set(filamentGroupKey(material), material.id);
}
function chooseOwned(material: MaterialRecord) {
  if (saving.value) return;
  choose(material, 'owned');
}
function chooseGroup(group: FilamentGroup) {
  const material = group.materials.find(item => item.id === lastViewed.get(group.id)) || group.materials[0];
  if (material) chooseOwned(material);
}
function saveOwned(ids: string[]) {
  try { window.localStorage.setItem('tripo-owned-filaments', JSON.stringify(ids)); emit('update:ownedIds', ids); error.value = false; return true; }
  catch { error.value = true; return false; }
}
async function scrollToAdded() {
  await nextTick();
  const swatch = [...(ownedList.value?.querySelectorAll<HTMLElement>('[data-material-id]') || [])].find(element => element.dataset.materialId === selectedId.value);
  swatch?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function addSelected() {
  if (!selected.value || isOwned.value || saving.value) return;
  if (saveOwned([...props.ownedIds, selected.value.id])) void scrollToAdded();
}
async function startCreate() {
  if (saving.value) return;
  color.value = selected.value ? materialHex(selected.value) : '#A6B441';
  type.value = chosenType.value || (selected.value && filamentType(selected.value)) || 'PLA';
  name.value = ''; selectedId.value = ''; mode.value = 'custom'; error.value = false;
  await nextTick(); nameInput.value?.focus();
}
async function create() {
  if (!type.value || !validColor.value || saving.value || props.busy) return;
  saving.value = true; error.value = false;
  try {
    const material = customFilament(name.value.trim() || automaticName.value, type.value, validColor.value);
    if (!await props.addFilament(material)) { error.value = true; return; }
    // Keep the saved record selectable even if persisting ownership needs a retry.
    lastViewed.set(filamentGroupKey(material), material.id);
    selectedId.value = material.id; mode.value = 'preview';
    if (saveOwned([...props.ownedIds, material.id])) await scrollToAdded();
  } catch { error.value = true; }
  finally { saving.value = false; }
}
function remove() {
  const material = deleting.value;
  if (!material) return;
  const remaining = props.ownedIds.filter(id => id !== material.id);
  if (saveOwned(remaining)) {
    if (mode.value === 'owned' && selectedId.value === material.id) {
      const next = owned.value.find(item => item.id !== material.id && filamentGroupKey(item) === filamentGroupKey(material)) || owned.value.find(item => item.id !== material.id);
      if (next) chooseOwned(next);
      else editChoices();
    }
    deleting.value = null;
  }
}
</script>

<template>
  <Teleport to="body">
    <dialog id="my-filaments-panel" ref="panel" class="my-filaments" aria-labelledby="my-filaments-title" tabindex="-1" @cancel.prevent="close" @keydown.stop @dragover.prevent.stop @drop.prevent.stop>
      <header class="filaments-header">
        <h2 id="my-filaments-title">{{ t('My filaments', '我的耗材') }}</h2>
        <button class="icon-button close-button" type="button" :disabled="saving" :aria-label="t('Close my filaments', '关闭我的耗材')" @click="close"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
      </header>
      <div class="filaments-columns">
        <section class="filaments-library" :aria-label="t('My filaments', '我的耗材')">
          <div ref="ownedList" class="owned-list">
            <p v-if="!owned.length" class="empty-state">{{ t('No filaments yet', '暂无耗材') }}</p>
            <section v-for="group in ownedGroups" :key="group.id" class="owned-group" :class="{ active: selectedGroupId === group.id }" :aria-label="groupTitle(group)">
              <button class="group-title" type="button" :disabled="saving" :title="group.series || groupTitle(group)" :aria-pressed="selectedGroupId === group.id" @click="chooseGroup(group)">
                {{ groupTitle(group) }}
              </button>
              <div class="owned-colors" role="group" :aria-label="`${groupTitle(group)} · ${t('Owned colors', '已有颜色')}`">
                <button v-for="material in group.materials" :key="material.id" class="color-option owned-color" type="button" :data-material-id="material.id" :disabled="saving" :class="{ selected: selectedId === material.id }" :aria-pressed="selectedId === material.id" :aria-label="`${t('View filament', '查看耗材')} ${swatchLabel(material)}`" :title="`${displayName(material)} · ${materialHex(material)} · ${material.materialId}`" @click="chooseOwned(material)"><i :style="{ background: materialHex(material) }" /></button>
              </div>
            </section>
          </div>
          <div class="add-area">
            <div class="add-heading-row">
              <h3 class="add-heading">{{ t('Add filament', '添加耗材') }}</h3>
              <button v-if="mode === 'custom'" class="text-button" type="button" :disabled="saving" @click="editChoices">{{ t('Back', '返回') }}</button>
            </div>
            <template v-if="mode !== 'custom'">
              <div class="catalog-filters">
                <span class="select-wrap">
                  <select :value="chosenBrand" :disabled="saving" :aria-label="t('Choose a brand', '选择品牌')" @change="changeBrand(($event.target as HTMLSelectElement).value)">
                    <option value="">{{ t('Choose a brand', '选择品牌') }}</option>
                    <option v-for="brand in brands" :key="brand" :value="brand">{{ tr(brand) }}</option>
                  </select>
                  <svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>
                </span>
                <span class="select-wrap">
                  <select ref="typeInput" :value="chosenType" :disabled="saving || !chosenBrand" :aria-label="t('Choose a material', '选择材质')" @change="changeType(($event.target as HTMLSelectElement).value)">
                    <option value="">{{ t('Choose a material', '选择材质') }}</option>
                    <option v-for="item in brandTypes" :key="item" :value="item">{{ tr(item) }}</option>
                  </select>
                  <svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>
                </span>
              </div>
              <section ref="resultsList" class="color-results" :aria-label="t('Filament colors', '耗材颜色')">
                <div v-if="results.length" class="color-grid" role="group" :aria-label="t('Choose a color', '选择颜色')">
                  <button v-for="material in results" :key="material.id" class="color-option" type="button" :disabled="saving" :class="{ selected: selectedId === material.id }" :aria-pressed="selectedId === material.id" :aria-label="swatchLabel(material)" :title="swatchLabel(material)" @click="choose(material, 'preview')">
                    <i :style="{ background: materialHex(material) }" />
                    <span v-if="ownedIds.includes(material.id)" class="owned-check"><svg viewBox="0 0 16 16"><path d="m4 8 3 3 5-6" /></svg></span>
                  </button>
                </div>
                <p v-else-if="colorsReady" class="empty-state">{{ t('No matching colors', '未找到匹配颜色') }}</p>
              </section>
              <button class="custom-button" type="button" :disabled="saving" @click="startCreate"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>{{ t('Custom filament', '自定义耗材') }}</button>
            </template>
            <template v-else>
              <form id="custom-filament-form" class="custom-fields" @submit.prevent="create">
                <label class="attribute-row"><span>{{ t('Name', '名称') }}</span><input ref="nameInput" v-model="name" maxlength="80" :placeholder="automaticName" :disabled="saving" :aria-label="t('Filament name', '耗材名称')"></label>
                <label class="attribute-row"><span>{{ t('Material', '材质') }}</span><span class="select-wrap"><select v-model="type" :disabled="saving" :aria-label="t('Filament material', '耗材材质')"><option v-for="item in materialTypes" :key="item">{{ item }}</option></select><svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></span></label>
                <label class="attribute-row"><span>{{ t('Color', '颜色') }}</span><span class="color-fields"><input :value="validColor || '#A6B441'" type="color" :disabled="saving" :aria-label="t('Choose color', '选择颜色')" @input="color = ($event.target as HTMLInputElement).value.toUpperCase()"><input v-model="color" :disabled="saving" maxlength="7" spellcheck="false" aria-label="HEX" :aria-invalid="!validColor"></span></label>
              </form>
            </template>
          </div>
        </section>
        <section class="filament-inspector" :aria-label="t('Filament preview and details', '耗材预览与信息')">
          <FilamentSample :surface="surface" :label="t('Filament sample', '耗材样件')" />
          <dl class="detail-fields">
            <div v-for="key in detailKeys" :key="key" class="attribute-row"><dt>{{ labels[key] }}</dt><dd>{{ detailValue(key) }}</dd></div>
            <div class="attribute-row"><dt>SKU</dt><dd>{{ selected?.supplier?.sku || (selected && !selected.filament ? selected.materialId : '—') }}</dd></div>
            <div class="attribute-row"><dt>{{ t('Color', '颜色') }}</dt><dd>{{ mode === 'custom' ? validColor || '—' : selected ? materialHex(selected) : '—' }}</dd></div>
          </dl>
          <footer class="inspector-footer">
            <p v-if="error && !deleting" class="save-error" role="alert">{{ t('Could not save. Please try again.', '保存失败，请重试。') }}</p>
            <div v-if="mode !== 'custom'" class="filament-actions">
              <button v-if="isOwned && selected" class="remove-filament" type="button" :disabled="saving" :aria-label="`${t('Delete', '删除')} ${displayName(selected)}`" @click="deleting = selected"><svg viewBox="0 0 24 24"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></svg>{{ t('Delete', '删除') }}</button>
              <button class="primary-button" type="button" :class="{ added: isOwned }" :disabled="!selected || isOwned || saving" @click="addSelected"><svg viewBox="0 0 24 24"><path v-if="isOwned" d="m5 12 4 4L19 6" /><path v-else d="M12 5v14M5 12h14" /></svg>{{ isOwned ? t('Added', '已添加') : t('Add to My Filaments', '添加到我的耗材') }}</button>
            </div>
            <button v-else class="primary-button" type="submit" form="custom-filament-form" :disabled="!validColor || !type || saving || busy"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>{{ saving ? t('Adding…', '添加中…') : t('Add to My Filaments', '添加到我的耗材') }}</button>
          </footer>
        </section>
      </div>
    </dialog>
    <dialog ref="confirmation" class="filament-confirm" aria-labelledby="filament-delete-title" @cancel.prevent="deleting = null" @keydown.stop>
      <template v-if="deleting">
        <h2 id="filament-delete-title">{{ t('Delete filament?', '确认删除耗材？') }}</h2>
        <div class="delete-material"><i class="swatch" :style="{ backgroundColor: materialHex(deleting) }" /><span>{{ displayName(deleting) }}<small>{{ tr(filamentSubtitle(deleting, t('Custom', '自定义'))) }}</small></span></div>
        <p v-if="error" class="save-error" role="alert">{{ t('Could not save. Please try again.', '保存失败，请重试。') }}</p>
        <div class="confirm-actions"><button type="button" autofocus @click="deleting = null">{{ t('Cancel', '取消') }}</button><button class="confirm-delete" type="button" @click="remove">{{ t('Delete', '删除') }}</button></div>
      </template>
    </dialog>
  </Teleport>
</template>

<style scoped>
.my-filaments { margin: auto; padding: 0; width: min(960px, calc(100vw - 48px)); height: min(700px, calc(100dvh - 48px)); max-width: none; max-height: none; border: 1px solid #ffffff08; border-radius: 30px; background: #292a2c; color: #eeeef0; box-shadow: 0 28px 100px #0008; overflow: hidden; outline: none; }
.my-filaments[open] { display: flex; flex-direction: column; }
.my-filaments::backdrop { background: #08090e99; backdrop-filter: blur(5px); }
.filaments-header { display: flex; align-items: center; justify-content: space-between; padding: 25px 28px 22px; flex: none; }
.filaments-header h2, .add-heading { font-size: 20px; font-weight: 400; }
.icon-button { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border-radius: 7px; color: #999ba3; flex: none; }
.icon-button:hover { background: #ffffff09; color: #fff; }
.my-filaments svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.close-button svg { width: 22px; height: 22px; }
.filaments-columns { display: grid; grid-template-columns: minmax(0, 1.04fr) minmax(0, 1fr); gap: 30px; padding: 0 28px 28px; min-height: 0; flex: 1; }
.filaments-library, .filament-inspector { min-height: 0; min-width: 0; display: flex; flex-direction: column; }
.owned-list { flex: 1 1 220px; min-height: 72px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #55575d transparent; }
.owned-group { padding: 3px 3px 14px; }
.owned-group + .owned-group { margin-top: 7px; }
.group-title { display: block; width: 100%; padding: 0; color: #e5e5e8; font-size: 17px; font-weight: 400; line-height: 25px; text-align: left; overflow-wrap: anywhere; }
.group-title:hover { color: #fff; }
.owned-colors { display: flex; flex-wrap: wrap; gap: 10px; padding: 3px; margin-top: 6px; }
.owned-colors .owned-color { flex: none; }
.swatch { display: block; width: 24px; height: 24px; border-radius: 50%; box-shadow: inset 0 0 0 1px #ffffff12; flex: none; }
.empty-state { padding: 14px 8px; color: #92949c; text-align: center; font-size: 12px; }
.add-area { display: flex; flex-direction: column; gap: 20px; padding-top: 20px; border-top: 1px solid #ffffff24; height: 320px; box-sizing: border-box; flex: none; min-height: 0; }
.add-heading-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 30px; flex: none; }
input::placeholder { color: #76777b; }
.catalog-filters { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; flex: none; }
.select-wrap { position: relative; display: flex; align-items: center; min-width: 0; }
.select-wrap svg { position: absolute; right: 16px; width: 15px; height: 15px; color: #d1d1d5; pointer-events: none; }
.select-wrap select { appearance: none; width: 100%; min-width: 0; height: 58px; border: 1px solid transparent; border-radius: 13px; padding: 0 38px 0 18px; background: #ffffff05; color: #e2e2e8; text-align: left; text-overflow: ellipsis; cursor: pointer; font-size: 16px; }
.select-wrap select:hover:enabled { background: #ffffff0a; }
.select-wrap select:focus-visible { outline: 1px solid #ffffff70; outline-offset: 2px; }
select option { background: #292a2c; color: #e2e2e8; }
.color-results { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; overscroll-behavior: contain; scrollbar-color: #55575d transparent; padding: 4px; }
.color-grid { display: grid; grid-template-columns: repeat(auto-fill, 24px); gap: 10px; }
.color-option { position: relative; padding: 0; width: 24px; height: 24px; min-width: 0; aspect-ratio: 1; border: 0; border-radius: 50%; }
.color-option > i { display: block; width: 100%; height: 100%; border-radius: 50%; box-shadow: inset 0 0 0 1px #ffffff12; }
.color-option:hover { outline: 1px solid #ffffff80; outline-offset: 2px; }
.color-option.selected { outline: 2px solid #ededf2; outline-offset: 2px; }
.owned-check { position: absolute; right: -2px; bottom: -2px; display: grid; place-items: center; width: 12px; height: 12px; border-radius: 50%; border: 1px solid #292a2c; background: #ededf2; color: #25252c; }
.owned-check svg { width: 10px; height: 10px; stroke-width: 2; }
.custom-button { display: flex; align-items: center; justify-content: center; gap: 5px; width: 100%; min-height: 48px; border: 1px solid #ffffff12; border-radius: 13px; font-size: 16px; flex: none; }
.custom-button:hover { border-color: #ffffff40; background: #ffffff04; }
.custom-button svg { width: 18px; height: 18px; }
.filament-inspector :deep(.filament-sample) { height: 250px; min-height: 140px; flex: 1 1 250px; max-height: 260px; border-radius: 20px; }
.detail-fields { display: grid; gap: 4px; margin: 16px 0 0; flex: none; }
.attribute-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; min-height: 38px; font-size: 16px; }
.attribute-row > span:first-child, .attribute-row dt { color: #9b9b9f; flex: none; }
.attribute-row dd { text-align: right; min-width: 0; overflow-wrap: anywhere; }
.text-button { padding: 3px 0; color: #bbbcc3; font-size: 13px; }
.text-button:hover { color: #fff; }
.custom-fields { display: grid; gap: 10px; }
.custom-fields .attribute-row { font-size: 14px; }
.custom-fields .attribute-row > input, .custom-fields .select-wrap { width: 70%; min-width: 0; }
.custom-fields input:not([type=color]), .custom-fields select { height: 38px; border: 1px solid #ffffff10; border-radius: 8px; padding: 0 10px; background: #202124; font-size: 14px; text-align: left; }
.custom-fields select { padding-right: 32px; }
.custom-fields input[aria-invalid=true] { border-color: #d98282; }
.color-fields { display: flex; align-items: center; gap: 8px; width: 70%; }
.color-fields input[type=color] { width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%; background: none; flex: none; cursor: pointer; }
.color-fields input[type=color]::-webkit-color-swatch-wrapper { padding: 0; }
.color-fields input[type=color]::-webkit-color-swatch { border: 1px solid #ffffff20; border-radius: 50%; }
.color-fields input[type=color]::-moz-color-swatch { border: 1px solid #ffffff20; border-radius: 50%; }
.color-fields input:not([type=color]) { width: 100%; min-width: 0; }
.inspector-footer { margin-top: auto; padding-top: 16px; display: flex; flex-direction: column; align-items: flex-end; flex: none; }
.filament-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.remove-filament { display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 40px; padding: 0 14px; border: 1px solid #ffffff16; border-radius: 24px; color: #aaaab3; font-size: 13px; }
.remove-filament:hover { color: #f2a5a5; border-color: #f2a5a544; background: #f2a5a508; }
.remove-filament svg { width: 15px; height: 15px; }
.primary-button { min-height: 40px; padding: 0 18px; display: flex; align-items: center; justify-content: center; gap: 4px; border-radius: 24px; background: #f2f2f2; color: #141517; font-size: 15px; }
.primary-button:hover:enabled { background: #fff; }
.primary-button.added { opacity: 1; color: #b7b7bd; background: #ffffff08; }
.primary-button svg { width: 18px; height: 18px; stroke-width: 2; }
.save-error { color: #f3a5a5; font-size: 12px; margin-bottom: 10px; }
.filament-confirm { margin: auto; width: 340px; max-width: calc(100vw - 32px); padding: 22px; border: 1px solid #ffffff20; border-radius: 16px; background: #28292d; color: #eeeef2; box-shadow: 0 20px 80px #0009; }
.filament-confirm::backdrop { background: #090b1270; backdrop-filter: blur(2px); }
.filament-confirm h2 { font-size: 15px; font-weight: 500; }
.delete-material { display: flex; align-items: center; gap: 12px; margin: 22px 0; font-size: 12px; }
.delete-material small { display: block; color: #989ba7; margin-top: 5px; font-size: 11px; }
.confirm-actions { display: flex; justify-content: flex-end; gap: 8px; }
.confirm-actions button { padding: 8px 18px; border: 1px solid #ffffff20; border-radius: 7px; font-size: 12px; }
.confirm-actions .confirm-delete { background: #b94750; border-color: transparent; }
@media (max-height: 740px) and (min-width: 701px) {
  .filaments-header { padding-top: 18px; padding-bottom: 16px; }
  .filaments-columns { padding-bottom: 22px; }
  .owned-list { min-height: 64px; }
  .add-area { height: 280px; gap: 14px; padding-top: 14px; }
  .select-wrap select { min-height: 46px; height: 46px; }
  .custom-button { min-height: 42px; }
  .attribute-row { min-height: 32px; font-size: 14px; }
  .detail-fields { margin-top: 12px; gap: 3px; }
  .inspector-footer { padding-top: 12px; }
}
@media (max-width: 700px) {
  .my-filaments { width: calc(100vw - 24px); height: calc(100dvh - 24px); border-radius: 20px; overflow-y: auto; }
  .filaments-header { padding: 18px; }
  .filaments-columns { display: flex; flex-direction: column; gap: 26px; padding: 0 18px 20px; flex: none; }
  .filaments-library, .filament-inspector { flex: none; }
  .owned-list { flex: none; max-height: 220px; }
  .add-area { height: 340px; gap: 16px; }
  .filament-inspector :deep(.filament-sample) { height: 220px; flex: none; }
}
</style>
