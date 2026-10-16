import { expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { toPrintMesh } from '../app/@engine/print-mesh';
import { createPrintMaterial } from '../app/@engine/viewer/material';

it('applies node transforms, fixes mirrored winding and multiplies linear vertex colors', async () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array([0.5, 1, 0.25, 0.5, 1, 0.25, 0.5, 1, 0.25]), 3));
  const material = new MeshStandardMaterial({ color: new Color(0.4, 0.6, 0.8), vertexColors: true });
  const mesh = new Mesh(geometry, material); mesh.scale.x = -2; mesh.position.set(5, 2, 3);
  const root = new Group(); root.add(mesh); const result = await toPrintMesh(root);
  expect(Array.from(result.positions)).toEqual([5, 2, 3, 5, 3, 3, 3, 2, 3]);
  const p = result.positions; const normal = new Vector3().subVectors(new Vector3().fromArray(p, 3), new Vector3().fromArray(p)).cross(new Vector3().subVectors(new Vector3().fromArray(p, 6), new Vector3().fromArray(p)));
  expect(normal.z).toBeGreaterThan(0);
  const color = new Color(0.2, 0.6, 0.2).convertLinearToSRGB();
  expect(result.colors![0]).toBeCloseTo(color.r * 255, 4); expect(result.colors![1]).toBeCloseTo(color.g * 255, 4);
});
it.each([0, 1])('keeps PBR endpoint %i finite and independent of opacity', endpoint => {
  const { material } = createPrintMaterial({ hex: '#808080', transparency: endpoint, metalness: endpoint, roughness: endpoint });
  expect(material.opacity).toBe(1 - endpoint); expect(material.metalness).toBe(endpoint); expect(material.roughness).toBe(endpoint);
  expect(material.transparent).toBe(endpoint > 0); material.dispose();
});

it('retains authored UV and keeps overlapping mesh instances in separate selection domains', async () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0,0,0,1,0,0,0,1,0]), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0,0,1,0,0,1]), 2));
  const root = new Group(); const material = new MeshStandardMaterial();
  root.add(new Mesh(geometry, material), new Mesh(geometry, material));
  const result = await toPrintMesh(root);
  expect(Array.from(result.rawUvs!)).toEqual([0,0,1,0,0,1,0,0,1,0,0,1]);
  expect(Array.from(result.uvValid!)).toEqual([1,1]);
  expect(result.faceDomain![0]).not.toBe(result.faceDomain![1]);
  expect(result.topologyVertices![0]).not.toBe(result.topologyVertices![3]);
});
