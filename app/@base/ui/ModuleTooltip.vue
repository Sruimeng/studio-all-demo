<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipTrigger } from '@tripo3d/design';

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
      <strong>{{ title }}</strong>
      <span>{{ description }}</span>
    </TooltipContent>
  </Tooltip>
</template>
