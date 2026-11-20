import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, shallowRef } from 'vue';
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, Object3D, PerspectiveCamera, Quaternion, Scene, Vector3 } from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { cutMesh } from '../app/@engine/base-processing/geometry';
import type { ViewerContent } from '../app/@engine/viewer';
import { useBaseProcessing } from '../app/@feature/base-processing';
import { prepareBaseAsset } from '../app/@feature/base-processing/base-assets';
import { createBaseTranslationControls } from '../app/@feature/base-processing/base-translation-controls';
import { Mesh, MeshStandardMaterial } from 'three';

const mocks = vi.hoisted(() => ({ run: vi.fn(), cancel: vi.fn(), download: vi.fn(), asset: vi.fn(), disposeAssets: vi.fn(), custom: vi.fn() }));
vi.mock('~/@feature/base-processing/custom-base', () => ({ loadCustomBase: mocks.custom }));
vi.mock('~/@feature/base-processing/base-assets', async original => ({
  ...await original<object>(), createBaseAssetLibrary: () => ({ get: mocks.asset, dispose: mocks.disposeAssets }),
}));
vi.mock('~/@engine/base-processing', async original => ({
  ...await original<object>(), CutClient: class { run = mocks.run; cancel = mocks.cancel; },
}));
vi.mock('~/@base/storage', () => ({ downloadFile: mocks.download }));
const scopes: ReturnType<typeof effectScope>[] = [];
beforeEach(() => { vi.clearAllMocks(); mocks.run.mockImplementation(async (mesh, plane) => cutMesh(mesh, plane)); mocks.asset.mockReset(); mocks.custom.mockReset(); });
afterEach(() => scopes.splice(0).forEach(s => s.stop()));
function setup() {
  const geometry = new BoxGeometry(20,20,20), root = new Group(); root.name = 'test';
  const mesh = { positions: new Float32Array(geometry.attributes.position!.array), indices: new Uint32Array(geometry.index!.array) };
  geometry.dispose();
  const content = shallowRef({ id: 'one', root, mesh } as ViewerContent), height = ref(80), active = ref(true);
  const scope = effectScope(); scopes.push(scope);
  const tool = scope.run(() => useBaseProcessing(() => content.value, () => height.value, () => active.value))!;
  return { tool, content, height, active, scope };
}

it('disables viewport editing in Flatten and keeps Add Base translation and Shift snapping', () => {
  const { tool } = setup(), scene = new Scene(), camera = new PerspectiveCamera();
  camera.position.set(100, 80, 160); camera.lookAt(0, 40, 0);
  const canvas = Object.assign(new EventTarget(), {
    style: { touchAction: 'auto', cursor: '' },
    hasPointerCapture: () => false,
  }) as unknown as HTMLCanvasElement;
  const windowEvents = new EventTarget(); vi.stubGlobal('window', windowEvents);
  const controls = createBaseTranslationControls(camera, scene, canvas, new Object3D(), tool, () => {});
  const transform = (scene.children.find(child => 'controls' in child) as ReturnType<TransformControls['getHelper']>).controls;
  try {
    for (const axis of ['x', 'y', 'z'] as const) {
      tool.setDirection(axis); tool.setDepthMM(24);
      expect(transform.enabled).toBe(false); expect(transform.object).toBeUndefined();
    }
    tool.setMode('add');
    const shifted = Object.assign(new Event('keydown'), { key: 'Shift', shiftKey: true });
    windowEvents.dispatchEvent(shifted);
    expect(transform.getMode()).toBe('translate'); expect(transform.translationSnap).toBe(1);
    tool.setBasePosition([5, 3, -7]); expect(transform.object!.position.toArray()).toEqual(tool.basePivot);
    const originalCenter = [...tool.basePivot];
    transform.dragging = true; transform.object!.position.x += 10; transform.dispatchEvent({ type: 'objectChange' });
    expect(tool.basePosition).toEqual([15, 3, -7]);
    expect(tool.basePivot).toEqual([originalCenter[0]! + 10, originalCenter[1], originalCenter[2]]);
    expect(tool.dragging).toBe(true); transform.dragging = false;
    tool.setMode('flatten');
    expect(transform.enabled).toBe(false); expect(transform.object).toBeUndefined(); expect(tool.dragging).toBe(false);
  } finally { controls.dispose(); vi.unstubAllGlobals(); }
});

it('edits solid text, preserves its contact and prevents exporting blank content', async () => {
  const { tool, content } = setup(), original = content.value.mesh.positions.slice();
  tool.setMode('add'); tool.addText();
  expect(tool.textAdded).toBe(true); expect(tool.textSelected).toBe(true); expect(tool.baseSelected).toBe(false);
  expect(tool.textMeshData!.indices.length).toBeGreaterThan(100); expect(tool.textSnapped).toBe(true);
  tool.setTextPosition([5, tool.textWorldHeight / 2, 10]);
  tool.setTextContent('TRIPO'); tool.setTextScale(1.5);
  expect(tool.textPosition[0]).toBe(5); expect(tool.textPosition[2]).toBe(10);
  expect(tool.textPosition[1] - tool.textWorldHeight / 2).toBeCloseTo(-0.08);
  tool.addBase(); tool.exportSTL(); expect(tool.unsaved).toBe(false);
  const data = new DataView(await (mocks.download.mock.calls.at(-1)![0] as Blob).arrayBuffer());
  expect(data.getUint32(80, true)).toBe((tool.source!.indices.length + tool.baseMesh!.indices.length + tool.textMeshData!.indices.length) / 3);
  tool.setTextContent(''); expect(tool.textReady).toBe(false); expect(tool.textError).toBeTruthy();
  tool.addBase(); expect(tool.canExport).toBe(false);
  tool.setTextContent('2026'); tool.addBase(); expect(tool.canExport).toBe(true); expect(tool.unsaved).toBe(true);
  tool.removeText(); expect(tool.textMeshData).toBeNull(); expect(tool.textSelected).toBe(false);
  expect(content.value.mesh.positions).toEqual(original);
});

it('snaps only over the base, releases when pulled away and follows base translation, rotation and scaling', () => {
  const { tool } = setup(); tool.setMode('add'); tool.addText();
  tool.setTextPosition([500, tool.textWorldHeight / 2, 0]); expect(tool.textSnapped).toBe(false);
  tool.setTextPosition([0, 40, 10]); expect(tool.textSnapped).toBe(false);
  tool.setTextPosition([0, 40, 10], true); expect(tool.textSnapped).toBe(true);
  tool.setBasePosition([12, 4, -8]);
  expect(tool.textPosition[0]).toBe(12); expect(tool.textPosition[2]).toBe(2);
  expect(tool.textPosition[1] - tool.textWorldHeight / 2).toBeCloseTo(3.92);
  tool.setBaseScale(2); expect(tool.textPosition[2]).toBeCloseTo(12);
  tool.setBaseRotationY(90); expect(tool.textPosition[0]).toBeCloseTo(32); expect(tool.textPosition[2]).toBeCloseTo(-8);
  const forward = new Vector3(0, 0, 1).transformDirection(tool.textTransform); expect(forward.x).toBeCloseTo(1);
  tool.setTextPosition([500, 80, 0]); const free = [...tool.textPosition];
  tool.setBaseScale(1); tool.setBasePosition([0, 0, 0]); expect(tool.textPosition).toEqual(free);
});

