<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { useLocale } from '~/@base/locale';
import { useWorkspace } from '~/@feature/workspace';

const { t } = useLocale();
const studio = useWorkspace();
// This Figma prototype is deliberately local: it never repairs the mesh or
// records a real printability confirmation. Remounting starts a fresh preview.
const printability = ref<'issues' | 'fixing' | 'ready'>('issues');
let repairTimer: ReturnType<typeof setTimeout> | undefined;
function autoFix() {
  if (printability.value !== 'issues') return;
  printability.value = 'fixing';
  repairTimer = setTimeout(() => { printability.value = 'ready'; repairTimer = undefined; }, 3000);
}
const axes = [
  { key: 'width', label: 'W', en: 'Width', zh: '宽度' },
  { key: 'depth', label: 'D', en: 'Depth', zh: '深度' },
  { key: 'height', label: 'H', en: 'Height', zh: '高度' },
] as const;
// Values follow the three requested design states, including their ready labels.
const metrics = computed(() => [
  { label: t('Thin Walls', '薄壁'), value: printability.value === 'ready' ? t('Yes', '是') : t('7.6% below 2 mm', '7.6% 低于 2 mm') },
  { label: t('Watertight', '水密性'), value: printability.value === 'ready' ? '0' : t('No', '否') },
  { label: t('Holes', '孔洞'), value: printability.value === 'ready' ? '0' : '2' },
  { label: t('Non-manifold Edges', '非流形边'), value: printability.value === 'ready' ? '0' : '7' },
]);
const slicerOptions = [
  { name: 'Bambu Studio', icon: 'bambu' }, { name: 'Creality Print', icon: 'creality' },
  { name: 'OrcaSlicer', icon: 'orca' }, { name: 'Anycubic Slicer', icon: 'anycubic' },
  { name: 'Lychee Slicer', icon: 'lychee' }, { name: 'Blueprint Studio', icon: 'blueprint' },
  { name: 'ElegooSlicer', icon: 'elegoo' },
];
const slicer = computed(() => slicerOptions.find(option => option.name === studio.preparation.slicer || (option.icon === 'anycubic' && studio.preparation.slicer === 'Anycubic')) ?? slicerOptions[0]!);
const slicerOpen = ref(false), slicerTrigger = useTemplateRef<HTMLButtonElement>('slicerTrigger'), slicerList = useTemplateRef<HTMLDivElement>('slicerList');
const slicerPosition = ref({ left: '0px', top: '0px', maxHeight: '310px' });
function positionSlicers() {
  if (!slicerOpen.value || !slicerTrigger.value) return;
  const rect = slicerTrigger.value.getBoundingClientRect(), panel = slicerTrigger.value.closest('section.prep-panel')!.getBoundingClientRect();
  const width = 224, menuHeight = Math.min(310, window.innerHeight - 24);
  const right = panel.right + 8;
  const left = right + width <= window.innerWidth - 12 ? right : Math.max(12, panel.left - width - 8);
  slicerPosition.value = { left: `${left}px`, top: `${Math.max(12, Math.min(rect.top - 4, window.innerHeight - menuHeight - 12))}px`, maxHeight: `${menuHeight}px` };
}
async function toggleSlicers() {
  slicerOpen.value = !slicerOpen.value; positionSlicers();
  if (slicerOpen.value) { await nextTick(); slicerList.value?.focus({ preventScroll: true }); }
}
function dismissSlicers(event: PointerEvent) {
  if (!slicerOpen.value) return;
  const target = event.target as Node;
  if (!slicerTrigger.value?.contains(target) && !slicerList.value?.contains(target)) slicerOpen.value = false;
}
function escapeSlicers(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !slicerOpen.value) return;
  event.stopPropagation(); slicerOpen.value = false; slicerTrigger.value?.focus();
}
onMounted(() => {
  window.addEventListener('pointerdown', dismissSlicers);
  window.addEventListener('resize', positionSlicers);
  window.addEventListener('scroll', positionSlicers, true);
});
onBeforeUnmount(() => {
  clearTimeout(repairTimer);
  window.removeEventListener('pointerdown', dismissSlicers);
  window.removeEventListener('resize', positionSlicers);
  window.removeEventListener('scroll', positionSlicers, true);
});
</script>

