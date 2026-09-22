// FBX 多边形边几何：保留拓扑边，沿实例端点维护包围体。
import { Vector3 } from 'three';
import { EDGE_KEY_STRIDE, EdgeInstanceGeometry, type EdgeRecord, isEdgeVisible, setEdgeInstances } from './edge-geometry-shared';

/**
 * 基于LineSegments2原理的FBX边框几何体（多边形支持）
 * 使用 InstancedBufferGeometry：模板四边形 + 实例化的起止点
 */
export class FBXEdgeGeometry extends EdgeInstanceGeometry {
  /** 无参构造供 Three clone 使用；正常加载传入三组匹配的面数据。 */
  constructor(
    /**
     * 顶点位置数组，每个面一个数组，格式为 [x, y, z, x, y, z, ...]
     */
    positions: number[][] = [],
    /**
     * 顶点索引数组，每个面一个数组，格式为 [顶点数量, 索引1, 索引2, ...]
     */
    indices: number[][] = [],
    /**
     * 每个面的顶点全局索引（FBX control point 索引），与该面的局部索引一一对应。
     * 用于建立 edge → faces 邻接表：同一条边在不同面里的局部索引不同，只有全局索引能配对。
     */
    vertexIndices: number[][] = [],
    options: {
      /**
       * 二面角阈值（度）。相邻两面法线夹角小于该值的边视为共面冗余边并隐藏。
       * 默认 0 = 不做任何过滤、画出全部边：本项目线框是「看拓扑密度」的 toggle，
       * 隐藏共面边会让规则四边网格的内部边成片消失，与 2026-08-25 修掉的缺线 bug 同形。
       * 仅在确有「只看形体折痕」需求时才调高。
       */
      dihedralThreshold?: number;
    } = {},
  ) {
    super();

    const { dihedralThreshold = 0 } = options;
    // 阈值 <= 0 时走快路径：不算面法线、不做可见性判定，直接发射全部唯一边
    const filterByDihedral = dihedralThreshold > 0;
    // 夹角小于阈值 ⇔ 法线点积大于 cos(阈值) ⇔ 判为共面、隐藏
    const cosThreshold = Math.cos((dihedralThreshold * Math.PI) / 180);

    const faceCount = Math.min(positions.length, indices.length, vertexIndices.length);
    const edgeMap = new Map<number, EdgeRecord>();
    // 面法线按面序缓存：一条边要在发射阶段比较两个相邻面的法线，无法在取边时就地判定。
    // 只在开启过滤时分配，避免默认路径付出 3 × faceCount 的内存与计算
    const faceNormals = filterByDihedral ? new Float32Array(faceCount * 3) : null;

    const _s = new Vector3();
    const _e = new Vector3();

    for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
      const facePositions = positions[faceIndex];
      const faceIndices = indices[faceIndex];
      const faceVertexIndices = vertexIndices[faceIndex];
      if (!facePositions || !faceIndices || !faceVertexIndices || faceIndices.length < 4) continue;

      const vertexCount = faceIndices[0];
      if (!vertexCount || vertexCount < 3) continue;
      if (facePositions.length < vertexCount * 3) continue;
      if (faceVertexIndices.length < vertexCount) continue;

      if (faceNormals) {
        this.computeFaceNormalNewell(facePositions, vertexCount, faceNormals, faceIndex * 3);
      }

      for (let i = 0; i < vertexCount; i++) {
        const currentVertexIndex = faceIndices[i + 1];
        const nextVertexIndex = faceIndices[((i + 1) % vertexCount) + 1];
        if (currentVertexIndex === undefined || nextVertexIndex === undefined) continue;
        if (currentVertexIndex >= vertexCount || nextVertexIndex >= vertexCount) continue;

        const globalStart = faceVertexIndices[currentVertexIndex];
        const globalEnd = faceVertexIndices[nextVertexIndex];
        if (globalStart === undefined || globalEnd === undefined) continue;
        // 同一个 control point 被面环重复引用（退化面），该边不存在
        if (globalStart === globalEnd) continue;

        const key
          = globalStart < globalEnd
            ? globalStart * EDGE_KEY_STRIDE + globalEnd
            : globalEnd * EDGE_KEY_STRIDE + globalStart;

        const existing = edgeMap.get(key);
        if (existing) {
          // 第二个面记入 faceB；再有更多面只累加计数，>2 即非流形边、无条件显示
          if (existing.faceCount === 1) existing.faceB = faceIndex;
          existing.faceCount++;
          continue;
        }

        const s3 = currentVertexIndex * 3;
        const e3 = nextVertexIndex * 3;
        _s.set(facePositions[s3] ?? 0, facePositions[s3 + 1] ?? 0, facePositions[s3 + 2] ?? 0);
        _e.set(facePositions[e3] ?? 0, facePositions[e3 + 1] ?? 0, facePositions[e3 + 2] ?? 0);

        // 只剔除真正零长度的退化边：边长与「该不该画」无关，短边同样可能是尖端或密集结构的
        // 必要轮廓。此处曾用 0.001 绝对阈值，在 bbox 对角线约 1.5 的模型上砍掉了 26% 的边，
        // 表现为密集区线框成片消失。可见性判据是下方的二面角，不是长度。
        // 这里的浮点零判定只为保证 shader 拿到的方向向量可归一化。
        if (_s.distanceTo(_e) < 1e-7) continue;

        edgeMap.set(key, {
          end: _e.clone(),
          faceA: faceIndex,
          faceB: -1,
          faceCount: 1,
          start: _s.clone(),
        });
      }
    }

    const visibleEdges: EdgeRecord[] = [];
    for (const edge of edgeMap.values()) {
      if (!isEdgeVisible(edge, faceNormals, filterByDihedral, cosThreshold)) continue;
      visibleEdges.push(edge);
    }
    edgeMap.clear();

    setEdgeInstances(this, visibleEdges);

    visibleEdges.length = 0;
  }

  /**
   * 用 Newell 方法算面法线并写入 out 的 offset 处。
   * 必须自己算几何法线，不能用 FBX 的着色法线（wireframeNormals）——后者可能已被平滑，
   * 平滑恰好把折痕抹平，拿它算二面角会得到「处处共面」。
   * Newell 对非平面 n-gon 也给出稳定结果，这是 FBX 侧不能用单个叉积的原因。
   * 与 parser 的 getNormalNewell 同算法而不复用：parser 依赖本模块，反向导入会成环。
   */
  private computeFaceNormalNewell(
    facePositions: number[],
    vertexCount: number,
    out: Float32Array,
    offset: number,
  ): void {
    let nx = 0;
    let ny = 0;
    let nz = 0;

    for (let i = 0; i < vertexCount; i++) {
      const a = i * 3;
      const b = ((i + 1) % vertexCount) * 3;
      const ax = facePositions[a] ?? 0;
      const ay = facePositions[a + 1] ?? 0;
      const az = facePositions[a + 2] ?? 0;
      const bx = facePositions[b] ?? 0;
      const by = facePositions[b + 1] ?? 0;
      const bz = facePositions[b + 2] ?? 0;

      nx += (ay - by) * (az + bz);
      ny += (az - bz) * (ax + bx);
      nz += (ax - bx) * (ay + by);
    }

    // 退化面（零面积）归一化会得到 NaN，回退成零向量：其点积恒为 0 < cosThreshold，
    // 该边判为可见，与「失败方向宁可多画」一致
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (length > 0) {
      out[offset] = nx / length;
      out[offset + 1] = ny / length;
      out[offset + 2] = nz / length;
    }
  }
}
