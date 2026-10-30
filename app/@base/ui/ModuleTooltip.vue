<script setup lang="ts">
import { useLocale } from '~/@base/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@tripo3d/design';
const { tr } = useLocale();

defineProps<{
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}>();
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipContent :side="side ?? 'right'" :side-offset="8" class="module-tooltip">
      <strong>{{ tr(title) }}</strong>
      <span>{{ tr(description) }}</span>
    </TooltipContent>
  </Tooltip>
</template>
