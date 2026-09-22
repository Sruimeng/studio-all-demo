<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useLocale } from '~/@base/locale';
import { rgb, validateMaterial } from '../catalog';
import { RENDER_RULE, type MaterialRecord } from '../types';
const props = defineProps<{ materials: MaterialRecord[]; selected: MaterialRecord | null; checked: string[]; busy: boolean; saveMaterial: (material: MaterialRecord) => Promise<boolean> }>();
const emit = defineEmits<{ apply: [material: MaterialRecord]; preview: [material: MaterialRecord | null]; check: [id: string]; export: [format: 'csv' | 'json'] }>();
const { t } = useLocale();
const search = ref(''); const editing = ref(false); const validation = ref('');
const draft = ref<MaterialRecord | null>(null);
const visible = computed(() => props.materials.filter(item => `${item.name} ${item.materialId}`.toLowerCase().includes(search.value.toLowerCase())));
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
    <div class="panel-heading"><div><span class="eyebrow">MATERIAL LIBRARY</span><h2>{{ t('Your materials', '我的材质') }} <small>{{ materials.length }}</small></h2></div><button class="icon-button" :title="t('New material', '新建材质')" aria-label="New material" @click="edit()">＋</button></div>
    <template v-if="editing && draft">
      <div class="editor-title"><button class="text-button" @click="cancel">← {{ t('Library', '材质库') }}</button><span>{{ t('Material editor', '材质编辑') }}</span></div>
      <div class="material-orb" :style="{ '--swatch': draft.hex, '--shine': 1 - draft.roughness }"><div class="orb" /><span>{{ draft.materialId }}</span></div>
      <div class="editor-fields">
        <label>{{ t('Name', '名称') }}<input v-model="draft.name" data-testid="material-name" :placeholder="t('e.g. Satin ivory', '例如：缎面象牙白')"></label>
        <label>{{ t('Material ID', '材质 ID') }}<input v-model="draft.materialId" data-testid="material-id"></label>
        <label>{{ t('Display color', '展示颜色') }}<div class="color-input"><input v-model="draft.hex" type="color" aria-label="Color"><input v-model="draft.hex" aria-label="HEX" maxlength="7"><span>sRGB</span></div></label>
        <div class="rgb-row"><span v-for="(value, index) in rgb(draft.hex)" :key="index">{{ ['R', 'G', 'B'][index] }} <b>{{ value }}</b></span></div>
        <label v-for="field in (['transparency', 'metalness', 'roughness'] as const)" :key="field" class="parameter"><span>{{ field === 'transparency' ? t('Transparency', '透明度') : field === 'metalness' ? t('Metalness', '金属度') : t('Roughness', '粗糙度') }}<input v-model.number="draft[field]" :aria-label="field" type="number" min="0" max="1" step="0.01"></span><input v-model.number="draft[field]" type="range" min="0" max="1" step="0.01" :aria-label="`${field} slider`"></label>
        <p class="render-note">{{ t('Studio finish · effective roughness', 'Studio 外观 · 渲染粗糙度') }} <b>{{ (0.5 + draft.roughness * 0.5).toFixed(3) }}</b></p>
        <label class="reference-upload"><img v-if="draft.referenceImage" :src="draft.referenceImage" alt="Material reference">{{ t('＋ Reference image (optional)', '＋ 参考图（可选）') }}<input type="file" accept="image/*" @change="reference"></label>
        <p v-if="validation" role="alert" class="error-message">{{ validation }}</p>
        <div class="button-row"><button class="secondary" @click="cancel">{{ t('Cancel', '取消') }}</button><button class="primary" :disabled="busy" @click="save">{{ t('Save material', '保存材质') }}</button></div>
      </div>
    </template>
    <template v-else>
      <label class="search-field"><span>⌕</span><input v-model="search" :placeholder="t('Search by name or ID', '搜索名称或材质 ID')"></label>
      <div class="library-tabs"><span class="active">{{ t('My materials', '我的材质') }}</span><span class="local-label">● {{ t('Local', '本地') }}</span></div>
      <div class="material-list">
        <article v-for="item in visible" :key="item.id" class="material-card" :class="{ selected: selected?.id === item.id }">
          <input class="material-check" type="checkbox" :checked="checked.includes(item.id)" :aria-label="`Select ${item.name}`" @change="emit('check', item.id)">
          <button class="swatch-sphere" :style="{ '--swatch': item.hex }" :title="t('Apply to selected region', '应用到所选区域')" @click="emit('apply', item)" />
          <button class="material-description" @click="emit('apply', item)"><strong>{{ item.name }}</strong><span>{{ item.materialId }} <i>{{ item.hex }}</i></span></button>
          <button class="edit-material" :aria-label="`Edit ${item.name}`" @click="edit(item)">↗</button>
        </article>
        <button class="add-material" @click="edit()"><span>＋</span>{{ t('Create a material', '创建新材质') }}</button>
      </div>
      <div v-if="selected" class="selection-detail"><div class="detail-heading">{{ t('SELECTED MATERIAL', '当前材质') }}<button class="text-button" @click="edit(selected)">{{ t('Edit', '编辑') }} ↗</button></div><div class="detail-color"><span :style="{ background: selected.hex }" /><b>{{ selected.hex }}</b><small>sRGB</small></div><dl><div><dt>{{ t('Transparency', '透明度') }}</dt><dd>{{ selected.transparency.toFixed(2) }}</dd></div><div><dt>{{ t('Metalness', '金属度') }}</dt><dd>{{ selected.metalness.toFixed(2) }}</dd></div><div><dt>{{ t('Roughness', '粗糙度') }}</dt><dd>{{ selected.roughness.toFixed(2) }}</dd></div></dl></div>
      <footer class="library-footer"><span>{{ checked.length || materials.length }} {{ t('materials to export', '个待导出材质') }}</span><div class="button-row"><button class="secondary" @click="emit('export', 'csv')">↓ CSV</button><button class="secondary" @click="emit('export', 'json')">↓ JSON</button></div></footer>
    </template>
  </aside>
</template>
