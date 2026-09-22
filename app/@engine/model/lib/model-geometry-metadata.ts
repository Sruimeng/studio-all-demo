// 原始面环与多边形边属于只读 CPU 元数据；绑定几何身份，未知转换不能继续借用旧记录。
import type { BufferGeometry } from 'three';

/** userData 只存可共享记录，拓扑绑定留在 WeakMap，避免 clone 循环引用及跨几何误用。 */
const POLYGON_EDGES_KEY = 'modelPolygonEdges';

/** 精确源拓扑与描线掩码独立发布，掩码回退不能冒充源身份。 */
const TOPOLOGY_KEY = 'modelGeometryTopology';

/** 源面角点身份；数组交给 geometry 后只读，借用方不得修改或 transfer。 */
export interface ModelGeometryTopology {
  /** 每个源角点的原始顶点 ID；相同坐标不表示相同身份。 */
  readonly cornerVertexIds: Uint32Array;
  /** 源面角点环的起止偏移，最后一项等于 cornerVertexIds.length。 */
  readonly faceOffsets: Uint32Array;
  /** 每个最终 non-indexed 渲染顶点对应的源角点下标。 */
  readonly renderVertexCorners: Uint32Array;
  /** 替换整条记录时递增，与记录身份一起用于异步来源守卫。 */
  readonly revision: number;
}

/** 每项对应一个最终三角形；AB、BC、CA 分别使用最低三位，0 是合法内部面。 */
interface ModelPolygonEdges {
  /** 借用数组禁止修改或 transfer；写入者交出所有权，更新必须替换整条记录。 */
  readonly masks: Uint8Array;
  /** 每次替换递增，记录身份与修订共同标识一次发布。 */
  readonly revision: number;
}

/** 只核对角点顺序依赖；姿态、位置数值、skin/morph 权重变化不改变原始边身份。 */
interface PolygonEdgesBinding {
  readonly index: ReturnType<BufferGeometry['getIndex']>;
  readonly indexArray: ArrayLike<number> | undefined;
  readonly indexVersion: number | undefined;
  readonly position: ReturnType<BufferGeometry['getAttribute']>;
  readonly positionArray: ArrayLike<number>;
  readonly positionCount: number;
  readonly record: ModelPolygonEdges;
}

/** 不延长任何 Content 或 geometry 的寿命。 */
const bindings = new WeakMap<BufferGeometry, PolygonEdgesBinding>();

/** 源拓扑沿同一几何身份绑定，额外保存长度以 O(1) 拦截 detach。 */
interface TopologyBinding extends Omit<PolygonEdgesBinding, 'record'> {
  readonly cornerCount: number;
  readonly faceOffsetCount: number;
  readonly record: ModelGeometryTopology;
}

/** 不持有 Mesh 或 Content，普通 Three clone 没有此绑定，不能借用复制的 userData。 */
const topologyBindings = new WeakMap<BufferGeometry, TopologyBinding>();

/** 为已经验证的源拓扑建立当前几何绑定；clone 可以共享记录但不能共享绑定。 */
function bindTopology(geometry: BufferGeometry, record: ModelGeometryTopology): void {
  const index = geometry.getIndex();
  const position = geometry.getAttribute('position');
  geometry.userData = { ...geometry.userData, [TOPOLOGY_KEY]: record };
  topologyBindings.set(geometry, {
    cornerCount: record.cornerVertexIds.length,
    faceOffsetCount: record.faceOffsets.length,
    index, indexArray: index?.array, indexVersion: index?.version,
    position, positionArray: position.array, positionCount: position.count, record,
  });
}

