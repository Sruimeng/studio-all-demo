import { expect, it } from 'vitest';
import { colorQuery, customFilament, filamentDescription, searchFilaments } from '../app/@feature/materials/filaments';
import { supplierMaterials } from '../app/@feature/materials/supplier';
import { validateMaterial } from '../app/@feature/materials/catalog';

it('finds filaments across brand, series, material, localized names and partial SKU', () => {
  const white = supplierMaterials.find(material => material.materialId === 'CA19001')!;
  for (const query of ['polymaker Panchroma PLA White', '暖白', 'ca19001', '19001', 'PLA Polymaker']) expect(searchFilaments(supplierMaterials, query)).toContain(white);
  expect(searchFilaments(supplierMaterials, 'unknown brand')).toEqual([]);
  expect(searchFilaments(supplierMaterials, '')).toHaveLength(26);
  expect(filamentDescription(white)).toBe('Panchroma™ PLA');
});

it('normalizes HEX and RGB while excluding invalid and unmatched records', () => {
  const white = supplierMaterials.find(material => material.materialId === 'CA19001')!;
  for (const query of ['#f9fbfa', 'F9FBFA', 'rgb(249, 251, 250)', '249,251,250']) expect(searchFilaments(supplierMaterials, query)).toContain(white);
  expect(colorQuery('#abc')).toBe('#AABBCC');
  expect(colorQuery('ABC')).toBeNull();
  expect(colorQuery('rgb(300,0,0)')).toBeNull();
  expect(searchFilaments(supplierMaterials, 'CA19010')).toEqual([]);
});

it('keeps custom materials distinct and preserves the chosen name, material and color', () => {
  const first = customFilament(' My blue ', 'PETG', '#1729ab'), second = customFilament('My blue', 'PETG', '#1729ab');
  expect(validateMaterial(first, [])).toBeNull();
  expect(first.id).not.toBe(second.id);
  expect(first).toMatchObject({ name: 'My blue', filament: { materialType: 'PETG' }, hex: '#1729AB' });
  expect(searchFilaments([first, second], 'petg blue')).toEqual([first, second]);
});

it('keeps a six-character SKU searchable even when it also looks like a HEX code', () => {
  const material = { ...customFilament('Red', 'ABS', '#BC2726'), materialId: 'ABC123' };
  expect(searchFilaments([material], 'ABC123')).toEqual([material]);
  expect(searchFilaments([material], 'ABS')).toEqual([material]);
});

it('ranks similar filaments by perceived color, using ownership only for ties', async () => {
  const { similarFilaments } = await import('../app/@feature/materials/filaments');
  const exact = customFilament('Exact', 'PLA', '#00FF00');
  const same = customFilament('Owned exact', 'PLA', '#00FF00');
  const close = customFilament('Close', 'PLA', '#10F810');
  const far = customFilament('Far owned', 'PLA', '#FF0000');
  expect(similarFilaments([far, close, exact, same], '#00ff00', [far.id, same.id])).toEqual([same, exact, close, far]);
  expect(similarFilaments([exact], 'invalid')).toEqual([]);
});
