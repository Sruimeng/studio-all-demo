<script setup lang="ts">
import { computed } from 'vue';
import { useLocale } from '~/@base/locale';
import type { MaterialSyncState } from '../use-material-sync';
const props = defineProps<{ state: MaterialSyncState; error: string; conflicts: string[] }>();
const emit = defineEmits<{ retry: []; resolve: [preferLocal: boolean] }>();
const { t } = useLocale();
const label = computed(() => ({
  local: t('Saved in this browser', '仅保存在当前浏览器'),
  loading: t('Loading shared materials…', '正在读取共享材质…'),
  pending: t('Material changes waiting to sync…', '材质修改等待同步…'),
  saving: t('Saving materials to GitHub…', '正在保存材质到 GitHub…'),
  saved: t('Materials saved to GitHub', '材质已保存到 GitHub'),
  error: t('Sync failed · local changes retained', '同步失败 · 本地修改已保留'),
  conflict: t('Materials changed on another device', '其他设备修改了相同材质'),
})[props.state]);
</script>
<template>
  <div v-if="state !== 'local'" class="material-sync" :class="state" role="status" aria-live="polite">
    <span>{{ label }}</span>
    <small v-if="error && state === 'error'">{{ error }}</small>
    <template v-if="state === 'conflict'">
      <small>{{ conflicts.join(' · ') }}</small>
      <span class="sync-actions"><button @click="emit('resolve', false)">{{ t('Use remote conflicting edits', '冲突项采用远端修改') }}</button><button @click="emit('resolve', true)">{{ t('Keep my conflicting edits', '保留本机冲突修改') }}</button></span>
    </template>
    <button v-else-if="state === 'error'" @click="emit('retry')">{{ t('Retry', '重试') }}</button>
  </div>
</template>
<style scoped>
.material-sync { display: grid; gap: 6px; padding: 10px 15px; border-bottom: 1px solid #373b3f; color: #b9d59a; font-size: 11px; }
.material-sync small { color: #a9a9ad; font-size: 10px; overflow-wrap: anywhere; }
.material-sync.error, .material-sync.conflict { color: #edbe8b; }
.material-sync button { width: fit-content; color: inherit; text-decoration: underline; font-size: 10px; }
.sync-actions { display: flex; flex-wrap: wrap; gap: 12px; }
</style>
