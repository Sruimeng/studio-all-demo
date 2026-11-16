<script setup lang="ts">
import { computed } from 'vue';
import { useLocale } from '~/@base/locale';
import { site } from '~/@base/site';
import { filamentVendors } from '../filaments';
import { wheelHues, wheelOptions, type WheelEntry, type WheelFilters } from '../color-wheel';

const props = defineProps<{ entries: WheelEntry[]; filters: WheelFilters; busy: boolean }>();
const emit = defineEmits<{ change: [filters: WheelFilters]; reset: [] }>();
const { t } = useLocale();
const options = computed(() => wheelOptions(props.entries, props.filters));
const vendors = computed(() => [...new Set([...filamentVendors, ...options.value.vendors])]);
const vendorCounts = computed(() => new Map(vendors.value.map(vendor => [vendor, props.entries.filter(item => item.vendor === vendor).length])));
function change(key: keyof WheelFilters, event: Event) {
  emit('change', { ...props.filters, [key]: (event.target as HTMLInputElement).value });
}
</script>

<template>
  <aside class="wheel-filters" aria-label="Color wheel filters">
    <div class="filter-heading"><span>{{ t('FILTER CATALOG', '筛选色卡') }}</span><button type="button" @click="emit('reset')">{{ t('Reset', '重置') }}</button></div>
    <label class="filter-label">{{ t('Search colors', '搜索颜色') }}<input :value="filters.query" type="search" aria-label="Search wheel colors" :placeholder="t('Name / HEX / code / product', '名称 / HEX / 颜色号 / 产品')" @input="change('query', $event)"></label>
    <label class="filter-label">{{ t('Manufacturer', '厂商') }}
      <select :value="filters.vendor" aria-label="Wheel manufacturer" :disabled="!!site.vendor" @change="change('vendor', $event)">
        <option v-if="!site.vendor" value="">{{ t('All manufacturers', '全部厂商') }}</option>
        <option v-for="vendor in vendors" :key="vendor" :value="vendor">{{ vendor }} · {{ vendorCounts.get(vendor) ?? 0 }}</option>
      </select>
    </label>
    <label class="filter-label">{{ t('Base material', '基材') }}<select :value="filters.base" aria-label="Wheel base material" @change="change('base', $event)"><option value="">{{ t('All materials', '全部基材') }}</option><option v-for="base in options.bases" :key="base" :value="base">{{ base }}</option></select></label>
    <label class="filter-label">{{ t('Series / product', '系列 / 产品') }}<select :value="filters.series" aria-label="Wheel series" @change="change('series', $event)"><option value="">{{ t('All series', '全部系列') }}</option><option v-for="series in options.series" :key="series.id" :value="series.id">{{ series.name }}</option></select></label>
    <div class="hue-heading">{{ t('HUE FAMILY', '色相分类') }}</div>
    <div class="hue-filters">
      <button type="button" :class="{ active: !filters.hue }" :aria-pressed="!filters.hue" @click="emit('change', { ...filters, hue: '' })">{{ t('All hues', '全部色相') }}</button>
      <button v-for="hue in wheelHues" :key="hue.id" type="button" :class="{ active: filters.hue === hue.id }" :aria-pressed="filters.hue === hue.id" @click="emit('change', { ...filters, hue: hue.id })"><i :style="{ background: hue.hex }" />{{ t(hue.en, hue.cn) }}</button>
    </div>
    <p class="filter-note">{{ t('Each product relationship is a separate record. Identical HEX values are not merged.', '每个产品关系独立计数，相同 HEX 不合并。') }}</p>
    <p class="filter-note">{{ t('Add color lets you choose a manufacturer, base and series, including empty series. No filtering required.', '点击「添加颜色」即可选择厂商、基材与系列，空系列也可录入，无需先筛选。') }}</p>
  </aside>
</template>

<style scoped>
.wheel-filters { min-width: 0; min-height: 0; overflow-y: auto; padding: 22px 18px; background: #222528; scrollbar-width: thin; }
.filter-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; color: #8d969c; font: 10px monospace; letter-spacing: 1px; }
.filter-heading button { color: #c2ef78; font: 11px sans-serif; }
.filter-label { display: grid; gap: 9px; margin-bottom: 18px; font-size: 11px; color: #aeb5ba; }
.filter-label input, .filter-label select { width: 100%; min-width: 0; padding: 10px 8px; border: 1px solid #41464b; border-radius: 6px; background: #1b1e20; color: #e4e7e8; font-size: 11px; }
.hue-heading { color: #8d969c; font: 10px monospace; margin: 25px 0 12px; letter-spacing: 1px; }
.hue-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.hue-filters button { min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding: 8px; border: 1px solid #3a3f43; border-radius: 5px; color: #adb6bc; text-align: left; font-size: 10px; overflow-wrap: anywhere; }
.hue-filters button.active { border-color: #9dbf70; color: #cee7af; background: #343e2c; }
.hue-filters i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.filter-note { color: #828b91; font-size: 10px; line-height: 1.8; margin-top: 22px; }
@media (max-width: 1100px) { .wheel-filters { overflow: visible; } }
@media (max-width: 700px) {
  .wheel-filters { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; padding: 16px 12px; }
  .filter-heading, .filter-label:first-of-type, .filter-label:last-of-type, .hue-heading, .hue-filters, .filter-note { grid-column: 1 / -1; }
  .filter-heading, .filter-label { min-width: 0; margin-bottom: 0; }
  .filter-heading { margin-bottom: 4px; }
  .hue-heading { margin: 4px 0 0; }
  .hue-filters { grid-template-columns: repeat(3,minmax(0,1fr)); }
  .hue-filters button { padding: 8px 5px; gap: 5px; }
  .filter-note { margin-top: 0; }
}
</style>
