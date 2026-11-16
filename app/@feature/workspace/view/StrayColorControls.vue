<script setup lang="ts">
import { useLocale } from '~/@base/locale';
import type { RegionEditTool } from '~/@engine/multicolor';

defineProps<{ areaMM2: number; tool: RegionEditTool; pending: 'cleanup' | 'selection' | null; candidates: number; protectedCount: number; disabled: boolean; undoCount: number }>();
const emit = defineEmits<{
  area: [value: number]; tool: [value: RegionEditTool]; detect: []; apply: []; cancel: []; undo: []; clearProtection: [];
}>();
const { t } = useLocale();
</script>

<template>
  <section class="edit-controls" data-testid="stray-color-controls">
    <h3>{{ t('Stray color cleanup', '碎色清理') }}</h3>
    <label class="studio-range"><span>{{ t('Maximum island area', '最大色岛面积') }}<b>{{ areaMM2 }} mm²</b></span><input data-testid="cleanup-area" :value="areaMM2" type="range" min="0.1" max="12" step="0.1" :disabled="disabled" @input="emit('area', ($event.target as HTMLInputElement).valueAsNumber)"></label>
    <p>{{ t('Merge small color patches into their neighbors. Cyan marks the preview; apply to confirm or cancel to keep the original. Smaller areas retain more detail.', '将小色块并入相邻区域。青色表示预览；应用后生效，取消则保持原样。面积越小，保留细节越多。') }}</p>
    <div class="actions">
      <button data-testid="cleanup-detect" type="button" :disabled="disabled" @click="emit('detect')">{{ t('Detect / preview', '检测 / 预览') }}</button>
      <button data-testid="cleanup-apply" type="button" :disabled="disabled || pending !== 'cleanup' || !candidates" @click="emit('apply')">{{ t('Apply', '应用') }}</button>
      <button data-testid="cleanup-cancel" type="button" :disabled="disabled || pending !== 'cleanup'" @click="emit('cancel')">{{ t('Cancel', '取消') }}</button>
      <button data-testid="cleanup-undo" type="button" :disabled="disabled || !undoCount" @click="emit('undo')">{{ t('Undo', '撤销') }}</button>
    </div>
    <p data-testid="cleanup-count" role="status">{{ t('Candidate triangles', '候选三角面') }}: {{ candidates }} · {{ t('Protected', '已保护') }}: {{ protectedCount }}</p>
    <div class="actions">
      <button data-testid="protect-region" type="button" :class="{ active: tool === 'protect' }" :disabled="disabled" @click="emit('tool', tool === 'protect' ? 'orbit' : 'protect')">{{ t('Click to protect', '点击保护细节') }}</button>
      <button data-testid="unprotect-region" type="button" :class="{ active: tool === 'unprotect' }" :disabled="disabled" @click="emit('tool', tool === 'unprotect' ? 'orbit' : 'unprotect')">{{ t('Click to unprotect', '点击解除保护') }}</button>
      <button data-testid="clear-protection" type="button" :disabled="disabled || !protectedCount" @click="emit('clearProtection')">{{ t('Clear protection', '清除保护') }}</button>
    </div>
    <p>{{ t('Gold marks protected faces. Protect eyes and markings before detection; rerun detection after changing protection.', '金色表示保护面。先保护眼睛、花纹再检测；修改保护后需重新检测。') }}</p>
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
