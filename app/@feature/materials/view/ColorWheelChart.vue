<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue';
import { useLocale } from '~/@base/locale';
import { layoutWheel, wheelGrid, type WheelEntry } from '../color-wheel';

const props = defineProps<{ entries: WheelEntry[]; selected: string; layoutEntries?: WheelEntry[]; vendor?: string }>();
const emit = defineEmits<{ select: [id: string] }>();
const { t } = useLocale();
const viewport = useTemplateRef<HTMLDivElement>('viewport');
const hovered = shallowRef('');
const theme = shallowRef<'light' | 'dark'>('dark');
const zoom = shallowRef(1);
const catalog = computed(() => props.layoutEntries ?? props.entries);
const grid = computed(() => wheelGrid(catalog.value.filter(entry => entry.hex).length));
const layout = computed(() => layoutWheel(catalog.value, grid.value));
const records = computed(() => new Map(props.entries.map(entry => [entry.id, entry])));
const slots = computed(() => layout.value.flatMap(slot => {
  const entry = records.value.get(slot.id);
  return entry ? [{ ...slot, entry }] : [];
}));
const selectedSlot = computed(() => slots.value.find(slot => slot.id === props.selected));
const hoveredSlot = computed(() => slots.value.find(slot => slot.id === hovered.value));
const current = computed(() => records.value.get(hovered.value) ?? records.value.get(props.selected));
const wordmark = computed(() => props.vendor || t('Color atlas', '色彩档案'));
const sheetStyle = computed(() => ({ width: `${zoom.value * 100}%`, height: `${zoom.value * 100}%` }));
const labels = [
  { angle: 0, cn: '红', en: 'Red' }, { angle: 30, cn: '橙', en: 'Orange' },
  { angle: 60, cn: '黄', en: 'Yellow' }, { angle: 90, cn: '黄绿', en: 'Lime' },
  { angle: 120, cn: '绿', en: 'Green' }, { angle: 150, cn: '蓝绿', en: 'Teal' },
  { angle: 180, cn: '青', en: 'Cyan' }, { angle: 210, cn: '天蓝', en: 'Azure' },
  { angle: 240, cn: '蓝', en: 'Blue' }, { angle: 270, cn: '紫', en: 'Purple' },
  { angle: 300, cn: '紫红', en: 'Magenta' }, { angle: 330, cn: '玫红', en: 'Rose' },
].map(label => ({ ...label, x: 500 + 493 * Math.sin(label.angle * Math.PI / 180), y: 520 - 493 * Math.cos(label.angle * Math.PI / 180) }));
function changeZoom(delta: number) { zoom.value = Math.min(3, Math.max(1, zoom.value + delta)); }
function fit() {
  zoom.value = 1;
  viewport.value?.scrollTo({ left: 0, top: 0 });
}
watch(zoom, async () => {
  await nextTick();
  const element = viewport.value;
  if (element) element.scrollTo({ left: (element.scrollWidth - element.clientWidth) / 2, top: (element.scrollHeight - element.clientHeight) / 2 });
});
</script>

<template>
  <div class="wheel-chart" :data-theme="theme">
    <div class="chart-toolbar" :aria-label="t('Color wheel display controls', '色轮显示控制')">
      <div class="canvas-themes" :aria-label="t('Canvas background only', '仅切换画布背景')"><button type="button" :aria-pressed="theme === 'light'" @click="theme = 'light'">{{ t('Light', '浅底') }}</button><button type="button" :aria-pressed="theme === 'dark'" @click="theme = 'dark'">{{ t('Dark', '深底') }}</button></div>
      <div class="zoom-controls"><button type="button" @click="fit">{{ t('Fit', '适配') }}</button><button type="button" :disabled="zoom <= 1" :aria-label="t('Zoom out', '缩小色轮')" @click="changeZoom(-0.25)">−</button><input v-model.number="zoom" type="range" min="1" max="3" step="0.25" :aria-label="t('Color wheel zoom', '色轮缩放')"><button type="button" :disabled="zoom >= 3" :aria-label="t('Zoom in', '放大色轮')" @click="changeZoom(0.25)">＋</button><output class="zoom-value">{{ Math.round(zoom * 100) }}%</output></div>
    </div>
    <div ref="viewport" class="chart-viewport" tabindex="0" :aria-label="t('Wheel canvas; scroll to pan when zoomed', '色轮画布；放大后可滚动查看')">
      <div class="chart-sheet" :style="sheetStyle">
        <svg class="radial-chart" viewBox="-55 -20 1110 1080" role="group" :aria-label="t('Source color grid; light outward, dark inward. Gray empty cells are not catalog colors.', '源色网格：外浅内深。灰色空格不代表目录颜色。')">
          <g class="wheel-background" aria-hidden="true"><path v-for="cell in grid" :key="cell.index" :d="cell.path" /></g>
          <g aria-hidden="true"><text v-for="label in labels" :key="label.angle" :x="label.x" :y="label.y" class="hue-label">{{ label.cn }}<tspan :x="label.x" dy="25" class="hue-translation">{{ label.en }}</tspan></text><text x="500" y="506" class="center-wordmark" :class="{ 'vendor-wordmark': !!vendor }">{{ wordmark }}</text><text x="500" y="546" class="center-subline">COLOR ATLAS</text><text x="500" y="580" class="center-count">{{ entries.length }} · {{ t('RECORDS', '条颜色记录') }}</text></g>
          <path v-for="slot in slots" :key="slot.id" :d="slot.path" :fill="slot.entry.hex!" class="wheel-slot" role="button" tabindex="0" :aria-pressed="selected === slot.id" :aria-label="`${slot.entry.material.name} · ${slot.entry.vendor} · ${slot.entry.seriesName} · ${slot.entry.hex}`" @click="emit('select', slot.id)" @keydown.enter.prevent="emit('select', slot.id)" @keydown.space.prevent="emit('select', slot.id)" @focus="hovered = slot.id" @blur="hovered = ''" @mouseenter="hovered = slot.id" @mouseleave="hovered = ''"><title>{{ slot.entry.material.name }} · {{ slot.entry.seriesName }} · {{ slot.entry.hex }}</title></path>
          <path v-if="selectedSlot" :d="selectedSlot.path" class="selection-outline" aria-hidden="true" />
          <path v-if="hoveredSlot && hoveredSlot.id !== selected" :d="hoveredSlot.path" class="hover-outline" aria-hidden="true" />
        </svg>
      </div>
    </div>
    <div class="chart-caption" aria-live="polite"><template v-if="current"><i :style="{ background: current.hex ?? '#34383B' }" /><span>{{ current.material.name }}<small>{{ current.vendor }} · {{ current.seriesName || current.base }} · {{ current.hex ?? '—' }}</small></span></template><span v-else>{{ t('Select a swatch or a record below.', '选择色块，或使用下方颜色列表。') }}</span></div>
    <p class="chart-note">{{ t('Source HEX hue · light outward / dark inward · gray grid = empty or filtered positions', '源 HEX 色相 · 外浅内深 · 灰底网格为留空或已筛除的位置') }}<br>{{ t('Neutrals share the rings by brightness. Layout is a visual reference, not physical calibration.', '无彩色按明度分布于环内。排列仅供视觉参考，未经实物校准。') }}</p>
  </div>
