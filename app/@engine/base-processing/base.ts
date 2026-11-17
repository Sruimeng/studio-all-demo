import type { MeshData } from './types';

export type PrimitiveBaseShape = 'round' | 'square' | 'hexagon';
export type BaseShape = PrimitiveBaseShape | 'black-disc' | 'white-cloud' | 'custom';

/** Build a simple solid prism that sits on the model's lowest Y plane. */
export function buildBaseMesh(shape: PrimitiveBaseShape, width: number, depth: number, height: number, topY: number): MeshData {
  const w = Math.max(width, 1e-4), d = Math.max(depth, 1e-4), h = Math.max(height, 1e-4);
  const sides = shape === 'round' ? 32 : shape === 'hexagon' ? 6 : 4;
  const points: Array<[number, number]> = [];
  if (shape === 'square') {
    points.push([-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]);
  } else {
    const radiusX = w / 2, radiusZ = d / 2;
    for (let i = 0; i < sides; i++) {
      const angle = Math.PI / 2 + i * Math.PI * 2 / sides;
      points.push([Math.cos(angle) * radiusX, Math.sin(angle) * radiusZ]);
    }
  }
  const positions: number[] = [];
  for (const [x, z] of points) positions.push(x, topY - h, z);
  for (const [x, z] of points) positions.push(x, topY, z);
  const indices: number[] = [];
  const bottom = 0, top = points.length;
  for (let i = 1; i < points.length - 1; i++) indices.push(bottom, bottom + i + 1, bottom + i);
  for (let i = 1; i < points.length - 1; i++) indices.push(top, top + i, top + i + 1);
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    indices.push(bottom + i, bottom + next, top + next, bottom + i, top + next, top + i);
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
