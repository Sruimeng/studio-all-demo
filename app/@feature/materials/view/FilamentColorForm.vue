<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useLocale } from '~/@base/locale';
import { createFilamentColor } from '../filaments';
import { validateMaterial } from '../catalog';
import type { MaterialRecord } from '../types';
const props = defineProps<{ preview: MaterialRecord; materials: MaterialRecord[]; busy: boolean; saveMaterial: (material: MaterialRecord) => Promise<boolean> }>();
const emit = defineEmits<{ close: [] }>();
const { t } = useLocale();
const input = reactive({ name: '', hex: props.preview.hex, colorCode: '', sku: '', source: '' });
const error = ref('');
async function save() {
  const material = createFilamentColor(props.preview, input, crypto.randomUUID());
  error.value = validateMaterial(material, props.materials) ?? '';
  if (error.value) return;
  if (input.sku.trim() && props.materials.some(item => (item.appearance?.vendor ?? item.supplier?.vendor) === material.appearance!.vendor && (item.appearance?.sku ?? item.supplier?.sku) === input.sku.trim())) {
    error.value = t('This sales SKU already exists for this manufacturer.', '该厂商的销售 SKU 已存在。'); return;
  }
  if (await props.saveMaterial(material)) emit('close');
}
</script>
<template>
  <form class="color-form" @submit.prevent="save">
    <p class="form-note">{{ t('Custom color · inherits the current appearance. Color code and sales SKU are independent.', '自定义颜色 · 继承当前外观。颜色号与销售 SKU 分开保存。') }}</p>
    <p v-if="preview.appearanceBinding" class="form-note">{{ t('Bound material', '绑定材质') }} · {{ preview.appearanceBinding.name }}</p>
    <label>{{ t('Color name', '颜色名称') }}<input v-model="input.name" required maxlength="100" aria-label="Color name" placeholder="Rose Quartz"></label>
    <label>HEX · sRGB<div class="hex-input"><input v-model="input.hex" type="color" aria-label="New color swatch"><input v-model="input.hex" required pattern="#[0-9a-fA-F]{6}" aria-label="New color HEX" maxlength="7"></div></label>
    <label>{{ t('Color code (optional)', '颜色号（可选）') }}<input v-model="input.colorCode" aria-label="Color code" maxlength="100" :title="t('Manufacturer color number; may differ from sales SKU', '厂商颜色编号，可能与销售 SKU 不同')"></label>
    <label>{{ t('Sales SKU (optional)', '销售 SKU（可选）') }}<input v-model="input.sku" aria-label="Sales SKU" maxlength="150" :title="t('May include diameter, weight and packaging', '可包含线径、重量与包装规格')"></label>
    <label>{{ t('Color source (optional)', '颜色资料来源（可选）') }}<input v-model="input.source" aria-label="Color source" maxlength="500" :placeholder="t('URL, color chart or measurement', '网址、色卡或测量说明')"></label>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <div class="button-row"><button class="secondary" type="button" :disabled="busy" @click="emit('close')">{{ t('Cancel', '取消') }}</button><button class="primary" type="submit" :disabled="busy">{{ t('Save color locally', '保存颜色到本地') }}</button></div>
  </form>
</template>
<style scoped>
.color-form { display: grid; gap: 11px; padding: 12px; border: 1px solid #596447; border-radius: 7px; background: #272b26; }
.form-note { margin: 0; color: #a9b49d; line-height: 1.6; font-size: 10px; }
label { display: grid; gap: 5px; color: #b5b9b2; font-size: 11px; }
input { width: 100%; min-width: 0; background: #202321; color: #eee; border: 1px solid #484d44; border-radius: 5px; padding: 7px; }
.hex-input { display: flex; gap: 7px; }
.hex-input input[type=color] { width: 36px; padding: 2px; height: 32px; }
</style>
