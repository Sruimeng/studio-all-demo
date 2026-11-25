import type { MeshData } from '~/@engine/base-processing';
import { weldMesh } from '~/@engine/base-processing/geometry';

/** Only repair coincident seams and inconsistent face orientation. Never fill
 * real holes or voxelize/smooth the user's imported geometry. */
export function orientClosedMesh(input: MeshData): MeshData {
  const mesh = weldMesh(input), ids = mesh.indices, vertices = mesh.positions.length / 3, faces = ids.length / 3;
  const neighbors = new Int32Array(ids.length).fill(-1), edges = new Map<number, number>();
  const closed = new Set<number>();
  for (let f = 0; f < faces; f++) for (let e = 0; e < 3; e++) {
    const slot = f * 3 + e, a = ids[slot]!, b = ids[f * 3 + (e + 1) % 3]!;
    if (a === b) throw new Error('Degenerate mesh');
    const key = Math.min(a,b) * vertices + Math.max(a,b), other = edges.get(key);
    if (closed.has(key)) throw new Error('Non-manifold mesh');
    if (other === undefined) edges.set(key,slot);
    else { neighbors[slot] = other; neighbors[other] = slot; edges.delete(key); closed.add(key); }
  }
  if (edges.size) throw new Error('Open mesh');
  edges.clear(); closed.clear();
  const flips = new Int8Array(faces).fill(-1), queue = new Uint32Array(faces);
  for (let seed = 0; seed < faces; seed++) {
    if (flips[seed] !== -1) continue;
    let count = 1, flipped = 0; queue[0] = seed; flips[seed] = 0;
    for (let i = 0; i < count; i++) {
      const face = queue[i]!;
      for (let e = 0; e < 3; e++) {
        const slot = face * 3 + e, other = neighbors[slot]!, next = Math.floor(other / 3);
        const flip = flips[face]! ^ Number(ids[slot] === ids[other]);
        if (flips[next] === -1) { flips[next] = flip; flipped += flip; queue[count++] = next; }
        else if (flips[next] !== flip) throw new Error('Non-orientable mesh');
      }
    }
    // Preserve the majority orientation, including inward-facing cavity shells.
    const invert = flipped > count / 2 ? 1 : 0;
    for (let i = 0; i < count; i++) {
      const face = queue[i]!;
      if (flips[face]! ^ invert) [ids[face * 3 + 1], ids[face * 3 + 2]] = [ids[face * 3 + 2]!, ids[face * 3 + 1]!];
    }
  }
  return mesh;
}
