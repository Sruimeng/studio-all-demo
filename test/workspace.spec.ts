import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { disposePinia, getActivePinia } from 'pinia';
import { createPinia, setActivePinia } from 'pinia';
import { toRaw } from 'vue';
import { initialMaterials } from './fixtures/materials';
import { Group } from 'three';
import { unzipSync, strFromU8, zipSync, strToU8 } from 'fflate';

const mocks = vi.hoisted(() => ({ records: new Map<string, unknown>(), write: vi.fn(), download: vi.fn(), load: vi.fn(), request: vi.fn(), clients: [] as Array<{ disposed: boolean }> }));
vi.mock('~/@base/storage', () => ({ readRecord: async (key: string) => mocks.records.get(key), writeRecord: mocks.write, writeRecords: async (entries: Array<[string, unknown]>) => { const before = new Map(mocks.records); try { for (const [key, value] of entries) await mocks.write(key, value); } catch (error) { mocks.records.clear(); for (const [key, value] of before) mocks.records.set(key, value); throw error; } }, downloadFile: mocks.download }));
vi.mock('~/@base/locale', () => ({ useLocale: () => ({ t: (en: string) => en }) }));
vi.mock('~/@feature/materials', async () => ({ ...await import('../app/@feature/materials/catalog'), ...await import('../app/@feature/materials/types'), ...await import('../app/@feature/materials/supplier'), ...await import('../app/@feature/materials/usda') }));
vi.mock('~/@engine/import', () => ({ loadLocalModel: mocks.load }));
vi.mock('~/@engine/model', () => ({ collectModelResources: () => ({}), disposeModelResources: vi.fn() }));
vi.mock('~/@engine/print-mesh', () => ({ toPrintMesh: async () => ({ positions: new Float32Array(9) }), uvHit: vi.fn() }));
vi.mock('~/@engine/multicolor', () => ({ MulticolorClient: class {
  disposed = false;
  constructor() { mocks.clients.push(this); }
  dispose() { this.disposed = true; }
  setRevision() {}
  async request(type: string, payload: unknown) {
    const override = mocks.request(type, payload);
    structuredClone(payload);
    if (this.disposed) throw new Error('disposed');
    if (override !== undefined) return await override;
    if (type === 'init') return { bbox: { minX: 0, maxX: 2, minY: 0, maxY: 1, minZ: 0, maxZ: 3 }, warnings: [], nf: 1, wpos: new Float32Array([0,0,0,2,1,0,0,0,3]), widx: new Uint32Array([0,1,2]) };
    if (type === 'palette') {
      const candidates = (payload as { cands?: Array<{ id: string; hex: string }> }).cands ?? [];
      return { slots: candidates.slice(0, 2).map((candidate, index) => ({ hex: candidate.hex, sourceHex: index ? '#0000FF' : '#FF0000', filamentId: candidate.id, w: 0.5, de: index + 0.25 })) };
    }
    if (type === 'label' || type === 'restore') return { label: new Uint8Array([0]) };
    if (type === 'export3mf') return { blob: new Blob(['3mf']) };
    if (type === 'snapshot') return { snapshot: { version: 1, geometryKey: 'test-geometry', faceCount: 1, labels: [0], slotCount: 2 } };
  }
} }));
const { useWorkspace } = await import('../app/@feature/workspace/use-workspace');
const workspaceWithMaterials = () => {
  const store = useWorkspace();
  store.materials = structuredClone(initialMaterials);
  return store;
};

beforeEach(() => {
  setActivePinia(createPinia()); mocks.records.clear(); mocks.clients.length = 0;
  mocks.request.mockReset(); mocks.download.mockClear();
  mocks.write.mockReset().mockImplementation(async (key: string, value: unknown) => { mocks.records.set(key, structuredClone(value)); });
  mocks.load.mockReset().mockImplementation(async () => ({ root: new Group(), warnings: [] }));
});
afterEach(() => { const pinia = getActivePinia(); if (pinia) disposePinia(pinia); vi.unstubAllGlobals(); });
const files = () => [new File(['model'], 'test.glb')];
const supplier = async (sku = 'CA19017') => {
  const { supplierMaterials, cloneMaterial } = await import('../app/@feature/materials/supplier');
  return cloneMaterial(supplierMaterials.find(material => material.materialId === sku)!);
};

