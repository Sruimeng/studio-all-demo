<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, reactive, shallowRef, useTemplateRef } from 'vue';
import type { Object3D } from 'three';
import { useLocale } from '~/@base/locale';
import { loadLocalModel } from '~/@engine/import';
import { collectModelResources, disposeModelResources } from '~/@engine/model';
import { toPrintMesh } from '~/@engine/print-mesh';
import { ModelViewport, type PrintDisplay, type ViewerContent, type ViewerSettings } from '~/@engine/viewer';
import { materialHex, materialProblem, materialSurface } from '../supplier';
import { validateMaterial } from '../catalog';
import type { MaterialRecord } from '../types';

const props = defineProps<{ material: MaterialRecord | null; drafting: boolean }>();
const { t } = useLocale();
const viewport = useTemplateRef('viewport');
const content = shallowRef<ViewerContent | null>(null);
const display = shallowRef<PrintDisplay | null>(null);
const loading = shallowRef(true);
const failure = shallowRef('');
const settings = reactive<ViewerSettings>({ mode: 'print', appearance: 'material', workflow: 'validation', compareSplit: 0.5, height: 100, layers: false, grid: false, tool: 'orbit', radius: 1, preview: { preset: 'validation-v1', exposure: 1, environmentIntensity: 1, environmentRotation: 0 } });
const material = computed(() => props.material && !validateMaterial(props.material, []) && !materialProblem(props.material) ? props.material : null);
const surface = computed(() => material.value ? materialSurface(material.value) : { hex: '#808080', transparency: 0, metalness: 0, roughness: 0.5 });
const hex = computed(() => material.value ? materialHex(material.value).toUpperCase() : '—');
const appearance = computed(() => material.value?.appearanceBinding?.name ?? material.value?.appearance?.templateId ?? t('Material parameters', '当前材质参数'));
let request: AbortController | undefined;
let closed = false;

async function load() {
  request?.abort();
  const current = new AbortController(); request = current;
  loading.value = true; failure.value = '';
  let root: Object3D | undefined;
  try {
    const response = await fetch('/samples/material-check.glb', { signal: current.signal });
    if (!response.ok) throw new Error(t('Standard sample could not be loaded.', '标准样件加载失败。'));
    const file = new File([await response.blob()], 'Material-check.glb', { type: 'model/gltf-binary' });
    if (current.signal.aborted || closed) return;
    root = (await loadLocalModel([file])).root;
    if (current.signal.aborted || closed) return;
    const mesh = await toPrintMesh(root);
    if (current.signal.aborted || closed) return;
    display.value = markRaw({ positions: mesh.positions, normals: mesh.normals, labels: new Uint8Array(mesh.positions.length / 9) });
    // Publishing transfers this independent root to the viewport's controller.
    content.value = markRaw({ id: crypto.randomUUID(), root: markRaw(root), mesh });
    root = undefined;
  } catch (error) {
    if (!current.signal.aborted && !closed) fail(error instanceof Error ? error.message : String(error));
  } finally {
    if (root) disposeModelResources(collectModelResources(root));
  }
}
function fail(message: string) {
  request?.abort();
  failure.value = message; loading.value = false;
  content.value = null; display.value = null;
}
onMounted(() => { if (!failure.value) void load(); });
onBeforeUnmount(() => { closed = true; request?.abort(); });
</script>

<template>
  <section class="wheel-material-preview" data-testid="wheel-material-preview" :aria-label="t('Standard sample material preview', '标准样件材质预览')">
    <header><h2>{{ t('3D · Standard sample', '3D · 标准样件') }}</h2><button type="button" :disabled="loading || !!failure" @click="viewport?.fit()">{{ t('Reset camera', '重置相机') }}</button></header>
    <div class="sample-view" :aria-busy="loading">
      <ModelViewport v-if="!failure" ref="viewport" :class="{ 'sample-hidden': !material || loading }" :content="content" :display="display" :surfaces="[]" :settings="settings" :validation-surface="surface" edit-tool="orbit" @ready="loading = false" @error="fail" />
      <div v-if="failure" class="sample-status" role="alert"><span>{{ failure }}</span><button type="button" @click="load">{{ t('Retry', '重试') }}</button></div>
      <div v-else-if="loading" class="sample-status" role="status">{{ t('Loading standard sample…', '正在加载标准样件…') }}</div>
      <div v-else-if="!material" class="sample-status" role="status">{{ drafting ? t('Enter a valid color draft to preview.', '请填写有效的颜色草稿后预览。') : t('Select a supported material to preview.', '请选择可预览的材质。') }}</div>
      <span v-else class="rotate-hint">{{ t('Drag to rotate · scroll to zoom', '拖动旋转 · 滚轮缩放') }}</span>
    </div>
    <div class="preview-values"><code>{{ hex }}</code><span>{{ material ? appearance : '—' }}</span></div>
    <label class="layer-toggle"><input v-model="settings.layers" type="checkbox">{{ t('Layer texture', '层纹效果') }}<small>{{ t('Fixed lighting', '固定验证灯光') }}</small></label>
    <p>{{ t('Screen material preview · not physically calibrated', '屏幕材质预览，未经实物校准') }}</p>
  </section>
</template>

<style scoped>
.wheel-material-preview { min-width: 0; margin-bottom: 24px; border: 1px solid #414a50; border-radius: 8px; overflow: hidden; background: #1b2023; }
header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 11px; }
h2 { font-size: 11px; font-weight: 500; color: #dae4e9; }
button { color: #c2ddaa; font-size: 10px; }
button:disabled { opacity: .4; }
.sample-view { position: relative; height: 260px; background: #202528; }
.sample-hidden { visibility: hidden; }
.sample-status { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 18px; color: #bbc8cf; text-align: center; font-size: 11px; line-height: 1.7; overflow-wrap: anywhere; }
.rotate-hint { position: absolute; bottom: 10px; left: 0; width: 100%; color: #b3c0c7; font-size: 9px; text-align: center; pointer-events: none; }
.preview-values { display: flex; align-items: start; gap: 9px; padding: 11px; font-size: 10px; }
.preview-values code { color: #e0e9ee; flex-shrink: 0; }
.preview-values span { color: #bac9ad; min-width: 0; overflow-wrap: anywhere; }
.layer-toggle { display: flex; align-items: center; gap: 6px; padding: 0 11px; color: #b6c1c7; font-size: 10px; }
.layer-toggle small { margin-left: auto; color: #8b9aa3; font-size: 9px; }
p { padding: 10px 11px; color: #94a2ab; font-size: 9px; line-height: 1.6; }
</style>
