<script setup lang="ts">
import { useLocale } from '~/@base/locale';
import ModuleTooltip from '~/@base/ui/ModuleTooltip.vue';
import { materialHex } from '~/@feature/materials';
import type { RegionAssignment } from '../types';

defineProps<{ regions: RegionAssignment[]; selected: number; busy: boolean }>();
const emit = defineEmits<{ select: [index: number] }>();
const { t } = useLocale();
const colorName = (region: RegionAssignment) => region.material.supplier
  ? t(region.material.supplier.colorNameEN, region.material.supplier.colorNameCN || region.material.supplier.colorNameEN)
  : region.material.name;
</script>

<template>
  <section class="region-tray" :aria-label="t('Region filaments', '区域耗材')">
    <div class="tray-heading">
      <div><span>CATALOG COLOR MATCH</span><h3>{{ t('Approximate color matches. Select to replace.', '颜色近似匹配，选择区域可替换耗材') }}</h3></div>
      <strong>{{ regions.length.toString().padStart(2, '0') }} <small>{{ t('regions', '区域') }}</small></strong>
    </div>
    <div class="region-list">
      <ModuleTooltip v-for="region in regions" :key="region.index" :title="`${region.material.materialId} · ${colorName(region)}`" :description="region.match ? t('Model representative color → supplier catalog HEX. ΔE00 is the area-weighted mean color difference at generation; lower is closer. The swatch shows the current preview color.', '模型代表色 → 供应商色卡 HEX。ΔE00 是生成时模型采样色与色卡的面积加权平均色差，越小越接近。色块显示当前预览颜色。') : t('Manual assignment. Select a region, then apply a material from the library. Region boundaries stay the same.', '手动绑定。选择区域后从材质库应用耗材，区域边界保持。')" side="top">
        <button class="region-slot" :class="{ active: selected === region.index }" type="button" :disabled="busy" :aria-pressed="selected === region.index" @click="emit('select', region.index)">
          <span class="region-chip" :style="{ background: materialHex(region.material) }"><b>{{ (region.index + 1).toString().padStart(2, '0') }}</b><i v-if="selected === region.index">✓</i></span>
          <strong>{{ region.material.materialId }}<template v-if="region.material.supplier"> · {{ region.material.supplier.materialType }}</template></strong>
          <span class="region-name">{{ colorName(region) }}</span>
          <small v-if="region.match">{{ region.sourceHex }} → {{ region.match.hex }}</small>
          <small v-if="region.match">ΔE00 {{ region.match.meanDeltaE.toFixed(1) }} · {{ (region.match.areaShare * 100).toFixed(1) }}%</small>
          <small v-else>{{ materialHex(region.material) }} · {{ t('Manual', '手动绑定') }}</small>
        </button>
      </ModuleTooltip>
    </div>
  </section>
</template>

<style scoped>
.region-name { display: block; overflow: hidden; margin: 0 4px 4px; color: #aaaeb4; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
</style>