</template>

<style scoped>
.wheel-chart { --canvas: #fdfdfc; --ink: #252b2e; --muted: #747b7f; --grid: #eef0f1; --line: #dedfdd; --selected: #38542c; width: 100%; padding: 14px 12px 20px; background: var(--canvas); color: var(--ink); }
.wheel-chart[data-theme='dark'] { --canvas: #202528; --ink: #e2e7e8; --muted: #a6afb4; --grid: #30373b; --line: #454e53; --selected: #d2efb1; }
.chart-toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin: 0 8px 6px; font-size: 11px; }
.canvas-themes, .zoom-controls { display: flex; align-items: center; gap: 3px; }
.zoom-controls { min-width: 0; max-width: 100%; flex-wrap: wrap; }
.chart-toolbar button, .zoom-value { flex-shrink: 0; white-space: nowrap; }
.canvas-themes { padding: 2px; border: 1px solid var(--line); border-radius: 6px; }
.chart-toolbar button { padding: 5px 9px; border-radius: 4px; color: var(--muted); }
.canvas-themes button[aria-pressed='true'] { background: var(--grid); color: var(--ink); }
.chart-toolbar button:hover { color: var(--ink); }
.zoom-controls input { width: 76px; min-width: 32px; flex: 1 1 54px; max-width: 76px; accent-color: #7a8c64; }
.zoom-value { width: 38px; color: var(--muted); text-align: right; font: 10px monospace; }
.chart-viewport { width: 100%; aspect-ratio: 1110 / 1080; max-height: calc(100dvh - 245px); overflow: auto; scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
.chart-sheet { min-width: 100%; min-height: 100%; }
.radial-chart { display: block; width: 100%; height: 100%; }
.wheel-background { fill: var(--grid); pointer-events: none; }
.hue-label, .center-wordmark, .center-subline, .center-count { fill: var(--ink); text-anchor: middle; pointer-events: none; font-family: inherit; }
.hue-label { font-size: 22px; font-weight: 700; }
.hue-translation { fill: var(--muted); font-size: 16px; font-weight: 400; }
.center-wordmark { font-size: 43px; font-weight: 700; letter-spacing: 3px; }
.vendor-wordmark { font-size: 48px; letter-spacing: -1px; }
.center-subline { font-size: 16px; letter-spacing: 4px; fill: var(--muted); }
.center-count { font-size: 14px; fill: var(--muted); }
.wheel-slot { cursor: pointer; stroke: #00000015; stroke-width: .4; }
.wheel-slot:focus-visible { outline: none; stroke: var(--selected); stroke-width: 2.5; }
.selection-outline, .hover-outline { fill: none; stroke: var(--selected); stroke-width: 2.5; pointer-events: none; }
.hover-outline { stroke-width: 1.5; }
.chart-caption { min-height: 50px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 10px 12px 4px; font-size: 12px; text-align: center; overflow-wrap: anywhere; }
.chart-caption i { width: 28px; height: 28px; border: 1px solid var(--line); border-radius: 4px; flex-shrink: 0; }
.chart-caption small { display: block; margin-top: 5px; color: var(--muted); font-size: 10px; }
.chart-note { text-align: center; font-size: 10px; color: var(--muted); line-height: 1.9; padding: 8px 12px 0; }
@media (max-width: 1100px) { .chart-viewport { max-height: none; } }
@media (max-width: 700px) { .chart-toolbar { margin-inline: 0; } .zoom-controls input { width: 54px; } .wheel-chart { padding-inline: 6px; } }
</style>
