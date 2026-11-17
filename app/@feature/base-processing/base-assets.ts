import { Box3, Group, Mesh, Vector3, type Object3D } from 'three';
import { markRaw } from 'vue';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from '~/@engine/import/loaders/gltf';
import { collectModelResources, disposeModelResources } from '~/@engine/model';
import type { BaseShape, MeshData, Point3 } from '~/@engine/base-processing';

export const baseAssetPresets = {
  'black-disc': { url: '/bases/black-disc-base.glb', size: [0.979827880859375, 0.201019287109375, 0.979949951171875] },
  'white-cloud': { url: '/bases/white-cloud-base.glb', size: [0.979583740234375, 0.1459808051586151, 0.80743408203125] },
} as const;
export type AssetBaseShape = keyof typeof baseAssetPresets;
export function isAssetBaseShape(shape: BaseShape): shape is AssetBaseShape { return shape in baseAssetPresets; }
export interface BaseAsset {
  /** Unit bounds: X/Z centered, top at Y=0, bottom at Y=-1. Shared read-only render resources. */
  root: Group;
  mesh: MeshData;
  size: Point3;
  dispose: () => void;
}

/** Keep source normals, UVs and materials; only normalize the parent transform. */
export function prepareBaseAsset(scene: Object3D): BaseAsset {
  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene), size = bounds.getSize(new Vector3());
  if (![size.x, size.y, size.z].every(v => Number.isFinite(v) && v > 1e-8)) throw new Error('底座尺寸无效 / Invalid base dimensions');
  const root = new Group(), centered = new Group();
  centered.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.max.y, -(bounds.min.z + bounds.max.z) / 2);
  centered.add(scene); root.add(centered); root.scale.set(1 / size.x, 1 / size.y, 1 / size.z); root.updateMatrixWorld(true);
  const meshes: Mesh[] = []; let vertices = 0, indexCount = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh) || !object.geometry.getAttribute('position')) return;
    meshes.push(object); vertices += object.geometry.getAttribute('position').count;
    indexCount += object.geometry.index?.count ?? object.geometry.getAttribute('position').count;
  });
  if (!vertices || !indexCount) throw new Error('底座网格为空 / Empty base mesh');
  const positions = new Float32Array(vertices * 3), indices = new Uint32Array(indexCount), point = new Vector3();
  let vertexOffset = 0, indexOffset = 0;
  for (const object of meshes) {
    const position = object.geometry.getAttribute('position'), index = object.geometry.index;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      point.toArray(positions, (vertexOffset + i) * 3);
    }
    for (let i = 0; i < (index?.count ?? position.count); i++) indices[indexOffset++] = vertexOffset + (index ? index.getX(i) : i);
    vertexOffset += position.count;
  }
  let disposed = false;
  return markRaw({ root, mesh: { positions, indices }, size: size.toArray(), dispose() {
    if (disposed) return; disposed = true;
    const resources = collectModelResources(root), bitmaps = new Set<ImageBitmap>();
    for (const resource of resources) {
      const image = (resource as { image?: ImageBitmap }).image;
      if (image && typeof image.close === 'function') bitmaps.add(image);
    }
    disposeModelResources(resources); bitmaps.forEach(bitmap => bitmap.close());
  } });
}

export function resizeBaseAsset(asset: BaseAsset, width: number, depth: number, height: number): MeshData {
  const dimensions = [width, height, depth];
  return { positions: asset.mesh.positions.map((value, i) => value * dimensions[i % 3]!), indices: asset.mesh.indices };
}

/** One lazy load per style and controller lifetime. Stale selections may populate the cache only. */
export function createBaseAssetLibrary() {
  const cache = new Map<AssetBaseShape, Promise<BaseAsset>>(), owned = new Set<BaseAsset>(), requests = new Set<AbortController>();
  let disposed = false;
  return {
    get(shape: AssetBaseShape): Promise<BaseAsset> {
      if (disposed) return Promise.reject(new Error('Base asset library disposed'));
      const cached = cache.get(shape); if (cached) return cached;
      const abort = new AbortController(); requests.add(abort);
      const promise = (async () => {
        const response = await fetch(baseAssetPresets[shape].url, { signal: abort.signal });
        if (!response.ok) throw new Error(`底座加载失败 / Base load failed (${response.status})`);
        const buffer = await response.arrayBuffer();
        if (disposed) throw new Error('Base asset library disposed');
        const loaded = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '');
        let asset: BaseAsset;
        try { asset = prepareBaseAsset(loaded.scene); }
        catch (error) { disposeModelResources(collectModelResources(loaded.scene)); throw error; }
        if (disposed) { asset.dispose(); throw new Error('Base asset library disposed'); }
        owned.add(asset); return asset;
      })().catch(error => { cache.delete(shape); throw error; }).finally(() => requests.delete(abort));
      cache.set(shape, promise); return promise;
    },
    dispose() { disposed = true; requests.forEach(request => request.abort()); owned.forEach(asset => asset.dispose()); owned.clear(); cache.clear(); },
  };
}
