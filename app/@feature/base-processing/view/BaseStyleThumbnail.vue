<script setup lang="ts">
import { useId } from 'vue';
import type { BaseShape } from '~/@engine/base-processing';
defineProps<{ shape: BaseShape }>();
const id = useId().replace(/:/g, '');
</script>
<template>
  <svg viewBox="0 0 160 112" class="base-style-thumbnail" aria-hidden="true">
    <defs>
      <radialGradient :id="id + '-bg'"><stop stop-color="#54565a" /><stop offset="1" stop-color="#27282c" /></radialGradient>
      <linearGradient :id="id + '-side'" x2="0" y2="1"><stop stop-color="#a2a5ad" /><stop offset="1" stop-color="#4b4e55" /></linearGradient>
      <radialGradient :id="id + '-cloud'" cx=".35" cy=".2" r=".9"><stop stop-color="#fff" /><stop offset=".5" stop-color="#e9e9e9" /><stop offset="1" stop-color="#9c9ea3" /></radialGradient>
      <linearGradient :id="id + '-disc'" x2="0" y2="1"><stop stop-color="#363837" /><stop offset="1" stop-color="#161817" /></linearGradient>
    </defs>
    <rect width="160" height="112" rx="12" :fill="`url(#${id}-bg)`" />
    <ellipse cx="80" cy="83" rx="52" ry="10" fill="#111" opacity=".25" />
    <template v-if="shape === 'white-cloud'">
      <path d="M39 73C17 75 17 56 35 50 31 34 51 30 65 37 74 22 101 26 107 39 128 34 143 47 132 58 147 69 126 85 110 78 99 96 75 91 67 81 54 89 34 85 39 73Z" :fill="`url(#${id}-cloud)`" stroke="#d0d1d2" stroke-width=".5" />
    </template>
    <template v-else-if="shape === 'black-disc'">
      <path d="M39 47C31 57 24 71 27 77 40 96 125 94 133 77 133 69 126 52 121 47Z" :fill="`url(#${id}-disc)`" stroke="#121413" />
      <ellipse cx="80" cy="47" rx="41" ry="14" fill="#2b2e2c" stroke="#161917" />
      <path d="M29 74c14 17 85 20 102 0" fill="none" stroke="#444745" opacity=".4" />
    </template>
    <template v-else-if="shape === 'square' || shape === 'custom'">
      <path d="m25 55 58-25 53 24v23L80 98 25 74Z" :fill="`url(#${id}-side)`" /><path d="m25 55 58-25 53 24-56 24Z" fill="#d1d3d8" /><path d="M80 78v20" stroke="#686c75" />
    </template>
    <template v-else-if="shape === 'hexagon'">
      <path d="m29 45 49-17 49 17 9 30-49 19-49-17Z" :fill="`url(#${id}-side)`" /><path d="m29 45 49-17 49 17 9 12-49 19-49-17Z" fill="#d1d3d8" />
    </template>
    <template v-else>
      <path d="M26 54v19c0 25 108 25 108 0V54Z" :fill="`url(#${id}-side)`" /><ellipse cx="80" cy="54" rx="54" ry="21" fill="#d1d3d8" />
    </template>
  </svg>
</template>
<style scoped>.base-style-thumbnail{display:block;width:100%;height:100%;object-fit:contain}</style>
