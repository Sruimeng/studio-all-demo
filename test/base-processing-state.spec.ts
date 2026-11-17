import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, shallowRef } from 'vue';
import { BoxGeometry, Color, Group, Object3D, PerspectiveCamera, Quaternion, Scene, Vector3 } from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { cutMesh } from '../app/@engine/base-processing/geometry';
import type { ViewerContent } from '../app/@engine/viewer';
import { useBaseProcessing } from '../app/@feature/base-processing';
import { prepareBaseAsset } from '../app/@feature/base-processing/base-assets';
import { createPlaneRotationControls } from '../app/@feature/base-processing/plane-rotation-controls';
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

it('moves the actual gizmo with cut depth and rotation, snaps ring drags near 90 degrees, and preserves precise inputs and base translation', () => {
  const { tool } = setup(), scene = new Scene(), camera = new PerspectiveCamera();
  camera.position.set(100, 80, 160); camera.lookAt(0, 40, 0);
  const canvas = Object.assign(new EventTarget(), {
    style: { touchAction: 'auto', cursor: '' },
    hasPointerCapture: () => false,
  }) as unknown as HTMLCanvasElement;
  const windowEvents = new EventTarget(); vi.stubGlobal('window', windowEvents);
  const controls = createPlaneRotationControls(camera, scene, canvas, new Object3D(), new Object3D(), tool, () => {});
  const transform = (scene.children.find(child => 'controls' in child) as ReturnType<TransformControls['getHelper']>).controls;
  try {
    tool.activateRotation();
    expect(transform.object!.position.toArray()).toEqual([0, 4, 0]);
    tool.setDepthMM(24);
    expect(transform.object!.position.toArray()).toEqual([0, 24, 0]);
    transform.dragging = true;
    for (const [raw, expected] of [[88, 90], [92, 90], [96, 96], [15, 15], [-89, -90], [179, 180]]) {
      transform.object!.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), raw! * Math.PI / 180);
      transform.dispatchEvent({ type: 'objectChange' });
      expect(Math.abs(tool.angles.x)).toBeCloseTo(Math.abs(expected!));
      expect(transform.object!.position.toArray()).toEqual(tool.planeCenter);
      expect(new Vector3(...tool.plane.normal).dot(transform.object!.position)).toBeCloseTo(tool.plane.offset);
    }
    transform.dragging = false; tool.setAngle('x', 88);
    expect(tool.angles.x).toBeCloseTo(88);
    expect(transform.object!.position.toArray()).toEqual(tool.planeCenter);
    const shifted = Object.assign(new Event('keydown'), { key: 'Shift', shiftKey: true });
    windowEvents.dispatchEvent(shifted); expect(transform.rotationSnap).toBeNull();
    tool.setMode('add'); tool.selectBase();
    windowEvents.dispatchEvent(shifted);
    expect(transform.getMode()).toBe('translate'); expect(transform.translationSnap).toBe(1);
    tool.setBasePosition([5, 3, -7]); expect(transform.object!.position.toArray()).toEqual(tool.basePivot);
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


it('centers the rotation pivot on the model and keeps the plane centered at every angle', () => {
  const { tool } = setup();
  const center = new Vector3(0, 40, 0);
  expect(tool.pivot).toEqual(center.toArray());
  tool.toggleRotation();
  for (const angle of [15, 30, 60, 90, 125, 179]) {
    tool.setAngle('x', angle); tool.setAngle('z', angle / 2);
    expect(tool.pivot).toEqual(center.toArray());
    const normal = new Vector3(...tool.normal), planeCenter = new Vector3(...tool.planeCenter);
    expect(planeCenter.clone().sub(center).cross(normal).length()).toBeLessThan(1e-8);
    expect(normal.dot(planeCenter)).toBeCloseTo(tool.plane.offset);
    expect(tool.depthMM / tool.span).toBeCloseTo(0.05);
  }
  const oldDepth = tool.depthMM, oldCenter = new Vector3(...tool.planeCenter);
  tool.setDepthMM(oldDepth + 10);
  expect(new Vector3(...tool.planeCenter).sub(oldCenter).distanceTo(new Vector3(...tool.normal).multiplyScalar(10))).toBeLessThan(1e-8);
  expect(tool.pivot).toEqual(center.toArray());
  expect(tool.depthMM).toBeCloseTo(oldDepth + 10);
});

it('switches to XYZ without changing cut proportion or retained side, and exits custom mode', () => {
  const { tool } = setup(); tool.flip = true; tool.toggleRotation();
  const pivot = [...tool.pivot];
  expect(tool.customMode).toBe(true); expect(tool.rotating).toBe(true);
  for (const [axis, normal] of [['x', [1,0,0]], ['y', [0,1,0]], ['z', [0,0,1]]] as const) {
    tool.setDirection(axis); expect(tool.direction).toBe(axis); expect(tool.normal).toEqual(normal);
    expect(tool.flip).toBe(true); expect(tool.pivot).toEqual(pivot);
    expect(tool.depthMM / tool.span).toBeCloseTo(0.05);
    expect(tool.customMode).toBe(false); expect(tool.rotating).toBe(false);
  }
  tool.setDirection('y'); expect(tool.angles).toEqual({ x: 0, y: 0, z: 0 });
});

it('keeps the selected gizmo open through axis presets and preserves the cut when reselected', async () => {
  const { tool } = setup();
  tool.setDepthMM(24); tool.flip = true; tool.activateRotation();
  for (const axis of ['x', 'z', 'y'] as const) {
    tool.setDirection(axis, true);
    expect(tool.direction).toBe(axis); expect(tool.rotating).toBe(true);
    expect(tool.flip).toBe(true); expect(tool.depthMM / tool.span).toBeCloseTo(0.3);
    expect(tool.pivot).toEqual([0, 40, 0]);
  }
  tool.setAngle('x', 30);
  const plane = { ...tool.plane }, rotation = [...tool.rotation];
  tool.stopRotation(); tool.activateRotation();
  expect(tool.rotation).toEqual(rotation); expect(tool.plane).toEqual(plane);
  await tool.apply();
  expect(tool.rotating).toBe(false); expect(tool.failure).toBe('');
  expect(tool.result!.stats.boundary).toBe(0);
});

it('keeps an oblique cut and its pivot consistent when flipping and uniformly scaling', async () => {
  const { tool, content } = setup(); const original = content.value.mesh.positions.slice();
  tool.setAngle('z', 25); tool.setAngle('x', 15);
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

it('syncs ring quaternions with precise inputs and ignores invalid rotation values', async () => {
  const { tool } = setup(); await tool.apply();
  const q = new Quaternion().setFromAxisAngle(new Vector3(0,0,1), Math.PI / 6);
  tool.setRotation(q.toArray());
  expect(tool.angles.z).toBeCloseTo(30); expect(tool.result).toBeNull(); expect(tool.view).toBe('preview');
  const normal = [...tool.normal];
  tool.setRotation([0,0,0,0]); tool.setRotation([NaN,0,0,1]); tool.setAngle('x', Infinity);
  expect(tool.normal).toEqual(normal);
  tool.setAngle('z', 390); expect(tool.angles.z).toBeCloseTo(30);
});

it('leaves rotation mode on apply or module exit while keeping the selected angle', async () => {
  const { tool, active } = setup(); tool.toggleRotation(); tool.setAngle('x', 20);
  expect(tool.rotating).toBe(true); await tool.apply(); expect(tool.rotating).toBe(false);
  tool.toggleRotation(); expect(tool.view).toBe('preview');
  active.value = false; await nextTick(); expect(tool.rotating).toBe(false); expect(tool.angles.x).toBeCloseTo(20);
});


it('keeps custom angles visible when finishing rotation and resets them for a new model', async () => {
  const { tool, content } = setup();
  tool.toggleRotation(); expect(tool.customMode).toBe(true); expect(tool.direction).toBe('y');
  tool.setAngle('x', 30); tool.toggleRotation();
  expect(tool.rotating).toBe(false); expect(tool.customMode).toBe(true); expect(tool.angles.x).toBeCloseTo(30);
  tool.toggleRotation(); tool.stopRotation();
  expect(tool.customMode).toBe(true); expect(tool.rotating).toBe(false);
  content.value = { ...content.value, id: 'replacement' }; await nextTick();
  expect(tool.customMode).toBe(false); expect(tool.direction).toBe('y'); expect(tool.pivot).toEqual([0,40,0]);
});