it('routes the translation gizmo to text and resets text on model replacement', async () => {
  const { tool, content } = setup(), scene = new Scene(), camera = new PerspectiveCamera();
  const canvas = Object.assign(new EventTarget(), { style: { touchAction: 'auto', cursor: '' }, hasPointerCapture: () => false }) as unknown as HTMLCanvasElement;
  vi.stubGlobal('window', new EventTarget());
  const controls = createBaseTranslationControls(camera, scene, canvas, new Object3D(), tool, () => {}, new Object3D());
  const transform = (scene.children.find(child => 'controls' in child) as ReturnType<TransformControls['getHelper']>).controls;
  try {
    tool.setMode('add'); tool.addText(); const originalBase = [...tool.basePosition];
    expect(transform.object!.position.toArray()).toEqual(tool.textPosition);
    transform.dragging = true; transform.object!.position.x += 5; transform.dispatchEvent({ type: 'objectChange' }); transform.dragging = false;
    expect(tool.textPosition[0]).toBeCloseTo(5); expect(tool.basePosition).toEqual(originalBase);
    tool.setMode('flatten'); expect(transform.enabled).toBe(false); expect(tool.textAdded).toBe(true);
    tool.setMode('add'); tool.selectText(); expect(tool.baseSelected).toBe(false);
    content.value = { ...content.value, id: 'new' }; await nextTick();
    expect(tool.textAdded).toBe(false); expect(tool.textMeshData).toBeNull(); expect(tool.textContent).toBe('Text');
  } finally { controls.dispose(); vi.unstubAllGlobals(); }
});

it('imports a custom base, preserves its proportions and colors, and exports without replacing the workspace model', async () => {
  const asset = prepareBaseAsset(new Mesh(new BoxGeometry(20, 4, 10), new MeshStandardMaterial({ color: '#ffdb57' })));
  mocks.custom.mockResolvedValue(asset);
  const { tool, content, scope } = setup(), source = content.value;
  tool.setMode('add'); tool.setBaseScale(1.5); tool.setBaseRotationY(30);
  const pending = tool.importCustomBase([new File(['fixture'], 'pedestal.glb')]);
  expect(tool.customBaseLoading).toBe(true); expect(tool.baseReady).toBe(false);
  await pending;
  expect(content.value).toBe(source); expect(tool.baseShape).toBe('custom'); expect(tool.baseIsAsset).toBe(true);
  expect(tool.customBaseName).toBe('pedestal.glb'); expect(tool.baseDepth / tool.baseWidth).toBeCloseTo(0.5);
  expect(tool.baseHeight / tool.baseWidth).toBeCloseTo(0.2); expect(tool.baseScale).toBe(1.5); expect(tool.baseRotationY).toBe(30);
  tool.setBaseColor('#829efa'); expect(tool.baseAssetOriginal).toBe(false); tool.restoreBaseAppearance(); expect(tool.baseAssetOriginal).toBe(true);
  await tool.setBaseShape('round'); await tool.setBaseShape('custom'); expect(tool.baseAsset).toBe(asset);
  tool.addBase(); tool.exportSTL(); expect(mocks.download).toHaveBeenCalledOnce(); expect(tool.unsaved).toBe(false);
  const disposed = vi.spyOn(asset, 'dispose'); scope.stop(); expect(disposed).toHaveBeenCalledOnce();
});

it('keeps the current base on upload failure and disposes an upload superseded by another selection or scope disposal', async () => {
  const { tool, scope } = setup(); tool.setMode('add');
  mocks.custom.mockRejectedValueOnce(new Error('Invalid base')); await tool.importCustomBase([new File([''], 'bad.stl')]);
  expect(tool.customBaseError).toBe('Invalid base'); expect(tool.baseShape).toBe('round'); expect(tool.baseReady).toBe(true);
  for (const disposeScope of [false, true]) {
    const asset = prepareBaseAsset(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    const disposed = vi.spyOn(asset, 'dispose'); let resolve!: (value: typeof asset) => void;
    mocks.custom.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const pending = tool.importCustomBase([new File(['fixture'], 'base.glb')]);
    if (disposeScope) scope.stop(); else await tool.setBaseShape('square');
    resolve(asset); await pending; expect(disposed).toHaveBeenCalledOnce(); expect(tool.customBase).toBeNull();
  }
});

it('places an imported base below the model, preserves aspect and exports its resized, translated geometry', async () => {
  const asset = prepareBaseAsset(new Mesh(new BoxGeometry(10, 2, 8), new MeshStandardMaterial()));
  mocks.asset.mockResolvedValue(asset);
  const { tool } = setup(); tool.setMode('add');
  await tool.setBaseShape('white-cloud');
  expect(tool.baseDepth / tool.baseWidth).toBeCloseTo(0.80743408203125 / 0.979583740234375);
  expect(tool.baseHeight / tool.baseWidth).toBeCloseTo(0.1459808051586151 / 0.979583740234375);
  tool.setBaseDimension('width', 40); tool.setBaseDimension('depth', 32); tool.setBaseDimension('height', 10);
  expect(Math.min(...tool.baseMesh!.positions.filter((_, i) => i % 3 === 1))).toBe(-10);
  expect(Math.max(...tool.baseMesh!.positions.filter((_, i) => i % 3 === 1))).toBe(0);
  tool.setDimension('height', 152); tool.setBasePosition([12, 4, -8]);
  expect(tool.basePivot).toEqual([12, -6, -8]);
  tool.addBase(); tool.exportSTL();
  const data = new DataView(await (mocks.download.mock.calls.at(-1)![0] as Blob).arrayBuffer());
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let f = tool.source!.indices.length / 3; f < data.getUint32(80, true); f++) for (let c = 0; c < 3; c++) for (let a = 0; a < 3; a++) {
    const v = data.getFloat32(84 + f * 50 + 12 + c * 12 + a * 4, true); min[a] = Math.min(min[a]!, v); max[a] = Math.max(max[a]!, v);
  }
  expect(max.map((v, i) => v - min[i]!)).toEqual([64, 80, 20]);
  expect(min[2]).toBe(0); expect(tool.unsaved).toBe(false); asset.dispose();
});

it('recolors even to the current white value and restores original material selection without changing geometry', async () => {
  const asset = prepareBaseAsset(new Mesh(new BoxGeometry(10, 2, 8), new MeshStandardMaterial()));
  mocks.asset.mockResolvedValue(asset);
  const { tool, content } = setup(); tool.setMode('add'); await tool.setBaseShape('black-disc');
  const mesh = tool.baseMesh;
  expect(tool.baseAssetOriginal).toBe(true); tool.addBase();
  tool.setBaseColor('#ffffff'); expect(tool.baseAssetOriginal).toBe(false); expect(tool.baseAdded).toBe(false);
  tool.setBaseColor('#829efa'); expect(tool.baseColor).toBe('#829efa');
  tool.restoreBaseAppearance(); expect(tool.baseAssetOriginal).toBe(true); expect(tool.baseMesh).toBe(mesh);
  tool.reset(); expect(tool.baseAsset).toBe(asset); expect(tool.baseReady).toBe(true);
  content.value = { ...content.value, id: 'replacement' }; await nextTick();
  expect(tool.baseShape).toBe('black-disc'); expect(tool.baseAsset).toBe(asset); expect(tool.baseReady).toBe(true);
  await tool.setBaseShape('square'); expect(tool.baseAssetOriginal).toBe(false); expect(tool.baseReady).toBe(true); asset.dispose();
});

