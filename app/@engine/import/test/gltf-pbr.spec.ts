import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { GLTFLoader } from '../loaders/gltf';

beforeAll(() => vi.stubGlobal('ProgressEvent', class extends Event {
  constructor(type: string, init: ProgressEventInit = {}) { super(type); Object.assign(this, init); }
}));
afterAll(() => vi.unstubAllGlobals());

function triangle(material: object, extensionsUsed: string[] = []) {
  return JSON.stringify({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, translation: [2, 3, 4] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [material],
    extensionsUsed,
    buffers: [{ uri: 'data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA', byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
  });
}

describe('imported scalar PBR', () => {
  it('retains color, opacity, metallic and roughness without textures', async () => {
    const result = await new GLTFLoader().parseAsync(triangle({
      alphaMode: 'BLEND',
      pbrMetallicRoughness: { baseColorFactor: [0.2, 0.4, 0.6, 0.3], metallicFactor: 0.8, roughnessFactor: 0.15 },
    }), '');
    const mesh = result.scene.children[0] as Mesh;
    const material = mesh.material as MeshStandardMaterial;
    expect(material).toBeInstanceOf(MeshStandardMaterial);
    expect(material.color.toArray()).toEqual([0.2, 0.4, 0.6]);
    expect(material.opacity).toBe(0.3);
    expect(material.transparent).toBe(true);
    expect(material.metalness).toBe(0.8);
    expect(material.roughness).toBe(0.15);
    expect(mesh.position.toArray()).toEqual([2, 3, 4]);
    material.dispose();
    mesh.geometry.dispose();
  });

  it('retains authored transmission', async () => {
    const result = await new GLTFLoader().parseAsync(triangle({
      extensions: { KHR_materials_transmission: { transmissionFactor: 0.65 } },
    }, ['KHR_materials_transmission']), '');
    const mesh = result.scene.children[0] as Mesh;
    expect(mesh.material).toBeInstanceOf(MeshPhysicalMaterial);
    expect((mesh.material as MeshPhysicalMaterial).transmission).toBe(0.65);
    (mesh.material as MeshPhysicalMaterial).dispose();
    mesh.geometry.dispose();
  });
});
