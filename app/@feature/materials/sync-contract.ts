import type { SiteVendor } from '~/@base/site/config';
import { validateMaterial } from './catalog';
import { cloneMaterial, supplierMaterials, withOverrides } from './supplier';
import type { MaterialRecord } from './types';

export interface MaterialLibrary { materials: MaterialRecord[]; supplierEdits: MaterialRecord[] }
export interface SharedLibrary extends MaterialLibrary { version: 1; vendor: SiteVendor }
export interface LibraryRevision { sha: string; library: SharedLibrary }
export const emptyLibrary = (vendor: SiteVendor): SharedLibrary => ({ version: 1, vendor, materials: [], supplierEdits: [] });
const stableJSON = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const libraryJSON = (value: MaterialLibrary) => stableJSON({ materials: [...value.materials].sort((a, b) => a.id.localeCompare(b.id)), supplierEdits: [...value.supplierEdits].sort((a, b) => a.id.localeCompare(b.id)) });

export function parseLibrary(input: unknown, vendor: SiteVendor): SharedLibrary {
  const value = input as SharedLibrary;
  if (!value || value.version !== 1 || value.vendor !== vendor || !Array.isArray(value.materials) || !Array.isArray(value.supplierEdits) || value.materials.length + value.supplierEdits.length > 500) throw new Error('Invalid material library');
  const ids = new Set<string>();
  const normalize = (material: MaterialRecord, supplier: boolean) => {
    if (validateMaterial(material, []) || ids.has(material.id) || material.id.length > 200 || material.name.length > 500 || material.materialId.length > 200) throw new Error('Invalid material record');
    ids.add(material.id);
    if (supplier) {
      const original = supplierMaterials.find(item => item.id === material.id && item.supplier?.vendor === vendor);
      if (!original || material.supplier?.vendor !== vendor || material.materialId !== original.materialId || (material.appearance && material.appearance.vendor !== vendor)) throw new Error('Invalid supplier identity');
      return withOverrides({ ...cloneMaterial(material), name: original.name, supplier: cloneMaterial(original).supplier });
    }
    if (supplierMaterials.some(item => item.id === material.id) || (material.supplier && material.supplier.origin !== 'local-usda') || (material.appearance && material.appearance.vendor !== vendor)) throw new Error('Invalid local material identity');
    return cloneMaterial(material);
  };
  const result: SharedLibrary = { version: 1, vendor, materials: value.materials.map(item => normalize(item, false)), supplierEdits: value.supplierEdits.map(item => normalize(item, true)) };
  const catalog = [...supplierMaterials, ...result.materials, ...result.supplierEdits];
  for (const material of catalog) if (validateMaterial(material, catalog)) throw new Error('Duplicate or invalid material');
  return result;
}

export function mergeLibraries(base: MaterialLibrary, local: SharedLibrary, remote: SharedLibrary, preferLocal = false): { library: SharedLibrary; conflicts: string[] } {
  const conflicts: string[] = [];
  const merge = (key: keyof MaterialLibrary) => {
    const previous = new Map(base[key].map(item => [item.id, item]));
    const ours = new Map(local[key].map(item => [item.id, item]));
    const theirs = new Map(remote[key].map(item => [item.id, item]));
    return [...new Set([...previous.keys(), ...ours.keys(), ...theirs.keys()])].flatMap(id => {
      const before = previous.get(id); const left = ours.get(id); const right = theirs.get(id);
      const same = (a: unknown, b: unknown) => stableJSON(a) === stableJSON(b);
      const conflict = !same(left, before) && !same(right, before) && !same(left, right);
      if (conflict) conflicts.push(left?.materialId ?? right?.materialId ?? id);
      const value = conflict ? (preferLocal ? left : right) : same(left, before) ? right : left;
      return value ? [cloneMaterial(value)] : [];
    });
  };
  return { library: { version: 1, vendor: local.vendor, materials: merge('materials'), supplierEdits: merge('supplierEdits') }, conflicts };
}
