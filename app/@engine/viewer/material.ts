import { MeshPhysicalMaterial, MeshStandardMaterial, SRGBColorSpace, LinearSRGBColorSpace, type Material } from 'three';

export interface SurfaceValues {
  hex: string; transparency: number; metalness: number; roughness: number;
  renderRule?: string;
  ior?: number;
  baseColor?: [number, number, number];
  baseColorSpace?: 'linear-srgb' | 'srgb';
}
export function patchStudioMaterial(material: MeshStandardMaterial, layer = false) {
  const uniforms = { printLayers: { value: layer ? 1 : 0 }, printScale: { value: 1 }, studioRoughness: { value: 1 } };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float printHeight;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nprintHeight = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float printHeight;\nuniform float printLayers;\nuniform float printScale;\nuniform float studioRoughness;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.5 + 0.5 * roughnessFactor, studioRoughness);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float stripe = printHeight * printScale / 0.2;
      float fade = clamp(1.4 - fwidth(stripe) * 2.2, 0.0, 1.0) * printLayers;
      vec3 printUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
      normal = normalize(normal + printUp * sin(stripe * 6.2831853) * 0.22 * fade);`);
  };
  material.customProgramCacheKey = () => 'tripo-material-studio-v2';
  material.userData.printUniforms = uniforms;
  return uniforms;
}
export function createPrintMaterial(value: SurfaceValues) {
  const material = new MeshPhysicalMaterial();
  const uniforms = patchStudioMaterial(material, true);
  applySurface(material, value);
  return { material, uniforms };
}
export function applySurface(material: MeshPhysicalMaterial, value: SurfaceValues) {
  const transparent = value.transparency > 0;
  if (material.transparent !== transparent) material.needsUpdate = true;
  material.color.set(value.hex);
  if (value.baseColor) material.color.setRGB(...value.baseColor, value.baseColorSpace === 'srgb' ? SRGBColorSpace : LinearSRGBColorSpace);
  material.metalness = value.metalness;
  material.roughness = value.roughness;
  material.ior = value.ior ?? 1.5;
  if (material.userData.printUniforms) material.userData.printUniforms.studioRoughness.value = value.renderRule === 'openpbr-subset-v1' ? 0 : 1;
  material.opacity = 1 - value.transparency;
  material.transparent = transparent;
  material.depthWrite = !transparent;
}
export function cloneStudioMaterial(source: Material): Material {
  const material = source.clone();
  if (material instanceof MeshStandardMaterial) patchStudioMaterial(material);
  return material;
}
