// 几何元数据的共享与失效回归；真实 Three clone/index 更新不能留下错位的原始边。
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { cloneModelGeometry, getModelGeometryPolygonEdges, getModelGeometryTopology, type ModelGeometryTopology, setModelGeometryPolygonEdges, setModelGeometryTopology } from '../../model/lib/model-geometry-metadata';

/** 两个三角形组成四边形，可检查同面数重排及位置更新。 */
function geometry(): BufferGeometry {
  const result = new BufferGeometry();
  result.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
  result.setIndex([0, 1, 2, 0, 2, 3]);
  return result;
}

/** 源 ID 不受展开后的渲染顶点数约束；一个四边面对应六个渲染顶点。 */
function topology(): Omit<ModelGeometryTopology, 'revision'> {
  return {
    cornerVertexIds: new Uint32Array([10, 11, 12, 13]),
    faceOffsets: new Uint32Array([0, 4]),
    renderVertexCorners: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}

describe('Model polygon metadata', () => {
  it('共享只读记录，单个 clone 更新或失效不影响源与其他副本', () => {
    const source = geometry();
    const masks = new Uint8Array([3, 6]);
    setModelGeometryPolygonEdges(source, masks);
    const record = getModelGeometryPolygonEdges(source)!;
    const a = cloneModelGeometry(source);
    const b = cloneModelGeometry(source);
    expect(getModelGeometryPolygonEdges(a)).toBe(record);
    expect(getModelGeometryPolygonEdges(b)?.masks).toBe(masks);
    setModelGeometryPolygonEdges(a, new Uint8Array([0, 7]));
    expect(getModelGeometryPolygonEdges(a)?.revision).toBe(record.revision + 1);
    setModelGeometryPolygonEdges(b, undefined);
    expect(getModelGeometryPolygonEdges(b)).toBeUndefined();
    expect(getModelGeometryPolygonEdges(source)).toBe(record);
    expect(source.userData).not.toBe(b.userData);
    expect(getModelGeometryPolygonEdges(source.clone())).toBeUndefined();
  });

  it('位置数值与姿态更新保留标记，索引同面数重排或替换失效', () => {
    const source = geometry();
    setModelGeometryPolygonEdges(source, new Uint8Array([3, 6]));
    const record = getModelGeometryPolygonEdges(source);
    source.translate(2, 0, 0);
    source.morphAttributes.position = [source.getAttribute('position').clone()];
    expect(getModelGeometryPolygonEdges(source)).toBe(record);
    source.index!.set([0, 2, 3, 0, 1, 2]);
    source.index!.needsUpdate = true;
    expect(getModelGeometryPolygonEdges(source)).toBeUndefined();
    setModelGeometryPolygonEdges(source, new Uint8Array([6, 3]));
    source.setIndex([0, 1, 2, 0, 2, 3]);
    expect(getModelGeometryPolygonEdges(source)).toBeUndefined();
  });

  it('拒绝非法发布，损坏记录、detach 或未维护的转换回退', () => {
    const source = geometry();
    for (const masks of [new Uint8Array([3]), new Uint8Array([0, 8]), new Uint16Array([3, 6])]) {
      expect(() => setModelGeometryPolygonEdges(source, masks as Uint8Array)).toThrow('final triangles');
    }
    const masks = new Uint8Array([3, 6]);
    setModelGeometryPolygonEdges(source, masks);
    expect(getModelGeometryPolygonEdges(source.toNonIndexed())).toBeUndefined();
    source.userData = { ...source.userData, modelPolygonEdges: { masks, revision: 1 } };
    expect(getModelGeometryPolygonEdges(source)).toBeUndefined();
    setModelGeometryPolygonEdges(source, masks);
    structuredClone(masks, { transfer: [masks.buffer] });
    expect(getModelGeometryPolygonEdges(source)).toBeUndefined();
  });
});

describe('Model source topology metadata', () => {
  it('受控 clone 共享只读记录并独立绑定；替换递增 revision，撤销不影响其他副本', () => {
    const source = geometry().toNonIndexed();
    setModelGeometryTopology(source, topology());
    const record = getModelGeometryTopology(source)!;
    const a = cloneModelGeometry(source);
    const b = cloneModelGeometry(source);
    expect(Object.isFrozen(record)).toBe(true);
    expect(getModelGeometryTopology(a)).toBe(record);
    expect(getModelGeometryTopology(b)?.cornerVertexIds).toBe(record.cornerVertexIds);
    expect(getModelGeometryTopology(source.clone())).toBeUndefined();
    setModelGeometryTopology(a, topology());
    expect(getModelGeometryTopology(a)?.revision).toBe(record.revision + 1);
    setModelGeometryTopology(b, undefined);
    expect(getModelGeometryTopology(b)).toBeUndefined();
    expect(getModelGeometryTopology(source)).toBe(record);
  });

  it('位置数值和 morph 更新保持身份，position/index 结构变化失效', () => {
    const source = geometry().toNonIndexed();
    setModelGeometryTopology(source, topology());
    const record = getModelGeometryTopology(source);
    source.translate(1, 2, 3);
    source.morphAttributes.position = [source.getAttribute('position').clone()];
    expect(getModelGeometryTopology(source)).toBe(record);
    source.setAttribute('position', source.getAttribute('position').clone());
    expect(getModelGeometryTopology(source)).toBeUndefined();
    setModelGeometryTopology(source, topology());
    (source.getAttribute('position') as Float32BufferAttribute).array = new Float32Array(18);
    expect(getModelGeometryTopology(source)).toBeUndefined();
    setModelGeometryTopology(source, topology());
    source.setIndex([0, 1, 2, 3, 4, 5]);
    expect(getModelGeometryTopology(source)).toBeUndefined();
    expect(getModelGeometryTopology(cloneModelGeometry(source))).toBeUndefined();
  });

  it('明确拒绝 indexed 发布，校验失败不替换已有有效记录', () => {
    expect(() => setModelGeometryTopology(geometry(), topology())).toThrow('non-indexed');
    const source = geometry().toNonIndexed();
    setModelGeometryTopology(source, topology());
    const record = getModelGeometryTopology(source);
    const invalid: Omit<ModelGeometryTopology, 'revision'>[] = [
      { ...topology(), faceOffsets: new Uint16Array([0, 4]) as unknown as Uint32Array },
      { ...topology(), faceOffsets: new Uint32Array([1, 4]) },
      { ...topology(), faceOffsets: new Uint32Array([0, 3]) },
      { ...topology(), faceOffsets: new Uint32Array([0, 2, 4]) },
      { ...topology(), cornerVertexIds: new Uint32Array([10, 11, 12, 10]) },
      { ...topology(), renderVertexCorners: new Uint32Array([0, 1, 4, 0, 2, 3]) },
      { ...topology(), renderVertexCorners: new Uint32Array([0, 1, 2, 0, 2, 2]) },
      { ...topology(), renderVertexCorners: new Uint32Array([0, 1, 2, 0, 1, 3]) },
    ];
    for (const data of invalid) {
      expect(() => setModelGeometryTopology(source, data)).toThrow('Model topology');
      expect(getModelGeometryTopology(source)).toBe(record);
    }
  });

  it('源面覆盖完整且允许三角重排，禁止三角跨源面或漏源面', () => {
    const source = geometry().toNonIndexed();
    const data = {
      cornerVertexIds: new Uint32Array([0, 1, 2, 0, 2, 3]),
      faceOffsets: new Uint32Array([0, 3, 6]),
      renderVertexCorners: new Uint32Array([3, 4, 5, 0, 1, 2]),
    };
    setModelGeometryTopology(source, data);
    expect(getModelGeometryTopology(source)?.renderVertexCorners).toBe(data.renderVertexCorners);
    expect(() => setModelGeometryTopology(source, { ...data, renderVertexCorners: new Uint32Array([0, 1, 5, 3, 4, 2]) })).toThrow('one source face');
    expect(() => setModelGeometryTopology(source, { ...data, renderVertexCorners: new Uint32Array([0, 1, 2, 0, 1, 2]) })).toThrow('cover every source face');
  });

  it.each(['cornerVertexIds', 'faceOffsets', 'renderVertexCorners'] as const)('%s detach 或 userData 伪造后不再借用', (key) => {
    const source = geometry().toNonIndexed();
    const data = topology();
    setModelGeometryTopology(source, data);
    structuredClone(data[key], { transfer: [data[key].buffer] });
    expect(getModelGeometryTopology(source)).toBeUndefined();
    setModelGeometryTopology(source, topology());
    source.userData.modelGeometryTopology = { ...getModelGeometryTopology(source) };
    expect(getModelGeometryTopology(source)).toBeUndefined();
  });
});