const mockSampleFetch = () => {
  const fetch = vi.fn(async () => new Response('sample model', { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

it('defaults to the role model for printing and restores separate chicken and role edits across module switches', async () => {
  const fetch = mockSampleFetch(), store = workspaceWithMaterials();
  await store.initialize();
  expect(fetch).toHaveBeenLastCalledWith('/samples/role-model.glb');
  expect(store.project).toMatchObject({ name: '角色模型（去光）', sourceSample: 'role' });
  const roleId = store.project!.id;
  store.setHeight(120); store.apply(store.materials[0]!);
  await store.navigateModule('print');
  expect(store.project!.id).toBe(roleId); expect(store.preparation.activeModule).toBe('print');
  await store.navigateModule('segment');
  expect(fetch).toHaveBeenLastCalledWith('/samples/cartoon-chicken-textured.glb');
  expect(store.project!.sourceSample).toBe('chicken'); expect(store.preparation.activeModule).toBe('segment');
  const chickenId = store.project!.id;
  store.setHeight(60);
  await store.navigateModule('multi-color');
  expect(store.project!.id).toBe(roleId); expect(store.settings.height).toBe(120);
  expect(store.regions[0]!.material.id).toBe(initialMaterials[0]!.id);
  await store.navigateModule('segment');
  expect(store.project!.id).toBe(chickenId); expect(store.settings.height).toBe(60);
  expect(fetch).toHaveBeenCalledTimes(2);
  await store.navigateModule('print');
  expect(store.project!.id).toBe(roleId); expect(store.settings.height).toBe(120);
});

it('loads each module sample without leaving that module and retains the white turkey option', async () => {
  const fetch = mockSampleFetch(), store = workspaceWithMaterials();
  await store.demo(); await store.navigateModule('print'); await store.demo();
  expect(fetch).toHaveBeenLastCalledWith('/samples/role-model.glb');
  expect(store.preparation.activeModule).toBe('print');
  await store.navigateModule('segment'); await store.demo();
  expect(fetch).toHaveBeenLastCalledWith('/samples/cartoon-chicken-textured.glb');
  expect(store.preparation.activeModule).toBe('segment');
  await store.demo('white');
  expect(fetch).toHaveBeenLastCalledWith('/samples/stylized-turkey-white.glb');
  expect(store.project!.sourceSample).toBe('turkey'); expect(store.preparation.activeModule).toBe('segment');
});

it('preserves the previous chicken print project when migrating the default to the role model once', async () => {
  const fetch = mockSampleFetch(), store = workspaceWithMaterials();
  await store.loadFiles(files(), undefined, 'chicken'); store.setHeight(110); await store.save();
  const chickenId = store.project!.id;
  await store.initialize();
  expect(store.project!.sourceSample).toBe('role');
  const roleId = store.project!.id;
  expect(mocks.records.get(`project:${chickenId}`)).toMatchObject({ sourceSample: 'chicken', height: 110 });
  expect(mocks.records.get('role-default-v1')).toBe(true);
  await store.initialize();
  expect(store.project!.id).toBe(roleId); expect(fetch).toHaveBeenCalledTimes(1);
  await store.navigateModule('segment');
  expect(store.project!.id).toBe(chickenId); expect(store.settings.height).toBe(110);
});

it('keeps a saved Segment chicken project on reload and loads the role only when opening Print', async () => {
  const fetch = mockSampleFetch(), store = workspaceWithMaterials();
  await store.loadFiles(files(), undefined, 'chicken'); await store.navigatePreparation('segment');
  const chickenId = store.project!.id;
  await store.initialize();
  expect(store.project!.id).toBe(chickenId); expect(store.preparation.activeModule).toBe('segment');
  expect(fetch).not.toHaveBeenCalled();
  await store.navigateModule('print');
  expect(store.project!.sourceSample).toBe('role'); expect(store.preparation.activeModule).toBe('print');
});

it('keeps imported models in place and stops sample switching if saving or loading fails', async () => {
  const fetch = mockSampleFetch(), store = workspaceWithMaterials();
  await store.loadFiles(files()); const importedId = store.project!.id;
  await store.navigateModule('segment'); await store.navigateModule('print');
  expect(store.project!.id).toBe(importedId); expect(fetch).not.toHaveBeenCalled();
  await store.demo(); const roleId = store.project!.id;
  mocks.write.mockRejectedValueOnce(new Error('disk full'));
  await store.navigateModule('segment');
  expect(store.project!.id).toBe(roleId); expect(store.preparation.activeModule).toBe('print');
  expect(store.failure).toBe('disk full'); expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockResolvedValueOnce(new Response('', { status: 404 }));
  await store.navigateModule('segment');
  expect(store.project!.id).toBe(roleId); expect(store.preparation.activeModule).toBe('print');
  expect(store.failure).toBe('Demo asset is missing');
});

it('failed replacement keeps the active model and worker usable', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); const id = store.project!.id;
  mocks.load.mockRejectedValueOnce(new Error('Invalid GLB'));
  await store.loadFiles(files()); expect(store.failure).toBe('Invalid GLB');
  expect(store.project!.id).toBe(id); expect(mocks.clients[0]!.disposed).toBe(false);
  await store.save(); expect(mocks.records.get('active-project')).toBe(id);
});
it('previews without editing, then fills with the chosen filament without a selection step', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  store.settings.tool = 'fill';
  store.refinement = { positions: new Float32Array(27), labels: new Uint8Array([0, 0, 0]), sourceFaces: new Uint32Array([0, 1, 2]), uvs: new Float32Array(18), faceIsland: new Int32Array(3), facePart: new Uint32Array(3), faceAtlas: new Int32Array(3), islandCount: 1, partCount: 1 };
  store.display = { positions: store.refinement.positions, labels: store.refinement.labels };
  store.selectedRegion = 1; store.saved = true;
  mocks.request.mockImplementation((type, payload) => {
    if (type === 'selectRefinement') return { faces: new Uint32Array([0, 1]) };
    if (type === 'fillRefinement') return { left: 1, label: null, refinementLabels: new Uint8Array([payload.label, payload.label, 0]) };
  });
  store.previewFill(0); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(Array.from(store.fillPreview)).toEqual([0, 1]);
  expect(store.busy).toBe(false); expect(store.saved).toBe(true);
  expect(store.selection.length).toBe(0); expect(store.undoCount).toBe(0);
  const hit = { face: 0, point: [0, 0, 0] as [number, number, number], radius: 3 };
  await store.fill(hit);
  expect(mocks.request).toHaveBeenCalledWith('fillRefinement', { face: 0, label: 1, materialGroups: [0, 1] });
  expect(Array.from(store.display!.labels)).toEqual([1, 1, 0]);
  expect(store.selectedRegion).toBe(1); expect(store.undoCount).toBe(1);
  expect(store.selection.length).toBe(0); expect(store.fillPreview.length).toBe(0);
  store.saved = true; mocks.request.mockClear();
  await store.fill(hit);
  expect(mocks.request).not.toHaveBeenCalled(); expect(store.saved).toBe(true);
});
it('lists only preview filaments and highlights every matching face across slots as paint and undo change labels', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  const first = store.regions[0]!.material, second = store.regions[1]!.material;
  store.regions.push({ index: 2, sourceHex: '#FF0000', material: structuredClone(toRaw(first)) });
  const labels = new Uint8Array([0, 1, 2, 1]);
  store.refinement = { positions: new Float32Array(36), labels, sourceFaces: new Uint32Array([0, 1, 2, 3]), uvs: new Float32Array(24), faceIsland: new Int32Array(4), facePart: new Uint32Array(4), faceAtlas: new Int32Array(4), islandCount: 1, partCount: 1 };
  store.display = { positions: store.refinement.positions, labels };
  store.saved = true; mocks.request.mockClear();
  store.selectPlanFilament(0);
  expect(store.planFilaments.map(item => item.material.id)).toEqual([first.id, second.id]);
  expect(store.planFilaments[0]!.indices).toEqual([0, 2]);
  expect(Array.from(store.planHighlight)).toEqual([0, 2]);
  expect(store.saved).toBe(true); expect(mocks.request).not.toHaveBeenCalled();
  for (const tool of ['orbit', 'brush', 'fill'] as const) {
    store.settings.tool = tool;
    store.selectPlanFilament(0);
    expect(store.highlightedFilamentId).toBeNull();
    expect(store.planHighlight).toHaveLength(0);
    expect(store.selected!.id).toBe(first.id);
    store.selectPlanFilament(0);
    expect(Array.from(store.planHighlight)).toEqual([0, 2]);
  }
  expect(Array.from(store.display!.labels)).toEqual([0, 1, 2, 1]);
  expect(mocks.request).not.toHaveBeenCalled();
  // The mask uses displayed face indices even when the preview maps them to source faces.
  store.display = { ...store.display, faceMap: new Uint32Array([9, 8, 7, 6]) };
  expect(Array.from(store.planHighlight)).toEqual([0, 2]);
  store.selectPlanFilament(1);
  expect(Array.from(store.planHighlight)).toEqual([1, 3]);
  mocks.request.mockImplementation(type => {
    if (type === 'brushRefinement') return { left: 1, label: null, refinementLabels: new Uint8Array([1, 1, 1, 1]) };
    if (type === 'undo') return { left: 0, label: null, refinementLabels: labels };
  });
  await store.stroke([{ face: 0, point: [0, 0, 0], radius: 3 }]);
  expect(store.planFilaments.map(item => item.material.id)).toEqual([second.id]);
  expect(Array.from(store.planHighlight)).toEqual([0, 1, 2, 3]);
  await store.undo();
  expect(store.planFilaments.map(item => item.material.id)).toEqual([first.id, second.id]);
  expect(Array.from(store.planHighlight)).toEqual([1, 3]);
  store.selectedRegion = 0;
  expect(store.planHighlight).toHaveLength(0);
  store.selectPlanFilament(0); store.clearPlanHighlight();
  expect(store.planHighlight).toHaveLength(0);
});
it('loads and regenerates regions with supplier SKU matches and keeps source colors for labels', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  const palette = mocks.request.mock.calls.find(([type]) => type === 'palette');
  expect(palette?.[1]).toMatchObject({ mode: 'owned', N: 4, protect: true });
  const candidates = (palette?.[1] as { cands: Array<{ id: string; hex: string }> }).cands;
  expect(candidates).toHaveLength(26);
  expect(candidates.map(candidate => candidate.id)).not.toContain('polymaker:CA19010');
  expect(candidates.map(candidate => candidate.id)).not.toContain('polymaker:CA19012');
  expect(new Set(candidates.map(candidate => candidate.id)).size).toBe(26);
  expect(store.regions.map(region => region.material.materialId)).toEqual(['CA19001', 'CA19002']);
  expect(store.regions.map(region => region.sourceHex)).toEqual(['#FF0000', '#0000FF']);
  expect(store.regions[0]!.match).toEqual({ basis: 'catalog-hex-d65-deltae00', materialId: candidates[0]!.id, hex: candidates[0]!.hex, meanDeltaE: 0.25, areaShare: 0.5 });
  store.apply(store.materials[0]!); expect(store.regions[0]!.match).toBeUndefined();
  const before = mocks.request.mock.calls.filter(([type]) => type === 'palette').length;
  await store.segment();
  expect(mocks.request.mock.calls.filter(([type]) => type === 'palette').length).toBe(before + 1);
  expect(store.regions.every(region => region.material.supplier?.vendor === 'Polymaker')).toBe(true);
  expect(store.regions[0]!.match).toBeDefined();
});
it('canonical candidates ignore local colors, supplier copies and preview overrides', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  const material = await supplier('CA19001'); const hex = material.supplier!.catalogHex!;
  store.materials.push({ ...material, id: 'local-supplier-copy', materialId: 'COPY' });
  material.hex = '#123456'; material.roughness = 0.2;
  expect(await store.saveMaterial(material)).toBe(true);
  mocks.request.mockClear(); await store.segment();
  const candidates = mocks.request.mock.calls.find(([type]) => type === 'palette')![1].cands;
  expect(candidates).toHaveLength(26);
  expect(candidates.find((candidate: { id: string }) => candidate.id === material.id).hex).toBe(hex);
  expect(store.regions[0]!.material.hex).toBe('#123456');
  expect(store.regions[0]!.match!.hex).toBe(hex);
  expect(store.regions[0]!.material.roughness).toBe(0.2);
});
it('failed material writes leave saved catalog and bindings intact', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  const original = store.regions[0]!.material;
  mocks.write.mockRejectedValueOnce(new Error('Quota exceeded'));
  expect(await store.saveMaterial({ ...store.materials[0]!, roughness: 0.9 })).toBe(false);
  expect(store.materials[0]!.roughness).toBe(0.35); expect(store.regions[0]!.material).toEqual(original);
  expect(store.regions[0]!.match!.meanDeltaE).toBe(0.25);
  expect(store.failure).toBe('Quota exceeded');
});

