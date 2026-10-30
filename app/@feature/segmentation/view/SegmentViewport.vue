<script setup lang="ts">
import { useLocale } from '~/@base/locale';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { Box3, BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, MOUSE, OrthographicCamera, PerspectiveCamera, Scene, ShaderMaterial, SRGBColorSpace, Vector3, WebGLRenderer, WebGLRenderTarget, type Camera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ViewportGizmo } from 'three-viewport-gizmo';
import { createSelectionOutline } from '~/@engine/viewer/selection-outline';
import type { ViewerContent } from '~/@engine/viewer';
import type { SegmentationController } from '../use-segmentation';
import SegmentEditorDialog from './SegmentEditorDialog.vue';
import SegmentResultToolbar from './SegmentResultToolbar.vue';
const { tr } = useLocale();
const props = defineProps<{ seg: SegmentationController; content: ViewerContent | null }>();
const host = useTemplateRef<HTMLDivElement>('host');
const viewerError = ref('');
const planAvailable = computed(() => !!props.seg.displayPlan);
const showingOriginal = computed(() => props.seg.sourceView || !planAvailable.value);
const brushActive = computed(() => props.seg.resultEditing && !props.seg.locked && !showingOriginal.value && props.seg.meshTool === 'brush');
const cursor = ref<{ x: number; y: number } | null>(null);
let cleanup = () => {}, fit = () => {}, updateGeometry = () => {}, updateAppearance = () => {}, updateSelection = () => {}, updateCamera = () => {};
defineExpose({ fit: () => fit() });

