<script setup lang="ts">
import { useLocale } from '~/@base/locale';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, useTemplateRef, watch } from 'vue';
import type { SegmentationController } from '../use-segmentation';
import { selectionAction, textInput, type ImagePoint } from '../selection';
const { tr } = useLocale();
const props = defineProps<{ seg: SegmentationController }>();
const canvas = useTemplateRef<HTMLCanvasElement>('canvas'), host = useTemplateRef<HTMLDivElement>('host'), palette = useTemplateRef<HTMLDivElement>('palette');
const compare = computed(() => !!props.seg.plan?.mask), zoom = ref(1), loadError = ref('');
const paletteOpen = ref(false), creating = ref(false), partName = ref(''), picking = ref(false), spaceHeld = ref(false);
const visibleIds = computed(() => new Set(props.seg.plan?.groups.filter(g => !props.seg.hidden.includes(g.id) && (props.seg.solo === null || props.seg.solo === g.id)).map(g => g.id)));
let bitmap: HTMLImageElement | null = null, observer: ResizeObserver | undefined, disposed = false, pan = { x: 0, y: 0 };
type Gesture = { kind: 'pan' | 'select' | 'paint'; tool: typeof props.seg.selectTool; original: boolean; pointerId: number; start: ImagePoint; distance: number; previous: ImagePoint; points: ImagePoint[]; pixels: Set<number>; clip: Set<number> | null; action: typeof props.seg.selectAction; color: string };
let gesture: Gesture | null = null, cursor: { x: number; y: number; original: boolean } | null = null;
let width = 1, height = 1, frame = 0;
let layer: HTMLCanvasElement, selectionLayer: HTMLCanvasElement, strokeLayer: HTMLCanvasElement;
const hint = computed(() => picking.value ? '点击任一侧吸取部件归属 · Esc 取消' : props.seg.selectTool === 'brush' ? `仅右侧涂改${props.seg.selectedPixels.length ? ' · 限制在当前选区内' : ''} · 再次点击笔刷退出` : props.seg.selectTool === 'lasso' ? '两侧均可套索选择 · ⌘/Ctrl 加选 · ⌥/Alt 减选 · 再次点击套索退出' : '点击选中整个部件 · ⌘/Ctrl 加选 · ⌥/Alt 减选 · 空格拖动平移');
watch(() => useLocale().language, scheduleDraw);
const icons = {
  undo: 'M9 5 4 10l5 5M4 10h9a6 6 0 0 1 6 6v3',
  redo: 'm15 5 5 5-5 5m5-5h-9a6 6 0 0 0-6 6v3',
  brush: 'm14 4 6 6M10 14l-2-2L17 3a2.1 2.1 0 0 1 3 3l-9 9-1-1ZM8 14c-5-1-3 5-6 6 5 2 9-1 6-6Z',
  lasso: 'M7 17C3 16 2 14 2 10c0-4 4-7 10-7s10 3 10 7-4 7-10 7H7Zm0 0c-4 1-4 5 0 5 3 0 4-3 2-5',
  picker: 'm14 3 7 7m-5-5 3-3 3 3-3 3M15 6 4 17v3h3L18 9',
};
function imageRect(original = false) {
  const aw = compare.value ? width / 2 : width, offset = compare.value && !original ? aw : 0;
  const iw = props.seg.plan?.mask?.width ?? props.seg.reference?.width ?? 600, ih = props.seg.plan?.mask?.height ?? props.seg.reference?.height ?? 600;
  const scale = Math.max(0.001, Math.min((aw - 50) / iw, (height - 40) / ih)) * zoom.value;
  return { x: offset + (aw - iw * scale) / 2 + pan.x, y: (height - ih * scale) / 2 + pan.y, w: iw * scale, h: ih * scale, scale, iw, ih, aw, offset };
}
function visible(id: number) { return visibleIds.value.has(id); }
function scheduleDraw() { if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw(); }); }
function rebuildLayers() {
  const mask = toRaw(props.seg.plan?.mask); if (!mask || !layer || !selectionLayer) return;
  layer.width = selectionLayer.width = mask.width; layer.height = selectionLayer.height = mask.height;
  const ctx = layer.getContext('2d')!, sx = selectionLayer.getContext('2d')!, data = ctx.createImageData(mask.width, mask.height), edge = sx.createImageData(mask.width, mask.height);
  const colors = new Map(props.seg.plan!.groups.map(g => [g.id, [1, 3, 5].map(i => parseInt(g.color.slice(i, i + 2), 16))]));
  const selected = new Uint8Array(mask.labels.length), outline = Math.max(1, Math.round(Math.max(mask.width, mask.height) / 500));
  for (const i of props.seg.selectedPixels) selected[i] = 1;
  for (let i = 0; i < mask.labels.length; i++) {
    const id = mask.labels[i]!, color = colors.get(id);
    if (!color || !visible(id)) continue;
    const pixel = i * 4; data.data[pixel] = color[0]!; data.data[pixel + 1] = color[1]!; data.data[pixel + 2] = color[2]!; data.data[pixel + 3] = 255;
    if (selected[i]) {
      const x = i % mask.width;
      if (x < outline || x >= mask.width - outline || i < mask.width * outline || i >= mask.labels.length - mask.width * outline || !selected[i - outline] || !selected[i + outline] || !selected[i - mask.width * outline] || !selected[i + mask.width * outline]) edge.data.set([255, 250, 218, 255], pixel);
    }
  }
  ctx.putImageData(data, 0, 0); sx.putImageData(edge, 0, 0); scheduleDraw();
}
function draw() {
  const ctx = canvas.value?.getContext('2d'); if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  for (const original of compare.value ? [true, false] : [false]) {
    const r = imageRect(original); ctx.save(); ctx.beginPath(); ctx.rect(r.offset, 0, r.aw, height); ctx.clip();
    ctx.fillStyle = '#1b1d23'; ctx.fillRect(r.x, r.y, r.w, r.h);
    if (bitmap && (original || props.seg.overlay !== 'labels' || !props.seg.plan?.mask)) ctx.drawImage(bitmap, r.x, r.y, r.w, r.h);
    if (props.seg.plan?.mask && layer && selectionLayer) {
      if (!original) {
        ctx.globalAlpha = props.seg.overlay === 'labels' ? 1 : 0.6;
        ctx.drawImage(gesture?.kind === 'paint' ? strokeLayer : layer, r.x, r.y, r.w, r.h);
        ctx.globalAlpha = 1;
      }
      ctx.save(); ctx.shadowColor = '#101218'; ctx.shadowBlur = 3;
      ctx.drawImage(selectionLayer, r.x, r.y, r.w, r.h); ctx.restore();
      if (gesture?.kind === 'select' && gesture.tool === 'lasso') {
        ctx.strokeStyle = '#fff4bd'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath();
        gesture.points.forEach((p, i) => i ? ctx.lineTo(r.x + p.x * r.scale, r.y + p.y * r.scale) : ctx.moveTo(r.x + p.x * r.scale, r.y + p.y * r.scale)); ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
    if (compare.value) { ctx.fillStyle = '#b7bac7'; ctx.font = '11px system-ui'; ctx.fillText(tr(original ? '生成参考图' : '分区方案'), r.offset + 18, 21); }
  }
  if (compare.value) { ctx.fillStyle = '#ffffff15'; ctx.fillRect(width / 2, 0, 1, height); }
  if (cursor && props.seg.selectTool === 'brush' && !picking.value && !spaceHeld.value && !cursor.original && !props.seg.locked) {
    ctx.save(); ctx.beginPath(); ctx.rect(width / 2, 0, width / 2, height); ctx.clip();
    ctx.beginPath(); ctx.arc(cursor.x, cursor.y, props.seg.radius / 2, 0, Math.PI * 2); ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = props.seg.editorTarget?.color ?? '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  }
}
function fit() { zoom.value = 1; pan = { x: 0, y: 0 }; scheduleDraw(); }
function local(event: PointerEvent | WheelEvent) { const bounds = canvas.value!.getBoundingClientRect(); return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }; }
function pointer(event: PointerEvent, original: boolean) { const p = local(event), r = imageRect(original); return { x: (p.x - r.x) / r.scale, y: (p.y - r.y) / r.scale }; }
function seedAt(p: ImagePoint) { const mask = props.seg.plan?.mask; return mask && p.x >= 0 && p.y >= 0 && p.x < mask.width && p.y < mask.height ? Math.floor(p.y) * mask.width + Math.floor(p.x) : -1; }
function dab(p: ImagePoint) {
  const mask = toRaw(props.seg.plan?.mask), g = gesture; if (!mask || !g) return;
  const radius = props.seg.radius / (2 * imageRect().scale), ctx = strokeLayer.getContext('2d')!; ctx.fillStyle = g.color;
  for (let y = Math.max(0, Math.floor(p.y - radius)); y <= Math.min(mask.height - 1, p.y + radius); y++) for (let x = Math.max(0, Math.floor(p.x - radius)); x <= Math.min(mask.width - 1, p.x + radius); x++) {
    const i = y * mask.width + x;
    if ((x - p.x) ** 2 + (y - p.y) ** 2 <= radius ** 2 && visible(mask.labels[i]!) && (!g.clip || g.clip.has(i)) && !g.pixels.has(i)) { g.pixels.add(i); ctx.fillRect(x, y, 1, 1); }
  }
}
function cancelGesture() {
  const g = gesture; gesture = null;
  if (g && canvas.value?.hasPointerCapture(g.pointerId)) canvas.value.releasePointerCapture(g.pointerId);
  scheduleDraw();
}
function down(event: PointerEvent) {
  if (props.seg.locked || gesture || !props.seg.plan?.mask) return;
  const loc = local(event), original = compare.value && loc.x < width / 2;
  const p = pointer(event, original), isPan = event.button !== 0 || spaceHeld.value || props.seg.selectTool === 'pan';
  paletteOpen.value = false;
  if (!isPan && picking.value) {
    const seed = seedAt(p), id = props.seg.plan.mask.labels[seed];
    if (id !== undefined && visible(id)) { props.seg.chooseEditorTarget(id); picking.value = false; }
    return;
  }
  if (!isPan && props.seg.selectTool === 'brush' && original) return;
  event.preventDefault(); canvas.value?.focus({ preventScroll: true });
  gesture = { kind: isPan ? 'pan' : props.seg.selectTool === 'brush' ? 'paint' : 'select', tool: props.seg.selectTool, original, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, distance: 0, previous: p, points: [p], pixels: new Set(), clip: props.seg.selectedPixels.length ? new Set(props.seg.selectedPixels) : null, action: selectionAction(event, props.seg.selectAction), color: props.seg.editorTarget?.color ?? '#83b8ff' };
  canvas.value!.setPointerCapture(event.pointerId);
  if (gesture.kind === 'paint') { strokeLayer.width = props.seg.plan.mask.width; strokeLayer.height = props.seg.plan.mask.height; strokeLayer.getContext('2d')!.drawImage(layer, 0, 0); dab(p); }
  scheduleDraw();
}
function move(event: PointerEvent) {
  const loc = local(event); cursor = { ...loc, original: compare.value && loc.x < width / 2 };
  const g = gesture; if (!g) { scheduleDraw(); return; }
  if (g.kind === 'pan') { pan.x += event.clientX - g.start.x; pan.y += event.clientY - g.start.y; g.start = { x: event.clientX, y: event.clientY }; scheduleDraw(); return; }
  const p = pointer(event, g.original);
  g.distance = Math.max(g.distance, Math.hypot(event.clientX - g.start.x, event.clientY - g.start.y));
  if (g.kind === 'paint') {
    // A captured stroke must never keep painting when the pointer crosses
    // into the reference image or leaves the right viewport.
    if (loc.x < width / 2 || loc.x >= width || loc.y < 0 || loc.y >= height) { g.previous = p; return; }
    const r = imageRect(), previousScreen = r.x + g.previous.x * r.scale;
    if (previousScreen < width / 2 || previousScreen >= width) g.previous = p;
    const spacing = Math.max(0.5, props.seg.radius / r.scale / 5), steps = Math.max(1, Math.ceil(Math.hypot(p.x - g.previous.x, p.y - g.previous.y) / spacing));
    for (let s = 1; s <= steps; s++) dab({ x: g.previous.x + (p.x - g.previous.x) * s / steps, y: g.previous.y + (p.y - g.previous.y) * s / steps });
  } else if (g.tool === 'lasso') g.points.push(p);
  g.previous = p; scheduleDraw();
}
function up(event: PointerEvent) {
  const g = gesture, mask = toRaw(props.seg.plan?.mask); if (!g || !mask) return;
  if (props.seg.locked) { cancelGesture(); return; }
  move(event);
  if (g.kind === 'paint') props.seg.paintPixels([...g.pixels]);
  else if (g.kind === 'select') {
    const p = pointer(event, g.original), moved = g.distance;
    if (g.tool === 'lasso' && moved >= 5 && g.points.length > 2) {
      const scratch = document.createElement('canvas'); scratch.width = mask.width; scratch.height = mask.height;
      const ctx = scratch.getContext('2d')!; ctx.beginPath(); g.points.forEach((v, i) => i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)); ctx.closePath(); ctx.fill();
      const data = ctx.getImageData(0, 0, mask.width, mask.height).data;
      for (let i = 0; i < mask.labels.length; i++) if (data[i * 4 + 3]! > 127 && visible(mask.labels[i]!)) g.pixels.add(i);
      props.seg.pickPixels([...g.pixels], g.action);
    } else if (moved < 5) { const seed = seedAt(p); props.seg.pickRegion(seed >= 0 && visible(mask.labels[seed]!) ? seed : -1, g.action); }
  }
  cancelGesture();
}
function wheel(event: WheelEvent) {
  event.preventDefault(); if (gesture) return;
  const loc = local(event), original = compare.value && loc.x < width / 2, before = imageRect(original);
  const anchor = { x: (loc.x - before.x) / before.scale, y: (loc.y - before.y) / before.scale };
  zoom.value = Math.max(0.6, Math.min(5, zoom.value * Math.exp(-event.deltaY * 0.001)));
  const after = imageRect(original); pan.x += loc.x - after.x - anchor.x * after.scale; pan.y += loc.y - after.y - anchor.y * after.scale; scheduleDraw();
}
function consumeEscape() {
  if (gesture) { cancelGesture(); return true; }
  if (paletteOpen.value || picking.value) { paletteOpen.value = false; picking.value = false; return true; }
  if (props.seg.selectedPixels.length) { props.seg.pickPixels([], 'replace'); return true; }
  if (props.seg.selectTool !== 'region') { chooseTool(props.seg.selectTool); return true; }
  return false;
}
function key(event: KeyboardEvent) {
  if (event.defaultPrevented || textInput(event.target)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (props.seg.locked) return; cancelGesture(); if (event.shiftKey) props.seg.redo(); else props.seg.undo(); }
  if (event.code === 'Space') { event.preventDefault(); spaceHeld.value = true; scheduleDraw(); }
}
function keyup(event: KeyboardEvent) { if (event.code === 'Space') { spaceHeld.value = false; scheduleDraw(); } }
function blur() { spaceHeld.value = false; cancelGesture(); }
function outside(event: PointerEvent) { if (paletteOpen.value && !palette.value?.contains(event.target as Node)) paletteOpen.value = false; }
function chooseTool(tool: typeof props.seg.selectTool) {
  cancelGesture(); paletteOpen.value = false;
  const next = props.seg.selectTool === tool && !picking.value ? 'region' : tool;
  picking.value = false; props.seg.setUi('selectTool', next);
  if (next === 'region') props.seg.setUi('selectAction', 'replace');
}
function setRadius(event: Event) {
  const input = event.target as HTMLInputElement, value = input.valueAsNumber;
  if (Number.isFinite(value)) props.seg.setUi('radius', Math.max(1, Math.min(100, Math.round(value))));
  input.value = String(props.seg.radius);
}
function chooseTarget(id: number) { props.seg.chooseEditorTarget(id); paletteOpen.value = false; }
async function openNewPart() { paletteOpen.value = true; creating.value = true; partName.value = ''; await nextTick(); palette.value?.querySelector('input')?.focus(); }
function createPart() { if (!partName.value.trim()) return; props.seg.prepareEditorPart(partName.value); paletteOpen.value = false; creating.value = false; }
watch(() => [props.seg.plan, props.seg.selectedPixels, props.seg.selectedGroups.join(','), props.seg.hidden.join(','), props.seg.solo], () => { cancelGesture(); rebuildLayers(); });
watch(() => [props.seg.overlay, props.seg.radius, props.seg.editorTarget?.color], scheduleDraw);
watch(() => props.seg.locked, locked => { if (locked) cancelGesture(); });
onMounted(async () => {
  layer = document.createElement('canvas'); selectionLayer = document.createElement('canvas'); strokeLayer = document.createElement('canvas');
  observer = new ResizeObserver(() => { if (!canvas.value || !host.value) return; width = host.value.clientWidth; height = host.value.clientHeight; const ratio = Math.min(devicePixelRatio, 2); canvas.value.width = width * ratio; canvas.value.height = height * ratio; canvas.value.getContext('2d')!.setTransform(ratio, 0, 0, ratio, 0, 0); scheduleDraw(); });
  observer.observe(host.value!); window.addEventListener('keydown', key); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); window.addEventListener('pointerdown', outside);
  try { if (props.seg.reference) { const img = new Image(); img.src = props.seg.reference.url; await img.decode(); if (disposed) return; bitmap = img; } rebuildLayers(); } catch { if (!disposed) loadError.value = '参考图加载失败，请刷新后重试。'; }
});
onBeforeUnmount(() => { disposed = true; observer?.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('keydown', key); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); window.removeEventListener('pointerdown', outside); });
defineExpose({ fit, consumeEscape, openNewPart });
</script>