it('adding a custom owned filament persists it without changing the active plan or confirmation', async () => {
  const { customFilament } = await import('../app/@feature/materials/filaments');
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  const material = customFilament('My PETG', 'PETG', '#1729AB');
  const regions = structuredClone(JSON.parse(JSON.stringify(store.regions))), display = store.display;
  const preparation = JSON.parse(JSON.stringify(store.preparation));
  mocks.request.mockClear();
  expect(await store.addFilament(material)).toBe(true);
  expect(mocks.records.get('materials')).toContainEqual(material);
  expect(store.regions).toEqual(regions); expect(store.display).toBe(display);
  expect(store.preparation).toEqual(preparation); expect(mocks.request).not.toHaveBeenCalled();
  expect(await store.addFilament(material)).toBe(false);
  mocks.write.mockRejectedValueOnce(new Error('Quota exceeded'));
  const failed = customFilament('Failed', 'PLA', '#FFFFFF');
  expect(await store.addFilament(failed)).toBe(false);
  expect(store.materials.some(item => item.id === failed.id)).toBe(false);
  expect(store.regions).toEqual(regions);
});

it('uses current owned custom filaments only on regeneration with preference enabled', async () => {
  const { customFilament } = await import('../app/@feature/materials/filaments');
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  const material = customFilament('Custom blue', 'PLA', '#1729AB');
  await store.addFilament(material);
  const candidates = () => mocks.request.mock.calls.filter(([type]) => type === 'palette').at(-1)![1].cands;
  await store.segment({ ownedIds: [material.id], preferOwned: true });
  expect(candidates()).toContainEqual({ id: material.id, hex: '#1729AB', penalty: 0 });
  expect(candidates().filter((item: { id: string }) => item.id !== material.id).every((item: { penalty: number }) => item.penalty === 6)).toBe(true);
  await store.segment({ ownedIds: [], preferOwned: true });
  expect(candidates().some((item: { id: string }) => item.id === material.id)).toBe(false);
  await store.segment({ ownedIds: [material.id], preferOwned: false });
  expect(candidates().some((item: { id: string }) => item.id === material.id)).toBe(false);
});
it('binding and shared material updates preserve region labels and distinct same-color IDs', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); const labels = store.display!.labels;
  const a = { ...store.materials[0]!, id: 'a', materialId: 'A' };
  const b = { ...a, id: 'b', materialId: 'B', metalness: 1 };
  await store.saveMaterial(a); store.selectedRegion = 1; await store.saveMaterial(b);
  expect(store.regions.every(region => !region.match)).toBe(true);
  expect(store.regions.map(r => r.material.materialId)).toEqual(['A', 'B']);
  await store.saveMaterial({ ...a, transparency: 1 });
  expect(store.regions[0]!.material.transparency).toBe(1); expect(store.regions[1]!.material.metalness).toBe(1);
  expect(store.display!.labels).toBe(labels);
});
it('save and reopen restore the edited settings and active project', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); store.setHeight(123); await store.save();
  const id = store.project!.id;
  const matches = structuredClone((mocks.records.get(`project:${id}`) as { regions: unknown }).regions);
  await store.loadFiles(files()); expect(mocks.clients[0]!.disposed).toBe(true);
  await store.save(); expect(store.failure).toBe('');
  await store.openProject(id); expect(store.settings.height).toBe(123); expect(store.saved).toBe(true);
  expect(JSON.parse(JSON.stringify(store.regions))).toEqual(matches);
  expect(mocks.records.get('active-project')).toBe(id);
  store.setHeight(0); store.setHeight(NaN); expect(store.settings.height).toBe(123);
  store.setHeight(900); expect(store.settings.height).toBe(320);
});
it('ZIP export and restore retain canonical match evidence and manual assignments', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  store.selectedRegion = 1; store.apply(store.materials[0]!);
  const expected = JSON.parse(JSON.stringify(store.regions));
  await store.backup();
  const blob = mocks.download.mock.calls.at(-1)![0] as Blob;
  const archive = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const metadata = JSON.parse(strFromU8(archive['project.json']!));
  expect(metadata.regions).toEqual(expected);
  await store.segment(); await store.restoreBackup(new File([blob], 'matched.tripo.zip'));
  expect(store.failure).toBe(''); expect(JSON.parse(JSON.stringify(store.regions))).toEqual(expected);
  expect(store.regions[0]!.match!.basis).toBe('catalog-hex-d65-deltae00');
  expect(store.regions[1]!.match).toBeUndefined();
});
it('backup roundtrip restores model, catalog and bindings; malformed archives leave project intact', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.save();
  const data = mocks.records.get(`project:${store.project!.id}`) as Record<string, unknown>;
  const catalog = [{ ...store.materials[0]!, id: 'backup-material', materialId: 'BACKUP' }];
  const archive = zipSync({ 'project.json': strToU8(JSON.stringify({ ...data, materials: catalog, files: [{ name: 'test.glb', path: 'test.glb', type: '', entry: 'assets/0' }] })), 'assets/0': strToU8('model') });
  await store.restoreBackup(new File([archive], 'backup.zip'));
  expect(store.failure).toBe(''); expect(store.materials[0]!.materialId).toBe('BACKUP'); expect(store.saved).toBe(false);
  const id = store.project!.id;
  await store.restoreBackup(new File([zipSync({ 'project.json': strToU8('{"version":1}') })], 'bad.zip'));
  expect(store.failure).toContain('Invalid'); expect(store.project!.id).toBe(id);
});

