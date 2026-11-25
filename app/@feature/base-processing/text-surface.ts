import { BufferAttribute, BufferGeometry, DoubleSide, Matrix4, Quaternion, Ray, Triangle, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { MeshData } from '~/@engine/base-processing';
import { createLocalSurfaceSdf } from './text-sdf';

export interface TextSurfaceHit { point: Vector3; normal: Vector3; distance: number }
const cache = new WeakMap<MeshData, ReturnType<typeof buildSurface>>();
/** One acceleration structure per immutable base mesh; no edits to shared indices. */
export function textBaseSurface(mesh: MeshData) {
  let surface = cache.get(mesh);
  if (!surface) { surface = buildSurface(mesh); cache.set(mesh, surface); }
  return surface;
}
function buildSurface(mesh: MeshData) {
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(mesh.positions, 3)).setIndex(new BufferAttribute(mesh.indices.slice(), 1));
  const tree = new MeshBVH(geometry), triangle = new Triangle();
  const fields = new Map<number, ReturnType<typeof createLocalSurfaceSdf>>();
  function faceNormal(index: number) {
    const positions = geometry.getAttribute('position'), indices = geometry.index!;
    triangle.a.fromBufferAttribute(positions, indices.getX(index * 3));
    triangle.b.fromBufferAttribute(positions, indices.getX(index * 3 + 1));
    triangle.c.fromBufferAttribute(positions, indices.getX(index * 3 + 2));
    return triangle.getNormal(new Vector3());
  }
  const surface = {
    raycast(origin: Vector3, direction: Vector3, distance = Infinity): TextSurfaceHit | null {
      const hit = tree.raycastFirst(new Ray(origin, direction), DoubleSide, 0, distance);
      if (!hit) return null;
      const normal = hit.face!.normal.clone(); if (normal.dot(direction) > 0) normal.negate();
      return { point: hit.point, normal, distance: hit.distance };
    },
    nearest(point: Vector3, distance: number): TextSurfaceHit | null {
      const hit = tree.closestPointToPoint(point, undefined, 0, distance); if (!hit) return null;
      const normal = faceNormal(hit.faceIndex), delta = point.clone().sub(hit.point);
      // Orient toward the query, independent of the imported mesh's winding.
      if (normal.dot(delta) < 0) normal.negate();
      return { ...hit, normal };
    },
    /** Interpolated distance gradients smooth faceted normals, while exact
     * patch projection prevents jumping to a neighboring cloud lobe. */
    field(cellSize: number) {
      const size = Math.max(1e-5, cellSize);
      if (!fields.has(size)) {
        if (fields.size >= 3) fields.clear();
        fields.set(size, createLocalSurfaceSdf((point, reach) => {
          const hit = tree.closestPointToPoint(point, undefined, 0, reach);
          return hit ? { ...hit, normal: faceNormal(hit.faceIndex) } : null;
        }, size));
      }
      const field = fields.get(size)!;
      return {
        project(point: Vector3, normal: Vector3, reach: number): TextSurfaceHit | null {
          const exact = surface.project(point, normal, reach); if (!exact) return null;
          const estimate = field.project(exact.point, normal, Math.min(reach, size));
          if (!estimate || estimate.normal.dot(exact.normal) < 0.9 || estimate.point.distanceTo(exact.point) > size * 0.5) return exact;
          // SDF is guidance, not a substitute for the original geometric surface.
          return { ...exact, normal: estimate.normal };
        },
      };
    },
    /** Project only within the current patch, using its outward direction.
     * Choose the hit closest to the prediction instead of the first outer lobe. */
    project(point: Vector3, normal: Vector3, reach: number): TextSurfaceHit | null {
      const hits = tree.raycast(new Ray(point.clone().addScaledVector(normal, reach), normal.clone().negate()), DoubleSide, 0, reach * 2);
      let best: TextSurfaceHit | null = null;
      for (const hit of hits) {
        const n = hit.face!.normal.clone();
        if (n.dot(normal) < 0) n.negate();
        const distance = hit.point.distanceTo(point);
        if (n.dot(normal) < 0.65 || (best && distance >= best.distance)) continue;
        best = { point: hit.point, normal: n, distance };
      }
      return best;
    },
    smooth(hit: TextSurfaceHit, radius: number): TextSurfaceHit {
      const frame = textSurfaceOrientation(hit.normal), sum = hit.normal.clone().multiplyScalar(2);
      const right = new Vector3(1, 0, 0).applyQuaternion(frame), up = new Vector3(0, 1, 0).applyQuaternion(frame);
      for (const tangent of [right, up]) for (const sign of [-1, 1]) {
        const next = surface.project(hit.point.clone().addScaledVector(tangent, radius * sign), hit.normal, radius * 0.7);
        // Never smooth across a sharp rim or a gap.
        if (next && next.normal.dot(hit.normal) > 0.8) sum.add(next.normal);
      }
      return { ...hit, normal: sum.normalize() };
    },
    follow(from: TextSurfaceHit, target: TextSurfaceHit, step: number): TextSurfaceHit | null {
      let current = from;
      const count = Math.ceil(from.point.distanceTo(target.point) / step);
      if (count > 48) return null;
      for (let i = 0; i < count; i++) {
        const delta = target.point.clone().sub(current.point);
        delta.addScaledVector(current.normal, -delta.dot(current.normal));
        const length = delta.length(); if (length < step * 0.1) break;
        const distance = Math.min(step, length), prediction = current.point.clone().addScaledVector(delta, distance / length);
        const next = surface.project(prediction, current.normal, step * 0.7);
        if (!next || next.normal.dot(current.normal) < 0.8 || next.point.distanceTo(current.point) > step * 1.4) return null;
        current = next;
      }
      return current.point.distanceTo(target.point) <= step && current.normal.dot(target.normal) > 0.75 ? target : null;
    },
  };
  return surface;
}