onMounted(() => {
  if (!host.value || !props.content) return;
  try {
    const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = SRGBColorSpace; renderer.setClearColor(0x18191e, 0);
    host.value.appendChild(renderer.domElement);
    const scene = new Scene(), mount = new Group(), source = props.content.root.clone(true), idScene = new Scene(), idMount = new Group();
    scene.add(mount); idScene.add(idMount); mount.add(source);
    const sourceMaterials: Array<MeshStandardMaterial | MeshBasicMaterial> = [];
    source.traverse(o => { if (o instanceof Mesh) { const array = Array.isArray(o.material); const cloned = (array ? o.material as MeshStandardMaterial[] : [o.material as MeshStandardMaterial]).map(m => { const c = m.clone(); sourceMaterials.push(c); return c; }); o.material = array ? cloned : cloned[0]!; } });
    const hemi = new HemisphereLight(0xffffff, 0x535869, 2), key = new DirectionalLight(0xffffff, 2.4), fill = new DirectionalLight(0xb6caff, 1.2);
    key.position.set(2, 4, 3); fill.position.set(-3, 2, -3); scene.add(hemi, key, fill);
    const bounds = new Box3().setFromBufferAttribute(new BufferAttribute(props.content.mesh.positions, 3));
    const center = bounds.getCenter(new Vector3()), extent = bounds.getSize(new Vector3()), unit = 1 / Math.max(extent.y, extent.x, extent.z, 0.001);
    mount.scale.setScalar(unit); mount.position.copy(center).multiplyScalar(-unit); idMount.scale.copy(mount.scale); idMount.position.copy(mount.position);
    const perspective = new PerspectiveCamera(35, 1, 0.01, 100), orthographic = new OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
    let camera: Camera = perspective;
    const controls = new OrbitControls(perspective, renderer.domElement); controls.enableDamping = true; controls.minZoom = 0.5; controls.maxZoom = 5; controls.target.set(0, 0, 0);
    const orientationGizmo = new ViewportGizmo(perspective, renderer, { container: host.value, className: 'segment-orientation-gizmo', placement: 'top-right', size: 104, offset: { top: 10, right: 14 } });
    orientationGizmo.attachControls(controls);
    const gizmoElement = host.value.querySelector<HTMLElement>('.segment-orientation-gizmo')!;
    const updateGizmoLabel = () => {
      gizmoElement.title = tr('拖动旋转模型 · 点击 X / Y / Z 切换视角');
      gizmoElement.setAttribute('aria-label', tr('模型视角控制器'));
    };
    updateGizmoLabel();
    watch(() => useLocale().language, updateGizmoLabel);
    let gizmoMoving = false;
    const marker = new MeshStandardMaterial({ vertexColors: true, roughness: 0.72, side: DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const white = new MeshStandardMaterial({ color: '#d9dce3', roughness: 0.65, side: DoubleSide });
    const modelGeometry = new BufferGeometry(); modelGeometry.setAttribute('position', new BufferAttribute(props.content.mesh.positions, 3)); modelGeometry.computeVertexNormals();
    const whiteMesh = new Mesh(modelGeometry, white); mount.add(whiteMesh);
    const idMaterial = new ShaderMaterial({ side: DoubleSide, vertexShader: 'attribute vec3 color; varying vec3 idColor; void main(){idColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'varying vec3 idColor; void main(){gl_FragColor=vec4(idColor,1.0);}' });
    let partMesh: Mesh | null = null, idMesh: Mesh | null = null, renderedPositions = new Float32Array(), faceMap: number[] = [];
    const outline = createSelectionOutline(), idTarget = new WebGLRenderTarget(1, 1);
    let width = 1, height = 1, frame = 0, disposed = false;
    let idPixels = new Uint8Array(), pickWidth = 1, pickHeight = 1;
    let down: { x: number; y: number; pointer: number; tool: 'select' | 'brush' | 'picker'; action: 'add' | 'subtract' } | null = null;
    const painting = new Set<number>(), renderIndex = new Map<number, number>();
    let lastBrushPoint: { x: number; y: number } | null = null;
    const colors = new Map<number, Color>();
    const finishGizmo = () => {
      gizmoMoving = false;
      if (disposed) return;
      controls.update(); updateAppearance();
    };
    orientationGizmo.addEventListener('start', () => {
      cancelStroke(); cursor.value = null;
      // Settle orbit inertia before the gizmo takes ownership of the camera.
      controls.enableDamping = false; controls.update(); controls.enableDamping = true;
      gizmoMoving = true; controls.enabled = false;
    });
    orientationGizmo.addEventListener('end', finishGizmo);
    // The helper emits start but no end when its empty background is clicked.
    // Wait for its pointer-up handler before restoring normal canvas controls.
    const gizmoPointerUp = () => { queueMicrotask(() => { if (gizmoMoving && !orientationGizmo.animating) finishGizmo(); }); };
    document.addEventListener('pointerup', gizmoPointerUp);

    updateGeometry = () => {
      cancelStroke();
      partMesh?.removeFromParent(); partMesh?.geometry.dispose(); idMesh?.removeFromParent(); idMesh?.geometry.dispose();
      const p = props.content!.mesh.positions, plan = props.seg.displayPlan;
      colors.clear(); for (const g of plan?.groups ?? []) colors.set(g.id, new Color(g.color));
      const pieceOfFace = new Int32Array(p.length / 9).fill(-1), offsets: Vector3[] = [];
      for (const piece of props.seg.displayPieces) {
        const midpoint = new Vector3();
        for (const f of piece.faces) { pieceOfFace[f] = piece.id; midpoint.x += p[f * 9]! + p[f * 9 + 3]! + p[f * 9 + 6]!; midpoint.y += p[f * 9 + 1]! + p[f * 9 + 4]! + p[f * 9 + 7]!; midpoint.z += p[f * 9 + 2]! + p[f * 9 + 5]! + p[f * 9 + 8]!; }
        midpoint.divideScalar(piece.faces.length * 3).sub(center);
        if (midpoint.length() < 0.0001) midpoint.set(0, 1, 0);
        offsets[piece.id] = midpoint.normalize().multiplyScalar(props.seg.explosion * 0.38 / unit);
      }
      faceMap = [];
      renderIndex.clear();
      for (let f = 0; f < p.length / 9; f++) {
        const label = plan?.labels[f];
        if (label !== undefined && (props.seg.hidden.includes(label) || (props.seg.solo !== null && label !== props.seg.solo))) continue;
        faceMap.push(f);
      }
      renderedPositions = new Float32Array(faceMap.length * 9);
      const rgb = new Float32Array(renderedPositions.length), ids = new Float32Array(renderedPositions.length);
      faceMap.forEach((face, index) => {
        renderIndex.set(face, index);
        const offset = offsets[pieceOfFace[face]!], c = colors.get(plan?.labels[face] ?? -1) ?? new Color('#d9dce3');
        for (let v = 0; v < 3; v++) {
          const i = index * 9 + v * 3, j = face * 9 + v * 3;
          renderedPositions[i] = p[j]! + (offset?.x ?? 0); renderedPositions[i + 1] = p[j + 1]! + (offset?.y ?? 0); renderedPositions[i + 2] = p[j + 2]! + (offset?.z ?? 0);
          rgb.set([c.r, c.g, c.b], i);
          const id = face + 1; ids.set([(id & 255) / 255, ((id >>> 8) & 255) / 255, ((id >>> 16) & 255) / 255], i);
        }
      });
      const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(renderedPositions, 3)); geometry.setAttribute('color', new BufferAttribute(rgb, 3)); geometry.computeVertexNormals();
      partMesh = new Mesh(geometry, marker); mount.add(partMesh);
      const idGeometry = new BufferGeometry(); idGeometry.setAttribute('position', new BufferAttribute(renderedPositions, 3)); idGeometry.setAttribute('color', new BufferAttribute(ids, 3));
      idMesh = new Mesh(idGeometry, idMaterial); idMount.add(idMesh); updateAppearance(); updateSelection();
    };
    updateSelection = () => {
      const selected = new Set(props.seg.selected); const indices = faceMap.flatMap((face, i) => selected.has(face) ? [i] : []);
      outline.update(renderedPositions, Uint32Array.from(indices));
    };
    updateAppearance = () => {
      source.visible = showingOriginal.value;
      whiteMesh.visible = false;
      if (partMesh) partMesh.visible = !showingOriginal.value;
      marker.opacity = 1;
      marker.depthWrite = marker.opacity === 1;
      controls.enableRotate = true; controls.enabled = !props.seg.editing && !props.seg.busy && !gizmoMoving;
      orientationGizmo.enabled = !props.seg.editing && !props.seg.busy;
      gizmoElement.hidden = props.seg.editing;
      const brushMode = !showingOriginal.value && props.seg.resultEditing && props.seg.meshTool !== 'select';
      controls.mouseButtons.LEFT = brushMode ? null : MOUSE.ROTATE;
      controls.mouseButtons.RIGHT = brushMode ? MOUSE.ROTATE : MOUSE.PAN;
      if (props.seg.locked || showingOriginal.value || props.seg.editing) cancelStroke();
    };
    const resize = () => {
      if (!host.value) return;
      cancelStroke();
      width = Math.max(1, host.value.clientWidth); height = Math.max(1, host.value.clientHeight);
      renderer.setSize(width, height); perspective.aspect = width / height; perspective.updateProjectionMatrix();
      orthographic.left = -0.72 * width / height; orthographic.right = 0.72 * width / height; orthographic.top = 0.72; orthographic.bottom = -0.72; orthographic.updateProjectionMatrix();
      orientationGizmo.update(false);
    };
    fit = () => {
      controls.target.set(0, 0, 0);
      perspective.position.set(1.25, 0.65, 2.4); perspective.lookAt(0, 0, 0);
      controls.update();
    };
    updateCamera = () => { camera = perspective; controls.object = perspective; fit(); updateAppearance(); };
    function pickBuffer() {
      pickWidth = Math.min(1000, Math.round(width)); pickHeight = Math.max(1, Math.round(pickWidth * height / width));
      idTarget.setSize(pickWidth, pickHeight); idPixels = new Uint8Array(pickWidth * pickHeight * 4);
      renderer.setRenderTarget(idTarget); renderer.setClearColor(0x000000, 0); renderer.render(idScene, camera);
      renderer.readRenderTargetPixels(idTarget, 0, 0, pickWidth, pickHeight, idPixels); renderer.setRenderTarget(null); renderer.setClearColor(0x18191e, 0);
    }
    const faceAt = (x: number, y: number) => { if (x < 0 || y < 0 || x >= pickWidth || y >= pickHeight) return -1; const i = (y * pickWidth + x) * 4; return idPixels[i]! + idPixels[i + 1]! * 256 + idPixels[i + 2]! * 65536 - 1; };
    function point(event: PointerEvent) { const rect = renderer.domElement.getBoundingClientRect(); return { x: Math.floor((event.clientX - rect.left) / rect.width * pickWidth), y: Math.floor((rect.bottom - event.clientY) / rect.height * pickHeight) }; }
    function previewFace(face: number, color: Color) {
      const index = renderIndex.get(face), attribute = partMesh?.geometry.getAttribute('color');
      if (index === undefined || !attribute) return;
      for (let v = 0; v < 3; v++) attribute.setXYZ(index * 3 + v, color.r, color.g, color.b);
      attribute.needsUpdate = true;
    }
    function restorePreview() {
      for (const face of painting) { const color = colors.get(props.seg.displayPlan?.labels[face] ?? -1); if (color) previewFace(face, color); }
    }
    function cancelStroke() {
      const pointer = down?.pointer; down = null;
      if (pointer !== undefined && renderer.domElement.hasPointerCapture(pointer)) renderer.domElement.releasePointerCapture(pointer);
      restorePreview(); painting.clear(); lastBrushPoint = null;
    }
    function brush(event: PointerEvent) {
      const pos = point(event), previous = lastBrushPoint ?? pos;
      // Size is a screen-space diameter in CSS pixels. Sample a continuous
      // stroke against one depth-tested ID buffer, never through the model.
      const radius = Math.max(0.5, props.seg.meshRadius / 2 * pickWidth / width);
      const steps = Math.max(1, Math.ceil(Math.hypot(pos.x - previous.x, pos.y - previous.y) / Math.max(1, radius / 2)));
      const color = new Color(props.seg.brushColor);
      for (let step = 1; step <= steps; step++) {
        const cx = previous.x + (pos.x - previous.x) * step / steps, cy = previous.y + (pos.y - previous.y) * step / steps;
        for (let y = Math.max(0, Math.ceil(cy - radius)); y <= Math.min(pickHeight - 1, cy + radius); y++) for (let x = Math.max(0, Math.ceil(cx - radius)); x <= Math.min(pickWidth - 1, cx + radius); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) continue;
          const face = faceAt(x, y);
          if (face >= 0 && !painting.has(face)) { painting.add(face); previewFace(face, color); }
        }
      }
      lastBrushPoint = pos;
    }
    const pointerDown = (event: PointerEvent) => {
      if (gizmoMoving || orientationGizmo.animating || props.seg.locked || showingOriginal.value || !props.seg.resultEditing || event.button !== 0 || down) return;
      down = { x: event.clientX, y: event.clientY, pointer: event.pointerId, tool: props.seg.meshTool, action: event.altKey ? 'subtract' : 'add' };
      if (down.tool !== 'select') {
        // Capture before OrbitControls handles the same event, so painting
        // cannot rotate the camera or leave an unfinished orbit gesture.
        event.stopImmediatePropagation(); event.preventDefault();
        controls.enableDamping = false; controls.update(); controls.enableDamping = true;
        renderer.domElement.setPointerCapture(event.pointerId); pickBuffer();
        painting.clear(); lastBrushPoint = null;
        if (down.tool === 'brush') brush(event);
      }
    };
    const pointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect(); cursor.value = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      if (down?.pointer === event.pointerId && down.tool === 'brush') brush(event);
    };
    const pointerUp = (event: PointerEvent) => {
      if (!down || down.pointer !== event.pointerId) return;
      if (down.tool === 'brush') brush(event);
      const start = down; down = null;
      const faces = [...painting]; restorePreview(); painting.clear(); lastBrushPoint = null;
      if (start.tool !== 'select' && renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      if (start.tool === 'brush') { props.seg.paintFaces(faces); return; }
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
      pickBuffer(); const p = point(event), face = faceAt(p.x, p.y);
      if (start.tool === 'picker') { if (face >= 0) props.seg.pickBrushGroup(face); return; }
      props.seg.pick(face < 0 ? [] : [face], start.action);
    };
    const pointerLeave = () => { cursor.value = null; };
    const keyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelStroke(); };
    const wheel = (event: WheelEvent) => { if (down && down.tool !== 'select') { event.preventDefault(); event.stopImmediatePropagation(); } };
    renderer.domElement.addEventListener('wheel', wheel, { capture: true, passive: false });
    renderer.domElement.addEventListener('pointerdown', pointerDown, true); renderer.domElement.addEventListener('pointermove', pointerMove); renderer.domElement.addEventListener('pointerup', pointerUp); renderer.domElement.addEventListener('pointercancel', cancelStroke); renderer.domElement.addEventListener('lostpointercapture', cancelStroke); renderer.domElement.addEventListener('pointerleave', pointerLeave); window.addEventListener('keydown', keyDown);
    const observer = new ResizeObserver(resize); observer.observe(host.value); resize(); updateGeometry(); updateCamera();
    updateCamera(); updateAppearance();
    const loop = () => { if (disposed) return; if (!props.seg.editing) { if (!gizmoMoving && (!down || down.tool === 'select')) controls.update(); renderer.render(scene, camera); if (!showingOriginal.value) outline.render(renderer, camera, mount, width, height); orientationGizmo.update(false); orientationGizmo.render(); } frame = requestAnimationFrame(loop); }; loop();
    cleanup = () => {
      renderer.domElement.removeEventListener('wheel', wheel, true);
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('pointerup', gizmoPointerUp); orientationGizmo.dispose(); controls.dispose(); outline.dispose(); idTarget.dispose(); idMaterial.dispose(); marker.dispose(); white.dispose(); modelGeometry.dispose(); partMesh?.geometry.dispose(); idMesh?.geometry.dispose(); sourceMaterials.forEach(m => m.dispose());
      renderer.domElement.removeEventListener('pointerdown', pointerDown, true); renderer.domElement.removeEventListener('pointermove', pointerMove); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('pointercancel', cancelStroke); renderer.domElement.removeEventListener('lostpointercapture', cancelStroke); renderer.domElement.removeEventListener('pointerleave', pointerLeave); window.removeEventListener('keydown', keyDown); renderer.dispose(); renderer.domElement.remove();
    };
  } catch (e) { viewerError.value = e instanceof Error ? e.message : String(e); }
});
watch(() => [props.seg.displayPlan, props.seg.explosion, props.seg.hidden.join(','), props.seg.solo, props.seg.editing], () => { if (!props.seg.editing) updateGeometry(); });
watch(() => [props.seg.sourceView, props.seg.editing, props.seg.locked, props.seg.meshTool], () => updateAppearance());
watch(() => props.seg.selected, () => { if (!props.seg.editing) updateSelection(); });
onBeforeUnmount(() => cleanup());
</script>

<template>
  <div class="segment-viewport">
    <div ref="host" class="segment-canvas" :class="{ painting: brushActive, picking: seg.meshTool === 'picker' && !showingOriginal }" />
    <div v-if="brushActive && cursor" class="segment-brush-cursor" :style="{ left: `${cursor.x}px`, top: `${cursor.y}px`, width: `${seg.meshRadius}px`, height: `${seg.meshRadius}px`, borderColor: seg.brushColor }" />
    <SegmentEditorDialog v-if="seg.editing && seg.reference" :seg="seg" />
    <div class="segment-view-heading"><div><span>SEGMENT / {{ tr(seg.stage === 'result' ? '已确认拆分结果' : seg.displayPlan ? '3D 结果预览' : '输入模型') }}</span><p>{{ tr(seg.displayPending ? '保留上次分件方案 · 点击“开始拆分”更新' : seg.plan?.mappingDirty ? '2D 方案待算法映射 · 当前显示原始模型' : seg.displayPlan ? '示例表面网格 · 切口平整化与封闭待算法支持' : '原模型保留 · 输入拆分要求后开始拆分') }}</p></div></div>
    <div class="segment-view-options" role="group" :aria-label="tr('模型显示方式')">
      <button type="button" :disabled="seg.locked" :aria-pressed="showingOriginal" :class="{ active: showingOriginal }" @click="seg.setUi('sourceView', true)">{{ tr("原始模型") }}</button>
      <button type="button" :disabled="seg.locked || !planAvailable" :aria-pressed="!showingOriginal" :class="{ active: !showingOriginal }" :title="tr(seg.plan?.mappingDirty ? '2D 方案待算法映射到 3D' : !planAvailable ? '请先生成分件方案' : seg.displayPending ? '查看上次生成的分件方案' : undefined)" @click="seg.setUi('sourceView', false)">{{ tr("分件方案") }}</button>
    </div>
    <div v-if="viewerError" class="segment-view-error">{{ tr(viewerError) }}</div>
    <div v-if="seg.busy" class="segment-processing" role="status" aria-live="polite"><span class="segment-spinner" /><strong>{{ tr(seg.processingLabel) }}</strong><small>{{ tr(seg.message) }}</small></div>
    <SegmentResultToolbar v-if="seg.plan && !seg.editing" :seg="seg" />
    <div v-else-if="!seg.editing" class="segment-toolbar"><span>{{ tr("◈ 模型拆分") }}</span><i /><span>{{ tr("拖动旋转 · 滚轮缩放") }}</span></div>
  </div>
</template>

<style scoped>
.segment-canvas :deep(.segment-orientation-gizmo){z-index:2;touch-action:none;cursor:grab}.segment-canvas :deep(.segment-orientation-gizmo:active){cursor:grabbing}
.segment-brush-cursor{position:absolute;pointer-events:none;border:1.5px solid;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 1px #0008;box-sizing:border-box}.segment-canvas.picking{cursor:crosshair}
.segment-toolbar{width:max-content;box-sizing:border-box;flex-wrap:wrap;justify-content:center}.explode-controls{display:flex;align-items:center;gap:4px}.explode-controls input:disabled{opacity:.35;cursor:not-allowed}.explode-controls input:focus-visible{outline:2px solid #f2cf61;outline-offset:2px}
.segment-viewport .segment-processing{display:flex;flex-direction:column;align-items:center;gap:10px;min-width:180px;text-align:center}.segment-processing small{max-width:300px;color:#aeb2bf;font-size:11px;line-height:1.6}.segment-spinner{width:25px;height:25px;border:2px solid #e3c45d30;border-top-color:#f7d75a;border-radius:50%;animation:segment-spin .8s linear infinite}@keyframes segment-spin{to{transform:rotate(360deg)}}
.segment-viewport,.segment-canvas{position:absolute;inset:0}.segment-canvas{touch-action:none}.segment-canvas.painting{cursor:crosshair}.segment-canvas :deep(canvas){display:block;width:100%;height:100%}.segment-view-heading{position:absolute;top:20px;left:22px;right:22px;display:flex;justify-content:space-between;gap:15px;pointer-events:none}.segment-view-heading span{font-size:11px;letter-spacing:.7px;color:#bfc2cf}.segment-view-heading p{font-size:10px;color:#777c8a;margin:7px 0}.view-buttons{display:flex;gap:3px;padding:3px;background:#25262dd9;border:1px solid #ffffff12;border-radius:7px;pointer-events:auto;align-self:flex-start}.segment-viewport button,.segment-viewport select{font-size:11px;border:0;border-radius:5px;background:transparent;color:#a7acba;padding:7px 10px;cursor:pointer}.segment-viewport button.active{color:#f0d37a;background:#edd17715}.segment-viewport button:disabled{opacity:.35;cursor:not-allowed}.segment-view-options{position:absolute;top:79px;left:22px;display:flex;gap:8px;align-items:center;background:#25262dbb;border:1px solid #ffffff0d;border-radius:7px;padding:4px}.segment-view-options select,.segment-toolbar select{background:#272931;color:#ccd0dc}.segment-view-options label,.segment-toolbar label{display:flex;align-items:center;gap:7px;font-size:10px;color:#9298a8;padding:0 6px}.segment-viewport input[type=range]{width:65px;accent-color:#f2cd57}.segment-toolbar{position:absolute;bottom:25px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:9px 14px;background:#292b33f5;border:1px solid #ffffff15;box-shadow:0 8px 30px #0004;border-radius:11px;white-space:nowrap;max-width:95%;font-size:10px;color:#b2b8c8}.segment-toolbar>i{height:15px;width:1px;background:#ffffff15}.tool-switch{display:flex;gap:3px}.segment-selection-help{position:absolute;bottom:77px;left:0;right:0;text-align:center;font-size:10px;color:#a2a8b7;pointer-events:none}.segment-processing{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);padding:18px 24px;border-radius:10px;border:1px solid #e3c45d44;background:#23252eee;color:#e5cd89;font-size:12px}.segment-view-error{position:absolute;top:45%;left:20%;right:20%;color:#ecaea4;background:#25252c;padding:20px;font-size:12px}.segment-viewport button:focus-visible{outline:2px solid #f2cf61}
</style>
