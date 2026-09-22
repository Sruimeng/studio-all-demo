// 独占 Three 内容的资源收集与差集释放；不持全局资源池，不沿 SDK 或组件遍历释放。

import { type Material, type Object3D, Skeleton, type Texture } from 'three';
import type { ModelOwnedResource, ModelPreparedContent } from '../types';
/** 识别 Three 纹理，允许加载器来自不同构建实例。 */
function isTexture(value: unknown): value is Texture {
  if (!value || typeof value !== 'object')
    return false;
  let object: object | null = value;
  while (object) {
    const marker = Object.getOwnPropertyDescriptor(object, 'isTexture');
    if (marker)
      return 'value' in marker && marker.value === true;
    object = Object.getPrototypeOf(object);
  }
  return false;
}
/** 收集直接纹理及纹理数组，不递归业务对象或任意循环引用。 */
function collectTextures(value: unknown, resources: Set<ModelOwnedResource>): void {
  if (isTexture(value))
    resources.add(value);
  else if (Array.isArray(value)) {
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if ('value' in descriptor && isTexture(descriptor.value))
        resources.add(descriptor.value);
    }
  }
}
/** 标准材质的全部贴图以及 ShaderMaterial 的直接 sampler 均属于源资源。 */
function collectMaterial(material: Material, resources: Set<ModelOwnedResource>): void {
  resources.add(material);
  // 自定义材质可能有申请资源或抛错的 getter；扫描只读取已存在的数据属性。
  const descriptors = Object.getOwnPropertyDescriptors(material);
  for (const descriptor of Object.values(descriptors)) {
    if ('value' in descriptor)
      collectTextures(descriptor.value, resources);
  }
  // 只读取 shader 声明的 uniform 值，不扫描其余任意嵌套对象。
  const uniformProperty = descriptors.uniforms;
  const uniforms: unknown = uniformProperty && 'value' in uniformProperty ? uniformProperty.value : undefined;
  if (!uniforms || typeof uniforms !== 'object')
    return;
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(uniforms))) {
    if (!('value' in descriptor) || !descriptor.value || typeof descriptor.value !== 'object')
      continue;
    const valueProperty = Object.getOwnPropertyDescriptor(descriptor.value, 'value');
    if (valueProperty && 'value' in valueProperty)
      collectTextures(valueProperty.value, resources);
  }
}
/**
 * 收集一棵或多棵独占根的标准资源，多个 Mesh/根共享的对象只登记一次。
 * @param rootOrRoots Source 根；多个根可包含已从原树 detach 的节点。
 * @returns 本次调用独立的资源集合，无全局登记或生命周期副作用。
 */
export function collectModelResources(rootOrRoots: Object3D | Iterable<Object3D>): Set<ModelOwnedResource> {
  // 收集结果只属于调用方，可在删除节点前后用于差集比较。
  const resources = new Set<ModelOwnedResource>();
  // 多根输入可能重叠，节点也按 identity 去重。
  const visited = new Set<Object3D>();
  const roots = (rootOrRoots as Object3D).isObject3D ? [rootOrRoots as Object3D] : rootOrRoots as Iterable<Object3D>;
  for (const root of roots) {
    root.traverse((object) => {
      if (visited.has(object))
        return;
      visited.add(object);
      // Mesh、Line、Points 都可能持有同一 geometry/material，不只处理 Mesh。
      const renderable = object as Object3D & {
        geometry?: ModelOwnedResource;
        material?: Material | Material[];
        skeleton?: Skeleton;
      };
      if (renderable.geometry)
        resources.add(renderable.geometry);
      if (renderable.material) {
        const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
        for (const material of materials)
          collectMaterial(material, resources);
      }
      if (renderable.skeleton) {
        resources.add(renderable.skeleton);
        if (renderable.skeleton.boneTexture)
          resources.add(renderable.skeleton.boneTexture);
      }
    });
  }
  return resources;
}
/** 展开骨架的纹理归属，避免仅保留 Skeleton 时仍误清它的骨纹理。 */
function resourceSet(resources: Iterable<ModelOwnedResource>): Set<ModelOwnedResource> {
  const result = new Set(resources);
  for (const resource of result) {
    if (resource instanceof Skeleton && resource.boneTexture)
      result.add(resource.boneTexture);
  }
  return result;
}
/**
 * 释放本批资源减去仍被保留内容引用的资源；一次调用内按 identity 去重。
 * @param resources 即将结束的独占资源；调用方负责不重复结束同一个 owner。
 * @param retained 仍有 owner 的资源，绝不释放或改动。
 * @throws AggregateError 所有应释放项均尝试后汇总异常，不因首错停止。
 */
export function disposeModelResources(resources: Iterable<ModelOwnedResource>, retained: Iterable<ModelOwnedResource> = []): void {
  const owned = resourceSet(resources);
  const keep = resourceSet(retained);
  // Skeleton.dispose 本身会释放 boneTexture；拆开这条递归，由统一集合只释放一次。
  for (const resource of owned) {
    if (resource instanceof Skeleton && !keep.has(resource))
      resource.boneTexture = null;
  }
  const failures: unknown[] = [];
  for (const resource of owned) {
    if (keep.has(resource))
      continue;
    try {
      const result: unknown = resource.dispose();
      if (result !== null && (typeof result === 'object' || typeof result === 'function')
        && typeof (result as PromiseLike<unknown>).then === 'function') {
        void Promise.resolve(result).catch(() => undefined);
        throw new TypeError('Model resource dispose must be synchronous');
      }
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, 'Model resource disposal failed');
}
/**
 * 清理尚未交给 bind 的准备结果，包括失败前分配但尚未挂到根的资源。
 * @param prepared 当前调用仍拥有的准备结果，bind 后不得再调用。
 * @param extraResources 未挂入树的 clone 等独占资源，与根内资源合并去重。
 * @throws AggregateError 清理错误逐项收集后报告。
 */
export function disposePreparedModel(prepared: ModelPreparedContent<unknown>, extraResources: Iterable<ModelOwnedResource> = []): void {
  disposeModelResources([...collectModelResources(prepared.root), ...extraResources]);
}
