<script setup lang="ts">
import { computed } from 'vue';
import { useLocale } from '~/@base/locale';
import { baseMaterials, filamentVendors, materialSeries } from '../filaments';
const props = defineProps<{ vendor: string; baseMaterial: string; seriesId: string; busy: boolean }>();
const emit = defineEmits<{ vendor: [value: string]; base: [value: string]; series: [value: string] }>();
const { t } = useLocale();
const series = computed(() => materialSeries.filter(item => item.vendor === props.vendor && item.baseMaterial === props.baseMaterial));
</script>
<template>
  <div class="filament-selector">
    <div class="filter-pair">
      <label>{{ t('Manufacturer', '厂商') }}<select :value="vendor" aria-label="Filament manufacturer" :disabled="busy" @change="emit('vendor', ($event.target as HTMLSelectElement).value)"><option v-for="name in filamentVendors" :key="name">{{ name }}</option></select></label>
      <label>{{ t('Base material', '基材') }}<select :value="baseMaterial" aria-label="Base material" :disabled="busy" @change="emit('base', ($event.target as HTMLSelectElement).value)"><option v-for="name in baseMaterials" :key="name">{{ name }}</option></select></label>
    </div>
    <label>{{ t('Product series', '产品系列') }}<select :value="seriesId" aria-label="Product series" :disabled="busy" @change="emit('series', ($event.target as HTMLSelectElement).value)"><option value="">{{ t('Generic experiment · no product association', '通用试验 · 未关联厂商产品') }}</option><option v-for="item in series" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
  </div>
</template>
<style scoped>
.filament-selector { display: grid; gap: 12px; }
.filter-pair { display: grid; grid-template-columns: 1.35fr 1fr; gap: 10px; }
label { display: grid; gap: 6px; color: #aeb1b5; font-size: 11px; }
select { width: 100%; min-width: 0; background: #24262a; border: 1px solid #414348; border-radius: 6px; padding: 9px 7px; color: #eee; font-size: 12px; }
</style>
