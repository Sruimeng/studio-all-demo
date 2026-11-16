<script setup lang="ts">
import { useLocale } from '~/@base/locale';

const props = defineProps<{ colorCount: number; precision: number; disabled: boolean; updating: boolean; maxColorCount?: number; suggestedColorCount?: number; algorithm?: string; upstreamPreview?: boolean }>();
const emit = defineEmits<{ change: [value: { colorCount: number; precision: number }] }>();
const { t } = useLocale();
function update(key: 'colorCount' | 'precision', event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  emit('change', { colorCount: props.colorCount, precision: props.precision, [key]: value });
}
</script>

<template>
  <div class="live-regions">
    <p data-testid="quantizer-status" :data-algorithm="algorithm" :data-actual-k="colorCount" :data-max-k="maxColorCount ?? 16">{{ algorithm === 'upstream' ? 'vast-enterprise/color-quantization' : t('Surface compatibility path', '表面兼容路径') }} · {{ t('Available', '可用') }} 1–{{ maxColorCount ?? 16 }}<span v-if="suggestedColorCount"> · {{ t('Suggested', '建议') }} {{ suggestedColorCount }}</span></p>
    <label class="studio-range"><span>{{ t('Colors', '颜色数') }}<b>{{ colorCount }}</b></span><input data-testid="quantization-colors" :value="colorCount" type="range" min="1" :max="maxColorCount ?? 16" :disabled="disabled" @input="update('colorCount', $event)"></label>
    <label class="studio-range"><span>{{ t('Detail', '细节') }}<b>{{ precision }}/6</b></span><input :value="precision" type="range" min="1" max="6" :disabled="disabled" @input="update('precision', $event)"></label>
    <div class="detail-scale"><span>{{ upstreamPreview ? t('Coarser display', '较粗显示') : t('Merge small regions', '合并小区域') }}</span><span>{{ upstreamPreview ? t('Finer display', '较细显示') : t('Keep small regions', '保留小区域') }}</span></div>
    <p v-if="upstreamPreview" data-testid="upstream-preview-limit">{{ t('3MF export is paused. Save your project or download a ZIP to keep your edits.', '3MF 导出暂缓。保存项目或下载 ZIP，可保留全部编辑。') }}</p>
    <p class="live-status" :class="{ updating }" role="status" aria-live="polite"><i />{{ updating ? t('Updating preview…', '正在更新预览…') : t('Live preview · drag to update', '实时预览 · 拖动自动更新') }}</p>
  </div>
</template>

<style scoped>
.detail-scale { display: flex; justify-content: space-between; margin-top: 7px; color: #92989f; font-size: 10px; }
.live-status { display: flex; align-items: center; gap: 7px; margin: 16px 0 0; color: #aebbb2; font-size: 11px; }
.live-status i { width: 6px; height: 6px; border-radius: 50%; background: #9acba6; }
.live-status.updating { color: #c5b8ef; }
.live-status.updating i { background: #b394ef; }
</style>
