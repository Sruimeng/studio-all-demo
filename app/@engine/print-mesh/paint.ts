import { Triangle, Vector3 } from 'three';
import type { LowResult } from '../multicolor';
import type { ViewerHit } from '../viewer';
export function uvHit(hit: ViewerHit, low: LowResult) {
  if (!low.luv) return null;
  const vertices = [0, 1, 2].map(corner => new Vector3().fromArray(low.lpos, low.lidx[hit.face * 3 + corner]! * 3));
  const triangle = new Triangle(vertices[0], vertices[1], vertices[2]);
  const bary = triangle.getBarycoord(new Vector3(...hit.point), new Vector3());
  if (!bary) return null;
  const offset = hit.face * 6; const uv = low.luv;
  const u = bary.x * uv[offset]! + bary.y * uv[offset + 2]! + bary.z * uv[offset + 4]!;
  const v = bary.x * uv[offset + 1]! + bary.y * uv[offset + 3]! + bary.z * uv[offset + 5]!;
  const areaUV = Math.abs((uv[offset + 2]! - uv[offset]!) * (uv[offset + 5]! - uv[offset + 1]!) - (uv[offset + 4]! - uv[offset]!) * (uv[offset + 3]! - uv[offset + 1]!));
  return { img: low.matImage[low.lmat[hit.face]!] ?? -1, u, v, r: Math.min(1, hit.radius * Math.sqrt(areaUV / Math.max(triangle.getArea() * 2, 1e-12))) };
}
