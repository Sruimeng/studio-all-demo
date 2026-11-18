import { Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { loadLocalModel } from '~/@engine/import';
import { collectModelResources, disposeModelResources } from '~/@engine/model';
import { prepareBaseAsset, type BaseAsset } from './base-assets';

/** Local files only; the workspace model and its import pipeline stay untouched. */
export async function loadCustomBase(files: File[]): Promise<BaseAsset> {
  const models = files.filter(file => /\.(glb|fbx|obj|stl)$/i.test(file.name));
  if (models.length !== 1) throw new Error('请选择一个底座模型 / Select one GLB, FBX, OBJ or STL base');
  if (files.reduce((sum, file) => sum + file.size, 0) > 150 * 1024 * 1024) throw new Error('文件不能超过 150 MB / Files must be under 150 MB');
  const file = models[0]!;
  let root: Object3D | undefined;
  try {
    if (/\.(glb|fbx)$/i.test(file.name)) root = (await loadLocalModel(files)).root;
    else if (/\.obj$/i.test(file.name)) {
      const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
      root = new OBJLoader().parse(await file.text());
    } else {
      const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
      const geometry = new STLLoader().parse(await file.arrayBuffer());
      root = new Mesh(geometry, new MeshStandardMaterial({ color: '#ffffff', roughness: 0.46 }));
    }
    let triangles = 0;
    root.traverse(object => { if (object instanceof Mesh) triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position')?.count ?? 0) / 3; });
    if (!triangles || triangles > 2_000_000) throw new Error('底座需包含 1–200 万三角面 / Base must contain 1–2,000,000 triangles');
    return prepareBaseAsset(root);
  } catch (error) {
    if (root) disposeModelResources(collectModelResources(root));
    throw error;
  }
}
