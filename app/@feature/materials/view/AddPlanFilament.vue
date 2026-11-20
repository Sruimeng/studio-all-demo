<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue';
import { useLocale } from '~/@base/locale';
import type { MaterialRecord } from '../types';
import { materialHex } from '../supplier';
import { colorQuery, customFilament, filamentName, filamentSubtitle, filamentType, filamentTypes, searchFilaments, similarFilaments } from '../filaments';

const props = defineProps<{
  catalog: MaterialRecord[]; ownedIds: string[]; plan: MaterialRecord[]; slotCount: number;
  current: MaterialRecord | null; busy: boolean;
  add: (material: MaterialRecord) => Promise<boolean>;
}>();
const emit = defineEmits<{ close: [] }>();
const locale = useLocale();
const { t } = locale;
const step = ref<'mine' | 'new' | 'custom'>('mine');
const query = ref('');
const target = ref(props.current ? materialHex(props.current) : '#808080');
const selected = ref<MaterialRecord | null>(null);
const resultsList = useTemplateRef<HTMLDivElement>('resultsList');
const customHex = ref(target.value);
const initialMaterial = props.current ?? props.plan[0];
const customType = ref(initialMaterial ? filamentType(initialMaterial) || 'PLA' : 'PLA');
const materialTypes = [...new Set([customType.value, ...filamentTypes])];
const customName = ref('');
const submitting = ref(false);
const error = ref('');
const automaticName = computed(() => `${customType.value} ${colorQuery(customHex.value) ?? customHex.value}`);
const available = computed(() => [...new Map([...props.catalog, ...props.plan].map(material => [material.id, material])).values()]);
const mine = computed(() => searchFilaments(available.value.filter(material => props.ownedIds.includes(material.id)), query.value));
const matches = computed(() => similarFilaments(available.value, target.value, props.ownedIds).slice(0, 8));
const results = computed(() => step.value === 'mine' ? mine.value : matches.value);
const inPlan = computed(() => !!selected.value && props.plan.some(material => material.id === selected.value!.id));
const atLimit = computed(() => props.slotCount >= 12 && (step.value === 'custom' || !inPlan.value));
const valid = computed(() => step.value === 'custom' ? !!colorQuery(customHex.value) && !!customType.value : !!selected.value && (step.value === 'mine' || !!colorQuery(target.value)));
const name = (material: MaterialRecord) => filamentName(material, locale.language === 'en');
const cannotAdd = (material: MaterialRecord) => props.busy || submitting.value || props.slotCount >= 12 && !props.plan.some(item => item.id === material.id);
watch([step, query, target], () => { selected.value = null; error.value = ''; if (resultsList.value) resultsList.value.scrollTop = 0; });
function create() { step.value = 'new'; }
function back() { step.value = step.value === 'custom' ? 'new' : 'mine'; }
function customize() { customHex.value = colorQuery(target.value) ?? '#808080'; step.value = 'custom'; }
function changeTarget(value: string) { target.value = value; }
function choose(material: MaterialRecord) { selected.value = material; }
function applyMaterial(material: MaterialRecord) {
  if (cannotAdd(material)) return;
  choose(material);
  return confirm();
}
function escape() { emit('close'); }
async function confirm() {
  if (!valid.value || atLimit.value || props.busy || submitting.value) return;
  const material = step.value === 'custom' ? customFilament(customName.value.trim() || automaticName.value, customType.value, colorQuery(customHex.value)!) : selected.value!;
  submitting.value = true; error.value = '';
  try {
    if (await props.add(material)) emit('close');
    else error.value = t('Could not add filament. Try again.', '添加失败，请重试。');
  } finally { submitting.value = false; }
}
</script>