it('3MF dispatch clones the reactive material catalog and bindings for Worker transfer', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); store.apply(store.materials[0]!);
  await store.export3mf(); expect(store.failure).toBe(''); expect(mocks.download).toHaveBeenCalled();
});

it('validation and region assignment change appearance without requesting new labels', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); const labels = store.display!.labels;
  mocks.request.mockClear();
  store.setWorkflow('validation'); store.apply(await supplier());
  expect(store.selected!.materialId).toBe('CA19017'); expect(store.settings.layers).toBe(false);
  expect(store.validationSurface!.renderRule).toBe('openpbr-subset-v1');
  expect(store.display!.labels).toBe(labels); expect(mocks.request).not.toHaveBeenCalled();
  await store.export3mf(); expect(store.failure).toContain('Switch to region');
  store.setWorkflow('assignment'); store.apply(await supplier());
  expect(store.regions[0]!.material.materialId).toBe('CA19017'); expect(store.display!.labels).toBe(labels);
});

it('leaving material preview restores the color plan, lighting and view without changing assignments', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  const assignments = JSON.stringify(store.regions);
  const model = store.content; const labels = store.display!.labels;
  store.settings.mode = 'compare'; store.settings.layers = true;
  store.settings.preview = { preset: 'studio-v1', exposure: 1.2, environmentIntensity: 0.7, environmentRotation: 90 };
  const preview = { ...store.settings.preview };
  mocks.request.mockClear();
  store.setWorkflow('validation'); store.apply(await supplier());
  expect(store.settings.mode).toBe('print'); expect(store.settings.preview!.preset).toBe('validation-v1');
  store.setWorkflow('validation');
  store.draft = await supplier('CA19001');
  store.setWorkflow('assignment');
  expect(store.settings.mode).toBe('compare'); expect(store.settings.layers).toBe(true);
  expect(store.settings.preview).toEqual(preview); expect(store.draft).toBeNull();
  expect(JSON.stringify(store.regions)).toBe(assignments);
  expect(store.content).toBe(model); expect(store.display!.labels).toBe(labels);
  expect(mocks.request).not.toHaveBeenCalled();
});

