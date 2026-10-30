<script setup lang="ts">
import { useLocale } from '~/@base/locale';
import { onBeforeUnmount, ref, watch } from 'vue';
import { useWorkspace } from '~/@feature/workspace';
import type { SegmentationController } from '../use-segmentation';
import { canonicalPrompt } from '../reference';
import SegmentGroups from './SegmentGroups.vue';
const { t, tr } = useLocale();
const props = defineProps<{ seg: SegmentationController }>();
const studio = useWorkspace();
const splitMethod = ref<'auto' | 'custom'>('custom');
const automaticDetail = ref<'coarse' | 'standard' | 'fine'>('standard');
const recognizingPrompt = ref(false);
let promptTimer: ReturnType<typeof setTimeout> | undefined;
function cancelPromptRetry() {
  clearTimeout(promptTimer); promptTimer = undefined; recognizingPrompt.value = false;
}
function retryPrompt() {
  if (recognizingPrompt.value || props.seg.locked || props.seg.editing || !props.seg.reference) return;
  recognizingPrompt.value = true;
  // Demo-only recognition feedback; reuse the preset for the current mode.
  // Keep the saved prompt intact until completion and never trigger a split.
  promptTimer = setTimeout(() => {
    promptTimer = undefined;
    props.seg.recognize(true);
    recognizingPrompt.value = false;
  }, 2000);
}
watch(() => [studio.content?.id, props.seg.mode, props.seg.reference?.id, props.seg.editing, splitMethod.value], cancelPromptRetry, { flush: 'sync' });
onBeforeUnmount(cancelPromptRetry);
const automaticDetails = [
  { id: 'coarse', name: '粗略', count: '3–6 个部件' },
  { id: 'standard', name: '标准', count: '6–15 个部件' },
  { id: 'fine', name: '精细', count: '15+ 个部件' },
] as const;
function navigatePrecision(event: KeyboardEvent, index: number) {
  const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
  if (!step && event.key !== 'Home' && event.key !== 'End') return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? automaticDetails.length - 1 : (index + step + automaticDetails.length) % automaticDetails.length;
  automaticDetail.value = automaticDetails[next]!.id;
  (event.currentTarget as HTMLButtonElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
}
const eventValue = (event: Event) => (event.target as HTMLInputElement).value;
function updatePrompt(event: Event) {
  const value = eventValue(event);
  if (value !== tr(props.seg.options.prompt)) props.seg.setOption('prompt', canonicalPrompt(props.seg.mode, value));
}
</script>

<template>
  <section id="segment-panel" class="segment-panel studio-left-panel">
    <header class="segment-heading"><span class="segment-symbol">◈</span><h1>{{ tr("模型拆分") }}</h1><span class="local-label">{{ tr("示例模式") }}</span></header>
    <div class="segment-scroll">
      <div class="segment-tabs method-tabs" role="tablist" :aria-label="tr('拆分方式')">
        <button id="segment-custom-tab" type="button" role="tab" aria-controls="segment-custom-settings" :aria-selected="splitMethod === 'custom'" :class="{ active: splitMethod === 'custom' }" :disabled="seg.locked || seg.editing" @click="splitMethod = 'custom'">{{ tr("自定义拆分") }}</button>
        <button id="segment-auto-tab" type="button" role="tab" aria-controls="segment-auto-settings" :aria-selected="splitMethod === 'auto'" :class="{ active: splitMethod === 'auto' }" :disabled="seg.locked || seg.editing" @click="splitMethod = 'auto'">{{ tr("自动拆分") }}</button>
      </div>
      <section v-if="splitMethod === 'auto'" id="segment-auto-settings" class="automatic-settings" role="tabpanel" aria-labelledby="segment-auto-tab">
        <div class="section-title"><h2>{{ tr("拆分精度") }}</h2></div>
        <div class="precision-options" role="radiogroup" :aria-label="tr('自动拆分精度')">
          <button v-for="(detail, index) in automaticDetails" :key="detail.id" class="precision-card" :class="{ selected: detail.id === automaticDetail }" type="button" role="radio" :aria-checked="detail.id === automaticDetail" :aria-label="t(`${tr(detail.name)}, ${tr(detail.count)}`, `${detail.name}，${detail.count}`)" :tabindex="detail.id === automaticDetail ? 0 : -1" :disabled="seg.locked || seg.editing" @click="automaticDetail = detail.id" @keydown="navigatePrecision($event, index)">
            <span class="precision-thumbnail" :class="detail.id" aria-hidden="true">
              <svg viewBox="0 0 80 88" fill="none">
                <ellipse cx="40" cy="81" rx="25" ry="4" fill="#111218" opacity=".35" />
                <g stroke="#20212a" stroke-width="1.3" stroke-linejoin="round">
                  <path class="robot-head" d="M31 7 44 4 52 10 51 24 36 27 29 20Z" />
                  <path class="robot-torso" d="m29 27 21-3 7 7-3 25-25 2-7-9 2-17Z" />
                  <path class="robot-arm-left" d="m24 28-9 3-5 19 9 5 9-17Z" />
                  <path class="robot-hand-left" d="m10 48 10 4-2 13-10-3Z" />
                  <path class="robot-arm-right" d="m56 28 10 4 6 18-9 5-10-17Z" />
                  <path class="robot-hand-right" d="m63 52 10-4 1 15-10 3Z" />
                  <path class="robot-hip" d="m29 55 25-2 2 10-27 3Z" />
                  <path class="robot-leg-left" d="m29 64 12-1-3 15-14 3-1-7Z" />
                  <path class="robot-leg-right" d="m43 63 13-1 3 13 5 4-18 2Z" />
                  <path class="robot-foot-left" d="m24 74 14-1 1 8-18 2-2-4Z" />
                  <path class="robot-foot-right" d="m46 74 13-1 7 6-1 4-20-1Z" />
                </g>
                <path d="m31 7 5 6 15-3M36 13v13m-7 1 8 7 20-3M37 34l-1 17 18-2" stroke="#e8ffff" stroke-opacity=".25" stroke-width="1.5" />
                <path d="m37 17 10-2" stroke="#242a3b" stroke-width="3" />
                <g v-if="detail.id === 'fine'" stroke="#232532" stroke-linejoin="round">
                  <path d="m30 35 8-2 7 6-3 9-12 2Z" fill="#eba778" />
                  <path d="m45 33 10-2-1 12-11 3Z" fill="#b7a1df" />
                  <path d="m15 33 7-2-3 9-6-1Z" fill="#8ccfbd" />
                  <path d="m62 34 6 3 2 9-7 3Z" fill="#eed471" />
                  <path d="m31 65 8-1-1 8-11 2Z" fill="#83b9d3" />
                  <path d="m45 64 10-1 2 10-10 1Z" fill="#db98b7" />
                </g>
              </svg>
            </span>
            <span class="precision-copy"><strong>{{ tr(detail.name) }}</strong><span>{{ tr(detail.count) }}</span></span>
            <span class="precision-check" aria-hidden="true"><svg v-if="detail.id === automaticDetail" viewBox="0 0 16 16" fill="none"><path d="m4 8 2.5 2.5L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
          </button>
        </div>
        <button class="segment-primary full automatic-submit" type="button" disabled :title="tr('自动拆分尚未接入')"><span aria-hidden="true">◈</span>{{ tr("开始拆分") }}</button>
      </section>
      <div v-else id="segment-custom-settings" role="tabpanel" aria-labelledby="segment-custom-tab">
        <section v-if="seg.supported" class="segment-section prompt-section">
          <div class="section-title"><h2>{{ tr("输入拆分要求") }}</h2><span>{{ tr(seg.options.prompt).length }}/600</span></div>
          <div class="segment-tabs prompt-mode-tabs" role="tablist" :aria-label="tr('拆分模式')">
            <button type="button" role="tab" :aria-selected="seg.mode === 'parts'" :class="{ active: seg.mode === 'parts' }" :disabled="seg.locked || seg.editing || !seg.supported" @click="seg.setMode('parts')">{{ tr("部件拆分") }}</button>
            <button type="button" role="tab" :aria-selected="seg.mode === 'colors'" :class="{ active: seg.mode === 'colors' }" :disabled="seg.locked || seg.editing || !seg.colorAvailable" @click="seg.setMode('colors')">{{ tr("颜色拆分") }}</button>
          </div>
          <div class="prompt-input" :aria-busy="recognizingPrompt">
            <textarea :value="recognizingPrompt ? '' : tr(seg.options.prompt)" :disabled="seg.locked || seg.editing || recognizingPrompt" rows="3" maxlength="600" :placeholder="tr(recognizingPrompt ? '' : seg.mode === 'parts' ? '描述希望拆出的部件' : '描述希望分别拆出的颜色区域')" :aria-label="tr('拆分要求')" @change="updatePrompt" />
            <span v-if="recognizingPrompt" class="prompt-loading" role="status">{{ tr("智能识别中…") }}</span>
            <button class="prompt-retry" type="button" :disabled="seg.locked || seg.editing || recognizingPrompt || !seg.reference" :aria-label="tr('重新识别拆分要求')" :title="tr('重新识别拆分要求（示例）')" @click="retryPrompt"><svg :class="{ spinning: recognizingPrompt }" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16.5 8A6.7 6.7 0 1 0 16 13M16.5 3.5V8H12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg></button>
          </div>
          <label class="preview-option"><input type="checkbox" :checked="seg.preview2d" :disabled="seg.locked || seg.editing || recognizingPrompt" @change="seg.setPreview2d(($event.target as HTMLInputElement).checked)"><span>{{ tr("2D视图预览分件方案") }}</span></label>
          <button class="segment-primary full prompt-submit" type="button" :disabled="seg.locked || seg.editing || !seg.supported || recognizingPrompt" @click="seg.split()">{{ tr(seg.busy ? '拆分中…' : '开始拆分') }}</button>
        </section>
        <section v-if="seg.plan && !seg.sourceView && seg.displayPlan" class="segment-section">
          <div class="section-title"><h2>{{ tr("部件清单") }}</h2><span>{{ tr(seg.plan.groups.length) }} {{ tr("组") }}</span></div>
          <p v-if="seg.stale" class="segment-notice">{{ tr(seg.staleReason) }}</p>
          <SegmentGroups :seg="seg" />
          <button class="segment-secondary full" type="button" :disabled="seg.locked || seg.stale || !seg.plan.mask || seg.editing || seg.plan.maskOutdated" :title="tr(seg.plan.maskOutdated ? '3D 笔刷修改尚未同步到参考图，请撤销修改或点击“开始拆分”更新方案后再编辑 2D' : undefined)" @click="seg.beginEdit">{{ tr("调整 2D 分区 →") }}</button>
          <p v-if="seg.plan.maskOutdated" class="segment-notice">{{ tr("3D 精修已更新，参考图分区尚未同步。可撤销笔刷修改后继续编辑 2D。") }}</p>
          <template v-if="!seg.editing && seg.pieces.length">
            <p class="segment-notice">{{ tr(seg.openPieces ? `${seg.openPieces} 个网格存在开放边或非流形边。` : '未发现开放边，仍需打印检查。') }}{{ tr("当前为示例表面拆分，切口平整化与封闭需算法支持。") }}</p>
            <details class="piece-details"><summary>{{ t(`Mesh details (${seg.pieces.length})`, `独立网格明细（${seg.pieces.length}）`) }}</summary><div v-for="piece in seg.pieces" :key="piece.id"><span>{{ tr(piece.name) }}</span><small>{{ tr(piece.faces.length) }} {{ tr("面 ·") }} {{ tr(piece.boundary ? `${piece.boundary} 开放边` : '无开放边') }}</small></div></details>
          </template>
          <button v-if="!seg.editing && seg.plan.mask" class="segment-link full" type="button" :disabled="seg.locked || seg.plan.maskOutdated" @click="seg.exportPlan">{{ tr("下载 2D 分区方案") }}</button>
        </section>
        <p v-if="seg.plan?.mappingDirty && !seg.editing" class="segment-notice">{{ tr(seg.splitBlocked) }}</p>
        <p v-if="seg.message" class="segment-status" role="status">{{ tr(seg.message) }}</p>
        <div v-if="seg.error || studio.prepSaveError || studio.failure" class="segment-error" role="alert">{{ tr(seg.error || studio.prepSaveError || studio.failure) }}<button v-if="studio.prepSaveError" type="button" :disabled="seg.locked" @click="seg.persist">{{ tr("重试保存") }}</button></div>
      </div>
    </div>
    <section class="source-card">
      <select class="full model-select" :value="studio.project?.id" :aria-label="tr('选择拆分模型')" :disabled="seg.locked || seg.editing" @change="seg.selectModel(eventValue($event))">
        <option v-if="studio.project && !studio.projects.some(p => p.id === studio.project?.id)" :value="studio.project.id">{{ tr(studio.project.name) }}</option>
        <option v-for="project in studio.projects" :key="project.id" :value="project.id">{{ tr(project.name) }}</option>
        <option v-if="!studio.project" value="">{{ tr("请选择模型") }}</option>
      </select>
      <details class="sample-versions"><summary>{{ tr("示例说明与版本") }}</summary><p class="muted">{{ tr("当前自动描述及分区为小鸡专用示例规则。自由语义理解、任意图识别与平整实体拆分需算法服务。两份模型是不同网格，不直接互套分区。原模型始终保留。") }}</p><button type="button" :disabled="seg.locked || seg.editing" @click="seg.sample(false)">{{ tr("带贴图小鸡 · 参考图拆分示例") }}</button><button type="button" :disabled="seg.locked || seg.editing" @click="seg.sample(true)">{{ tr("白模火鸡 · 查看另一生成版本") }}</button></details>
      <button v-if="seg.recoverable && !seg.editing" class="segment-link" type="button" :disabled="seg.locked" @click="seg.restorePrevious">{{ tr("恢复上一次生成前的方案") }}</button>
    </section>
  </section>
</template>

<style scoped>
.prompt-input{position:relative}.segment-panel .prompt-input textarea{display:block;min-height:110px;padding-bottom:40px}.prompt-loading{position:absolute;top:11px;left:10px;color:#aaa6b9;font-size:11px;pointer-events:none}.segment-panel .prompt-retry{position:absolute;right:10px;bottom:10px;display:flex;align-items:center;justify-content:center;width:26px;height:26px;padding:5px;border:1px solid #ffffff1a;border-radius:50%;background:#303139;color:#d5d4df;cursor:pointer}.segment-panel .prompt-retry:hover:not(:disabled){background:#41424d;color:#fff}.segment-panel .prompt-retry:disabled{opacity:.6}.prompt-retry svg{width:15px;height:15px}.prompt-retry .spinning{animation:prompt-retry-spin .9s linear infinite}.segment-panel .segment-primary{border-radius:999px}@keyframes prompt-retry-spin{to{transform:rotate(360deg)}}
.method-tabs{margin-bottom:18px}.automatic-settings{padding:18px 0}.precision-options{display:flex;flex-direction:column;gap:12px}.precision-card:not(:disabled){cursor:pointer}.precision-card:not(:disabled):hover{border-color:#a18aff}.precision-card{display:flex;align-items:center;gap:13px;width:100%;min-height:100px;padding:14px;border:1px solid #ffffff20;border-radius:15px;background:#ffffff02;color:#e4e4eb;text-align:left}.precision-card.selected{border:2px solid #7852ff;padding:13px;background:#7852ff12}.precision-thumbnail{display:flex;align-items:center;justify-content:center;width:68px;height:72px;flex-shrink:0;border-radius:11px;background:#ffffff08;--robot-head:#73c9d1;--robot-torso:#73c9d1;--robot-left:#d8c16a;--robot-right:#8895d9;--robot-hip:#73c9d1;--robot-leg-left:#bf83d7;--robot-leg-right:#8fcd70}.precision-thumbnail.standard{--robot-head:#ca92cf;--robot-torso:#8dc7cb;--robot-hip:#dfb66d;--robot-leg-left:#e2969e;--robot-leg-right:#88ce9d}.precision-thumbnail.fine{--robot-head:#a6c880;--robot-torso:#8dc7cb;--robot-left:#c398ca;--robot-right:#92b5e3;--robot-hip:#e1cb74;--robot-leg-left:#c296d7;--robot-leg-right:#9acb91}.precision-thumbnail svg{width:62px;height:68px}.robot-head{fill:var(--robot-head)}.robot-torso{fill:var(--robot-torso)}.robot-arm-left,.robot-hand-left{fill:var(--robot-left)}.robot-arm-right,.robot-hand-right{fill:var(--robot-right)}.robot-hip{fill:var(--robot-hip)}.robot-leg-left,.robot-foot-left{fill:var(--robot-leg-left)}.robot-leg-right,.robot-foot-right{fill:var(--robot-leg-right)}.precision-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}.precision-copy strong{font-size:14px;font-weight:600}.precision-copy>span{font-size:12px;color:#92939e}.precision-check{display:flex;align-items:center;justify-content:center;width:20px;height:20px;flex-shrink:0;border:1.5px solid #7d808a;border-radius:50%;box-sizing:border-box}.selected .precision-check{background:#f1f1f5;border-color:#f1f1f5;color:#333348}.precision-check svg{width:14px;height:14px}.segment-panel .automatic-submit:disabled{opacity:1;background:#f7d75a;color:#1c1a12}.segment-panel .automatic-submit{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:18px;min-height:40px;border-radius:20px;font-size:13px}
.prompt-mode-tabs{margin-bottom:12px}.prompt-submit{margin-top:12px}.preview-option{display:flex;align-items:center;gap:8px;margin-top:13px;color:#c5c6cf;font-size:11px;cursor:pointer}.preview-option input{width:14px;height:14px;margin:0;accent-color:#f7d75a;cursor:pointer}
.segment-panel{font-size:12px;color:#dedee5;display:flex;flex-direction:column;min-height:0;position:relative}.segment-heading{display:flex;align-items:center;gap:8px;padding:20px 20px 16px;flex:none}.segment-heading h1{font-size:15px;font-weight:600;margin:0}.segment-symbol{font-size:19px;color:#f4d267}.local-label{font-size:9px;color:#beb49b;background:#d2b66c13;border:1px solid #b9a16b27;padding:3px 5px;border-radius:5px;margin-left:auto}.segment-scroll{overflow:auto;min-height:0;flex:1;padding:0 18px 16px}.segment-tabs{display:flex;border:1px solid #ffffff12;background:#18191e;border-radius:8px;padding:3px;gap:3px}.segment-tabs button{flex:1;background:none;border:0;color:#92939c;padding:8px 3px;border-radius:5px;font-size:11px;cursor:pointer}.segment-tabs button.active{color:#eeeef2;background:#383940}.segment-section{padding:17px 0;border-bottom:1px solid #ffffff10}.section-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:7px}.section-title h2{font-size:12px;font-weight:600;margin:0}.section-title>span{font-size:10px;color:#898b95}.muted{font-size:10px;color:#8e909b;line-height:1.65;margin:9px 0}.sample-versions{font-size:10px;color:#aeb0ba;margin-top:10px}.sample-versions summary{cursor:pointer}.sample-versions button{display:block;background:transparent;border:0;text-align:left;font-size:10px;color:#d2d3dc;padding:9px 0;cursor:pointer}.segment-panel textarea,.segment-panel select,.segment-panel input:not([type=checkbox]):not([type=range]){background:#191a20;border:1px solid #ffffff14;color:#dfdfe7;border-radius:6px;padding:8px 9px;font-size:11px;max-width:100%;box-sizing:border-box}.segment-panel textarea{width:100%;resize:vertical;line-height:1.7;min-height:66px}.source-card{flex:none;padding:16px 18px;border-top:1px solid #ffffff10;max-height:40%;overflow:auto;box-sizing:border-box}.segment-primary,.segment-secondary{border-radius:7px;min-height:34px;padding:7px 10px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #ffffff1a}.segment-primary{background:#f7d75a;border-color:#f7d75a;color:#1c1a12}.segment-secondary{background:#ffffff08;color:#d9dbe5}.full{width:100%}.segment-link{background:none;border:0;color:#b6b8c5;padding:10px 0;font-size:10px;cursor:pointer}.part-list{display:flex;flex-direction:column;gap:6px;margin:12px 0}.part-row{display:flex;align-items:center;background:#24252b;border:1px solid #ffffff0a;border-radius:7px;padding:8px 6px;gap:4px}.part-row.selected{border-color:#f6ce5777;background:#f6ce5709}.part-row.hidden{opacity:.45}.part-select{border:0;background:none;padding:6px;cursor:pointer}.part-select i{display:block;width:16px;height:16px;border-radius:5px}.part-body{flex:1;min-width:0}.part-body input{width:100%;background:transparent!important;border-color:transparent!important;padding:2px!important}.part-body input:focus{border-color:#ffffff40!important}.part-body small{font-size:9px;display:block;color:#878a96;padding:3px}.part-visibility{border:0;background:transparent;color:#9ca0ac;cursor:pointer;font-size:15px;padding:3px}.list-actions{display:flex;gap:8px;justify-content:space-between;margin:8px 0 15px}.list-actions button{font-size:10px;background:transparent;border:0;color:#c1c3cd;padding:5px 0;cursor:pointer}.segment-notice{font-size:10px;color:#dfc18b;background:#d4b16d09;border:1px solid #d4b16d24;border-radius:6px;line-height:1.65;padding:9px;margin:10px 0}.selection-count{display:flex;justify-content:space-between;font-size:11px;color:#ebca70;margin:14px 0}.selection-count button{background:none;border:0;color:#9396a2;font-size:10px;cursor:pointer}.field-label{display:flex;gap:10px;align-items:center;font-size:10px;margin:10px 0}.field-label select{flex:1;min-width:0}.new-part{display:flex;gap:6px;margin:12px 0}.new-part input{min-width:0;flex:1}.new-part button{flex:none;border:1px solid #ffffff18;background:#ffffff08;color:#bbbfc9;border-radius:6px;font-size:10px;padding:0 8px;cursor:pointer}.piece-details{font-size:10px;color:#9c9fab;margin:13px 0}.piece-details summary{cursor:pointer}.piece-details>div{padding:8px;border-bottom:1px solid #ffffff0b;display:flex;flex-direction:column;gap:4px}.piece-details small{font-size:9px;color:#7c7f8b}.segment-status{font-size:10px;line-height:1.6;color:#a4b6a9;margin:14px 0}.segment-error{font-size:11px;line-height:1.6;color:#eea89b;border:1px solid #e89c8d40;border-radius:6px;padding:10px;margin:12px 0}.segment-error button{background:none;color:inherit;border:0;text-decoration:underline;padding:8px}.segment-panel button:disabled{opacity:.35;cursor:not-allowed}.segment-panel button:focus-visible,.segment-panel summary:focus-visible{outline:2px solid #f7d75a;outline-offset:2px}
.source-color{display:inline-block;width:9px;height:9px;margin-left:6px;border:1px solid #fff3;border-radius:50%;vertical-align:middle}</style>
