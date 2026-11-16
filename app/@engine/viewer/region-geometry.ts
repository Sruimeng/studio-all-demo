import { BufferAttribute, BufferGeometry } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { PrintDisplay } from './types';

export function regionGeometry(data: PrintDisplay, slots: number, previous?: BufferGeometry): BufferGeometry {
  if (data.positions.length !== data.labels.length * 9 || slots < 1) throw new Error('Invalid region geometry');
  const counts = new Uint32Array(slots);
  for (const label of data.labels) {
    if (label >= slots) throw new Error('Unknown region slot');
    counts[label]! += 3;
  }
  const reusable = previous?.getAttribute('position').array === data.positions
    && (!data.normals || previous?.getAttribute('normal')?.array === data.normals);
  const geometry = reusable ? previous! : new BufferGeometry();
  if (!reusable) {
    geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
    if (data.normals) geometry.setAttribute('normal', new BufferAttribute(data.normals, 3));
    else geometry.computeVertexNormals();
  }
  geometry.clearGroups();
  const offsets = new Uint32Array(slots);
  let start = 0;
  counts.forEach((count, slot) => { offsets[slot] = start; if (count) geometry.addGroup(start, count, slot); start += count; });
  const sorted = new Uint32Array(data.labels.length * 3);
  data.labels.forEach((slot, face) => {
    const offset = offsets[slot]!;
    sorted[offset] = face * 3; sorted[offset + 1] = face * 3 + 1; sorted[offset + 2] = face * 3 + 2;
    offsets[slot]! += 3;
  });
  const index = geometry.index;
  if (index?.array.length === sorted.length) { index.array.set(sorted); index.needsUpdate = true; }
  else geometry.setIndex(new BufferAttribute(sorted, 1));
  return geometry;
}

export function regionPickingGeometry(data: PrintDisplay, previous?: BufferGeometry): BufferGeometry {
  if (previous?.getAttribute('position').array === data.positions) return previous;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
  geometry.setIndex(new BufferAttribute(Uint32Array.from({ length: data.positions.length / 3 }, (_, i) => i), 1));
  // Picking keeps face order fixed while rendering regroups indices by material.
  geometry.boundsTree = new MeshBVH(geometry, { indirect: true });
  return geometry;
}
