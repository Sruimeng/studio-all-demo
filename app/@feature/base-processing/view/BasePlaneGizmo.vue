<script setup lang="ts">
import { useLocale } from '~/@base/locale';
import type { BaseProcessingController, RotationAxis } from '../index';
const props = defineProps<{ tool: BaseProcessingController }>();
const { t } = useLocale();
const axes: RotationAxis[] = ['x', 'y', 'z'];
const fixed = (value: number) => Number(value.toFixed(1));
function angleChanged(event: Event, axis: RotationAxis) {
  const input = event.target as HTMLInputElement;
  if (input.value.trim()) props.tool.setAngle(axis, Number(input.value));
  input.value = String(fixed(props.tool.angles[axis]));
}
</script>
<template>
  <div class="plane-gizmo" role="group" :aria-label="t('Cut plane gizmo', '切平面 gizmo')" @pointerdown.stop @wheel.stop>
    <header><span>{{ t('Cut plane', '切平面') }}</span><button class="gizmo-done" :title="t('Finish rotation (Esc)', '完成旋转（Esc）')" :aria-label="t('Finish rotation', '完成旋转')" @click="tool.stopRotation"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m4 10 4 4 8-8" /></svg></button></header>
    <div class="gizmo-presets" role="group" :aria-label="t('Align cut plane', '对齐切面')"><span>{{ t('Align', '对齐') }}</span><button v-for="axis in axes" :key="axis" :class="['axis-' + axis, { active: tool.direction === axis }]" :aria-pressed="tool.direction === axis" :aria-label="t('Align plane to ', '切面垂直于 ') + axis.toUpperCase()" :title="t('Plane perpendicular to ', '切面垂直于 ') + axis.toUpperCase()" :disabled="tool.dragging" @click="tool.setDirection(axis, true)">{{ axis.toUpperCase() }}</button></div>
    <div class="gizmo-angles" :aria-label="t('Rotation angles', '旋转角度')"><label v-for="axis in axes" :key="axis" :class="'axis-' + axis"><span>{{ axis.toUpperCase() }}</span><input type="number" step="1" :value="fixed(tool.angles[axis])" :aria-label="t('Plane rotation around ', '切面绕 ') + axis.toUpperCase()" :disabled="tool.dragging" @change="angleChanged($event, axis)" @keydown.enter="($event.target as HTMLInputElement).blur()"><span>°</span></label></div>
  </div>
</template>
<style scoped>
.plane-gizmo{position:absolute;width:218px;max-width:calc(100% - 24px);padding:10px;border:1px solid #b7a4f54d;border-radius:12px;background:#1a1b22ed;box-shadow:0 8px 24px #0004;backdrop-filter:blur(12px);color:#c9cbd6;font-size:11px;pointer-events:auto;z-index:2}.plane-gizmo header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;color:#e5ddff;font-size:12px}.gizmo-done{display:grid;place-items:center;width:24px;height:24px;border-radius:6px;background:#ffffff0a;color:#b7cdbb}.gizmo-done svg{width:17px;height:17px}.gizmo-presets{display:flex;gap:6px;align-items:center;margin-bottom:10px}.gizmo-presets>span{margin-right:auto;color:#999ead}.gizmo-presets button{height:27px;width:37px;border:1px solid #ffffff18;border-radius:6px;background:#ffffff04;font-weight:600}.gizmo-presets button.active{border-color:currentColor;background:#ffffff10}.plane-gizmo button:hover:enabled{background:#ffffff18}.gizmo-angles{display:flex;gap:5px}.gizmo-angles label{display:flex;align-items:center;gap:3px;flex:1;min-width:0;border:1px solid #ffffff18;border-radius:6px;padding:6px 5px;background:#12131966}.gizmo-angles label:focus-within{border-color:currentColor}.gizmo-angles input{width:100%;min-width:0;color:#e5e6ee;font-size:11px;background:none;outline:none;text-align:right;font-variant-numeric:tabular-nums;-moz-appearance:textfield}.gizmo-angles input::-webkit-inner-spin-button{appearance:none}.axis-x{color:#ed777a}.axis-y{color:#87cf9a}.axis-z{color:#829efa}.plane-gizmo button:disabled{opacity:.5}
</style>
