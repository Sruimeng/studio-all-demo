import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { emptyWheelFilters, filterWheelEntries, layoutWheel, normalizeWheelFilters, wheelColor, wheelColorPreview, wheelCreationContext, wheelCreationOptions, wheelEntries, wheelGrid, wheelLightness, wheelOptions } from '../app/@feature/materials/color-wheel';
import { cloneMaterial, materialHex, supplierCatalogHex, supplierCatalogs, supplierMaterials, withOverrides } from '../app/@feature/materials/supplier';
import { createFilamentColor, filamentPreview, materialSeries } from '../app/@feature/materials/filaments';
import { appearanceTemplates, bindAppearance } from '../app/@feature/materials/binding';
import { validateMaterial } from '../app/@feature/materials/catalog';
import { parseLibrary } from '../app/@feature/materials/sync-contract';
import type { MaterialRecord } from '../app/@feature/materials/types';

const storage = vi.hoisted(() => ({ write: vi.fn(), records: new Map<string, unknown>() }));
vi.mock('~/@base/storage', () => ({ readRecord: async (key: string) => storage.records.get(key), writeRecord: storage.write, writeRecords: vi.fn(), downloadFile: vi.fn() }));
vi.mock('~/@base/locale', () => ({ useLocale: () => ({ t: (en: string) => en }) }));
vi.mock('~/@feature/materials', async () => ({ ...await import('../app/@feature/materials/catalog'), ...await import('../app/@feature/materials/types'), ...await import('../app/@feature/materials/supplier'), ...await import('../app/@feature/materials/usda'), ...await import('../app/@feature/materials/filaments'), ...await import('../app/@feature/materials/use-material-sync'), ...await import('../app/@feature/materials/sync-contract') }));
vi.mock('~/@engine/import', () => ({ loadLocalModel: vi.fn() }));
vi.mock('~/@engine/model', () => ({ collectModelResources: vi.fn(), disposeModelResources: vi.fn() }));
vi.mock('~/@engine/print-mesh', () => ({ toPrintMesh: vi.fn(), uvHit: vi.fn() }));
vi.mock('~/@engine/multicolor', () => ({ MulticolorClient: class {} }));
const { useWorkspace } = await import('../app/@feature/workspace/use-workspace');

const catalog = supplierMaterials.filter(item => item.supplier?.vendor === 'eSUN');
const local = (id: string, hex: string): MaterialRecord => ({ ...filamentPreview('SUNLU', 'PLA', 'sunlu-pla-catalog', 'basic', hex), id, materialId: id, name: id });

