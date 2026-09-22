import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Group } from 'three';
import { zipSync, strToU8 } from 'fflate';

const mocks = vi.hoisted(() => ({ records: new Map<string, unknown>(), write: vi.fn(), download: vi.fn(), load: vi.fn(), clients: [] as Array<{ disposed: boolean }> }));
vi.mock('~/@base/storage', () => ({ readRecord: async (key: string) => mocks.records.get(key), writeRecord: mocks.write, downloadFile: mocks.download }));
vi.mock('~/@base/locale', () => ({ useLocale: () => ({ t: (en: string) => en }) }));
vi.mock('~/@feature/materials', async () => ({ ...await import('../app/@feature/materials/catalog'), ...await import('../app/@feature/materials/types') }));
vi.mock('~/@engine/import', () => ({ loadLocalModel: mocks.load }));
vi.mock('~/@engine/model', () => ({ collectModelResources: () => ({}), disposeModelResources: vi.fn() }));
vi.mock('~/@engine/print-mesh', () => ({ toPrintMesh: async () => ({ positions: new Float32Array(9) }), uvHit: vi.fn() }));
vi.mock('~/@engine/multicolor', () => ({ MulticolorClient: class {
  disposed = false;
  constructor() { mocks.clients.push(this); }
  dispose() { this.disposed = true; }
  setRevision() {}
  async request(type: string, payload: unknown) {
    structuredClone(payload);
    if (this.disposed) throw new Error('disposed');
    if (type === 'init') return { bbox: { minY: 0, maxY: 1 }, warnings: [], nf: 1 };
    if (type === 'palette') return { slots: [{ hex: '#FF0000' }, { hex: '#0000FF' }] };
    if (type === 'label' || type === 'restore') return { label: new Uint8Array([0]) };
    if (type === 'export3mf') return { blob: new Blob(['3mf']) };
    if (type === 'snapshot') return { snapshot: { version: 1, labels: [0], slotCount: 2 } };
  }
} }));
const { useWorkspace } = await import('../app/@feature/workspace/use-workspace');

beforeEach(() => {
  setActivePinia(createPinia()); mocks.records.clear(); mocks.clients.length = 0;
  mocks.write.mockReset().mockImplementation(async (key: string, value: unknown) => { mocks.records.set(key, structuredClone(value)); });
  mocks.load.mockReset().mockImplementation(async () => ({ root: new Group(), warnings: [] }));
});
const files = () => [new File(['model'], 'test.glb')];

it('failed replacement keeps the active model and worker usable', async () => {
  const store = useWorkspace(); await store.loadFiles(files()); const id = store.project!.id;
  mocks.load.mockRejectedValueOnce(new Error('Invalid GLB'));
  await store.loadFiles(files()); expect(store.failure).toBe('Invalid GLB');
  expect(store.project!.id).toBe(id); expect(mocks.clients[0]!.disposed).toBe(false);
  await store.save(); expect(mocks.records.get('active-project')).toBe(id);
});
it('failed material writes leave saved catalog and bindings intact', async () => {
  const store = useWorkspace(); await store.loadFiles(files());
  const original = store.regions[0]!.material;
  mocks.write.mockRejectedValueOnce(new Error('Quota exceeded'));
  expect(await store.saveMaterial({ ...store.materials[0]!, roughness: 0.9 })).toBe(false);
  expect(store.materials[0]!.roughness).toBe(0.35); expect(store.regions[0]!.material).toEqual(original);
  expect(store.failure).toBe('Quota exceeded');
});
it('binding and shared material updates preserve region labels and distinct same-color IDs', async () => {
  const store = useWorkspace(); await store.loadFiles(files()); const labels = store.display!.labels;
  const a = { ...store.materials[0]!, id: 'a', materialId: 'A' };
  const b = { ...a, id: 'b', materialId: 'B', metalness: 1 };
  await store.saveMaterial(a); store.selectedRegion = 1; await store.saveMaterial(b);
  expect(store.regions.map(r => r.material.materialId)).toEqual(['A', 'B']);
  await store.saveMaterial({ ...a, transparency: 1 });
  expect(store.regions[0]!.material.transparency).toBe(1); expect(store.regions[1]!.material.metalness).toBe(1);
  expect(store.display!.labels).toBe(labels);
});
it('save and reopen restore the edited settings and active project', async () => {
  const store = useWorkspace(); await store.loadFiles(files()); store.setHeight(123); await store.save();
  const id = store.project!.id;
  await store.loadFiles(files()); expect(mocks.clients[0]!.disposed).toBe(true);
  await store.save(); expect(store.failure).toBe('');
  await store.openProject(id); expect(store.settings.height).toBe(123); expect(store.saved).toBe(true);
  expect(mocks.records.get('active-project')).toBe(id);
  store.setHeight(0); store.setHeight(NaN); expect(store.settings.height).toBe(123);
  store.setHeight(900); expect(store.settings.height).toBe(320);
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
