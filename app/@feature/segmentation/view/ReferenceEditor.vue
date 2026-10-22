<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRaw, useTemplateRef, watch } from 'vue';
import type { SegmentationController } from '../use-segmentation';
const props = defineProps<{ seg: SegmentationController }>();
const canvas = useTemplateRef<HTMLCanvasElement>('canvas'), host = useTemplateRef<HTMLDivElement>('host');
const compare = computed(() => !!props.seg.plan?.mask), zoom = ref(1), loadError = ref('');
let bitmap: HTMLImageElement | null = null, observer: ResizeObserver | undefined, pan = { x: 0, y: 0 };
let gesture: { kind: 'pan' | 'select'; start: { x: number; y: number }; previous: { x: number; y: number }; points: Array<{ x: number; y: number }>; pixels: Set<number>; action: 'replace' | 'add' | 'subtract' } | null = null;
let width = 1, height = 1;
let layer: HTMLCanvasElement; let selectionLayer: HTMLCanvasElement;
function imageRect(original = false) {
  const aw = compare.value ? width / 2 : width, offset = compare.value && !original ? aw : 0;
  const iw = props.seg.plan?.mask?.width ?? props.seg.reference?.width ?? 600, ih = props.seg.plan?.mask?.height ?? props.seg.reference?.height ?? 600;
  const scale = Math.max(0.001, Math.min((aw - 50) / iw, (height - 40) / ih)) * zoom.value;
  return { x: offset + (aw - iw * scale) / 2 + pan.x, y: (height - ih * scale) / 2 + pan.y, w: iw * scale, h: ih * scale, scale, iw, ih, aw, offset };
}
function rebuildLayers() {
  const mask = toRaw(props.seg.plan?.mask); if (!mask) return;
  if (!layer || !selectionLayer) return;
  layer.width = selectionLayer.width = mask.width; layer.height = selectionLayer.height = mask.height;
  const ctx = layer.getContext('2d')!, sx = selectionLayer.getContext('2d')!, data = ctx.createImageData(mask.width, mask.height), edge = sx.createImageData(mask.width, mask.height);
  const colors = new Map(props.seg.plan!.groups.map(g => [g.id, [1, 3, 5].map(i => parseInt(g.color.slice(i, i + 2), 16))]));
  const selected = new Uint8Array(mask.labels.length), outline = Math.max(1, Math.round(Math.max(mask.width, mask.height) / 400));
  if (props.seg.editing) { for (const i of props.seg.selectedPixels) selected[i] = 1; }
  else { for (let i = 0; i < mask.labels.length; i++) if (props.seg.selectedGroups.includes(mask.labels[i]!)) selected[i] = 1; }
  const hidden = new Set(props.seg.hidden), solo = props.seg.solo;
  for (let i = 0; i < mask.labels.length; i++) {
    const id = mask.labels[i]!, color = colors.get(id);
    if (id < 0 || !color || hidden.has(id) || (solo !== null && id !== solo)) continue;
    const pixel = i * 4; data.data[pixel] = color[0]!; data.data[pixel + 1] = color[1]!; data.data[pixel + 2] = color[2]!; data.data[pixel + 3] = 255;
    if (selected[i]) {
      const x = i % mask.width;
      if (x < outline || x >= mask.width - outline || i < mask.width * outline || i >= mask.labels.length - mask.width * outline || !selected[i - outline] || !selected[i + outline] || !selected[i - mask.width * outline] || !selected[i + mask.width * outline]) edge.data.set([255, 250, 218, 255], pixel);
    }
  }
  ctx.putImageData(data, 0, 0); sx.putImageData(edge, 0, 0); draw();
}
function draw() {
  const el = canvas.value, ctx = el?.getContext('2d'); if (!el || !ctx) return;
  ctx.clearRect(0, 0, width, height);
  for (const original of compare.value ? [true, false] : [false]) {
    const r = imageRect(original); ctx.save(); ctx.beginPath(); ctx.rect(r.offset, 0, r.aw, height); ctx.clip();
    ctx.fillStyle = '#1b1d23'; ctx.fillRect(r.x, r.y, r.w, r.h);
    if (bitmap && (original || props.seg.overlay !== 'labels' || !props.seg.plan?.mask)) ctx.drawImage(bitmap, r.x, r.y, r.w, r.h);
    if (props.seg.plan?.mask && layer && selectionLayer) {
      if (!original) {
        ctx.globalAlpha = props.seg.overlay === 'labels' ? 1 : 0.6;
        ctx.drawImage(layer, r.x, r.y, r.w, r.h); ctx.globalAlpha = 1;
      }
      // Draw the same pixel boundary on both views; a dark halo keeps the
      // light outline visible against pale areas of the original image.
      ctx.save(); ctx.shadowColor = '#101218'; ctx.shadowBlur = 3;
      ctx.drawImage(selectionLayer, r.x, r.y, r.w, r.h);
      ctx.restore();
      if (!original && gesture?.kind === 'select' && props.seg.selectTool === 'lasso') { ctx.strokeStyle = '#fff4bd'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); gesture.points.forEach((p, i) => i ? ctx.lineTo(r.x + p.x * r.scale, r.y + p.y * r.scale) : ctx.moveTo(r.x + p.x * r.scale, r.y + p.y * r.scale)); ctx.stroke(); }
    }
    ctx.restore();
    if (compare.value) { ctx.fillStyle = '#b7bac7'; ctx.font = '11px system-ui'; ctx.fillText(original ? '生成参考图' : '分区方案', r.offset + 18, 21); }
  }
  if (compare.value) { ctx.fillStyle = '#ffffff15'; ctx.fillRect(width / 2, 0, 1, height); }
}
function fit() { zoom.value = 1; pan = { x: 0, y: 0 }; draw(); }
function pointer(event: PointerEvent) {
  const bounds = canvas.value!.getBoundingClientRect(), r = imageRect();
  return { x: (event.clientX - bounds.left - r.x) / r.scale, y: (event.clientY - bounds.top - r.y) / r.scale };
}
function dab(p: { x: number; y: number }) {
  const mask = props.seg.plan?.mask; if (!mask || !gesture) return;
  const radius = props.seg.radius / imageRect().scale;
  for (let y = Math.max(0, Math.floor(p.y - radius)); y <= Math.min(mask.height - 1, p.y + radius); y++) for (let x = Math.max(0, Math.floor(p.x - radius)); x <= Math.min(mask.width - 1, p.x + radius); x++) if ((x - p.x) ** 2 + (y - p.y) ** 2 <= radius ** 2 && mask.labels[y * mask.width + x]! >= 0) gesture.pixels.add(y * mask.width + x);
}
function down(event: PointerEvent) {
  if (props.seg.locked) return;
  const p = pointer(event), isPan = event.button !== 0 || (props.seg.editing && props.seg.selectTool === 'pan');
  const bounds = canvas.value!.getBoundingClientRect(); if (compare.value && event.clientX - bounds.left < width / 2 && !isPan) return;
  gesture = { kind: isPan ? 'pan' : 'select', start: { x: event.clientX, y: event.clientY }, previous: p, points: [p], pixels: new Set(), action: event.altKey ? 'subtract' : event.metaKey || event.ctrlKey || event.shiftKey ? 'add' : props.seg.selectAction };
  canvas.value!.setPointerCapture(event.pointerId);
  if (!isPan && props.seg.editing && props.seg.selectTool === 'brush') dab(p);
}
function move(event: PointerEvent) {
  if (!gesture) return;
  if (gesture.kind === 'pan') { pan.x += event.clientX - gesture.start.x; pan.y += event.clientY - gesture.start.y; gesture.start = { x: event.clientX, y: event.clientY }; draw(); return; }
  if (!props.seg.editing) return;
  const p = pointer(event);
  if (props.seg.selectTool === 'brush') {
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - gesture.previous.x, p.y - gesture.previous.y) / 2));
    for (let s = 0; s <= steps; s++) dab({ x: gesture.previous.x + (p.x - gesture.previous.x) * s / steps, y: gesture.previous.y + (p.y - gesture.previous.y) * s / steps });
  }
  if (props.seg.selectTool === 'lasso') gesture.points.push(p);
  gesture.previous = p; draw();
}
function up(event: PointerEvent) {
  const g = gesture, mask = props.seg.plan?.mask; if (!g) return;
  if (g.kind === 'select' && mask) {
    const p = pointer(event), moved = Math.hypot(event.clientX - g.start.x, event.clientY - g.start.y);
    if (props.seg.editing && props.seg.selectTool === 'lasso' && g.points.length > 2) {
      const scratch = document.createElement('canvas'); scratch.width = mask.width; scratch.height = mask.height;
      const ctx = scratch.getContext('2d')!; ctx.beginPath(); g.points.forEach((v, i) => i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)); ctx.closePath(); ctx.fill();
      const data = ctx.getImageData(0, 0, mask.width, mask.height).data;
      for (let i = 0; i < mask.labels.length; i++) if (data[i * 4 + 3]! > 127 && mask.labels[i]! >= 0) g.pixels.add(i);
      props.seg.pickPixels([...g.pixels], g.action);
    } else if (props.seg.editing && props.seg.selectTool === 'brush') props.seg.pickPixels([...g.pixels], g.action);
    else if (moved < 5) {
      const seed = p.x >= 0 && p.y >= 0 && p.x < mask.width && p.y < mask.height ? Math.floor(p.y) * mask.width + Math.floor(p.x) : -1;
      props.seg.pickRegion(seed, g.action);
    }
  }
  gesture = null; draw();
}
function wheel(event: WheelEvent) { event.preventDefault(); zoom.value = Math.max(0.6, Math.min(5, zoom.value * Math.exp(-event.deltaY * 0.001))); draw(); }
function key(event: KeyboardEvent) { if (event.key === 'Escape' && (gesture || props.seg.selectedPixels.length) && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) { event.preventDefault(); gesture = null; props.seg.pickPixels([], 'replace'); draw(); } }
watch(() => [props.seg.plan, props.seg.selectedPixels, props.seg.selectedGroups.join(','), props.seg.hidden.join(','), props.seg.solo, props.seg.editing], rebuildLayers);
watch(() => props.seg.overlay, draw);
watch(() => [compare.value, props.seg.editing], () => { gesture = null; fit(); });
onMounted(async () => {
  layer = document.createElement('canvas'); selectionLayer = document.createElement('canvas');
  observer = new ResizeObserver(() => { if (!canvas.value || !host.value) return; width = host.value.clientWidth; height = host.value.clientHeight; const ratio = Math.min(devicePixelRatio, 2); canvas.value.width = width * ratio; canvas.value.height = height * ratio; const context = canvas.value.getContext('2d')!; context.setTransform(ratio, 0, 0, ratio, 0, 0); draw(); });
  observer.observe(host.value!); window.addEventListener('keydown', key);
  try { if (props.seg.reference) { bitmap = new Image(); bitmap.src = props.seg.reference.url; await bitmap.decode(); } rebuildLayers(); draw(); } catch { loadError.value = '参考图加载失败，请刷新后重试。'; }
});
onBeforeUnmount(() => { observer?.disconnect(); window.removeEventListener('keydown', key); });
defineExpose({ fit });
</script>

