<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { AlwaysStencilFunc, BackSide, Box3, BufferAttribute, BufferGeometry, Color, DecrementWrapStencilOp, DoubleSide, FrontSide, Group, IncrementWrapStencilOp, Mesh, MeshBasicMaterial, NotEqualStencilFunc, OrthographicCamera, Plane, PlaneGeometry, ReplaceStencilOp, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { useLocale } from '~/@base/locale';
import type { BaseProcessingController } from '../index';
const props = defineProps<{ tool: BaseProcessingController }>();
const { t } = useLocale(), host = useTemplateRef<HTMLDivElement>('host'), error = ref('');
let cleanup = () => {};
onMounted(() => {
  if (!host.value) return;
  const disposers: Array<() => void> = [];
  cleanup = () => disposers.splice(0).reverse().forEach(dispose => dispose());
  try {
    const renderer = new WebGLRenderer({ alpha: false, antialias: true, stencil: true });
    disposers.push(() => { renderer.dispose(); renderer.domElement.remove(); });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = SRGBColorSpace; renderer.localClippingEnabled = true;
    host.value.appendChild(renderer.domElement);
    const scene = new Scene(); scene.background = new Color('#1d1e22');
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.001, 10000), group = new Group(); scene.add(group);
    const cut = new Plane(), shell = new MeshBasicMaterial({ color: '#606472', side: DoubleSide, clippingPlanes: [cut] });
    // The signed stencil count fills only the cut cross-section, preserving holes.
    const back = new MeshBasicMaterial({ side: BackSide, clippingPlanes: [cut], colorWrite: false, depthWrite: false, depthTest: false, stencilWrite: true, stencilFunc: AlwaysStencilFunc, stencilFail: IncrementWrapStencilOp, stencilZFail: IncrementWrapStencilOp, stencilZPass: IncrementWrapStencilOp });
    const front = new MeshBasicMaterial({ side: FrontSide, clippingPlanes: [cut], colorWrite: false, depthWrite: false, depthTest: false, stencilWrite: true, stencilFunc: AlwaysStencilFunc, stencilFail: DecrementWrapStencilOp, stencilZFail: DecrementWrapStencilOp, stencilZPass: DecrementWrapStencilOp });
    const highlight = new MeshBasicMaterial({ color: '#ffdb57', side: DoubleSide, depthTest: false, stencilWrite: true, stencilRef: 0, stencilFunc: NotEqualStencilFunc, stencilFail: ReplaceStencilOp, stencilZFail: ReplaceStencilOp, stencilZPass: ReplaceStencilOp });
    const actualCap = new MeshBasicMaterial({ color: '#ffdb57', side: DoubleSide });
    const flatGeometry = new PlaneGeometry(1, 1), flat = new Mesh(flatGeometry, highlight); flat.renderOrder = 3; scene.add(flat);
    disposers.push(() => { flatGeometry.dispose(); [shell, back, front, highlight, actualCap].forEach(m => m.dispose()); });
    let geometries: BufferGeometry[] = [], bounds = new Box3(), width = 1, height = 1;
    function clear() { group.clear(); geometries.forEach(g => g.dispose()); geometries = []; }
    disposers.push(clear);
    function refresh() {
      clear(); const tool = props.tool, source = tool.source;
      if (!source) { flat.visible = false; renderer.clear(); return; }
      const result = tool.mode === 'flatten' && tool.view === 'result' ? tool.result : null, mesh = result ?? source;
      const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3));
      geometry.setIndex(new BufferAttribute(result ? result.indices.slice(0, result.surfaceIndexCount) : mesh.indices, 1));
      geometries.push(geometry);
      group.add(new Mesh(geometry, shell));
      if (result) {
        if (result.indices.length > result.surfaceIndexCount) {
          const cap = new BufferGeometry(); cap.setAttribute('position', new BufferAttribute(result.positions, 3)); cap.setIndex(new BufferAttribute(result.indices.slice(result.surfaceIndexCount), 1)); geometries.push(cap);
          const capMesh = new Mesh(cap, actualCap); capMesh.renderOrder = 4; group.add(capMesh);
        }
      } else {
        const backMesh = new Mesh(geometry, back), frontMesh = new Mesh(geometry, front); backMesh.renderOrder = 1; frontMesh.renderOrder = 2; group.add(backMesh, frontMesh);
      }
      bounds = new Box3().setFromBufferAttribute(geometry.getAttribute('position') as BufferAttribute);
      update();
    }
    function update() {
      const { source, plane, scale, view, result, empty } = props.tool;
      if (!source) { renderer.clear(); return; }
      group.scale.setScalar(scale);
      const n = new Vector3(...plane.normal), center = bounds.getCenter(new Vector3()).multiplyScalar(scale), size = bounds.getSize(new Vector3()).multiplyScalar(scale);
      const diagonal = Math.max(size.length(), 0.01), target = center.clone().addScaledVector(n, plane.offset - n.dot(center));
      cut.set(n, -plane.offset);
      camera.up.copy(Math.abs(n.y) > 0.95 ? new Vector3(0, 0, -1) : new Vector3(0, 1, 0));
      camera.position.copy(target).addScaledVector(n, -diagonal * 2); camera.lookAt(target);
      const horizontal = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion), vertical = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const projected = (axis: Vector3) => Math.abs(axis.x) * size.x + Math.abs(axis.y) * size.y + Math.abs(axis.z) * size.z;
      const aspect = width / height, half = Math.max(projected(vertical), projected(horizontal) / aspect, diagonal * 0.03) * 0.59;
      camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
      camera.near = Math.max(0.00001, diagonal / 10000); camera.far = diagonal * 5; camera.updateProjectionMatrix();
      flat.visible = props.tool.mode !== 'add' && view !== 'result' && !empty; flat.position.copy(target); flat.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), n); flat.scale.setScalar(diagonal * 1.5);
      // Applied results use their real cap triangles, preview uses the stencil section.
      if (view === 'result' && !result) flat.visible = !empty;
      renderer.render(scene, camera);
    }
    disposers.push(watch(() => [props.tool.source, props.tool.result, props.tool.view, props.tool.mode], refresh, { immediate: true }));
    disposers.push(watch(() => [props.tool.plane, props.tool.scale], update));
    const resize = new ResizeObserver(() => {
      width = host.value?.clientWidth || 1; height = host.value?.clientHeight || 1; renderer.setSize(width, height); update();
    }); resize.observe(host.value); disposers.push(() => resize.disconnect());
  } catch (e) { cleanup(); error.value = e instanceof Error ? e.message : String(e); }
});
onBeforeUnmount(() => cleanup());
</script>
<template>
  <aside class="base-bottom" :aria-label="t('Live bottom view', '实时底面视图')">
    <header><span>{{ t('Bottom view', '底面视图') }}</span><span class="base-bottom-key"><i />{{ t('Cut surface', '切面') }}</span></header>
    <div ref="host" class="base-bottom-canvas" />
    <p v-if="tool.empty" class="base-bottom-message">{{ t('No retained geometry', '未保留模型') }}</p>
    <p v-if="error" class="base-bottom-message" role="alert">{{ t('Preview unavailable', '底面预览不可用') }}</p>
  </aside>
</template>
<style scoped>
.base-bottom{position:absolute;right:18px;top:72px;width:clamp(150px,25%,210px);background:#202127;border:1px solid #ffffff20;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px #0003;pointer-events:none}.base-bottom header{height:34px;padding:0 12px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#c3c5d0;border-bottom:1px solid #ffffff0d}.base-bottom-key{display:flex;align-items:center;gap:5px;color:#969aa8;font-size:10px}.base-bottom-key i{height:6px;width:6px;border-radius:50%;background:#ffdb57}.base-bottom-canvas{height:160px}.base-bottom-canvas :deep(canvas){display:block;width:100%;height:100%}.base-bottom-message{position:absolute;inset:50% 4px auto;text-align:center;color:#a8adbc;font-size:11px}@media(max-width:1000px){.base-bottom{width:145px;right:12px}.base-bottom-canvas{height:120px}}
</style>