it('importing a new model exits material preview and clears the previous preview view state', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  store.settings.mode = 'original'; store.setWorkflow('validation');
  await store.loadFiles(files());
  expect(store.settings.workflow).toBe('assignment');
  expect(store.settings.preview!.preset).toBe('studio-v1');
  store.setWorkflow('validation'); store.setWorkflow('assignment');
  expect(store.settings.mode).toBe('compare');
});

it('supplier overrides use separate storage and survive project save and reopen', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); store.setWorkflow('validation');
  const material = await supplier(); material.roughness = 0.12;
  expect(await store.saveMaterial(material)).toBe(true);
  expect(mocks.records.has('supplier-overrides')).toBe(true); expect(mocks.records.has('materials')).toBe(false);
  expect(store.allMaterials.find(item => item.id === material.id)!.roughness).toBe(0.12);
  expect(store.selected!.supplier!.source.parameters.specular_roughness).toBe(0.45);
  await store.save(); const id = store.project!.id;
  store.setWorkflow('assignment'); await store.openProject(id);
  expect(store.settings.workflow).toBe('validation'); expect(store.settings.preview!.preset).toBe('validation-v1');
  expect(store.validationSurface!.roughness).toBe(0.12); expect(store.saved).toBe(true);
});

it('legacy projects reopen under Studio rules and invalid new settings leave the active project intact', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.save();
  const id = store.project!.id;
  const data = mocks.records.get(`project:${id}`) as Record<string, unknown>;
  data.version = 1; delete data.viewerSettings; delete data.validationMaterial;
  data.regions = [{ index: 0, sourceHex: '#FF0000', material: structuredClone({ ...store.materials[0]! }) }];
  store.setWorkflow('validation'); await store.openProject(id);
  expect(store.settings.workflow).toBe('assignment'); expect(store.surfaces[0]!.renderRule).toContain('studio-v1');
  data.version = 2; data.viewerSettings = { ...store.settings, preview: { preset: 'validation-v1', exposure: NaN } };
  await store.openProject(id); expect(store.failure).toContain('Invalid preview'); expect(store.project!.id).toBe(id);
});

it('failed supplier writes leave both the local override and current assignment unchanged', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); const material = await supplier(); store.apply(material);
  mocks.write.mockRejectedValueOnce(new Error('Quota exceeded')); material.roughness = 0.1;
  expect(await store.saveMaterial(material)).toBe(false);
  expect(store.selected!.roughness).toBe(0.45);
  expect(store.allMaterials.find(item => item.id === material.id)!.roughness).toBe(0.45);
});

it('exports actual supplier material type, brand and revision and blocks unmatched SKU assignment', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); const material = await supplier();
  material.supplier!.materialType = 'PETG'; store.apply(material);
  await store.export3mf();
  const call = mocks.request.mock.calls.find(([type]) => type === 'export3mf')!;
  expect(call[1].filaments[0]).toMatchObject({ id: 'CA19017', type: 'PETG', vendor: 'Polymaker', materialVersion: material.supplier!.source.sha256 });
  store.apply(await supplier('CA19010')); expect(store.failure).toContain('未对应');
  expect(store.selected!.materialId).toBe('CA19017');
});

const materialFile = async () => new File([`#usda 1.0\n${(await supplier()).supplier!.source.materialUSDA}`], 'sample.usda');
it('imports a mixed batch locally, avoids duplicate IDs and leaves assignments and candidates intact', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); const labels = store.display!.labels;
  const regions = JSON.stringify(store.regions); mocks.request.mockClear();
  const result = await store.importMaterials([await materialFile(), new File(['bad'], 'bad.usda'), await materialFile()]);
  expect(result.imported).toBe(2); expect(result.errors).toHaveLength(1);
  const imported = store.materials.filter(item => item.supplier?.origin === 'local-usda');
  expect(imported.map(item => item.materialId)).toEqual(['CA19017-IMPORT-1', 'CA19017-IMPORT-2']);
  expect(imported[0]!.id).not.toBe(imported[1]!.id);
  expect(JSON.stringify(store.regions)).toBe(regions); expect(store.display!.labels).toBe(labels);
  expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.records.has('supplier-overrides')).toBe(false);
  await store.segment();
  expect(mocks.request.mock.calls.find(([type]) => type === 'palette')![1].cands).toHaveLength(26);
});
it('keeps the library and assignments intact if importing cannot be persisted', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); const before = JSON.stringify(store.materials);
  const regions = JSON.stringify(store.regions); mocks.write.mockRejectedValueOnce(new Error('Quota exceeded'));
  const result = await store.importMaterials([await materialFile()]);
  expect(result).toEqual({ imported: 0, errors: ['Quota exceeded'] });
  expect(JSON.stringify(store.materials)).toBe(before); expect(JSON.stringify(store.regions)).toBe(regions);
});
it('retains imported source data across editing, project reopening and ZIP restoration', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.importMaterials([await materialFile()]);
  const material = store.materials.at(-1)!; const source = JSON.stringify(material.supplier!.source);
  const edited = { ...material, roughness: 0.2 }; expect(await store.saveMaterial(edited)).toBe(true);
  expect(mocks.records.has('supplier-overrides')).toBe(false);
  expect((mocks.records.get('materials') as typeof store.materials).at(-1)!.roughness).toBe(0.2);
  await store.save(); const id = store.project!.id; await store.openProject(id);
  expect(store.selected!.id).toBe(material.id); expect(store.selected!.roughness).toBe(0.2);
  expect(JSON.stringify(store.selected!.supplier!.source)).toBe(source);
  await store.backup(); const blob = mocks.download.mock.calls.at(-1)![0] as Blob;
  store.materials = []; await store.restoreBackup(new File([blob], 'import.tripo.zip'));
  expect(store.failure).toBe(''); expect(store.materials.at(-1)!.id).toBe(material.id);
  expect(JSON.stringify(store.materials.at(-1)!.supplier!.source)).toBe(source);
});

