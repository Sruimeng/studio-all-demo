import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSite } from '../app/@base/site/config';

const mocks = vi.hoisted(() => ({ request: vi.fn(), records: new Map<string, unknown>() }));
vi.mock('~/@base/locale', () => ({ useLocale: () => ({ t: (en: string) => en }) }));
vi.mock('~/@base/storage', () => ({ readRecord: async (key: string) => mocks.records.get(key), writeRecord: async (key: string, value: unknown) => mocks.records.set(key, structuredClone(value)), downloadFile: vi.fn() }));
vi.mock('~/@engine/import', () => ({ loadLocalModel: async () => ({ root: {}, warnings: [] }) }));
vi.mock('~/@engine/model', () => ({ collectModelResources: vi.fn(), disposeModelResources: vi.fn() }));
vi.mock('~/@engine/print-mesh', () => ({ toPrintMesh: async () => ({ positions: new Float32Array(9) }), uvHit: vi.fn() }));
vi.mock('~/@engine/multicolor', () => ({ MulticolorClient: class {
  dispose() {}
  setRevision() {}
  async request(type: string, payload: unknown) {
    mocks.request(type, payload);
    if (type === 'init') return { bbox: { minY: 0, maxY: 1 }, warnings: [], nf: 1 };
    if (type === 'palette') return { slots: (payload as { cands: Array<{ id: string; hex: string }> }).cands.slice(0, 2).map(item => ({ filamentId: item.id, hex: item.hex, w: 0.5, de: 0 })) };
    return { label: new Uint8Array([0]) };
  }
} }));

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); mocks.request.mockClear(); mocks.records.clear(); });

describe('vendor sites', () => {
  it('rejects an unknown vendor and keeps the combined site storage unchanged', () => {
    expect(() => createSite('unknown')).toThrow('Unsupported site vendor');
    expect(createSite().database).toBe('tripo-material-studio');
    expect(new Set([createSite().database, createSite('SUNLU').database, createSite('Polymaker').database]).size).toBe(3);
  });

  it.each([
    ['SUNLU', 33, 33, 'SUNLU-PLA-WHITE'],
    ['Polymaker', 28, 26, 'CA19017'],
    ['', 61, 59, 'CA19017'],
  ] as const)('scopes %s catalogs, series, initial material and worker palette together', async (vendor, records, candidates, materialId) => {
    vi.resetModules(); vi.stubEnv('VITE_MATERIAL_VENDOR', vendor);
    vi.doMock('~/@feature/materials', async () => ({ ...await import('../app/@feature/materials/catalog'), ...await import('../app/@feature/materials/types'), ...await import('../app/@feature/materials/supplier'), ...await import('../app/@feature/materials/usda'), ...await import('../app/@feature/materials/filaments') }));
    const { supplierMaterials } = await import('../app/@feature/materials/supplier');
    const { filamentVendors, materialSeries, materialTemplates } = await import('../app/@feature/materials/filaments');
    expect(supplierMaterials).toHaveLength(records);
    expect(materialTemplates).toHaveLength(5);
    if (vendor) {
      expect(filamentVendors).toEqual([vendor]);
      expect(materialSeries.every(item => item.vendor === vendor)).toBe(true);
      expect(supplierMaterials.every(item => item.supplier?.vendor === vendor)).toBe(true);
    } else expect(filamentVendors).toHaveLength(5);
    const { createPinia, setActivePinia } = await import('pinia');
    setActivePinia(createPinia());
    const { useWorkspace } = await import('../app/@feature/workspace/use-workspace');
    const store = useWorkspace();
    expect(store.validationMaterial?.materialId).toBe(materialId);
    expect(store.allMaterials).toHaveLength(records);
    await store.loadFiles([new File(['model'], 'test.glb')]);
    const palette = mocks.request.mock.calls.find(([type]) => type === 'palette')![1] as { cands: Array<{ id: string }> };
    expect(palette.cands).toHaveLength(candidates);
    if (vendor) expect(palette.cands.every(item => item.id.startsWith(`${vendor.toLowerCase()}:`))).toBe(true);
    expect(store.failure).toBe('');
    const fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['sample']) });
    vi.stubGlobal('fetch', fetch);
    await store.initialize();
    expect(fetch).toHaveBeenCalledWith(vendor ? '/samples/material-check.glb' : '/samples/atelier.glb');
    expect(store.settings.workflow).toBe(vendor ? 'validation' : 'assignment');
    expect(store.failure).toBe('');
    if (vendor) {
      const material = structuredClone(supplierMaterials.find(item => item.materialId === materialId)!);
      material.hex = '#123456';
      expect(await store.saveMaterial(material)).toBe(true);
      expect(Object.keys(mocks.records.get('supplier-overrides') as object)).toEqual([vendor]);
      expect(store.validationSurface?.hex).toBe('#123456');
      expect(store.validationMaterial?.supplier?.catalogHex).not.toBe('#123456');
    }
  });
});
