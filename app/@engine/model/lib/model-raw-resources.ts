// Three资源跨入原生响应式System/Component前统一raw化，不递归业务userData或顶点数组。
import type { Object3D } from 'three';
import { markRaw } from 'vue';

/** 只处理已知Three资源关系，避免执行任意getter或深遍历数据图。 */
export function markModelResourcesRaw(root: Object3D): void {
  const visited = new WeakSet<object>();
  /** 数组只处理资源元素，不遍历TypedArray的每个数值。 */
  function raw(value: unknown): void {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    markRaw(value);
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return;
    if (Array.isArray(value)) {
      for (const item of value) raw(item);
      return;
    }
    const object = value as Record<string, unknown>;
    const fields = object.isBufferGeometry
      ? ['attributes', 'morphAttributes', 'index', 'boundingBox', 'boundingSphere']
      : object.isTexture
        ? ['source', 'offset', 'repeat', 'center', 'matrix']
        : object.isObject3D
          ? ['position', 'rotation', 'quaternion', 'scale', 'up', 'matrix', 'matrixWorld', 'modelViewMatrix', 'normalMatrix', 'geometry', 'material', 'skeleton', 'bindMatrix', 'bindMatrixInverse', 'boundingBox', 'boundingSphere', 'instanceMatrix', 'instanceColor', 'morphTexture']
          : ['data', 'bones', 'boneInverses', 'boneTexture', 'min', 'max', 'center'];
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const field of fields) {
      const descriptor = descriptors[field];
      if (descriptor && 'value' in descriptor) raw(descriptor.value);
    }
    if (object.isMaterial || object.isBufferGeometry) {
      for (const [field, descriptor] of Object.entries(descriptors)) {
        if (!('value' in descriptor) || field === 'userData' || field === '_listeners') continue;
        const item = descriptor.value;
        if (!item || typeof item !== 'object') continue;
        if (field === 'attributes' || field === 'morphAttributes' || field === 'uniforms') {
          markRaw(item);
          for (const nested of Object.values(Object.getOwnPropertyDescriptors(item))) {
            if ('value' in nested) {
              if (field === 'uniforms' && nested.value && typeof nested.value === 'object') {
                markRaw(nested.value);
                const uniform = Object.getOwnPropertyDescriptor(nested.value, 'value');
                if (uniform && 'value' in uniform) raw(uniform.value);
              } else raw(nested.value);
            }
          }
        } else raw(item);
      }
    }
  }
  root.traverse(raw);
}