describe('color wheel identity and source positions', () => {
  it('keeps canonical source swatches and positions immutable under model overrides', () => {
    const original = supplierMaterials.find(item => item.materialId === 'SUNLU-PLA-MAGENTA')!;
    const before = cloneMaterial(original);
    const adjusted = withOverrides({ ...cloneMaterial(original), hex: '#00FF00' });
    const sourceEntry = wheelEntries([original])[0]!;
    const adjustedEntry = wheelEntries([adjusted])[0]!;
    expect(adjustedEntry.hex).toBe('#D9027D'); expect(adjustedEntry.modelHex).toBe('#00FF00');
    expect(supplierCatalogHex(adjusted)).toBe('#D9027D'); expect(materialHex(adjusted)).toBe('#00FF00');
    expect(layoutWheel([sourceEntry])).toEqual(layoutWheel([adjustedEntry]));
    expect(original).toEqual(before); expect(adjusted.supplier).toEqual(original.supplier);
  });
  it('does not collapse identical HEX records across product series', () => {
    const pair = catalog.flatMap(a => {
      const b = catalog.find(b => a.id !== b.id && a.hex === b.hex && a.appearance?.seriesId !== b.appearance?.seriesId);
      return b ? [[a, b]] : [];
    })[0]!;
    expect(pair).toHaveLength(2);
    const entries = wheelEntries(pair);
    expect(new Set(entries.map(item => item.id)).size).toBe(2);
    expect(new Set(layoutWheel(entries).map(item => item.path)).size).toBe(2);
    for (const entry of entries) expect(filterWheelEntries(entries, { ...emptyWheelFilters(), series: entry.series }).map(item => item.id)).toEqual([entry.id]);
  });
  it('places lighter colors outside darker colors and keeps neutrals inside the wheel', () => {
    expect(wheelColor('#FF0000')).toMatchObject({ hue: 0, family: 'red' });
    expect(wheelColor('#00FF00')).toMatchObject({ hue: 120, family: 'green' });
    expect(wheelColor('#0000FF')).toMatchObject({ hue: 240, family: 'blue' });
    expect(wheelColor('#888888').family).toBe('neutral');
    const entries = wheelEntries([local('dark', '#400000'), local('light', '#FFAAAA'), local('neutral', '#888888')]);
    const layout = layoutWheel(entries);
    expect(layout.find(item => item.id === 'light')!.radius).toBeGreaterThan(layout.find(item => item.id === 'dark')!.radius);
    const neutral = layout.find(item => item.id === 'neutral')!;
    expect(neutral.neutral).toBe(true); expect(neutral.radius).toBeGreaterThan(177.75); expect(neutral.radius).toBeLessThan(454.25);
  });
  it('provides a complete 96 × 16 grid with fixed cell dimensions and quiet empty positions', () => {
    const grid = wheelGrid();
    expect(grid).toHaveLength(1536);
    expect(new Set(grid.map(cell => cell.band)).size).toBe(16);
    expect(new Set(grid.map(cell => cell.sector)).size).toBe(96);
    expect(new Set(grid.map(cell => cell.path)).size).toBe(1536);
    for (const cell of grid) {
      expect(cell.outerRadius - cell.innerRadius).toBe(14);
      expect(cell.endAngle - cell.startAngle).toBeCloseTo(3.3);
      expect(cell.radius).toBe(184.75 + cell.band * 17.5);
      expect(Math.hypot(cell.x - 500, cell.y - 520)).toBeCloseTo(cell.radius);
    }
    for (let band = 0; band < 16; band++) expect(grid.filter(cell => cell.band === band)).toHaveLength(96);
    expect(grid[0]!.innerRadius).toBe(177.75);
    expect(grid[1535]!.outerRadius).toBe(454.25);
  });
  it('uses source perceptual brightness for radius without changing hue or HSL metadata', () => {
    expect(wheelColor('#0000FF')).toMatchObject({ hue: 240, lightness: 0.5 });
    expect(wheelLightness('#000000')).toBe(0); expect(wheelLightness('#FFFFFF')).toBeCloseTo(1);
    expect(wheelLightness('#0000FF')).toBeLessThan(wheelLightness('#00FF00'));
    expect(wheelLightness('#0000FF')).toBeLessThan(wheelLightness('#FFFF00'));
    const slots = layoutWheel(wheelEntries([local('blue', '#0000FF'), local('green', '#00FF00'), local('yellow', '#FFFF00')]));
    expect(slots.find(cell => cell.id === 'blue')!.radius).toBeLessThan(slots.find(cell => cell.id === 'green')!.radius);
    expect(slots.find(cell => cell.id === 'blue')!.radius).toBeLessThan(slots.find(cell => cell.id === 'yellow')!.radius);
  });
  it('distributes pure grays in stable ring cells while tinted neutrals retain their source hue', () => {
    const grays = wheelEntries(Array.from({ length: 20 }, (_, index) => local(`gray-${index}`, '#888888')));
    const slots = layoutWheel(grays);
    expect(slots.every(cell => cell.neutral && cell.radius > 177.75 && cell.radius < 454.25)).toBe(true);
    expect(new Set(slots.map(cell => cell.sector)).size).toBeGreaterThan(1);
    const [tinted] = layoutWheel(wheelEntries([local('tinted', '#A0A5A0')]));
    expect(tinted).toMatchObject({ neutral: true, sector: 32 });
  });
  it('grows grid capacity without dropping or subdividing crowded records', () => {
    const entry = wheelEntries([local('seed', '#527A66')])[0]!;
    const entries = Array.from({ length: 1537 }, (_, index) => ({ ...entry, id: `crowded-${index}` }));
    const grid = wheelGrid(entries.length);
    const slots = layoutWheel(entries, grid);
    expect(grid).toHaveLength(3072); expect(slots).toHaveLength(entries.length);
    expect(new Set(slots.map(cell => cell.id)).size).toBe(entries.length);
    expect(new Set(slots.map(cell => cell.index)).size).toBe(entries.length);
    expect(new Set(slots.map(cell => cell.path)).size).toBe(entries.length);
    expect(new Set(slots.map(cell => `${cell.x.toFixed(5)}:${cell.y.toFixed(5)}`)).size).toBe(entries.length);
    expect(slots.every(cell => cell.outerRadius - cell.innerRadius === 14)).toBe(true);
    const paths = new Set(grid.map(cell => cell.path));
    expect(slots.every(cell => paths.has(cell.path))).toBe(true);
    slots.forEach(cell => expect(cell.endAngle - cell.startAngle).toBeCloseTo(1.65));
  });
  it('allocates every supplied color an individual non-colliding slot deterministically', () => {
    const before = JSON.stringify(supplierMaterials);
    const entries = wheelEntries(supplierMaterials);
    const grid = wheelGrid(entries.filter(entry => entry.hex).length);
    const slots = layoutWheel(entries, grid);
    expect(grid).toHaveLength(1536);
    expect(slots).toHaveLength(729);
    const cells = new Map(grid.map(cell => [cell.index, cell]));
    for (const slot of slots) {
      expect(slot.path).toBe(cells.get(slot.index)!.path);
      expect(slot.outerRadius - slot.innerRadius).toBe(14);
      expect(slot.endAngle - slot.startAngle).toBeCloseTo(3.3);
    }
    expect(new Set(slots.map(item => item.id)).size).toBe(729);
    expect(new Set(slots.map(item => `${item.x.toFixed(5)}:${item.y.toFixed(5)}`)).size).toBe(729);
    expect(new Set(slots.map(item => item.path)).size).toBe(729);
    expect([...slots].sort((a, b) => a.id.localeCompare(b.id))).toEqual(layoutWheel([...entries].reverse()).sort((a, b) => a.id.localeCompare(b.id)));
    expect(JSON.stringify(supplierMaterials)).toBe(before);
  });
});

