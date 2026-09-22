import { LoadingManager, Mesh, type Object3D } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { collectModelResources, disposeModelResources, type ModelPreparedContent } from '../model';
import { GLTFLoader } from './loaders/gltf';
import { FBXLoader } from './loaders/fbx';

export interface LocalModelInfo {
  warnings: string[];
  triangles: number;
  hasUV: boolean;
}

export interface LocalModel extends LocalModelInfo {
  root: Object3D;
}

const missingImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><path fill="white" d="M0 0h1v1H0z"/></svg>');
let importTail: Promise<unknown> = Promise.resolve();

export function normalizeResourcePath(path: string): string {
  let decoded = path;
  try { decoded = decodeURIComponent(path); } catch { /* Malformed percent sequences remain literal filenames. */ }
  return decoded.replace(/\\/g, '/').replace(/^\.\//, '').replace(/[?#].*$/, '').toLowerCase();
}

export function matchLocalResource(url: string, files: readonly File[]): File | undefined {
  const path = normalizeResourcePath(url);
  const exact = files.filter(file => {
    const candidate = normalizeResourcePath(file.webkitRelativePath || file.name);
    return path === candidate || path.endsWith('/' + candidate);
  });
  if (exact.length === 1) return exact[0];
  const basename = path.split('/').pop();
  const matches = files.filter(file => normalizeResourcePath(file.name) === basename);
  return matches.length === 1 ? matches[0] : undefined;
}

async function importModel(files: File[]): Promise<LocalModel> {
  const models = files.filter(file => /\.(glb|fbx)$/i.test(file.name));
  if (models.length !== 1) throw new Error('Select exactly one GLB or FBX model with its optional textures.');
  const file = models[0]!;
  const urls = new Set<string>();
  const warnings = new Set<string>();
  const manager = new LoadingManager();
  const fileUrls = new Map<File, string>();
  manager.setURLModifier((url) => {
    if (url.startsWith('data:')) return url;
    if (url.startsWith('blob:')) {
      urls.add(url);
      return url;
    }
    const resource = matchLocalResource(url, files);
    if (!resource) {
      warnings.add(`Missing or ambiguous texture: ${url}`);
      return missingImage;
    }
    let localUrl = fileUrls.get(resource);
    if (!localUrl) {
      localUrl = URL.createObjectURL(resource);
      fileUrls.set(resource, localUrl);
      urls.add(localUrl);
    }
    return localUrl;
  });
  manager.onError = url => { warnings.add(`Texture could not be decoded: ${url.startsWith('blob:') ? 'local file' : url}`); };
  let root: Object3D | undefined;
  try {
    const buffer = await file.arrayBuffer();
    const result = /\.fbx$/i.test(file.name)
      ? await new FBXLoader({ manager }).parse(buffer, '')
      : await new GLTFLoader({ manager }).setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '');
    root = result.scene;
    root.name ||= file.name;
    root.updateMatrixWorld(true);
    let triangles = 0;
    let hasUV = false;
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      triangles += Math.floor((object.geometry.index?.count ?? object.geometry.getAttribute('position')?.count ?? 0) / 3);
      hasUV ||= Boolean(object.geometry.getAttribute('uv'));
    });
    if (!triangles) throw new Error('The model contains no triangle meshes.');
    if (/\.fbx$/i.test(file.name)) warnings.add('FBX missing PBR values use defaults: metalness 0, roughness 1.');
    return { root, triangles, hasUV, warnings: [...warnings] };
  } catch (error) {
    if (root) disposeModelResources(collectModelResources(root));
    throw error;
  } finally {
    for (const url of urls) URL.revokeObjectURL(url);
  }
}

export function loadLocalModel(files: File[]): Promise<LocalModel> {
  // The migrated FBX parser has a module-level parse context, including asynchronous texture loads.
  const pending = importTail.then(() => importModel(files));
  importTail = pending.catch(() => undefined);
  return pending;
}

export async function prepareModelContent(files: File[], signal?: AbortSignal): Promise<ModelPreparedContent<LocalModelInfo>> {
  signal?.throwIfAborted();
  const { root, ...info } = await loadLocalModel(files);
  if (signal?.aborted) {
    disposeModelResources(collectModelResources(root));
    signal.throwIfAborted();
  }
  return { root, info };
}
