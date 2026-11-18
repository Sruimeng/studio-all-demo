<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { AlwaysStencilFunc, BackSide, Box3, BufferAttribute, BufferGeometry, CanvasTexture, Color, DecrementWrapStencilOp, DirectionalLight, DoubleSide, FrontSide, GridHelper, Group, HemisphereLight, IncrementWrapStencilOp, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, NotEqualStencilFunc, PerspectiveCamera, Plane, PlaneGeometry, ReplaceStencilOp, Scene, SRGBColorSpace, Texture, Vector3, WebGLRenderer, type Material } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ViewportGizmo } from 'three-viewport-gizmo';
import { useLocale } from '~/@base/locale';
import type { MeshData } from '~/@engine/base-processing';
import type { BaseAppearance, BaseProcessingController } from '../index';
import { createPlaneRotationControls } from '../plane-rotation-controls';
import BasePlaneGizmo from './BasePlaneGizmo.vue';
const props = defineProps<{ tool: BaseProcessingController }>();
const tool = props.tool;
const { t } = useLocale();
const host = useTemplateRef<HTMLDivElement>('host'), error = ref('');
const gizmoPosition = ref({ left: '0px', top: '0px', visibility: 'hidden' as 'visible' | 'hidden' });
let cleanup = () => {}, fit = () => {};
onMounted(() => {
  if (!host.value) return;
  const disposers: Array<() => void> = [];
  cleanup = () => { for (const dispose of disposers.splice(0).reverse()) dispose(); };
  try {
    const renderer = new WebGLRenderer({ alpha: true, antialias: true, stencil: true });
    disposers.push(() => { renderer.dispose(); renderer.domElement.remove(); });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(0x17181c, 0); renderer.localClippingEnabled = true; host.value.appendChild(renderer.domElement);
    const scene = new Scene(), camera = new PerspectiveCamera(35, 1, 0.01, 100000);
    const controls = new OrbitControls(camera, renderer.domElement);
    disposers.push(() => controls.dispose());
    controls.enableDamping = true;
    const hemi = new HemisphereLight(0xffffff, 0x44485c, 2.2), key = new DirectionalLight(0xffffff, 2.7), fill = new DirectionalLight(0xd4ddff, 1.4);
    const underside = new DirectionalLight(0xffedc8, 1.8);
    scene.add(hemi, key, fill, underside);
    const gizmo = new ViewportGizmo(camera, renderer, { container: host.value, placement: 'bottom-right', size: 88, offset: { bottom: 74, right: 14 } });
    disposers.push(() => gizmo.dispose());
    gizmo.attachControls(controls);
    const keepPlane = new Plane(), removePlane = new Plane();
    let sourceMaterials: MeshStandardMaterial[] = [], sourceTextures: Texture[] = [], sourceGeneration = 0;
    const solid = new MeshStandardMaterial({ color: '#d9dce5', roughness: 0.7, side: DoubleSide });
    const red = new MeshBasicMaterial({ color: '#e87d80', transparent: true, opacity: 0.2, side: DoubleSide, depthWrite: false, clippingPlanes: [removePlane] });
    const capMaterial = new MeshBasicMaterial({ color: '#ffdb57', side: DoubleSide, toneMapped: false });
    // Count the retained shell crossings to fill only the cut cross-section,
    // preserving holes. Depth testing keeps the highlight behind the model.
    const sectionBack = new MeshBasicMaterial({ side: BackSide, clippingPlanes: [keepPlane], colorWrite: false, depthWrite: false, depthTest: false, stencilWrite: true, stencilFunc: AlwaysStencilFunc, stencilFail: IncrementWrapStencilOp, stencilZFail: IncrementWrapStencilOp, stencilZPass: IncrementWrapStencilOp });
    const sectionFront = new MeshBasicMaterial({ side: FrontSide, clippingPlanes: [keepPlane], colorWrite: false, depthWrite: false, depthTest: false, stencilWrite: true, stencilFunc: AlwaysStencilFunc, stencilFail: DecrementWrapStencilOp, stencilZFail: DecrementWrapStencilOp, stencilZPass: DecrementWrapStencilOp });
    const sectionMaterial = new MeshBasicMaterial({ color: '#ffdb57', side: DoubleSide, toneMapped: false, stencilWrite: true, stencilRef: 0, stencilFunc: NotEqualStencilFunc, stencilFail: ReplaceStencilOp, stencilZFail: ReplaceStencilOp, stencilZPass: ReplaceStencilOp, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const planeMaterial = new MeshBasicMaterial({ color: '#c5b5ff', transparent: true, opacity: 0.16, side: DoubleSide, depthWrite: false });
    // PlaneGeometry faces +Z by default. Rotate the shared geometry once so its
    // local normal is +Y; the same quaternion can then drive both the cut
    // plane and TransformControls without a hidden 90° gizmo offset.
    const planeGeometry = new PlaneGeometry(1, 1, 12, 12); planeGeometry.rotateX(-Math.PI / 2);
    const planeMesh = new Mesh(planeGeometry, planeMaterial);
    const section = new Mesh(planeGeometry, sectionMaterial), sectionGroup = new Group();
    section.renderOrder = 3; section.onAfterRender = () => renderer.clearStencil();
    scene.add(section, sectionGroup);
    const planeGrid = new Mesh(planeGeometry, new MeshBasicMaterial({ color: '#c5b5ff', transparent: true, opacity: 0.25, wireframe: true, depthWrite: false }));
    function clearSourceAppearance() {
      sourceMaterials.forEach(material => material.dispose()); sourceMaterials = [];
      sourceTextures.forEach(disposeTexture); sourceTextures = [];
    }
    function disposeTexture(texture: Texture) { texture.dispose(); (texture.image as ImageBitmap).close(); }
    disposers.push(() => { sourceGeneration++; clearSourceAppearance(); planeGeometry.dispose(); [solid, red, capMaterial, sectionBack, sectionFront, sectionMaterial, planeMaterial, planeGrid.material].forEach(m => m.dispose()); });
    planeMesh.add(planeGrid); scene.add(planeMesh);
    const sourceGroup = new Group(), resultGroup = new Group(), baseGroup = new Group(); scene.add(sourceGroup, resultGroup, baseGroup);
    const rotationControls = createPlaneRotationControls(camera, scene, renderer.domElement, planeMesh, baseGroup, tool, dragging => { controls.enabled = !dragging; });
    disposers.push(() => rotationControls.dispose());
    // A soft plastic/ceramic response gives the base a broad, continuous
    // highlight instead of the small hard hotspot from the previous standard
    // material. Keep metalness at zero so user-selected colors stay stable.
    const baseMaterial = new MeshPhysicalMaterial({ color: tool.baseColor, roughness: 0.46, metalness: 0, clearcoat: 0.16, clearcoatRoughness: 0.34, sheen: 0.08, sheenRoughness: 0.5, specularIntensity: 0.42, side: DoubleSide });
    let sourceGeometry: BufferGeometry | null = null, original: Mesh | null = null, removed: Mesh | null = null, floor: GridHelper | null = null, baseGeometry: BufferGeometry | null = null;
    let baseAssetView: Group | null = null;
    const baseOriginalMaterials = new Map<Mesh, Material | Material[]>();
    let center = new Vector3(), diagonal = 100, frame = 0, previousScale = tool.scale;
    disposers.push(() => {
      cancelAnimationFrame(frame); sourceGeometry?.dispose(); baseGeometry?.dispose(); clearResult();
      if (floor) { floor.geometry.dispose(); (Array.isArray(floor.material) ? floor.material : [floor.material]).forEach(m => m.dispose()); }
      baseMaterial.dispose();
    });
    function geometry(mesh: MeshData, indices = mesh.indices, appearance?: BaseAppearance | null) {
      const geo = new BufferGeometry(); geo.setAttribute('position', new BufferAttribute(mesh.positions, 3)); geo.setIndex(new BufferAttribute(indices, 1));
      if (appearance?.uvs && appearance.uvs.length === mesh.positions.length / 3 * 2) geo.setAttribute('uv', new BufferAttribute(appearance.uvs, 2));
      if (appearance?.colors && appearance.colors.length === mesh.positions.length) {
        geo.setAttribute('color', new BufferAttribute(appearance.colors, 3));
      }
      if (appearance?.faceMat && appearance.faceMat.length >= indices.length / 3) {
        geo.clearGroups(); let start = 0, material = appearance.faceMat[0] ?? 0;
        for (let face = 1; face <= indices.length / 3; face++) {
          const next = face < indices.length / 3 ? appearance.faceMat[face] ?? material : -1;
          if (next !== material) { geo.addGroup(start * 3, (face - start) * 3, material); start = face; material = next; }
        }
      }
      geo.computeVertexNormals(); return geo;
    }
    function clearResult() { for (const object of [...resultGroup.children]) { if (object instanceof Mesh) object.geometry.dispose(); resultGroup.remove(object); } }
    // Asset geometries/textures are owned by the controller cache. Cloned
    // objects can change material without mutating or disposing those resources.
    function clearBase() { baseGroup.clear(); baseGeometry?.dispose(); baseGeometry = null; baseAssetView = null; baseOriginalMaterials.clear(); }
    function refreshBase() {
      clearBase();
      if (!tool.source) return;
      if (tool.baseIsAsset) {
        if (!tool.baseAsset) return;
        baseAssetView = new Group();
        const clone = tool.baseAsset.root.clone(true);
        clone.traverse(object => { if (object instanceof Mesh) { baseOriginalMaterials.set(object, object.material); object.renderOrder = 2; } });
        baseAssetView.add(clone); baseGroup.add(baseAssetView);
      } else {
        const mesh = tool.baseMesh; if (!mesh) return;
        baseGeometry = geometry(mesh); const base = new Mesh(baseGeometry, baseMaterial); base.renderOrder = 2; baseGroup.add(base);
      }
      updateBase();
    }
    function updateBase() {
      tool.baseTransform.decompose(baseGroup.position, baseGroup.quaternion, baseGroup.scale);
      baseAssetView?.scale.set(tool.baseWidth, tool.baseHeight, tool.baseDepth);
      for (const [mesh, material] of baseOriginalMaterials) mesh.material = tool.baseAssetOriginal ? material : baseMaterial;
      baseMaterial.color.set(tool.baseColor);
      if (floor && tool.source) {
        const modelBottom = 0; // Sources are normalized to their lowest Y.
        floor.position.y = (tool.mode === 'add' ? Math.min(modelBottom, tool.baseBottom) : modelBottom) - diagonal * 0.005;
      }
    }
    function appearance() {
      const { plane, view, result } = tool;
      const n = new Vector3(...plane.normal); keepPlane.set(n, -plane.offset); removePlane.copy(keepPlane).negate();
      // Keep the source mesh as the textured surface in both preview and
      // result views.  The cut worker currently returns topology only; using
      // the source triangles with the same clipping plane preserves UV seams
      // and material groups while the result group supplies the real cap.
      const clipping = tool.mode !== 'add' && (view === 'preview' || (view === 'result' && !!result));
      if (!!solid.clippingPlanes?.length !== clipping) { solid.clippingPlanes = clipping ? [keepPlane] : []; solid.needsUpdate = true; }
      for (const material of sourceMaterials) {
        const next = clipping ? [keepPlane] : [];
        if ((material.clippingPlanes?.length ?? 0) !== next.length || material.clippingPlanes?.[0] !== next[0]) {
          material.clippingPlanes = next; material.needsUpdate = true;
        }
      }
      const adding = tool.mode === 'add';
      if (original) original.visible = !!tool.source && (adding || view !== 'result' || !!result);
      if (removed) removed.visible = !adding && view === 'preview';
      resultGroup.visible = !adding && view === 'result' && !!result;
      baseGroup.visible = adding && !!tool.source;
      planeMesh.visible = !adding && view === 'preview' && !!tool.source;
      planeMesh.position.fromArray(tool.planeCenter);
      planeMesh.quaternion.fromArray(tool.rotation); planeMesh.scale.setScalar(diagonal * 0.95);
      section.visible = sectionGroup.visible = planeMesh.visible && !tool.empty;
      section.position.copy(planeMesh.position); section.quaternion.copy(planeMesh.quaternion); section.scale.setScalar(diagonal * 1.5);
      sectionGroup.scale.setScalar(tool.scale);
      updateBase();
    }
    fit = () => {
      const target = center.clone(); let distance = diagonal;
      if (tool.mode === 'add' && sourceGeometry && baseGroup.children.length) {
        const modelBounds = new Box3().setFromBufferAttribute(sourceGeometry.getAttribute('position') as BufferAttribute);
        modelBounds.min.multiplyScalar(tool.scale); modelBounds.max.multiplyScalar(tool.scale);
        const baseBounds = new Box3().setFromObject(baseGroup);
        modelBounds.union(baseBounds); modelBounds.getCenter(target); distance = Math.max(modelBounds.getSize(new Vector3()).length(), 1);
      }
      controls.target.copy(target); camera.up.set(0, 1, 0);
      camera.far = Math.max(diagonal * 100, distance * 100); camera.updateProjectionMatrix(); controls.maxDistance = Math.max(diagonal, distance) * 10;
      camera.position.copy(target).add(new Vector3(1.2, 0.6, 2).normalize().multiplyScalar(distance * 1.7)); controls.update();
    };
    async function sourceChanged() {
      const generation = ++sourceGeneration;
      sourceGroup.clear(); sectionGroup.clear(); clearBase(); sourceGeometry?.dispose(); sourceGeometry = null; original = removed = null; clearSourceAppearance();
      clearResult();
      if (floor) { scene.remove(floor); floor.geometry.dispose(); (Array.isArray(floor.material) ? floor.material : [floor.material]).forEach(m => m.dispose()); floor = null; }
      const source = tool.source; if (!source) { appearance(); return; }
      sourceGeometry = geometry(source, source.indices, source.appearance);
      sourceGroup.scale.setScalar(tool.scale); resultGroup.scale.setScalar(tool.scale); previousScale = tool.scale;
      original = new Mesh(sourceGeometry, solid); removed = new Mesh(sourceGeometry, red); removed.renderOrder = 1;
      const sourceMesh = original;
      sourceGroup.add(original, removed);
      refreshBase();
      const backMesh = new Mesh(sourceGeometry, sectionBack), frontMesh = new Mesh(sourceGeometry, sectionFront);
      backMesh.renderOrder = 1; frontMesh.renderOrder = 2; sectionGroup.add(backMesh, frontMesh);
      const bounds = new Box3().setFromBufferAttribute(sourceGeometry.getAttribute('position') as BufferAttribute);
      bounds.min.multiplyScalar(tool.scale); bounds.max.multiplyScalar(tool.scale);
      center = bounds.getCenter(new Vector3()); diagonal = Math.max(bounds.getSize(new Vector3()).length(), 1);
      camera.near = Math.max(0.001, diagonal / 10000); camera.far = diagonal * 100; camera.updateProjectionMatrix();
      controls.minDistance = diagonal * 0.1; controls.maxDistance = diagonal * 10;
      key.position.copy(center).add(new Vector3(1, 2, 3).multiplyScalar(diagonal)); fill.position.copy(center).add(new Vector3(-2, 1, -2).multiplyScalar(diagonal));
      underside.position.copy(center).add(new Vector3(0, -2, 1).multiplyScalar(diagonal));
      floor = new GridHelper(diagonal * 1.8, 20, 0x444652, 0x2a2c35); floor.position.y = bounds.min.y - diagonal * 0.005; scene.add(floor);
      fit(); appearance();
      if (source.appearance) {
        const loaded = await createSourceMaterials(source.appearance);
        if (generation !== sourceGeneration) {
          loaded.materials.forEach(material => material.dispose()); loaded.textures.forEach(disposeTexture); return;
        }
        sourceMaterials = loaded.materials; sourceTextures = loaded.textures;
        sourceMesh.material = sourceMaterials.length ? sourceMaterials : solid;
        appearance();
      }
    }
    function resultChanged() {
      clearResult(); const result = tool.result;
      if (result) {
        // The retained surface stays in `sourceGroup` so the original UVs,
        // vertex colours and material groups remain intact after processing.
        // Only the generated cap needs a result mesh here; it is intentionally
        // rendered with the yellow cap material.
        if (result.surfaceIndexCount < result.indices.length) resultGroup.add(new Mesh(geometry(result, result.indices.slice(result.surfaceIndexCount)), capMaterial));
      }
      resultGroup.scale.setScalar(tool.scale); appearance();
    }
    function scaleChanged() {
      const factor = tool.scale / previousScale; previousScale = tool.scale;
      sourceGroup.scale.setScalar(tool.scale); resultGroup.scale.setScalar(tool.scale);
      center.multiplyScalar(factor); diagonal *= factor; camera.position.multiplyScalar(factor); controls.target.multiplyScalar(factor);
      camera.near *= factor; camera.far *= factor; camera.updateProjectionMatrix(); controls.minDistance *= factor; controls.maxDistance *= factor;
      key.position.multiplyScalar(factor); fill.position.multiplyScalar(factor); underside.position.multiplyScalar(factor);
      if (floor) { floor.scale.multiplyScalar(factor); floor.position.multiplyScalar(factor); }
      controls.update(); appearance();
    }
    disposers.push(watch(() => tool.scale, scaleChanged));
    async function createSourceMaterials(appearance: BaseAppearance) {
      const created: Texture[] = [];
      const textures = await Promise.all(appearance.images.map(async blob => {
        if (!blob) return null;
        try {
          const bitmap = await createImageBitmap(blob);
          const texture = new CanvasTexture(bitmap); texture.colorSpace = SRGBColorSpace; texture.flipY = false; texture.needsUpdate = true; created.push(texture); return texture;
        } catch { return null; }
      }));
      const materials = appearance.materials.map(material => {
        const color = appearance.colors ? new Color(1, 1, 1) : new Color(...material.factor);
        const output = new MeshStandardMaterial({ color, map: material.image >= 0 ? textures[material.image] ?? undefined : undefined, vertexColors: !!appearance.colors, roughness: 0.7, side: DoubleSide });
        return output;
      });
      return { materials, textures: created };
    }
    disposers.push(watch(() => tool.source, sourceChanged, { immediate: true }));
    disposers.push(watch(() => tool.result, resultChanged, { immediate: true }));
    disposers.push(watch(() => [tool.baseShape, tool.baseAsset], refreshBase));
    disposers.push(watch(() => [tool.baseWidth, tool.baseDepth, tool.baseHeight], () => { if (tool.baseIsAsset) updateBase(); else refreshBase(); }));
    disposers.push(watch(() => [tool.baseTransform, tool.baseColor, tool.baseAssetOriginal], updateBase));
    disposers.push(watch(() => [tool.plane, tool.planeCenter, tool.rotation, tool.view, tool.mode], appearance));
    const resize = new ResizeObserver(() => {
      const w = host.value?.clientWidth ?? 0, h = host.value?.clientHeight ?? 0; if (!w || !h) return;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); gizmo.update();
    }); resize.observe(host.value);
    disposers.push(() => resize.disconnect());
    const screenPivot = new Vector3();
    function positionGizmo() {
      if (!tool.rotating || !host.value) return;
      const w = host.value.clientWidth, h = host.value.clientHeight;
      screenPivot.fromArray(tool.planeCenter).project(camera);
      const x = (screenPivot.x + 1) * w / 2, y = (1 - screenPivot.y) * h / 2;
      // The transform ring has a screen-relative radius. Keep its controls beside
      // the ring and inside the canvas, including after pan/zoom or a resize.
      const radius = h * 0.18, cardWidth = Math.min(218, w - 24);
      const desiredX = x + radius + 16;
      const left = Math.round(Math.max(12, Math.min(w - cardWidth - 12, desiredX + cardWidth < w - 12 ? desiredX : x - radius - cardWidth - 16)));
      const top = Math.round(Math.max(106, Math.min(h - 140, y - 58)));
      const visibility = screenPivot.z > -1 && screenPivot.z < 1 ? 'visible' : 'hidden';
      if (gizmoPosition.value.left !== left + 'px' || gizmoPosition.value.top !== top + 'px' || gizmoPosition.value.visibility !== visibility) gizmoPosition.value = { left: left + 'px', top: top + 'px', visibility };
    }
    function render() {
      frame = requestAnimationFrame(render); if (!tool.dragging) controls.update();
      positionGizmo();
      // Do not draw the ground grid in front of the model when inspecting its underside.
      if (floor) floor.visible = camera.position.y >= floor.position.y;
      renderer.render(scene, camera); gizmo.render();
    }
    render();
  } catch (e) { cleanup(); error.value = e instanceof Error ? e.message : String(e); }
});
onBeforeUnmount(() => cleanup());
</script>
<template>
  <div class="base-view">
    <div ref="host" class="base-canvas" />
    <div class="base-view-top">
      <div v-if="tool.mode === 'flatten'" class="base-view-tabs" role="group" :aria-label="t('Base processing view', '底面处理视图')">
        <button :class="{ active: tool.view === 'preview' }" @click="tool.view = 'preview'">{{ t('Cut preview', '切割预览') }}</button>
        <button :class="{ active: tool.view === 'result' }" :disabled="!tool.result" @click="tool.view = 'result'">{{ t('Result', '处理结果') }}</button>
      </div>
      <button class="base-fit" :disabled="!tool.source" @click="fit">{{ t('Reset view', '重置视角') }}</button>
    </div>
    <div v-if="tool.source && tool.mode === 'flatten'" class="base-legend">
      <span v-if="tool.view === 'preview'"><i class="base-retained" />{{ t('Keep', '保留') }}</span>
      <span v-if="tool.view === 'preview'"><i class="base-removed" />{{ t('Remove', '删除') }}</span>
      <span v-if="tool.view === 'preview'"><i class="base-sealed" />{{ t('Cut surface', '切面') }}</span>
      <span v-if="tool.view === 'result' && tool.result?.stats.capFaces"><i class="base-sealed" />{{ t('New cap', '新增封口') }}</span>
    </div>
    <BasePlaneGizmo v-if="tool.mode === 'flatten' && tool.rotating && tool.view === 'preview' && !tool.busy" :tool="tool" :style="gizmoPosition" />
    <div v-if="tool.mode === 'add' && tool.source" class="base-view-hint">{{ tool.baseSelected ? t('Drag arrows to move the base · Shift: 1 mm snap · Esc: finish', '拖动箭头移动底座 · Shift：1 mm 吸附 · Esc：完成') : t('Click the base to move · Drag elsewhere to orbit', '单击底座显示移动控件 · 拖动其他区域观察模型') }}</div>
    <div v-else-if="!tool.rotating" class="base-view-hint">{{ tool.view === 'preview' ? t('Click the cut plane to rotate · Drag to orbit', '单击切平面调整角度 · 拖动观察模型') : t('Actual processed geometry · Export from the top bar', '真实处理结果 · 可从顶部导出') }}</div>
    <div v-if="!tool.source" class="base-empty">{{ t('Import a model from the top bar to begin', '从顶部导入模型开始处理') }}</div>
    <div v-if="error" class="base-view-error" role="alert">{{ error }}</div>
  </div>
</template>
<style scoped>
.base-view,.base-canvas{position:absolute;inset:0}.base-view{background:radial-gradient(ellipse at 50% 42%,#34353c 0,#202127 45%,#14151a 85%);border-radius:20px;overflow:hidden}.base-canvas :deep(canvas){display:block;width:100%;height:100%}.base-view-top{position:absolute;top:18px;left:20px;right:20px;display:flex;justify-content:space-between;gap:12px;pointer-events:none}.base-view-tabs{display:flex;background:#15161cbb;border:1px solid #ffffff12;border-radius:12px;padding:4px;gap:3px;pointer-events:auto;backdrop-filter:blur(12px)}.base-view-tabs button{color:#9b9eac;font-size:12px;padding:8px 14px;border-radius:8px}.base-view-tabs button.active{background:#ffffff12;color:#f8df70}.base-mode-label{padding:9px 13px;border:1px solid #ffffff12;border-radius:10px;background:#15161cbb;color:#f8df70;font-size:12px;backdrop-filter:blur(12px)}.base-fit{pointer-events:auto;border:1px solid #ffffff18;border-radius:9px;background:#17181caa;padding:6px 12px;font-size:11px;color:#bfc1ce}.base-legend{position:absolute;left:22px;top:78px;display:flex;gap:16px;color:#b0b3c2;font-size:11px;pointer-events:none}.base-legend span{display:flex;align-items:center;gap:6px}.base-legend i{width:7px;height:7px;border-radius:50%}.base-retained{background:#d9dce5}.base-removed{background:#e87d80}.base-sealed{background:#e0c66f}.base-view-hint{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);background:#17181fca;border:1px solid #ffffff12;border-radius:24px;padding:10px 18px;max-width:90%;text-align:center;font-size:11px;color:#9fa4b7;pointer-events:none;white-space:nowrap}.base-empty{position:absolute;inset:50% 0 auto;text-align:center;color:#8b90a2;font-size:14px;pointer-events:none}.base-view-error{position:absolute;bottom:80px;left:24px;color:#f0a6a0;font-size:12px}@media(max-width:1000px){.base-view-tabs button{padding:8px}.base-fit{display:none}.base-view-hint{white-space:normal;width:90%}}
</style>