it('deletes local records persistently while retaining applied snapshots and cleaning export selection', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.importMaterials([await materialFile()]);
  const material = store.materials.at(-1)!; store.apply(material); store.checked = [material.id, 'porcelain'];
  const before = JSON.stringify(store.regions); const labels = store.display!.labels; mocks.request.mockClear();
  expect(await store.deleteMaterial(material.id)).toBe(true);
  expect(store.materials.some(item => item.id === material.id)).toBe(false);
  expect((mocks.records.get('materials') as typeof store.materials).some(item => item.id === material.id)).toBe(false);
  expect(store.checked).toEqual(['porcelain']); expect(JSON.stringify(store.regions)).toBe(before);
  expect(store.display!.labels).toBe(labels); expect(mocks.request).not.toHaveBeenCalled();
  await store.save(); await store.openProject(store.project!.id); expect(store.selected!.id).toBe(material.id);
  expect(await store.deleteMaterial('porcelain')).toBe(true);
  expect(await store.deleteMaterial((await supplier()).id)).toBe(false);
  expect(store.allMaterials.some(item => item.materialId === 'CA19017')).toBe(true);
});
it('a failed deletion preserves the local library, selection and validation appearance', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); store.setWorkflow('validation');
  const material = store.materials[0]!; store.apply(material); store.checked = [material.id];
  const before = JSON.stringify(store.materials); mocks.write.mockRejectedValueOnce(new Error('Storage failed'));
  expect(await store.deleteMaterial(material.id)).toBe(false);
  expect(JSON.stringify(store.materials)).toBe(before); expect(store.checked).toEqual([material.id]);
  expect(store.selected!.id).toBe(material.id); expect(store.failure).toBe('Storage failed');
  expect(await store.deleteMaterial(material.id)).toBe(true); expect(store.selected!.id).toBe(material.id);
});


it('starts with an empty local library and keeps supplier SKU matching available', async () => {
  const store = useWorkspace();
  expect(store.materials).toEqual([]); expect(store.allMaterials).toHaveLength(28);
  await store.loadFiles(files()); await store.save(); await store.initialize();
  expect(store.failure).toBe(''); expect(store.materials).toEqual([]);
  expect(store.regions.every(region => region.material.supplier?.vendor === 'Polymaker')).toBe(true);
});
it('removes legacy samples from persisted libraries without deleting user materials or applied snapshots', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  store.apply(store.materials[0]!); await store.save();
  const custom = { ...initialMaterials[0]!, id: 'user-porcelain', materialId: 'USER-PLA' };
  await store.importMaterials([await materialFile()]);
  const imported = structuredClone((mocks.records.get('materials') as typeof store.materials).at(-1)!);
  mocks.records.set('materials', [...structuredClone(initialMaterials), custom, imported]);
  await store.initialize();
  expect(store.failure).toBe(''); expect(store.materials.map(item => item.id)).toEqual([custom.id, imported.id]);
  expect(mocks.records.get('materials')).toEqual([custom, imported]);
  expect(store.selected!.id).toBe('porcelain');
  await store.initialize(); expect(store.materials).toHaveLength(2);
});
it('restores old backups without repopulating the local library with samples', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); store.apply(store.materials[0]!);
  await store.backup(); const blob = mocks.download.mock.calls.at(-1)![0] as Blob;
  await store.restoreBackup(new File([blob], 'legacy.tripo.zip'));
  expect(store.failure).toBe(''); expect(store.materials).toEqual([]);
  expect(mocks.records.get('materials')).toEqual([]); expect(store.selected!.id).toBe('porcelain');
});