<template>
  <div class="reference-editor">
    <div v-if="compare" class="reference-controls">
      <span class="control-spacer" /><div class="view-mode-switch" role="group" aria-label="分区显示模式"><button type="button" :aria-pressed="seg.overlay === 'overlay'" :class="{ active: seg.overlay === 'overlay' }" @click="seg.setUi('overlay', 'overlay')">叠加</button><button type="button" :aria-pressed="seg.overlay === 'labels'" :class="{ active: seg.overlay === 'labels' }" @click="seg.setUi('overlay', 'labels')">仅分区</button></div>
    </div>
    <div ref="host" class="image-stage"><canvas ref="canvas" :class="{ selecting: seg.editing && seg.selectTool !== 'pan' }" aria-label="生成参考图分区编辑画布" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="gesture = null; draw()" @contextmenu.prevent @wheel="wheel" /><span v-if="loadError" class="image-error">{{ loadError }}</span></div>
    <div class="reference-bottom">
        <div class="tool-buttons"><button v-for="(label, tool) in { region: '部件选择', lasso: '套索', brush: '画笔', pan: '平移' }" :key="tool" type="button" :disabled="seg.locked" :class="{ active: seg.selectTool === tool }" @click="seg.setUi('selectTool', tool)">{{ label }}</button></div>
        <select :value="seg.selectAction" aria-label="选区操作" @change="seg.setUi('selectAction', ($event.target as HTMLSelectElement).value as typeof seg.selectAction)"><option value="replace">新选区</option><option value="add">加选</option><option value="subtract">减选</option></select>
        <label v-if="seg.selectTool === 'brush'">大小<input :value="seg.radius" type="range" min="3" max="60" @input="seg.setUi('radius', Number(($event.target as HTMLInputElement).value))"></label>
        <button :disabled="!seg.history.length" type="button" title="撤销 ⌘Z" aria-label="撤销区域编辑" @click="seg.undo">↶</button><button :disabled="!seg.future.length" type="button" title="重做 ⌘⇧Z" aria-label="重做区域编辑" @click="seg.redo">↷</button>
    </div>
    <p class="reference-hint">已选 {{ seg.selectedPixels.length.toLocaleString() }} 像素 · 在左侧分配到部件</p>
  </div>
