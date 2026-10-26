<script setup lang="ts">
import { computed } from 'vue';
import { useWorkspace } from '~/@feature/workspace';
import { materialHex } from '~/@feature/materials';
import { slicers, type Slicer, type PrepTask } from '../print-preparation';

const props = defineProps<{ ownedIds: string[] }>();
const studio = useWorkspace();
const prep = computed(() => studio.preparation);
const completed = computed(() => studio.printTasks.filter(studio.printTaskDone).length);
const owned = computed(() => studio.currentColorResult.used.filter(m => props.ownedIds.includes(m.id)).length);
const titles = { check: '可打印性检查', color: '颜色设置' };
const colorNames = { 'not-started': '未开始', progress: '进行中', ready: '已就绪', review: '待复核' };
const colorHelp = {
  'not-started': '前往 Multi-color 分色，并为每个打印区域分配耗材。',
  progress: '继续编辑分色草稿，完成后确认并返回。',
  ready: '分色结果和耗材分配已确认。',
  review: '分色或耗材映射已变更，请在 Multi-color 重新确认。',
};
const colorActions = { 'not-started': '设置颜色', progress: '继续设置', ready: '在 Multi-color 中编辑', review: '在 Multi-color 中复核' };
const hasIssues = computed(() => { const c = studio.printMeshCheck; return c.boundary + c.nonManifold + c.degenerate + c.winding + c.duplicates > 0; });
const axes = [{ key: 'width', label: 'W', name: '宽度' }, { key: 'depth', label: 'D', name: '深度' }, { key: 'height', label: 'H', name: '高度' }] as const;
const pending = computed(() => studio.busy || studio.prepSaving || !studio.content);
function toggleTask(task: PrepTask) { prep.value.expanded = prep.value.expanded === task ? '' : task; }
function changeSize(axis: 'width' | 'depth' | 'height', event: Event) {
  const input = event.target as HTMLInputElement;
  studio.setPrintDimension(axis, Number(input.value));
  input.value = String(Number(studio.printDimensions[axis].toFixed(2)));
}
</script>

