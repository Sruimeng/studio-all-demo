<script setup lang="ts">
import { computed } from 'vue';
import { useLocale } from '~/@base/locale';
import { appearanceTemplates, bindAppearance, detachAppearance, isAppearanceSource } from '../binding';
import { materialTemplates } from '../filaments';
import { materialProblem } from '../supplier';
import type { MaterialRecord } from '../types';

const props = defineProps<{ material: MaterialRecord; materials: MaterialRecord[]; busy: boolean }>();
const emit = defineEmits<{ update: [material: MaterialRecord] }>();
const { t } = useLocale();
const librarySources = computed(() => props.materials.filter(item => item.id !== props.material.id && isAppearanceSource(item)));
const sources = computed(() => [...appearanceTemplates, ...librarySources.value]);
const source = computed(() => sources.value.find(item => item.id === props.material.appearanceBinding?.id));
function bind(id: string) {
  const value = sources.value.find(item => item.id === id);
  if (value && !materialProblem(value)) emit('update', bindAppearance(props.material, value));
}
function select(event: Event) {
  const id = (event.target as HTMLSelectElement).value;
  if (id) bind(id);
  else emit('update', detachAppearance(props.material));
}
</script>

<template>
  <section class="appearance-binding">
    <label>{{ t('Bind appearance material', '绑定外观材质') }}
      <select :value="material.appearanceBinding?.id ?? ''" :disabled="busy" aria-label="Bind appearance material" :title="t('Bind a shared appearance while keeping this color and SKU.', '绑定通用外观，保留当前颜色和 SKU。')" @change="select">
        <option value="">{{ t('Unbound · independent parameters', '未绑定 · 独立参数') }}</option>
        <option v-if="material.appearanceBinding && !source" :value="material.appearanceBinding.id" disabled>{{ material.appearanceBinding.name }} · {{ t('Source unavailable', '源材质已不在库中') }}</option>
        <optgroup :label="t('Shared appearances', '通用外观材质')"><option v-for="item in appearanceTemplates" :key="item.id" :value="item.id">{{ item.name }}</option></optgroup>
        <optgroup v-if="librarySources.length" :label="t('Other library materials', '其他库内材质')"><option v-for="item in librarySources" :key="item.id" :value="item.id" :disabled="!!materialProblem(item)">{{ item.name }} · {{ item.materialId }}{{ materialProblem(item) ? ` · ${t('Unsupported', '暂不支持')}` : '' }}</option></optgroup>
      </select>
    </label>
    <div class="finish-grid">
      <button v-for="item in materialTemplates" :key="item.id" type="button" class="finish-choice" :class="{ active: material.appearanceBinding?.id === `appearance:${item.id}` }" :aria-pressed="material.appearanceBinding?.id === `appearance:${item.id}`" :disabled="busy" :title="t('Bind this appearance and keep the current color, manufacturer and SKU.', '绑定此外观，保留当前颜色、厂商和 SKU。')" @click="bind(`appearance:${item.id}`)"><i class="finish-orb" :class="item.id" /><strong>{{ item.name }}</strong><small>{{ item.nameCN }}</small></button>
    </div>
    <p>{{ t('Shared appearance parameters are demo values, pending physical calibration.', '通用外观使用演示参数，待实物校准。') }}</p>
    <template v-if="material.appearanceBinding">
      <p class="binding-state">{{ material.appearanceBinding.overridden ? t('Local appearance overrides', '已做本地外观调整') : t('Inherited appearance', '已继承材质外观') }} · {{ material.appearanceBinding.name }}</p>
      <p>{{ t('Color and SKU stay independent. Saved appearance uses a snapshot; re-inherit to use source changes.', '颜色和 SKU 独立保留。外观保存为快照；源材质修改后，点击重新继承更新。') }}</p>
      <button v-if="source" type="button" :disabled="busy || !!materialProblem(source)" @click="emit('update', bindAppearance(material, source))">{{ t('Re-inherit source appearance', '重新继承源材质') }}</button>
      <p v-else>{{ t('Saved appearance remains available.', '源材质缺失，继续使用已保存的外观快照。') }}</p>
    </template>
  </section>
</template>

<style scoped>
.appearance-binding { display: grid; gap: 8px; padding: 12px; margin: 12px 0; background: #292e2a; border: 1px solid #4b5943; border-radius: 7px; }
label { display: grid; gap: 8px; color: #d4dfca; font-size: 11px; }
select { width: 100%; min-width: 0; background: #202421; border: 1px solid #4b5547; border-radius: 5px; color: #eee; padding: 8px; font-size: 11px; }
p { color: #979f94; font-size: 10px; line-height: 1.6; margin: 0; overflow-wrap: anywhere; }
.binding-state { color: #c5dbb2; }
button { text-align: left; font-size: 10px; color: #c2ef78; }
.finish-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.finish-choice { display: grid; justify-items: center; gap: 5px; border: 1px solid #3e4348; border-radius: 7px; background: #292d31; padding: 11px 3px 8px; }
.finish-choice.active { border-color: #bcdb96; background: #30392b; }
.finish-choice strong { font-size: 10px; font-weight: 500; color: #dce1e4; }
.finish-choice small { color: #949da3; font-size: 9px; }
.finish-orb { width: 28px; height: 28px; border-radius: 50%; background: radial-gradient(circle at 32% 25%, #dae0d2, #7a8b6b 55%, #303f26); box-shadow: 0 3px 7px #0005; }
.finish-orb.matte { background: radial-gradient(circle at 32% 25%, #b4c5a3, #7a8b6b 70%); }
.finish-orb.silk { background: linear-gradient(115deg, #61754f 7%, #eef7df 32%, #7c9264 48%, #d9e7c6 60%, #39492b); }
.finish-orb.metallic { background: linear-gradient(130deg, #899274, #e1e8cc 30%, #333f20 49%, #a8b98c 66%, #536139); }
.finish-orb.translucent { background: radial-gradient(circle at 30% 25%, #ffffffa0, #b5d59c35 55%, #bfdba285); border: 1px solid #cde1b590; }
</style>