describe('color wheel filtering and explicit new-color identity', () => {
  it('filters site, manufacturer, base, series, hue and multi-term search independently', () => {
    const entries = wheelEntries(supplierMaterials);
    const selected = catalog.find(item => item.supplier!.materialType === 'ABS')!;
    const entry = entries.find(item => item.id === selected.id)!;
    expect(filterWheelEntries(entries, emptyWheelFilters(), 'SUNLU')).toHaveLength(33);
    expect(filterWheelEntries(entries, { ...emptyWheelFilters(), vendor: 'eSUN' }, 'SUNLU')).toEqual([]);
    expect(filterWheelEntries(entries, { ...emptyWheelFilters(), vendor: 'eSUN' })).toHaveLength(670);
    const filters = { vendor: 'eSUN', base: entry.base, series: entry.series, hue: entry.family, query: `${entry.hex} ${selected.supplier!.colorNameCN}` };
    expect(filterWheelEntries(entries, filters).some(item => item.id === entry.id)).toBe(true);
    expect(filterWheelEntries(entries, { ...filters, query: selected.supplier!.product }).every(item => item.series === entry.series)).toBe(true);
    expect(filterWheelEntries(entries, { ...filters, base: 'PETG' })).toEqual([]);
    expect(filterWheelEntries(entries, { ...emptyWheelFilters(), query: 'nonexistent color xyz' })).toEqual([]);
    const custom = createFilamentColor(local('base', '#112233'), { name: 'Named color', hex: '#123456', colorCode: 'USER-77', source: '' }, 'user');
    expect(filterWheelEntries(wheelEntries([custom]), { ...emptyWheelFilters(), query: 'user-77' })).toHaveLength(1);
  });
  it('derives exact product options and resets incompatible dependent selections', () => {
    const entries = wheelEntries(supplierMaterials);
    const selected = catalog.find(item => item.supplier!.materialType === 'ABS')!;
    const filters = { ...emptyWheelFilters(), vendor: 'eSUN', base: 'ABS', series: selected.appearance!.seriesId! };
    const options = wheelOptions(entries, filters);
    expect(options.series.some(item => item.id === filters.series && item.name === selected.supplier!.product)).toBe(true);
    expect(wheelOptions(entries, { ...filters, base: '' }).bases).toEqual(expect.arrayContaining(['HIPS', 'PEBA', 'TPE', 'PPS', 'PET', 'PETG']));
    expect(normalizeWheelFilters(entries, { ...filters, vendor: 'CAILAB' })).toMatchObject({ base: 'ABS', series: '' });
    expect(normalizeWheelFilters(entries, { ...filters, vendor: 'CAILAB', base: 'PEBA' })).toMatchObject({ base: '', series: '' });
    expect(filterWheelEntries(entries, { ...emptyWheelFilters(), vendor: 'Kexcelled' })).toHaveLength(0);
  });
  it('inherits appearance without leaking the previous vendor, series, source SKU or supplier', () => {
    const source = bindAppearance(catalog[0]!, appearanceTemplates[4]!);
    const before = cloneMaterial(source);
    const preview = wheelColorPreview('SUNLU', 'PLA', 'sunlu-silk', source);
    expect(preview.appearance).toMatchObject({ vendor: 'SUNLU', baseMaterial: 'PLA', seriesId: 'sunlu-silk' });
    expect(preview.appearanceBinding).toEqual(source.appearanceBinding);
    const saved = createFilamentColor(preview, { name: 'Custom test', hex: '#123456', colorCode: '', source: '' }, 'custom-test');
    expect(saved.supplier).toBeUndefined(); expect(saved.appearance!.sku).toBeUndefined();
    expect(saved.appearance!.origin).toBe('user'); expect(validateMaterial(saved, supplierMaterials)).toBeNull();
    expect(source).toEqual(before);
  });
});