<template>
  <section id="print-preparation-panel" class="studio-left-panel prep-panel" aria-label="打印准备">
    <h1 class="prep-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 12h10M12 7v10" /></svg>打印准备</h1>
    <div class="prep-scroll">
      <div class="prep-choice">
        <label class="prep-label" for="prep-slicer">切片器</label>
        <select id="prep-slicer" :value="prep.slicer" :disabled="pending" @change="studio.changePrintSlicer(($event.target as HTMLSelectElement).value as Slicer)"><option v-for="slicer in slicers" :key="slicer">{{ slicer }}</option></select>
        <span class="prep-label mode-label">打印模式</span>
        <div class="prep-modes"><button type="button" :disabled="pending" :class="{ active: prep.mode === 'single' }" :aria-pressed="prep.mode === 'single'" @click="studio.changePrintMode('single')">单色打印</button><button type="button" :disabled="pending" :class="{ active: prep.mode === 'multi' }" :aria-pressed="prep.mode === 'multi'" @click="studio.changePrintMode('multi')">多色打印</button></div>
        <section class="prep-size-settings" aria-label="模型尺寸">
          <p class="prep-size-label">尺寸 <span>mm</span></p>
          <div class="prep-dimensions"><label v-for="axis in axes" :key="axis.key"><span>{{ axis.label }}</span><input :aria-label="`${axis.name}（mm）`" type="number" min="0.0001" step="any" :value="Number(studio.printDimensions[axis.key].toFixed(2))" :disabled="pending" @change="changeSize(axis.key, $event)"></label></div>
          <div class="prep-size-confirm"><span>⌁ 等比例锁定</span><button type="button" :disabled="pending" :class="{ confirmed: studio.printSizeReady }" @click="studio.confirmPrintSize">{{ studio.printSizeReady ? '✓ 已确认' : '确认尺寸' }}</button></div>
          <p class="prep-help muted">修改尺寸后需重新确认并复核可打印性。高度范围：10–320 mm。</p>
        </section>
      </div>
      <div class="prep-check-title"><strong>打印清单</strong><span>{{ completed }}/{{ studio.printTasks.length }} 已完成</span></div>
      <div class="prep-progress" role="progressbar" aria-label="打印清单完成进度" :aria-valuenow="completed" :aria-valuemax="studio.printTasks.length" :aria-valuemin="0"><i :style="{ width: `${completed / studio.printTasks.length * 100}%` }" /></div>
      <section v-for="task in studio.printTasks" :key="task" class="prep-task" :class="{ open: prep.expanded === task, done: studio.printTaskDone(task) }">
        <button type="button" class="prep-task-head" :disabled="pending" :aria-expanded="prep.expanded === task" :aria-controls="`prep-${task}-body`" @click="toggleTask(task)"><i class="prep-dot">{{ studio.printTaskDone(task) ? '✓' : '' }}</i><strong>{{ titles[task] }}</strong><em>{{ task === 'color' ? colorNames[studio.printColorState] : !studio.printSizeReady ? '待确认尺寸' : studio.printCheckReady ? '已复核' : '待复核' }}</em><span>{{ prep.expanded === task ? '⌃' : '⌄' }}</span></button>
        <div v-if="prep.expanded === task" :id="`prep-${task}-body`" class="prep-task-body">
          <template v-if="task === 'check'">
            <p v-if="!studio.printSizeReady" class="prep-help warning">请先在上方确认尺寸，再复核当前尺寸下的检测结果。薄壁与自相交仍需在切片器中检查。</p>
            <template v-else>
              <div v-if="studio.printMeshCheck.available" class="prep-check-results">
                <p><span>表面闭合</span><b :class="{ warning: studio.printMeshCheck.boundary > 0 }">{{ studio.printMeshCheck.boundary ? '存在开放边界' : '边界已闭合' }}</b></p>
                <p><span>开放边</span><b :class="{ warning: studio.printMeshCheck.boundary > 0 }">{{ studio.printMeshCheck.boundary }}</b></p>
                <p><span>非流形边</span><b :class="{ warning: studio.printMeshCheck.nonManifold > 0 }">{{ studio.printMeshCheck.nonManifold }}</b></p>
                <p><span>退化 / 重复面</span><b :class="{ warning: studio.printMeshCheck.degenerate + studio.printMeshCheck.duplicates > 0 }">{{ studio.printMeshCheck.degenerate }} / {{ studio.printMeshCheck.duplicates }}</b></p>
                <p><span>朝向不一致的边</span><b :class="{ warning: studio.printMeshCheck.winding > 0 }">{{ studio.printMeshCheck.winding }}</b></p>
                <p><span>薄壁 / 自相交</span><b class="muted">未检测</b></p>
              </div>
              <p v-else class="prep-help warning">无法检测当前模型，请重新导入有效模型。</p>
              <p class="prep-help">{{ hasIssues ? '检测到网格问题，请在切片器中修复后再打印。' : '基础网格检查已完成。' }}薄壁、自相交和设备适配仍需在切片器中检查。</p>
              <p class="prep-help muted">自动修复暂未接入；当前操作仅确认已阅读检测结果。</p>
            </template>
            <button type="button" class="prep-primary" :class="{ secondary: studio.printCheckReady }" :disabled="pending || !studio.printSizeReady || !studio.printMeshCheck.available" @click="studio.acknowledgePrintCheck">{{ !studio.printSizeReady ? '请先确认尺寸' : studio.printCheckReady ? '已复核检测结果' : hasIssues ? '知悉问题，继续准备' : '确认检测结果' }}</button>
          </template>
          <template v-else>
            <div v-if="studio.currentColorResult.used.length && studio.printColorState !== 'not-started'" class="prep-color-summary">
              <div class="prep-color-summary-title"><span>方案耗材</span><strong>{{ studio.currentColorResult.used.length }} 种使用中</strong></div>
              <div class="prep-swatches" aria-label="实际使用耗材"><i v-for="material in studio.currentColorResult.used" :key="material.id" :style="{ background: materialHex(material) }" :title="`${material.name} · ${props.ownedIds.includes(material.id) ? '已拥有' : '未拥有'}`" /></div>
              <div class="prep-owned">{{ owned }} 已拥有 <span>·</span><span :class="{ warning: owned < studio.currentColorResult.used.length }">{{ studio.currentColorResult.used.length - owned }} 未拥有</span></div>
            </div>
            <p class="prep-help" :class="{ warning: studio.printColorState === 'review' }">{{ colorHelp[studio.printColorState] }}</p>
            <p v-if="studio.printColorState !== 'not-started'" class="prep-help muted">未拥有耗材仅作提醒，不影响完成与导出。</p>
            <button type="button" class="prep-primary" :class="{ secondary: studio.printColorState === 'ready' }" :disabled="pending" @click="studio.navigatePreparation('multi-color', true)">{{ colorActions[studio.printColorState] }} ↗</button>
          </template>
        </div>
      </section>
    </div>
    <footer class="prep-footer">
      <p v-if="studio.prepSaveError" class="prep-error" role="alert">本地保存失败：{{ studio.prepSaveError }}<button type="button" :disabled="pending" @click="studio.savePreparation">重试保存</button></p>
      <small>最后一步 · {{ prep.slicer }}</small>
      <div :title="studio.printTodo || undefined">
        <button type="button" class="prep-primary prep-download" :disabled="!!studio.printTodo" :aria-description="studio.printTodo || undefined" @click="studio.downloadPreparedModel">{{ studio.busy ? '正在处理…' : '导出模型文件' }}</button>
      </div>
      <button type="button" class="prep-primary prep-download prep-slicer-import" disabled title="一键导入暂未接入">一键导入 {{ prep.slicer }}</button>
    </footer>
  </section>