it('prevents adding an unavailable asset, ignores stale loads and supports retry', async () => {
  const asset = prepareBaseAsset(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
  let resolve!: (value: typeof asset) => void;
  mocks.asset.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const { tool } = setup(); tool.setMode('add'); const pending = tool.setBaseShape('black-disc');
  expect(tool.baseAssetLoading).toBe(true); expect(tool.baseReady).toBe(false); tool.addBase(); expect(tool.baseAdded).toBe(false);
  await tool.setBaseShape('round'); resolve(asset); await pending;
  expect(tool.baseAsset).toBeNull(); expect(tool.baseAssetLoading).toBe(false); expect(tool.baseReady).toBe(true);
  mocks.asset.mockRejectedValueOnce(new Error('offline'));
  await tool.setBaseShape('white-cloud'); expect(tool.baseAssetError).toBe('offline'); expect(tool.baseReady).toBe(false);
  mocks.asset.mockResolvedValueOnce(asset); await tool.retryBaseAsset();
  expect(tool.baseAssetError).toBe(''); expect(tool.baseReady).toBe(true); asset.dispose();
});

it('does not install an imported base after disposal', async () => {
  const asset = prepareBaseAsset(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
  let resolve!: (value: typeof asset) => void;
  mocks.asset.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const { tool, scope } = setup(), pending = tool.setBaseShape('black-disc'); scope.stop(); resolve(asset); await pending;
  expect(tool.baseAsset).toBeNull(); expect(mocks.disposeAssets).toHaveBeenCalledOnce(); asset.dispose();
});
it('processes a copy and never changes original mesh or size', async () => {
  const { tool, content } = setup(), original = content.value.mesh.positions.slice();
  expect(tool.source!.positions).not.toBe(content.value.mesh.positions);
  expect(tool.source!.indices).not.toBe(content.value.mesh.indices);
  expect(tool.span).toBe(80);
  await tool.apply(); expect(tool.result!.stats.boundary).toBe(0); expect(tool.unsaved).toBe(true);
  tool.exportSTL(); expect(mocks.download).toHaveBeenCalledOnce(); expect(tool.unsaved).toBe(false);
  tool.setDepthMM(20); expect(tool.result).toBeNull(); expect(tool.canExport).toBe(false);
  expect(content.value.mesh.positions).toEqual(original);
});

it('moves and colors an additive base without changing the source model', () => {
  const { tool, content } = setup(), original = content.value.mesh.positions.slice();
  tool.setMode('add');
  expect(tool.baseSelected).toBe(true);
  expect(tool.baseColor).toBe('#ffffff');
  expect(tool.basePosition).toEqual([0, 0, 0]);
  tool.setBasePosition([12, 4, -7]);
  tool.setBaseColor('#e94bb6');
  expect(tool.basePosition).toEqual([12, 4, -7]);
  expect(tool.basePivot).toEqual([12, 4 - tool.baseHeight / 2, -7]);
  expect(tool.baseColor).toBe('#e94bb6');
  expect(tool.baseAdded).toBe(false);
  tool.addBase();
  expect(tool.baseAdded).toBe(true);
  expect(tool.view).toBe('result');
  expect(tool.unsaved).toBe(true);
  expect(content.value.mesh.positions).toEqual(original);
});

it('keeps additive base placement in the exported STL', async () => {
  const { tool } = setup();
  tool.setMode('add'); tool.setBasePosition([12, 4, -7]); tool.addBase(); tool.exportSTL();
  expect(mocks.download).toHaveBeenCalledOnce();
  const data = new DataView(await (mocks.download.mock.calls[0]![0] as Blob).arrayBuffer());
  expect(data.getUint32(80, true)).toBeGreaterThan(12);
  expect(tool.unsaved).toBe(false);
});

it.each(['square', 'white-cloud'] as const)('scales and rotates %s without rebuilding geometry or moving the source', async shape => {
  const asset = prepareBaseAsset(new Mesh(new BoxGeometry(10, 2, 8), new MeshStandardMaterial()));
  mocks.asset.mockResolvedValue(asset);
  const { tool, content } = setup(), original = content.value.mesh.positions.slice();
  tool.setMode('add'); await tool.setBaseShape(shape);
  const mesh = tool.baseMesh!, vertices = mesh.positions.slice(), source = tool.source!.positions.slice();
  const dimensions = [tool.baseWidth, tool.baseHeight, tool.baseDepth], cutRotation = [...tool.rotation];
  tool.setBasePosition([12, 4, -7]); tool.setBaseScale(1.75); tool.setBaseRotationY(37);
  expect(tool.baseMesh).toBe(mesh); expect(mesh.positions).toEqual(vertices);
  expect([tool.baseWidth, tool.baseHeight, tool.baseDepth]).toEqual(dimensions);
  expect(tool.basePosition).toEqual([12, 4, -7]);
  expect(tool.scale).toBe(1); expect(tool.rotation).toEqual(cutRotation);
  const origin = new Vector3().applyMatrix4(tool.baseTransform);
  expect(origin.toArray()).toEqual([12, 4, -7]);
  const up = new Vector3(0, 1, 0).applyMatrix4(tool.baseTransform).sub(origin);
  expect(up.toArray()).toEqual([0, 1.75, 0]);
  const axis = new Vector3(1, 0, 0).applyMatrix4(tool.baseTransform).sub(origin);
  expect(axis.x).toBeCloseTo(1.75 * Math.cos(37 * Math.PI / 180));
  expect(axis.z).toBeCloseTo(-1.75 * Math.sin(37 * Math.PI / 180));
  expect(tool.baseBottom).toBeCloseTo(4 - tool.baseHeight * 1.75);
  expect(tool.basePivot[1]).toBeCloseTo(4 - tool.baseHeight * 1.75 / 2);
  tool.setBaseWorldCenter([20, 10, -5]);
  expect(tool.basePivot).toEqual([20, expect.closeTo(10, 8), -5]);
  tool.setDimension('width', tool.dimensions.width * 2);
  expect(tool.basePivot).toEqual([40, expect.closeTo(20, 8), -10]);
  expect(tool.baseBottom).toBeCloseTo(20 - tool.baseHeight * 1.75);
  expect(tool.source!.positions).toEqual(source); expect(content.value.mesh.positions).toEqual(original);
  asset.dispose();
});

it.each(['square', 'white-cloud'] as const)('exports %s with uniform scale, Y rotation and world translation', async shape => {
  const asset = prepareBaseAsset(new Mesh(new BoxGeometry(10, 2, 8), new MeshStandardMaterial()));
  mocks.asset.mockResolvedValue(asset);
  const { tool } = setup(); tool.setMode('add'); await tool.setBaseShape(shape);
  tool.setBaseDimension('width', 40); tool.setBaseDimension('depth', 24); tool.setBaseDimension('height', 10);
  tool.setBaseScale(1.5); tool.setBaseRotationY(90); tool.setDimension('width', 160); tool.setBasePosition([12, 4, -8]);
  tool.addBase(); tool.exportSTL();
  const data = new DataView(await (mocks.download.mock.calls.at(-1)![0] as Blob).arrayBuffer());
  const bounds = (start: number, end: number) => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let f = start; f < end; f++) for (let c = 0; c < 3; c++) for (let a = 0; a < 3; a++) {
      const value = data.getFloat32(84 + f * 50 + 12 + c * 12 + a * 4, true);
      min[a] = Math.min(min[a]!, value); max[a] = Math.max(max[a]!, value);
    }
    return { size: max.map((v, i) => v - min[i]!), center: max.map((v, i) => (v + min[i]!) / 2), min, max };
  };
  const sourceFaces = tool.source!.indices.length / 3;
  const model = bounds(0, sourceFaces), base = bounds(sourceFaces, data.getUint32(80, true));
  // STL aligns world Y upward to print Z, with world Z/X mapped to print X/Y.
  expect(model.size).toEqual([160, 160, 160]); expect(base.size).toEqual([120, 72, 30]);
  expect(base.center[0]! - model.center[0]!).toBeCloseTo(-8);
  expect(base.center[1]! - model.center[1]!).toBeCloseTo(12);
  expect(base.min[2]).toBe(0); expect(base.max[2]! - model.min[2]!).toBeCloseTo(4);
  expect(tool.unsaved).toBe(false);
  tool.setBaseRotationY(30); expect(tool.canExport).toBe(false); tool.addBase(); expect(tool.unsaved).toBe(true);
  tool.exportSTL(); expect(tool.unsaved).toBe(false);
  tool.setBaseScale(2); expect(tool.canExport).toBe(false); tool.addBase(); expect(tool.unsaved).toBe(true);
  asset.dispose();
});

