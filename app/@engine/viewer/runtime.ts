import { Mesh, type Object3D } from 'three';
import { markRaw } from 'vue';
import { collectModelResources, disposeModelResources, type ModelRuntime, type ModelContentView, type ModelRuntimeContent, useModelPlatform } from '../model';
import { captureModelMaterials, restoreModelMaterials } from '../model';

export function createViewerRuntime(scene: Object3D, platform: ReturnType<typeof useModelPlatform>): ModelRuntime<{ id: string }> {
  const release = (root: Object3D) => { root.removeFromParent(); disposeModelResources(collectModelResources(root)); };
  return {
    afterCurrentFrame: platform.afterCurrentFrame,
    discard(prepared) { release(prepared.root); },
    async bind(prepared, _key, signal) {
      if (signal.aborted) { release(prepared.root); throw new DOMException('Superseded', 'AbortError'); }
      const meshes: Mesh[] = [];
      prepared.root.traverse(object => { if (object instanceof Mesh) meshes.push(markRaw(object)); });
      const source = captureModelMaterials(meshes);
      const view: ModelContentView<{ id: string }> = { ...prepared, meshes };
      return {
        view,
        show() { scene.add(prepared.root); },
        hide() { prepared.root.removeFromParent(); },
        normalizeMaterials() { restoreModelMaterials(source); },
        refresh() { prepared.root.updateWorldMatrix(true, true); return view; },
        dispose() { release(prepared.root); },
      } satisfies ModelRuntimeContent<{ id: string }>;
    },
    createPresentation(scope, content) { return platform.createPresentation(scope, content.view.root); },
  };
}
