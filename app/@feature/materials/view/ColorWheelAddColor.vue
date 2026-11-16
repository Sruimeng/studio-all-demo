<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { useLocale } from '~/@base/locale';
import { site } from '~/@base/site';
import { wheelColorPreview, wheelCreationContext, wheelCreationOptions, type WheelCreationContext, type WheelEntry, type WheelFilters } from '../color-wheel';
import type { MaterialRecord } from '../types';
import AppearanceBinding from './AppearanceBinding.vue';
import FilamentColorForm from './FilamentColorForm.vue';

const props = defineProps<{ initialFilters: WheelFilters; entries: WheelEntry[]; materials: MaterialRecord[]; selected: MaterialRecord | null; busy: boolean; saveMaterial: (material: MaterialRecord) => Promise<boolean> }>();
const emit = defineEmits<{ close: []; preview: [material: MaterialRecord | null] }>();
const { t } = useLocale();
const context = shallowRef(wheelCreationContext(props.entries, props.initialFilters, site.vendor));
const preview = shallowRef(wheelColorPreview(context.value.vendor, context.value.base, context.value.series, props.selected));
const options = computed(() => wheelCreationOptions(props.entries, context.value, site.vendor));
function change(key: keyof WheelCreationContext, event: Event) {
  if (props.busy || key === 'vendor' && site.vendor) return;
  const value = (event.target as HTMLSelectElement).value;
  const next = key === 'series' ? { ...context.value, series: value } : wheelCreationContext(props.entries, { ...context.value, [key]: value, series: '' }, site.vendor);
  context.value = next;
  preview.value = wheelColorPreview(next.vendor, next.base, next.series, preview.value);
}
</script>

<template>
  <section class="wheel-add-color" :aria-label="t('Add manufacturer color', '添加厂商颜色')">
    <h2>{{ t('Add color', '添加颜色') }}</h2>
    <p class="creation-note">{{ t('Add a custom color to', '添加自定义颜色至') }} {{ context.vendor }}{{ t(' · Library only; saving does not apply it to the model.', ' · 仅保存到材质库，不应用到模型。') }}</p>
    <div class="creation-context">
      <label>{{ t('Manufacturer', '厂商') }}
        <select :value="context.vendor" :disabled="busy || !!site.vendor" aria-label="New color manufacturer" @change="change('vendor', $event)"><option v-for="vendor in options.vendors" :key="vendor" :value="vendor">{{ vendor }}</option></select>
      </label>
      <label>{{ t('Base material', '基材') }}
        <select :value="context.base" :disabled="busy" aria-label="New color base material" @change="change('base', $event)"><option v-for="base in options.bases" :key="base" :value="base">{{ base }}</option></select>
      </label>
      <label>{{ t('Series / product', '系列 / 产品') }}
        <select :value="context.series" :disabled="busy" aria-label="New color series" @change="change('series', $event)"><option value="">{{ t('Independent · no catalog series', '独立颜色 · 不归属目录系列') }}</option><option v-for="series in options.series" :key="series.id" :value="series.id">{{ series.name }}</option></select>
      </label>
    </div>
    <AppearanceBinding :material="preview" :materials="materials" :busy="busy" @update="preview = $event" />
    <FilamentColorForm :preview="preview" :materials="materials" :busy="busy" :save-material="saveMaterial" @preview="emit('preview', $event)" @close="emit('close')" />
  </section>
</template>

<style scoped>
h2 { font-size: 18px; font-weight: 500; margin-bottom: 12px; }
.creation-note { color: #9ba9b2; font-size: 10px; line-height: 1.8; margin-bottom: 16px; overflow-wrap: anywhere; }
.creation-context { display: grid; gap: 12px; }
label { display: grid; gap: 8px; color: #aeb5ba; font-size: 11px; }
select { width: 100%; min-width: 0; padding: 10px 8px; border: 1px solid #41464b; border-radius: 6px; background: #1b1e20; color: #e4e7e8; font-size: 11px; }
</style>
