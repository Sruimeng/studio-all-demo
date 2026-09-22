// 原始面标记沿普通 loader 的最终三角输出验证，不按坐标猜测对角线身份。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Matrix4, ShapeUtils } from 'three';
import { getModelGeometryPolygonEdges, getModelGeometryTopology } from '~/@engine/model';
import type { FBXGeometryNode } from '../loaders/fbx/constants';
import { GeometryParser } from '../loaders/fbx/parse/FBX-geometry-parser';

afterEach(() => vi.restoreAllMocks());

/** 使用逐角 UV 编号观察三角化后的源角点顺序。 */
function parseFace(points: number[][]) {
  return new GeometryParser().genBuffers({
    uv: [{ buffer: points.flatMap((_, i) => [i, 0]), dataSize: 2, indices: [], mappingType: 'ByPolygonVertex', referenceType: 'Direct' }],
    vertexIndices: points.map((_, i) => i === points.length - 1 ? -i - 1 : i),
    vertexPositions: points.flat(),
  });
}

/** 从真实输出与标记解码源边，独立对照原多边形环。 */
function edges(buffers: ReturnType<typeof parseFace>): string[] {
  const result: string[] = [];
  for (let face = 0; face < buffers.polygonEdgeMasks.length; face++) {
    for (let edge = 0; edge < 3; edge++) {
      if (!(buffers.polygonEdgeMasks[face]! & (1 << edge))) continue;
      const a = buffers.uvs[0]![face * 6 + edge * 2]!;
      const b = buffers.uvs[0]![face * 6 + ((edge + 1) % 3) * 2]!;
      result.push([a, b].sort((x, y) => x - y).join('-'));
    }
  }
  return result.sort();
}

