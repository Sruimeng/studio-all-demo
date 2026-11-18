import type { CutPlane, MeshData, Point3 } from './types';

export interface CutBounds { min: Point3; max: Point3; size: Point3; empty: boolean }
/** Bounds of retained triangles, including new edge/plane intersections. No mesh welding or capping is needed. */
export function clippedBounds(mesh: MeshData, plane: CutPlane): CutBounds {
  const min: Point3 = [Infinity, Infinity, Infinity], max: Point3 = [-Infinity, -Infinity, -Infinity];
  const p = mesh.positions, idx = mesh.indices, n = plane.normal;
  const distance = (id: number) => p[id * 3]! * n[0] + p[id * 3 + 1]! * n[1] + p[id * 3 + 2]! * n[2] - plane.offset;
  const add = (a: number, b = a, t = 0) => {
    for (let c = 0; c < 3; c++) {
      const v = p[a * 3 + c]! + (p[b * 3 + c]! - p[a * 3 + c]!) * t;
      min[c] = Math.min(min[c]!, v); max[c] = Math.max(max[c]!, v);
    }
  };
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i]!, b = idx[i + 1]!, c = idx[i + 2]!;
    const da = distance(a), db = distance(b), dc = distance(c);
    // A face on the cut plane alone has no retained volume.
    if (Math.max(da, db, dc) <= 0) continue;
    if (da >= 0) add(a); if (db >= 0) add(b); if (dc >= 0) add(c);
    if ((da < 0) !== (db < 0)) add(a, b, da / (da - db));
    if ((db < 0) !== (dc < 0)) add(b, c, db / (db - dc));
    if ((dc < 0) !== (da < 0)) add(c, a, dc / (dc - da));
  }
  if (!Number.isFinite(min[0])) return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0], empty: true };
  return { min, max, size: max.map((v, i) => v - min[i]!) as Point3, empty: false };
}
