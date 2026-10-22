<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import type { SegmentationController } from '../use-segmentation';
import ReferenceEditor from './ReferenceEditor.vue';
import SegmentGroups from './SegmentGroups.vue';

const props = defineProps<{ seg: SegmentationController }>();
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
let returnFocus: HTMLElement | null = null;
onMounted(() => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.value?.showModal();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
});
function cancel(event: Event) { event.preventDefault(); props.seg.cancelEdit(); }
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="segment-edit-dialog" aria-labelledby="segment-edit-title" @cancel="cancel" @dragover.prevent.stop @drop.prevent.stop>
      <header class="edit-header">
        <div><h2 id="segment-edit-title">调整 2D 分区</h2><p>选择分区，调整部件归属</p></div>
        <button class="close-button" type="button" aria-label="取消并关闭分区编辑" :disabled="seg.locked" @click="seg.cancelEdit">×</button>
      </header>
      <div class="edit-content">
        <aside class="edit-parts"><div class="parts-heading"><h3>区域归属</h3><span>{{ seg.plan?.groups.length ?? 0 }} 组</span></div><SegmentGroups :seg="seg" /></aside>
        <div class="edit-canvas"><ReferenceEditor :seg="seg" /></div>
      </div>
      <footer class="edit-footer">
        <p v-if="seg.error" class="edit-error" role="alert">{{ seg.error }}</p>
        <p v-else class="edit-note">应用后返回 3D 模型，更新拆分结果</p>
        <div class="edit-actions"><button type="button" :disabled="seg.locked" autofocus @click="seg.cancelEdit">取消编辑</button><button class="apply-button" type="button" :disabled="seg.locked" @click="seg.applyEdit">应用修改</button></div>
      </footer>
    </dialog>
  </Teleport>
</template>

<style scoped>
.segment-edit-dialog{padding:0;margin:auto;width:min(1600px,calc(100vw - 48px));height:min(960px,calc(100dvh - 48px));max-width:none;max-height:none;box-sizing:border-box;border:1px solid #ffffff20;border-radius:14px;background:#1c1d23;color:#dedee5;box-shadow:0 24px 100px #0009;overflow:hidden;font-family:inherit}.segment-edit-dialog[open]{display:flex;flex-direction:column}.segment-edit-dialog::backdrop{background:#080a10b3;backdrop-filter:blur(4px)}
.edit-header{display:flex;align-items:center;justify-content:space-between;padding:15px 20px;border-bottom:1px solid #ffffff10;flex:none}.edit-header h2{margin:0;font-size:15px;font-weight:600}.edit-header p{margin:5px 0 0;font-size:11px;color:#9499a7}.segment-edit-dialog button{font:inherit;font-size:12px;cursor:pointer;color:#c9cbd4;background:#ffffff07;border:1px solid #ffffff18;border-radius:7px;padding:9px 18px}.segment-edit-dialog button:disabled{opacity:.4;cursor:not-allowed}.segment-edit-dialog button:focus-visible{outline:2px solid #f7d75a;outline-offset:2px}.edit-header .close-button{font-size:24px;width:34px;height:34px;padding:0;border:0;background:transparent;color:#9c9faa}
.edit-content{display:flex;flex:1;min-height:0}.edit-parts{width:230px;flex:none;box-sizing:border-box;padding:17px 16px;overflow:auto;border-right:1px solid #ffffff10;background:#222329}.parts-heading{display:flex;justify-content:space-between;align-items:center;gap:10px}.parts-heading h3{font-size:12px;font-weight:600;margin:0}.parts-heading span{color:#898f9b;font-size:10px}.edit-canvas{position:relative;flex:1;min-width:0;min-height:0;background:#18191e}
.edit-footer{display:flex;justify-content:space-between;align-items:center;gap:20px;flex:none;padding:13px 20px;border-top:1px solid #ffffff10;background:#222329}.edit-footer p{font-size:11px;line-height:1.5;margin:0}.edit-note{color:#9399a6}.edit-error{color:#f2b2a4;max-height:56px;overflow:auto}.edit-actions{display:flex;gap:10px;flex:none}.edit-actions .apply-button{background:#f7d75a;border-color:#f7d75a;color:#201d11;font-weight:600}
@media(max-width:1000px){.segment-edit-dialog{width:calc(100vw - 24px);height:calc(100dvh - 24px)}.edit-parts{width:190px;padding:14px 10px}}
@media(max-width:700px){.edit-parts{width:165px}.edit-footer{gap:8px;padding:10px}.edit-footer .edit-note{display:none}.edit-actions{margin-left:auto}.segment-edit-dialog button{padding:8px 12px}}
</style>
