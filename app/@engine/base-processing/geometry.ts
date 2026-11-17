import { ShapeUtils, Vector2 } from 'three';
import type { CutPlane, CutResult, GeometryCheck, MeshData, Point3 } from './types';

const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const point = (p: ArrayLike<number>, i: number): Point3 => [p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!];
const key = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;
export function normalized(n: Point3): Point3 {
  const length = Math.hypot(...n);
  if (!Number.isFinite(length) || length < 1e-12) throw new Error('切割方向无效 / Invalid cut direction');
  return n.map(v => v / length) as Point3;
}
export function planeBasis(normal: Point3): [Point3, Point3] {
  const n = normalized(normal), u = normalized(cross(Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], n));
  return [u, cross(n, u)];
}
export function projectionRange(positions: Float32Array, normal: Point3): [number, number] {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const d = positions[i]! * normal[0] + positions[i + 1]! * normal[1] + positions[i + 2]! * normal[2];
    min = Math.min(min, d); max = Math.max(max, d);
  }
  return [min, max];
}
function validate(mesh: MeshData, maxFaces = 2_000_000) {
  const { positions: p, indices: idx } = mesh;
  if (!p.length || p.length % 3 || !idx.length || idx.length % 3 || p.some(n => !Number.isFinite(n)) || idx.some(i => i >= p.length / 3)) throw new Error('模型三角网格无效 / Invalid triangle mesh');
  if (idx.length / 3 > maxFaces) throw new Error(`模型超过 ${maxFaces / 10_000} 万面，请先减面后再处理 / Reduce the model below ${maxFaces / 1_000_000} million faces`);
}
function tolerance(p: Float32Array) {
  const ranges = ([ [1, 0, 0], [0, 1, 0], [0, 0, 1] ] as Point3[]).map(n => projectionRange(p, n));
  return Math.max(1e-8, Math.hypot(...ranges.map(([a, b]) => b - a)) * 1e-7);
}
/** Weld coincident seam vertices only; ambiguous overlapping shells are reported by edge checks. */
export function weldMesh(mesh: MeshData): MeshData {
  validate(mesh);
  const epsilon = tolerance(mesh.positions), points: number[] = [], remap = new Uint32Array(mesh.positions.length / 3);
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < remap.length; i++) {
    const p = point(mesh.positions, i), cell = p.map(n => Math.floor(n / epsilon));
    let found = -1;
    for (let x = -1; x <= 1 && found < 0; x++) for (let y = -1; y <= 1 && found < 0; y++) for (let z = -1; z <= 1 && found < 0; z++) {
      for (const candidate of buckets.get(`${cell[0]! + x},${cell[1]! + y},${cell[2]! + z}`) ?? []) {
        if (Math.hypot(...sub(p, point(points, candidate))) <= epsilon) { found = candidate; break; }
      }
    }
    if (found < 0) {
      found = points.length / 3; points.push(...p);
      const k = cell.join(','), bucket = buckets.get(k) ?? []; bucket.push(found); buckets.set(k, bucket);
    }
    remap[i] = found;
  }
  return { positions: new Float32Array(points), indices: mesh.indices.map(i => remap[i]!) };
}
interface Edge { a: number; b: number; count: number; direction: number }
function edgesOf(indices: ArrayLike<number>) {
  const edges = new Map<string, Edge>();
  for (let i = 0; i < indices.length; i += 3) for (let c = 0; c < 3; c++) {
    const a = indices[i + c]!, b = indices[i + (c + 1) % 3]!, k = key(a, b);
    const edge = edges.get(k) ?? { a, b, count: 0, direction: 0 };
    edge.count++; edge.direction += a < b ? 1 : -1; edges.set(k, edge);
  }
  return edges;
}
export function checkGeometry(mesh: MeshData): GeometryCheck {
  validate(mesh);
  const stats: GeometryCheck = { boundary: 0, nonManifold: 0, winding: 0, degenerate: 0, duplicates: 0 };
  const seen = new Set<string>(), eps = tolerance(mesh.positions);
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ids = Array.from(mesh.indices.subarray(i, i + 3)), k = [...ids].sort((a, b) => a - b).join(':');
    if (seen.has(k)) stats.duplicates++; seen.add(k);
    const [a, b, c] = ids.map(id => point(mesh.positions, id)) as [Point3, Point3, Point3];
    if (Math.hypot(...cross(sub(b, a), sub(c, a))) <= eps * eps) stats.degenerate++;
  }
  for (const edge of edgesOf(mesh.indices).values()) {
    if (edge.count === 1) stats.boundary++;
    if (edge.count > 2) stats.nonManifold++;
    if (edge.count === 2 && edge.direction !== 0) stats.winding++;
  }
  return stats;
}
function contains(p: Vector2, ring: Vector2[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function capLoops(points: number[], edges: Edge[], n: Point3, eps: number): { indices: number[]; loops: number } {
  const next = new Map<number, number>(), incoming = new Map<number, number>();
  // Reverse each surface boundary edge so the cap shares it with opposite winding.
  for (const e of edges) {
    if (next.has(e.b) || incoming.has(e.a)) throw new Error('切口有分叉或重叠，无法安全封口；请调整切面或先修复网格 / Ambiguous cut contour');
    next.set(e.b, e.a); incoming.set(e.a, e.b);
  }
  if ([...next.keys()].some(id => !incoming.has(id))) throw new Error('切口不闭合，无法自动封口；请调整切面或先修复网格 / Open cut contour');
  const capNormal = n.map(v => -v) as Point3, [u, v] = planeBasis(capNormal), visited = new Set<number>();
  const loops: Array<{ ids: number[]; xy: Vector2[]; area: number }> = [];
  for (const start of next.keys()) {
    if (visited.has(start)) continue;
    const ids: number[] = []; let id = start;
    do {
      if (visited.has(id) || !next.has(id)) throw new Error('切口轮廓无效 / Invalid cut contour');
      visited.add(id); ids.push(id); id = next.get(id)!;
    } while (id !== start);
    const xy = ids.map(i => { const p = point(points, i); return new Vector2(dot(p, u), dot(p, v)); });
    const area = ShapeUtils.area(xy);
    if (ids.length < 3 || Math.abs(area) < eps * eps) throw new Error('切面经过退化轮廓，请略微移动切面 / Degenerate contour');
    loops.push({ ids, xy, area });
  }
  // Limit quadratic contour validation, independently of the overall triangle budget.
  if (visited.size > 12000) throw new Error('切口过于复杂，请先减面 / Cut contour too complex');
  const segments = loops.flatMap(r => r.xy.map((a, i) => ({ a, b: r.xy[(i + 1) % r.xy.length]!, from: r.ids[i]!, to: r.ids[(i + 1) % r.ids.length]! })));
  const orient = (a: Vector2, b: Vector2, c: Vector2) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const a = segments[i]!, b = segments[j]!;
    if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;
    if (Math.max(a.a.x, a.b.x) < Math.min(b.a.x, b.b.x) - eps || Math.max(b.a.x, b.b.x) < Math.min(a.a.x, a.b.x) - eps || Math.max(a.a.y, a.b.y) < Math.min(b.a.y, b.b.y) - eps || Math.max(b.a.y, b.b.y) < Math.min(a.a.y, a.b.y) - eps) continue;
    if (orient(a.a, a.b, b.a) * orient(a.a, a.b, b.b) < -(eps ** 4) && orient(b.a, b.b, a.a) * orient(b.a, b.b, a.b) < -(eps ** 4)) throw new Error('切口轮廓相交，请先修复重叠网格 / Intersecting cut contours');
  }
  const outers = loops.filter(r => r.area > 0), holes = loops.filter(r => r.area < 0);
  for (const loop of loops) {
    const parent = loops.filter(r => Math.abs(r.area) > Math.abs(loop.area) && contains(loop.xy[0]!, r.xy)).sort((a, b) => Math.abs(a.area) - Math.abs(b.area))[0];
    if (parent && Math.sign(parent.area) === Math.sign(loop.area)) throw new Error('切口存在重叠壳体，无法安全封口；请调整切面或先修复模型 / Overlapping cut shells');
  }
  const assigned = new Map<typeof holes[number], typeof outers[number]>();
  for (const hole of holes) {
    const outer = outers.filter(r => contains(hole.xy[0]!, r.xy)).sort((a, b) => a.area - b.area)[0];
    if (!outer) throw new Error('切口法线朝向不一致，请检查模型朝向 / Invalid contour winding');
    assigned.set(hole, outer);
  }
  const indices: number[] = [];
  for (const outer of outers) {
    const inner = holes.filter(h => assigned.get(h) === outer), ids = [...outer.ids, ...inner.flatMap(h => h.ids)];
    for (const tri of ShapeUtils.triangulateShape(outer.xy, inner.map(h => h.xy))) {
      const t = tri.map(i => ids[i]!) as [number, number, number];
      const [a, b, c] = t.map(i => point(points, i)) as [Point3, Point3, Point3];
      // Oblique projection can leave an almost collinear ear due to roundoff.
      // Discard it before restoring boundary vertices, otherwise its edges are counted twice.
      const areaVector = cross(sub(b, a), sub(c, a));
      if (Math.hypot(...areaVector) <= eps * eps) continue;
      if (dot(areaVector, capNormal) < 0) [t[1], t[2]] = [t[2], t[1]];
      indices.push(...t);
    }
  }
  // Earcut may omit collinear ring vertices. Reinsert them to prevent T-junctions.
  const queue: number[][] = [];
  for (let i = 0; i < indices.length; i += 3) queue.push(indices.slice(i, i + 3));
  const restored: number[] = [];
  for (let q = 0; q < queue.length; q++) {
    const tri = queue[q]!; let split = false;
    for (let e = 0; e < 3 && !split; e++) {
      const a = tri[e]!, b = tri[(e + 1) % 3]!, c = tri[(e + 2) % 3]!;
      if (!next.has(a) || next.get(a) === b) continue;
      const pa = point(points, a), pb = point(points, b), ab = sub(pb, pa), length = Math.hypot(...ab);
      const path = [a]; let cursor = next.get(a)!;
      while (cursor !== b && cursor !== a && path.length <= visited.size) {
        const ap = sub(point(points, cursor), pa);
        if (Math.hypot(...cross(ap, ab)) > eps * length || dot(ap, ab) < -eps || dot(ap, ab) > length * length + eps) break;
        path.push(cursor); cursor = next.get(cursor)!;
      }
      if (cursor === b && path.length > 1) {
        path.push(b);
        for (let k = 0; k + 1 < path.length; k++) queue.push([path[k]!, path[k + 1]!, c]);
        split = true;
      }
    }
    if (!split) restored.push(...tri);
  }
  const capEdges = edgesOf(restored);
  const boundaryKeys = new Set(edges.map(e => key(e.a, e.b)));
  for (const e of edges) if (capEdges.get(key(e.a, e.b))?.count !== 1) throw new Error('封口校验失败，请调整切面 / Cap boundary validation failed');
  for (const [k, edge] of capEdges) if ((edge.count === 1 && !boundaryKeys.has(k)) || edge.count > 2 || (edge.count === 2 && edge.direction !== 0)) throw new Error('封口拓扑无效 / Invalid cap topology');
  return { indices: restored, loops: loops.length };
}
export function cutMesh(input: MeshData, options: CutPlane): CutResult {
  validate(input);
  const n = normalized(options.normal), factor = Math.hypot(...options.normal), offset = options.offset / factor;
  if (!Number.isFinite(offset)) throw new Error('切入深度无效 / Invalid cut depth');
  const source = weldMesh(input), eps = tolerance(source.positions);
  const points = Array.from(source.positions), distances = Array.from({ length: points.length / 3 }, (_, id) => dot(point(points, id), n) - offset);
  for (let i = 0; i < distances.length; i++) if (Math.abs(distances[i]!) <= eps) {
    const d = distances[i]!; for (let c = 0; c < 3; c++) points[i * 3 + c]! -= d * n[c]!; distances[i] = 0;
  }
  const crossings = new Map<string, number>(), surface: number[] = [];
  let removedFaces = 0, splitFaces = 0;
  function intersection(a: number, b: number) {
    if (distances[a] === 0) return a;
    if (distances[b] === 0) return b;
    const k = key(a, b); if (crossings.has(k)) return crossings.get(k)!;
    const t = distances[a]! / (distances[a]! - distances[b]!), pa = point(points, a), pb = point(points, b);
    const p = pa.map((v, c) => v + t * (pb[c]! - v)) as Point3, error = dot(p, n) - offset;
    for (let c = 0; c < 3; c++) p[c]! -= error * n[c]!;
    const id = points.length / 3; points.push(...p); distances.push(0); crossings.set(k, id); return id;
  }
  for (let i = 0; i < source.indices.length; i += 3) {
    const tri = Array.from(source.indices.subarray(i, i + 3)), poly: number[] = [];
    const outside = tri.filter(id => distances[id]! < 0).length;
    if (outside === 3) { removedFaces++; continue; }
    if (outside) splitFaces++;
    for (let e = 0; e < 3; e++) {
      const a = tri[e]!, b = tri[(e + 1) % 3]!;
      if (distances[a]! >= 0) poly.push(a);
      if ((distances[a]! >= 0) !== (distances[b]! >= 0)) poly.push(intersection(a, b));
    }
    const polygon = poly.filter((id, k) => id !== poly[(k + poly.length - 1) % poly.length]);
    for (let k = 1; k + 1 < polygon.length; k++) {
      const ids = [polygon[0]!, polygon[k]!, polygon[k + 1]!], [a, b, c] = ids.map(id => point(points, id)) as [Point3, Point3, Point3];
      if (Math.hypot(...cross(sub(b, a), sub(c, a))) > eps * eps) surface.push(...ids);
    }
  }
  if (!surface.length || !surface.some(i => distances[i]! > eps)) throw new Error('切割会移除整个模型，请减小切入深度 / Cut removes the entire model');
  let caps: number[] = [], loops = 0;
  const boundary = [...edgesOf(surface).values()].filter(e => e.count === 1 && distances[e.a] === 0 && distances[e.b] === 0);
  if (options.cap && boundary.length && (removedFaces || splitFaces)) ({ indices: caps, loops } = capLoops(points, boundary, n, eps));
  const remap = new Map<number, number>(), compact: number[] = [];
  const indices = new Uint32Array([...surface, ...caps].map(id => {
    if (!remap.has(id)) { remap.set(id, compact.length / 3); compact.push(...point(points, id)); }
    return remap.get(id)!;
  }));
  const mesh = { positions: new Float32Array(compact), indices };
  let capDeviation = 0;
  for (let i = surface.length; i < indices.length; i++) capDeviation = Math.max(capDeviation, Math.abs(dot(point(mesh.positions, indices[i]!), n) - offset));
  return { ...mesh, plane: { normal: n, offset, cap: options.cap }, surfaceIndexCount: surface.length,
    stats: { ...checkGeometry(mesh), sourceFaces: source.indices.length / 3, removedFaces, splitFaces, capFaces: caps.length / 3, loops, capDeviation } };
}
/** STL coordinates keep their mm scale and rotate the retained side to +Z. */
export function cutSTL(result: CutResult): ArrayBuffer {
  // Export only serializes triangles; allow a 2M-face source plus its custom
  // pedestal. The more expensive cutting/topology checks keep their 2M limit.
  validate(result, 4_000_000);
  const n = result.plane.normal, [u, v] = planeBasis(n), p = result.positions;
  const [umin, umax] = projectionRange(p, u), [vmin, vmax] = projectionRange(p, v);
  const count = result.indices.length / 3, buffer = new ArrayBuffer(84 + count * 50), out = new DataView(buffer);
  new Uint8Array(buffer).set(new TextEncoder().encode('Tripo Base Processing | millimetres | cut plane at Z=0'));
  out.setUint32(80, count, true);
  for (let f = 0; f < count; f++) {
    const vertices = [0, 1, 2].map(c => { const q = point(p, result.indices[f * 3 + c]!); return [dot(q, u) - (umin + umax) / 2, dot(q, v) - (vmin + vmax) / 2, Math.max(0, dot(q, n) - result.plane.offset)] as Point3; });
    const [a, b, c] = vertices as [Point3, Point3, Point3], rawNormal = cross(sub(b, a), sub(c, a));
    const length = Math.hypot(...rawNormal) || 1, values = [...rawNormal.map(x => x / length), ...vertices.flat()];
    values.forEach((value, i) => out.setFloat32(84 + f * 50 + i * 4, value, true));
  }
  return buffer;
}
