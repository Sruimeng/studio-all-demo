<script setup lang="ts">
import { useLocale } from '~/@base/locale';
import { materialHex } from '../supplier';
import type { MaterialRecord } from '../types';
defineProps<{ colors: MaterialRecord[]; selected: MaterialRecord | null; busy: boolean }>();
const emit = defineEmits<{ select: [material: MaterialRecord] }>();
const { t } = useLocale();
</script>
<template>
  <div class="series-colors">
    <p v-if="!colors.length" class="empty-colors">{{ t('No color values for this series yet. Preview a template or add your own color.', '该系列尚无色值。可先验证通用外观，或添加自己的颜色。') }}</p>
    <button v-for="color in colors" :key="color.id" class="series-color" :class="{ active: selected?.id === color.id }" :disabled="busy" @click="emit('select', color)">
      <i class="color-chip" :style="{ background: materialHex(color) }" />
      <span class="color-copy"><strong>{{ color.name }}</strong><small>{{ color.appearance?.colorCode || color.appearance?.sku || color.supplier?.catalogId || color.materialId }} · {{ materialHex(color) }}</small><small v-if="color.appearance?.sku && color.appearance.colorCode && color.appearance.sku !== color.appearance.colorCode">SKU {{ color.appearance.sku }}</small></span>
      <small class="color-origin">{{ color.appearance?.origin === 'user' ? t('Custom', '自定义') : t('Catalog', '色卡') }}</small>
    </button>
  </div>
</template>
<style scoped>
.series-colors { display: grid; gap: 5px; max-height: 310px; overflow-y: auto; }
.series-color { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; border: 1px solid transparent; background: #27292d; padding: 8px; border-radius: 6px; }
.series-color:hover { background: #32353a; }
.series-color.active { border-color: #c2ef78; }
.color-chip { width: 29px; height: 29px; flex: 0 0 29px; border: 1px solid #ffffff20; border-radius: 5px; }
.color-copy { display: grid; gap: 4px; min-width: 0; }
.color-copy strong { color: #e5e6e8; font-size: 11px; font-weight: 500; }
.color-copy small { color: #979b9f; font: 9px monospace; overflow-wrap: anywhere; }
.color-origin { margin-left: auto; flex-shrink: 0; color: #9da98c; font-size: 9px; }
.empty-colors { color: #969a9f; line-height: 1.7; font-size: 11px; padding: 13px; margin: 0; background: #27292d; border-radius: 6px; }
</style>