</template>

<style scoped>
.prep-panel{color:#eeeef0;padding:18px 14px 14px;gap:0;font-size:12px;background:#292a2d}
.prep-title{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600;margin:0 0 17px}.prep-title svg{width:18px;height:18px}
.prep-scroll{flex:1;min-height:0;overflow:auto;padding-right:2px}.prep-choice{padding:12px;background:#232427;border:1px solid #ffffff0a;border-radius:11px;margin-bottom:18px}
.prep-label{display:block;font-size:11px;color:#b4b5ba;margin-bottom:7px}.mode-label{margin-top:13px}
select{width:100%;height:36px;border:1px solid #ffffff15;border-radius:8px;background:#303135;color:#f1f1f2;padding:0 9px;font:inherit;outline:none}.prep-modes{display:grid;grid-template-columns:1fr 1fr;gap:5px}.prep-modes button{border:1px solid #ffffff14;border-radius:7px;height:32px;background:#303135;color:#b5b6bc;font:inherit}.prep-modes button.active{background:#ffd40019;color:#ffd400;border-color:#ffd40066}
button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.48}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #ffd400;outline-offset:2px}
.prep-check-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}.prep-check-title strong{font-size:12px;font-weight:600}.prep-check-title span{font-size:10px;color:#a7a8ae}.prep-progress{height:3px;border-radius:4px;background:#ffffff14;margin-bottom:13px;overflow:hidden}.prep-progress i{display:block;background:#ffd400;height:100%;transition:width .2s}
.prep-task{border:1px solid #ffffff12;border-radius:10px;background:#242528;margin-bottom:8px}.prep-task.open{background:#292a22;border-color:#ffd40060}.prep-task.done{border-color:#45da7d30}.prep-task-head{display:flex;align-items:center;gap:7px;padding:12px 10px;background:none;border:0;width:100%;color:inherit;text-align:left}.prep-task-head strong{flex:1;font-size:12px;font-weight:500;white-space:nowrap}.prep-task-head em{font-size:10px;font-style:normal;color:#95969d;white-space:nowrap}.prep-task-head>span{color:#999aa0}.prep-dot{display:grid;place-items:center;border:1px solid #74757b;width:15px;height:15px;border-radius:50%;font-style:normal;font-size:10px;flex:none}.done .prep-dot{background:#45da7d;border-color:#45da7d;color:#13241a}.open:not(.done) .prep-dot{border-color:#ffd400}.prep-task-body{padding:0 10px 11px}
.prep-check-results{background:#303135;border-radius:8px;padding:5px 9px;margin-bottom:9px}.prep-check-results p{display:flex;justify-content:space-between;gap:4px;align-items:center;margin:0;min-height:29px;font-size:10px}.prep-check-results b{font-weight:500;color:#b5d4bc}.prep-help{font-size:10px;line-height:1.65;color:#c3c4c9;margin:7px 0 10px}.muted{color:#92939a!important}.warning{color:#e6bc69!important}
.prep-primary{width:100%;border:1px solid transparent;border-radius:18px;background:#ffd400;color:#25210b;min-height:35px;padding:7px 8px;font-size:11px;font-weight:600}.prep-primary.secondary{background:transparent;color:#f3f3f4;border-color:#505154}.prep-primary:disabled{background:#38383a;color:#85868b;opacity:1}
.prep-size-settings{margin-top:14px;padding-top:13px;border-top:1px solid #ffffff12}.prep-size-settings>.prep-help{margin-bottom:0}.prep-size-label{font-size:11px;margin:0 0 8px}.prep-size-label span{color:#8f9095;margin-left:4px}.prep-dimensions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.prep-dimensions label{min-width:0;display:flex;gap:4px;align-items:center;background:#303135;border:1px solid #ffffff1a;border-radius:8px;padding:7px 5px}.prep-dimensions span{font-size:10px;color:#a5a6ac}.prep-dimensions input{min-width:0;width:100%;background:none;border:0;outline:none;color:#eeeeef;font-size:11px;appearance:textfield}.prep-dimensions input::-webkit-inner-spin-button{appearance:none}.prep-size-confirm{display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:5px}.prep-size-confirm span{font-size:10px;color:#a5a6ac}.prep-size-confirm button{font-size:10px;padding:6px 9px;border:0;border-radius:6px;background:#ffd400;color:#24210d}.prep-size-confirm button.confirmed{background:#45da7d19;color:#8fdfa9}
.prep-color-summary{padding:10px;background:#303135;border-radius:8px;margin-bottom:10px}.prep-color-summary-title{display:flex;justify-content:space-between;font-size:11px;color:#c4c5ca;gap:4px}.prep-color-summary-title strong{font-weight:500;color:#f0f0f1}.prep-swatches{display:flex;flex-wrap:wrap;gap:9px;margin:12px 0}.prep-swatches i{width:21px;height:21px;border-radius:50%;box-shadow:inset 0 0 0 1px #ffffff30}.prep-owned{display:flex;gap:6px;font-size:10px;color:#b6b7bc}
.prep-footer{margin-top:12px;border-top:1px solid #ffffff14;padding-top:12px;flex:none}.prep-footer small{display:block;font-size:10px;color:#a7a8ae;margin:0 0 8px 2px}.prep-download{border-radius:9px;min-height:38px}.prep-slicer-import{margin-top:8px}.prep-slicer-import:disabled{background:transparent;border-color:#505154;color:#85868b}.prep-error{font-size:10px;line-height:1.6;padding:9px;border-radius:8px;color:#f3b6ac;background:#ed847c10}.prep-error button{display:block;color:#ffd400;border:0;background:none;padding:4px 0 0;font:inherit}
@media(prefers-reduced-motion:reduce){.prep-progress i{transition:none}}
</style>
