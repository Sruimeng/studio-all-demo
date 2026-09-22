import { MeshPhysicalMaterial, MeshStandardMaterial, type Material } from 'three';

export interface SurfaceValues { hex: string; transparency: number; metalness: number; roughness: number }
export function patchStudioMaterial(material: MeshStandardMaterial, layer = false) {
  const uniforms = { printLayers: { value: layer ? 1 : 0 }, printScale: { value: 1 } };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float printHeight;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nprintHeight = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float printHeight;\nuniform float printLayers;\nuniform float printScale;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.5 + 0.5 * roughnessFactor;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float stripe = printHeight * printScale / 0.2;
      float fade = clamp(1.4 - fwidth(stripe) * 2.2, 0.0, 1.0) * printLayers;
      vec3 printUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
      normal = normalize(normal + printUp * sin(stripe * 6.2831853) * 0.22 * fade);`);
  };
  material.customProgramCacheKey = () => 'tripo-material-studio-v1';
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
  material.metalness = value.metalness;
  material.roughness = value.roughness;
  material.opacity = 1 - value.transparency;
  material.transparent = transparent;
  material.depthWrite = !transparent;
}
export function cloneStudioMaterial(source: Material): Material {
  const material = source.clone();
  if (material instanceof MeshStandardMaterial) patchStudioMaterial(material);
  return material;
}