describe('manufacturer color creation context', () => {
  it('defaults to PLA and offers all five manufacturers even without color records', () => {
    const filters = emptyWheelFilters();
    expect(wheelCreationContext([], filters)).toMatchObject({ vendor: 'SUNLU', base: 'PLA' });
    expect(wheelCreationOptions([], filters).vendors).toEqual(['SUNLU', 'Polymaker', 'eSUN', 'Kexcelled', 'CAILAB']);
    for (const vendor of wheelCreationOptions([], filters).vendors) {
      const context = wheelCreationContext([], { ...filters, vendor });
      expect(context).toMatchObject({ vendor, base: 'PLA' });
      expect(materialSeries).toContainEqual(expect.objectContaining({ id: context.series, vendor, baseMaterial: 'PLA' }));
      const color = createFilamentColor(wheelColorPreview(context.vendor, context.base, context.series, null), { name: `${vendor} custom`, hex: '#123456', colorCode: '', source: '' }, `new-${vendor}`);
      expect(color.appearance).toMatchObject({ vendor, baseMaterial: 'PLA', seriesId: context.series, origin: 'user' });
      expect(validateMaterial(color, [])).toBeNull();
    }
    expect(filters).toEqual(emptyWheelFilters());
  });
  it('prefills valid filters and replaces series that do not belong to the chosen manufacturer or base', () => {
    const entries = wheelEntries(supplierMaterials);
    const filters = { vendor: 'SUNLU', base: 'PLA', series: 'sunlu-silk' };
    expect(wheelCreationContext(entries, filters)).toEqual(filters);
    const changedVendor = wheelCreationContext(entries, { ...filters, vendor: 'CAILAB' });
    expect(changedVendor).toMatchObject({ vendor: 'CAILAB', base: 'PLA' });
    expect(materialSeries).toContainEqual(expect.objectContaining({ id: changedVendor.series, vendor: 'CAILAB', baseMaterial: 'PLA' }));
    const changedBase = wheelCreationContext(entries, { ...changedVendor, base: 'ABS' });
    expect(changedBase).toEqual({ vendor: 'CAILAB', base: 'ABS', series: 'cailab-abs' });
    expect(wheelCreationContext(entries, { ...changedBase, base: 'PEBA' })).toMatchObject({ vendor: 'CAILAB', base: 'PLA' });
    expect(wheelCreationContext(entries, { vendor: '', base: '', series: 'cailab-abs' })).toEqual(changedBase);
  });
  it('locks each dedicated site to its manufacturer despite foreign filters', () => {
    const entries = wheelEntries(supplierMaterials);
    for (const vendor of ['SUNLU', 'Polymaker', 'eSUN']) {
      const context = wheelCreationContext(entries, { vendor: 'CAILAB', base: 'PLA', series: 'cailab-silk' }, vendor);
      expect(context.vendor).toBe(vendor);
      expect(wheelCreationOptions(entries, context, vendor).vendors).toEqual([vendor]);
      expect(materialSeries).toContainEqual(expect.objectContaining({ id: context.series, vendor, baseMaterial: context.base }));
    }
  });
  it('supports existing manufacturers with independent series without inventing manufacturer identities', () => {
    const custom = filamentPreview('Existing brand', 'PET', undefined, 'basic', '#123456');
    const generic = { ...local('generic', '#123456'), appearance: undefined };
    const entries = wheelEntries([custom, generic]);
    const context = wheelCreationContext(entries, { vendor: 'Existing brand', base: '', series: 'sunlu-silk' });
    expect(context).toEqual({ vendor: 'Existing brand', base: 'PET', series: '' });
    const options = wheelCreationOptions(entries, context);
    expect(options.vendors).toContain('Existing brand'); expect(options.vendors).not.toContain('Generic');
    expect(options.series).toEqual([]);
    const color = createFilamentColor(wheelColorPreview(context.vendor, context.base, context.series, null), { name: 'Independent color', hex: '#123456', colorCode: '', source: '' }, 'independent');
    expect(color.appearance!.seriesId).toBeUndefined(); expect(validateMaterial(color, [])).toBeNull();
  });
  it('retains an explicitly bound appearance across context changes without carrying the old product identity', () => {
    const source = bindAppearance(catalog[0]!, appearanceTemplates[2]!);
    const before = cloneMaterial(source);
    const initial = wheelColorPreview('SUNLU', 'PLA', 'sunlu-silk', source);
    const rebound = bindAppearance(initial, appearanceTemplates[4]!);
    const next = wheelColorPreview('Kexcelled', 'ABS', 'kexcelled-abs-transparent', rebound);
    const color = createFilamentColor(next, { name: 'Typed name', hex: '#AABBCC', colorCode: 'MY-COLOR', source: 'My chart' }, 'switched');
    expect(color.appearance).toMatchObject({ vendor: 'Kexcelled', baseMaterial: 'ABS', seriesId: 'kexcelled-abs-transparent', origin: 'user', colorCode: 'MY-COLOR', source: 'My chart' });
    const expected = cloneMaterial(rebound);
    expect(color).toMatchObject({ name: 'Typed name', hex: '#AABBCC', appearanceBinding: expected.appearanceBinding, optics: expected.optics });
    expect(color.supplier).toBeUndefined(); expect(color.appearance!.sku).toBeUndefined();
    expect(validateMaterial(color, [])).toBeNull(); expect(source).toEqual(before);
  });
});

