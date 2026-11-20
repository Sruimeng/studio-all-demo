import { computed, nextTick, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue';
import { buildBaseMesh, CutClient, CancelledCutError, clippedBounds, cutSTL, projectionRange, type BaseShape, type CutPlane, type CutResult, type MeshData, type Point3 } from '~/@engine/base-processing';
import { Color, MathUtils, Matrix4, Quaternion, Ray, Vector3 } from 'three';
import type { ViewerContent } from '~/@engine/viewer';
import type { PrintMeshInput } from '~/@engine/multicolor';
import { downloadFile } from '~/@base/storage';
import { baseAssetPresets, createBaseAssetLibrary, isAssetBaseShape, resizeBaseAsset, type BaseAsset } from './base-assets';
import { loadCustomBase } from './custom-base';
import { baseSurfaceHeight, buildTextMesh, textFonts, type TextFont } from './text-geometry';
import { conformTextToBase, subdivideText, textBaseSurface, textSurfaceOrientation, type TextSurfaceHit } from './text-surface';

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
export type CutDirection = 'x' | 'y' | 'z';
export type PlaneRotation = [number, number, number, number];
export function useBaseProcessing(content: () => ViewerContent | null, height: () => number, active: () => boolean) {
  const source = shallowRef<BaseSource | null>(null), result = shallowRef<CutResult | null>(null);
  const exportedResult = shallowRef<CutResult | null>(null), exportedScale = ref(1);
  const direction = ref<CutDirection>('y'), depthRatio = ref(0.05);
  const flip = ref(false), scale = ref(1), dragging = ref(false);
  const axisNormals: Record<CutDirection, Point3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  const normal = computed<Point3>(() => axisNormals[direction.value]);
  const rotation = computed<PlaneRotation>(() => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...normal.value)).toArray());
  const view = ref<'preview' | 'result'>('preview'), busy = ref(false), failure = ref('');
  const mode = ref<'flatten' | 'add'>('flatten');
  const baseShape = ref<BaseShape>('round'), baseWidth = ref(36), baseDepth = ref(36), baseHeight = ref(8), baseAdded = ref(false);
  const baseScale = ref(1), baseRotationY = ref(0);
  const baseAsset = shallowRef<BaseAsset | null>(null), baseAssetLoading = ref(false), baseAssetError = ref(''), baseAssetOriginal = ref(false);
  const baseAssets = createBaseAssetLibrary();
  const customBase = shallowRef<BaseAsset | null>(null), customBaseName = ref(''), customBaseSize = ref(0), customBaseLoading = ref(false), customBaseError = ref('');
  const ownedCustomBases = new Set<BaseAsset>();
  const baseIsAsset = computed(() => baseShape.value === 'custom' || isAssetBaseShape(baseShape.value));
  let baseAssetRequest = 0;
  const baseOffset = ref<Point3>([0, 0, 0]), baseColor = ref('#ffffff'), baseSelected = ref(false);
  // Keep editable text geometry and its transform in the controller so preview
  // and export use exactly the same mesh, even after remounting the viewport.
  const textContent = ref('Text'), textAdded = ref(false), textSelected = ref(false), textScale = ref(1), textColor = ref('#f5d787'), textFont = ref<TextFont>('Helvetiker');
  const textPosition = ref<Point3>([0, 0, 0]), textSnapped = ref(false), textError = ref(''), textRotationY = ref(0);
  const textSurfaceHeld = ref(false);
  const textOrientation = shallowRef(new Quaternion()), textSurfaceAttached = ref(false), textCurved = ref(false), textSurfaceHint = ref('');
  let textRestMesh: MeshData | null = null;
  const surfaceFrame = new Quaternion(), surfaceNormal = new Vector3(0, 1, 0);
  let textAnchor: Vector3 | null = null;
  let textSurfaceDragging = false;
  const textMetrics = ref({ width: 0, height: 12, depth: 2 });
  const textMeshData = shallowRef<MeshData | null>(null);
  const basePosition = computed<Point3>(() => baseOffset.value.map(v => v * scale.value) as Point3);
  const baseWorldScale = computed(() => scale.value * baseScale.value);
  const baseBottom = computed(() => basePosition.value[1] - baseHeight.value * baseWorldScale.value);
  const basePivot = computed<Point3>(() => [basePosition.value[0], basePosition.value[1] - baseHeight.value * baseWorldScale.value / 2, basePosition.value[2]]);
  const textWorldScale = computed(() => scale.value * textScale.value);
  const textWorldHeight = computed(() => textMetrics.value.height * textWorldScale.value);
  const textPivot = computed<Point3>(() => [...textPosition.value] as Point3);
  const textTransform = computed(() => new Matrix4().compose(new Vector3(...textPosition.value), textOrientation.value, new Vector3().setScalar(textWorldScale.value)));
  const textContact = computed<Point3>(() => new Vector3(0, textSurfaceAttached.value ? 0 : -textMetrics.value.height / 2, textSurfaceAttached.value ? -textMetrics.value.depth / 2 : 0).applyMatrix4(textTransform.value).toArray());
  // Shared by the viewport and export. Scale around the top center to preserve
  // contact with the model, then rotate around the base's own vertical axis.
  const baseTransform = computed(() => new Matrix4().compose(
    new Vector3(...basePosition.value),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(baseRotationY.value)),
    new Vector3().setScalar(baseWorldScale.value),
  ));
  const baseSignature = computed(() => JSON.stringify([source.value?.id, baseShape.value, baseWidth.value, baseDepth.value, baseHeight.value, baseScale.value, baseRotationY.value, baseOffset.value, baseColor.value, baseAssetOriginal.value, scale.value, textAdded.value, textContent.value, textFont.value, textScale.value, textColor.value, textPosition.value, textOrientation.value.toArray(), textSurfaceAttached.value]));
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
  // Keep the model center as a stable reference while the plane moves along its normal.
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
  const textReady = computed(() => !textAdded.value || !!textMeshData.value);
  const canExport = computed(() => mode.value === 'add' ? baseAdded.value && baseReady.value && textReady.value && !busy.value : !!result.value && !busy.value);
  const unsaved = computed(() => mode.value === 'add' ? baseAdded.value && exportedBase.value !== baseSignature.value : !!result.value && (exportedResult.value !== result.value || exportedScale.value !== scale.value));
  function cancel() { revision++; client.cancel(); busy.value = false; }
  function invalidate() { cancel(); result.value = null; exportedResult.value = null; failure.value = ''; view.value = 'preview'; }
  watch([direction, depthRatio, flip], invalidate, { flush: 'sync' });
  function reset() {
    textAdded.value = false; textAnchor = null; textSurfaceDragging = false; textSurfaceHeld.value = false;
    if (customBaseLoading.value) { baseAssetRequest++; customBaseLoading.value = false; }
    customBaseError.value = '';
    invalidate(); direction.value = 'y'; flip.value = false; scale.value = 1; dragging.value = false;
    depthRatio.value = 0.05;
    baseScale.value = 1; baseRotationY.value = 0;
    baseOffset.value = [0, 0, 0]; baseColor.value = '#ffffff'; baseSelected.value = mode.value === 'add'; baseAdded.value = false; exportedBase.value = '';
    textContent.value = 'Text'; textFont.value = 'Helvetiker'; textSelected.value = false; textScale.value = 1; textColor.value = '#f5d787'; textPosition.value = [0, 0, 0]; textSnapped.value = false; textMeshData.value = null; textError.value = ''; textRotationY.value = 0; textOrientation.value = new Quaternion(); textSurfaceAttached.value = false; textCurved.value = false; textSurfaceHint.value = ''; textRestMesh = null;
    baseAssetOriginal.value = baseIsAsset.value;
  }
  function setMode(next: 'flatten' | 'add') {
    if (busy.value || next === mode.value) return;
    endTextSurfaceDrag();
    mode.value = next; baseAdded.value = false; failure.value = '';
    baseSelected.value = next === 'add';
    textSelected.value = false;
    dragging.value = false;
    if (next === 'add') view.value = 'preview';
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
      const modelFile = files.find(file => /\.(glb|fbx|obj|stl)$/i.test(file.name)) ?? files[0]!;
      customBaseName.value = modelFile.name; customBaseSize.value = modelFile.size;
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
    baseOffset.value = next;
    invalidateBase();
  }
  function setBaseWorldCenter(position: Point3) {
    setBasePosition([position[0], position[1] + baseHeight.value * baseWorldScale.value / 2, position[2]]);
  }
  function setBaseColor(value: string) {
    if (!/^#[\da-f]{6}$/i.test(value) || (value.toLowerCase() === baseColor.value && !baseAssetOriginal.value)) return;
    baseColor.value = value.toLowerCase(); baseAssetOriginal.value = false; invalidateBase();
  }
  function setTextColor(value: string) {
    if (!/^#[\da-f]{6}$/i.test(value) || value.toLowerCase() === textColor.value) return;
    textColor.value = value.toLowerCase(); invalidateBase();
  }
  function setTextFont(value: string) {
    if (!textFonts.includes(value as TextFont) || value === textFont.value) return;
    textFont.value = value as TextFont; rebuildText(); invalidateBase();
  }
  function setTextContent(value: string) {
    const next = Array.from(value.replace(/[\r\n\t]/g, ' ')).slice(0, 32).join('');
    if (next === textContent.value) return;
    textContent.value = next; rebuildText(); invalidateBase();
  }
  function setTextScale(value: number) {
    if (!Number.isFinite(value) || value < 0.05 || value > 3 || value === textScale.value) return;
    const contact = new Vector3(...textContact.value);
    textScale.value = value;
    if (textSnapped.value) syncTextToBase();
    else {
      const offset = new Vector3(0, textSurfaceAttached.value ? 0 : textWorldHeight.value / 2, textSurfaceAttached.value ? textMetrics.value.depth * textWorldScale.value / 2 : 0).applyQuaternion(textOrientation.value);
      textPosition.value = contact.add(offset).toArray();
    }
    invalidateBase();
  }
  function detachText(position: Point3) {
    textSurfaceHeld.value = false;
    textSnapped.value = false; textAnchor = null; textCurved.value = false; textSurfaceHint.value = '';
    textMeshData.value = textRestMesh; textPosition.value = [...position];
  }
  function attachTextSurface(hit: TextSurfaceHit) {
    if (!textRestMesh || !baseMesh.value) return false;
    const unit = textWorldScale.value / baseWorldScale.value, surface = textBaseSurface(baseMesh.value);
    const continuing = textSurfaceDragging && textSurfaceAttached.value && textSnapped.value && !!textAnchor;
    if (continuing && !surface.follow({ point: textAnchor!, normal: surfaceNormal, distance: 0 }, hit, Math.max(0.3, 0.6 * unit))) return false;
    const stable = surface.smooth(hit, Math.max(0.12, 0.65 * unit));
    if (continuing) {
      const distance = stable.point.distanceTo(textAnchor!);
      stable.normal.copy(surfaceNormal.clone().lerp(stable.normal, Math.min(0.65, 0.25 + distance / Math.max(unit * 3, 0.001))).normalize());
    }
    // Transport the existing frame instead of changing the up axis at a threshold.
    const orientation = textSurfaceOrientation(stable.normal, continuing ? surfaceFrame : undefined);
    const conformed = conformTextToBase(textRestMesh, baseMesh.value, stable.point, orientation, unit, textMetrics.value.depth);
    if (!conformed) {
      textSurfaceHint.value = 'Text exceeds the surface. Scale it down or move inward. / 文字超出可贴合区域，请缩小或向内移动。';
      return false;
    }
    textAnchor = stable.point.clone(); surfaceNormal.copy(stable.normal); surfaceFrame.copy(orientation);
    textSurfaceAttached.value = true; textSnapped.value = true; textSurfaceHeld.value = false; textSurfaceHint.value = '';
    placeSurfaceText(conformed);
    return true;
  }
  function beginTextSurfaceDrag() { textSurfaceDragging = true; textSurfaceHeld.value = false; }
  function endTextSurfaceDrag() { textSurfaceDragging = false; textSurfaceHeld.value = false; }
  function retainTextSurface() {
    if (!textSurfaceDragging || !textSurfaceAttached.value || !textSnapped.value) return false;
    textSurfaceHeld.value = true;
    textSurfaceHint.value = 'Keeping the last fit. Move to a smoother area or scale the text down. / 已保留最近的贴合位置，请移到平缓区域或缩小文字。';
    return true;
  }
  function placeSurfaceText(conformed: NonNullable<ReturnType<typeof conformTextToBase>>) {
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(baseRotationY.value));
    textOrientation.value = rotation.multiply(surfaceFrame);
    const normal = surfaceNormal.clone().transformDirection(baseTransform.value);
    textPosition.value = textAnchor!.clone().applyMatrix4(baseTransform.value).addScaledVector(normal, textMetrics.value.depth * textWorldScale.value / 2 - 0.08 * scale.value).toArray();
    textMeshData.value = conformed.mesh; textCurved.value = conformed.curved;
  }
  // Drag placement uses the actual front-facing base surface, including side walls.
  function setTextSurfaceFromRay(origin: Point3, direction: Point3, near = false) {
    if (!textRestMesh || !baseReady.value || !baseMesh.value || busy.value) return false;
    const inverse = baseTransform.value.clone().invert();
    const hit = textBaseSurface(baseMesh.value).raycast(new Vector3(...origin).applyMatrix4(inverse), new Vector3(...direction).transformDirection(inverse));
    if (!hit) return false;
    if (near && hit.point.clone().applyMatrix4(baseTransform.value).distanceTo(new Vector3(...textContact.value)) > 5 * scale.value) return false;
    const attached = attachTextSurface(hit); if (attached) { invalidateBase(); return true; }
    if (textAnchor && textSurfaceDragging) {
      const ray = new Ray(new Vector3(...origin).applyMatrix4(inverse), new Vector3(...direction).transformDirection(inverse));
      // Keep a valid placement near a rim; a deliberate pull away releases it.
      if (ray.distanceToPoint(textAnchor) < 6 * scale.value / baseWorldScale.value) return retainTextSurface();
    }
    return false;
  }

  function setTextPosition(position: Point3, surfaceDrop = false) {
    if (!source.value || !textAdded.value || busy.value || position.some(v => !Number.isFinite(v) || Math.abs(v) > 10000)) return;
    const local = new Vector3(...position).applyMatrix4(baseTransform.value.clone().invert());
    if (textSurfaceAttached.value && baseReady.value && baseMesh.value) {
      const back = new Vector3(0, 0, -textMetrics.value.depth * textWorldScale.value / 2).applyQuaternion(textOrientation.value).add(new Vector3(...position)).applyMatrix4(baseTransform.value.clone().invert());
      const distance = (textSnapped.value ? 4 : 2.4) * scale.value / baseWorldScale.value;
      const hit = textBaseSurface(baseMesh.value).nearest(back, distance);
      if (hit && attachTextSurface(hit)) { invalidateBase(); return; }
      if (hit && retainTextSurface()) return;
      detachText(position); invalidateBase(); return;
    }
    const surface = baseReady.value && baseMesh.value ? baseSurfaceHeight(baseMesh.value, local.x, local.z) : null;
    const targetY = surface === null ? null : surface * baseWorldScale.value + basePosition.value[1] + textWorldHeight.value / 2 - 0.08 * scale.value;
    const threshold = Math.max(2.4 * scale.value, textWorldHeight.value * 0.3);
    textSnapped.value = targetY !== null && (surfaceDrop || Math.abs(position[1] - targetY) <= threshold);
    textAnchor = textSnapped.value ? new Vector3(local.x, surface!, local.z) : null;
    if (textSnapped.value) {
      textRotationY.value = baseRotationY.value;
      textOrientation.value = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(textRotationY.value));
      textPosition.value = [position[0], targetY!, position[2]];
    } else {
      // Free-standing text also magnetizes to a nearby side surface by its back.
      const back = new Vector3(0, 0, -textMetrics.value.depth * textWorldScale.value / 2).applyQuaternion(textOrientation.value).add(new Vector3(...position)).applyMatrix4(baseTransform.value.clone().invert());
      const hit = baseReady.value && baseMesh.value ? textBaseSurface(baseMesh.value).nearest(back, 2.4 * scale.value / baseWorldScale.value) : null;
      if (!hit || !attachTextSurface(hit)) detachText(position);
    }
    invalidateBase();
  }
  function setTextWorldPosition(position: Point3) { setTextPosition(position); }
  function rebuildText() {
    textMeshData.value = null; textRestMesh = null; textError.value = '';
    if (!textAdded.value) return;
    try {
      const mesh = buildTextMesh(textContent.value, textFont.value);
      textMetrics.value = { width: mesh.size[0], height: mesh.size[1], depth: mesh.size[2] };
      textRestMesh = subdivideText(mesh); textMeshData.value = textRestMesh;
      if (textSnapped.value) syncTextToBase();
    } catch (error) { textError.value = error instanceof Error ? error.message : String(error); }
  }
  function syncTextToBase() {
    if (!textAdded.value || !textSnapped.value || !textAnchor || !baseMesh.value || !baseReady.value) return;
    if (textSurfaceAttached.value && textRestMesh) {
      const conformed = conformTextToBase(textRestMesh, baseMesh.value, textAnchor, surfaceFrame, textWorldScale.value / baseWorldScale.value, textMetrics.value.depth);
      if (conformed) placeSurfaceText(conformed);
      else { detachText(textPosition.value); textSurfaceHint.value = 'Text exceeds the surface. Scale it down or move inward. / 文字超出可贴合区域，请缩小或向内移动。'; }
      return;
    }
    const surface = baseSurfaceHeight(baseMesh.value, textAnchor.x, textAnchor.z);
    if (surface === null) { detachText(textPosition.value); return; }
    textAnchor.y = surface;
    const contact = textAnchor.clone().applyMatrix4(baseTransform.value);
    textPosition.value = [contact.x, contact.y + textWorldHeight.value / 2 - 0.08 * scale.value, contact.z];
    textRotationY.value = baseRotationY.value;
    textOrientation.value = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(textRotationY.value));
  }
  watch([baseTransform, baseMesh, baseReady], syncTextToBase, { flush: 'sync' });
  function addText() {
    if (!baseReady.value || mode.value !== 'add' || busy.value) return;
    if (textAdded.value) { selectText(); return; }
    if (!textContent.value.trim()) textContent.value = 'Text';
    textAdded.value = true; baseSelected.value = false; textSelected.value = true; rebuildText();
    const initial = new Vector3(0, 0, baseDepth.value * 0.32).applyMatrix4(baseTransform.value);
    setTextPosition(initial.toArray(), true); invalidateBase();
  }
  function removeText() {
    textAdded.value = false; endTextSurfaceDrag(); textSelected.value = false; textSnapped.value = false; textAnchor = null; textSurfaceAttached.value = false; textCurved.value = false; textRestMesh = null; textSurfaceHint.value = ''; textMeshData.value = null; textError.value = ''; invalidateBase();
  }
  function selectText(selected = true) {
    if (mode.value !== 'add' || !textAdded.value || busy.value) return;
    textSelected.value = selected;
    if (selected) baseSelected.value = false;
  }
  function selectBase(selected = true) {
    if (mode.value !== 'add' || !source.value || busy.value) return;
    baseSelected.value = selected;
    if (selected) textSelected.value = false;
  }
  function addBase() { if (baseReady.value && textReady.value) { baseSelected.value = false; textSelected.value = false; baseAdded.value = true; view.value = 'result'; } }
  function setDirection(value: CutDirection) {
    if (busy.value || !source.value || !['x', 'y', 'z'].includes(value)) return;
    direction.value = value;
  }
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
    scale.value *= factor; if (textSnapped.value) syncTextToBase();
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
  watch(active, enabled => { if (!enabled) { dragging.value = false; baseSelected.value = false; textSelected.value = false; cancel(); } });
  async function apply() {
    if (mode.value === 'add') { addBase(); return; }
    if (!source.value || busy.value || empty.value) return;
    failure.value = ''; busy.value = true; const ticket = ++revision;
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
      const model = source.value, base = baseMesh.value, text = textAdded.value ? textMeshData.value : null;
      if (textAdded.value && !text) return;
      const textPositions = text ? text.positions.length : 0;
      const positions = new Float32Array(model.positions.length + base.positions.length + textPositions);
      positions.set(model.positions.map(v => v * scale.value));
      const point = new Vector3(), transform = baseTransform.value;
      for (let i = 0; i < base.positions.length; i += 3) {
        point.fromArray(base.positions, i).applyMatrix4(transform).toArray(positions, model.positions.length + i);
      }
      const textOffset = model.positions.length / 3 + base.positions.length / 3;
      if (text) {
        for (let i = 0; i < text.positions.length; i += 3) point.fromArray(text.positions, i).applyMatrix4(textTransform.value).toArray(positions, model.positions.length + base.positions.length + i);
      }
      const indices = new Uint32Array(model.indices.length + base.indices.length + (text?.indices.length ?? 0));
      indices.set(model.indices); for (let i = 0; i < base.indices.length; i++) indices[model.indices.length + i] = base.indices[i]! + model.positions.length / 3;
      if (text) for (let i = 0; i < text.indices.length; i++) indices[model.indices.length + base.indices.length + i] = text.indices[i]! + textOffset;
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
  return reactive({ source, result, direction, normal, rotation, pivot, planeCenter, dragging, depthMin, depthMax, depthMM, flip, scale, view, busy, failure, span, plane, dimensions, empty, issues, canExport, unsaved, mode, customBase, customBaseName, customBaseSize, customBaseLoading, customBaseError, importCustomBase, baseShape, baseWidth, baseDepth, baseHeight, baseScale, baseRotationY, baseTransform, baseBottom, baseAdded, baseMesh, baseReady, baseAsset, baseIsAsset, baseAssetOriginal, baseAssetLoading, baseAssetError, retryBaseAsset, restoreBaseAppearance, basePosition, basePivot, baseColor, baseSelected, setBasePosition, setBaseWorldCenter, setBaseColor, selectBase, setMode, setBaseShape, setBaseDimension, setBaseScale, setBaseRotationY, addBase, setDirection, setDepthMM, setDimension, apply, reset, cancel, exportSTL, textContent, textAdded, textSelected, textFont, textScale, textColor, textPosition, textPivot, textWorldScale, textWorldHeight, textSnapped, textMetrics, textMeshData, textTransform, textOrientation, textContact, textSurfaceAttached, textCurved, textSurfaceHint, textSurfaceHeld, retainTextSurface, beginTextSurfaceDrag, endTextSurfaceDrag, setTextSurfaceFromRay, textReady, textError, setTextContent, setTextFont, setTextColor, setTextScale, setTextPosition, setTextWorldPosition, addText, removeText, selectText });
}
export type BaseProcessingController = ReturnType<typeof useBaseProcessing>;