</template>

<style scoped>
.reference-editor label{display:flex;gap:6px;align-items:center;font-size:10px;color:#999fae}.reference-editor input[type=range]{width:65px;accent-color:#f4ce5c}
.reference-editor{position:absolute;inset:0;background:#18191e}.reference-controls{height:44px;display:flex;align-items:center;gap:6px;padding:0 22px}.view-mode-switch{display:flex;background:#24262e;border-radius:6px;padding:3px}.reference-editor button,.reference-editor select{font-size:11px;color:#aaafbf;padding:7px 9px;border:0;border-radius:5px;background:transparent;cursor:pointer}.reference-editor button.active{background:#f1cd6020;color:#efcf7c}.reference-editor button:disabled{opacity:.35;cursor:not-allowed}.reference-editor button:focus-visible{outline:2px solid #f1cf72}.control-spacer{flex:1}.image-stage{position:absolute;inset:50px 10px 120px;min-height:120px;overflow:hidden}.image-stage canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab}.image-stage canvas.selecting{cursor:crosshair}.reference-bottom{position:absolute;bottom:25px;left:50%;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;gap:6px;max-width:94%;width:max-content;padding:8px 12px;background:#292b34;border:1px solid #ffffff12;border-radius:10px;box-shadow:0 6px 24px #0004;flex-wrap:wrap}.tool-buttons{display:flex;gap:2px}.reference-bottom select{background:#1c1e25;color:#c2c7d1}.reference-bottom>span{font-size:10px;color:#a5aaba;padding:5px 8px}.reference-hint{position:absolute;bottom:80px;left:10px;right:10px;text-align:center;font-size:10px;color:#9198a7;pointer-events:none}.image-error{position:absolute;top:40%;left:30%;color:#e6b09d}
</style>