it('keeps scale and rotation through style changes and resets them for a replacement model', async () => {
  const asset = prepareBaseAsset(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
  mocks.asset.mockResolvedValue(asset);
  const { tool, content } = setup(); tool.setMode('add');
  tool.setBaseScale(2); tool.setBaseRotationY(-45); tool.setBasePosition([1, 2, 3]);
  const width = tool.baseWidth;
  for (let i = 0; i < 3; i++) { await tool.setBaseShape('black-disc'); await tool.setBaseShape('white-cloud'); }
  expect(Math.max(tool.baseWidth, tool.baseDepth)).toBeCloseTo(width);
  expect(tool.baseScale).toBe(2); expect(tool.baseRotationY).toBe(-45); expect(tool.basePosition).toEqual([1, 2, 3]);
  tool.addBase();
  for (const value of [NaN, Infinity, 0, -1, 0.24, 3.01]) tool.setBaseScale(value);
  for (const value of [NaN, Infinity, -181, 181]) tool.setBaseRotationY(value);
  expect(tool.baseScale).toBe(2); expect(tool.baseRotationY).toBe(-45); expect(tool.baseAdded).toBe(true);
  tool.reset(); expect(tool.baseScale).toBe(1); expect(tool.baseRotationY).toBe(0);
  tool.setBaseScale(0.25); tool.setBaseRotationY(180);
  content.value = { ...content.value, id: 'replacement' }; await nextTick();
  expect(tool.baseScale).toBe(1); expect(tool.baseRotationY).toBe(0); expect(tool.basePosition).toEqual([0, 0, 0]);
  asset.dispose();
});

it('preserves texture assignments and converts baked colors once without changing the workspace', async () => {
  const { tool, content } = setup(), original = content.value;
  const uvs = new Float32Array(original.mesh.positions.length / 3 * 2).fill(0.25);
  const colors = new Float32Array(original.mesh.positions.length).fill(128);
  const faceMat = new Uint32Array(original.mesh.indices.length / 3);
  faceMat[0] = 1;
  const materials = [{ image: 0, factor: [0.5, 0.5, 0.5] as [number, number, number] }, { image: -1, factor: [1, 1, 1] as [number, number, number] }];
  const texture = new Blob(['texture']);
  content.value = { ...original, id: 'textured', mesh: { ...original.mesh, uvs, colors, faceMat, materials, images: [texture] } };
  await nextTick();
  const appearance = tool.source!.appearance!;
  expect(appearance.uvs).toEqual(uvs); expect(appearance.uvs).not.toBe(uvs);
  expect(appearance.faceMat).toEqual(faceMat); expect(appearance.faceMat).not.toBe(faceMat);
  expect(appearance.materials).toEqual(materials); expect(appearance.materials[0]!.factor).not.toBe(materials[0]!.factor);
  expect(appearance.images[0]).toBe(texture);
  expect(appearance.colors![0]).toBeCloseTo(new Color().setRGB(128 / 255, 128 / 255, 128 / 255).convertSRGBToLinear().r);
  await tool.apply();
  expect(tool.failure).toBe(''); expect(tool.source!.appearance).toBe(appearance);
  expect(colors[0]).toBe(128); expect(uvs[0]).toBe(0.25); expect(materials[0]!.factor[0]).toBe(0.5);
});
it('keeps a result across module switches and refreshes size changed elsewhere', async () => {
  const { tool, active, height } = setup(); await tool.apply(); const result = tool.result;
  active.value = false; await nextTick(); active.value = true; await nextTick();
  expect(tool.result).toBe(result);
  active.value = false; await nextTick(); height.value = 120; await nextTick(); active.value = true; await nextTick();
  expect(tool.span).toBe(120); expect(tool.result).toBeNull();
});
it('ignores asynchronous results after reset or module exit', async () => {
  const { tool, active } = setup(); const pending: Array<(v: ReturnType<typeof cutMesh>) => void> = [];
  mocks.run.mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  const expected = cutMesh(tool.source!, tool.plane);
  const first = tool.apply(); tool.reset(); pending.shift()!(expected); await first;
  expect(tool.result).toBeNull(); expect(tool.busy).toBe(false);
  const second = tool.apply(); active.value = false; await nextTick(); pending.shift()!(expected); await second;
  expect(tool.result).toBeNull(); expect(tool.busy).toBe(false);
});

it('shows retained dimensions in millimetres and scales all axes and cut depth together', () => {
  const { tool, content, height } = setup(), original = content.value.mesh.positions.slice();
  expect(tool.depthMM).toBe(4); expect(tool.dimensions).toEqual({ width: 80, depth: 80, height: 76 });
  tool.setDepthMM(20); expect(tool.dimensions.height).toBe(60);
  tool.setDimension('height', 120);
  expect(tool.dimensions).toEqual({ width: 160, depth: 160, height: 120 });
  expect(tool.depthMM).toBe(40); expect(tool.span).toBe(160);
  expect(height.value).toBe(80); expect(content.value.mesh.positions).toEqual(original);
  tool.flip = true; expect(tool.dimensions.height).toBe(40);
  tool.setDirection('z'); expect(tool.dimensions).toEqual({ width: 160, depth: 40, height: 160 });
  expect(tool.flip).toBe(true);
  expect(tool.plane.cap).toBe(true);
});

it('exports uniformly scaled geometry without requiring another cut', async () => {
  const { tool } = setup(); await tool.apply(); const result = tool.result;
  tool.exportSTL(); expect(tool.unsaved).toBe(false);
  tool.setDimension('height', 152);
  expect(tool.result).toBe(result); expect(tool.canExport).toBe(true); expect(tool.unsaved).toBe(true);
  tool.exportSTL(); const data = new DataView(await (mocks.download.mock.calls.at(-1)![0] as Blob).arrayBuffer());
  let min = Infinity, max = -Infinity;
  for (let f = 0; f < data.getUint32(80, true); f++) for (let c = 0; c < 3; c++) {
    const z = data.getFloat32(84 + f * 50 + 12 + c * 12 + 8, true); min = Math.min(min, z); max = Math.max(max, z);
  }
  expect(min).toBe(0); expect(max).toBe(152); expect(tool.unsaved).toBe(false);
});

it('handles empty cuts and invalid dimension edits without corrupting scale', () => {
  const { tool } = setup();
  for (const size of [NaN, 0, -1, Infinity, 1e20]) tool.setDimension('height', size);
  expect(tool.scale).toBe(1);
  tool.setDepthMM(80); expect(tool.empty).toBe(true); expect(tool.dimensions).toEqual({ width: 0, depth: 0, height: 0 });
  tool.setDimension('height', 100); expect(tool.scale).toBe(1);
  tool.flip = true; expect(tool.empty).toBe(false); expect(tool.dimensions.height).toBe(80);
});

it('invalidates an old result when the shared header loads a new model', async () => {
  const { tool, content } = setup(); await tool.apply();
  tool.setDimension('height', 152);
  content.value = { ...content.value, id: 'two' }; await nextTick();
  expect(tool.result).toBeNull(); expect(tool.scale).toBe(1); expect(tool.source!.id).toBe('two');
});


it.each(['x', 'y', 'z'] as const)('keeps the %s plane centered and moves it along its normal with depth', axis => {
  const { tool } = setup(), center = new Vector3(0, 40, 0);
  tool.setDirection(axis);
  const normal = new Vector3(...tool.normal), planeCenter = new Vector3(...tool.planeCenter);
  expect(tool.pivot).toEqual(center.toArray());
  expect(planeCenter.clone().sub(center).cross(normal).length()).toBeLessThan(1e-8);
  expect(normal.dot(planeCenter)).toBeCloseTo(tool.plane.offset);
  expect(new Vector3(0, 1, 0).applyQuaternion(new Quaternion(...tool.rotation)).distanceTo(normal)).toBeLessThan(1e-8);
  const oldDepth = tool.depthMM;
  tool.setDepthMM(oldDepth + 10);
  expect(new Vector3(...tool.planeCenter).sub(planeCenter).distanceTo(normal.multiplyScalar(10))).toBeLessThan(1e-8);
  expect(tool.pivot).toEqual(center.toArray());
});

it('defaults to Y and switches XYZ without changing cut proportion or retained side', async () => {
  const { tool, content } = setup();
  expect(tool.direction).toBe('y'); expect(tool.normal).toEqual([0, 1, 0]);
  // Different axis spans ensure direction changes retain the proportion, not the old millimetres.
  const positions = content.value.mesh.positions.map((v, i) => v * (i % 3 === 0 ? 2 : i % 3 === 2 ? 0.5 : 1));
  content.value = { ...content.value, id: 'rectangular', mesh: { ...content.value.mesh, positions } }; await nextTick();
  tool.setDepthMM(24); tool.flip = true;
  for (const [axis, normal, span] of [['x', [1,0,0], 160], ['y', [0,1,0], 80], ['z', [0,0,1], 40]] as const) {
    tool.setDirection(axis); expect(tool.direction).toBe(axis); expect(tool.normal).toEqual(normal);
    expect(tool.flip).toBe(true); expect(tool.span).toBe(span);
    expect(tool.depthMM / tool.span).toBeCloseTo(0.3);
  }
});

it('invalidates a cut only when a different standard direction is selected', async () => {
  const { tool } = setup(); await tool.apply(); const result = tool.result;
  tool.setDirection('y'); expect(tool.result).toBe(result); expect(tool.view).toBe('result');
  tool.setDirection('x'); expect(tool.result).toBeNull(); expect(tool.view).toBe('preview'); expect(tool.canExport).toBe(false);
  await tool.apply(); expect(tool.failure).toBe(''); expect(tool.result!.stats.boundary).toBe(0);
});

it.each(['x', 'y', 'z'] as const)('caps and exports a %s cut consistently after flipping and scaling', async axis => {
  const { tool, content } = setup(); const original = content.value.mesh.positions.slice();
  tool.setDirection(axis);
  const plane = { ...tool.plane }, pivot = [...tool.pivot], planeCenter = [...tool.planeCenter], depth = tool.depthMM, size = { ...tool.dimensions };
  tool.flip = true;
  expect(tool.plane.offset).toBeCloseTo(-plane.offset); expect(tool.plane.normal).toEqual(plane.normal.map(v => -v));
  expect(tool.pivot).toEqual(pivot); expect(tool.planeCenter).toEqual(planeCenter); expect(tool.depthMM).toBeCloseTo(depth);
  tool.flip = false; tool.setDimension('width', size.width * 2);
  expect(tool.pivot).toEqual(pivot.map(v => v * 2)); expect(tool.planeCenter).toEqual(planeCenter.map(v => v * 2)); expect(tool.depthMM).toBeCloseTo(depth * 2);
  expect(tool.dimensions.height).toBeCloseTo(size.height * 2);
  await tool.apply(); expect(tool.failure).toBe(''); expect(tool.result!.stats.boundary).toBe(0); expect(tool.result!.stats.capFaces).toBeGreaterThan(0);
  tool.exportSTL(); const data = new DataView(await (mocks.download.mock.calls.at(-1)![0] as Blob).arrayBuffer());
  let minZ = Infinity;
  for (let f = 0; f < data.getUint32(80, true); f++) for (let c = 0; c < 3; c++) minZ = Math.min(minZ, data.getFloat32(84 + f * 50 + 12 + c * 12 + 8, true));
  expect(minZ).toBeCloseTo(0, 5); expect(content.value.mesh.positions).toEqual(original);
});

it('preserves the selected direction through module switches and resets to Y for a replacement model', async () => {
  const { tool, active, content } = setup(); tool.setDirection('z'); await tool.apply(); const result = tool.result;
  active.value = false; await nextTick(); active.value = true; await nextTick();
  expect(tool.direction).toBe('z'); expect(tool.result).toBe(result);
  tool.setMode('add'); tool.setMode('flatten'); expect(tool.direction).toBe('z');
  content.value = { ...content.value, id: 'replacement' }; await nextTick();
  expect(tool.direction).toBe('y'); expect(tool.depthMM).toBe(4); expect(tool.pivot).toEqual([0,40,0]);
});

function combinedGizmo() {
  const state = setup(), { tool } = state;
  tool.setMode('add'); tool.addText(); tool.selectBase();
  const scene = new Scene(), camera = new PerspectiveCamera(35, 800 / 600, 0.1, 10000);
  camera.position.set(140, 100, 220); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const base = new Group(), text = new Group(), captured = new Set<number>();
  const geometry = (data: { positions: Float32Array; indices: Uint32Array }) => new BufferGeometry().setAttribute('position', new BufferAttribute(data.positions, 3)).setIndex(new BufferAttribute(data.indices, 1));
  base.add(new Mesh(geometry(tool.baseMesh!), new MeshStandardMaterial()));
  text.add(new Mesh(geometry(tool.textMeshData!), new MeshStandardMaterial())); scene.add(base, text);
  const canvas = Object.assign(new EventTarget(), {
    style: { touchAction: 'auto', cursor: '' },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    hasPointerCapture: (id: number) => captured.has(id), setPointerCapture: (id: number) => captured.add(id), releasePointerCapture: (id: number) => captured.delete(id),
  }) as unknown as HTMLCanvasElement;
  const windowEvents = new EventTarget(); vi.stubGlobal('window', windowEvents);
  const onDragging = vi.fn(), feedback = vi.fn();
  const controls = createBaseTranslationControls(camera, scene, canvas, base, tool, onDragging, text, feedback);
  const handles = scene.getObjectByName('base-scale-handles')!, ring = scene.getObjectByName('base-y-rotation-ring')!;
  const transform = (scene.children.find(child => 'controls' in child) as ReturnType<TransformControls['getHelper']>).controls;
  const update = () => { tool.baseTransform.decompose(base.position, base.quaternion, base.scale); tool.textTransform.decompose(text.position, text.quaternion, text.scale); controls.update(); };
  const project = (position: Vector3) => { const p = position.clone().project(camera); return { x: (p.x + 1) * 400, y: (1 - p.y) * 300 }; };
  const handle = (index: number) => project(handles.getObjectByName(`scale-corner-${index}`)!.position);
  const ringPoint = (degrees: number) => project(new Vector3(Math.cos(degrees * Math.PI / 180), 0, -Math.sin(degrees * Math.PI / 180)).applyMatrix4(ring.matrixWorld));
  const send = (type: string, x: number, y: number, props: Partial<PointerEvent> = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0, buttons: type === 'pointermove' && captured.size ? 1 : 0, shiftKey: false }, props);
    canvas.dispatchEvent(event); update(); return event;
  };
  update();
  const dispose = () => { controls.dispose(); for (const object of [base.children[0], text.children[0]] as Mesh[]) { object.geometry.dispose(); (object.material as MeshStandardMaterial).dispose(); } vi.unstubAllGlobals(); };
  return { ...state, camera, canvas, windowEvents, captured, transform, controls, onDragging, feedback, handles, ring, ringPoint, update, project, handle, send, dispose };
}

