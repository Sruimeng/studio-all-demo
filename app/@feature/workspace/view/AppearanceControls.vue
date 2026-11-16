<script setup lang="ts">
import { computed } from 'vue';
import { useLocale } from '~/@base/locale';
import type { ViewerSettings } from '~/@engine/viewer';

const props = defineProps<{ settings: ViewerSettings }>();
const emit = defineEmits<{ select: [value: Pick<ViewerSettings, 'mode' | 'appearance'>] }>();
const { t } = useLocale();
const views = computed(() => [
  { key: 'original', label: t('Original', '原始外观'), mode: 'original' as const, appearance: 'material' as const },
  { key: 'ideal', label: t('Ideal colors', '理想分色'), mode: 'print' as const, appearance: 'ideal' as const },
  { key: 'material', label: t('Filament', '耗材效果'), mode: 'print' as const, appearance: 'material' as const },
  { key: 'compare', label: t('Compare', '对比'), mode: 'compare' as const, appearance: props.settings.appearance ?? 'material' },
]);
const active = computed(() => props.settings.mode === 'print' ? props.settings.appearance ?? 'material' : props.settings.mode);
</script>

<template>
  <div class="studio-segmented viewer-modes" :aria-label="t('Appearance view', '外观视图')">
    <button v-for="view in views" :key="view.key" type="button" :class="{ active: active === view.key }" :aria-pressed="active === view.key" @click="emit('select', { mode: view.mode, appearance: view.appearance })">{{ view.label }}</button>
  </div>
</template>
