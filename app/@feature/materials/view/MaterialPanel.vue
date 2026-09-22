<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useLocale } from '~/@base/locale';
import { rgb, validateMaterial } from '../catalog';
import { RENDER_RULE, type MaterialRecord } from '../types';
import ModuleTooltip from '~/@base/ui/ModuleTooltip.vue';
const props = defineProps<{ materials: MaterialRecord[]; selected: MaterialRecord | null; checked: string[]; busy: boolean; saveMaterial: (material: MaterialRecord) => Promise<boolean> }>();
const emit = defineEmits<{ apply: [material: MaterialRecord]; preview: [material: MaterialRecord | null]; check: [id: string]; export: [format: 'csv' | 'json'] }>();
const { t } = useLocale();
const search = ref(''); const editing = ref(false); const validation = ref('');
const draft = ref<MaterialRecord | null>(null);
const visible = computed(() => props.materials.filter(item => `${item.name} ${item.materialId}`.toLowerCase().includes(search.value.toLowerCase())));
type Parameter = 'transparency' | 'metalness' | 'roughness';
function parameterTitle(field: Parameter) {
  return field === 'transparency' ? t('Transparency', '透明度') : field === 'metalness' ? t('Metalness', '金属度') : t('Roughness', '粗糙度');
}
function parameterDescription(field: Parameter) {
  return field === 'transparency'
    ? t('Preview opacity is 1 minus transparency. 0 is opaque and 1 is fully transparent.', '预览不透明度等于 1 减透明度。0 为不透明，1 为完全透明。')
    : field === 'metalness'
      ? t('Controls the metallic response in the preview. 0 is a dielectric surface and 1 is fully metallic.', '控制预览中的金属反射。0 为非金属，1 为完全金属。')
      : t('Input roughness from 0 to 1. Studio renders effective roughness as 0.5 + 0.5 × input, then multiplies texture samples.', '输入粗糙度范围为 0 到 1。Studio 最终使用 0.5 + 0.5 × 输入值，再乘以贴图采样值。');
}
function edit(material?: MaterialRecord) {
  draft.value = material ? { ...material } : { id: crypto.randomUUID(), materialId: `MAT-${String(props.materials.length + 1).padStart(3, '0')}`, name: '', hex: '#BCA8FF', transparency: 0, metalness: 0, roughness: 0.35, colorSpace: 'srgb', renderRule: RENDER_RULE };
  validation.value = ''; editing.value = true;
}
function cancel() { editing.value = false; draft.value = null; emit('preview', null); }
async function save() {
  if (!draft.value) return;
  const message = validateMaterial(draft.value, props.materials);
  if (message) { validation.value = message; return; }
  const success = await props.saveMaterial({ ...draft.value, name: draft.value.name.trim(), materialId: draft.value.materialId.trim(), hex: draft.value.hex.toUpperCase() }); if (success) cancel();
}
async function reference(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file || !draft.value) return;
  if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) { validation.value = t('Choose an image under 5 MB', '请选择 5MB 内的图片'); return; }
  const reader = new FileReader(); reader.onload = () => { if (draft.value) draft.value.referenceImage = String(reader.result); }; reader.readAsDataURL(file);
}
watch(draft, value => { if (value && !validateMaterial(value, [])) emit('preview', { ...value }); }, { deep: true });
</script>
<template>
  <aside class="material-panel">
    <div class="panel-heading"><div><span class="eyebrow">MATERIAL LIBRARY</span><h2>{{ t('Your materials', '我的材质') }} <small>{{ materials.length }}</small></h2></div><ModuleTooltip :title="t('New material', '新建材质')" :description="t('Create a separate material record. Materials with the same color can still have different IDs.', '创建独立的材质档案。颜色相同的材质仍可使用不同材质 ID。')" side="left"><button class="icon-button" :title="t('New material', '新建材质')" aria-label="New material" @click="edit()">＋</button></ModuleTooltip></div>
    <template v-if="editing && draft">
      <div class="editor-title"><ModuleTooltip :title="t('Back to library', '返回材质库')" :description="t('Discard this draft preview and return to the saved material list.', '放弃当前草稿预览，返回已保存的材质列表。')" side="left"><button class="text-button" @click="cancel">← {{ t('Library', '材质库') }}</button></ModuleTooltip><span>{{ t('Material editor', '材质编辑') }}</span></div>
      <div class="material-orb" :style="{ '--swatch': draft.hex, '--shine': 1 - draft.roughness }"><div class="orb" /><span>{{ draft.materialId }}</span></div>
      <div class="editor-fields">
        <ModuleTooltip :title="t('Material name', '材质名称')" :description="t('Human-readable name shown in the material library and region cards.', '材质库和区域卡片中显示的名称。')" side="left"><label>{{ t('Name', '名称') }}<input v-model="draft.name" data-testid="material-name" :placeholder="t('e.g. Satin ivory', '例如：缎面象牙白')"></label></ModuleTooltip>
        <ModuleTooltip :title="t('Material ID', '材质 ID')" :description="t('Unique user-facing identifier exported to CSV, JSON and the 3MF metadata.', '导出到 CSV、JSON 和 3MF 元数据中的唯一用户标识。')" side="left"><label>{{ t('Material ID', '材质 ID') }}<input v-model="draft.materialId" data-testid="material-id"></label></ModuleTooltip>
        <ModuleTooltip :title="t('Display color', '展示颜色')" :description="t('The sRGB HEX value used for the preview and region color. RGB values below are derived from this HEX.', '预览和区域颜色使用的 sRGB HEX 值。下方 RGB 数值由此 HEX 换算。')" side="left"><label>{{ t('Display color', '展示颜色') }}<div class="color-input"><input v-model="draft.hex" type="color" aria-label="Color"><input v-model="draft.hex" aria-label="HEX" maxlength="7"><span>sRGB</span></div></label></ModuleTooltip>
        <ModuleTooltip :title="t('RGB values', 'RGB 数值')" :description="t('8-bit sRGB channels derived from the HEX color, each ranging from 0 to 255.', '由 HEX 颜色换算出的 8 位 sRGB 通道值，范围均为 0 到 255。')" side="left"><div class="rgb-row"><span v-for="(value, index) in rgb(draft.hex)" :key="index">{{ ['R', 'G', 'B'][index] }} <b>{{ value }}</b></span></div></ModuleTooltip>
        <ModuleTooltip v-for="field in (['transparency', 'metalness', 'roughness'] as const)" :key="field" :title="parameterTitle(field)" :description="parameterDescription(field)" side="left"><label class="parameter"><span>{{ parameterTitle(field) }}<input v-model.number="draft[field]" :aria-label="field" type="number" min="0" max="1" step="0.01"></span><input v-model.number="draft[field]" type="range" min="0" max="1" step="0.01" :aria-label="`${field} slider`"></label></ModuleTooltip>
        <ModuleTooltip :title="t('Effective roughness', '最终粗糙度')" :description="t('Studio preview uses 0.5 + 0.5 × input roughness. This is a render rule, not a printer process value.', 'Studio 预览使用 0.5 + 0.5 × 输入粗糙度。这是渲染规则，不是打印机工艺参数。')" side="left"><p class="render-note">{{ t('Studio finish · effective roughness', 'Studio 外观 · 渲染粗糙度') }} <b>{{ (0.5 + draft.roughness * 0.5).toFixed(3) }}</b></p></ModuleTooltip>
        <ModuleTooltip :title="t('Reference image', '参考图')" :description="t('Optional local reference for this material. It is stored with the material record and does not replace PBR textures.', '材质的可选本地参考图。它会保存到材质档案，不会替换 PBR 贴图。')" side="left"><label class="reference-upload"><img v-if="draft.referenceImage" :src="draft.referenceImage" alt="Material reference">{{ t('＋ Reference image (optional)', '＋ 参考图（可选）') }}<input type="file" accept="image/*" @change="reference"></label></ModuleTooltip>
        <p v-if="validation" role="alert" class="error-message">{{ validation }}</p>
        <div class="button-row"><ModuleTooltip :title="t('Cancel editing', '取消编辑')" :description="t('Restore the last saved values and close the editor.', '恢复上次保存的值并关闭编辑器。')" side="left"><button class="secondary" @click="cancel">{{ t('Cancel', '取消') }}</button></ModuleTooltip><ModuleTooltip :title="t('Save material', '保存材质')" :description="t('Save the values and update regions that reference this material.', '保存这些数值，并更新引用此材质的区域。')" side="left"><button class="primary" :disabled="busy" @click="save">{{ t('Save material', '保存材质') }}</button></ModuleTooltip></div>
      </div>
    </template>
    <template v-else>
      <ModuleTooltip :title="t('Search materials', '搜索材质')" :description="t('Filter the library by material name or material ID.', '按材质名称或材质 ID 筛选材质库。')" side="left"><label class="search-field"><span>⌕</span><input v-model="search" :placeholder="t('Search by name or ID', '搜索名称或材质 ID')"></label></ModuleTooltip>
      <div class="library-tabs"><span class="active">{{ t('My materials', '我的材质') }}</span><span class="local-label">● {{ t('Local', '本地') }}</span></div>
      <div class="material-list">
        <article v-for="item in visible" :key="item.id" class="material-card" :class="{ selected: selected?.id === item.id }">
          <ModuleTooltip :title="t('Select for export', '选择导出')" :description="t('Include or exclude this material from the CSV or JSON export.', '将此材质加入或移出 CSV、JSON 导出。')" side="left"><input class="material-check" type="checkbox" :checked="checked.includes(item.id)" :aria-label="`Select ${item.name}`" @change="emit('check', item.id)"></ModuleTooltip>
          <ModuleTooltip :title="t('Apply material', '应用材质')" :description="t('Apply this material to the currently selected region.', '将此材质应用到当前选中的区域。')" side="left"><button class="swatch-sphere" :style="{ '--swatch': item.hex }" :title="t('Apply to selected region', '应用到所选区域')" @click="emit('apply', item)" /></ModuleTooltip>
          <ModuleTooltip :title="t('Apply material', '应用材质')" :description="t('Apply this material to the currently selected region.', '将此材质应用到当前选中的区域。')" side="left"><button class="material-description" @click="emit('apply', item)"><strong>{{ item.name }}</strong><span>{{ item.materialId }} <i>{{ item.hex }}</i></span></button></ModuleTooltip>
          <ModuleTooltip :title="t('Edit material', '编辑材质')" :description="t('Change the saved color, PBR preview parameters or reference image.', '修改已保存的颜色、PBR 预览参数或参考图。')" side="left"><button class="edit-material" :aria-label="`Edit ${item.name}`" @click="edit(item)">↗</button></ModuleTooltip>
        </article>
        <ModuleTooltip :title="t('Create material', '创建材质')" :description="t('Add a new material record without merging it with existing colors.', '新增材质档案，不会与已有颜色合并。')" side="left"><button class="add-material" @click="edit()"><span>＋</span>{{ t('Create a material', '创建新材质') }}</button></ModuleTooltip>
      </div>
      <div v-if="selected" class="selection-detail"><div class="detail-heading">{{ t('SELECTED MATERIAL', '当前材质') }}<ModuleTooltip :title="t('Edit selected material', '编辑当前材质')" :description="t('Open this saved record and preview changes before saving.', '打开已保存档案，保存前可先预览修改。')" side="left"><button class="text-button" @click="edit(selected)">{{ t('Edit', '编辑') }} ↗</button></ModuleTooltip></div><ModuleTooltip :title="t('Selected color', '当前颜色')" :description="t('Saved sRGB HEX value used by this material assignment.', '此材质分配使用的已保存 sRGB HEX 值。')" side="left"><div class="detail-color"><span :style="{ background: selected.hex }" /><b>{{ selected.hex }}</b><small>sRGB</small></div></ModuleTooltip><dl><ModuleTooltip :title="parameterTitle('transparency')" :description="parameterDescription('transparency')" side="left"><div><dt>{{ t('Transparency', '透明度') }}</dt><dd>{{ selected.transparency.toFixed(2) }}</dd></div></ModuleTooltip><ModuleTooltip :title="parameterTitle('metalness')" :description="parameterDescription('metalness')" side="left"><div><dt>{{ t('Metalness', '金属度') }}</dt><dd>{{ selected.metalness.toFixed(2) }}</dd></div></ModuleTooltip><ModuleTooltip :title="parameterTitle('roughness')" :description="parameterDescription('roughness')" side="left"><div><dt>{{ t('Roughness', '粗糙度') }}</dt><dd>{{ selected.roughness.toFixed(2) }}</dd></div></ModuleTooltip></dl></div>
      <footer class="library-footer"><ModuleTooltip :title="t('Export selection', '导出选择')" :description="t('The count is the number of checked materials, or all materials when none are checked.', '数量是勾选的材质数；未勾选时导出全部材质。')" side="left"><span>{{ checked.length || materials.length }} {{ t('materials to export', '个待导出材质') }}</span></ModuleTooltip><div class="button-row"><ModuleTooltip :title="t('Export CSV', '导出 CSV')" :description="t('Download a spreadsheet-friendly table with color and preview values.', '下载适合表格使用的颜色和预览参数数值表。')" side="left"><button class="secondary" @click="emit('export', 'csv')">↓ CSV</button></ModuleTooltip><ModuleTooltip :title="t('Export JSON', '导出 JSON')" :description="t('Download complete material records with IDs, color space and render rules.', '下载包含 ID、色彩空间和渲染规则的完整材质档案。')" side="left"><button class="secondary" @click="emit('export', 'json')">↓ JSON</button></ModuleTooltip></div></footer>
    </template>
  </aside>
</template>
