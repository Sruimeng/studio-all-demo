// FBX/GLTF 实例边共享的邻接规则、端点属性与 CPU/GPU 生命周期。
import { Box3, BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Sphere, Vector3 } from 'three';

/**
 * 边键打包步长：键 = min * STRIDE + max，用整数索引对代替坐标字符串做去重。
 * 2^26 = 67,108,864 远超任何模型的顶点数，且 2^26 × 2^26 = 2^52 仍在
 * Number.MAX_SAFE_INTEGER (2^53-1) 之内，因此打包无精度损失。
 * 不要改回坐标 rounding 做键：量化步长与模型尺度耦合，小尺度模型上会把近重合的
 * 不同顶点误合并成一个。
 */
export const EDGE_KEY_STRIDE = 2 ** 26;

/**
 * 邻接表条目：记录边的两个端点，以及共享它的面。
 * faceCount 用于区分流形边（2）、边界边（1）与非流形边（>2），这三类的可见性规则不同。
 */
export interface EdgeRecord {
  end: Vector3;
  faceA: number;
  faceB: number;
  faceCount: number;
  start: Vector3;
}

/**
 * 线段模板四边形：4 个顶点，Int8 归一化后 position.x ∈ {-1, 1}、position.y ∈ {0, 1}，
 * 全部是线身、无端帽顶点。
 *
 * 与 `../material/edge-material.ts` 的 shader 是硬契约：vertex 侧 `vUv = position.xy`
 * 使 vUv.x 的 0 落在线中心（fragment 的覆盖度衰减依赖这个对称性），`position.y < 0.5`
 * 用于判定起止端。改动本模板必须同步改该 shader，两边都没有编译期保护。
 *
 * 模块级共享：所有边几何体复用同一份底层 TypedArray。安全性依据 three 的
 * WebGLAttributes——它以 BufferAttribute 实例（而非底层数组）为 WeakMap 键分配 GPU buffer，
 * 且上传路径对数组只读。任何消费方都不得改写这两个数组。
 */
const TEMPLATE_VERTICES = new Int8Array([-127, 0, 0, 127, 0, 0, -127, 127, 0, 127, 127, 0]);
const TEMPLATE_INDICES = new Uint16Array([0, 1, 2, 1, 3, 2]);

/**
 * 实例边的包围体以对象空间端点为准；模板 position 只描述画线四边形。
 * FBX/GLTF 共用这些重算入口，保证排序、clone 后重算与 GPU 重建不会退回模板 bounds。
 */
export class EdgeInstanceGeometry extends InstancedBufferGeometry {
  /** 端点修改后重新计算包围盒；没有实例时保留 Three 的空包围盒语义。 */
  override computeBoundingBox(): void {
    const bounds = this.boundingBox ??= new Box3();
    const start = this.getAttribute('instanceStart');
    const end = this.getAttribute('instanceEnd');
    const point = new Vector3();

    bounds.makeEmpty();
    for (const attribute of [start, end]) {
      if (!attribute) continue;
      for (let index = 0; index < attribute.count; index++) {
        bounds.expandByPoint(point.fromBufferAttribute(attribute, index));
      }
    }
  }

  /** 用当前端点的 AABB 建立保守球；显式重算时也刷新旧包围盒。 */
  override computeBoundingSphere(): void {
    this.computeBoundingBox();
    this.boundingBox!.getBoundingSphere(this.boundingSphere ??= new Sphere());
  }
}

/**
 * 判定一条边是否显示。对齐 Blender edge_factor_calc 的三条规则：
 * 边界边（仅 1 面）与非流形边（>2 面）无条件显示——它们是轮廓和结构关键；
 * 只有恰好 2 面共享的流形边才比较二面角。
 *
 * ponytail: 二面角过滤当前无调用方——FBX / GLTF 两处消费方都用默认 dihedralThreshold = 0
 * 走快路径，本函数恒返回 true。保留是因为它是「只看形体折痕」模式的唯一判据入口；
 * 升级路径：调用方传 dihedralThreshold > 0 即可启用，无需改本模块。
 */
export const isEdgeVisible = (
  edge: EdgeRecord,
  faceNormals: Float32Array | null,
  filterByDihedral: boolean,
  cosThreshold: number,
): boolean => {
  if (!filterByDihedral || !faceNormals) return true;
  if (edge.faceCount !== 2 || edge.faceB < 0) return true;

  const a = edge.faceA * 3;
  const b = edge.faceB * 3;
  const dot
    = (faceNormals[a] ?? 0) * (faceNormals[b] ?? 0)
      + (faceNormals[a + 1] ?? 0) * (faceNormals[b + 1] ?? 0)
      + (faceNormals[a + 2] ?? 0) * (faceNormals[b + 2] ?? 0);

  return dot <= cosThreshold;
};

/** 模型局部空间的边端点；共享服务持有 CPU 数据，消费者只读，不转移或清空缓冲。 */
export interface WireframeEdgePositions {
  readonly end: Float32Array;
  readonly start: Float32Array;
}

/**
 * 用共享端点创建独立 GPU 属性，并按实际 Float32 端点建立 bounds。
 * CPU 数组保留至几何释放，保证上传后的排序、clone 与 context 恢复；输入长度不合法时抛错。
 */
export const setEdgePositions = (geometry: InstancedBufferGeometry, edges: WireframeEdgePositions): void => {
  if (edges.start.length !== edges.end.length || edges.start.length % 3 !== 0) {
    throw new RangeError('Wireframe endpoints must contain matching xyz triples');
  }
  geometry.instanceCount = edges.start.length / 3;
  geometry.setAttribute('position', new BufferAttribute(TEMPLATE_VERTICES, 3, true));
  geometry.setIndex(new BufferAttribute(TEMPLATE_INDICES, 1));
  const startAttr = new InstancedBufferAttribute(edges.start, 3);
  const endAttr = new InstancedBufferAttribute(edges.end, 3);

  geometry.setAttribute('instanceStart', startAttr);
  geometry.setAttribute('instanceEnd', endAttr);
  const bounds = geometry.boundingBox ??= new Box3();
  const point = new Vector3();
  bounds.makeEmpty();
  for (let offset = 0; offset < edges.start.length; offset += 3) {
    bounds.expandByPoint(point.fromArray(edges.start, offset));
    bounds.expandByPoint(point.fromArray(edges.end, offset));
  }
  bounds.getBoundingSphere(geometry.boundingSphere ??= new Sphere());
};

/**
 * 把可见边表写进实例化几何体：挂模板四边形，再按边表填 instanceStart / instanceEnd
 * 两个实例属性，并设置 instanceCount。
 * 实例端点用 Float32 对象空间坐标，避免材质侧解码与 bbox 依赖。
 */
export const setEdgeInstances = (
  geometry: InstancedBufferGeometry,
  edges: readonly EdgeRecord[],
): void => {
  const instanceStarts = new Float32Array(edges.length * 3);
  const instanceEnds = new Float32Array(edges.length * 3);

  let w = 0;
  for (const edge of edges) {
    instanceStarts[w] = edge.start.x;
    instanceStarts[w + 1] = edge.start.y;
    instanceStarts[w + 2] = edge.start.z;
    instanceEnds[w] = edge.end.x;
    instanceEnds[w + 1] = edge.end.y;
    instanceEnds[w + 2] = edge.end.z;
    w += 3;
  }

  setEdgePositions(geometry, { end: instanceEnds, start: instanceStarts });
};
