import type { MaterialRecord } from './types';
import { OPENPBR_RULE } from './types';
import { materialHex, materialProblem } from './supplier';

export const filamentBrand = (material: MaterialRecord) => material.supplier?.vendor || material.filament?.brand || '';
export const filamentType = (material: MaterialRecord) => material.supplier?.materialType || material.filament?.materialType || '';
export const filamentSeries = (material: MaterialRecord) => material.supplier?.product || material.filament?.series || '';
export function filamentDescription(material: MaterialRecord) {
  const series = filamentSeries(material), type = filamentType(material);
  return [series, type && !series.toLowerCase().includes(type.toLowerCase()) ? type : ''].filter(Boolean).join(' · ');
}
export function filamentName(material: MaterialRecord, english = false) {
  return (english ? material.supplier?.colorNameEN : material.supplier?.colorNameCN) || material.name;
}

export function colorQuery(query: string): string | null {
  const input = query.trim();
  const hex = input.match(/^#?([\da-f]{6})$/i)?.[1] ?? input.match(/^#([\da-f]{3})$/i)?.[1];
  if (hex) return '#' + (hex.length === 3 ? [...hex].map(char => char + char).join('') : hex).toUpperCase();
  const rgb = query.trim().match(/^(?:rgb\s*\(\s*)?(\d{1,3})\s*[,，]\s*(\d{1,3})\s*[,，]\s*(\d{1,3})\s*\)?$/i);
  if (!rgb || rgb.slice(1).some(value => Number(value) > 255)) return null;
  return '#' + rgb.slice(1).map(value => Number(value).toString(16).padStart(2, '0')).join('').toUpperCase();
}
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[™®]/g, '').replace(/[-_]/g, ' ');
export function searchFilaments(materials: MaterialRecord[], query: string): MaterialRecord[] {
  const hex = colorQuery(query);
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return materials.filter(material => {
    if (materialProblem(material)) return false;
    if (hex && [material.hex, materialHex(material), material.supplier?.catalogHex].some(value => value?.toUpperCase() === hex)) return true;
    const text = normalize([material.name, material.materialId, material.supplier?.sku, filamentBrand(material), filamentSeries(material), filamentType(material), material.supplier?.colorNameCN, material.supplier?.colorNameEN, material.hex, materialHex(material), material.supplier?.catalogHex].filter(Boolean).join(' '));
    return terms.every(term => text.includes(term));
  }).sort((a, b) => Number(b.materialId.toLowerCase() === query.trim().toLowerCase()) - Number(a.materialId.toLowerCase() === query.trim().toLowerCase()));
}

export const filamentTypes = ['PLA', 'PLA+', 'PETG', 'ABS', 'ASA', 'TPU', 'PA', 'PC'] as const;

function oklab(hex: string) {
  const [r, g, b] = [1, 3, 5].map(start => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
/** Perceptual color distance first; ownership only breaks equal-distance ties. */
export function similarFilaments(materials: MaterialRecord[], target: string, ownedIds: string[] = []) {
  const hex = colorQuery(target); if (!hex) return [];
  const color = oklab(hex), owned = new Set(ownedIds);
  return searchFilaments(materials, '').map(material => {
    const sample = oklab(materialHex(material));
    return { material, distance: Math.hypot(...sample.map((value, i) => value - color[i]!)) };
  }).sort((a, b) => a.distance - b.distance || Number(owned.has(b.material.id)) - Number(owned.has(a.material.id))).map(item => item.material);
}

export function customFilament(name: string, materialType: string, hex: string): MaterialRecord {
  const id = crypto.randomUUID();
  return { version: 2, id: `custom:${id}`, materialId: `CUSTOM-${id}`, name: name.trim(), hex: hex.toUpperCase(), filament: { materialType }, transparency: 0, metalness: 0, roughness: 0.45, colorSpace: 'srgb', renderRule: OPENPBR_RULE };
}
