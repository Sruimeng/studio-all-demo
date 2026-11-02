<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useLocale } from '~/@base/locale';
import { FilamentSample } from '~/@engine/viewer';
import { colorQuery, customFilament, filamentBrand, filamentDescription, filamentName, filamentSeries, filamentType, filamentTypes, searchFilaments } from '../filaments';
import { materialHex, materialSurface } from '../supplier';
import type { MaterialRecord } from '../types';
const { tr } = useLocale();

const props = defineProps<{ catalog: MaterialRecord[]; ownedIds: string[]; busy: boolean; addFilament: (material: MaterialRecord) => Promise<boolean> }>();
const emit = defineEmits<{ close: []; 'update:ownedIds': [ids: string[]] }>();
const locale = useLocale(), { t } = locale;
const adding = ref(false), creating = ref(false), query = ref(''), selectedId = ref(''), detailId = ref('');
const name = ref(''), type = ref('PLA'), color = ref('#A6B441'), saving = ref(false), error = ref('');
const deleting = ref<MaterialRecord | null>(null);
const confirmation = useTemplateRef<HTMLDialogElement>('confirmation'), panel = useTemplateRef<HTMLElement>('panel'), search = useTemplateRef<HTMLInputElement>('search');
const owned = computed(() => props.ownedIds.flatMap(id => { const material = props.catalog.find(item => item.id === id); return material ? [material] : []; }));
const results = computed(() => searchFilaments(props.catalog, query.value));
const selected = computed(() => results.value.find(item => item.id === selectedId.value));
const detail = computed(() => props.catalog.find(item => item.id === detailId.value));
const validColor = computed(() => colorQuery(color.value));
const colorChoices = ['#F9FBFA', '#262626', '#87948E', '#BC2726', '#ED7334', '#FFF13F', '#1DAA27', '#1729AB', '#685BC7', '#E8B3C3', '#623412', '#D6B9B1'];
let previousFocus: HTMLElement | null = null;
onMounted(() => { previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null; panel.value?.focus({ preventScroll: true }); });
onBeforeUnmount(() => { confirmation.value?.close(); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); });
watch(query, () => { selectedId.value = ''; creating.value = false; error.value = ''; });
watch(deleting, async value => { if (value) { await nextTick(); confirmation.value?.showModal(); } else confirmation.value?.close(); });
const brand = (material: MaterialRecord) => filamentBrand(material) || t('Custom', '自定义');
const displayName = (material: MaterialRecord) => filamentName(material, locale.language === 'en');
function saveOwned(ids: string[]) {
  try { window.localStorage.setItem('tripo-owned-filaments', JSON.stringify(ids)); emit('update:ownedIds', ids); error.value = ''; return true; }
  catch { error.value = '保存失败，请重试。'; return false; }
}
async function openAdd() { adding.value = true; detailId.value = ''; await nextTick(); search.value?.focus(); }
function addSelected() {
  if (!selected.value || props.ownedIds.includes(selected.value.id) || saving.value) return;
  if (saveOwned([...props.ownedIds, selected.value.id])) { query.value = ''; selectedId.value = ''; adding.value = false; }
}
function startCreate() { creating.value = true; name.value = colorQuery(query.value) ? '' : query.value.trim(); color.value = colorQuery(query.value) || '#A6B441'; type.value = 'PLA'; }
async function create() {
  if (!name.value.trim() || !validColor.value || saving.value || props.busy) return;
  saving.value = true; error.value = '';
  try {
    const material = customFilament(name.value, type.value, validColor.value);
    if (!await props.addFilament(material)) { error.value = '保存失败，请重试。'; return; }
    if (saveOwned([...props.ownedIds, material.id])) { adding.value = false; creating.value = false; query.value = ''; }
    else { creating.value = false; query.value = material.name; await nextTick(); selectedId.value = material.id; }
  } finally { saving.value = false; }
}
function remove() {
  if (!deleting.value) return;
  if (saveOwned(props.ownedIds.filter(id => id !== deleting.value!.id))) { if (detailId.value === deleting.value.id) detailId.value = ''; deleting.value = null; }
}
function escape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || deleting.value) return;
  event.preventDefault(); event.stopPropagation();
  if (saving.value) return;
  if (detail.value) detailId.value = '';
  else if (creating.value) creating.value = false;
  else if (adding.value) adding.value = false;
  else emit('close');
}
</script>

