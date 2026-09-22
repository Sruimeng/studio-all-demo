// loader 发布同一 mesh 实例的 primitive 域；只保存身份，不保留几何或预建邻接缓存。
import type { Mesh } from 'three';

/** Mesh 不被 WeakMap 延长寿命，geometry clone 不改变所属实例。 */
const domains = new WeakMap<Mesh, symbol>();

/**
 * GLTF node 构造时发布实例域，不得按名称或共享 geometry 推断。
 * @param mesh 已实例化的 primitive Mesh；归属不随其 geometry clone 改变。
 * @param domain 同 node 的唯一 symbol；undefined 撤销，不影响其他 Mesh。
 * @returns void；仅替换弱引用归属，无资源转移或业务异常。
 */
export function setModelMeshEdgeDomain(mesh: Mesh, domain: symbol | undefined): void {
  if (domain) domains.set(mesh, domain);
  else domains.delete(mesh);
}

/**
 * UV 准备时同步借用 loader 确认的归并域，不改变归属或资源。
 * @param mesh 当前 Content 的 Mesh 实例。
 * @returns 域身份；未发布时返回 undefined，消费方保持原接缝行为。
 */
export function getModelMeshEdgeDomain(mesh: Mesh): symbol | undefined {
  return domains.get(mesh);
}
