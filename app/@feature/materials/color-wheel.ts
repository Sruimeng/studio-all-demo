import { filamentIdentity, filamentPreview, filamentVendors, materialSeries } from './filaments';
import { cloneMaterial, materialHex, supplierCatalogHex } from './supplier';
import { inheritAppearance } from './binding';
import type { MaterialRecord } from './types';

export interface WheelFilters { vendor: string; base: string; series: string; hue: string; query: string }
export type WheelCreationContext = Pick<WheelFilters, 'vendor' | 'base' | 'series'>;
export interface WheelEntry {
  id: string;
  material: MaterialRecord;
  vendor: string;
  base: string;
  series: string;
  seriesName: string;
  hex: string | null;
  modelHex: string;
  hue: number;
  lightness: number;
  family: string;
}
export interface WheelCell { index: number; path: string; x: number; y: number; radius: number; sector: number; band: number; innerRadius: number; outerRadius: number; startAngle: number; endAngle: number }
export interface WheelSlot extends WheelCell { id: string; neutral: boolean }
export const wheelHues = [
  { id: 'red', en: 'Red', cn: '红色', hex: '#EF6464' },
  { id: 'orange', en: 'Orange', cn: '橙色', hex: '#EB9B56' },
  { id: 'yellow', en: 'Yellow', cn: '黄色', hex: '#E0CD64' },
  { id: 'green', en: 'Green', cn: '绿色', hex: '#8CB978' },
  { id: 'cyan', en: 'Cyan', cn: '青色', hex: '#73C8C4' },
  { id: 'blue', en: 'Blue', cn: '蓝色', hex: '#728FDA' },
  { id: 'purple', en: 'Purple', cn: '紫色', hex: '#A68AD1' },
  { id: 'pink', en: 'Pink', cn: '粉红', hex: '#D58BAC' },
  { id: 'neutral', en: 'Neutrals', cn: '无彩色', hex: '#A8ABA6' },
  { id: 'unavailable', en: 'No source HEX', cn: '无源 HEX', hex: '#34383B' },
];
export const emptyWheelFilters = (): WheelFilters => ({ vendor: '', base: '', series: '', hue: '', query: '' });

export function wheelColor(hex: string) {
  const [r, g, b] = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), chroma = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  if (chroma) hue = ((max === r ? (g - b) / chroma : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4) * 60 + 360) % 360;
  const neutral = chroma <= 0.06 || (max > 0 && chroma / max < 0.12);
  const family = neutral ? 'neutral' : hue < 15 || hue >= 345 ? 'red' : hue < 45 ? 'orange' : hue < 75 ? 'yellow' : hue < 165 ? 'green' : hue < 195 ? 'cyan' : hue < 255 ? 'blue' : hue < 285 ? 'purple' : 'pink';
  return { hue, lightness, family };
}

export function wheelEntries(materials: readonly MaterialRecord[]): WheelEntry[] {
  return materials.map(material => {
    const identity = filamentIdentity(material);
    const canonical = supplierCatalogHex(material);
    const hex = canonical && /^#[\da-f]{6}$/i.test(canonical) ? canonical.toUpperCase() : null;
    const series = material.appearance?.seriesId ?? '';
    return {
      id: material.id, material, vendor: identity.vendor, base: identity.type, series,
      seriesName: materialSeries.find(item => item.id === series)?.name ?? material.supplier?.product ?? '',
      hex, modelHex: materialHex(material).toUpperCase(),
      ...(hex ? wheelColor(hex) : { hue: 0, lightness: 0, family: 'unavailable' }),
    };
  });
}

