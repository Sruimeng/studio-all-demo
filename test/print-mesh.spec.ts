import { expect, it, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial, RepeatWrapping, Texture, Vector3 } from 'three';
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

it('transforms authored normals with nonuniform mirrored node scale', async () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]), 3));
  const mesh = new Mesh(geometry, new MeshStandardMaterial()); mesh.scale.set(-2, 3, 4);
  const result = await toPrintMesh(mesh);
  const expected = new Vector3(-0.5, 1 / 3, 0.25).normalize();
  expect(result.normals).toBeDefined();
  expect(result.normals![0]).toBeCloseTo(expected.x); expect(result.normals![1]).toBeCloseTo(expected.y); expect(result.normals![2]).toBeCloseTo(expected.z);
});

it('flags authored repeat UVs before legacy wrapping can hide the unsupported upstream domain', async () => {
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }), toBlob: (callback: (value: Blob) => void) => callback(new Blob(['pixels'])) }) });
  const geometry = new BufferGeometry(), texture = new Texture();
  texture.image = { width: 1, height: 1 }; texture.flipY = false; texture.wrapS = RepeatWrapping;
  const material = new MeshStandardMaterial({ map: texture, color: new Color(0.8, 0.8, 0.8) });
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([-0.25, 0, 1.25, 0, 0, 1]), 2));
  try {
    const result = await toPrintMesh(new Mesh(geometry, material));
    expect(result.quantizationUnsupported).toContain('[0,1]');
    expect(result.uvs!.every(x => x >= 0 && x <= 1)).toBe(true);
    expect(result.materials[0]!.factor).toEqual([0.8, 0.8, 0.8]);
  } finally { vi.unstubAllGlobals(); texture.dispose(); material.dispose(); geometry.dispose(); }
});
