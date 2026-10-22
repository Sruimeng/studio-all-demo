import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh } from 'three';
import { assignFaces, connectedPieces, extractGroup, geometryKey, suggestPlan, validatePlan } from '../app/@feature/segmentation/geometry';
import { freshDraft, optionsKey, type SegmentPlan } from '../app/@feature/segmentation/types';
import type { PrintMeshInput } from '../app/@engine/multicolor';

function cube(): PrintMeshInput {
  const geometry = new BoxGeometry(1, 1, 1).toNonIndexed();
  const positions = geometry.getAttribute('position').array as Float32Array;
  return { positions, indices: Uint32Array.from({ length: positions.length / 3 }, (_, i) => i), colors: new Float32Array(positions.length).fill(200), uvs: null, faceMat: new Uint32Array(positions.length / 9), materials: [{ image: -1, factor: [1, 1, 1] }], images: [] };
}
function whole(mesh: PrintMeshInput): SegmentPlan { return { key: geometryKey(mesh), optionsKey: optionsKey('parts', freshDraft().options), groups: [{ id: 0, name: '整体', color: '#ffffff' }], labels: new Array(mesh.positions.length / 9).fill(0), edited: false }; }

describe('real segment geometry', () => {
  it('keeps the entire original mesh, while extracting connected regions into separate meshes', () => {
    const mesh = cube(), plan = suggestPlan(mesh, 'parts', { ...freshDraft().options, prompt: '头部与身体分开' });
    expect(plan.groups.map(g => g.name)).toEqual(['头部候选', '其余整体']);
    const pieces = connectedPieces(mesh, plan);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.reduce((n, p) => n + p.faces.length, 0)).toBe(12);
    expect(new Set(pieces.flatMap(p => p.faces)).size).toBe(12);
    expect(pieces.some(p => p.boundary > 0)).toBe(true);
    const root = extractGroup(mesh, pieces);
    expect(root.children).toHaveLength(pieces.length);
    expect(root.children.every(p => p instanceof Mesh && p.userData.sealedBySegment === false)).toBe(true);
    for (const p of root.children as Mesh[]) { expect(p.geometry.getAttribute('uv')).toBeUndefined(); expect(p.position.toArray()).toEqual([0, 0, 0]); }
  });
  it('identifies a closed source and open extracted patches without pretending to cap them', () => {
    const mesh = cube(); expect(connectedPieces(mesh, whole(mesh))).toMatchObject([{ boundary: 0, nonManifold: 0 }]);
    const moved = assignFaces(whole(mesh), [0, 1], 0, '一侧');
    const result = connectedPieces(mesh, moved); expect(result).toHaveLength(2); expect(result.every(p => p.boundary > 0)).toBe(true);
  });
  it('does not join coincident surfaces from separate source mesh domains', () => {
    const mesh = cube(), original = mesh.positions;
    mesh.positions = new Float32Array([...original, ...original]);
    mesh.faceDomain = Uint32Array.from({ length: 24 }, (_, f) => f < 12 ? 0 : 1);
    const pieces = connectedPieces(mesh, whole(mesh));
    expect(pieces).toHaveLength(2); expect(pieces.map(p => p.faces.length)).toEqual([12, 12]); expect(pieces.every(p => p.boundary === 0)).toBe(true);
  });
  it('reassigns ownership without duplicating or dropping faces; empty groups disappear', () => {
    const mesh = cube(), initial = whole(mesh), next = assignFaces(initial, [0, 1], 0, '新部件');
    expect(initial.groups).toHaveLength(1); expect(initial.labels.every(id => id === 0)).toBe(true);
    expect(next.groups).toHaveLength(2); expect(next.labels.slice(0, 3)).toEqual([1, 1, 0]);
    const merged = assignFaces(next, [0, 1], 0); expect(merged.groups).toHaveLength(1); expect(merged.labels).toHaveLength(12);
    expect(() => assignFaces(initial, [-1], 0)).toThrow(); expect(() => assignFaces(initial, [0], 99)).toThrow();
  });
  it('blocks incomplete and stale plans, and does not silently accept unsupported text', () => {
    const mesh = cube(), plan = whole(mesh); plan.labels[0] = 9;
    expect(() => validatePlan(plan, mesh)).toThrow('未分配');
    plan.labels[0] = 0; mesh.positions[0]! += 0.1;
    expect(() => validatePlan(plan, mesh)).toThrow('版本');
    expect(() => suggestPlan(mesh, 'parts', { ...freshDraft().options, prompt: '拆出不存在的帽子' })).toThrow('自由语义');
  });
  it('uses actual input colors and retains all geometry when grouping nearby colors', () => {
    const mesh = cube(), colors = new Float32Array(36);
    for (let i = 0; i < 12; i++) colors.set(i < 6 ? [200, 20, 20] : [10, 20, 200], i * 3);
    const plan = suggestPlan(mesh, 'colors', freshDraft().options, colors);
    expect(plan.labels).toHaveLength(12); expect(plan.groups.length).toBeGreaterThanOrEqual(2); expect(() => validatePlan(plan, mesh)).not.toThrow();
    expect(() => suggestPlan(mesh, 'colors', freshDraft().options)).toThrow('颜色依据');
  });
});