describe('FBX polygon edge masks', () => {
  it.each([
    [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
    [[0, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, 0]],
    [[0, 0, 0], [2, 0, 0], [1, 0.5, 0], [2, 2, 0], [0, 2, 0]],
  ])('只输出原始面环，顺逆绕向和凹面一致：%j', (...points) => {
    const buffers = parseFace(points);
    const expected = points.map((_, i) => [i, (i + 1) % points.length].sort((a, b) => a - b).join('-')).sort();
    expect(edges(buffers)).toEqual(expected);
    expect(buffers.polygonEdgeMasks.length * 9).toBe(buffers.vertex.length);
    expect(buffers.topology?.faceOffsets).toEqual([0, points.length]);
    expect(buffers.topology?.cornerVertexIds).toEqual(points.map((_, i) => i));
    expect(buffers.topology?.renderVertexCorners).toEqual(buffers.uvs[0]!.filter((_, i) => i % 2 === 0));
  });

  it('包含没有原始边的内部三角形时合法保留 0', () => {
    const points = Array.from({ length: 6 }, (_, i) => [Math.cos(i * Math.PI / 3), Math.sin(i * Math.PI / 3), 0]);
    vi.spyOn(ShapeUtils, 'triangulateShape').mockReturnValue([[0, 1, 2], [2, 3, 4], [4, 5, 0], [0, 2, 4]]);
    const buffers = parseFace(points);
    expect(buffers.polygonEdgeMasks).toEqual([3, 3, 3, 0]);
    expect(edges(buffers)).toHaveLength(6);
  });

  it('重复闭合点或省略角点时，实际输出的整面回退 111', () => {
    const points = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
    const closed = parseFace([...points, points[0]!]);
    expect(closed.polygonEdgeMasks).toEqual([7, 7]);
    expect(closed.topology).toBeUndefined();
    vi.spyOn(ShapeUtils, 'triangulateShape').mockReturnValue([[0, 1, 2]]);
    expect(parseFace(points).polygonEdgeMasks).toEqual([7]);
  });

  it('退化面没有三角输出时不补造几何；非法角点映射仅降级标记', () => {
    expect(parseFace(Array.from({ length: 4 }, () => [0, 0, 0])).polygonEdgeMasks).toEqual([]);
    vi.spyOn(ShapeUtils, 'triangulateShape').mockReturnValue([[0, 1, 8], [0, 2, 3]]);
    const buffers = parseFace([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]);
    expect(buffers.polygonEdgeMasks).toEqual([7, 7]);
    expect(buffers.vertex).toHaveLength(18);
    expect(buffers.topology).toBeUndefined();
  });

  it('真实三角化覆盖所有角点但不完整时整面降级，不改变输出几何', () => {
    const buffers = parseFace([[1, 3, 0], [1, 1, 0], [2, 0, 0], [0, 3, 0], [1, 2, 0], [0, 1, 0], [3, 0, 0]]);
    expect(buffers.polygonEdgeMasks).toEqual([7, 7, 7, 7]);
    expect(buffers.vertex).toHaveLength(36);
  });

  it('输出数量与覆盖均满足但含零面积三角时仍整面降级', () => {
    vi.spyOn(ShapeUtils, 'triangulateShape').mockReturnValue([[0, 1, 2], [0, 2, 3]]);
    expect(parseFace([[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0]]).polygonEdgeMasks).toEqual([7, 7]);
  });
});

/** 完整经过 genGeometry 发布元数据，源索引和最终三角展开来自同一输入。 */
function parseGeometry(points: number[][], vertexIndices: number[]) {
  return new GeometryParser().genGeometry({
    attrName: 'source-topology',
    attrType: 'Mesh',
    GeometryVersion: 124,
    id: 1,
    name: 'Geometry',
    PolygonVertexIndex: { a: vertexIndices, name: 'PolygonVertexIndex', propertyList: [], singleProperty: false },
    propertyList: [],
    singleProperty: false,
    Vertices: { a: points.flat(), name: 'Vertices', propertyList: [], singleProperty: false },
  } satisfies FBXGeometryNode, null, [], new Matrix4()).geometry;
}

describe('FBX source topology', () => {
  it('发布原始 control-point 身份，坐标重合的独立面不会混为一壳', () => {
    const points = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0], [1, 0, 0], [0, 1, 0]];
    const geometry = parseGeometry(points, [0, 1, -3, 3, 4, -6]);
    const record = getModelGeometryTopology(geometry)!;
    expect(geometry.index).toBeNull();
    expect(Array.from(record.faceOffsets)).toEqual([0, 3, 6]);
    expect(Array.from(record.cornerVertexIds)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(Array.from(record.renderVertexCorners)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(Array.from(getModelGeometryPolygonEdges(geometry)!.masks)).toEqual([7, 7]);
  });

  it('四边面映射在最终 geometry 中发布并覆盖全部原始角点', () => {
    const geometry = parseGeometry([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], [0, 1, 2, -4]);
    const record = getModelGeometryTopology(geometry)!;
    expect(Array.from(record.faceOffsets)).toEqual([0, 4]);
    expect(record.renderVertexCorners).toHaveLength(6);
    expect(new Set(record.renderVertexCorners)).toEqual(new Set([0, 1, 2, 3]));
  });

  it.each([
    [0, 1, -3, 0, 1],
    [0, 1, -3, 0, 0, -3],
    [0, 1, -3, 0, 1, -9],
    [0, 1, -3, 0, 1, -2.5],
  ])('坏尾面使整个 geometry 的源拓扑不可用，既有三角输出保留：%j', (...indices) => {
    const geometry = parseGeometry([[0, 0, 0], [1, 0, 0], [0, 1, 0]], indices);
    expect(getModelGeometryTopology(geometry)).toBeUndefined();
    expect(geometry.getAttribute('position').count).toBeGreaterThanOrEqual(3);
    expect(getModelGeometryPolygonEdges(geometry)).toBeDefined();
  });

  it('零面积三角和退化 n-gon 不发布，空几何不补造源面', () => {
    expect(getModelGeometryTopology(parseGeometry([[0, 0, 0], [1, 0, 0], [2, 0, 0]], [0, 1, -3]))).toBeUndefined();
    expect(getModelGeometryTopology(parseGeometry(Array.from({ length: 4 }, () => [0, 0, 0]), [0, 1, 2, -4]))).toBeUndefined();
    expect(getModelGeometryTopology(parseGeometry([], []))).toBeUndefined();
  });

  it('三角数与角点覆盖满足但环边不完整时拒绝精确映射，不改既有掩码', () => {
    vi.spyOn(ShapeUtils, 'triangulateShape').mockReturnValue([[0, 1, 2], [0, 1, 3]]);
    const buffers = parseFace([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]);
    expect(buffers.polygonEdgeMasks).toEqual([3, 5]);
    expect(buffers.topology).toBeUndefined();
  });

  it('morph 复用基础面的展开顺序，只为基础几何保存源身份', () => {
    const vertexPositions = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]].flat();
    const vertexIndices = [0, 1, 2, -4];
    const parser = new GeometryParser();
    const base = parser.genBuffers({ vertexIndices, vertexPositions });
    const morph = parser.genBuffers({ baseVertexPositions: vertexPositions, vertexIndices, vertexPositions: vertexPositions.map(value => value * 2) });
    expect(base.topology).toBeDefined();
    expect(morph.topology).toBeUndefined();
    expect(morph.vertex).toEqual(base.vertex.map(value => value * 2));
    expect(morph.polygonEdgeMasks).toEqual(base.polygonEdgeMasks);
  });
});

