<script setup lang="ts">
import { useLocale } from '~/@base/locale';
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { ACESFilmicToneMapping, BoxGeometry, DirectionalLight, EquirectangularReflectionMapping, Group, HemisphereLight, Mesh, PerspectiveCamera, Scene, SphereGeometry, SRGBColorSpace, WebGLRenderer, type Texture } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { applySurface, createPrintMaterial, type SurfaceValues } from './material';
const { tr } = useLocale();

const props = defineProps<{ surface: SurfaceValues; label: string }>();
const host = useTemplateRef<HTMLDivElement>('host'), failed = ref(false);
let dispose = () => {}, update = (_surface: SurfaceValues) => {};
onMounted(() => {
  if (!host.value) return;
  let renderer: WebGLRenderer;
  try { renderer = new WebGLRenderer({ alpha: true, antialias: true }); }
  catch { failed.value = true; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping;
  host.value.appendChild(renderer.domElement);
  const scene = new Scene(), camera = new PerspectiveCamera(35, 1, 0.1, 1000);
  camera.position.set(100, 85, 145);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 21, 0); controls.enablePan = false; controls.minDistance = 85; controls.maxDistance = 260; controls.update();
  const { material, uniforms } = createPrintMaterial(props.surface); uniforms.printLayers.value = 0;
  const group = new Group(); scene.add(group);
  const geometries = [new BoxGeometry(30, 32, 6), new SphereGeometry(18, 48, 32), new BoxGeometry(30, 10, 1), new BoxGeometry(90, 4, 40)];
  const positions = [[-23, 20, 0], [20, 22, 0], [-23, 41, 0], [0, 2, 0]] as const;
  geometries.forEach((geometry, index) => { const mesh = new Mesh(geometry, material); const position = positions[index]!; mesh.position.set(position[0], position[1], position[2]); group.add(mesh); });
  const key = new DirectionalLight(0xffffff, 2); key.position.set(50, 100, 80);
  scene.add(new HemisphereLight(0xffffff, 0x444854, 1.2), key);
  const render = () => renderer.render(scene, camera);
  const resize = () => {
    const width = host.value?.clientWidth ?? 0, height = host.value?.clientHeight ?? 0;
    if (!width || !height) return;
    renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); render();
  };
  const observer = new ResizeObserver(resize); observer.observe(host.value); resize();
  controls.addEventListener('change', render);
  update = surface => { applySurface(material, surface); render(); };
  let closed = false, environment: Texture | undefined;
  new HDRLoader().load('/studio.hdr', texture => {
    if (closed) { texture.dispose(); return; }
    texture.mapping = EquirectangularReflectionMapping; environment = texture; scene.environment = texture; render();
  }, undefined, () => { /* Direct lights keep the sample visible if HDR is unavailable. */ });
  dispose = () => {
    closed = true; observer.disconnect(); controls.dispose(); environment?.dispose();
    geometries.forEach(geometry => geometry.dispose()); material.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
});
watch(() => props.surface, surface => update(surface), { deep: true });
onBeforeUnmount(() => dispose());
</script>

<template><div ref="host" class="filament-sample" role="img" :aria-label="tr(label)"><span v-if="failed">{{ tr(label) }} · WebGL unavailable</span></div></template>

<style scoped>
.filament-sample{height:220px;width:100%;position:relative;border-radius:12px;background:radial-gradient(ellipse at 50% 70%,#54565d,#25262c 75%);overflow:hidden;touch-action:none}.filament-sample :deep(canvas){display:block}.filament-sample span{position:absolute;inset:0;display:grid;place-content:center;font-size:12px;color:#b9bbc4}
</style>