/** Local text +Z faces out of the surface; keep letters upright on side walls. */
export function textSurfaceOrientation(normal: Vector3, previous?: Quaternion) {
  if (previous) {
    const oldNormal = new Vector3(0, 0, 1).applyQuaternion(previous);
    return new Quaternion().setFromUnitVectors(oldNormal, normal).multiply(previous).normalize();
  }
  const up = Math.abs(normal.y) > 0.9 ? new Vector3(0, 0, -1) : new Vector3(0, 1, 0);
  up.addScaledVector(normal, -up.dot(normal)).normalize();
  const right = new Vector3().crossVectors(up, normal).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, up, normal));
}

/** Conforming edge splits give large flat letter faces enough vertices to bend.
 * All copies of a shared edge make the same split, preserving the closed solid. */
export function subdivideText(mesh: MeshData, maxEdge = 1.2): MeshData {
  const positions = Array.from(mesh.positions); let indices = Array.from(mesh.indices);
  for (let pass = 0; pass < 6; pass++) {
    const next: number[] = []; let changed = false;
    const midpoint = (a: number, b: number) => {
      const index = positions.length / 3;
      for (let axis = 0; axis < 3; axis++) positions.push((positions[a * 3 + axis]! + positions[b * 3 + axis]!) / 2);
      return index;
    };
    const long = (a: number, b: number) => [0, 1, 2].reduce((sum, axis) => sum + (positions[a * 3 + axis]! - positions[b * 3 + axis]!) ** 2, 0) > maxEdge ** 2;
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i]!, b = indices[i + 1]!, c = indices[i + 2]!;
      const ab = long(a, b) ? midpoint(a, b) : -1, bc = long(b, c) ? midpoint(b, c) : -1, ca = long(c, a) ? midpoint(c, a) : -1;
      const mask = (ab >= 0 ? 1 : 0) + (bc >= 0 ? 2 : 0) + (ca >= 0 ? 4 : 0); changed ||= !!mask;
      if (mask === 0) next.push(a, b, c);
      if (mask === 1) next.push(a, ab, c, ab, b, c);
      if (mask === 2) next.push(a, b, bc, a, bc, c);
      if (mask === 4) next.push(a, b, ca, ca, b, c);
      if (mask === 3) next.push(ab, b, bc, a, ab, bc, a, bc, c);
      if (mask === 5) next.push(a, ab, ca, ab, b, c, ca, ab, c);
      if (mask === 6) next.push(ca, bc, c, a, b, bc, a, bc, ca);
      if (mask === 7) next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    indices = next;
    if (!changed || indices.length > 600000) break;
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

interface SurfaceSample { point: Vector3; normal: Vector3; frame: Quaternion }

/** Trace a small continuous surface chart, following arc length instead of
 * projecting the entire word in one direction. Every grid edge is validated,
 * including the spaces between letters, so a word cannot jump over a groove. */
export function conformTextToBase(mesh: MeshData, base: MeshData, anchor: Vector3, orientation: Quaternion, unit: number, depth: number) {
  return conformWithField(mesh, base, anchor, orientation, unit, depth, true)
    ?? conformWithField(mesh, base, anchor, orientation, unit, depth, false);
}
// Distance interpolation is only accepted when the entire chart passes the
// same fold/gap checks. Keep the exact-mesh fallback around sharp creases.
function conformWithField(mesh: MeshData, base: MeshData, anchor: Vector3, orientation: Quaternion, unit: number, depth: number, useField: boolean): { mesh: MeshData; curved: boolean } | null {
  if (!Number.isFinite(unit) || unit <= 0) return null;
  const surface = textBaseSurface(base), normal = new Vector3(0, 0, 1).applyQuaternion(orientation);
  const field = useField ? surface.field(0.2 * unit) : surface;
  let width = 0, height = 0;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    width = Math.max(width, Math.abs(mesh.positions[i]!)); height = Math.max(height, Math.abs(mesh.positions[i + 1]!));
  }
  if (!Number.isFinite(width + height) || width < 1e-6 || height < 1e-6) return null;
  const nx = Math.max(1, Math.ceil(width / 0.65)), ny = Math.max(1, Math.ceil(height / 0.65));
  if ((nx * 2 + 1) * (ny * 2 + 1) > 16000) return null;
  const dx = width / nx, dy = height / ny, columns = nx * 2 + 1, rows = ny * 2 + 1;
  const samples: SurfaceSample[] = new Array(columns * rows);
  const index = (x: number, y: number) => (x + nx) * rows + y + ny;
  samples[index(0, 0)] = { point: anchor.clone(), normal, frame: orientation.clone() };
  function walk(previous: SurfaceSample, axis: Vector3, amount: number): SurfaceSample | null {
    const step = Math.abs(amount * unit), tangent = axis.clone().applyQuaternion(previous.frame);
    const prediction = previous.point.clone().addScaledVector(tangent, amount * unit);
    const hit = field.project(prediction, previous.normal, Math.max(step * 0.7, 0.08 * unit));
    if (!hit || hit.normal.dot(previous.normal) < 0.8 || hit.normal.dot(normal) < -0.1) return null;
    const travel = hit.point.distanceTo(previous.point);
    if (travel > step * 1.35 || travel < step * 0.65) return null;
    // Reject a distant branch even if it lies close to the projected ray.
    return { point: hit.point, normal: hit.normal, frame: textSurfaceOrientation(hit.normal, previous.frame) };
  }
  const xAxis = new Vector3(1, 0, 0), yAxis = new Vector3(0, 1, 0);
  for (const sign of [-1, 1]) for (let x = 1; x <= nx; x++) {
    const next = walk(samples[index((x - 1) * sign, 0)]!, xAxis, dx * sign);
    if (!next) return null; samples[index(x * sign, 0)] = next;
  }
  for (let x = -nx; x <= nx; x++) for (const sign of [-1, 1]) for (let y = 1; y <= ny; y++) {
    const next = walk(samples[index(x, (y - 1) * sign)]!, yAxis, dy * sign);
    if (!next) return null; samples[index(x, y * sign)] = next;
  }
  // Neighboring columns must form a usable, consistently oriented strip.
  // Also check the outward offset so thick text cannot fold at a concavity.
  for (let x = -nx; x < nx; x++) for (let y = -ny; y < ny; y++) {
    const a = samples[index(x, y)]!, b = samples[index(x + 1, y)]!, c = samples[index(x, y + 1)]!;
    for (const offset of [0, depth * unit]) {
      const ab = b.point.clone().sub(a.point).addScaledVector(b.normal, offset).addScaledVector(a.normal, -offset);
      const ac = c.point.clone().sub(a.point).addScaledVector(c.normal, offset).addScaledVector(a.normal, -offset);
      if (ab.length() < dx * unit * 0.35 || ab.length() > dx * unit * 1.8 || ac.length() < dy * unit * 0.35 || ac.length() > dy * unit * 1.8 || ab.cross(ac).dot(a.normal) < dx * dy * unit * unit * 0.2) return null;
    }
  }
  const output = mesh.positions.slice(), inverse = orientation.clone().invert(), local = new Vector3(), outward = new Vector3();
  const chart = new Map<string, { point: Vector3; normal: Vector3 }>();
  let curved = false;
  for (let i = 0; i < output.length; i += 3) {
    const x = mesh.positions[i]!, y = mesh.positions[i + 1]!, z = mesh.positions[i + 2]!, key = `${x.toFixed(5)},${y.toFixed(5)}`;
    let sample = chart.get(key);
    if (!sample) {
      const gx = x / dx, gy = y / dy, ix = Math.max(-nx, Math.min(nx - 1, Math.floor(gx))), iy = Math.max(-ny, Math.min(ny - 1, Math.floor(gy)));
      const u = Math.max(0, Math.min(1, gx - ix)), v = Math.max(0, Math.min(1, gy - iy));
      local.set(0, 0, 0); outward.set(0, 0, 0);
      for (const [ox, oy, weight] of [[0, 0, (1 - u) * (1 - v)], [1, 0, u * (1 - v)], [0, 1, (1 - u) * v], [1, 1, u * v]]) {
        const p = samples[index(ix + ox!, iy + oy!)]!;
        local.addScaledVector(p.point, weight!); outward.addScaledVector(p.normal, weight!);
      }
      outward.normalize();
      // Small corrections account for mesh detail between chart samples.
      const hit = field.project(local, outward, Math.max(dx, dy) * unit * 0.45);
      if (!hit || hit.normal.dot(outward) < 0.8) return null;
      sample = { point: hit.point, normal: outward.clone() }; chart.set(key, sample);
      curved ||= Math.abs(hit.point.clone().sub(anchor).dot(normal)) / unit > 0.08;
    }
    // Back and front follow the same chart with true local normal thickness.
    local.copy(sample.point).addScaledVector(sample.normal, (z + depth / 2) * unit).sub(anchor).addScaledVector(normal, -depth * unit / 2).applyQuaternion(inverse).divideScalar(unit);
    local.toArray(output, i);
  }
  return { mesh: { positions: output, indices: mesh.indices }, curved };
}
