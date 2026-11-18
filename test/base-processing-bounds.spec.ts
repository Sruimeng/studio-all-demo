import { expect, it } from 'vitest';
import { BoxGeometry, ConeGeometry } from 'three';
import { clippedBounds, cutMesh } from '../app/@engine/base-processing';
import type { CutPlane, Point3 } from '../app/@engine/base-processing';

it('includes triangle-plane intersections when the widest part has been removed', () => {
  const g = new ConeGeometry(10, 20, 4), mesh = { positions: new Float32Array(g.attributes.position!.array), indices: new Uint32Array(g.index!.array) }; g.dispose();
  const bounds = clippedBounds(mesh, { normal: [0, 1, 0], offset: 0, cap: true });
  expect(bounds.size[0]).toBeCloseTo(10); expect(bounds.size[1]).toBeCloseTo(10); expect(bounds.size[2]).toBeCloseTo(10);
});

it.each([[0, 1, 0], [1, 0, 0], [0, 0, -1], [1, 1, 1]] as Point3[])('matches actual clipped mesh bounds for normal %j', (...normal) => {
  const g = new BoxGeometry(20, 30, 40), mesh = { positions: new Float32Array(g.attributes.position!.array), indices: new Uint32Array(g.index!.array) }; g.dispose();
  const plane: CutPlane = { normal, offset: 3, cap: true }, bounds = clippedBounds(mesh, plane), result = cutMesh(mesh, plane);
  for (let c = 0; c < 3; c++) {
    const values = result.positions.filter((_, i) => i % 3 === c);
    expect(bounds.min[c]).toBeCloseTo(Math.min(...values), 4); expect(bounds.max[c]).toBeCloseTo(Math.max(...values), 4);
  }
});