/** 校验源面环和三角覆盖；只接受完整映射，任何坏面都会拒绝整条记录。 */
function validateTopology(geometry: BufferGeometry, data: Omit<ModelGeometryTopology, 'revision'>): void {
  const position = geometry.getAttribute('position');
  const { cornerVertexIds, faceOffsets, renderVertexCorners } = data;
  if (geometry.getIndex() !== null || !position || position.itemSize !== 3
    || !(faceOffsets instanceof Uint32Array) || !(cornerVertexIds instanceof Uint32Array)
    || !(renderVertexCorners instanceof Uint32Array) || faceOffsets.length < 2
    || faceOffsets[0] !== 0 || faceOffsets[faceOffsets.length - 1] !== cornerVertexIds.length
    || renderVertexCorners.length !== position.count || position.count % 3 !== 0) {
    throw new Error('Model topology requires complete non-indexed source polygon mapping');
  }
  // 链表只在发布校验期间存在；两表均存三角编号 + 1，以 0 表示空表或链尾。
  // firstTriangle 按源面寻址表头，nextTriangle 按三角编号寻址后继，避免常驻逐面数组。
  const firstTriangle = new Uint32Array(faceOffsets.length - 1);
  const nextTriangle = new Uint32Array(renderVertexCorners.length / 3);
  for (let face = 0; face + 1 < faceOffsets.length; face++) {
    const start = faceOffsets[face]!;
    const end = faceOffsets[face + 1]!;
    const length = end - start;
    if (length < 3 || end > cornerVertexIds.length || !Number.isSafeInteger(length * length)) {
      throw new Error('Model topology source faces must have valid corner rings');
    }
    // 常见三角面无需逐面分配 Set；n-gon 才需要完整去重。
    if (length === 3) {
      const a = cornerVertexIds[start]!;
      const b = cornerVertexIds[start + 1]!;
      const c = cornerVertexIds[start + 2]!;
      if (a === b || a === c || b === c) throw new Error('Model topology source faces cannot repeat vertex IDs');
    } else {
      const uniqueVertices = new Set<number>();
      for (let corner = start; corner < end; corner++) uniqueVertices.add(cornerVertexIds[corner]!);
      if (uniqueVertices.size !== length) throw new Error('Model topology source faces cannot repeat vertex IDs');
    }
  }
  // loader 按源面顺序输出时直接前进；仅显式三角重排才二分查找。
  let sourceFace = 0;
  for (let triangle = 0; triangle < nextTriangle.length; triangle++) {
    const a = renderVertexCorners[triangle * 3]!;
    const b = renderVertexCorners[triangle * 3 + 1]!;
    const c = renderVertexCorners[triangle * 3 + 2]!;
    if (a >= faceOffsets[sourceFace + 1]! && a < faceOffsets[sourceFace + 2]!) sourceFace++;
    if (a < faceOffsets[sourceFace]! || a >= faceOffsets[sourceFace + 1]!) {
      let low = 0;
      let high = faceOffsets.length - 1;
      while (low + 1 < high) {
        const middle = (low + high) >>> 1;
        if (faceOffsets[middle]! <= a) low = middle;
        else high = middle;
      }
      sourceFace = low;
    }
    const start = faceOffsets[sourceFace]!;
    const end = faceOffsets[sourceFace + 1]!;
    if (a >= end || b < start || b >= end || c < start || c >= end || a === b || a === c || b === c) {
      throw new Error('Model topology triangles must reference three distinct corners of one source face');
    }
    nextTriangle[triangle] = firstTriangle[sourceFace]!;
    firstTriangle[sourceFace] = triangle + 1;
  }
  for (let face = 0; face < firstTriangle.length; face++) {
    const start = faceOffsets[face]!;
    const length = faceOffsets[face + 1]! - start;
    // 三角源面的三个角点已校验不同，恰好一个输出三角即证明三条环边各覆盖一次。
    if (length === 3) {
      if (firstTriangle[face] === 0 || nextTriangle[firstTriangle[face]! - 1] !== 0) {
        throw new Error('Model topology triangles must cover every source face');
      }
      continue;
    }
    const edgeCounts = new Map<number, number>();
    let triangleCount = 0;
    for (let entry = firstTriangle[face]!; entry !== 0; entry = nextTriangle[entry - 1]!) {
      const offset = (entry - 1) * 3;
      triangleCount++;
      for (let edge = 0; edge < 3; edge++) {
        const a = renderVertexCorners[offset + edge]! - start;
        const b = renderVertexCorners[offset + (edge + 1) % 3]! - start;
        const key = Math.min(a, b) * length + Math.max(a, b);
        edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      }
    }
    if (triangleCount !== length - 2) throw new Error('Model topology triangles must cover every source face');
    for (let corner = 0; corner < length; corner++) {
      const next = (corner + 1) % length;
      if (edgeCounts.get(Math.min(corner, next) * length + Math.max(corner, next)) !== 1) {
        throw new Error('Model topology must cover each source polygon edge once');
      }
    }
    for (const [key, count] of edgeCounts) {
      const distance = key % length - Math.floor(key / length);
      if (count !== (distance === 1 || distance === length - 1 ? 1 : 2)) {
        throw new Error('Model topology must cover each internal triangle edge twice');
      }
    }
  }
}

/**
 * loader 解析完成或显式拓扑修改时发布完整源映射；首版仅支持 non-indexed 输出。
 * @param geometry 具有最终 position 的几何；index 输入明确拒绝，避免跨岛共享渲染顶点。
 * @param data 三组数组所有权交给几何，后续只读；undefined 仅撤销当前副本的记录。
 * @throws 输入类型、源面环或三角覆盖非法时同步抛错，旧记录保持有效。
 */
