<script setup lang="ts">
import { effectScope, markRaw, onMounted, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue';
import { ACESFilmicToneMapping, Box3, BufferAttribute, BufferGeometry, DirectionalLight, EquirectangularReflectionMapping, GridHelper, Group, HemisphereLight, Mesh, PerspectiveCamera, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer, type Material } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { ViewportGizmo } from 'three-viewport-gizmo';
import { createEngine, type RenderFunction } from '@tripo3d/engine';
import { ModelAccess, ModelObjectParent, ModelResultKind, useModelController, useModelPlatform, type ModelPresentation } from '../model';
import { createViewerRuntime } from './runtime';
import { applySurface, cloneStudioMaterial, createPrintMaterial } from './material';
import type { ViewerContent, ViewerSettings, PrintDisplay, SurfaceValues, ViewerHit } from './types';

const props = defineProps<{ content: ViewerContent | null; display: PrintDisplay | null; surfaces: SurfaceValues[]; settings: ViewerSettings; validationSurface?: SurfaceValues | null }>();
const emit = defineEmits<{ ready: []; error: [message: string]; stroke: [hits: ViewerHit[]]; fill: [hit: ViewerHit] }>();
const host = useTemplateRef<HTMLDivElement>('host');
const error = shallowRef('');
let teardown = () => {};
let fit = () => {};
let inspect = () => ({} as Record<string, unknown>);
defineExpose({ fit: () => fit(), inspect: () => inspect() });

onMounted(() => {
  if (!host.value) return;
  const localScope = effectScope();
  try { localScope.run(() => {
    const engine = markRaw(createEngine());
    const renderer = markRaw(new WebGLRenderer({ antialias: true, alpha: true }));
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
    renderer.setClearColor(0x000000, 0);
    host.value!.appendChild(renderer.domElement);
    const scene = markRaw(new Scene()); const mount = markRaw(new Group()); scene.add(mount);
    const camera = markRaw(new PerspectiveCamera(32, 1, 0.1, 10000));
    const controls = markRaw(new OrbitControls(camera, renderer.domElement)); controls.enableDamping = true;
    const orientationGizmo = markRaw(new ViewportGizmo(camera, renderer));
    orientationGizmo.set({ container: host.value!, placement: 'top-right', size: 72, offset: { top: 2, right: 2 } });
    orientationGizmo.addEventListener('start', () => { controls.enabled = false; });
    orientationGizmo.addEventListener('end', () => { controls.enabled = props.settings.tool === 'orbit'; });
    const composer = markRaw(new EffectComposer(renderer));
    const lights = [new HemisphereLight(0xffffff, 0x444854, 1.2), new DirectionalLight(0xffffff, 2)];
    lights[1]!.position.set(50, 100, 80); scene.add(...lights);
    const grid = new GridHelper(220, 22, 0x43464b, 0x2a2d31); grid.position.y = -0.15; scene.add(grid);
    grid.visible = props.settings.grid;
    const callbacks: Array<{ handler: RenderFunction; order: number }> = [];
    const platform = useModelPlatform({ cameraEnabled: () => props.settings.tool === 'orbit', controls: shallowRef(controls), renderer,
      scene: () => mount, onRender: (handler, order) => { callbacks.push({ handler, order }); callbacks.sort((a, b) => a.order - b.order); } });
    const controller = useModelController(createViewerRuntime(mount, platform));
    engine.addSystem('model', () => ({ controller: markRaw(controller) }));
    let activeRoot: ViewerContent['root'] | null = null;
    let printMesh: Mesh | null = null;
    let validationRoot: ViewerContent['root'] | null = null;
    let validationMaterial: ReturnType<typeof createPrintMaterial> | null = null;
    let sourceKey: string | null = null;
    let currentPrint: PrintDisplay | null = null;
    let closed = false;
    let sourceBounds = new Box3();
    let renderSurface = props.surfaces;
    let printMaterials: ReturnType<typeof createPrintMaterial>[] = [];
    const presentation: ModelPresentation<Record<string, never>, { id: string }, null> = {
      name: 'material-studio', access: ModelAccess.Editable, snapshotParams: () => ({}),
      prepare(context) {
        const owned: Material[] = [];
        const bindings = context.content.meshes.map(mesh => {
          const source = mesh.material;
          const materials = (Array.isArray(source) ? source : [source]).map(material => { const cloned = cloneStudioMaterial(material); owned.push(cloned); return cloned; });
          return { mesh, material: Array.isArray(source) ? materials : materials[0]! };
        });
        context.replaceAppearance({ materials: bindings, renderSettings: { toneMapping: ACESFilmicToneMapping } });
        context.scope.defer(() => { owned.forEach(material => material.dispose()); });
        const group = new Group();
        const binding = context.platform.prepareObject({ object: group, parent: ModelObjectParent.Scene, ownedResources: [] });
        return {
          view: null,
          activate() { activeRoot = context.content.root; binding.mount(); },
          deactivate() { clearPrint(); activeRoot = null; },
          update() {},
        };
      },
    };
    function clearPrint() {
      if (printMesh) { printMesh.removeFromParent(); printMesh.geometry.dispose(); printMesh = null; }
      printMaterials.forEach(entry => entry.material.dispose()); printMaterials = []; currentPrint = null;
      validationRoot?.removeFromParent(); validationRoot = null;
      validationMaterial?.material.dispose(); validationMaterial = null;
    }
    function updatePrint() {
      if (!activeRoot || !props.display) { clearPrint(); return; }
      if (props.settings.workflow === 'validation' && props.validationSurface) {
        if (!validationRoot) {
          // Share source geometry so calibration retains its authored normals.
          validationRoot = markRaw(activeRoot.clone(true));
          validationMaterial = createPrintMaterial(props.validationSurface);
          validationRoot.traverse(object => { if (object instanceof Mesh) object.material = validationMaterial!.material; });
          mount.add(validationRoot);
        }
        applySurface(validationMaterial!.material, props.validationSurface);
        validationMaterial!.uniforms.printLayers.value = props.settings.layers ? 1 : 0;
        return;
      }
      renderSurface = props.surfaces;
      if (printMaterials.length !== renderSurface.length) {
        printMaterials.forEach(entry => entry.material.dispose());
        printMaterials = renderSurface.map(createPrintMaterial);
      }
      printMaterials.forEach((entry, index) => {
        applySurface(entry.material, renderSurface[index]!);
        entry.uniforms.printLayers.value = props.settings.layers ? 1 : 0;
      });
      if (props.display !== currentPrint) {
        if (printMesh) { printMesh.removeFromParent(); printMesh.geometry.dispose(); }
        const data = props.display;
        const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
        const buckets = Array.from({ length: renderSurface.length }, () => [] as number[]);
        for (let i = 0; i < data.labels.length; i++) buckets[data.labels[i] ?? 0]?.push(i * 3, i * 3 + 1, i * 3 + 2);
        const sorted = new Uint32Array(data.positions.length / 3); let start = 0;
        buckets.forEach((bucket, materialIndex) => { sorted.set(bucket, start); geometry.addGroup(start, bucket.length, materialIndex); start += bucket.length; });
        geometry.setIndex(new BufferAttribute(sorted, 1)); geometry.computeVertexNormals();
        geometry.boundsTree = new MeshBVH(geometry, { indirect: true });
        printMesh = markRaw(new Mesh(geometry, printMaterials.map(entry => entry.material))); printMesh.raycast = acceleratedRaycast;
        mount.add(printMesh); currentPrint = data;
      }
      if (printMesh) printMesh.material = printMaterials.map(entry => entry.material);
    }
    function updateHeight() {
      const height = sourceBounds.max.y - sourceBounds.min.y || 1;
      const scale = props.settings.height / height;
      const center = sourceBounds.getCenter(new Vector3());
      mount.scale.setScalar(scale); mount.position.set(-center.x * scale, -sourceBounds.min.y * scale, -center.z * scale);
      // vPrintHeight already uses world millimeters.
      printMaterials.forEach(entry => { entry.uniforms.printScale.value = 1; });
    }
    fit = () => {
      const height = props.settings.height;
      const size = sourceBounds.getSize(new Vector3()).multiplyScalar(height / (sourceBounds.max.y - sourceBounds.min.y || 1));
      const split = props.settings.mode === 'compare' ? Math.min(props.settings.compareSplit, 1 - props.settings.compareSplit) : 1;
      const aspect = Math.max(0.1, (host.value?.clientWidth ?? 1) * split / (host.value?.clientHeight || 1));
      const angle = Math.min(camera.fov * Math.PI / 360, Math.atan(Math.tan(camera.fov * Math.PI / 360) * aspect));
      const distance = Math.max(height, size.length() * 0.5 / Math.sin(angle)) * 1.08;
      controls.target.set(0, height * 0.5, 0);
      camera.position.copy(new Vector3(1.3, 0.6, 2.05).normalize().multiplyScalar(distance).add(controls.target));
      controls.update();
    };
    const context = Symbol('demo-workspace');
    watch(() => props.content, async content => {
      if (!content || content.id === sourceKey) return;
      sourceKey = content.id;
      sourceBounds = new Box3().setFromObject(content.root);
      updateHeight(); fit();
      const result = await controller.setDefault({ context, source: { key: { id: content.id, revision: 0 }, prepare: async () => ({ root: content.root, info: { id: content.id } }) }, presentation, params: {} });
      if (result.kind === ModelResultKind.Failed) { error.value = result.failure.error.message; emit('error', error.value); }
      else if (result.kind === ModelResultKind.Applied) { updatePrint(); emit('ready'); }
    }, { immediate: true });
    watch(() => [props.display, props.surfaces, props.settings.layers, props.settings.workflow, props.validationSurface] as const, updatePrint, { deep: false });
    watch(() => props.settings.height, () => { updateHeight(); fit(); });
    watch(() => props.settings.mode, fit);
    watch(() => props.settings.tool, tool => { controls.enabled = tool === 'orbit'; renderer.domElement.style.cursor = tool === 'orbit' ? 'grab' : 'crosshair'; });
    watch(() => props.settings.grid, visible => { grid.visible = visible; });
    const updateLighting = () => {
      const preview = props.settings.preview;
      const fixed = preview?.preset === 'validation-v1';
      renderer.toneMappingExposure = fixed ? 1 : preview?.exposure ?? 1;
      scene.environmentIntensity = fixed ? 1 : preview?.environmentIntensity ?? 1;
      scene.environmentRotation.set(0, fixed ? 0 : (preview?.environmentRotation ?? 0) * Math.PI / 180, 0);
    };
    watch(() => props.settings.preview, updateLighting, { deep: true, immediate: true });
    let stroke: ViewerHit[] = []; let drawing = false;
    const raycaster = new Raycaster(); raycaster.firstHitOnly = true; const mouse = new Vector2();
    function hit(event: PointerEvent): ViewerHit | null {
      if (!printMesh || props.settings.workflow === 'validation' || props.settings.mode === 'original' || !currentPrint) return null;
      const rect = renderer.domElement.getBoundingClientRect(); let x = event.clientX - rect.left; let width = rect.width;
      if (props.settings.mode === 'compare') {
        const split = Math.min(0.8, Math.max(0.2, props.settings.compareSplit));
        if (x < rect.width * split) return null;
        x -= rect.width * split; width = rect.width * (1 - split);
      }
      camera.aspect = width / rect.height; camera.updateProjectionMatrix();
      mouse.set(x / width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(mouse, camera);
      printMesh.updateWorldMatrix(true, false);
      const result = raycaster.intersectObject(printMesh)[0];
      if (!result || result.faceIndex == null) return null;
      const index = printMesh.geometry.index!.getX(result.faceIndex * 3);
      const leaf = Math.floor(index / 3); const face = currentPrint.faceMap?.[leaf] ?? leaf;
      return { face, point: mount.worldToLocal(result.point.clone()).toArray(), radius: props.settings.radius / mount.scale.x };
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || props.settings.tool === 'orbit') return;
      const result = hit(event); if (!result) return;
      event.preventDefault(); renderer.domElement.setPointerCapture(event.pointerId);
      if (props.settings.tool === 'fill') { emit('fill', result); return; }
      drawing = true; stroke = [result];
    };
    const move = (event: PointerEvent) => { if (!drawing) return; const result = hit(event); if (result && stroke.at(-1)?.face !== result.face) stroke.push(result); };
    const up = () => { if (drawing && stroke.length) emit('stroke', stroke); drawing = false; stroke = []; };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointercancel', up);
    const resize = new ResizeObserver(() => { if (!host.value) return; renderer.setSize(host.value.clientWidth, host.value.clientHeight); }); resize.observe(host.value!);
    const frameTimes: number[] = [];
    let frame = 0, previous = performance.now(); const start = previous;
    function render() {
      if (closed) return;
      frame = requestAnimationFrame(render); const now = performance.now(); const delta = (now - previous) / 1000; previous = now;
      frameTimes.push(delta * 1000); if (frameTimes.length > 120) frameTimes.shift();
      controls.update(); for (const callback of callbacks) callback.handler({ composer, delta, elapsed: (now - start) / 1000 });
      const width = renderer.domElement.clientWidth; const height = renderer.domElement.clientHeight;
      if (!height) return;
      const draw = (left: number, w: number, print: boolean) => {
        const validation = props.settings.workflow === 'validation' && !!validationRoot;
        if (activeRoot) activeRoot.visible = !print || !(validation ? validationRoot : printMesh);
        if (printMesh) printMesh.visible = print && !validation;
        if (validationRoot) validationRoot.visible = print && validation;
        camera.aspect = w / height; camera.updateProjectionMatrix(); renderer.setViewport(left, 0, w, height); renderer.setScissor(left, 0, w, height);
        renderer.render(scene, camera);
      };
      platform.runFrame(() => {
        renderer.setScissorTest(true);
        if (props.settings.mode === 'compare') {
          const split = Math.min(0.8, Math.max(0.2, props.settings.compareSplit));
          draw(0, width * split, false); draw(width * split, width * (1 - split), true);
        }
        else draw(0, width, props.settings.mode === 'print');
        renderer.setScissorTest(false);
        orientationGizmo.update(); orientationGizmo.render();
      });
    }
    inspect = () => ({ geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length, triangles: renderer.info.render.triangles, workflow: props.settings.workflow, exposure: renderer.toneMappingExposure, environmentIntensity: scene.environmentIntensity, validationRoughness: validationMaterial?.material.roughness, studioRoughness: validationMaterial?.uniforms.studioRoughness.value, frameMS: frameTimes.length ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length : 0 });
    fit(); render();
    new HDRLoader().load('/studio.hdr', texture => { if (closed) { texture.dispose(); return; } texture.mapping = EquirectangularReflectionMapping; scene.environment = texture; updateLighting(); }, undefined, () => {});
    teardown = () => {
      closed = true; cancelAnimationFrame(frame); resize.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointercancel', up);
      void controller.close().finally(() => {
        clearPrint(); platform.dispose(); engine.dispose(); scene.environment?.dispose(); grid.geometry.dispose();
        (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(material => material.dispose()); composer.dispose(); orientationGizmo.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); localScope.stop();
      });
    };
  }); } catch (cause) { error.value = String(cause); emit('error', error.value); localScope.stop(); }
});
onBeforeUnmount(() => teardown());
</script>
<template><div ref="host" class="model-viewport"><div v-if="error" class="viewport-error">{{ error }}</div></div></template>
<style scoped>
.model-viewport { width: 100%; height: 100%; position: relative; overflow: hidden; }
.viewport-error { position: absolute; inset: 35% 15%; z-index: 2; color: #ffab9c; text-align: center; }
</style>
