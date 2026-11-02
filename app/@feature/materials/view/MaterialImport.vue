<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import { useLocale } from '~/@base/locale';
import type { MaterialImportResult } from '../types';
const { tr } = useLocale();
defineProps<{ busy: boolean; importMaterials: (files: File[]) => Promise<MaterialImportResult> }>();
const emit = defineEmits<{ imported: [] }>();
const { t } = useLocale();
const input = shallowRef<HTMLInputElement | null>(null);
const result = shallowRef<MaterialImportResult | null>(null);
const importing = ref(false);
async function upload(event: Event, importMaterials: (files: File[]) => Promise<MaterialImportResult>) {
  const element = event.target as HTMLInputElement;
  const files = Array.from(element.files ?? []); element.value = '';
  if (!files.length) return;
  importing.value = true; result.value = null;
  try {
    result.value = await importMaterials(files);
    if (result.value.imported) emit('imported');
  } catch (error) { result.value = { imported: 0, errors: [error instanceof Error ? error.message : String(error)] }; }
  finally { importing.value = false; }
}
</script>
<template>
  <div class="material-import">
    <input ref="input" type="file" accept=".usda" multiple hidden aria-label="Upload USDA materials" @change="upload($event, importMaterials)">
    <button class="secondary" type="button" :disabled="busy || importing" @click="input?.click()">{{ tr(importing ? t('Importing…', '正在导入…') : t('↑ Import USDA', '↑ 导入 USDA 材质')) }}</button>
    <p>{{ t('Select one or more USDA files. Materials are saved locally; select one to apply.', '可多选 USDA 文件，保存到本地库后点击材质应用。') }}</p>
    <p v-if="result?.imported" role="status">{{ t(`Imported ${result.imported} materials`, `已导入 ${result.imported} 个材质`) }}</p>
    <ul v-if="result?.errors.length" role="alert"><li v-for="(error, index) in result.errors" :key="index">{{ tr(error) }}</li></ul>
  </div>
</template>
<style scoped>
.material-import { flex-shrink: 0; margin: 8px 0; }
.material-import button { width: 100%; }
.material-import p, .material-import ul { margin: 6px 0; color: #aaa; font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; }
.material-import ul { padding-left: 14px; color: #e9b18c; max-height: 100px; overflow-y: auto; }
</style>