it.each([0, 1, 2, 3])('uniformly scales a base with corner %i while keeping its top and snapped text contact', index => {
  const v = combinedGizmo();
  try {
    const { tool } = v, start = v.handle(index), pivot = v.project(new Vector3(...tool.basePosition));
    const originalTop = [...tool.basePosition], originalTextScale = tool.textScale;
    expect(v.send('pointerdown', start.x, start.y).defaultPrevented).toBe(true);
    expect(tool.dragging).toBe(true); expect(v.captured.has(1)).toBe(true); expect(v.transform.enabled).toBe(false);
    v.send('pointermove', start.x + (start.x - pivot.x) * 0.5, start.y + (start.y - pivot.y) * 0.5);
    expect(tool.baseScale).toBeCloseTo(1.5); expect(tool.basePosition).toEqual(originalTop);
    expect(tool.textScale).toBe(originalTextScale); expect(tool.textSnapped).toBe(true);
    expect(tool.textPosition[1] - tool.textWorldHeight / 2).toBeCloseTo(-0.08);
    expect(v.feedback.mock.lastCall![0].value).toBeCloseTo(1.5);
    v.send('pointerup', start.x, start.y);
    expect(tool.dragging).toBe(false); expect(v.transform.enabled).toBe(true); expect(v.captured.size).toBe(0);
    // Moving immediately afterwards uses the same gizmo, with no mode switch.
    v.transform.dragging = true; v.transform.object!.position.x += 5; v.transform.dispatchEvent({ type: 'objectChange' }); v.transform.dragging = false;
    expect(tool.basePosition[0]).toBe(5); expect(tool.baseScale).toBeCloseTo(1.5);
  } finally { v.dispose(); }
});

