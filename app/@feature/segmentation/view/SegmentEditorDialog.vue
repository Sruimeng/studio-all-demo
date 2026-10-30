<script setup lang="ts">
import { useLocale } from '~/@base/locale';
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import type { SegmentationController } from '../use-segmentation';
import { canonicalPrompt } from '../reference';
import { textInput } from '../selection';
import ReferenceEditor from './ReferenceEditor.vue';
import SegmentGroups from './SegmentGroups.vue';
const { tr } = useLocale();

const props = defineProps<{ seg: SegmentationController }>();
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const editor = useTemplateRef<InstanceType<typeof ReferenceEditor>>('editor'), confirmDiscard = ref(false);
let returnFocus: HTMLElement | null = null;
onMounted(() => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.value?.showModal();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
});
function requestClose() {
  if (props.seg.locked) return;
  if (props.seg.hasEditorChanges()) confirmDiscard.value = true;
  else props.seg.cancelEdit();
}
function cancel(event: Event) { event.preventDefault(); if (!editor.value?.consumeEscape()) requestClose(); }
function key(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  event.preventDefault(); event.stopPropagation();
  if (props.seg.locked) return;
  if (textInput(event.target)) { (event.target as HTMLElement).blur(); return; }
  if (confirmDiscard.value) { confirmDiscard.value = false; return; }
  if (!editor.value?.consumeEscape()) requestClose();
}
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="segment-edit-dialog" aria-labelledby="segment-edit-title" @cancel="cancel" @keydown="key" @dragover.prevent.stop @drop.prevent.stop>
      <header class="edit-header">
        <div><h2 id="segment-edit-title">{{ tr("编辑 2D 分件方案") }}</h2><p>{{ tr(seg.previewing2d ? '确认分区方案后生成 3D 分件' : '选择分区，调整部件归属') }}</p></div>
        <button class="close-button" type="button" :aria-label="tr('取消并关闭分区编辑')" :disabled="seg.locked" @click="requestClose">×</button>
      </header>
      <div class="edit-content">
        <aside class="edit-parts">
          <section class="edit-prompt">
            <div class="parts-heading"><label for="segment-editor-prompt">{{ tr("输入拆分要求") }}</label><span>{{ tr(seg.editorPrompt).length }}/600</span></div>
            <textarea id="segment-editor-prompt" :value="tr(seg.editorPrompt)" :disabled="seg.locked" maxlength="600" rows="4" @input="($event.target as HTMLTextAreaElement).value !== tr(seg.editorPrompt) && seg.setEditorPrompt(canonicalPrompt(seg.mode, ($event.target as HTMLTextAreaElement).value))" />
            <button class="refresh-preview" type="button" :disabled="seg.locked" @click="seg.refreshPreview()">{{ tr(seg.busy ? seg.processingLabel : '更新分区方案') }}</button>
            <p v-if="seg.editorStale" class="prompt-notice" role="status">{{ tr("要求已修改，请更新分区方案后确认。") }}</p>
            <div v-if="seg.confirmPreviewRefresh" class="refresh-confirm"><p>{{ tr("更新方案将替换当前分区编辑。") }}</p><button type="button" :disabled="seg.locked" @click="seg.refreshPreview(true)">{{ tr("确认更新") }}</button><button type="button" :disabled="seg.locked" @click="seg.setUi('confirmPreviewRefresh', false)">{{ tr("保留编辑") }}</button></div>
          </section>
          <div class="parts-heading"><h3>{{ tr("部件清单") }}</h3><span>{{ tr(seg.plan?.groups.length ?? 0) }} {{ tr("组") }}</span></div><SegmentGroups :seg="seg" />
          <button class="add-editor-part" type="button" :disabled="seg.locked" @click="editor?.openNewPart()">{{ tr("＋ 新建部件") }}</button>
        </aside>
        <div class="edit-canvas"><ReferenceEditor ref="editor" :seg="seg" /><div v-if="seg.busy" class="edit-loading" role="status">{{ tr(seg.processingLabel) }}</div></div>
      </div>
      <footer class="edit-footer">
        <template v-if="confirmDiscard"><p class="edit-error" role="alert">{{ tr("有未应用的修改，确定放弃？") }}</p><div class="edit-actions"><button type="button" @click="confirmDiscard = false">{{ tr("继续编辑") }}</button><button type="button" @click="seg.cancelEdit">{{ tr("放弃修改") }}</button></div></template>
        <template v-else>
        <p v-if="seg.error" class="edit-error" role="alert">{{ tr(seg.error) }}</p>
        <p v-else class="edit-note">{{ tr(seg.previewing2d ? '确认后关闭预览，开始生成 3D 分件' : '应用后返回 3D 模型，更新拆分结果') }}</p>
        <div class="edit-actions"><button type="button" :disabled="seg.locked" autofocus @click="requestClose">{{ tr("取消") }}</button><button class="apply-button" type="button" :disabled="seg.locked || seg.editorStale" :title="tr(seg.editorStale ? '请先更新分区方案' : undefined)" @click="seg.applyEdit">{{ tr(seg.previewing2d ? '确认方案并拆分' : '应用修改') }}</button></div>
        </template>
      </footer>
    </dialog>
  </Teleport>
