import { expect, it } from 'vitest';
import type { InitResult } from '../app/@engine/multicolor';
import { inspectMesh, monochromeSTL, newPreparation, restorePreparation } from '../app/@feature/workspace/print-preparation';
const mesh = (idx: number[]) => ({ wpos: new Float32Array([0,0,0,1,0,0,0,1,0,0,0,1]), widx: new Uint32Array(idx), bbox: { minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 } }) as InitResult;
it('reports actual boundaries, non-manifold edges, duplicates and inconsistent winding', () => {
  expect(inspectMesh(mesh([0,2,1,0,1,3,1,2,3,2,0,3]))).toMatchObject({ available: true, boundary: 0, nonManifold: 0, winding: 0, degenerate: 0, duplicates: 0 });
  expect(inspectMesh(mesh([0,2,1,0,1,3,1,2,3]))).toMatchObject({ boundary: 3 });
  expect(inspectMesh(mesh([0,2,1,0,2,1,0,1,3]))).toMatchObject({ nonManifold: 1, duplicates: 1, winding: 2 });
  expect(inspectMesh(mesh([0,0,1])).degenerate).toBe(1);
  expect(inspectMesh(mesh([0,1,99])).available).toBe(false);
});
it('binary STL uses millimetres and converts Y-up to Z-up with ground at zero', async () => {
  const file = monochromeSTL(mesh([0,1,2]), 80); const data = new DataView(await file.arrayBuffer());
  expect(file.size).toBe(134); expect(data.getUint32(80, true)).toBe(1);
  // third vertex is source (0,1,0), exported as (-40,40,80).
  expect([120,124,128].map(offset => data.getFloat32(offset, true))).toEqual([-40,40,80]);
});
it('old projects default to unconfirmed size and invalid preparation backups are rejected', () => {
  expect(restorePreparation()).toEqual(newPreparation());
  expect(() => restorePreparation({ ...newPreparation(), sizeConfirmedHeight: NaN })).toThrow('Invalid');
});