<template>
  <div class="reference-editor">
    <div class="reference-controls"><span class="control-spacer" /><div class="view-mode-switch" role="group" :aria-label="tr('分区显示模式')"><button type="button" :aria-pressed="seg.overlay === 'overlay'" :class="{ active: seg.overlay === 'overlay' }" @click="seg.setUi('overlay', 'overlay')">{{ tr("叠加") }}</button><button type="button" :aria-pressed="seg.overlay === 'labels'" :class="{ active: seg.overlay === 'labels' }" @click="seg.setUi('overlay', 'labels')">{{ tr("仅分区") }}</button></div></div>
    <div ref="host" class="image-stage"><canvas ref="canvas" tabindex="0" :class="{ selecting: !spaceHeld && seg.selectTool !== 'pan', painting: seg.selectTool === 'brush' && !spaceHeld && !picking }" :aria-label="tr('生成参考图分区编辑画布')" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="cancelGesture" @lostpointercapture="cancelGesture" @pointerleave="cursor = null; scheduleDraw()" @contextmenu.prevent @wheel="wheel" /><span v-if="loadError" class="image-error">{{ tr(loadError) }}</span></div>
    <p class="reference-hint">{{ tr(hint) }}</p>
    <div class="reference-bottom" role="toolbar" :aria-label="tr('2D 分区编辑工具')">
      <button class="icon-button" :disabled="seg.locked || !seg.canUndo" type="button" :title="tr('撤销 ⌘/Ctrl Z')" :aria-label="tr('撤销区域编辑')" @click="seg.undo"><svg viewBox="0 0 24 24"><path :d="icons.undo" /></svg></button>
      <button class="icon-button" :disabled="seg.locked || !seg.canRedo" type="button" :title="tr('重做 ⌘/Ctrl Shift Z')" :aria-label="tr('重做区域编辑')" @click="seg.redo"><svg viewBox="0 0 24 24"><path :d="icons.redo" /></svg></button>
      <i class="tool-divider" />
      <button v-for="(label, tool) in { lasso: '套索', brush: '笔刷' }" :key="tool" class="icon-button" type="button" :disabled="seg.locked" :aria-label="tr(label)" :aria-pressed="seg.selectTool === tool && !picking" :class="{ active: seg.selectTool === tool && !picking }" :title="tr(`${label} · 再次点击恢复默认点选`)" @click="chooseTool(tool)"><svg viewBox="0 0 24 24"><path :d="icons[tool]" /></svg></button>
      <i class="tool-divider" />
      <button class="icon-button add-part" type="button" :disabled="seg.locked" :class="{ active: !!seg.editorNewPart }" :aria-label="tr('新建部件')" :title="tr('新建部件，首次分配或涂抹后创建')" @click="openNewPart">＋</button>
      <button class="icon-button" type="button" :aria-label="tr('吸取部件颜色')" :title="tr('从任一侧吸取部件归属')" :disabled="seg.locked" :aria-pressed="picking" :class="{ active: picking }" @click="picking = !picking; paletteOpen = false"><svg viewBox="0 0 24 24"><path :d="icons.picker" /></svg></button>
      <div ref="palette" class="palette-anchor">
        <button class="target-swatch" type="button" :disabled="seg.locked" :aria-expanded="paletteOpen" :aria-label="tr('当前部件色板')" :title="tr(seg.editorTarget?.name)" @click="paletteOpen = !paletteOpen; creating = false"><i :style="{ background: seg.editorTarget?.color }" /><small>⌄</small></button>
        <div v-if="paletteOpen" class="part-palette" :aria-label="tr('目标部件色板')">
          <div class="palette-heading">{{ tr("分配到部件") }} <small>{{ tr("颜色代表部件归属") }}</small></div>
          <div class="palette-options"><button v-for="group in seg.plan?.groups" :key="group.id" type="button" :aria-pressed="!seg.editorNewPart && seg.targetGroup === group.id" @click="chooseTarget(group.id)"><i :style="{ background: group.color }" /><span>{{ tr(group.name) }}</span><span v-if="!seg.editorNewPart && seg.targetGroup === group.id">✓</span></button></div>
          <button class="new-part-button" type="button" @click="openNewPart">{{ tr("＋ 新建部件") }}</button>
          <form v-if="creating" class="new-part-form" @submit.prevent="createPart"><input v-model="partName" :aria-label="tr('新部件名称')" :placeholder="tr('输入部件名称')" maxlength="60"><button type="submit" :disabled="!partName.trim()">{{ tr("使用") }}</button><small>{{ tr("首次分配或涂抹后创建") }}</small></form>
        </div>
      </div>
      <template v-if="!picking && (seg.selectTool === 'brush' || seg.selectTool === 'lasso')">
        <i class="tool-divider" />
        <template v-if="seg.selectTool === 'brush'"><label class="brush-size">Size<input :value="seg.radius" :disabled="seg.locked" :aria-label="tr('笔刷大小')" type="range" min="1" max="100" @input="setRadius"></label><input class="size-number" :value="seg.radius" :disabled="seg.locked" :aria-label="tr('笔刷大小数值')" type="number" min="1" max="100" @change="setRadius"></template>
        <select v-else :value="seg.selectAction" :disabled="seg.locked" :aria-label="tr('选区操作')" @change="seg.setUi('selectAction', ($event.target as HTMLSelectElement).value as typeof seg.selectAction)"><option value="replace">{{ tr("新选区") }}</option><option value="add">{{ tr("加选") }}</option><option value="subtract">{{ tr("减选") }}</option></select>
      </template>
      <template v-if="seg.selectedPixels.length"><span class="selection-count">{{ tr("已选") }} {{ tr(seg.selectedPixels.length.toLocaleString()) }} {{ tr("像素") }}</span><button class="assign-button" type="button" :disabled="seg.locked" @click="seg.assign()">{{ tr("分配") }}</button><button type="button" :disabled="seg.locked" :title="tr('清除选区 Esc')" :aria-label="tr('清除选区')" @click="seg.pickPixels([], 'replace')">×</button></template>
    </div>
  </div>