it.each([true, false])('scales text from its bottom contact with snapped=%s and clamps without flipping', snapped => {
  const v = combinedGizmo();
  try {
    const { tool } = v;
    if (!snapped) tool.setTextPosition([200, 40, 0]);
    tool.selectText(); v.update();
    const start = v.handle(2), bottom = tool.textPosition[1] - tool.textWorldHeight / 2;
    const pivot = v.project(new Vector3(tool.textPosition[0], bottom, tool.textPosition[2]));
    v.send('pointerdown', start.x, start.y);
    v.send('pointermove', start.x + (start.x - pivot.x) * 0.5, start.y + (start.y - pivot.y) * 0.5);
    expect(tool.textScale).toBeCloseTo(1.5); expect(tool.baseScale).toBe(1); expect(tool.textSnapped).toBe(snapped);
    expect(tool.textPosition[1] - tool.textWorldHeight / 2).toBeCloseTo(bottom);
    v.send('pointermove', start.x - (start.x - pivot.x) * 4, start.y - (start.y - pivot.y) * 4);
    expect(tool.textScale).toBe(0.05); expect(tool.textPosition[1] - tool.textWorldHeight / 2).toBeCloseTo(bottom);
    v.send('pointermove', start.x + (start.x - pivot.x) * 10, start.y + (start.y - pivot.y) * 10);
    expect(tool.textScale).toBe(3);
    v.send('pointerup', start.x, start.y); expect(v.feedback.mock.lastCall![0]).toBeNull();
  } finally { v.dispose(); }
});

it('keeps handles aligned after orbit/zoom and releases drag ownership on cancellation or module changes', () => {
  const v = combinedGizmo();
  try {
    const before = v.handle(2);
    v.camera.position.set(-100, 180, 120); v.camera.lookAt(0, 0, 0); v.update();
    expect(v.handle(2)).not.toEqual(before);
    const mesh = v.handles.getObjectByName('scale-corner-2')!;
    const a = v.project(new Vector3(-0.5, 0, 0).applyMatrix4(mesh.matrixWorld));
    const b = v.project(new Vector3(0.5, 0, 0).applyMatrix4(mesh.matrixWorld));
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(9);
    for (const cancel of ['pointercancel', 'blur', 'Escape', 'module']) {
      v.tool.setMode('add'); v.tool.selectBase(); v.update();
      const start = v.handle(2); v.send('pointerdown', start.x, start.y);
      v.send('pointermove', start.x + 30, start.y - 30, { pointerId: 2 }); expect(v.tool.baseScale).toBe(1);
      if (cancel === 'pointercancel') v.send('pointercancel', start.x, start.y);
      if (cancel === 'blur') v.windowEvents.dispatchEvent(new Event('blur'));
      if (cancel === 'Escape') v.windowEvents.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape', shiftKey: false }));
      if (cancel === 'module') v.tool.setMode('flatten');
      v.update(); expect(v.tool.dragging).toBe(false); expect(v.captured.size).toBe(0); expect(v.onDragging.mock.lastCall![0]).toBe(false);
    }
    expect(v.handles.visible).toBe(false); expect(v.transform.object).toBeUndefined();
  } finally { v.dispose(); }
});

