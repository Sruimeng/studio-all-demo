import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Group } from 'three';
import { unzipSync, strFromU8, zipSync, strToU8 } from 'fflate';

const mocks = vi.hoisted(() => ({ records: new Map<string, unknown>(), write: vi.fn(), download: vi.fn(), load: vi.fn(), request: vi.fn(), clients: [] as Array<{ disposed: boolean }> }));
vi.mock('~/@base/storage', () => ({ readRecord: async (key: string) => mocks.records.get(key), writeRecord: mocks.write, downloadFile: mocks.download }));
vi.mock('~/@base/locale', () => ({ useLocale: () => ({ t: (en: string) => en }) }));
vi.mock('~/@feature/materials', async () => ({ ...await import('../app/@feature/materials/catalog'), ...await import('../app/@feature/materials/types'), ...await import('../app/@feature/materials/supplier') }));
vi.mock('~/@engine/import', () => ({ loadLocalModel: mocks.load }));
vi.mock('~/@engine/model', () => ({ collectModelResources: () => ({}), disposeModelResources: vi.fn() }));
vi.mock('~/@engine/print-mesh', () => ({ toPrintMesh: async () => ({ positions: new Float32Array(9) }), uvHit: vi.fn() }));
vi.mock('~/@engine/multicolor', () => ({ MulticolorClient: class {
  disposed = false;
  constructor() { mocks.clients.push(this); }
  dispose() { this.disposed = true; }
  setRevision() {}
  async request(type: string, payload: unknown) {
    mocks.request(type, payload);
    structuredClone(payload);
    if (this.disposed) throw new Error('disposed');
    if (type === 'init') return { bbox: { minY: 0, maxY: 1 }, warnings: [], nf: 1 };
    if (type === 'palette') {
      const candidates = (payload as { cands?: Array<{ id: string; hex: string }> }).cands ?? [];
      return { slots: candidates.slice(0, 2).map((candidate, index) => ({ hex: candidate.hex, sourceHex: index ? '#0000FF' : '#FF0000', filamentId: candidate.id, w: 0.5, de: index + 0.25 })) };
    }
    if (type === 'label' || type === 'restore') return { label: new Uint8Array([0]) };
    if (type === 'export3mf') return { blob: new Blob(['3mf']) };
    if (type === 'snapshot') return { snapshot: { version: 1, labels: [0], slotCount: 2 } };
  }
} }));
const { useWorkspace } = await import('../app/@feature/workspace/use-workspace');

beforeEach(() => {
  setActivePinia(createPinia()); mocks.records.clear(); mocks.clients.length = 0;
  mocks.request.mockClear(); mocks.download.mockClear();
  mocks.write.mockReset().mockImplementation(async (key: string, value: unknown) => { mocks.records.set(key, structuredClone(value)); });
  mocks.load.mockReset().mockImplementation(async () => ({ root: new Group(), warnings: [] }));
});
const files = () => [new File(['model'], 'test.glb')];
const supplier = async (sku = 'CA19017') => {
  const { supplierMaterials, cloneMaterial } = await import('../app/@feature/materials/supplier');
  return cloneMaterial(supplierMaterials.find(material => material.materialId === sku)!);
};

it('failed replacement keeps the active model and worker usable', async () => {
  const store = useWorkspace(); await store.loadFiles(files()); const id = store.project!.id;
  mocks.load.mockRejectedValueOnce(new Error('Invalid GLB'));
  await store.loadFiles(files()); expect(store.failure).toBe('Invalid GLB');
  expect(store.project!.id).toBe(id); expect(mocks.clients[0]!.disposed).toBe(false);
  await store.save(); expect(mocks.records.get('active-project')).toBe(id);
});
it('loads and regenerates regions with supplier SKU matches and keeps source colors for labels', async () => {
  const store = useWorkspace(); await store.loadFiles(files());
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
  const store = useWorkspace(); await store.loadFiles(files());
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
  const store = useWorkspace(); await store.loadFiles(files());
  const original = store.regions[0]!.material;
  mocks.write.mockRejectedValueOnce(new Error('Quota exceeded'));
  expect(await store.saveMaterial({ ...store.materials[0]!, roughness: 0.9 })).toBe(false);
  expect(store.materials[0]!.roughness).toBe(0.35); expect(store.regions[0]!.material).toEqual(original);
  expect(store.regions[0]!.match!.meanDeltaE).toBe(0.25);
  expect(store.failure).toBe('Quota exceeded');
});
it('binding and shared material updates preserve region labels and distinct same-color IDs', async () => {
  const store = useWorkspace(); await store.loadFiles(files()); const labels = store.display!.labels;
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
  const store = useWorkspace(); await store.loadFiles(files()); store.setHeight(123); await store.save();
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
  const store = useWorkspace(); await store.loadFiles(files());
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
  const store = useWorkspace(); await store.loadFiles(files()); await store.save();
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
  const store = useWorkspace(); await store.loadFiles(files()); store.apply(store.materials[0]!);
  await store.export3mf(); expect(store.failure).toBe(''); expect(mocks.download).toHaveBeenCalled();
});

it('validation and region assignment change appearance without requesting new labels', async () => {
  const store = useWorkspace(); await store.loadFiles(files()); const labels = store.display!.labels;
  mocks.request.mockClear();
  store.setWorkflow('validation'); store.apply(await supplier());
  expect(store.selected!.materialId).toBe('CA19017'); expect(store.settings.layers).toBe(false);
  expect(store.validationSurface!.renderRule).toBe('openpbr-subset-v1');
  expect(store.display!.labels).toBe(labels); expect(mocks.request).not.toHaveBeenCalled();
  await store.export3mf(); expect(store.failure).toContain('Switch to region');
  store.setWorkflow('assignment'); store.apply(await supplier());
  expect(store.regions[0]!.material.materialId).toBe('CA19017'); expect(store.display!.labels).toBe(labels);
});

it('supplier overrides use separate storage and survive project save and reopen', async () => {
  const store = useWorkspace(); await store.loadFiles(files()); store.setWorkflow('validation');
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
  const store = useWorkspace(); await store.loadFiles(files()); await store.save();
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
  const store = useWorkspace(); await store.loadFiles(files()); const material = await supplier(); store.apply(material);
  mocks.write.mockRejectedValueOnce(new Error('Quota exceeded')); material.roughness = 0.1;
  expect(await store.saveMaterial(material)).toBe(false);
  expect(store.selected!.roughness).toBe(0.45);
  expect(store.allMaterials.find(item => item.id === material.id)!.roughness).toBe(0.45);
});

it('exports actual supplier material type, brand and revision and blocks unmatched SKU assignment', async () => {
  const store = useWorkspace(); await store.loadFiles(files()); const material = await supplier();
  material.supplier!.materialType = 'PETG'; store.apply(material);
  await store.export3mf();
  const call = mocks.request.mock.calls.find(([type]) => type === 'export3mf')!;
  expect(call[1].filaments[0]).toMatchObject({ id: 'CA19017', type: 'PETG', vendor: 'Polymaker', materialVersion: material.supplier!.source.sha256 });
  store.apply(await supplier('CA19010')); expect(store.failure).toContain('未对应');
  expect(store.selected!.materialId).toBe('CA19017');
});