export function filterWheelEntries(entries: readonly WheelEntry[], filters: WheelFilters, siteVendor?: string | null): WheelEntry[] {
  const terms = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(entry => {
    if (siteVendor && entry.vendor !== siteVendor) return false;
    if (filters.vendor && entry.vendor !== filters.vendor || filters.base && entry.base !== filters.base || filters.series && entry.series !== filters.series || filters.hue && entry.family !== filters.hue) return false;
    const material = entry.material;
    const text = [material.name, entry.hex, entry.modelHex, entry.vendor, entry.base, entry.seriesName, material.appearance?.colorCode, material.supplier?.product, material.supplier?.colorNameCN, material.supplier?.colorNameEN, material.supplier?.pantone, material.supplier?.catalogId].join(' ').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}

export function wheelOptions(entries: readonly WheelEntry[], filters: WheelFilters) {
  const vendors = [...new Set(entries.map(item => item.vendor))].sort();
  const vendorEntries = entries.filter(item => !filters.vendor || item.vendor === filters.vendor);
  const catalogSeries = materialSeries.filter(item => !filters.vendor || item.vendor === filters.vendor);
  const bases = [...new Set([...vendorEntries.map(item => item.base), ...catalogSeries.map(item => item.baseMaterial)])].sort();
  const series = new Map(catalogSeries.filter(item => !filters.base || item.baseMaterial === filters.base).map(item => [item.id, { id: item.id, name: item.name }]));
  for (const entry of vendorEntries) if (entry.series && (!filters.base || entry.base === filters.base)) series.set(entry.series, { id: entry.series, name: entry.seriesName });
  return { vendors, bases, series: [...series.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

export function normalizeWheelFilters(entries: readonly WheelEntry[], next: WheelFilters): WheelFilters {
  const filters = { ...next };
  if (filters.base && !wheelOptions(entries, filters).bases.includes(filters.base)) filters.base = '';
  if (filters.series && !wheelOptions(entries, filters).series.some(item => item.id === filters.series)) filters.series = '';
  return filters;
}

export function wheelCreationOptions(entries: readonly WheelEntry[], context: Pick<WheelCreationContext, 'vendor' | 'base'>, siteVendor?: string | null) {
  const vendors = siteVendor ? [siteVendor] : [...new Set([...filamentVendors, ...entries.filter(entry => entry.vendor.trim() && (entry.material.supplier?.vendor || entry.material.appearance?.vendor) === entry.vendor).map(entry => entry.vendor)])];
  const vendor = siteVendor || context.vendor;
  const bases = wheelOptions(entries, { ...emptyWheelFilters(), vendor }).bases.filter(base => base.trim() && base !== 'Unknown');
  if (!bases.length) bases.push('PLA');
  const series = materialSeries.filter(item => item.vendor === vendor && item.baseMaterial === context.base).map(item => ({ id: item.id, name: item.name })).sort((a, b) => a.name.localeCompare(b.name));
  return { vendors, bases, series };
}

export function wheelCreationContext(entries: readonly WheelEntry[], filters: WheelCreationContext, siteVendor?: string | null): WheelCreationContext {
  const vendors = wheelCreationOptions(entries, filters, siteVendor).vendors;
  const product = materialSeries.find(item => item.id === filters.series && (!filters.vendor || item.vendor === filters.vendor) && (!filters.base || item.baseMaterial === filters.base));
  const vendor = siteVendor || (vendors.includes(filters.vendor) ? filters.vendor : product?.vendor || vendors[0]!);
  const bases = wheelCreationOptions(entries, { vendor, base: '' }, siteVendor).bases;
  const preferredBase = filters.base || (product?.vendor === vendor ? product.baseMaterial : '');
  const base = bases.includes(preferredBase) ? preferredBase : bases.includes('PLA') ? 'PLA' : bases[0]!;
  const series = wheelCreationOptions(entries, { vendor, base }, siteVendor).series;
  return { vendor, base, series: series.some(item => item.id === filters.series) ? filters.series : series[0]?.id || '' };
}

const point = (radius: number, angle: number) => ({ x: 500 + radius * Math.sin(angle * Math.PI / 180), y: 520 - radius * Math.cos(angle * Math.PI / 180) });
const coord = (value: { x: number; y: number }) => `${value.x.toFixed(5)},${value.y.toFixed(5)}`;

export function wheelLightness(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (luminance > 216 / 24389 ? 116 * Math.cbrt(luminance) - 16 : 24389 / 27 * luminance) / 100;
}

export function wheelGrid(recordCount = 0): WheelCell[] {
  const sectors = 96 * Math.max(1, Math.ceil(recordCount / 1536));
  const step = 360 / sectors, gap = step * 0.12;
  return Array.from({ length: sectors * 16 }, (_, index) => {
    const band = Math.floor(index / sectors), sector = index % sectors;
    const inner = 177.75 + band * 17.5, outer = inner + 14;
    const start = sector * step - (step - gap) / 2, end = sector * step + (step - gap) / 2;
    const path = `M${coord(point(inner, start))}L${coord(point(outer, start))}A${outer},${outer} 0 0 1 ${coord(point(outer, end))}L${coord(point(inner, end))}A${inner},${inner} 0 0 0 ${coord(point(inner, start))}Z`;
    return { index, path, ...point((inner + outer) / 2, sector * step), radius: (inner + outer) / 2, sector, band, innerRadius: inner, outerRadius: outer, startAngle: start, endAngle: end };
  });
}

function neutralAngle(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  return (hash >>> 0) % 96 * 3.75;
}

export function layoutWheel(entries: readonly WheelEntry[], background?: readonly WheelCell[]): WheelSlot[] {
  const records = entries.filter(entry => entry.hex).sort((a, b) => Number(a.family === 'neutral') - Number(b.family === 'neutral') || a.id.localeCompare(b.id));
  const grid = background && background.length >= records.length ? background : wheelGrid(records.length);
  const occupied = new Set<number>();
  return records.map(entry => {
    const hex = entry.hex!;
    const grayscale = hex.slice(1, 3) === hex.slice(3, 5) && hex.slice(3, 5) === hex.slice(5, 7);
    const target = point(184.75 + Math.min(1, Math.max(0, wheelLightness(hex))) * 262.5, grayscale ? neutralAngle(entry.id) : entry.hue);
    let nearest = grid[0]!, distance = Infinity;
    for (const cell of grid) {
      if (occupied.has(cell.index)) continue;
      const score = (cell.x - target.x) ** 2 + (cell.y - target.y) ** 2;
      if (score < distance) { nearest = cell; distance = score; }
    }
    occupied.add(nearest.index);
    return { ...nearest, id: entry.id, neutral: entry.family === 'neutral' };
  });
}

export function wheelColorPreview(vendor: string, base: string, seriesId: string, selected: MaterialRecord | null): MaterialRecord {
  const preview = filamentPreview(vendor, base, seriesId || undefined, 'basic', selected ? materialHex(selected) : '#B6B6B6');
  const value = selected ? inheritAppearance(preview, cloneMaterial(selected)) : preview;
  value.appearance = { ...value.appearance!, vendor, baseMaterial: base, seriesId: seriesId || undefined, templateId: selected?.appearance?.templateId, origin: 'template' };
  return value;
}
