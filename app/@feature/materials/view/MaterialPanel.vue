<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useLocale } from '~/@base/locale';
import { site } from '~/@base/site';
import ModuleTooltip from '~/@base/ui/ModuleTooltip.vue';
import { cloneMaterial, materialHex, materialProblem, supplierCatalogHex, supplierIssue } from '../supplier';
import { RENDER_RULE, type MaterialRecord, type MaterialImportResult } from '../types';
import MaterialEditor from './MaterialEditor.vue';
import SupplierDetail from './SupplierDetail.vue';
import MaterialImport from './MaterialImport.vue';
const isSupplier = (item: MaterialRecord) => !!item.supplier && item.supplier.origin !== 'local-usda';

const props = defineProps<{ materials: MaterialRecord[]; selected: MaterialRecord | null; checked: string[]; busy: boolean; saveMaterial: (material: MaterialRecord) => Promise<boolean>; deleteMaterial: (id: string) => Promise<boolean>; importMaterials: (files: File[]) => Promise<MaterialImportResult> }>();
const emit = defineEmits<{ apply: [material: MaterialRecord]; preview: [material: MaterialRecord | null]; check: [id: string]; export: [format: 'csv' | 'json'] }>();
const locale = useLocale();
const { t } = locale;
const { language } = storeToRefs(locale);
const search = shallowRef('');
const tab = shallowRef<'supplier' | 'local'>('supplier');
const vendor = shallowRef(site.vendor ?? '');
const editing = shallowRef<MaterialRecord | null>(null);
const deleting = shallowRef<MaterialRecord | null>(null);
async function remove() {
  if (deleting.value && await props.deleteMaterial(deleting.value.id)) deleting.value = null;
}
const vendors = computed(() => [...new Set(props.materials.filter(isSupplier).map(item => item.supplier!.vendor))].map(name => ({ name, count: props.materials.filter(item => isSupplier(item) && item.supplier!.vendor === name).length })));
const visible = computed(() => props.materials.filter(item => (tab.value === 'supplier' ? isSupplier(item) && (!vendor.value || item.supplier!.vendor === vendor.value) : !isSupplier(item)) && `${item.name} ${item.materialId} ${item.supplier?.vendor ?? ''} ${item.supplier?.product ?? ''} ${item.supplier?.colorFamily ?? ''} ${item.supplier?.materialType ?? ''} ${item.appearance?.vendor ?? ''} ${item.appearance?.baseMaterial ?? ''} ${item.appearance?.colorCode ?? ''} ${item.appearance?.sku ?? ''}`.toLowerCase().includes(search.value.toLowerCase())));
const counts = computed(() => ({ supplier: props.materials.filter(isSupplier).length, local: props.materials.filter(item => !isSupplier(item)).length }));
function edit(material?: MaterialRecord) {
  editing.value = material ? cloneMaterial(material) : { id: crypto.randomUUID(), materialId: `MAT-${String(props.materials.length + 1).padStart(3, '0')}`, name: '', hex: '#BCA8FF', transparency: 0, metalness: 0, roughness: 0.35, colorSpace: 'srgb', renderRule: RENDER_RULE };
}
function close() { editing.value = null; emit('preview', null); }
watch(() => props.selected?.id, close);
</script>
<template>
  <aside class="material-panel">
    <div class="panel-heading"><div><span class="eyebrow">MATERIAL LIBRARY</span><h2>{{ t('Filaments & materials', '耗材与材质') }} <small>{{ materials.length }}</small></h2></div><ModuleTooltip :title="t('New local material', '新建本地材质')" :description="t('Create a local record. Supplier source data stays intact.', '新增本地材质档案，供应商原始数据保留。')" side="left"><button class="icon-button" aria-label="New material" @click="edit()">＋</button></ModuleTooltip></div>
    <MaterialEditor v-if="editing" :key="editing.id" :material="editing" :materials="materials" :busy="busy" :save-material="saveMaterial" @close="close" @preview="emit('preview', $event)" />
    <template v-else>
      <MaterialImport :busy="busy" :import-materials="importMaterials" @imported="tab = 'local'; search = ''" />
      <label class="search-field"><span>⌕</span><input v-model="search" :placeholder="t('Search SKU, color or material', '搜索 SKU、颜色或材料')" aria-label="Search materials"></label>
      <div class="library-tabs"><button :class="{ active: tab === 'supplier' }" @click="tab = 'supplier'">{{ t('Suppliers', '供应商') }} {{ counts.supplier }}</button><button :class="{ active: tab === 'local' }" @click="tab = 'local'">{{ t('Local', '本地') }} {{ counts.local }}</button></div>
      <label v-if="tab === 'supplier'" class="vendor-filter">{{ t('Manufacturer', '厂商') }}<select v-model="vendor" :disabled="!!site.vendor" :aria-label="t('Filter manufacturer', '筛选厂商')"><option v-if="!site.vendor" value="">{{ t('All manufacturers', '全部厂商') }}</option><option v-for="entry in vendors" :key="entry.name" :value="entry.name">{{ entry.name }} · {{ entry.count }}</option></select></label>
      <div v-if="deleting" class="delete-confirm" role="group" :aria-label="t('Confirm deletion', '确认删除')">
        <p>{{ t(`Delete ${deleting.materialId} from the library? Applied materials will be retained.`, `从材质库删除 ${deleting.materialId}？已应用的材质保持不变。`) }}</p>
        <div class="button-row"><button :disabled="busy" @click="deleting = null">{{ t('Cancel', '取消') }}</button><button class="delete-material" :disabled="busy" @click="remove">{{ t('Confirm delete', '确认删除') }}</button></div>
      </div>
      <details v-if="selected" class="selection-detail"><summary class="detail-heading">{{ t('SELECTED MATERIAL', '当前材质') }} · {{ selected.materialId }}<button class="text-button" :disabled="busy" @click.stop.prevent="edit(selected)">{{ selected.supplier ? t('Adjust locally', '本地调整') : t('Edit', '编辑') }} ↗</button></summary><SupplierDetail v-if="selected.supplier" :material="selected" /><div v-else class="detail-color"><span :style="{ background: selected.hex }" /><b>{{ selected.hex }}</b><small>sRGB</small></div><dl><div><dt>{{ t('Roughness', '粗糙度') }}</dt><dd>{{ selected.roughness.toFixed(3) }}</dd></div><div><dt>{{ t('Metalness', '金属度') }}</dt><dd>{{ selected.metalness.toFixed(2) }}</dd></div><div><dt>{{ t('Transparency', '透明度') }}</dt><dd>{{ selected.transparency.toFixed(2) }}</dd></div></dl></details>
      <div class="material-list">
        <article v-for="item in visible" :key="item.id" class="material-card" :class="{ selected: selected?.id === item.id }">
          <input class="material-check" type="checkbox" :checked="checked.includes(item.id)" :aria-label="`Select ${item.name} for export`" @change="emit('check', item.id)">
          <ModuleTooltip :title="t('Color swatch', '颜色色卡')" :description="t('Catalog sRGB color only. Evaluate surface appearance in the central 3D view.', '仅展示色卡颜色。表面材质效果请在中央 3D 视图评估。')" side="left"><button class="material-swatch" :style="{ background: item.supplier?.status === 'unmatched' ? 'repeating-linear-gradient(45deg,#444 0 4px,#777 4px 8px)' : supplierCatalogHex(item) ?? materialHex(item) }" :disabled="busy || !!materialProblem(item)" :aria-label="`Apply ${item.materialId}`" @click="emit('apply', item)" /></ModuleTooltip>
          <button class="material-description" :disabled="busy || !!materialProblem(item)" @click="emit('apply', item)"><strong>{{ item.name }}</strong><span>{{ item.supplier?.vendor ? item.supplier.vendor + ' · ' : '' }}{{ item.supplier?.catalogId ?? item.materialId }} · {{ item.supplier ? item.supplier.materialType || t('Unconfirmed', '待确认') : t('Local', '本地') }}</span><small v-if="item.supplier" class="material-status">{{ ['paired', 'imported'].includes(item.supplier.status) ? 'OpenPBR' : item.supplier.status === 'color-only' ? t('Color only', '仅颜色') : t('SKU unconfirmed', 'SKU 待确认') }} · {{ t('Pending verification', '待验证') }}</small></button>
          <ModuleTooltip :title="t('Inspect / adjust', '查看 / 调整')" :description="item.supplier?.issues.map(issue => supplierIssue(issue, language === 'en')).join('；') || t('Edit this local material.', '编辑此本地材质。')" side="left"><button class="edit-material" :aria-label="`Edit ${item.materialId}`" :disabled="busy" @click="edit(item)">↗</button></ModuleTooltip>
          <button v-if="!isSupplier(item)" class="delete-material" :aria-label="t(`Delete ${item.materialId}`, `删除 ${item.materialId}`)" :title="t('Delete from local library', '从本地库删除')" :disabled="busy" @click="deleting = item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></svg></button>
        </article>
        <p v-if="!visible.length" class="empty-materials">{{ t('No matching materials', '没有匹配的材质') }}</p>
      </div>

      <footer class="library-footer"><span>{{ checked.length || materials.length }} {{ t('materials to export', '个待导出材质') }}</span><div class="button-row"><button class="secondary" @click="emit('export', 'csv')">↓ CSV</button><button class="secondary" :disabled="busy" @click="emit('export', 'json')">↓ JSON</button></div></footer>
    </template>
  </aside>
</template>
<style scoped>
.panel-heading, .search-field, .library-tabs, .vendor-filter, .selection-detail, .library-footer { flex-shrink: 0; }
.vendor-filter { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; font-size: 10px; color: #999; }
.vendor-filter select { min-width: 0; flex: 1; padding: 6px; border: 1px solid #444; border-radius: 5px; background: #252525; color: #eee; font: inherit; }
.material-list { flex: 1; min-height: 120px; overflow-y: auto; scrollbar-width: thin; }
.selection-detail summary { cursor: pointer; font-size: 9px; }
.material-swatch { width: 26px; height: 26px; border: 1px solid #666; border-radius: 5px; }
.material-status { display: block; margin-top: 5px; color: #e9c17b; font-size: 8px; }
.empty-materials { margin: 16px 0; color: #999; font-size: 10px; }
.delete-material { flex-shrink: 0; color: #e9a58c; }
.delete-confirm { flex-shrink: 0; margin-top: 10px; padding: 10px; border: 1px solid #735345; border-radius: 6px; font-size: 10px; line-height: 1.6; }
.delete-confirm .button-row { margin-top: 8px; }
</style>