describe('FBX face buffer reuse', () => {
  it.each([false, true])('不同面长的多层属性逐面隔离，骨骼：%s', (skinned) => {
    const points = [
      [[0, 0, 0], [2, 0, 1], [1, 0.5, 1.5], [2, 2, 5], [0, 2, 4]],
      [[3, 0, 0], [4, 0, 0], [3, 1, 0]],
      [[0, 1, 2], [1, 1, 2.5], [1, 0, 0.5], [0, 0, 0]],
    ];
    const vertexPositions = points.flat(2);
    let corner = 0;
    const faces = points.map(face => face.map((_, index) => {
      const vertex = corner++;
      return index === face.length - 1 ? -vertex - 1 : vertex;
    }));
    /** 同一源顶点使用可辨认属性，逐面解析与整批解析应输出相同标量。 */
    function attribute(dataSize: number, base: number) {
      return { buffer: Array.from({ length: corner * dataSize }, (_, i) => base + i / 100),
        dataSize, indices: [], mappingType: 'ByVertice', referenceType: 'Direct' };
    }
    const input = {
      color: attribute(3, 0),
      material: { ...attribute(1, 0), buffer: points.flatMap((face, index) => face.map(() => index)) },
      normal: { ...attribute(3, 0), buffer: points.flatMap(face => face.flatMap(() => [0.5, 2, -1])) },
      ...(skinned
        ? { skeleton: { bones: [], geometryID: 1, ID: 'test', rawBones: [] },
            weightTable: { 0: [{ id: 1, weight: 0.2 }, { id: 2, weight: 0.4 }, { id: 3, weight: 0.2 }, { id: 4, weight: 0.1 }, { id: 5, weight: 0.3 }],
              5: [{ id: 6, weight: 0.8 }] } }
        : {}),
      uv: [attribute(2, 0), attribute(2, 10)],
      vertexPositions,
    };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const parser = new GeometryParser();
    const combined = parser.genBuffers({ ...input, vertexIndices: faces.flat() });
    const separate = faces.map(vertexIndices => parser.genBuffers({ ...input, vertexIndices }));
    for (const field of ['vertex', 'normal', 'flatNormal', 'colors', 'materialIndex', 'vertexWeights', 'weightsIndices', 'polygonEdgeMasks'] as const) {
      expect(combined[field], field).toEqual(separate.flatMap(face => face[field]));
    }
    for (let layer = 0; layer < input.uv.length; layer++) {
      expect(combined.uvs[layer]).toEqual(separate.flatMap(face => face.uvs[layer]!));
    }
    expect(combined.topology?.faceOffsets).toEqual([0, 5, 8, 12]);
    expect(combined.topology?.renderVertexCorners).toHaveLength(18);
    expect(combined.topology?.cornerVertexIds).toEqual(Array.from({ length: corner }, (_, i) => i));
    if (skinned) {
      // 三角面首角只有一条权重，不能沿用前一个多边形截断后的四条。
      expect(combined.vertexWeights.slice(36, 40)).toEqual([0.8, 0, 0, 0]);
      expect(combined.weightsIndices.slice(36, 40)).toEqual([6, 0, 0, 0]);
    }
  });
});
