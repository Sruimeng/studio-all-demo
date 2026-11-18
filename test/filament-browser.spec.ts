import { expect, it } from 'vitest';
import { browseFilaments, changeFilamentFilter, emptyFilamentFilters, filamentColorsFor, filamentFilterOptions, filamentFinish, filamentGroupKey, groupFilaments } from '../app/@feature/materials/filament-browser';
import { customFilament } from '../app/@feature/materials/filaments';
import { supplierMaterials } from '../app/@feature/materials/supplier';
import { validateMaterial } from '../app/@feature/materials/catalog';

function filament(brand: string, materialType: string, series: string, hex: string) {
  return { ...customFilament(`${brand} ${hex}`, materialType, hex), filament: { brand, materialType, series } };
}
const a = filament('Alpha', 'PLA', 'PLA Matte', '#FF0000');
const b = filament('Alpha', 'PETG', 'PETG Glossy', '#0000FF');
const c = filament('Beta', 'ABS', 'ABS Silk', '#EF1010');
const catalog = [a, b, c];

it('combines text, attribute filters and perceptual color ranking without losing distinct products', () => {
  const filters = { ...emptyFilamentFilters(), brand: 'Alpha' };
  expect(browseFilaments(catalog, 'PLA', filters)).toEqual([a]);
  expect(browseFilaments(catalog, '#FF0000', emptyFilamentFilters())).toEqual([a, c, b]);
  expect(browseFilaments(catalog, '#FF0000', filters)).toEqual([a, b]);
  expect(browseFilaments(catalog, 'red', emptyFilamentFilters())[0]).not.toBe(b);
  const duplicateColor = filament('Gamma', 'PLA', 'PLA Matte', '#FF0000');
  expect(browseFilaments([a, duplicateColor], '#FF0000', emptyFilamentFilters())).toHaveLength(2);
});

it('does not interpret an exact six-character SKU as a color search', () => {
  const sku = { ...a, materialId: 'ABC123' };
  expect(browseFilaments([sku, b], 'ABC123', emptyFilamentFilters())).toEqual([sku]);
});

it('allows changing brands after choosing a series and clears incompatible dependent filters', () => {
  const filters = changeFilamentFilter(catalog, emptyFilamentFilters(), 'series', 'PLA Matte');
  expect(filters).toEqual({ brand: 'Alpha', material: 'PLA', finish: 'matte', series: 'PLA Matte' });
  expect(filamentFilterOptions(catalog, filters, 'brand')).toEqual(['Alpha', 'Beta']);
  expect(filamentFilterOptions(catalog, filters, 'material')).toEqual(['PETG', 'PLA']);
  expect(changeFilamentFilter(catalog, filters, 'brand', 'Beta')).toEqual({ brand: 'Beta', material: '', finish: '', series: '' });
  expect(filters.series).toBe('PLA Matte');
});

it('retains compatible choices and works when the first selection is a finish', () => {
  let filters = changeFilamentFilter(catalog, emptyFilamentFilters(), 'finish', 'glossy');
  expect(browseFilaments(catalog, '', filters)).toEqual([b]);
  filters = changeFilamentFilter(catalog, filters, 'brand', 'Alpha');
  expect(filters.finish).toBe('glossy');
  filters = changeFilamentFilter(catalog, filters, 'material', 'PLA');
  expect(filters).toEqual({ brand: 'Alpha', material: 'PLA', finish: '', series: '' });
});

it('uses explicit or named finishes but does not invent a finish from render roughness', () => {
  expect(filamentFinish(a)).toBe('matte');
  expect(filamentFinish({ ...b, filament: { ...b.filament, finish: 'Satin' } })).toBe('satin');
  expect(filamentFinish(supplierMaterials[0]!)).toBe('unspecified');
  expect(filamentFinish({ ...supplierMaterials[0]!, roughness: .99 })).toBe('unspecified');
});

it('rejects non-text finish metadata imported into the catalog', () => {
  expect(validateMaterial({ ...a, filament: { ...a.filament, finish: 42 as unknown as string } }, [])).not.toBeNull();
  const material = supplierMaterials[0]!;
  expect(validateMaterial({ ...material, supplier: { ...material.supplier!, finish: {} as string } }, [])).not.toBeNull();
});