<template>
  <section id="my-filaments-panel" ref="panel" class="my-filaments" role="dialog" aria-labelledby="my-filaments-title" tabindex="-1" @keydown.stop="escape" @dragover.prevent.stop @drop.prevent.stop>
    <header class="filaments-header">
      <h2 id="my-filaments-title">{{ t('My filaments', '我的耗材') }} <span>{{ tr(owned.length) }}</span></h2>
      <button class="icon-button" type="button" :disabled="saving" :aria-label="t('Close my filaments', '关闭我的耗材')" @click="emit('close')">×</button>
    </header>
    <div class="filaments-body" :class="{ 'detail-open': detail }">
      <div class="owned-list">
        <p v-if="!owned.length" class="empty-state">{{ t('No filaments yet', '暂无耗材') }}</p>
        <template v-for="material in owned" :key="material.id">
          <div class="owned-row" :class="{ active: detailId === material.id }">
            <button class="filament-row" type="button" :title="tr(displayName(material))" :aria-label="tr(`${t('View filament', '查看耗材')} ${displayName(material)}`)" :aria-expanded="detailId === material.id" :aria-controls="detailId === material.id ? 'owned-filament-detail' : undefined" @click="detailId = detailId === material.id ? '' : material.id">
              <i class="swatch" :style="{ background: materialHex(material) }" /><span><strong>{{ tr(filamentBrand(material) || displayName(material)) }}</strong><small>{{ tr(filamentDescription(material) || t('Custom', '自定义')) }}</small></span>
            </button>
            <button class="icon-button delete-button" type="button" :disabled="saving" :aria-label="tr(`${t('Delete', '删除')} ${displayName(material)}`)" @click="deleting = material">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></svg>
            </button>
          </div>
          <section v-if="detailId === material.id" id="owned-filament-detail" class="filament-detail" :aria-label="t('Filament details', '耗材详情')">
            <button class="icon-button detail-close" type="button" :aria-label="t('Collapse details', '收起详情')" @click="detailId = ''"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" /></svg></button>
            <FilamentSample :surface="materialSurface(material)" :label="t('Filament sample', '耗材样件')" />
            <dl>
              <div><dt>{{ t('Brand', '品牌') }}</dt><dd>{{ tr(brand(material)) }}</dd></div>
              <div v-if="filamentSeries(material)"><dt>{{ t('Series', '系列') }}</dt><dd>{{ tr(filamentSeries(material)) }}</dd></div>
              <div><dt>{{ t('Material', '材质') }}</dt><dd>{{ tr(filamentType(material) || '—') }}</dd></div>
              <div v-if="!material.filament"><dt>SKU</dt><dd>{{ tr(material.materialId) }}</dd></div>
              <div><dt>{{ t('Color', '色值') }}</dt><dd>{{ tr(materialHex(material)) }}</dd></div>
            </dl>
          </section>
        </template>
      </div>
    </div>
    <footer class="filaments-footer">
      <button v-if="!adding" class="add-filament-button" type="button" @click="openAdd"><span>＋</span>{{ t('Add filament', '添加耗材') }}</button>
      <template v-else>
        <div class="add-heading"><span>{{ t('Add filament', '添加耗材') }}</span><button class="icon-button" type="button" :disabled="saving" :aria-label="t('Cancel adding', '取消添加')" @click="adding = false; creating = false; error = ''">×</button></div>
        <div class="search-input-row">
          <input ref="search" v-model="query" :disabled="saving" :placeholder="t('Brand, series, material, SKU, color', '品牌、系列、材质、SKU、色值')" :aria-label="t('Search filaments', '搜索耗材')" @keydown.enter.prevent="addSelected">
          <button class="add-selected" type="button" :disabled="!selected || ownedIds.includes(selected.id) || saving" @click="addSelected">{{ t('Add', '添加') }}</button>
        </div>
        <div v-if="results.length" class="search-results" role="group" :aria-label="t('Filament results', '耗材检索结果')">
          <button v-for="material in results" :key="material.id" class="filament-row result-row" :class="{ selected: selectedId === material.id }" type="button" :aria-pressed="selectedId === material.id" :disabled="ownedIds.includes(material.id) || saving" @click="selectedId = material.id">
            <i class="swatch" :style="{ background: materialHex(material) }" /><span><strong>{{ tr(displayName(material)) }}</strong><small>{{ tr(brand(material)) }} · {{ tr(filamentDescription(material)) }}<template v-if="!material.filament"> · {{ tr(material.materialId) }}</template></small></span><span v-if="ownedIds.includes(material.id)" class="result-state">{{ t('Added', '已添加') }}</span><span v-else-if="selectedId === material.id" class="result-state">✓</span>
          </button>
        </div>
        <template v-else>
          <div v-if="!creating" class="no-results"><span>{{ t('No matching filaments', '未找到匹配耗材') }}</span><button type="button" @click="startCreate">＋ {{ t('Create filament', '新建耗材') }}</button></div>
          <form v-else class="custom-filament" @submit.prevent="create">
            <label>{{ t('Name', '名称') }}<input v-model="name" maxlength="80" required :disabled="saving" :aria-label="t('Filament name', '耗材名称')"></label>
            <label>{{ t('Material', '材质') }}<select v-model="type" :disabled="saving" :aria-label="t('Filament material', '耗材材质')"><option v-for="item in filamentTypes" :key="item">{{ tr(item) }}</option></select></label>
            <label>{{ t('Closest color', '相近颜色') }}<span class="color-fields"><input :value="validColor || '#A6B441'" type="color" :disabled="saving" :aria-label="t('Choose color', '选择颜色')" @input="color = ($event.target as HTMLInputElement).value"><input v-model="color" :disabled="saving" maxlength="7" aria-label="HEX"></span></label>
            <div class="color-choices"><button v-for="hex in colorChoices" :key="hex" type="button" :style="{ background: hex }" :aria-label="tr(hex)" :aria-pressed="validColor === hex" :disabled="saving" @click="color = hex" /></div>
            <button class="add-filament-button" type="submit" :disabled="!name.trim() || !validColor || saving || busy">{{ tr(saving ? t('Adding…', '添加中…') : t('Add filament', '添加耗材')) }}</button>
          </form>
        </template>
      </template>
      <p v-if="error && !deleting" class="save-error" role="alert">{{ tr(error) }}</p>
    </footer>
    <Teleport to="body">
      <dialog ref="confirmation" class="filament-confirm" aria-labelledby="filament-delete-title" @cancel="deleting = null" @keydown.stop>
        <template v-if="deleting"><h2 id="filament-delete-title">{{ t('Delete filament?', '确认删除耗材？') }}</h2><div class="delete-material"><i class="swatch" :style="{ background: materialHex(deleting) }" /><span>{{ tr(displayName(deleting)) }}<small>{{ tr(brand(deleting)) }} · {{ tr(filamentDescription(deleting)) }}</small></span></div><p v-if="error" class="save-error" role="alert">{{ tr(error) }}</p><div class="confirm-actions"><button type="button" autofocus @click="deleting = null">{{ t('Cancel', '取消') }}</button><button class="confirm-delete" type="button" @click="remove">{{ t('Delete', '删除') }}</button></div></template>
      </dialog>
    </Teleport>
  </section>
