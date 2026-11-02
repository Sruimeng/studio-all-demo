<script setup lang="ts">
import { filamentName } from '../filaments';
import { computed, shallowRef, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useLocale } from '~/@base/locale';
import ModuleTooltip from '~/@base/ui/ModuleTooltip.vue';
import { cloneMaterial, materialHex, materialProblem, supplierIssue } from '../supplier';
import { RENDER_RULE, type MaterialRecord, type MaterialImportResult } from '../types';
import MaterialEditor from './MaterialEditor.vue';
import SupplierDetail from './SupplierDetail.vue';
import MaterialImport from './MaterialImport.vue';
const { tr } = useLocale();
const isSupplier = (item: MaterialRecord) => !!item.supplier && item.supplier.origin !== 'local-usda';

const props = defineProps<{ materials: MaterialRecord[]; selected: MaterialRecord | null; checked: string[]; busy: boolean; saveMaterial: (material: MaterialRecord) => Promise<boolean>; deleteMaterial: (id: string) => Promise<boolean>; importMaterials: (files: File[]) => Promise<MaterialImportResult> }>();
const emit = defineEmits<{ apply: [material: MaterialRecord]; preview: [material: MaterialRecord | null]; check: [id: string]; export: [format: 'csv' | 'json'] }>();
const locale = useLocale();
const { t } = locale;
const { language } = storeToRefs(locale);
const search = shallowRef('');
const tab = shallowRef<'supplier' | 'local'>('supplier');
const editing = shallowRef<MaterialRecord | null>(null);
const deleting = shallowRef<MaterialRecord | null>(null);
async function remove() {
  if (deleting.value && await props.deleteMaterial(deleting.value.id)) deleting.value = null;
}
const visible = computed(() => props.materials.filter(item => (tab.value === 'supplier' ? isSupplier(item) : !isSupplier(item)) && `${item.name} ${item.materialId} ${item.supplier?.vendor ?? ''} ${item.supplier?.product ?? ''} ${item.supplier?.materialType ?? ''}`.toLowerCase().includes(search.value.toLowerCase())));
const counts = computed(() => ({ supplier: props.materials.filter(isSupplier).length, local: props.materials.filter(item => !isSupplier(item)).length }));
function edit(material?: MaterialRecord) {
  editing.value = material ? cloneMaterial(material) : { id: crypto.randomUUID(), materialId: `MAT-${String(props.materials.length + 1).padStart(3, '0')}`, name: '', hex: '#BCA8FF', transparency: 0, metalness: 0, roughness: 0.35, colorSpace: 'srgb', renderRule: RENDER_RULE };
}
function close() { editing.value = null; emit('preview', null); }
watch(() => props.selected?.id, close);
</script>
<template>
  <aside class="material-panel">
    <div class="panel-heading"><div><span class="eyebrow">MATERIAL LIBRARY</span><h2>{{ t('Filaments & materials', '耗材与材质') }} <small>{{ tr(materials.length) }}</small></h2></div><ModuleTooltip :title="t('New local material', '新建本地材质')" :description="t('Create a local record. Supplier source data stays intact.', '新增本地材质档案，供应商原始数据保留。')" side="left"><button class="icon-button" aria-label="New material" @click="edit()">＋</button></ModuleTooltip></div>
    <MaterialEditor v-if="editing" :key="editing.id" :material="editing" :materials="materials" :busy="busy" :save-material="saveMaterial" @close="close" @preview="emit('preview', $event)" />
    <template v-else>
      <MaterialImport :busy="busy" :import-materials="importMaterials" @imported="tab = 'local'; search = ''" />
      <label class="search-field"><span>⌕</span><input v-model="search" :placeholder="t('Search SKU, color or material', '搜索 SKU、颜色或材料')" aria-label="Search materials"></label>
      <div class="library-tabs"><button :class="{ active: tab === 'supplier' }" @click="tab = 'supplier'">Polymaker {{ tr(counts.supplier) }}</button><button :class="{ active: tab === 'local' }" @click="tab = 'local'">{{ t('Local', '本地') }} {{ tr(counts.local) }}</button></div>
      <div v-if="deleting" class="delete-confirm" role="group" :aria-label="t('Confirm deletion', '确认删除')">
        <p>{{ t(`Delete ${deleting.materialId} from the library? Applied materials will be retained.`, `从材质库删除 ${deleting.materialId}？已应用的材质保持不变。`) }}</p>
        <div class="button-row"><button :disabled="busy" @click="deleting = null">{{ t('Cancel', '取消') }}</button><button class="delete-material" :disabled="busy" @click="remove">{{ t('Confirm delete', '确认删除') }}</button></div>
      </div>
      <details v-if="selected" class="selection-detail"><summary class="detail-heading">{{ t('SELECTED MATERIAL', '当前材质') }} · {{ tr(selected.materialId) }}<button class="text-button" :disabled="busy" @click.stop.prevent="edit(selected)">{{ tr(selected.supplier ? t('Adjust locally', '本地调整') : t('Edit', '编辑')) }} ↗</button></summary><SupplierDetail v-if="selected.supplier" :material="selected" /><div v-else class="detail-color"><span :style="{ background: selected.hex }" /><b>{{ tr(selected.hex) }}</b><small>sRGB</small></div><dl><div><dt>{{ t('Roughness', '粗糙度') }}</dt><dd>{{ tr(selected.roughness.toFixed(3)) }}</dd></div><div><dt>{{ t('Metalness', '金属度') }}</dt><dd>{{ tr(selected.metalness.toFixed(2)) }}</dd></div><div><dt>{{ t('Transparency', '透明度') }}</dt><dd>{{ tr(selected.transparency.toFixed(2)) }}</dd></div></dl></details>
      <div class="material-list">
        <article v-for="item in visible" :key="item.id" class="material-card" :class="{ selected: selected?.id === item.id }">
          <input class="material-check" type="checkbox" :checked="checked.includes(item.id)" :aria-label="`Select ${language === 'en' ? filamentName(item, true) : item.name} for export`" @change="emit('check', item.id)">
          <ModuleTooltip :title="t('Color swatch', '颜色色卡')" :description="t('Catalog sRGB color only. Evaluate surface appearance in the central 3D view.', '仅展示色卡颜色。表面材质效果请在中央 3D 视图评估。')" side="left"><button class="material-swatch" :style="{ background: item.supplier?.status === 'unmatched' ? 'repeating-linear-gradient(45deg,#444 0 4px,#777 4px 8px)' : materialHex(item) }" :disabled="busy || !!materialProblem(item)" :aria-label="tr(`Apply ${item.materialId}`)" @click="emit('apply', item)" /></ModuleTooltip>
          <button class="material-description" :disabled="busy || !!materialProblem(item)" @click="emit('apply', item)"><strong>{{ language === 'en' ? filamentName(item, true) : item.name }}</strong><span>{{ tr(item.materialId) }} · {{ tr(item.supplier ? item.supplier.materialType || t('Unconfirmed', '待确认') : t('Local', '本地')) }}</span><small v-if="item.supplier" class="material-status">{{ tr(['paired', 'imported'].includes(item.supplier.status) ? 'OpenPBR' : item.supplier.status === 'color-only' ? t('Color only', '仅颜色') : t('SKU unconfirmed', 'SKU 待确认')) }} · {{ t('Pending verification', '待验证') }}</small></button>
          <ModuleTooltip :title="t('Inspect / adjust', '查看 / 调整')" :description="item.supplier?.issues.map(issue => supplierIssue(issue, language === 'en')).join('；') || t('Edit this local material.', '编辑此本地材质。')" side="left"><button class="edit-material" :aria-label="tr(`Edit ${item.materialId}`)" :disabled="busy" @click="edit(item)">↗</button></ModuleTooltip>
          <button v-if="!isSupplier(item)" class="delete-material" :aria-label="t(`Delete ${item.materialId}`, `删除 ${item.materialId}`)" :title="t('Delete from local library', '从本地库删除')" :disabled="busy" @click="deleting = item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></svg></button>
        </article>
        <p v-if="!visible.length" class="empty-materials">{{ t('No matching materials', '没有匹配的材质') }}</p>
      </div>

      <footer class="library-footer"><span>{{ tr(checked.length || materials.length) }} {{ t('materials to export', '个待导出材质') }}</span><div class="button-row"><button class="secondary" @click="emit('export', 'csv')">↓ CSV</button><button class="secondary" :disabled="busy" @click="emit('export', 'json')">↓ JSON</button></div></footer>
    </template>
  </aside>
</template>
<style scoped>
.panel-heading, .search-field, .library-tabs, .selection-detail, .library-footer { flex-shrink: 0; }
.material-list { flex: 1; min-height: 120px; overflow-y: auto; scrollbar-width: thin; }
.selection-detail summary { cursor: pointer; font-size: 9px; }
.material-swatch { width: 26px; height: 26px; border: 1px solid #666; border-radius: 5px; }
.material-status { display: block; margin-top: 5px; color: #e9c17b; font-size: 8px; }
.empty-materials { margin: 16px 0; color: #999; font-size: 10px; }
.delete-material { flex-shrink: 0; color: #e9a58c; }
.delete-confirm { flex-shrink: 0; margin-top: 10px; padding: 10px; border: 1px solid #735345; border-radius: 6px; font-size: 10px; line-height: 1.6; }
.delete-confirm .button-row { margin-top: 8px; }
</style>