</template>

<style scoped>
.segment-edit-dialog{padding:0;margin:auto;width:min(1600px,calc(100vw - 48px));height:min(960px,calc(100dvh - 48px));max-width:none;max-height:none;box-sizing:border-box;border:1px solid #ffffff20;border-radius:14px;background:#1c1d23;color:#dedee5;box-shadow:0 24px 100px #0009;overflow:hidden;font-family:inherit}.segment-edit-dialog[open]{display:flex;flex-direction:column}.segment-edit-dialog::backdrop{background:#080a10b3;backdrop-filter:blur(4px)}
.edit-header{display:flex;align-items:center;justify-content:space-between;padding:15px 20px;border-bottom:1px solid #ffffff10;flex:none}.edit-header h2{margin:0;font-size:15px;font-weight:600}.edit-header p{margin:5px 0 0;font-size:11px;color:#9499a7}.segment-edit-dialog button{font:inherit;font-size:12px;cursor:pointer;color:#c9cbd4;background:#ffffff07;border:1px solid #ffffff18;border-radius:7px;padding:9px 18px}.segment-edit-dialog button:disabled{opacity:.4;cursor:not-allowed}.segment-edit-dialog button:focus-visible{outline:2px solid #f7d75a;outline-offset:2px}.edit-header .close-button{font-size:24px;width:34px;height:34px;padding:0;border:0;background:transparent;color:#9c9faa}
.edit-content{display:flex;flex:1;min-height:0}.edit-parts{width:230px;flex:none;box-sizing:border-box;padding:17px 16px;overflow:auto;border-right:1px solid #ffffff10;background:#222329}.parts-heading{display:flex;justify-content:space-between;align-items:center;gap:10px}.parts-heading h3{font-size:12px;font-weight:600;margin:0}.parts-heading span{color:#898f9b;font-size:10px}.edit-canvas{position:relative;flex:1;min-width:0;min-height:0;background:#18191e}
.edit-prompt{padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid #ffffff12}.edit-prompt label{font-size:12px;font-weight:600}.edit-prompt textarea{display:block;width:100%;box-sizing:border-box;resize:vertical;min-height:104px;max-height:220px;margin:12px 0 9px;padding:10px;border:1px solid #ffffff18;border-radius:8px;background:#191a20;color:#dedee5;font:inherit;font-size:11px;line-height:1.7}.edit-prompt textarea:focus-visible{outline:1px solid #f7d75a}.segment-edit-dialog .refresh-preview{width:100%;padding:8px 5px;font-size:11px}.prompt-notice,.refresh-confirm p{font-size:10px;line-height:1.6;margin:9px 0 0;color:#ebcc7d}.refresh-confirm{margin-top:9px}.segment-edit-dialog .refresh-confirm button{font-size:10px;padding:6px 8px;margin:8px 5px 0 0}.edit-loading{position:absolute;inset:0;display:grid;place-content:center;background:#18191eaa;color:#f7d75a;font-size:13px;z-index:2}
.edit-footer{display:flex;justify-content:space-between;align-items:center;gap:20px;flex:none;padding:13px 20px;border-top:1px solid #ffffff10;background:#222329}.edit-footer p{font-size:11px;line-height:1.5;margin:0}.edit-note{color:#9399a6}.edit-error{color:#f2b2a4;max-height:56px;overflow:auto}.edit-actions{display:flex;gap:10px;flex:none}.edit-actions .apply-button{background:#f7d75a;border-color:#f7d75a;color:#201d11;font-weight:600}
.segment-edit-dialog .add-editor-part{width:100%;font-size:11px;padding:8px}
@media(max-width:1000px){.segment-edit-dialog{width:calc(100vw - 24px);height:calc(100dvh - 24px)}.edit-parts{width:190px;padding:14px 10px}}
@media(max-width:700px){.edit-parts{width:165px}.edit-footer{gap:8px;padding:10px}.edit-footer .edit-note{display:none}.edit-actions{margin-left:auto}.segment-edit-dialog button{padding:8px 12px}}
</style>