it('colors text independently and preserves its geometry and placement', () => {
  const { tool } = setup(); tool.setMode('add'); tool.addText();
  const mesh = tool.textMeshData, position = [...tool.textPosition], baseColor = tool.baseColor;
  tool.addBase(); tool.setTextColor('#829EFA');
  expect(tool.textColor).toBe('#829efa'); expect(tool.baseColor).toBe(baseColor);
  expect(tool.textMeshData).toBe(mesh); expect(tool.textPosition).toEqual(position); expect(tool.baseAdded).toBe(false);
  tool.setTextColor('invalid'); expect(tool.textColor).toBe('#829efa');
});

it('wraps text around the actual round base side and keeps its surface attachment when scaled or moved', async () => {
  const { tool } = setup(); tool.setMode('add'); tool.addText();
  const radius = tool.baseDepth / 2, y = -tool.baseHeight / 2;
  expect(tool.setTextSurfaceFromRay([0, y, radius + 30], [0, 0, -1])).toBe(true);
  expect(tool.textSnapped).toBe(true); expect(tool.textSurfaceAttached).toBe(true); expect(tool.textCurved).toBe(true);
  const z = tool.textMeshData!.positions.filter((_, i) => i % 3 === 2);
  expect(Math.max(...z) - Math.min(...z)).toBeGreaterThan(tool.textMetrics.depth + 0.1);
  const normal = new Vector3(0, 0, 1).applyQuaternion(tool.textOrientation);
  expect(normal.z).toBeGreaterThan(0.9);
  const originalContact = [...tool.textContact]; tool.setTextScale(0.7);
  expect(new Vector3(...tool.textContact).distanceTo(new Vector3(...originalContact))).toBeLessThan(0.001);
  const beforeMove = [...tool.textPosition]; tool.setBasePosition([12, 4, -8]);
  expect(new Vector3(...tool.textPosition).sub(new Vector3(...beforeMove)).distanceTo(new Vector3(12, 4, -8))).toBeLessThan(0.001);
  tool.setBaseRotationY(90); expect(new Vector3(0, 0, 1).applyQuaternion(tool.textOrientation).x).toBeGreaterThan(0.9);
  tool.addBase(); tool.exportSTL();
  const exported = new DataView(await (mocks.download.mock.calls.at(-1)![0] as Blob).arrayBuffer());
  expect(exported.getUint32(80, true)).toBe((tool.source!.indices.length + tool.baseMesh!.indices.length + tool.textMeshData!.indices.length) / 3);
  tool.setTextPosition([500, 80, 0]); expect(tool.textSnapped).toBe(false); expect(tool.textCurved).toBe(false);
});

it('magnetizes near a side without a direct pointer hit, and refuses labels crossing a base edge', () => {
  const { tool } = setup(); tool.setMode('add'); tool.addText(); tool.setTextScale(0.5);
  const radius = tool.baseDepth / 2, y = -tool.baseHeight / 2;
  tool.setTextPosition([0, y, radius + tool.textMetrics.depth * tool.textWorldScale / 2 + 1]);
  expect(tool.textSnapped).toBe(true); expect(tool.textSurfaceAttached).toBe(true);
  tool.setTextPosition([0, y, radius + 12]); expect(tool.textSnapped).toBe(false);
  tool.setTextContent('TOO WIDE TO FIT ON THIS BASE'); tool.setTextScale(3);
  expect(tool.setTextSurfaceFromRay([0, y, radius + 30], [0, 0, -1])).toBe(false);
  expect(tool.textSnapped).toBe(false); expect(tool.textSurfaceHint).toContain('Scale it down');
});


it('rotates the base with its Y ring, crosses ±180° continuously and carries surface-fitted text', () => {
  const v = combinedGizmo();
  try {
    const { tool } = v;
    expect(tool.setTextSurfaceFromRay([0, -tool.baseHeight / 2, tool.baseDepth / 2 + 30], [0, 0, -1])).toBe(true);
    const contact = new Vector3(...tool.textContact), position = [...tool.basePosition], scale = tool.baseScale;
    tool.setBaseRotationY(170); v.update();
    const start = v.ringPoint(45);
    expect(v.send('pointerdown', start.x, start.y).defaultPrevented).toBe(true);
    expect(tool.dragging).toBe(true); expect(v.transform.enabled).toBe(false);
    for (const [pointerAngle, expected] of [[65, -170], [135, -100], [225, -10], [315, 80], [405, 170], [385, 150]]) {
      const next = v.ringPoint(pointerAngle!); v.send('pointermove', next.x, next.y);
      expect(tool.baseRotationY).toBeCloseTo(expected!, 1);
    }
    expect(tool.basePosition).toEqual(position); expect(tool.baseScale).toBe(scale);
    expect(tool.textSurfaceAttached).toBe(true);
    const expectedContact = contact.applyAxisAngle(new Vector3(0, 1, 0), 150 * Math.PI / 180);
    expect(new Vector3(...tool.textContact).distanceTo(expectedContact)).toBeLessThan(0.001);
    expect(v.feedback.mock.lastCall![0]).toMatchObject({ kind: 'rotation', value: 150 });
    v.send('pointerup', start.x, start.y);
    expect(tool.dragging).toBe(false); expect(v.captured.size).toBe(0); expect(v.transform.enabled).toBe(true);
    expect(v.feedback.mock.lastCall![0]).toBeNull();
    const corner = v.handle(2); v.send('pointerdown', corner.x, corner.y); v.send('pointermove', corner.x + 20, corner.y - 20); v.send('pointerup', corner.x, corner.y);
    expect(tool.baseScale).toBeGreaterThan(scale); expect(tool.baseRotationY).toBeCloseTo(150);
  } finally { v.dispose(); }
});

it('keeps the Y ring centered and scaled with the base, and hides it for text or Flatten', () => {
  const v = combinedGizmo();
  try {
    const radius = v.ring.scale.x;
    v.tool.setBasePosition([40, 30, -25]); v.tool.setBaseScale(2); v.update();
    expect(v.ring.position.toArray()).toEqual(v.tool.basePivot); expect(v.ring.scale.x).toBeGreaterThan(radius * 1.5);
    const before = v.ringPoint(45);
    v.camera.position.set(-100, 180, 120); v.camera.lookAt(0, 0, 0); v.update();
    expect(v.ringPoint(45)).not.toEqual(before); expect(v.ring.position.toArray()).toEqual(v.tool.basePivot);
    v.tool.selectText(); v.update(); expect(v.ring.visible).toBe(false); expect(v.handles.visible).toBe(true);
    v.tool.selectBase(); v.update(); expect(v.ring.visible).toBe(true);
    v.tool.selectBase(false); v.update(); expect(v.ring.visible).toBe(false);
    v.tool.selectBase(); v.tool.setMode('flatten'); v.update(); expect(v.ring.visible).toBe(false);
  } finally { v.dispose(); }
});

