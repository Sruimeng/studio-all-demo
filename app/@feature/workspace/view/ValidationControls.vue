<script setup lang="ts">
import type { ViewerSettings } from '~/@engine/viewer';
import { useLocale } from '~/@base/locale';
import ModuleTooltip from '~/@base/ui/ModuleTooltip.vue';
defineProps<{ settings: ViewerSettings; busy: boolean }>();
const emit = defineEmits<{ workflow: [value: 'assignment' | 'validation']; sample: [] }>();
const { t } = useLocale();
</script>
<template>
  <section class="studio-section validation-controls">
    <div class="studio-section-heading"><h2>{{ t('Filament validation', '耗材验证') }}</h2></div>
    <div class="studio-segmented"><button :class="{ active: settings.workflow === 'validation' }" :disabled="busy" @click="emit('workflow', 'validation')">{{ t('Validate', '材质验证') }}</button><button :class="{ active: settings.workflow !== 'validation' }" :disabled="busy" @click="emit('workflow', 'assignment')">{{ t('Assign regions', '区域应用') }}</button></div>
    <p class="validation-note">{{ settings.workflow === 'validation' ? t('Apply one filament color to the whole model. Studio HDR, ACES, exposure 1. Source normals retained.', '整模应用一个耗材颜色。固定 Studio HDR、ACES、曝光 1，保留原始法线。') : t('Generate regions to match model colors to supplier catalogs. Replace assignments manually without changing region boundaries.', '生成分色会按模型颜色匹配供应商色卡。可手动替换耗材，保留区域边界。') }}</p>
    <ModuleTooltip :title="t('Standard sample', '标准样件')" :description="t('Load flat, curved and thin-wall geometry under the same lighting. Transmission uses an effective optical thickness.', '打开含平面、曲面和薄壁的样件，统一灯光。透射采用可调整的等效光学厚度。')" side="right"><button class="studio-primary" :disabled="busy" @click="emit('sample')">{{ t('Open standard sample', '打开标准样件') }}</button></ModuleTooltip>
    <p class="validation-note">{{ t('Use your matching GLB to compare with an existing physical print. Material data is not a print-process profile.', '也可导入实物样件对应的 GLB。材质数据不等同于打印工艺配置。') }}</p>
  </section>
</template>
<style scoped>
.validation-note { margin: 12px 0; color: #999; font-size: 10px; line-height: 1.6; }
</style>
