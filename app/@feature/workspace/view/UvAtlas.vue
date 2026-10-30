<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useLocale } from '~/@base/locale';
import type { RefinementResult } from '~/@engine/multicolor';
const { tr } = useLocale();
const props = defineProps<{ data: RefinementResult; selection: Uint32Array; colors: string[]; busy: boolean }>();
const emit = defineEmits<{ select: [face: number | null, additive: boolean] }>();
const { t } = useLocale();
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const expanded = ref(false); const atlas = ref(0); const zoom = ref(1);
const pan = { x: 0, y: 0 }; let width = 220; let height = 220;
let resize: ResizeObserver | undefined;
let frame = 0;
let selectionMask: HTMLCanvasElement | undefined;
let selectionBorder: HTMLCanvasElement | undefined;
const atlases = computed(() => [...new Set(props.data.faceAtlas)].filter(id => id >= 0).sort((a, b) => a - b));
const faces = computed(() => Array.from(props.data.faceAtlas, (id, face) => id === atlas.value ? face : -1).filter(f => f >= 0));
const bounds = computed(() => {
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
  for (const f of faces.value) for (let c = 0; c < 3; c++) {
    const u = props.data.uvs[f * 6 + c * 2]!, v = props.data.uvs[f * 6 + c * 2 + 1]!;
    minU = Math.min(minU, u); minV = Math.min(minV, v); maxU = Math.max(maxU, u); maxV = Math.max(maxV, v);
  }
  return faces.value.length ? { minU, minV, maxU, maxV } : { minU: 0, minV: 0, maxU: 1, maxV: 1 };
});
function transform() {
  const b = bounds.value;
  const scale = Math.min((width - 24) / Math.max(0.01, b.maxU - b.minU), (height - 24) / Math.max(0.01, b.maxV - b.minV)) * zoom.value;
  return { scale, x: width / 2 + pan.x - (b.maxU + b.minU) / 2 * scale, y: height / 2 + pan.y + (b.maxV + b.minV) / 2 * scale };
}
function fit() { zoom.value = 1; pan.x = 0; pan.y = 0; schedule(); }
function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); }
function draw() {
  const el = canvas.value, ctx = el?.getContext('2d'); if (!el || !ctx) return;
  const rect = el.getBoundingClientRect(); width = rect.width; height = rect.height;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  el.width = Math.round(width * ratio); el.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
  const { scale, x, y } = transform(); const selected = new Set(props.selection);
  for (const face of faces.value) {
    ctx.beginPath();
    for (let c = 0; c < 3; c++) {
      const px = props.data.uvs[face * 6 + c * 2]! * scale + x, py = y - props.data.uvs[face * 6 + c * 2 + 1]! * scale;
      if (c === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fillStyle = props.colors[props.data.labels[face]!] ?? '#b0b3ba'; ctx.fill();
    ctx.lineWidth = 0.4; ctx.strokeStyle = '#12131588'; ctx.stroke();
  }
  // Keep selected islands in their assigned colors, even when UVs overlap.
  selectionMask ??= document.createElement('canvas'); selectionBorder ??= document.createElement('canvas');
  selectionMask.width = selectionBorder.width = el.width; selectionMask.height = selectionBorder.height = el.height;
  const mask = selectionMask.getContext('2d')!, border = selectionBorder.getContext('2d')!;
  mask.setTransform(ratio, 0, 0, ratio, 0, 0); mask.fillStyle = mask.strokeStyle = '#fff'; mask.lineWidth = 0.6;
  for (const face of faces.value) if (selected.has(face)) {
    ctx.beginPath(); mask.beginPath();
    for (let c = 0; c < 3; c++) {
      const px = props.data.uvs[face * 6 + c * 2]! * scale + x, py = y - props.data.uvs[face * 6 + c * 2 + 1]! * scale;
      if (!c) { ctx.moveTo(px, py); mask.moveTo(px, py); }
      else { ctx.lineTo(px, py); mask.lineTo(px, py); }
    }
    ctx.closePath(); ctx.fillStyle = props.colors[props.data.labels[face]!] ?? '#b0b3ba'; ctx.fill();
    ctx.lineWidth = 0.4; ctx.strokeStyle = '#12131588'; ctx.stroke();
    mask.closePath(); mask.fill(); mask.stroke();
  }
  // Trace the visible union, so adaptive triangles and closed islands have no internal highlight lines.
  for (const [radius, color] of [[2.6, '#15161a'], [1.4, '#ffda57']] as const) {
    border.globalCompositeOperation = 'source-over'; border.clearRect(0, 0, el.width, el.height);
    for (let i = 0; i < 8; i++) border.drawImage(selectionMask, Math.cos(i * Math.PI / 4) * radius * ratio, Math.sin(i * Math.PI / 4) * radius * ratio);
    border.globalCompositeOperation = 'destination-out'; border.drawImage(selectionMask, 0, 0);
    border.globalCompositeOperation = 'source-in'; border.fillStyle = color; border.fillRect(0, 0, el.width, el.height);
    ctx.drawImage(selectionBorder, 0, 0, width, height);
  }
}
let down: { x: number; y: number; lastX: number; lastY: number; moved: boolean; pan: boolean } | null = null;
function pointerDown(event: PointerEvent) {
  if (![0, 1, 2].includes(event.button)) return;
  down = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false, pan: event.button !== 0 || event.altKey };
  canvas.value?.setPointerCapture(event.pointerId);
}
function pointerMove(event: PointerEvent) {
  if (!down) return;
  if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) down.moved = true;
  if (down.moved || down.pan) { pan.x += event.clientX - down.lastX; pan.y += event.clientY - down.lastY; schedule(); }
  down.lastX = event.clientX; down.lastY = event.clientY;
}
let lastHit = ''; let overlapIndex = 0;
function pointerUp(event: PointerEvent) {
  const click = down && !down.moved && !down.pan && event.type !== 'pointercancel'; down = null;
  if (!click || props.busy || !canvas.value) return;
  const rect = canvas.value.getBoundingClientRect(); const tr = transform();
  const u = (event.clientX - rect.left - tr.x) / tr.scale, v = (tr.y - event.clientY + rect.top) / tr.scale;
  const hit = new Map<number, number>();
  for (const f of faces.value) {
    const o = f * 6, uv = props.data.uvs;
    const ax = uv[o]!, ay = uv[o + 1]!, bx = uv[o + 2]!, by = uv[o + 3]!, cx = uv[o + 4]!, cy = uv[o + 5]!;
    const det = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (Math.abs(det) < 1e-12) continue;
    const b = ((u - ax) * (cy - ay) - (v - ay) * (cx - ax)) / det, c = ((bx - ax) * (v - ay) - (by - ay) * (u - ax)) / det;
    if (b >= -1e-6 && c >= -1e-6 && b + c <= 1 + 1e-6) hit.set(props.data.faceIsland[f]!, f);
  }
  const candidates = [...hit.values()]; const key = [...hit.keys()].join(',');
  overlapIndex = key === lastHit ? (overlapIndex + 1) % Math.max(1, candidates.length) : 0; lastHit = key;
  emit('select', candidates[overlapIndex] ?? null, event.shiftKey);
}
function wheel(event: WheelEvent) {
  const previous = zoom.value; zoom.value = Math.min(16, Math.max(0.5, previous * Math.exp(-event.deltaY * 0.002)));
  const rect = canvas.value!.getBoundingClientRect(); const factor = zoom.value / previous;
  pan.x = (pan.x - (event.clientX - rect.left - width / 2)) * factor + event.clientX - rect.left - width / 2;
  pan.y = (pan.y - (event.clientY - rect.top - height / 2)) * factor + event.clientY - rect.top - height / 2;
  schedule();
}
watch(() => props.data, schedule);
watch(() => props.colors, schedule, { deep: true });
watch(atlas, fit);
watch(() => props.selection, selection => {
  const first = selection[0];
  if (first !== undefined && props.data.faceAtlas[first]! >= 0) atlas.value = props.data.faceAtlas[first]!;
  if (first !== undefined) {
    const b = bounds.value; let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const f of selection) if (props.data.faceAtlas[f] === atlas.value) for (let c = 0; c < 3; c++) {
      const u = props.data.uvs[f * 6 + c * 2]!, v = props.data.uvs[f * 6 + c * 2 + 1]!;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    if (Number.isFinite(minU)) {
      const tr = transform();
      if (minU * tr.scale + tr.x < 0 || maxU * tr.scale + tr.x > width || tr.y - maxV * tr.scale < 0 || tr.y - minV * tr.scale > height) {
        zoom.value = Math.min(zoom.value, 1); const scale = transform().scale;
        pan.x = ((b.maxU + b.minU) / 2 - (minU + maxU) / 2) * scale;
        pan.y = ((minV + maxV) / 2 - (b.maxV + b.minV) / 2) * scale;
      }
    }
  }
  schedule();
});
onMounted(() => { atlas.value = atlases.value[0] ?? 0; resize = new ResizeObserver(schedule); if (canvas.value) resize.observe(canvas.value); schedule(); });
onBeforeUnmount(() => { resize?.disconnect(); cancelAnimationFrame(frame); });
</script>
<template>
  <div class="uv-atlas" :class="{ expanded }" @keydown.esc.stop="expanded = false">
    <div class="uv-atlas-heading"><strong>{{ t('UV islands', 'UV 展开图') }}</strong><button type="button" @click="expanded = !expanded">{{ tr(expanded ? t('Close', '收起') : t('Expand', '放大')) }}</button></div>
    <select v-if="atlases.length > 1" v-model.number="atlas" :aria-label="t('UV atlas', 'UV 图集')"><option v-for="(id, index) in atlases" :key="id" :value="id">{{ t('Atlas', '图集') }} {{ tr(index + 1) }}</option></select>
    <canvas ref="canvas" tabindex="0" :aria-label="t('Select UV islands; drag to pan, scroll to zoom', '点击选择 UV 岛；拖动平移，滚轮缩放')" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp" @wheel.prevent="wheel" @contextmenu.prevent />
    <div class="uv-atlas-footer"><span>{{ tr(Math.round(zoom * 100)) }}%</span><button type="button" @click="fit">{{ t('Fit', '适配') }}</button></div>
    <p class="print-help">{{ t('Shift-click to multi-select. Click stacked islands again to cycle, or select on the model.', 'Shift 多选；重叠岛可重复点击切换，也可直接在模型上选。') }}</p>
  </div>
</template>