it('uses stable tangential Y rotation in an edge-on view and isolates the active pointer', () => {
  const v = combinedGizmo();
  try {
    v.camera.position.set(0, v.tool.basePivot[1], 220); v.camera.lookAt(...v.tool.basePivot); v.update();
    const start = v.ringPoint(-70); v.send('pointerdown', start.x, start.y);
    expect(v.tool.dragging).toBe(true); expect(v.transform.enabled).toBe(false);
    v.send('pointermove', start.x + 70, start.y, { pointerId: 2 }); expect(v.tool.baseRotationY).toBe(0);
    v.send('pointerup', start.x + 70, start.y, { pointerId: 2 }); expect(v.tool.dragging).toBe(true);
    v.send('pointermove', start.x + 30, start.y); const angle = v.tool.baseRotationY;
    expect(Number.isFinite(angle)).toBe(true); expect(Math.abs(angle)).toBeGreaterThan(1); expect(Math.abs(angle)).toBeLessThan(90);
    v.send('pointermove', start.x + 60, start.y); expect(Math.abs(v.tool.baseRotationY)).toBeGreaterThan(Math.abs(angle));
    v.send('pointermove', start.x, start.y); expect(v.tool.baseRotationY).toBeCloseTo(0, 1);
    v.send('pointerup', start.x, start.y); expect(v.tool.dragging).toBe(false);
  } finally { v.dispose(); }
});

it.each(['pointercancel', 'lostpointercapture', 'blur', 'Escape', 'module', 'selection', 'replacement'])('releases Y rotation pointer and restores camera on %s', cancel => {
  const v = combinedGizmo();
  try {
    const start = v.ringPoint(45); v.send('pointerdown', start.x, start.y);
    expect(v.tool.dragging).toBe(true); expect(v.captured.has(1)).toBe(true);
    if (cancel === 'pointercancel' || cancel === 'lostpointercapture') v.send(cancel, start.x, start.y);
    if (cancel === 'blur') v.windowEvents.dispatchEvent(new Event('blur'));
    if (cancel === 'Escape') v.windowEvents.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape', shiftKey: false }));
    if (cancel === 'module') v.tool.setMode('flatten');
    if (cancel === 'selection') v.tool.selectText();
    if (cancel === 'replacement') v.tool.setBaseShape('square');
    v.update(); expect(v.tool.dragging).toBe(false); expect(v.captured.size).toBe(0); expect(v.onDragging.mock.lastCall![0]).toBe(false);
    expect(v.feedback.mock.lastCall![0]).toBeNull();
    v.send('pointermove', start.x + 80, start.y + 40); expect(v.tool.baseRotationY).toBe(0);
  } finally { v.dispose(); }
});


it('changes font geometry while preserving text attachment, scale, content and color', () => {
  const { tool, content } = setup(); tool.setMode('add'); tool.addText(); tool.setTextContent('O'); tool.setTextScale(0.5); tool.setTextColor('#23748d');
  const y = -tool.baseHeight / 2;
  expect(tool.setTextSurfaceFromRay([0, y, tool.baseDepth / 2 + 30], [0, 0, -1])).toBe(true);
  const contact = new Vector3(...tool.textContact), before = tool.textMeshData, base = [...tool.basePosition];
  tool.addBase(); tool.setTextFont('Optimer');
  expect(tool.textFont).toBe('Optimer'); expect(tool.textReady).toBe(true); expect(tool.textMeshData).not.toBe(before); expect(tool.baseAdded).toBe(false);
  expect(tool.textSurfaceAttached).toBe(true); expect(new Vector3(...tool.textContact).distanceTo(contact)).toBeLessThan(0.001);
  expect(tool.basePosition).toEqual(base); expect(tool.textContent).toBe('O'); expect(tool.textScale).toBe(0.5); expect(tool.textColor).toBe('#23748d');
  tool.setTextFont('Droid Mono'); expect(tool.textFont).toBe('Droid Mono'); expect(tool.textReady).toBe(true);
  const mono = tool.textMeshData; tool.setTextFont('Unknown'); expect(tool.textFont).toBe('Droid Mono'); expect(tool.textMeshData).toBe(mono);
  tool.setMode('flatten'); tool.setMode('add'); expect(tool.textFont).toBe('Droid Mono');
  tool.removeText(); expect(tool.textAdded).toBe(false); expect(tool.textMeshData).toBeNull();
  tool.addText(); expect(tool.textReady).toBe(true); expect(tool.textFont).toBe('Droid Mono');
  content.value = { ...content.value, id: 'replacement-font' };
  tool.reset(); expect(tool.textFont).toBe('Helvetiker'); expect(tool.textAdded).toBe(false);
});


it('keeps a valid text fit through failed rim samples, slides continuously and releases when pulled away', () => {
  const { tool } = setup(); tool.setMode('add'); tool.addText(); tool.setTextScale(0.5);
  const radius = tool.baseDepth / 2, y = -tool.baseHeight / 2;
  expect(tool.setTextSurfaceFromRay([0,y,radius+30],[0,0,-1])).toBe(true);
  tool.beginTextSurfaceDrag();
  for (let x = 0.1; x <= 2; x += 0.1) {
    const before = tool.textOrientation.clone();
    expect(tool.setTextSurfaceFromRay([x,y,radius+30],[0,0,-1])).toBe(true);
    expect(tool.textSnapped).toBe(true); expect(tool.textSurfaceHeld).toBe(false);
    expect(before.angleTo(tool.textOrientation)).toBeLessThan(0.1);
  }
  expect(tool.setTextSurfaceFromRay([2,-tool.textWorldHeight / 2 - 0.3,radius+30],[0,0,-1])).toBe(true);
  const position = [...tool.textPosition], mesh = tool.textMeshData;
  // The anchor is still close, but the full text would cross the top rim.
  expect(tool.setTextSurfaceFromRay([2,-0.1,radius+30],[0,0,-1])).toBe(true);
  expect(tool.textSurfaceHeld).toBe(true); expect(tool.textPosition).toEqual(position); expect(tool.textMeshData).toBe(mesh);
  expect(tool.setTextSurfaceFromRay([2,y,radius+30],[0,0,-1])).toBe(true); expect(tool.textSurfaceHeld).toBe(false);
  tool.setTextPosition([2,y,radius+20]); expect(tool.textSnapped).toBe(false); expect(tool.textSurfaceHeld).toBe(false);
  expect(tool.setTextSurfaceFromRay([2,y,radius+30],[0,0,-1])).toBe(true); expect(tool.textSnapped).toBe(true);
  tool.endTextSurfaceDrag(); expect(tool.retainTextSurface()).toBe(false);
});


it('does not retain stale drag holds after a module switch or deleting the text', () => {
  const { tool } = setup(); tool.setMode('add'); tool.addText(); tool.setTextScale(0.5);
  const y = -tool.baseHeight / 2, z = tool.baseDepth / 2 + 30;
  expect(tool.setTextSurfaceFromRay([0,y,z],[0,0,-1])).toBe(true);
  tool.beginTextSurfaceDrag(); expect(tool.retainTextSurface()).toBe(true);
  tool.setMode('flatten'); expect(tool.textSurfaceHeld).toBe(false); expect(tool.retainTextSurface()).toBe(false);
  tool.setMode('add'); tool.beginTextSurfaceDrag(); expect(tool.retainTextSurface()).toBe(true);
  tool.removeText(); expect(tool.textSurfaceHeld).toBe(false); expect(tool.retainTextSurface()).toBe(false);
});