it('Print keeps size outside the checklist; explicit multi selection alone enters the existing editor and stays a draft', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  await store.navigatePreparation('print');
  expect(store.preparation.expanded).toBe('check'); expect(store.printColorState).toBe('not-started');
  expect(store.printTasks).toEqual(['check']); expect(store.printSizeReady).toBe(false);
  await store.changePrintMode('multi');
  expect(store.preparation.activeModule).toBe('multi-color'); expect(store.preparation.origin).toBe('print');
  expect(store.printTasks).toEqual(['check', 'color']);
  expect(store.printColorState).toBe('progress');
  await store.navigatePreparation('print');
  expect(store.printColorState).toBe('progress'); expect(store.preparation.expanded).toBe('check');
  await store.savePreparation();
  const id = store.project!.id;
  setActivePinia(createPinia()); const restored = workspaceWithMaterials(); await restored.openProject(id);
  expect(restored.preparation.activeModule).toBe('print'); expect(restored.preparation.mode).toBe('multi');
  expect(restored.printColorState).toBe('progress'); expect(restored.preparation.origin).toBeNull();
});
it('confirmed colors survive no-op editing, independent navigation and scaling; actual assignment changes need review', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.navigatePreparation('print');
  await store.changePrintMode('multi'); await store.completePrintColors();
  expect(store.failure).toBe(''); expect(store.printColorState).toBe('ready'); expect(store.preparation.activeModule).toBe('print');
  expect(store.currentColorResult.used).toHaveLength(1); // The second generated slot is unused.
  await store.navigatePreparation('multi-color', true); await store.navigatePreparation('print');
  expect(store.printColorState).toBe('ready');
  await store.changePrintMode('single'); await store.changePrintMode('multi');
  expect(store.preparation.activeModule).toBe('print'); expect(store.printColorState).toBe('ready');
  store.setPrintDimension('width', 200);
  expect(store.settings.height).toBe(100); expect(store.printDimensions.depth).toBe(300); expect(store.printColorState).toBe('ready');
  await store.navigatePreparation('multi-color'); expect(store.preparation.origin).toBeNull();
  await store.completePrintColors(); expect(store.preparation.activeModule).toBe('multi-color');
  store.apply(store.materials[0]!); expect(store.printColorState).toBe('review');
  await store.navigatePreparation('print'); expect(store.printColorState).toBe('review');
  await store.navigatePreparation('multi-color', true); await store.completePrintColors(); expect(store.printColorState).toBe('ready');
});
it('dimension changes invalidate size and checks, while repeated confirmation preserves the check', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.navigatePreparation('print');
  await store.confirmPrintSize(); await store.acknowledgePrintCheck(); expect(store.printCheckReady).toBe(true); expect(store.printSizeReady).toBe(true);
  const key = store.preparation.checkedKey; await store.confirmPrintSize(); expect(store.preparation.checkedKey).toBe(key);
  store.setPrintDimension('depth', store.printDimensions.depth);
  expect(store.printSizeReady).toBe(true); expect(store.printCheckReady).toBe(true);
  store.setPrintDimension('depth', 300); expect(store.settings.height).toBe(100); expect(store.printSizeReady).toBe(false); expect(store.printCheckReady).toBe(false);
  expect(store.preparation.expanded).toBe('check'); expect(store.preparation.checkedKey).toBeNull();
  await store.confirmPrintSize(); expect(store.printSizeReady).toBe(true); expect(store.printCheckReady).toBe(false);
  expect(store.printTodo).toContain('复核可打印性');
  await store.acknowledgePrintCheck(); expect(store.printCheckReady).toBe(true); expect(store.printTodo).toBe('');
  store.setPrintDimension('height', 500); expect(store.settings.height).toBe(100); expect(store.failure).toContain('10–320');
});
it('checking and exporting require size confirmation first, including after resizing back to the original size', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.navigatePreparation('print');
  await store.acknowledgePrintCheck(); expect(store.failure).toContain('请先确认');
  expect(store.preparation.checkedKey).toBeNull(); expect(store.printCheckReady).toBe(false);
  await store.downloadPreparedModel(); expect(mocks.download).not.toHaveBeenCalled();
  await store.confirmPrintSize(); await store.acknowledgePrintCheck(); expect(store.printTodo).toBe('');
  store.setPrintDimension('height', 40); store.setPrintDimension('height', 80);
  expect(store.printSizeReady).toBe(false); expect(store.printCheckReady).toBe(false);
  await store.confirmPrintSize(); await store.downloadPreparedModel();
  expect(mocks.download).not.toHaveBeenCalled(); expect(store.failure).toContain('复核可打印性');
  await store.acknowledgePrintCheck(); await store.downloadPreparedModel();
  expect(mocks.download.mock.calls.at(-1)![1]).toBe('test.stl');
});
it('reopening a resized project retains the new size and requires a fresh check review', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.navigatePreparation('print');
  await store.confirmPrintSize(); await store.acknowledgePrintCheck();
  store.setPrintDimension('width', 200); await store.confirmPrintSize();
  const id = store.project!.id;
  setActivePinia(createPinia()); const restored = workspaceWithMaterials(); await restored.openProject(id);
  expect(restored.settings.height).toBe(100); expect(restored.printSizeReady).toBe(true);
  expect(restored.printCheckReady).toBe(false); expect(restored.preparation.expanded).toBe('check');
  expect(restored.printTodo).toContain('复核可打印性');
});
it('failed saves cannot confirm colors or enable export, and retry preserves the draft', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.navigatePreparation('print'); await store.changePrintMode('multi');
  mocks.write.mockRejectedValueOnce(new Error('disk full'));
  await store.completePrintColors();
  expect(store.preparation.activeModule).toBe('multi-color'); expect(store.printColorState).toBe('progress'); expect(store.prepSaveError).toBe('disk full');
  expect(store.printTodo).toContain('保存失败');
  const persisted = mocks.records.get(`project:${store.project!.id}`) as { preparation: { confirmedColor: unknown } };
  expect(persisted.preparation.confirmedColor).toBeNull();
  await store.completePrintColors(); expect(store.printColorState).toBe('ready'); expect(store.prepSaveError).toBe('');
});
it('unassigned faces block confirmation and model changes invalidate color mapping', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.navigatePreparation('print'); await store.changePrintMode('multi');
  const previous = store.display!;
  store.display = { ...previous, labels: new Uint8Array([255]) }; await store.completePrintColors();
  expect(store.failure).toContain('未分配有效耗材'); expect(store.preparation.activeModule).toBe('multi-color');
  store.display = previous; await store.completePrintColors(); expect(store.printColorState).toBe('ready');
  store.modelInfo = { ...store.modelInfo!, wpos: new Float32Array([0,0,0,4,1,0,0,0,3]) };
  expect(store.printColorState).toBe('review');
});
it('projects restore their own progress and refresh restores print-origin editing without redirect loops', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.navigatePreparation('print'); await store.changePrintMode('multi');
  await store.changePrintSlicer('OrcaSlicer'); store.setPrintDimension('height', 120); await store.confirmPrintSize();
  const first = store.project!.id; await store.loadFiles(files()); expect(store.project!.id).not.toBe(first);
  expect(store.preparation.sizeConfirmedHeight).toBeNull(); expect(store.preparation.confirmedColor).toBeNull(); expect(store.preparation.mode).toBe('single');
  await store.openProject(first); expect(store.settings.height).toBe(120); expect(store.printSizeReady).toBe(true);
  expect(store.preparation.slicer).toBe('OrcaSlicer'); expect(store.preparation.activeModule).toBe('multi-color'); expect(store.preparation.origin).toBe('print');
  await store.completePrintColors(); await store.savePreparation();
  setActivePinia(createPinia()); const restored = workspaceWithMaterials(); await restored.initialize();
  expect(restored.preparation.activeModule).toBe('print'); expect(restored.printColorState).toBe('ready'); expect(restored.printSizeReady).toBe(true);
});
it('exports latest confirmed scale and materials, gates unverified slicers, and preserves multi data for single STL', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.navigatePreparation('print'); await store.changePrintMode('multi');
  store.apply(store.materials[0]!); await store.completePrintColors(); store.setPrintDimension('height', 160);
  await store.confirmPrintSize(); await store.acknowledgePrintCheck();
  expect(store.printTodo).toBe('');
  await store.downloadPreparedModel();
  expect(mocks.request.mock.calls.findLast(([type]) => type === 'export3mf')![1]).toMatchObject({ scale: 160, filaments: [{ id: store.regions[0]!.material.materialId }, { id: store.regions[1]!.material.materialId }] });
  expect(mocks.download.mock.calls.at(-1)![1]).toBe('test.3mf'); expect(store.prepNotice).toContain('尚未向切片器导入');
  await store.changePrintSlicer('Creality Print'); expect(store.printTodo).toContain('尚未验证'); expect(store.printColorState).toBe('ready');
  const calls = mocks.download.mock.calls.length; await store.downloadPreparedModel(); expect(mocks.download).toHaveBeenCalledTimes(calls);
  await store.changePrintMode('single'); expect(store.printTodo).toBe(''); const confirmation = { ...store.preparation.confirmedColor! };
  await store.downloadPreparedModel(); expect(mocks.download.mock.calls.at(-1)![1]).toBe('test.stl');
  expect(store.preparation.confirmedColor).toEqual(confirmation); expect(store.printColorState).toBe('ready');
});
it('automatically persists real color edits once Print Preparation is engaged', async () => {
  vi.useFakeTimers();
  try {
    const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.navigatePreparation('print'); await store.changePrintMode('multi'); await store.completePrintColors();
    await store.navigatePreparation('multi-color', true); store.apply(store.materials[0]!);
    expect(store.prepDirty).toBe(true); await vi.advanceTimersByTimeAsync(300);
    expect(store.prepDirty).toBe(false);
    const data = mocks.records.get(`project:${store.project!.id}`) as { regions: typeof store.regions };
    expect(data.regions[0]!.material.id).toBe(store.materials[0]!.id); expect(store.printColorState).toBe('review');
  } finally { vi.useRealTimers(); }
});