</template>

<style scoped>
.reference-editor{position:absolute;inset:0;background:#18191e}.reference-controls{height:44px;display:flex;align-items:center;gap:6px;padding:0 22px}.view-mode-switch{display:flex;background:#24262e;border-radius:6px;padding:3px}.reference-editor button,.reference-editor select{font-size:11px;color:#aaafbf;padding:7px 9px;border:0;border-radius:5px;background:transparent;cursor:pointer}.reference-editor button.active{background:#f1cd6020;color:#efcf7c}.reference-editor button:disabled{opacity:.35;cursor:not-allowed}.reference-editor button:focus-visible,.reference-editor select:focus-visible{outline:2px solid #f1cf72}.control-spacer{flex:1}.image-stage{position:absolute;inset:50px 10px 130px;min-height:120px;overflow:hidden}.image-stage canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab;outline:none}.image-stage canvas.selecting{cursor:crosshair}.image-stage canvas.painting{cursor:crosshair}
.reference-bottom{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;gap:8px;max-width:94%;width:max-content;padding:9px 12px;background:#292a30f5;border:1px solid #ffffff15;border-radius:18px;box-shadow:0 8px 24px #0004;flex-wrap:wrap;z-index:1}.reference-bottom select{background:#1c1e25;color:#c2c7d1}.tool-divider{width:1px;height:20px;background:#ffffff15;margin:0 3px}.reference-hint{position:absolute;bottom:94px;left:10px;right:10px;text-align:center;font-size:10px;color:#9198a7;pointer-events:none}.image-error{position:absolute;top:40%;left:30%;color:#e6b09d}.brush-size{display:flex;gap:12px;align-items:center;font-size:12px;color:#c3c3ce}.brush-size input{width:120px;accent-color:#a18aff}.size-number{box-sizing:border-box;width:48px;padding:7px 4px;border:1px solid #ffffff14;border-radius:7px;background:#17181c;color:#e4e3ec;text-align:center;font:inherit;font-size:12px;appearance:textfield}.size-number::-webkit-inner-spin-button{appearance:none}.selection-count{font-size:10px;color:#b8beca;margin:0 2px}.reference-bottom .assign-button{background:#f7d75a;color:#201d11;font-weight:600}.reference-bottom .target-swatch{display:flex;gap:8px;align-items:center;padding:4px 6px}.target-swatch i{display:block;width:30px;height:30px;border-radius:50%;box-shadow:inset 0 0 0 1px #ffffff30;flex:none}.target-swatch small{color:#9b9ca9}.part-palette i{display:block;width:17px;height:17px;border-radius:50%;flex:none;border:1px solid #ffffff25}.palette-anchor{position:relative}.part-palette{position:absolute;bottom:calc(100% + 14px);left:50%;transform:translateX(-50%);width:230px;max-height:360px;overflow:auto;padding:12px;background:#292b34;border:1px solid #ffffff20;border-radius:10px;box-shadow:0 8px 32px #0009}.palette-heading{font-size:12px;color:#e4e6ef;margin-bottom:10px}.palette-heading small{display:block;font-size:10px;color:#9a9fae;margin-top:4px}.palette-options{display:flex;flex-direction:column;gap:3px}.palette-options button{display:flex;align-items:center;gap:9px;text-align:left}.palette-options button>span:first-of-type{flex:1}.palette-options button[aria-pressed=true]{background:#f1cd6015;color:#efcf7c}.palette-options button:hover{background:#ffffff0a}.reference-editor .new-part-button{width:100%;border-top:1px solid #ffffff12;border-radius:0;text-align:left;margin-top:8px;padding-top:11px;color:#d7dbe5}.new-part-form{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.new-part-form input{min-width:0;flex:1;width:100px;font:inherit;font-size:11px;color:#eee;background:#191a20;border:1px solid #ffffff20;border-radius:5px;padding:7px}.new-part-form button{background:#f7d75a;color:#201d11}.new-part-form small{flex-basis:100%;font-size:10px;color:#9a9fae}
.reference-bottom .icon-button{display:inline-flex;align-items:center;justify-content:center;width:34px;height:36px;padding:7px;flex:none;border-radius:8px;color:#dedee7}.reference-bottom .icon-button.active{background:#9b7bff22;color:#c6afff}.reference-bottom .icon-button:not(:disabled):hover{background:#ffffff10}.reference-bottom .add-part{font-size:24px;font-weight:300}.reference-bottom svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.reference-bottom :focus-visible{outline:2px solid #c0a4ff;outline-offset:2px}
</style>
