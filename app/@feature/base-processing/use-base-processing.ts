import { computed, nextTick, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue';
import { buildBaseMesh, CutClient, CancelledCutError, clippedBounds, cutSTL, projectionRange, type BaseShape, type CutPlane, type CutResult, type MeshData, type Point3 } from '~/@engine/base-processing';
import { Color, Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import type { ViewerContent } from '~/@engine/viewer';
import type { PrintMeshInput } from '~/@engine/multicolor';
import { downloadFile } from '~/@base/storage';
import { baseAssetPresets, createBaseAssetLibrary, isAssetBaseShape, resizeBaseAsset, type BaseAsset } from './base-assets';
import { loadCustomBase } from './custom-base';

export interface BaseAppearance {
  uvs: Float32Array | null;
  /** Linear RGB, including the original material color factor. */
  colors: Float32Array | null;
  faceMat: Uint16Array | Uint32Array;
  materials: Array<{ image: number; factor: [number, number, number]; vertexColors?: boolean }>;
  images: Array<Blob | null>;
}
interface BaseSource extends MeshData { id: string; name: string; appearance: BaseAppearance | null }
export type DimensionAxis = 'width' | 'depth' | 'height';
export type RotationAxis = 'x' | 'y' | 'z';
export type PlaneRotation = [number, number, number, number];
export function useBaseProcessing(content: () => ViewerContent | null, height: () => number, active: () => boolean) {
  const source = shallowRef<BaseSource | null>(null), result = shallowRef<CutResult | null>(null);
  const exportedResult = shallowRef<CutResult | null>(null), exportedScale = ref(1);
  const rotation = ref<PlaneRotation>([0, 0, 0, 1]), depthRatio = ref(0.05);
  const customMode = ref(false);
  const flip = ref(false), scale = ref(1), rotating = ref(false), dragging = ref(false);
  const normal = computed<Point3>(() => new Vector3(0, 1, 0).applyQuaternion(new Quaternion(...rotation.value)).toArray().map(v => Math.abs(v) < 1e-12 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-12 ? Math.sign(v) : v) as Point3);
  const angles = computed(() => {
    const e = new Euler().setFromQuaternion(new Quaternion(...rotation.value), 'XYZ');
    return { x: MathUtils.radToDeg(e.x) || 0, y: MathUtils.radToDeg(e.y) || 0, z: MathUtils.radToDeg(e.z) || 0 };
  });
  const direction = computed<RotationAxis | 'custom'>(() => {
    const axis = normal.value.findIndex(n => Math.abs(n) > 1 - 1e-8);
    return axis < 0 ? 'custom' : (['x', 'y', 'z'] as const)[axis]!;
  });
  const view = ref<'preview' | 'result'>('preview'), busy = ref(false), failure = ref('');
  const mode = ref<'flatten' | 'add'>('flatten');
  const baseShape = ref<BaseShape>('round'), baseWidth = ref(36), baseDepth = ref(36), baseHeight = ref(8), baseAdded = ref(false);
  const baseScale = ref(1), baseRotationY = ref(0);
  const baseAsset = shallowRef<BaseAsset | null>(null), baseAssetLoading = ref(false), baseAssetError = ref(''), baseAssetOriginal = ref(false);
  const baseAssets = createBaseAssetLibrary();
  const customBase = shallowRef<BaseAsset | null>(null), customBaseName = ref(''), customBaseLoading = ref(false), customBaseError = ref('');
  const ownedCustomBases = new Set<BaseAsset>();
  const baseIsAsset = computed(() => baseShape.value === 'custom' || isAssetBaseShape(baseShape.value));
  let baseAssetRequest = 0;
  const baseOffset = ref<Point3>([0, 0, 0]), baseColor = ref('#ffffff'), baseSelected = ref(false);
  const basePosition = computed<Point3>(() => baseOffset.value.map(v => v * scale.value) as Point3);
  const baseWorldScale = computed(() => scale.value * baseScale.value);
  const baseBottom = computed(() => basePosition.value[1] - baseHeight.value * baseWorldScale.value);
  const basePivot = computed<Point3>(() => [basePosition.value[0], basePosition.value[1] - baseHeight.value * baseWorldScale.value / 2, basePosition.value[2]]);
  // Shared by the viewport and export. Scale around the top center to preserve
  // contact with the model, then rotate around the base's own vertical axis.
  const baseTransform = computed(() => new Matrix4().compose(
    new Vector3(...basePosition.value),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(baseRotationY.value)),
    new Vector3().setScalar(baseWorldScale.value),
  ));
  const baseSignature = computed(() => JSON.stringify([source.value?.id, baseShape.value, baseWidth.value, baseDepth.value, baseHeight.value, baseScale.value, baseRotationY.value, baseOffset.value, baseColor.value, baseAssetOriginal.value, scale.value]));
  const exportedBase = ref('');
  const client = new CutClient(); let revision = 0, currentSize = NaN;
  const range = computed(() => source.value ? projectionRange(source.value.positions, normal.value) : [0, 0]);
  const localSpan = computed(() => Math.max(0, range.value[1]! - range.value[0]!));
  const span = computed(() => localSpan.value * scale.value);
  const offset = computed(() => range.value[0]! + localSpan.value * depthRatio.value);
  const depthMM = computed(() => span.value * depthRatio.value);
  const depthMin = 0, depthMax = span;
  const modelCenter = computed<Point3>(() => {
    if (!source.value) return [0, 0, 0];
    return ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Point3[]).map(axis => {
      const [min, max] = projectionRange(source.value!.positions, axis);
      return (min + max) / 2;
    }) as Point3;
  });
  const planeCenter = computed<Point3>(() => {
    const displacement = offset.value - normal.value.reduce((sum, n, i) => sum + n * modelCenter.value[i]!, 0);
    return modelCenter.value.map((v, i) => (v + normal.value[i]! * displacement) * scale.value) as Point3;
  });
  // Keep the model pivot as a stable internal reference. The viewport gizmo
  // itself is positioned from planeCenter so it follows the rendered plane.
  const pivot = computed<Point3>(() => modelCenter.value.map(v => v * scale.value) as Point3);
  const localPlane = computed<CutPlane>(() => {
    return { normal: normal.value.map(n => flip.value ? -n : n) as Point3, offset: flip.value ? -offset.value : offset.value, cap: true };
  });
  const plane = computed<CutPlane>(() => ({ ...localPlane.value, offset: localPlane.value.offset * scale.value }));
  const bounds = computed(() => source.value ? clippedBounds(source.value, localPlane.value) : null);
  const dimensions = computed(() => {
    const s = bounds.value?.size ?? [0, 0, 0];
    return { width: s[0]! * scale.value, depth: s[2]! * scale.value, height: s[1]! * scale.value };
  });
  const empty = computed(() => !bounds.value || bounds.value.empty);
  const issues = computed(() => result.value ? result.value.stats.boundary + result.value.stats.nonManifold + result.value.stats.winding + result.value.stats.degenerate + result.value.stats.duplicates : 0);
  const baseMesh = computed(() => {
    if (!source.value) return null;
    if (baseShape.value === 'custom' || isAssetBaseShape(baseShape.value)) return baseAsset.value ? resizeBaseAsset(baseAsset.value, baseWidth.value, baseDepth.value, baseHeight.value) : null;
    return buildBaseMesh(baseShape.value, baseWidth.value, baseDepth.value, baseHeight.value, 0);
  });
  const baseReady = computed(() => !!source.value && !baseAssetLoading.value && !customBaseLoading.value && (!baseIsAsset.value || !!baseAsset.value));
  const canExport = computed(() => mode.value === 'add' ? baseAdded.value && baseReady.value && !busy.value : !!result.value && !busy.value);
  const unsaved = computed(() => mode.value === 'add' ? baseAdded.value && exportedBase.value !== baseSignature.value : !!result.value && (exportedResult.value !== result.value || exportedScale.value !== scale.value));
  function cancel() { revision++; client.cancel(); busy.value = false; }
  function invalidate() { cancel(); result.value = null; exportedResult.value = null; failure.value = ''; view.value = 'preview'; }
  watch([rotation, depthRatio, flip], invalidate, { flush: 'sync' });
  function reset() {
    if (customBaseLoading.value) { baseAssetRequest++; customBaseLoading.value = false; }
    customBaseError.value = '';
    invalidate(); rotation.value = [0, 0, 0, 1]; flip.value = false; scale.value = 1; rotating.value = false; dragging.value = false;
    depthRatio.value = 0.05; customMode.value = false;
    baseScale.value = 1; baseRotationY.value = 0;
    baseOffset.value = [0, 0, 0]; baseColor.value = '#ffffff'; baseSelected.value = mode.value === 'add'; baseAdded.value = false; exportedBase.value = '';
    baseAssetOriginal.value = baseIsAsset.value;
  }
  function setMode(next: 'flatten' | 'add') {
    if (busy.value || next === mode.value) return;
    mode.value = next; baseAdded.value = false; failure.value = '';
    baseSelected.value = next === 'add';
    if (next === 'add') { stopRotation(); view.value = 'preview'; }
    else invalidate();
  }
  function invalidateBase() { baseAdded.value = false; if (mode.value === 'add') view.value = 'preview'; }
  async function loadBaseAsset(shape: BaseShape) {
    const request = ++baseAssetRequest;
    customBaseLoading.value = false; customBaseError.value = '';
    baseAsset.value = null; baseAssetError.value = ''; baseAssetLoading.value = isAssetBaseShape(shape);
    if (shape === 'custom') { baseAsset.value = customBase.value; return; }
    if (!isAssetBaseShape(shape)) return;
    try {
      const asset = await baseAssets.get(shape);
      if (request === baseAssetRequest) baseAsset.value = asset;
    } catch (error) {
      if (request === baseAssetRequest) baseAssetError.value = error instanceof Error ? error.message : String(error);
    } finally { if (request === baseAssetRequest) baseAssetLoading.value = false; }
  }
  function fitBaseAssetProportions() {
    const size = baseShape.value === 'custom' ? customBase.value?.size : isAssetBaseShape(baseShape.value) ? baseAssetPresets[baseShape.value].size : null;
    if (!size) return;
    const [width, height, depth] = size;
    const factor = Math.max(baseWidth.value, baseDepth.value) / Math.max(width, depth);
    baseWidth.value = width * factor; baseDepth.value = depth * factor; baseHeight.value = height * factor;
  }
  function setBaseShape(next: BaseShape) {
    if (next === baseShape.value || (next === 'custom' && !customBase.value)) return;
    baseShape.value = next; baseAssetOriginal.value = next === 'custom' || isAssetBaseShape(next);
    fitBaseAssetProportions(); invalidateBase(); return loadBaseAsset(next);
  }
  async function importCustomBase(files: File[]) {
    if (!source.value || busy.value || baseAssetLoading.value || !files.length) return;
    const request = ++baseAssetRequest;
    customBaseLoading.value = true; customBaseError.value = ''; baseAssetLoading.value = false;
    try {
      const asset = await loadCustomBase(files);
      if (request !== baseAssetRequest) { asset.dispose(); return; }
      const previous = customBase.value;
      ownedCustomBases.add(asset); customBase.value = asset;
      customBaseName.value = files.find(file => /\.(glb|fbx|obj|stl)$/i.test(file.name))!.name;
      baseAsset.value = asset; baseShape.value = 'custom'; baseAssetOriginal.value = true;
      baseAssetError.value = ''; exportedBase.value = ''; fitBaseAssetProportions(); invalidateBase();
      // Let the viewport detach the previous clone before freeing its resources.
      if (previous) void nextTick(() => { previous.dispose(); ownedCustomBases.delete(previous); });
    } catch (error) {
      if (request === baseAssetRequest) customBaseError.value = error instanceof Error ? error.message : String(error);
    } finally { if (request === baseAssetRequest) customBaseLoading.value = false; }
  }
  function retryBaseAsset() { return loadBaseAsset(baseShape.value); }
  function restoreBaseAppearance() {
    if (!baseIsAsset.value || baseAssetOriginal.value) return;
    baseAssetOriginal.value = true; invalidateBase();
  }
  function setBaseDimension(axis: 'width' | 'depth' | 'height', value: number) {
    if (!Number.isFinite(value) || value <= 0 || value > 10000) return;
    if (axis === 'width') baseWidth.value = value;
    if (axis === 'depth') baseDepth.value = value;
    if (axis === 'height') baseHeight.value = value;
    invalidateBase();
  }
  function setBaseScale(value: number) {
    if (!Number.isFinite(value) || value < 0.25 || value > 3 || value === baseScale.value) return;
    baseScale.value = value; invalidateBase();
  }
  function setBaseRotationY(value: number) {
    if (!Number.isFinite(value) || value < -180 || value > 180 || value === baseRotationY.value) return;
    baseRotationY.value = value; invalidateBase();
  }
  function setBasePosition(position: Point3) {
    if (!source.value || busy.value || position.some(v => !Number.isFinite(v) || Math.abs(v) > 10000)) return;
    const next = position.map(v => v / scale.value) as Point3;
    if (next.every((v, i) => Math.abs(v - baseOffset.value[i]!) < 1e-9)) return;
    baseOffset.value = next; invalidateBase();
  }
  function setBaseWorldCenter(position: Point3) {
    setBasePosition([position[0], position[1] + baseHeight.value * baseWorldScale.value / 2, position[2]]);
  }
  function setBaseColor(value: string) {
    if (!/^#[\da-f]{6}$/i.test(value) || (value.toLowerCase() === baseColor.value && !baseAssetOriginal.value)) return;
    baseColor.value = value.toLowerCase(); baseAssetOriginal.value = false; invalidateBase();
  }
  function selectBase(selected = true) {
    if (mode.value !== 'add' || !source.value || busy.value) return;
    baseSelected.value = selected;
  }
  function addBase() { if (baseReady.value) { baseSelected.value = false; baseAdded.value = true; view.value = 'result'; } }
  function setRotation(value: PlaneRotation) {
    if (value.some(v => !Number.isFinite(v))) return;
    const q = new Quaternion(...value);
    if (q.lengthSq() < 1e-12) return;
    rotation.value = q.normalize().toArray();
  }
  function setDirection(value: RotationAxis, keepGizmo = false) {
    const presets: Record<RotationAxis, Euler> = { x: new Euler(0, 0, -Math.PI / 2), y: new Euler(), z: new Euler(Math.PI / 2, 0, 0) };
    if (!presets[value]) return;
    if (keepGizmo) { customMode.value = false; rotating.value = true; dragging.value = false; view.value = 'preview'; }
    else { stopRotation(); customMode.value = false; }
    setRotation(new Quaternion().setFromEuler(presets[value]).toArray());
  }
  function setAngle(axis: RotationAxis, value: number) {
    if (!Number.isFinite(value)) return;
    customMode.value = true;
    const next = { ...angles.value, [axis]: ((value + 180) % 360 + 360) % 360 - 180 };
    setRotation(new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(next.x), MathUtils.degToRad(next.y), MathUtils.degToRad(next.z), 'XYZ')).toArray());
  }
  function toggleRotation() {
    if (busy.value || !source.value) return;
    if (rotating.value) stopRotation(); else activateRotation();
  }
  function activateRotation() {
    if (busy.value || !source.value) return;
    customMode.value = true; rotating.value = true; view.value = 'preview';
  }
  function stopRotation() { rotating.value = false; dragging.value = false; }
  function setDepthMM(value: number) {
    if (!Number.isFinite(value) || span.value <= 0) return;
    depthRatio.value = Math.min(1, Math.max(0, value / span.value));
  }
  function setDimension(axis: DimensionAxis, value: number) {
    const previous = dimensions.value[axis];
    if (!Number.isFinite(value) || value <= 0 || previous < 1e-8 || empty.value) return;
    const factor = value / previous, largest = Math.max(...Object.values(dimensions.value)) * factor;
    // Avoid zero-size geometry, numeric overflow and unusably large camera ranges.
    if (largest < 0.01 || largest > 100000) return;
    scale.value *= factor;
  }
  function install(mesh: PrintMeshInput, id: string, name: string) {
    const positions = mesh.positions.slice(), [minY, maxY] = projectionRange(positions, [0, 1, 0]);
    const [minX, maxX] = projectionRange(positions, [1, 0, 0]), [minZ, maxZ] = projectionRange(positions, [0, 0, 1]);
    const reference = maxY - minY > 1e-8 ? maxY - minY : Math.max(maxX - minX, maxZ - minZ, 1e-8);
    const unit = (Number.isFinite(height()) && height() > 0 ? height() : 80) / reference;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (positions[i]! - (minX + maxX) / 2) * unit;
      positions[i + 1] = (positions[i + 1]! - minY) * unit;
      positions[i + 2] = (positions[i + 2]! - (minZ + maxZ) / 2) * unit;
    }
    // PrintMesh colors are baked sRGB values in 0–255, even when Float32.
    // Three.js vertex colors use linear RGB; do not apply material factors twice.
    const colors = mesh.colors ? new Float32Array(mesh.colors.length) : null, color = new Color();
    if (colors) for (let i = 0; i < colors.length; i += 3) {
      color.setRGB(mesh.colors![i]! / 255, mesh.colors![i + 1]! / 255, mesh.colors![i + 2]! / 255).convertSRGBToLinear();
      colors.set([color.r, color.g, color.b], i);
    }
    const visual = 'uvs' in mesh && 'faceMat' in mesh && 'materials' in mesh && 'images' in mesh ? {
      uvs: mesh.uvs ? mesh.uvs.slice() : null,
      colors,
      faceMat: mesh.faceMat.slice(),
      materials: mesh.materials.map(material => ({ ...material, factor: [...material.factor] as [number, number, number] })),
      images: mesh.images.slice(),
    } satisfies BaseAppearance : null;
    source.value = { positions, indices: mesh.indices.slice(), id, name, appearance: visual }; reset();
    const x = projectionRange(positions, [1, 0, 0]), z = projectionRange(positions, [0, 0, 1]);
    baseWidth.value = Math.max(12, Number(((x[1] - x[0]) * 0.82).toFixed(1)));
    baseDepth.value = Math.max(12, Number(((z[1] - z[0]) * 0.82).toFixed(1)));
    baseHeight.value = Math.max(4, Number((Math.min(baseWidth.value, baseDepth.value) * 0.22).toFixed(1)));
    fitBaseAssetProportions();
    baseAdded.value = false;
  }
  function syncCurrent() {
    const current = content();
    if (!current) { invalidate(); source.value = null; baseSelected.value = false; baseAdded.value = false; return; }
    install(current.mesh, current.id, current.root.name || '当前模型'); currentSize = height();
  }
  watch(() => [content()?.id, height(), active()] as const, ([id, size, enabled]) => {
    if (enabled && (!source.value || currentSize !== size || source.value.id !== id)) syncCurrent();
  }, { immediate: true });
  watch(active, enabled => { if (!enabled) { stopRotation(); baseSelected.value = false; cancel(); } });
  watch(view, value => { if (value === 'result') stopRotation(); });
  async function apply() {
    if (mode.value === 'add') { addBase(); return; }
    if (!source.value || busy.value || empty.value) return;
    stopRotation(); failure.value = ''; busy.value = true; const ticket = ++revision;
    try {
      const next = await client.run(source.value, { ...localPlane.value, normal: [...localPlane.value.normal] });
      if (ticket !== revision) return;
      result.value = next; view.value = 'result';
    } catch (error) { if (ticket === revision && !(error instanceof CancelledCutError)) failure.value = error instanceof Error ? error.message : String(error); }
    finally { if (ticket === revision) busy.value = false; }
  }
  function exportSTL() {
    if (!canExport.value || !source.value) return;
    if (mode.value === 'add' && baseMesh.value) {
      const model = source.value, base = baseMesh.value, positions = new Float32Array(model.positions.length + base.positions.length);
      positions.set(model.positions.map(v => v * scale.value));
      const point = new Vector3(), transform = baseTransform.value;
      for (let i = 0; i < base.positions.length; i += 3) {
        point.fromArray(base.positions, i).applyMatrix4(transform).toArray(positions, model.positions.length + i);
      }
      const indices = new Uint32Array(model.indices.length + base.indices.length);
      indices.set(model.indices); for (let i = 0; i < base.indices.length; i++) indices[model.indices.length + i] = base.indices[i]! + model.positions.length / 3;
      // Use the combined lowest point so moving the base above the model does
      // not clamp the model's lower vertices to Z=0 during STL alignment.
      const merged: CutResult = { positions, indices, surfaceIndexCount: indices.length, plane: { normal: [0, 1, 0], offset: projectionRange(positions, [0, 1, 0])[0], cap: false }, stats: { sourceFaces: indices.length / 3, removedFaces: 0, splitFaces: 0, capFaces: 0, loops: 0, boundary: 0, nonManifold: 0, winding: 0, degenerate: 0, duplicates: 0, capDeviation: 0 } };
      downloadFile(new Blob([cutSTL(merged)], { type: 'model/stl' }), `${source.value.name.replace(/\.(glb|fbx)$/i, '') || 'model'}-base.stl`);
      exportedBase.value = baseSignature.value;
      return;
    }
    if (!result.value) return;
    const scaled = { ...result.value, positions: result.value.positions.map(v => v * scale.value), plane: { ...result.value.plane, offset: result.value.plane.offset * scale.value } };
    downloadFile(new Blob([cutSTL(scaled)], { type: 'model/stl' }), `${source.value?.name.replace(/\.(glb|fbx)$/i, '') || 'model'}-flat-base.stl`);
    exportedResult.value = result.value; exportedScale.value = scale.value;
  }
  onScopeDispose(() => { cancel(); baseAssetRequest++; baseAssets.dispose(); ownedCustomBases.forEach(asset => asset.dispose()); ownedCustomBases.clear(); });
  return reactive({ source, result, direction, normal, rotation, angles, pivot, planeCenter, customMode, rotating, dragging, depthMin, depthMax, depthMM, flip, scale, view, busy, failure, span, plane, dimensions, empty, issues, canExport, unsaved, mode, customBase, customBaseName, customBaseLoading, customBaseError, importCustomBase, baseShape, baseWidth, baseDepth, baseHeight, baseScale, baseRotationY, baseTransform, baseBottom, baseAdded, baseMesh, baseReady, baseAsset, baseIsAsset, baseAssetOriginal, baseAssetLoading, baseAssetError, retryBaseAsset, restoreBaseAppearance, basePosition, basePivot, baseColor, baseSelected, setBasePosition, setBaseWorldCenter, setBaseColor, selectBase, setMode, setBaseShape, setBaseDimension, setBaseScale, setBaseRotationY, addBase, setRotation, setAngle, toggleRotation, activateRotation, stopRotation, setDirection, setDepthMM, setDimension, apply, reset, cancel, exportSTL });
}
export type BaseProcessingController = ReturnType<typeof useBaseProcessing>;
