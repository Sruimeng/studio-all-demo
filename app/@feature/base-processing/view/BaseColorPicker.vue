<script setup lang="ts">
import { ref, watch } from 'vue';
import { useLocale } from '~/@base/locale';
import { hexToHSV, hsvToHex } from '../color';
const props = defineProps<{ color: string }>();
const emit = defineEmits<{ change: [color: string]; close: [] }>();
const { t } = useLocale();
const hue = ref(0), saturation = ref(0), value = ref(1), draft = ref('');
watch(() => props.color, hex => {
  const [h, s, v] = hexToHSV(hex);
  if (s > 0 && v > 0) hue.value = h;
  saturation.value = s; value.value = v; draft.value = hex.slice(1).toUpperCase();
}, { immediate: true });
function apply() { emit('change', hsvToHex(hue.value, saturation.value, value.value)); }
function point(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement;
  if (event.type === 'pointerdown') {
    if (event.button !== 0) return;
    target.setPointerCapture(event.pointerId); target.focus();
  } else if (!target.hasPointerCapture(event.pointerId)) return;
  const rect = target.getBoundingClientRect();
  saturation.value = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  value.value = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  apply();
}
function key(event: KeyboardEvent) {
  const step = event.shiftKey ? 0.1 : 0.01;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  saturation.value = Math.max(0, Math.min(1, saturation.value + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)));
  value.value = Math.max(0, Math.min(1, value.value + (event.key === 'ArrowDown' ? -step : event.key === 'ArrowUp' ? step : 0)));
  apply();
}
function hexChanged() {
  const hex = '#' + draft.value.trim().replace(/^#/, '');
  if (/^#[\da-f]{6}$/i.test(hex)) emit('change', hex.toLowerCase());
  else draft.value = props.color.slice(1).toUpperCase();
}
</script>
<template>
  <div class="base-color-picker" @keydown.esc.stop.prevent="emit('close')">
    <header><h2>{{ t('Custom Color', '自定义颜色') }}</h2><button type="button" :aria-label="t('Close color picker', '关闭颜色面板')" @click="emit('close')"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m4 4 8 8m0-8-8 8" /></svg></button></header>
    <div class="base-color-field" tabindex="0" role="slider" :aria-label="t('Saturation and brightness', '饱和度与明度')" :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="Math.round(saturation * 100)" :aria-valuetext="t(`Saturation ${Math.round(saturation * 100)}%, brightness ${Math.round(value * 100)}%`, `饱和度 ${Math.round(saturation * 100)}%，明度 ${Math.round(value * 100)}%`)" :style="{ backgroundColor: `hsl(${hue} 100% 50%)` }" @pointerdown.prevent="point" @pointermove.prevent="point" @keydown="key"><i :style="{ left: saturation * 100 + '%', top: (1 - value) * 100 + '%', backgroundColor: color }" /></div>
    <input v-model.number="hue" class="base-color-hue" type="range" min="0" max="359" step="1" :aria-label="t('Hue', '色相')" :style="{ '--thumb-color': `hsl(${hue} 100% 50%)` }" @input="apply">
    <div class="base-color-value"><span :style="{ backgroundColor: color }" /><label><span class="sr-only">{{ t('Color HEX', '颜色 HEX') }}</span><input v-model="draft" maxlength="7" spellcheck="false" :aria-label="t('Color HEX', '颜色 HEX')" @change="hexChanged" @keydown.enter="hexChanged"></label></div>
  </div>
</template>
<style scoped>
.base-color-picker{width:248px;padding:12px;background:#26272c;border-radius:16px;color:#f2f2f2;box-shadow:0 8px 32px #0003}.base-color-picker header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.base-color-picker h2{font-size:12px;font-weight:400}.base-color-picker header button{display:grid;place-items:center;width:20px;height:20px;color:#999}.base-color-picker header svg{width:16px;height:16px}.base-color-field{position:relative;aspect-ratio:1;border-radius:14px;background-image:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent);touch-action:none;cursor:crosshair}.base-color-field i{position:absolute;width:12px;height:12px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #0006;transform:translate(-50%,-50%);pointer-events:none}.base-color-hue{appearance:none;display:block;width:100%;height:6px;margin:22px 0;border-radius:8px;background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);cursor:pointer}.base-color-hue::-webkit-slider-thumb{appearance:none;width:13px;height:13px;border:2px solid #fff;border-radius:50%;background:var(--thumb-color);box-shadow:0 0 0 1px #0004}.base-color-hue::-moz-range-thumb{width:10px;height:10px;border:2px solid #fff;border-radius:50%;background:var(--thumb-color)}.base-color-value{display:flex;align-items:center;justify-content:space-between}.base-color-value>span{width:32px;height:32px;border-radius:50%;box-shadow:inset 0 0 0 1px #ffffff18}.base-color-value input{width:74px;height:32px;background:transparent;border:1px solid #ffffff1a;border-radius:8px;text-align:center;color:#f2f2f2;font-size:12px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
</style>
