export { useModelController } from './composables/use-model-controller';
export { useModelPlatform } from './composables/use-model-platform';
export { collectModelResources, disposeModelResources } from './lib/model-resources';
export { ModelAccess, ModelResultKind, ModelStatus, ModelObjectParent, ModelPointerKind } from './types';
export type { ModelRuntime, ModelPresentation, ModelPreparedContent, ModelContentView, ModelRuntimeContent, ModelSource, ModelPointer, ModelToken } from './types';
export { getModelGeometryPolygonEdges, setModelGeometryPolygonEdges, getModelGeometryTopology, setModelGeometryTopology, cloneModelGeometry } from './lib/model-geometry-metadata';
export { getModelMeshEdgeDomain, setModelMeshEdgeDomain } from './lib/model-edge-domain';

export { captureModelMaterials, restoreModelMaterials } from './lib/model-materials';