</template>

<style scoped>
.my-filaments{position:absolute;z-index:15;left:calc(100% + 12px);top:60px;max-height:calc(100% - 80px);width:360px;max-width:calc(100vw - 36px);display:flex;flex-direction:column;border:1px solid #ffffff1c;border-radius:16px;background:#27282e;box-shadow:0 18px 60px #0008;color:#eeeef2;overflow:hidden;outline:none}.filaments-header{display:flex;align-items:center;gap:8px;padding:15px 16px;border-bottom:1px solid #ffffff10;flex:none}.filaments-header h2{flex:1;font-size:14px;font-weight:600}.filaments-header h2 span{margin-left:7px;color:#9496a1;font-size:12px;font-weight:400}.icon-button{display:grid;place-items:center;width:28px;height:28px;border-radius:6px;color:#a8aab5;font-size:22px;flex:none;padding:0}.icon-button:hover{background:#ffffff0a;color:#fff}.filaments-body{min-height:72px;max-height:256px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#51525a transparent}.filaments-body.detail-open{max-height:640px}.owned-list{padding:0 12px}.owned-row{display:flex;align-items:center;height:64px;box-sizing:border-box;border-bottom:1px solid #ffffff09}.owned-row.active{background:#7562e514}.owned-row .filament-row{height:100%}.owned-row small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.filament-row{display:flex;align-items:center;gap:11px;padding:12px 7px;text-align:left;min-width:0;flex:1;border-radius:8px}.filament-row:hover{background:#ffffff07}.swatch{display:block;width:32px;height:32px;flex:none;border-radius:8px;box-shadow:inset 0 0 0 1px #ffffff26}.filament-row>span:not(.result-state){flex:1;min-width:0}.filament-row strong{display:block;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.filament-row small{display:block;font-size:10px;color:#9b9da8;margin-top:5px;line-height:1.5;overflow-wrap:anywhere}.delete-button{margin-right:5px}.delete-button svg{width:16px;height:16px}.delete-button:hover{color:#f8a7a7}.empty-state{text-align:center;padding:35px 0;color:#868995;font-size:12px}.filaments-footer{padding:14px 16px;border-top:1px solid #ffffff10;flex:0 1 auto;min-height:0;overflow:auto;scrollbar-width:thin}.add-filament-button{width:100%;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border:1px solid #ffffff23;border-radius:8px;font-size:12px;background:#ffffff05}.add-filament-button:hover{background:#ffffff0b}.add-filament-button span{font-size:17px}.add-heading{display:flex;justify-content:space-between;align-items:center;font-size:12px;margin:-3px 0 9px}.search-input-row{display:flex;gap:7px}.my-filaments input:not([type=color]),.my-filaments select{min-width:0;width:100%;border:1px solid #ffffff20;border-radius:7px;background:#1c1d23;padding:10px;color:#ececf1;font-size:11px}.search-input-row input{flex:1}.search-input-row input::placeholder{color:#7f828e;font-size:10px}.add-selected{flex:none;background:#6655df;border-radius:7px;padding:0 12px;font-size:11px}.search-results{max-height:225px;overflow:auto;scrollbar-width:thin;margin-top:8px}.result-row{width:100%;border:1px solid transparent;padding:9px 7px}.result-row.selected{border-color:#8c80f1;background:#7562e520}.result-row:disabled{opacity:.5}.result-state{flex:none;color:#a79cf4;font-size:10px}.no-results{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;padding:22px 0 7px;color:#9396a2}.no-results button{color:#baafff}.custom-filament{display:grid;gap:12px;margin-top:16px}.custom-filament label{display:grid;gap:6px;font-size:11px;color:#b6b8c1}.color-fields{display:flex;gap:8px}.color-fields input[type=color]{width:40px;height:36px;padding:3px;flex:none;background:#1c1d23;border:1px solid #ffffff20;border-radius:7px}.color-choices{display:grid;grid-template-columns:repeat(12,1fr);gap:6px}.color-choices button{height:19px;border-radius:50%;box-shadow:inset 0 0 0 1px #ffffff20}.color-choices button[aria-pressed=true]{outline:2px solid #b5aaff;outline-offset:2px}.custom-filament .add-filament-button{background:#6655df;border-color:transparent}.save-error{font-size:11px;color:#f3a5a5;line-height:1.6;margin-top:10px}.filament-detail{position:relative;padding:32px 7px 14px;border-bottom:1px solid #ffffff10}.filament-detail :deep(.filament-sample){height:140px}.detail-close{position:absolute;top:6px;right:7px;width:22px;height:22px}.detail-close svg{width:14px;height:14px}.filament-detail dl>div{display:flex;justify-content:space-between;gap:24px;padding:7px 0;border-bottom:1px solid #ffffff0a;font-size:11px}.filament-detail dt{color:#9699a5;flex:none}.filament-detail dd{text-align:right;overflow-wrap:anywhere}.filament-confirm{margin:auto;width:340px;max-width:calc(100vw - 32px);padding:22px;border:1px solid #ffffff20;border-radius:14px;background:#282930;color:#eeeef2;box-shadow:0 20px 80px #0009}.filament-confirm::backdrop{background:#090b126b;backdrop-filter:blur(3px)}.filament-confirm h2{font-size:15px;font-weight:600}.delete-material{display:flex;align-items:center;gap:12px;margin:22px 0;font-size:12px}.delete-material small{display:block;color:#989ba7;margin-top:5px;font-size:11px}.confirm-actions{display:flex;justify-content:flex-end;gap:8px}.confirm-actions button{padding:8px 18px;border:1px solid #ffffff20;border-radius:7px;font-size:12px}.confirm-actions .confirm-delete{background:#b94750;border-color:transparent}@media(max-height:650px){.my-filaments{top:12px;max-height:calc(100% - 20px)}.search-results{max-height:150px}.filaments-footer{padding:10px 14px}.custom-filament{gap:8px;margin-top:10px}}@media(max-width:680px){.my-filaments{position:fixed;left:16px;right:16px;top:80px;max-height:calc(100dvh - 96px);width:auto}}
</style>
