<script setup lang="ts">
import { useLocale } from '~/@base/locale';
import type { RegionEditTool } from '~/@engine/multicolor';

defineProps<{ tool: RegionEditTool; angle: number; selectedCount: number; target: string; pending: 'cleanup' | 'selection' | null; disabled: boolean; undoCount: number; editedCount: number }>();
const emit = defineEmits<{ tool: [value: RegionEditTool]; angle: [value: number]; apply: []; cancel: []; undo: []; reset: [] }>();
const { t } = useLocale();
</script>

<template>
  <section class="edit-controls" data-testid="region-edit-controls">
    <h3>{{ t('Local region color', '几何区域换色') }}</h3>
    <div class="actions">
      <button v-for="mode in (['orbit', 'select', 'exclude'] as const)" :key="mode" :data-testid="`region-tool-${mode}`" type="button" :class="{ active: tool === mode }" :disabled="disabled" @click="emit('tool', mode)">{{ mode === 'orbit' ? t('Orbit', '旋转') : mode === 'select' ? t('Add region', '添加选区') : t('Exclude region', '排除选区') }}</button>
    </div>
    <label class="studio-range"><span>{{ t('Geometric sensitivity', '几何边界灵敏度') }}<b>{{ angle }}°</b></span><input data-testid="region-angle" :value="angle" type="range" min="1" max="80" step="1" :disabled="disabled" @input="emit('angle', ($event.target as HTMLInputElement).valueAsNumber)"></label>
    <p>{{ t('Click to select a connected surface, regardless of its colors. Lower the angle for a smaller region; add or exclude areas before applying the selected color / SKU.', '点击选择相连表面，不受原颜色限制。调低角度可缩小选区；添加或排除区域后，应用当前颜色 / SKU。') }}</p>
    <p data-testid="region-selection-count" role="status">{{ t('Selected triangles', '已选三角面') }}: {{ selectedCount }}</p>
    <p data-testid="region-edit-target">{{ t('Target color / SKU', '目标颜色 / SKU') }}: {{ target || '—' }}</p>
    <div class="actions">
      <button data-testid="region-apply" type="button" :disabled="disabled || pending !== 'selection' || !selectedCount" @click="emit('apply')">{{ t('Apply selected color', '应用当前颜色') }}</button>
      <button data-testid="region-cancel" type="button" :disabled="disabled || pending !== 'selection'" @click="emit('cancel')">{{ t('Cancel', '取消') }}</button>
      <button data-testid="region-undo" type="button" :disabled="disabled || !undoCount" @click="emit('undo')">{{ t('Undo', '撤销') }}</button>
      <button data-testid="region-reset" type="button" :disabled="disabled || !editedCount" @click="emit('reset')">{{ t('Reset edits', '重置编辑') }}</button>
    </div>
  </section>
</template>

<style scoped>
.edit-controls { margin-top: 20px; font-size: 11px; }
.edit-controls h3 { margin: 0 0 12px; font-size: 12px; }
.edit-controls p { color: #92989f; line-height: 1.5; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; }
.actions button { padding: 6px 8px; border: 1px solid #464950; border-radius: 6px; }
.actions .active { border-color: #61dce8; color: #61dce8; }
</style>
