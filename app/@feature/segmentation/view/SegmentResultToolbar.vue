<script setup lang="ts">
import { useLocale } from '~/@base/locale';
import { computed, ref, watch } from 'vue';
import type { SegmentationController } from '../use-segmentation';
const { tr } = useLocale();
const props = defineProps<{ seg: SegmentationController }>();
const paletteOpen = ref(false), explosionOpen = ref(false);
const painting = computed(() => props.seg.meshTool !== 'select');
const editable = computed(() => props.seg.resultEditing && !props.seg.locked && !props.seg.sourceView);
const outputTitle = computed(() => props.seg.confirmed ? undefined : '请先点击 Save 保存并确认当前结果');
watch(() => [props.seg.meshTool, props.seg.plan, props.seg.sourceView], () => { paletteOpen.value = false; });
const icons = {
  undo: 'M9 5 4 10l5 5M4 10h9a6 6 0 0 1 6 6v3',
  redo: 'm15 5 5 5-5 5m5-5h-9a6 6 0 0 0-6 6v3',
  brush: 'm14 4 6 6M10 14l-2-2L17 3a2.1 2.1 0 0 1 3 3l-9 9-1-1ZM8 14c-5-1-3 5-6 6 5 2 9-1 6-6Z',
  merge: 'M4 3v5c0 4 8 4 8 8m8-13v5c0 4-8 4-8 8m-4 1 4 4 4-4m-4 4v-8',
  save: 'M5 3h12l4 4v14H3V3h2Zm2 0v6h9V3M7 21v-8h10v8',
  print: 'M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6ZM17 12h1',
  share: 'M12 16V3m-5 5 5-5 5 5M5 13H3v8h18v-8h-2',
  export: 'M12 3v13m-5-5 5 5 5-5M3 16v5h18v-5',
  explode: 'm12 3 8 5v8l-8 5-8-5V8l8-5Zm-8 5 8 5 8-5m-8 5v8',
  picker: 'm14 3 7 7m-5-5 3-3 3 3-3 3M15 6 4 17v3h3L18 9',
};
</script>