<template>
  <section class="add-plan-panel" role="dialog" :aria-label="t('Add filament', '添加耗材')" @keydown.esc.stop.prevent="escape">
    <header>
      <input v-if="step === 'mine'" v-model="query" class="add-plan-search" type="search" :disabled="submitting" :placeholder="t('Search my filaments', '搜索我的耗材')" :aria-label="t('Search my filaments', '搜索我的耗材')">
      <template v-else><button class="add-plan-back" type="button" :aria-label="t('Back', '返回')" :disabled="submitting" @click="back"><svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6" /></svg></button><strong>{{ step === 'custom' ? t('Custom filament', '自定义耗材') : t('New filament', '新建耗材') }}</strong></template>
      <button class="add-plan-close" type="button" :aria-label="t('Close', '关闭')" :disabled="submitting" @click="emit('close')"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
    </header>
    <template v-if="step !== 'custom'">
      <template v-if="step === 'new'">
        <div class="add-plan-target" role="group" :aria-label="t('Target color', '目标颜色')">
          <span>{{ t('Target color', '目标颜色') }}</span><span class="add-plan-target-inputs"><input type="color" :value="colorQuery(target) ?? '#808080'" :aria-label="t('Choose target color', '选择目标颜色')" @input="changeTarget(($event.target as HTMLInputElement).value.toUpperCase())"><input :value="target" type="text" maxlength="7" spellcheck="false" :aria-label="t('Target HEX', '目标色值')" :aria-invalid="!colorQuery(target)" @input="changeTarget(($event.target as HTMLInputElement).value)"></span>
        </div>
      </template>
      <div>
        <div class="add-plan-list-label">{{ step === 'mine' ? t('My filaments', '我的耗材') : t('Similar filaments', '相近耗材') }}</div>
        <div ref="resultsList" class="add-plan-results" role="list" :aria-label="step === 'mine' ? t('My filaments', '我的耗材') : t('Similar filaments', '相近耗材')">
          <div v-for="material in results" :key="material.id" class="add-plan-result" :class="{ selected: selected?.id === material.id }" role="listitem">
            <button class="add-plan-result-main" type="button" :aria-pressed="selected?.id === material.id" :disabled="submitting" :title="`${name(material)} · ${material.materialId} · ${materialHex(material)}`" @click="choose(material)">
              <i :style="{ background: materialHex(material) }" /><span class="add-plan-result-label"><b>{{ name(material) }}</b><small>{{ filamentSubtitle(material, t('Custom', '自定义')) }}</small></span>
              <span class="add-plan-result-status">
                <em v-if="plan.some(item => item.id === material.id) || ownedIds.includes(material.id)" class="filament-badges"><span v-if="plan.some(item => item.id === material.id)">{{ t('In plan', '方案内') }}</span><span v-if="ownedIds.includes(material.id)">{{ t('Owned', '已拥有') }}</span></em>
                <svg v-if="step === 'new' && selected?.id === material.id" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
              </span>
            </button>
            <button class="add-plan-inline-action" type="button" :disabled="cannotAdd(material)" :aria-label="`${step === 'mine' ? t('Add', '添加') : t('Apply', '应用')} ${name(material)}`" @click="applyMaterial(material)">{{ submitting && selected?.id === material.id ? step === 'mine' ? t('Adding…', '添加中…') : t('Applying…', '应用中…') : step === 'mine' ? t('Add', '添加') : t('Apply', '应用') }}</button>
          </div>
          <div v-if="!results.length" class="add-plan-empty">{{ step === 'new' && !colorQuery(target) ? t('Enter a valid HEX color', '请输入有效色值') : step === 'mine' && !ownedIds.length ? t('No filaments yet', '暂无耗材') : t('No matching filaments', '暂无匹配耗材') }}</div>
        </div>
      </div>
      <button class="add-plan-new" type="button" :disabled="submitting" @click="step === 'mine' ? create() : customize()"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>{{ step === 'mine' ? t('New color', '新颜色') : t('Custom filament', '自定义耗材') }}</button>
    </template>
    <form v-else class="add-plan-custom" @submit.prevent="confirm">
      <label>{{ t('Color', '颜色') }}<span class="custom-color-input"><input type="color" :value="colorQuery(customHex) ?? '#808080'" :aria-label="t('Custom color', '自定义颜色')" @input="customHex = ($event.target as HTMLInputElement).value.toUpperCase()"><input v-model="customHex" type="text" maxlength="7" :aria-invalid="!colorQuery(customHex)" spellcheck="false"></span></label>
      <label>{{ t('Material', '材质') }}<select v-model="customType"><option v-for="type in materialTypes" :key="type">{{ type }}</option></select></label>
      <label>{{ t('Name', '名称') }}<input v-model="customName" type="text" maxlength="80" :placeholder="automaticName"></label>
    </form>
    <p v-if="atLimit" role="status">{{ t('The plan supports up to 12 filaments.', '方案最多支持 12 种耗材。') }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <footer v-if="step === 'custom'"><button type="button" :disabled="submitting" @click="emit('close')">{{ t('Cancel', '取消') }}</button><button class="add-plan-confirm" type="button" :disabled="!valid || atLimit || busy || submitting" @click="confirm">{{ t('Add and use', '添加并使用') }}</button></footer>
  </section>
</template>

<style scoped>
.add-plan-panel { position: absolute; bottom: calc(100% + 12px); left: 0; width: 320px; max-width: calc(100vw - 40px); max-height: min(620px, calc(100dvh - 240px)); overflow: auto; padding: 14px; border: 1px solid #ffffff12; border-radius: 16px; background: #27282b; box-shadow: 0 14px 48px #0005; color: #ededf0; font-size: 12px; }
header, footer, .add-plan-target, .custom-color-input { display: flex; align-items: center; gap: 8px; }
header { margin-bottom: 12px; }
header strong { flex: 1; font-size: 13px; font-weight: 500; }
header .add-plan-close, header .add-plan-back { width: 28px; min-height: 28px; color: #bdbec5; }
.add-plan-close svg, .add-plan-back svg { width: 16px; }
input:not([type=color]), select { min-width: 0; height: 36px; border: 1px solid #ffffff16; border-radius: 8px; padding: 0 10px; background: #202124; color: #eee; outline: none; font-size: 12px; }
input:focus, select:focus { border-color: #9a86f5; }
input[aria-invalid=true] { border-color: #df827b; }
.add-plan-search { flex: 1; width: 100%; }
.add-plan-target { justify-content: space-between; }
.add-plan-target-inputs { display: flex; align-items: center; gap: 8px; }
.add-plan-target input[type=text] { width: 98px; }
input[type=color] { width: 30px; height: 30px; padding: 0; border: 0; border-radius: 6px; background: transparent; cursor: pointer; }
input[type=color]::-webkit-color-swatch-wrapper { padding: 0; }
input[type=color]::-webkit-color-swatch { border: 1px solid #ffffff25; border-radius: 6px; }
.add-plan-new { width: 100%; margin-top: 10px; border: 1px solid #ffffff12; border-radius: 8px; }
.add-plan-list-label { margin: 12px 0 6px; color: #92949e; font-size: 11px; }
.add-plan-results { max-height: 208px; overflow-y: auto; overscroll-behavior: contain; }
.add-plan-result { position: relative; height: 52px; border: 1px solid transparent; border-radius: 8px; }
.add-plan-result:hover { background: #ffffff05; }
.add-plan-result.selected { background: #a38aff12; border-color: #9e82f855; }
.add-plan-result-main { display: flex; width: 100%; height: 100%; gap: 10px; padding: 7px 78px 7px 7px; border-radius: 8px; text-align: left; justify-content: flex-start; }
.add-plan-result-status { position: absolute; right: 8px; display: flex; align-items: center; gap: 6px; pointer-events: none; }
.add-plan-inline-action { position: absolute; right: 7px; top: 8px; width: 60px; height: 34px; border-radius: 8px; background: #6b4bea; color: #fff; opacity: 0; pointer-events: none; }
.add-plan-inline-action:hover:enabled { background: #7d60f0; }
.add-plan-result:hover .add-plan-inline-action, .add-plan-result:focus-within .add-plan-inline-action { opacity: 1; pointer-events: auto; }
.add-plan-result:hover .add-plan-result-status, .add-plan-result:focus-within .add-plan-result-status { opacity: 0; }
.add-plan-inline-action:focus-visible { outline: 2px solid #c4b7ff; outline-offset: 2px; }
.add-plan-result .add-plan-inline-action:disabled { opacity: 0; }
.add-plan-result:hover .add-plan-inline-action:disabled, .add-plan-result:focus-within .add-plan-inline-action:disabled { opacity: .35; }
i { display: block; width: 28px; height: 28px; border-radius: 6px; box-shadow: inset 0 0 0 1px #ffffff25; flex: none; }
.add-plan-result-label { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
b, small { display: block; overflow: hidden; text-overflow: ellipsis; }
b { font-weight: 500; }
small { color: #92949e; font-size: 11px; margin-top: 3px; }
em { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex: none; font-size: 10px; font-style: normal; color: #92949e; white-space: nowrap; }
.add-plan-results svg { width: 14px; flex: none; color: #c4b7ff; }
.add-plan-empty { padding: 24px 0; text-align: center; color: #9d9fa8; }
.add-plan-custom { display: grid; gap: 14px; padding: 2px 0 6px; }
.add-plan-custom label { display: grid; gap: 7px; color: #bdbec5; }
.custom-color-input input[type=text] { flex: 1; }
p { color: #efab9d; font-size: 11px; margin: 10px 0 0; }
footer { justify-content: flex-end; margin-top: 16px; }
footer button { padding: 0 14px; border-radius: 8px; }
footer .add-plan-confirm { background: #6b4bea; color: white; }
@media (hover: none) {
  .add-plan-inline-action { opacity: 1; pointer-events: auto; }
  .add-plan-result-status { display: none; }
  .add-plan-result .add-plan-inline-action:disabled { opacity: .35; }
}
</style>
