import { Vector3 } from 'three';

export interface DistanceSample { point: Vector3; normal: Vector3; distance: number }
/** A bounded, lazily sampled distance field around a continuous surface patch.
 * The sign uses the oriented closest triangle: only use this in a narrow band,
 * never as an inside/outside classifier for an arbitrary or open solid.
 * Final positions are always checked against the original triangles.
 */
export function createLocalSurfaceSdf(nearest: (point: Vector3, reach: number) => DistanceSample | null, cellSize: number) {
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error('Invalid distance-field resolution');
  const values = new Map<string, number | null>();
  const h = cellSize;
  function lattice(x: number, y: number, z: number) {
    const key = `${x},${y},${z}`;
    if (values.has(key)) return values.get(key)!;
    const p = new Vector3(x * h, y * h, z * h), hit = nearest(p, h * 5);
    const d = hit ? p.sub(hit.point).dot(hit.normal) : 0;
    const value = hit ? (d < 0 ? -1 : 1) * hit.distance : null;
    // Bound memory for long drags; a field cannot retain the entire base volume.
    if (values.size >= 24000) values.clear();
    values.set(key, value); return value;
  }
  function sample(point: Vector3) {
    const q = point.clone().divideScalar(h), x = Math.floor(q.x), y = Math.floor(q.y), z = Math.floor(q.z);
    const t = [q.x - x, q.y - y, q.z - z];
    let distance = 0; const gradient = new Vector3();
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
      const value = lattice(x + i, y + j, z + k); if (value === null) return null;
      const wx = i ? t[0]! : 1 - t[0]!, wy = j ? t[1]! : 1 - t[1]!, wz = k ? t[2]! : 1 - t[2]!;
      distance += wx * wy * wz * value;
      gradient.x += (i ? 1 : -1) * wy * wz * value / h;
      gradient.y += wx * (j ? 1 : -1) * wz * value / h;
      gradient.z += wx * wy * (k ? 1 : -1) * value / h;
    }
    return { distance, gradient };
  }
  function project(point: Vector3, normal: Vector3, reach: number) {
    const position = point.clone();
    for (let i = 0; i < 4; i++) {
      const value = sample(position); if (!value) return null;
      const length = value.gradient.length();
      // Reject ambiguous gradients at creases, narrow gaps and medial axes.
      if (length < 0.5 || length > 1.5 || Math.abs(value.gradient.dot(normal) / length) < 0.8) return null;
      if (Math.abs(value.distance) < h * 0.01) break;
      position.addScaledVector(value.gradient, -value.distance / (length * length));
      if (position.distanceTo(point) > reach) return null;
    }
    const value = sample(position); if (!value || Math.abs(value.distance) > h * 0.08) return null;
    const outward = value.gradient.normalize(); if (outward.dot(normal) < 0) outward.negate();
    return { point: position, normal: outward, distance: position.distanceTo(point) };
  }
  return { sample, project, get sampleCount() { return values.size; } };
}
