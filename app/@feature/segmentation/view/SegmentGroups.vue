<script setup lang="ts">
import type { SegmentationController } from '../use-segmentation';
defineProps<{ seg: SegmentationController }>();
const eventValue = (event: Event) => (event.target as HTMLInputElement).value;
</script>

<template>
  <div v-if="seg.plan" class="segment-groups">
    <div class="part-list">
      <div v-for="group in seg.plan.groups" :key="group.id" class="part-row" :class="{ selected: seg.selectedGroups.includes(group.id), hidden: seg.hidden.includes(group.id) }">
        <button type="button" class="part-select" :aria-label="`选择${group.name}`" :aria-pressed="seg.selectedGroups.includes(group.id)" :disabled="seg.locked || seg.stale" @click="seg.selectGroup(group.id, !seg.editing || $event.shiftKey || $event.metaKey || $event.ctrlKey)"><i :style="{ background: group.color }" /></button>
        <div class="part-body"><input :value="group.name" :aria-label="`部件 ${group.id + 1} 名称`" :disabled="seg.locked" maxlength="60" @change="seg.rename(group.id, eventValue($event))"></div>
        <button type="button" class="part-visibility" :disabled="seg.locked" :aria-label="`${seg.hidden.includes(group.id) ? '显示' : '隐藏'}${group.name}`" @click="seg.toggleHidden(group.id)">{{ seg.hidden.includes(group.id) ? '○' : '◉' }}</button>
      </div>
    </div>
    <div class="list-actions"><button type="button" :disabled="seg.locked || seg.selectedGroups.length < 2" @click="seg.merge">合并所选</button><button type="button" :disabled="seg.locked || seg.selectedGroups.length !== 1" @click="seg.toggleSolo(seg.selectedGroups[0]!)">{{ seg.solo === null ? '单独查看' : '显示全部' }}</button><button v-if="seg.hidden.length" type="button" :disabled="seg.locked" @click="seg.setUi('hidden', []); seg.setUi('solo', null)">显示全部</button></div>
    <template v-if="seg.editing">
      <div class="assignment">
        <div class="selection-count">已选 {{ seg.selectedPixels.length.toLocaleString() }} 像素<button type="button" :disabled="seg.locked" @click="seg.pickPixels([], 'replace')">清空</button></div>
        <label class="field-label">分配到<select :value="seg.targetGroup" :disabled="seg.locked" @change="seg.setUi('targetGroup', Number(eventValue($event)))"><option v-for="group in seg.plan.groups" :key="group.id" :value="group.id">{{ group.name }}</option></select></label>
        <button class="assign-button" type="button" :disabled="!seg.selectedPixels.length || seg.locked" @click="seg.assign(false)">分配至所选部件</button>
        <div class="new-part"><input :value="seg.newName" :disabled="seg.locked" placeholder="新部件名称" maxlength="60" aria-label="新部件名称" @input="seg.setUi('newName', eventValue($event))"><button type="button" :disabled="!seg.selectedPixels.length || seg.locked" @click="seg.assign(true)">新建并分配</button></div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.segment-groups{font-size:11px;color:#dedee5}.segment-groups button{cursor:pointer}.segment-groups button:disabled{opacity:.35;cursor:not-allowed}.segment-groups button:focus-visible,.segment-groups input:focus-visible,.segment-groups select:focus-visible{outline:2px solid #f7d75a;outline-offset:2px}
.segment-groups input,.segment-groups select{background:#191a20;border:1px solid #ffffff14;color:#dfdfe7;border-radius:6px;padding:8px 9px;font-size:11px;max-width:100%;box-sizing:border-box}
.part-list{display:flex;flex-direction:column;gap:6px;margin:12px 0}.part-row{display:flex;align-items:center;background:#24252b;border:1px solid #ffffff0a;border-radius:7px;padding:4px 6px;gap:4px}.part-row.selected{border-color:#f6ce5777;background:#f6ce5709}.part-row.hidden{opacity:.45}.part-select{border:0;background:none;padding:6px}.part-select i{display:block;width:16px;height:16px;border-radius:50%}.part-body{flex:1;min-width:0}.part-body input{width:100%;background:transparent;border-color:transparent;padding:2px}.part-body input:focus{border-color:#ffffff40}.part-body small{font-size:9px;display:block;color:#878a96;padding:3px}.part-visibility{border:0;background:transparent;color:#9ca0ac;font-size:15px;padding:3px}
.list-actions{display:flex;gap:8px;justify-content:space-between;margin:8px 0 15px}.list-actions button,.selection-count button{font-size:10px;background:transparent;border:0;color:#c1c3cd;padding:5px 0}.assignment{border-top:1px solid #ffffff10;padding-top:4px}.selection-count{display:flex;justify-content:space-between;align-items:center;color:#ebca70;margin:12px 0}.field-label{display:flex;gap:10px;align-items:center;font-size:10px;margin:10px 0}.field-label select{flex:1;min-width:0}.assign-button{width:100%;border-radius:7px;min-height:34px;padding:7px 10px;font-size:11px;font-weight:600;border:1px solid #ffffff1a;background:#ffffff08;color:#d9dbe5}.new-part{display:flex;gap:6px;margin:12px 0}.new-part input{min-width:0;flex:1}.new-part button{flex:none;border:1px solid #ffffff18;background:#ffffff08;color:#bbbfc9;border-radius:6px;font-size:10px;padding:0 8px}
</style>