<template>
  <section id="print-preparation-panel" class="studio-left-panel prep-panel" :aria-label="t('Print Preparation', '打印准备')" @keydown.esc="escapeSlicers">
    <h1 class="prep-title"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18M6 3v16H3v3h18v-3h-3V3M9 4v4h6V4M12 8v3M6 19h12" /><path d="m12 12 3 1.5v3L12 18l-3-1.5v-3Zm0 3v3m-3-4.5 3 1.5 3-1.5" /></svg>{{ t('Print Preparation', '打印准备') }}</h1>
    <div class="prep-scroll">
      <section class="prep-size-settings" :aria-label="t('Model size', '模型尺寸')">
        <div class="prep-label-row"><h2 class="prep-label">{{ t('Size', '尺寸') }}</h2><div class="prep-units" :aria-label="t('Units: millimetres', '单位：毫米')"><span class="active">mm</span><span>cm</span><span>inch</span></div></div>
        <div class="prep-dimensions">
          <template v-for="(axis, index) in axes" :key="axis.key"><span v-if="index" class="prep-times" aria-hidden="true">×</span><label><span>{{ axis.label }}</span><input :aria-label="`${t(axis.en, axis.zh)} (mm)`" type="text" :value="Math.round(studio.printDimensions[axis.key])" :title="`${Number(studio.printDimensions[axis.key].toFixed(2))} mm`" readonly></label></template>
        </div>
      </section>

      <section class="prep-printability" :aria-label="t('Printability', '可打印性')">
        <h2 class="prep-label">{{ t('Printability', '可打印性') }}</h2>
        <div class="prep-check-card" :class="{ ready: printability === 'ready' }" :data-state="printability" :aria-busy="printability === 'fixing'">
          <div class="prep-check-heading" role="status" aria-live="polite">
            <svg v-if="printability === 'ready'" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor" /><path d="m6 10 2.7 2.7 5-5" fill="none" stroke="#234d34" stroke-width="1.4" /></svg>
            <svg v-else viewBox="0 0 20 20" aria-hidden="true"><path d="M8.3 3.1a2 2 0 0 1 3.4 0l6.7 12A2 2 0 0 1 16.7 18H3.3a2 2 0 0 1-1.7-2.9Z" fill="currentColor" /><path d="M10 6.5v5M10 13.5v1" stroke="#484328" stroke-width="1.7" stroke-linecap="round" /></svg>
            <span>{{ printability === 'ready' ? t('Printable Ready', '已就绪，可打印') : t('A few fixes needed', '需要少量修复') }}</span>
          </div>
          <dl class="prep-check-results"><div v-for="metric in metrics" :key="metric.label"><dt>{{ metric.label }}<span class="prep-info" aria-hidden="true">?</span></dt><dd>{{ metric.value }}<svg v-if="printability === 'ready'" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg></dd></div></dl>
          <div v-if="printability !== 'ready'" class="prep-repair-slot"><button class="prep-pill prep-repair" :class="{ fixing: printability === 'fixing' }" type="button" :disabled="printability === 'fixing'" :aria-label="printability === 'fixing' ? t('Auto Fix in progress', '正在自动修复') : t('Auto Fix', '自动修复')" @click="autoFix"><span>Auto Fix</span><span class="prep-cost"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" /><path d="m10.8 3-5 8h3l-.6 6 5.9-9.1h-3.6Z" /></svg>10</span></button></div>
        </div>
      </section>

      <section class="prep-slicer-settings" :aria-label="t('Send to Slicer', '发送到切片器')">
        <div class="prep-label-row"><h2 class="prep-label">{{ t('Send to Slicer', '发送到切片器') }}</h2><div class="prep-slicer-logos" aria-hidden="true"><img v-for="option in [slicerOptions[4]!, ...slicerOptions.slice(0, 1), ...slicerOptions.slice(2, 4), slicerOptions[5]!, slicerOptions[6]!, slicerOptions[1]!]" :key="option.icon" :src="`/slicers/${option.icon}.${option.icon === 'blueprint' ? 'svg' : 'png'}`" alt=""></div></div>
        <button ref="slicerTrigger" class="prep-slicer-trigger" type="button" aria-haspopup="dialog" :aria-expanded="slicerOpen" aria-controls="prep-slicer-list" @click="toggleSlicers"><img :src="`/slicers/${slicer.icon}.png`" alt=""><span>{{ slicer.name }}</span><svg viewBox="0 0 16 16" :class="{ open: slicerOpen }" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg></button>
      </section>
    </div>
    <footer class="prep-footer">
      <button class="prep-delivery" type="button" aria-disabled="true"><svg viewBox="0 0 20 20" aria-hidden="true"><path fill="#FFB54A" d="M3 9h14v8H3ZM2 6h16v4H2Z" /><path fill="#FF725B" d="M9 6h2v11H9Z" /><path d="M10 6C3 6 4 1 7 3l3 3Zm0 0c7 0 6-5 3-3l-3 3Z" fill="none" stroke="#FFCE77" stroke-width="1.5" /></svg>{{ t('Print & Delivery', '打印配送') }}</button>
      <button class="prep-pill prep-send" type="button" aria-disabled="true"><svg class="prep-premium" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" /><path d="m5 7 2.6 2L10 5.5 12.4 9 15 7l-1.1 6H6.1Zm1.5 7h7v1h-7Z" /></svg><span>{{ t('Send to slicer', '发送到切片器') }}</span><span class="prep-cost"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" /><path d="m10.8 3-5 8h3l-.6 6 5.9-9.1h-3.6Z" /></svg>10</span></button>
    </footer>
    <Teleport to="body">
      <div v-if="slicerOpen" id="prep-slicer-list" ref="slicerList" class="prep-slicer-list" :style="slicerPosition" role="dialog" :aria-label="t('Slicer selection', '切片器选择')" tabindex="-1" @keydown.esc="escapeSlicers">
        <div v-for="option in slicerOptions" :key="option.icon" class="prep-slicer-option" :class="{ selected: slicer.icon === option.icon }"><span class="prep-slicer-app-icon"><img :src="`/slicers/${option.icon}.${option.icon === 'blueprint' ? 'svg' : 'png'}`" alt=""></span><span>{{ option.name }}</span></div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.prep-panel{padding:12px 12px 16px;gap:0;border-radius:0 20px 20px 0;background:#27282d;color:#f2f2f2;font-size:12px}
.prep-title{display:flex;align-items:center;gap:8px;margin:0 0 16px;font-size:12px;font-weight:500;line-height:20px;flex:none}
.prep-title svg{width:14px;height:16px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;flex:none}
.prep-scroll{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#515256 transparent;padding-bottom:16px}
.prep-label{margin:0;font-size:12px;line-height:20px;font-weight:400}
.prep-label-row{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:12px}
.prep-units{display:flex;align-items:center;padding:2px;border-radius:7px;background:#ffffff05;color:#999;line-height:20px}
.prep-units span{padding:0 8px;border-radius:5px}.prep-units .active{background:#ffffff08;color:#dedee1}
.prep-dimensions{display:grid;grid-template-columns:minmax(0,1fr) 8px minmax(0,1fr) 8px minmax(0,1fr);align-items:center;gap:8px}
.prep-dimensions label{display:flex;align-items:center;gap:3px;min-width:0;height:32px;padding:0 10px;border:1px solid #ffffff0a;border-radius:8px}
.prep-dimensions label:first-child{border-color:#eee}.prep-dimensions span,.prep-times{color:#999}
.prep-dimensions input{width:100%;min-width:0;border:0;outline:none;background:transparent;color:#eee;font:inherit;font-size:11px;text-overflow:ellipsis}
.prep-times{text-align:center;font-size:15px;font-weight:300}
.prep-printability{margin-top:16px}.prep-printability>.prep-label{margin-bottom:10px}
.prep-check-card{overflow:hidden;border-radius:14px;background:#ffffff0d;color:#ffdb32}
.prep-check-heading{display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;background:#ffdb321a;font-size:12px;font-weight:500}
.prep-check-heading>svg{width:14px;height:14px;flex:none}
.prep-check-results{margin:8px 12px 0}.prep-check-results>div{display:flex;align-items:center;justify-content:space-between;gap:4px;min-height:28px}
.prep-check-results dt{display:flex;align-items:center;gap:5px;color:#999;white-space:nowrap;font-size:12px}
.prep-info{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border:1px solid #68696c;border-radius:50%;color:#777;font-size:9px;line-height:1}
.prep-check-results dd{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex:none;font-size:12px;white-space:nowrap}
.prep-check-results dd svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.prep-check-card.ready{color:#40d67d}.prep-check-card.ready .prep-check-heading{background:#40d67d14}.prep-check-card.ready .prep-check-results{margin-bottom:4px}
.prep-repair-slot{padding:4px 12px 12px}.prep-pill{display:flex;justify-content:center;align-items:center;gap:7px;width:100%;height:40px;border-radius:24px;font-size:14px;font-weight:700;white-space:nowrap}
.prep-repair{--button-fill:#fff;background:var(--button-fill);color:#050505}
.prep-repair:not(:disabled):hover{background:#eee}.prep-cost{display:flex;align-items:center;gap:4px;flex:none}
.prep-repair .prep-cost{padding-left:8px;border-left:1px solid #00000018}.prep-cost svg{width:14px;height:14px;flex:none}
.prep-premium{width:16px;height:16px;flex:none}.prep-premium circle,.prep-cost circle{fill:currentColor}.prep-premium path,.prep-cost path{fill:var(--button-fill)}
.prep-repair.fixing{--button-fill:#504831;position:relative;isolation:isolate;overflow:hidden;border:1px solid #b99e4780;background:#b99e4724;color:#b7a05b;opacity:1;cursor:default}
.prep-repair.fixing::before{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(100deg,transparent,#ffdf482b,transparent);animation:prep-fix-sweep 1.5s linear infinite}
.prep-repair.fixing .prep-cost{border-left-color:#b99e4733}@keyframes prep-fix-sweep{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
.prep-slicer-settings{margin-top:16px}.prep-slicer-settings .prep-label-row{margin-bottom:10px}
.prep-slicer-logos{display:flex;align-items:center;padding-left:7px;border-left:1px solid #ffffff1a}.prep-slicer-logos img{width:16px;height:16px;margin-left:-4px;object-fit:contain}.prep-slicer-logos img:first-child{margin-left:0}
.prep-slicer-trigger{display:flex;align-items:center;gap:7px;width:100%;height:40px;padding:0 12px;border:1px solid #ffffff08;border-radius:8px;color:#eee;font-size:12px;text-align:left}
.prep-slicer-trigger:hover,.prep-slicer-trigger[aria-expanded=true]{background:#ffffff04}.prep-slicer-trigger>img{width:16px;height:16px;object-fit:contain}.prep-slicer-trigger>svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;margin-left:auto}.prep-slicer-trigger>svg.open{transform:rotate(180deg)}
.prep-footer{display:grid;gap:16px;flex:none;padding-top:12px}.prep-delivery{display:flex;align-items:center;gap:8px;width:100%;height:40px;padding:0 12px;border-radius:14px;background:#ffffff0d;color:#eee;font-size:12px;text-align:left;cursor:default}.prep-delivery svg{width:16px;height:16px;flex:none}
.prep-send{--button-fill:#ffdc00;background:var(--button-fill);color:#08090b;cursor:default}
.prep-slicer-list{position:fixed;z-index:60;width:224px;overflow-y:auto;border:1px solid #ffffff08;border-radius:12px;background:#27282d;color:#eee;box-shadow:0 8px 24px #0005;outline:none;scrollbar-width:thin}
.prep-slicer-option{display:flex;align-items:center;gap:8px;height:44px;padding:0 12px;font-size:12px}.prep-slicer-option.selected{background:#ffffff1a}.prep-slicer-option:not(.selected):hover{background:#ffffff06}
.prep-slicer-app-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:7px;background:#ffffff05;flex:none}.prep-slicer-app-icon img{width:22px;height:22px;object-fit:contain}
@media(prefers-reduced-motion:reduce){.prep-repair.fixing::before{animation:none}}
</style>