it('reading accordion summaries does not start a model save or processing overlay', async () => {
  vi.useFakeTimers();
  try {
    const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.navigatePreparation('print');
    mocks.write.mockClear(); store.preparation.expanded = 'check'; await vi.advanceTimersByTimeAsync(300);
    expect(mocks.write).not.toHaveBeenCalled(); expect(store.prepDirty).toBe(false); expect(store.busy).toBe(false);
  } finally { vi.useRealTimers(); }
});
it('returning to Print leaves local material validation and retains the confirmed color plan', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files()); await store.navigatePreparation('print'); await store.changePrintMode('multi');
  store.setWorkflow('validation'); await store.completePrintColors();
  expect(store.printColorState).toBe('ready'); expect(store.settings.workflow).toBe('assignment');
  expect(store.saved).toBe(true);
});

it('adds/selects a plan filament without recoloring, changing the tool or claiming ownership', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  store.settings.tool = 'fill';
  const display = store.display, fingerprint = store.currentColorResult.fingerprint;
  const records = new Map(mocks.records), used = store.currentColorResult.used.length;
  const material = await supplier('CA19017');
  expect(await store.addPlanFilament(material)).toBe(true);
  expect(store.regions).toHaveLength(3); expect(store.selectedRegion).toBe(2);
  expect(store.display).toBe(display); expect(store.undoCount).toBe(0);
  expect(store.currentColorResult.fingerprint).toBe(fingerprint); expect(store.currentColorResult.used).toHaveLength(used);
  expect(store.settings.tool).toBe('fill'); expect(mocks.records).toEqual(records);
  expect(mocks.request).toHaveBeenCalledWith('appendSlot', { expectedCount: 2 });
  mocks.request.mockClear();
  expect(await store.addPlanFilament(material)).toBe(true); expect(store.regions).toHaveLength(3); expect(mocks.request).not.toHaveBeenCalled();
  const sameColor = { ...material, id: 'custom:different', materialId: 'OTHER' };
  expect(await store.addPlanFilament(sameColor)).toBe(true); expect(store.regions).toHaveLength(4);
  await store.save();
  const saved = mocks.records.get('project:' + store.project!.id) as { regions: unknown[] };
  // Project data includes every palette slot, including unused materials.
  expect(saved.regions).toHaveLength(4);
});

it('rejects a failed append without changing the palette or selection, and reuses a slot at the limit', async () => {
  const store = workspaceWithMaterials(); await store.loadFiles(files());
  const selected = store.selectedRegion, material = await supplier('CA19017');
  mocks.request.mockImplementation(type => type === 'appendSlot' ? Promise.reject(new Error('append failed')) : undefined);
  expect(await store.addPlanFilament(material)).toBe(false);
  expect(store.regions).toHaveLength(2); expect(store.selectedRegion).toBe(selected);
  mocks.request.mockReset();
  const original = store.regions[0]!;
  while (store.regions.length < 12) store.regions.push({ ...original, index: store.regions.length });
  expect(await store.addPlanFilament(material)).toBe(false);
  expect(await store.addPlanFilament(original.material)).toBe(true);
  expect(mocks.request).not.toHaveBeenCalled();
});
