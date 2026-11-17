import { Color } from 'three';
import { colorQuery, filamentBrand, filamentSeries, filamentType, searchFilaments, similarFilaments } from './filaments';
import { materialHex } from './supplier';
import type { MaterialRecord } from './types';

export const filterKeys = ['brand', 'material', 'finish', 'series'] as const;
export type FilamentFilterKey = typeof filterKeys[number];
export type FilamentFilters = Record<FilamentFilterKey, string>;
export const emptyFilamentFilters = (): FilamentFilters => ({ brand: '', material: '', finish: '', series: '' });
export const unspecifiedFinish = 'unspecified';

export function filamentFinish(material: MaterialRecord): string {
  const explicit = material.supplier?.finish || material.filament?.finish;
  const text = explicit || filamentSeries(material);
  for (const [finish, pattern] of [
    ['matte', /\bmatte?\b|哑光|磨砂/i], ['silk', /\bsilk\b|丝绸/i],
    ['glossy', /\bgloss(?:y)?\b|亮光|高光/i], ['satin', /\bsatin\b|缎面/i],
    ['metallic', /\bmetallic\b|金属光泽/i],
  ] as const) if (pattern.test(text)) return finish;
  // Rendering roughness is not a reliable supplier finish label.
  return explicit || unspecifiedFinish;
}

export function filamentAttribute(material: MaterialRecord, key: FilamentFilterKey): string {
  return { brand: filamentBrand, material: filamentType, finish: filamentFinish, series: filamentSeries }[key](material);
}

const isCustomGroup = (material: MaterialRecord) => !material.supplier && !!material.filament && !filamentBrand(material) && !filamentSeries(material);

export function filamentGroupKey(material: MaterialRecord): string {
  return JSON.stringify(isCustomGroup(material)
    ? ['custom', filamentType(material)]
    : ['catalog', filamentBrand(material), filamentType(material), filamentFinish(material), filamentSeries(material)]);
}

export interface FilamentGroup {
  id: string;
  brand: string;
  material: string;
  finish: string;
  series: string;
  custom: boolean;
  showSeries: boolean;
  materials: MaterialRecord[];
}

/** Group owned records without merging distinct SKUs that happen to share a color. */
export function groupFilaments(materials: MaterialRecord[]): FilamentGroup[] {
  const groups = new Map<string, FilamentGroup>();
  for (const material of materials) {
    const id = filamentGroupKey(material);
    let group = groups.get(id);
    if (!group) {
      group = { id, brand: filamentBrand(material), material: filamentType(material), finish: filamentFinish(material), series: filamentSeries(material), custom: isCustomGroup(material), showSeries: false, materials: [] };
      groups.set(id, group);
    }
    if (!group.materials.some(item => item.id === material.id)) group.materials.push(material);
  }
  const result = [...groups.values()];
  for (const group of result) group.showSeries = !group.custom && result.some(other => other.id !== group.id && !other.custom && other.brand === group.brand && other.material === group.material && other.finish === group.finish);
  return result;
}

export function filterFilaments(materials: MaterialRecord[], filters: FilamentFilters): MaterialRecord[] {
  return searchFilaments(materials, '').filter(material => filterKeys.every(key => !filters[key] || filamentAttribute(material, key) === filters[key]));
}

/** Let an earlier field change without being trapped by a selected series. */
export function filamentFilterOptions(materials: MaterialRecord[], filters: FilamentFilters, key: FilamentFilterKey): string[] {
  const parents = emptyFilamentFilters();
  for (const field of filterKeys.slice(0, filterKeys.indexOf(key))) parents[field] = filters[field];
  return [...new Set(filterFilaments(materials, parents).map(material => filamentAttribute(material, key)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** The changed field wins; retain other choices only while they remain compatible. */
export function changeFilamentFilter(materials: MaterialRecord[], current: FilamentFilters, key: FilamentFilterKey, value: string): FilamentFilters {
  const next = emptyFilamentFilters();
  next[key] = value;
  for (const field of filterKeys) {
    if (field === key || !current[field]) continue;
    const candidate = { ...next, [field]: current[field] };
    if (filterFilaments(materials, candidate).length) next[field] = current[field];
  }
  if (key === 'series' && value) {
    const matches = filterFilaments(materials, next);
    for (const field of filterKeys.filter(field => field !== 'series')) {
      const values = new Set(matches.map(material => filamentAttribute(material, field)));
      if (values.size === 1) next[field] = [...values][0]!;
    }
  }
  return next;
}

const colorNames: Record<string, string> = {
  black: '#202020', 黑: '#202020', 黑色: '#202020', white: '#FAFAFA', 白: '#FAFAFA', 白色: '#FAFAFA',
  gray: '#888888', grey: '#888888', 灰色: '#888888', red: '#E33939', 红色: '#E33939',
  orange: '#F28336', 橙色: '#F28336', yellow: '#F3DB35', 黄色: '#F3DB35', green: '#41A951', 绿色: '#41A951',
  blue: '#286BCD', 蓝色: '#286BCD', purple: '#8857B5', 紫色: '#8857B5', pink: '#EAA0C0', 粉色: '#EAA0C0',
  brown: '#805336', 棕色: '#805336', beige: '#DDC6A1', 米色: '#DDC6A1',
};

function colorOrder(material: MaterialRecord): number {
  const color = new Color(materialHex(material));
  const hsl = color.getHSL({ h: 0, s: 0, l: 0 });
  const chroma = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
  return chroma < .08 ? hsl.l : 2 + Math.round(hsl.h * 24) + hsl.l / 2;
}

export function browseFilaments(materials: MaterialRecord[], query: string, filters: FilamentFilters): MaterialRecord[] {
  const candidates = filterFilaments(materials, filters), text = query.trim();
  const exactSku = candidates.filter(material => [material.materialId, material.supplier?.sku].some(sku => sku?.toLowerCase() === text.toLowerCase()));
  if (text && exactSku.length) return exactSku;
  const target = colorQuery(text) || colorNames[text.toLowerCase()];
  if (target) return similarFilaments(candidates, target);
  return searchFilaments(candidates, text).sort((a, b) => colorOrder(a) - colorOrder(b) || a.materialId.localeCompare(b.materialId));
}

/** The guided picker needs both choices, then includes every series and finish. */
export function filamentColorsFor(materials: MaterialRecord[], brand: string, material: string, query = ''): MaterialRecord[] {
  if (!brand || !material) return [];
  return browseFilaments(materials, query, { ...emptyFilamentFilters(), brand, material });
}
