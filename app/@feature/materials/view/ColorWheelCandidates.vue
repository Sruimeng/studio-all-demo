<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { useLocale } from '~/@base/locale';
import type { WheelEntry } from '../color-wheel';

const props = defineProps<{ entries: WheelEntry[]; selected: string }>();
const emit = defineEmits<{ select: [id: string] }>();
const { t } = useLocale();
const list = useTemplateRef<HTMLDivElement>('list');
function navigate(event: KeyboardEvent) {
  const index = props.entries.findIndex(entry => entry.id === props.selected);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? props.entries.length - 1 : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index + 1) % props.entries.length : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index - 1 + props.entries.length) % props.entries.length : -1;
  const entry = props.entries[next];
  if (!entry) return;
  event.preventDefault(); emit('select', entry.id);
  list.value?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
}
</script>

<template>
  <section class="wheel-candidates" :aria-label="t('Color records', '颜色记录')" @keydown="navigate">
    <div class="candidate-heading"><span>{{ t('COLOR RECORDS', '颜色记录') }} · {{ entries.length }}</span><small>{{ t('Arrow keys to browse', '方向键浏览') }}</small></div>
    <div ref="list" class="candidate-list" role="list">
      <div v-for="entry in entries" :key="entry.id" role="listitem"><button class="candidate" :class="{ active: selected === entry.id }" :aria-pressed="selected === entry.id" type="button" @click="emit('select', entry.id)"><i :style="{ background: entry.hex ?? '#34383B' }" /><span><b>{{ entry.material.name }}</b><small>{{ entry.vendor }} · {{ entry.seriesName || entry.base }}</small></span><code>{{ entry.hex ?? '—' }}</code></button></div>
    </div>
  </section>
</template>

<style scoped>
.wheel-candidates { border-top: 1px solid #454e53; padding: 18px 20px; background: #202528; color: #e2e7e8; }
.candidate-heading { display: flex; justify-content: space-between; gap: 8px; color: #b2bec4; font: 10px monospace; margin-bottom: 12px; }
.candidate-heading small { color: #a6afb4; font-size: 9px; }
.candidate-list { max-height: 240px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 6px; scrollbar-width: thin; }
.candidate { display: flex; gap: 9px; width: 100%; align-items: center; padding: 9px; border: 1px solid #414a50; border-radius: 6px; text-align: left; background: #272e32; color: #e2e7e8; }
.candidate.active { border-color: #a2bc86; background: #343f30; }
.candidate i { width: 26px; height: 26px; border-radius: 4px; flex-shrink: 0; border: 1px solid #ffffff30; }
.candidate span { min-width: 0; flex: 1; }
.candidate b { display: block; font-size: 10px; font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.candidate small { display: block; font-size: 9px; color: #a6b4bc; margin-top: 4px; overflow-wrap: anywhere; }
.candidate code { color: #c0cdd4; font-size: 9px; flex-shrink: 0; }
</style>