<template>
  <div class="segment-result-tools">
    <div v-if="explosionOpen" class="explosion-popover tool-surface">
      <label>{{ tr("爆炸查看") }}<input :value="seg.explosion" type="range" min="0" max="1" step="0.01" :disabled="!editable" @input="seg.setUi('explosion', Number(($event.target as HTMLInputElement).value))"></label>
      <button type="button" :disabled="!editable" @click="seg.setUi('explosion', 0)">{{ tr("复位") }}</button>
      <button type="button" :aria-label="tr('关闭爆炸查看')" @click="explosionOpen = false">×</button>
    </div>
    <div v-if="painting && seg.resultEditing" class="segment-brush-tools tool-surface" role="toolbar" :aria-label="tr('笔刷精修工具栏')">
      <button type="button" class="icon-button add-part" :class="{ active: seg.newBrushPart }" :aria-pressed="seg.newBrushPart" :disabled="!editable" :aria-label="tr('新建笔刷部件')" :title="tr('新建部件，涂抹后添加到部件清单')" @click="seg.addBrushPart">+</button>
      <i class="divider" />
      <button type="button" class="icon-button" :class="{ active: seg.meshTool === 'picker' }" :aria-pressed="seg.meshTool === 'picker'" :disabled="!editable" :aria-label="tr('取色器')" :title="tr('点击模型取色，选择对应部件')" @click="seg.setMeshTool(seg.meshTool === 'picker' ? 'brush' : 'picker')"><svg viewBox="0 0 24 24"><path :d="icons.picker" /></svg></button>
      <div class="palette-control">
        <button type="button" class="swatch-button" :disabled="!editable" :aria-label="tr('选择笔刷部件颜色')" :aria-expanded="paletteOpen" :title="tr('选择目标部件颜色')" @click="paletteOpen = !paletteOpen"><span :style="{ background: seg.brushColor }" /><small>⌄</small></button>
        <div v-if="paletteOpen" class="part-palette tool-surface" role="group" :aria-label="tr('部件颜色')" @keydown.esc="paletteOpen = false">
          <button v-for="group in seg.plan?.groups" :key="group.id" type="button" :aria-label="tr(`使用${group.name}的颜色`)" :title="tr(group.name)" :aria-pressed="!seg.newBrushPart && seg.brushGroup === group.id" :class="{ chosen: !seg.newBrushPart && seg.brushGroup === group.id }" :disabled="!editable" @click="seg.chooseBrushGroup(group.id); paletteOpen = false"><span :style="{ background: group.color }" /></button>
        </div>
      </div>
      <i class="divider" />
      <label class="brush-size">Size<input :value="seg.meshRadius" :aria-label="tr('笔刷大小')" type="range" min="1" max="100" :disabled="!editable" @input="seg.setMeshRadius(Number(($event.target as HTMLInputElement).value))"></label>
      <input class="size-number" :value="seg.meshRadius" :aria-label="tr('笔刷大小数值')" type="number" min="1" max="100" :disabled="!editable" @change="seg.setMeshRadius(Number(($event.target as HTMLInputElement).value))">
      <i class="divider" />
      <button type="button" class="icon-button" :aria-label="tr('关闭笔刷精修')" :disabled="seg.locked" @click="seg.setMeshTool('select')">×</button>
    </div>
    <div class="segment-edit-tools tool-surface" role="toolbar" :aria-label="tr('拆分结果编辑工具栏')">
      <button type="button" class="icon-button" :aria-label="tr('撤销拆分编辑')" :title="tr('撤销（⌘ / Ctrl + Z）')" :disabled="seg.locked || !seg.canUndo" @click="seg.undo"><svg viewBox="0 0 24 24"><path :d="icons.undo" /></svg></button>
      <button type="button" class="icon-button" :aria-label="tr('重做拆分编辑')" :title="tr('重做（⌘ / Ctrl + Shift + Z）')" :disabled="seg.locked || !seg.canRedo" @click="seg.redo"><svg viewBox="0 0 24 24"><path :d="icons.redo" /></svg></button>
      <i class="divider" />
      <button type="button" class="icon-button" :class="{ active: painting }" :aria-pressed="painting" :disabled="!editable" :aria-label="tr('笔刷精修')" :title="tr('笔刷精修')" @click="seg.setMeshTool(painting ? 'select' : 'brush')"><svg viewBox="0 0 24 24"><path :d="icons.brush" /></svg></button>
      <button type="button" :disabled="!editable || seg.selectedGroups.length < 2" :title="tr(seg.selectedGroups.length < 2 ? '在模型上连续点击，选择至少两个部件' : `合并 ${seg.selectedGroups.length} 个部件`)" @click="seg.merge"><svg viewBox="0 0 24 24"><path :d="icons.merge" /></svg>Merge</button>
      <button type="button" class="icon-button" :class="{ active: explosionOpen }" :disabled="!editable" :aria-expanded="explosionOpen" :aria-label="tr('爆炸查看')" :title="tr('爆炸查看')" @click="explosionOpen = !explosionOpen"><svg viewBox="0 0 24 24"><path :d="icons.explode" /></svg></button>
      <i class="divider" />
      <button type="button" class="primary-action" :disabled="seg.locked || !seg.resultEditing || seg.confirmed" :title="tr(seg.confirmed ? '当前结果已保存确认' : '保存并确认当前拆分结果')" @click="seg.confirmResult"><svg viewBox="0 0 24 24"><path :d="icons.save" /></svg>{{ tr(seg.confirmed ? 'Saved' : 'Save') }}</button>
      <button type="button" :disabled="seg.locked || !seg.confirmed" :title="tr(outputTitle)" @click="seg.forward('print')"><svg viewBox="0 0 24 24"><path :d="icons.print" /></svg>3D Print</button>
      <button type="button" disabled :title="tr('分享服务暂未接入')"><svg viewBox="0 0 24 24"><path :d="icons.share" /></svg>Share</button>
      <button type="button" class="primary-action" :disabled="seg.locked || !seg.confirmed" :title="tr(outputTitle ?? '导出当前拆分结果 GLB')" @click="seg.exportResult"><svg viewBox="0 0 24 24"><path :d="icons.export" /></svg>Export</button>
    </div>
    <span class="tool-hint">{{ tr(painting ? seg.meshTool === 'picker' ? '点击模型吸取部件颜色' : '左键涂抹 · 右键旋转 · 滚轮缩放' : seg.selectedGroups.length ? `已选 ${seg.selectedGroups.length} 个部件 · 点击空白取消选择` : '点击部件多选 · 拖动旋转 · 滚轮缩放') }}</span>
  </div>