it('groups same-series colors while retaining separate SKUs and disambiguating different series', () => {
  const blue = filament('Alpha', 'PLA', 'PLA Matte', '#0000FF');
  const sameColor = filament('Alpha', 'PLA', 'PLA Matte', '#FF0000');
  const otherSeries = filament('Alpha', 'PLA', 'Premium PLA Matte', '#FF0000');
  const glossy = { ...blue, id: 'glossy', filament: { ...blue.filament, finish: 'Glossy' } };
  const groups = groupFilaments([a, blue, sameColor, otherSeries, glossy]);
  expect(groups).toHaveLength(3);
  expect(groups[0]!.materials).toEqual([a, blue, sameColor]);
  expect(groups[0]!.showSeries).toBe(true);
  expect(groups[1]!.showSeries).toBe(true);
  expect(groups[2]!.showSeries).toBe(false);
  expect(groupFilaments([a, blue, sameColor])[0]!.showSeries).toBe(false);
  expect(catalog.filter(item => filamentGroupKey(item) === filamentGroupKey(a))).toEqual([a]);
});

it('groups custom colors by material and removes empty groups as ownership changes', () => {
  const red = customFilament('My red', 'PLA', '#FF0000');
  const blue = customFilament('My blue', 'PLA', '#0000FF');
  const petg = customFilament('My PETG', 'PETG', '#0000FF');
  const groups = groupFilaments([red, blue, petg, a, red]);
  expect(groups).toHaveLength(3);
  expect(groups[0]).toMatchObject({ custom: true, material: 'PLA', materials: [red, blue], showSeries: false });
  expect(groupFilaments([red, petg, a])[0]!.id).toBe(groups[0]!.id);
  expect(groupFilaments([petg, a]).some(group => group.id === groups[0]!.id)).toBe(false);
});

it('waits for brand and material before showing every matching series and finish', () => {
  const glossy = filament('Alpha', 'PLA', 'Premium PLA Glossy', '#0000FF');
  const otherBrand = filament('Beta', 'PLA', 'PLA Matte', '#FF0000');
  const items = [...catalog, glossy, otherBrand];
  expect(filamentColorsFor(items, '', '')).toEqual([]);
  expect(filamentColorsFor(items, 'Alpha', '')).toEqual([]);
  expect(filamentColorsFor(items, '', 'PLA')).toEqual([]);
  expect(filamentColorsFor(items, 'Alpha', 'PLA')).toEqual(expect.arrayContaining([a, glossy]));
  expect(filamentColorsFor(items, 'Alpha', 'PLA')).toHaveLength(2);
  expect(filamentColorsFor(items, 'Alpha', 'PETG')).toEqual([b]);
  expect(filamentColorsFor(items, 'Alpha', 'PLA', glossy.materialId)).toEqual([glossy]);
});

it('browses both reference catalogs with exact colors, searchable metadata and no invented finishes', () => {
  const sunlu = filamentColorsFor(supplierMaterials, 'SUNLU', 'PLA');
  const polymaker = filamentColorsFor(supplierMaterials, 'Polymaker', 'PLA');
  expect(sunlu).toHaveLength(33);
  expect(polymaker).toHaveLength(26);
  expect(new Set([...sunlu, ...polymaker].map(material => material.id)).size).toBe(59);
  expect(filamentFilterOptions(supplierMaterials, emptyFilamentFilters(), 'brand')).toEqual(['Polymaker', 'SUNLU']);
  for (const material of sunlu) {
    expect(validateMaterial(material, supplierMaterials)).toBeNull();
    expect(filamentFinish(material)).toBe('unspecified');
  }
  const red = sunlu.find(material => material.materialId === 'PLA-RED')!;
  expect(red.hex).toBe('#BC2726');
  for (const query of ['sunlu PLA red', '三绿 红色', 'PLA-RED']) {
    expect(browseFilaments(supplierMaterials, query, emptyFilamentFilters())).toContain(red);
  }
  expect(browseFilaments(supplierMaterials, 'PLA-RED', emptyFilamentFilters())).toEqual([red]);
  expect(browseFilaments(supplierMaterials, 'Panchroma PLA', emptyFilamentFilters())).toHaveLength(26);
  expect(browseFilaments(supplierMaterials, '#BC2726', emptyFilamentFilters())[0]).toBe(red);
  expect(browseFilaments(supplierMaterials, 'no-such-color', emptyFilamentFilters())).toEqual([]);
  expect(browseFilaments(supplierMaterials, 'CA19001', { ...emptyFilamentFilters(), brand: 'SUNLU' })).toEqual([]);
});
