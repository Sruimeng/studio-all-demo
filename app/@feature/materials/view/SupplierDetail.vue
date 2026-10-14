<script setup lang="ts">
import { useLocale } from '~/@base/locale';
import { storeToRefs } from 'pinia';
import { supplierIssue } from '../supplier';
import type { MaterialRecord } from '../types';
defineProps<{ material: MaterialRecord }>();
const locale = useLocale();
const { t } = locale;
const { language } = storeToRefs(locale);
</script>
<template>
  <section v-if="material.supplier" class="supplier-detail">
    <strong>{{ material.supplier.vendor || t('Local USDA', '本地 USDA') }} · {{ material.supplier.sku }}</strong>
    <p>{{ material.supplier.product || t('Product unconfirmed', '产品系列待确认') }}</p>
    <dl>
      <div><dt>{{ t('Material type', '材料类型') }}</dt><dd>{{ material.supplier.materialType || t('Unconfirmed', '待确认') }}</dd></div>
      <div><dt>{{ t('Catalog HEX', '表格 HEX') }}</dt><dd>{{ material.supplier.catalogHex || '—' }}</dd></div>
      <div><dt>Pantone</dt><dd>{{ material.supplier.pantone || '—' }}</dd></div>
      <div><dt>D65 Lab</dt><dd>{{ material.supplier.d65Lab?.join(' / ') || '—' }}</dd></div>
      <div><dt>{{ t('Source color', '源颜色') }}</dt><dd>{{ material.supplier.source.parameters.base_color || '—' }}</dd></div>
      <div><dt>{{ t('Preview color', '预览颜色来源') }}</dt><dd>{{ material.overrides?.hex ? t('Local HEX', '本地 HEX') : (material.overrides?.colorMode ?? (material.supplier.origin === 'local-usda' ? 'linear-srgb' : 'catalog')) === 'linear-srgb' ? t('Assumed linear sRGB', '假设线性 sRGB') : material.overrides?.colorMode === 'srgb' ? t('Assumed sRGB', '假设 sRGB') : material.supplier.origin === 'local-usda' ? t('Imported preview HEX', '导入时预览 HEX') : t('Catalog HEX', '表格 HEX') }}</dd></div>
      <div><dt>{{ t('Source file', '来源文件') }}</dt><dd>{{ material.supplier.source.file?.split('/').pop() || '—' }}</dd></div>
      <div><dt>{{ t('Revision', '源文件版本') }}</dt><dd :title="material.supplier.source.sha256 || ''">{{ material.supplier.source.sha256?.slice(0, 12) || '—' }}</dd></div>
    </dl>
    <ul class="supplier-issues"><li v-for="issue in material.supplier.issues" :key="issue">{{ supplierIssue(issue, language === 'en') }}</li></ul>
    <p v-if="material.supplier.source.file">{{ t('OpenPBR subset preview. Source color space and physical appearance still need verification.', 'OpenPBR 参数子集预览。源颜色空间与实物效果仍需验证。') }}</p>
    <p v-if="Object.keys(material.overrides ?? {}).length" class="local-edit-note">{{ t('Local adjustments are active. Supplier source values are retained.', '已应用本地调整；源文件原始值保留。') }}</p>
  </section>
</template>
<style scoped>
.supplier-detail { padding: 12px 0; font-size: 10px; line-height: 1.6; }
.supplier-detail > p { margin-top: 6px; color: #999; }
.supplier-detail dl { margin-top: 10px; }
.supplier-detail dl > div { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; }
.supplier-detail dt { flex-shrink: 0; color: #999; }
.supplier-detail dd { overflow-wrap: anywhere; text-align: right; }
.supplier-issues { padding-left: 16px; margin: 10px 0; color: #e9c17b; }
.local-edit-note { color: #beb2ff !important; }
</style>