</template>

<style scoped>
.segment-result-tools{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:9px;width:max-content;max-width:calc(100% - 24px);z-index:3}
.tool-surface{border:1px solid #ffffff15;background:#292a30f5;border-radius:14px;box-shadow:0 8px 24px #0004;color:#dbdce5}
.segment-edit-tools,.segment-brush-tools{display:flex;align-items:center;justify-content:center;gap:5px;padding:7px;max-width:100%;box-sizing:border-box}.segment-edit-tools{flex-wrap:wrap}.segment-brush-tools{padding:7px 10px;gap:8px}
.segment-result-tools button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:8px;background:transparent;color:#dedee7;font-family:inherit;font-size:12px;font-weight:500;line-height:1.2;white-space:nowrap;padding:9px 10px;min-height:34px;cursor:pointer}
.segment-result-tools button:not(:disabled):hover{background:#ffffff10}.segment-result-tools button:disabled{opacity:.3;cursor:not-allowed}.segment-result-tools button.active{background:#9b7bff22;color:#c6afff}.segment-result-tools .icon-button{width:34px;padding:8px;flex:none}.segment-result-tools .add-part{font-size:23px;font-weight:300}.segment-result-tools .primary-action{background:#7950f2;color:white;border-radius:20px;padding:9px 14px}.segment-result-tools .primary-action:not(:disabled):hover{background:#8b65fa}
svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none}.divider{width:1px;height:20px;background:#ffffff15;flex:none;margin:0 3px}.tool-hint{font-size:10px;color:#8f93a1;white-space:nowrap;pointer-events:none}
.palette-control{position:relative}.segment-result-tools .swatch-button{padding:4px 6px;gap:7px}.swatch-button span,.part-palette span{width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 1px #ffffff30}.swatch-button small{color:#9b9ca9}.part-palette{position:absolute;bottom:46px;left:50%;transform:translateX(-50%);display:grid;grid-template-columns:repeat(4,34px);gap:5px;padding:9px}.part-palette button{padding:5px;min-height:34px}.part-palette button.chosen{outline:1px solid #c2aaff;background:#9b7bff25}
.brush-size{display:flex;gap:12px;align-items:center;font-size:11px;color:#c3c3ce}.segment-result-tools input[type=range]{width:100px;accent-color:#a18aff}.size-number{width:42px;padding:5px 3px;border:1px solid #ffffff14;border-radius:6px;background:#17181c;color:#e4e3ec;text-align:center;font:inherit;font-size:11px;appearance:textfield}.size-number::-webkit-inner-spin-button{appearance:none}.explosion-popover{display:flex;align-items:center;gap:9px;padding:9px 12px}.explosion-popover label{display:flex;align-items:center;gap:10px;font-size:11px}.explosion-popover button{font-size:11px;padding:5px}.segment-result-tools :focus-visible{outline:2px solid #c0a4ff;outline-offset:2px}
@media(max-width:1100px){.segment-edit-tools{gap:2px}.segment-result-tools button{padding:8px}.segment-result-tools .primary-action{padding:9px 11px}}
</style>