describe('generated eSUN reference catalog', () => {
  it('imports all product relationships with attribution and no inferred SKU, finish, Lab or OpenPBR', () => {
    const records = supplierCatalogs.find(item => item.vendor === 'eSUN')!.records;
    expect(records).toHaveLength(670);
    expect(new Set(records.map(item => item.product)).size).toBe(65);
    expect(materialSeries.filter(item => item.id.startsWith('esun-color-'))).toHaveLength(65);
    expect(catalog.every(item => item.appearance?.origin === 'catalog' && !item.appearance.templateId)).toBe(true);
    for (const record of records) {
      expect(record.catalogId).toMatch(/^color-[a-f0-9]{12}-[a-f0-9]{20}$/);
      expect(record.catalogHex).toMatch(/^#[A-F0-9]{6}$/);
      expect(record).toMatchObject({ sku: '', d65Lab: null, status: 'color-only', issues: ['sku-not-provided', 'openpbr-missing'] });
      expect(record.source).toMatchObject({ spreadsheet: '产品颜色管理.html', row: null, file: null, parameters: {}, materialUSDA: null });
      expect(record.source.sha256).toMatch(/^[a-f0-9]{64}$/);
      const material = catalog.find(item => item.supplier!.catalogId === record.catalogId)!;
      expect(material.appearance!.source).toBe('用户提供色表 · 未经实物校准');
      expect(materialSeries.find(item => item.id === material.appearance!.seriesId)).toMatchObject({ name: record.product, source: '', sourceLabel: '用户提供色表 · 未经实物校准' });
      expect(validateMaterial(material, supplierMaterials)).toBeNull();
    }
    const untranslated = records.filter(item => item.colorNameEN === '');
    expect(untranslated).toHaveLength(13);
    expect(untranslated.every(item => item.product.trim() && item.colorNameCN.trim())).toBe(true);
    expect(new Set(records.map(item => item.source.sha256)).size).toBe(1);
    expect(records.filter(item => item.product === 'rPETG').every(item => item.materialType === 'PETG')).toBe(true);
  });
  it('naturally validates eSUN supplier overrides against the new canonical source', () => {
    const source = catalog[0]!;
    const edit = withOverrides({ ...cloneMaterial(source), hex: '#123456' });
    edit.supplier!.catalogHex = '#000000';
    const parsed = parseLibrary({ version: 1, vendor: 'eSUN', materials: [], supplierEdits: [edit] }, 'eSUN');
    expect(parsed.supplierEdits[0]!.supplier).toEqual(source.supplier);
    expect(parsed.supplierEdits[0]!.overrides!.hex).toBe('#123456');
  });
});

describe('wheel library-only save boundary', () => {
  beforeEach(() => {
    setActivePinia(createPinia()); storage.records.clear();
    storage.write.mockReset().mockImplementation(async (key: string, value: unknown) => storage.records.set(key, structuredClone(value)));
  });
  it('persists overrides but keeps matching region, validation and label snapshots unchanged until explicit apply', async () => {
    const store = useWorkspace();
    const source = cloneMaterial(catalog[0]!);
    store.regions = [{ index: 0, sourceHex: '#ABCDEF', material: cloneMaterial(source) }];
    store.validationMaterial = cloneMaterial(source);
    const labels = new Uint8Array([0]);
    store.display = { positions: new Float32Array(9), labels };
    const regionsBefore = JSON.stringify(store.regions), validationBefore = JSON.stringify(store.validationMaterial);
    const edit = withOverrides({ ...source, hex: '#123456' });
    expect(await store.saveMaterial(edit, false, false)).toBe(true);
    expect(JSON.stringify(store.regions)).toBe(regionsBefore);
    expect(JSON.stringify(store.validationMaterial)).toBe(validationBefore);
    expect(store.display.labels).toBe(labels);
    expect(store.allMaterials.find(item => item.id === source.id)!.hex).toBe('#123456');
    store.setWorkflow('assignment'); store.apply(edit);
    expect(store.regions[0]!.material.hex).toBe('#123456'); expect(store.display.labels).toBe(labels);
  });
  it('retains a custom color through persistence and exposes a failed write without changing any model snapshot', async () => {
    const store = useWorkspace();
    const color = createFilamentColor(wheelColorPreview('SUNLU', 'PLA', 'sunlu-pla-catalog', null), { name: 'Custom saved color', hex: '#123456', colorCode: '', source: '' }, 'persisted');
    expect(await store.saveMaterial(color, false, false)).toBe(true);
    expect(storage.records.get('materials')).toEqual([color]);
    const reloaded = useWorkspace(createPinia());
    reloaded.materials = structuredClone(storage.records.get('materials')) as MaterialRecord[];
    expect(filterWheelEntries(wheelEntries(reloaded.allMaterials), { ...emptyWheelFilters(), query: 'Custom saved color' })).toHaveLength(1);
    const before = JSON.stringify(store.regions);
    storage.write.mockRejectedValueOnce(new Error('Storage failed'));
    expect(await store.saveMaterial({ ...color, hex: '#FEDCBA' }, false, false)).toBe(false);
    expect(store.failure).toBe('Storage failed'); expect(JSON.stringify(store.regions)).toBe(before);
    expect(store.materials[0]!.hex).toBe('#123456');
  });
});
