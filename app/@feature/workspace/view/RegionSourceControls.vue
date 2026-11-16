<script setup lang="ts">
import { useLocale } from '~/@base/locale';

defineProps<{ sourceCount: number; source: 'imported' | 'automatic'; regionCount: number; duration: number; busy: boolean }>();
const emit = defineEmits<{ preserve: [] }>();
const { t } = useLocale();
</script>

<template>
  <div class="region-source" role="status">
    <strong>{{ source === 'imported' ? t('Source boundaries preserved', '已保留原分色边界') : t('Current colors', '当前分色') }} · {{ regionCount }}</strong>
    <p v-if="sourceCount">{{ t(`Detected ${sourceCount} flat face colors. Material changes keep these boundaries.`, `检测到 ${sourceCount} 种逐面纯色。更换耗材不改变区域边界。`) }}</p>
    <p v-else>{{ t('Textured or gradient models use automatic segmentation.', '贴图或渐变模型使用自动分色。') }}</p>
    <small v-if="duration > 0">{{ source === 'imported' ? t('Region matching', '区域匹配') : t('Preview update', '预览更新') }} {{ duration < 1000 ? `${Math.round(duration)} ms` : `${(duration / 1000).toFixed(2)} s` }}</small>
    <button v-if="sourceCount" type="button" :disabled="busy || source === 'imported'" @click="emit('preserve')">{{ t('Restore source regions', '恢复原分色') }}</button>
  </div>
</template>

<style scoped>
.region-source { margin: 12px 0; padding: 12px; border: 1px solid #35393e; border-radius: 8px; background: #25292e; font-size: 11px; }
.region-source strong { color: #dce6dc; font-size: 12px; }
.region-source p { margin: 7px 0; color: #a5aab1; line-height: 1.6; }
.region-source small { color: #a5aab1; }
.region-source button { display: block; width: 100%; margin-top: 10px; padding: 6px; border: 1px solid #4c5550; border-radius: 5px; }
.region-source button:disabled { opacity: 0.45; }
</style>