export function setModelGeometryTopology(geometry: BufferGeometry, data: Omit<ModelGeometryTopology, 'revision'> | undefined): void {
  if (data === undefined) {
    geometry.userData = { ...geometry.userData };
    delete geometry.userData.modelGeometryTopology;
    topologyBindings.delete(geometry);
    return;
  }
  validateTopology(geometry, data);
  const revision = (topologyBindings.get(geometry)?.record.revision ?? 0) + 1;
  bindTopology(geometry, Object.freeze({ ...data, revision }));
}

/**
 * UV 采集与结果接纳时同步借用源拓扑，不扫描数组内容。
 * @param geometry 当前源几何；索引/角点重排后必须重新发布，不能就地修改元数据数组。
 * @returns 有效的只读记录；缺失、被替换、detach 或几何绑定变化时返回 undefined。
 */
export function getModelGeometryTopology(geometry: BufferGeometry): ModelGeometryTopology | undefined {
  const binding = topologyBindings.get(geometry);
  if (!binding || geometry.userData[TOPOLOGY_KEY] !== binding.record) return undefined;
  const { index, position, record } = binding;
  if (geometry.getIndex() !== index || index?.array !== binding.indexArray || index?.version !== binding.indexVersion
    || geometry.getAttribute('position') !== position || position.array !== binding.positionArray
    || position.count !== binding.positionCount || position.itemSize !== 3
    || record.faceOffsets.length !== binding.faceOffsetCount || record.cornerVertexIds.length !== binding.cornerCount
    || record.renderVertexCorners.length !== binding.positionCount) return undefined;
  return record;
}

/** 把一条记录绑定到当前几何；调用者已确认角点顺序并完成值域验证。 */
function bind(geometry: BufferGeometry, record: ModelPolygonEdges): void {
  const index = geometry.getIndex();
  const position = geometry.getAttribute('position');
  geometry.userData = { ...geometry.userData, [POLYGON_EDGES_KEY]: record };
  bindings.set(geometry, {
    index, indexArray: index?.array, indexVersion: index?.version,
    position, positionArray: position.array, positionCount: position.count, record,
  });
}

/**
 * 解析完成或显式拓扑修改时发布标记；传 undefined 仅使当前副本失效。
 * @param geometry 已具有最终 position/index 的几何。
 * @param masks 每三角形一字节，所有权交给几何；之后禁止就地修改。
 * @throws 类型、长度或值域错误时拒绝发布，不改变旧记录。
 */
export function setModelGeometryPolygonEdges(geometry: BufferGeometry, masks: Uint8Array | undefined): void {
  if (masks === undefined) {
    geometry.userData = { ...geometry.userData };
    delete geometry.userData.modelPolygonEdges;
    bindings.delete(geometry);
    return;
  }
  const position = geometry.getAttribute('position');
  const count = geometry.getIndex()?.count ?? position?.count;
  if (!position || !(masks instanceof Uint8Array) || masks.length * 3 !== count || masks.some(mask => mask > 7)) {
    throw new Error('Model polygon edge masks must match the final triangles');
  }
  const revision = (bindings.get(geometry)?.record.revision ?? 0) + 1;
  bind(geometry, Object.freeze({ masks, revision }));
}

/**
 * 同步借用源标记；缺失、损坏或拓扑绑定失效返回 undefined，调用方回退三角边。
 * 不扫描全量拓扑；索引原位修改必须设置 needsUpdate，其他角点重排必须重新发布或失效。
 * @param geometry 当前源几何；返回记录与数组都禁止修改及 transfer。
 */
export function getModelGeometryPolygonEdges(geometry: BufferGeometry): ModelPolygonEdges | undefined {
  const binding = bindings.get(geometry);
  if (!binding || geometry.userData[POLYGON_EDGES_KEY] !== binding.record) return undefined;
  const { index, position, record } = binding;
  if (geometry.getIndex() !== index || index?.array !== binding.indexArray || index?.version !== binding.indexVersion
    || geometry.getAttribute('position') !== position || position.array !== binding.positionArray
    || position.count !== binding.positionCount || position.itemSize !== 3
    || !(record.masks instanceof Uint8Array) || record.masks.length * 3 !== (index?.count ?? position.count)) return undefined;
  return record;
}

/**
 * 在 Source 准备阶段 clone 保持三角顺序的几何，为副本重新绑定描线及源拓扑元数据。
 * @param source 借用几何；返回的 geometry 由调用者释放，元数据数组与源共享且只读。
 * @throws Three clone 的分配错误原样抛出；无有效源记录时副本也不携带对应记录。
 */
export function cloneModelGeometry(source: BufferGeometry): BufferGeometry {
  const record = getModelGeometryPolygonEdges(source);
  const topology = getModelGeometryTopology(source);
  const clone = source.clone();
  if (record) bind(clone, record);
  else setModelGeometryPolygonEdges(clone, undefined);
  if (topology) bindTopology(clone, topology);
  else setModelGeometryTopology(clone, undefined);
  return clone;
}
