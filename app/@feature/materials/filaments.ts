import { FILAMENT_RULE, type FinishId, type MaterialRecord, type MaterialSeries, type MaterialTemplate, type SupplierProfile } from './types';
import { includesVendor } from '~/@base/site';

export const materialTemplates: MaterialTemplate[] = [
  { id: 'basic', name: 'Basic', nameCN: '常规', roughness: 0.38, metalness: 0, optics: {} },
  { id: 'matte', name: 'Matte', nameCN: '哑光', roughness: 0.85, metalness: 0, optics: {} },
  { id: 'silk', name: 'Silk', nameCN: '丝绸', roughness: 0.22, metalness: 0, optics: { sheen: 0.65, clearcoat: 0.3 } },
  { id: 'metallic', name: 'Metallic', nameCN: '金属光泽', roughness: 0.3, metalness: 0.45, optics: { clearcoat: 0.2 } },
  { id: 'translucent', name: 'Translucent', nameCN: '半透明', roughness: 0.25, metalness: 0, optics: { transmission: 0.85, thickness: 1.2, attenuationDistance: 8 } },
];
const polymaker = 'https://wiki.polymaker.com/polymaker-products/polymaker-filaments/panchroma-tm';
const prime = 'https://wiki.polymaker.com/polymaker-products/polymaker-filaments/prime-materials';
const sunlu = 'https://store.sunlu.com/';
const esun = 'https://esun3dstore.com/';
const kex = 'https://kexcelled3d.com/collections/aesthetic';
const cai = 'https://www.cailab3d.com/';
const series = (vendor: string, baseMaterial: string, id: string, name: string, source: string, templateId?: FinishId, aliases?: string[]): MaterialSeries => ({ id, vendor, baseMaterial, name, source, templateId, aliases });
const allSeries: MaterialSeries[] = [
  series('SUNLU', 'PLA', 'sunlu-pla-catalog', 'PLA 色卡 · 质感待确认', sunlu),
  series('Polymaker', 'PLA', 'polymaker-panchroma-catalog', 'Panchroma™ PLA 色卡 · 质感待确认', polymaker),
  ...(['matte', 'silk', 'metallic', 'translucent'] as const).map(id => series('Polymaker', 'PLA', `polymaker-${id}`, `Panchroma ${materialTemplates.find(t => t.id === id)!.name}`, polymaker, id, id === 'matte' ? ['PolyTerra PLA'] : undefined)),
  series('SUNLU', 'PLA', 'sunlu-matte', 'Matte PLA', sunlu, 'matte'),
  series('SUNLU', 'PLA', 'sunlu-silk', 'SILK PLA+', sunlu, 'silk'),
  series('SUNLU', 'PLA', 'sunlu-metallic', 'PLA Metallic', sunlu, 'metallic'),
  series('SUNLU', 'PETG', 'sunlu-petg', 'PETG · 含透明颜色变体', 'https://store.sunlu.com/products/over-6kg-bundle-sale-petg-3d-printer-filament-1-75mm-1kg-roll', 'basic'),
  ...(['basic', 'matte', 'silk', 'metallic'] as const).map(id => series('eSUN', 'PLA', `esun-${id}`, `PLA-${id === 'metallic' ? 'Metal' : materialTemplates.find(t => t.id === id)!.name}`, id === 'metallic' ? `${esun}products/epla-metal` : esun, id)),
  ...(['basic', 'matte', 'silk', 'metallic'] as const).map(id => series('Kexcelled', 'PLA', `kexcelled-${id}`, `K5 PLA ${id === 'metallic' ? 'Metal' : materialTemplates.find(t => t.id === id)!.name}`, kex, id)),
  series('Kexcelled', 'PETG', 'kexcelled-petg-matte', 'PETG Matte', kex, 'matte'),
  series('Kexcelled', 'ABS', 'kexcelled-abs-matte', 'ABS Matte', kex, 'matte'),
  series('Kexcelled', 'ABS', 'kexcelled-abs-transparent', 'ABS Transparent', kex, 'translucent'),
  series('CAILAB', 'PLA', 'cailab-matte', 'Matte PLA', `${cai}products/matte-pla-filament-1-75mm-1kg-spool`, 'matte'),
  series('CAILAB', 'PLA', 'cailab-silk', 'PLA Silk Glossy', `${cai}products/pla-silk-glossy-filament-1-75mm-1kg-spool`, 'silk'),
  series('CAILAB', 'PLA', 'cailab-metallic', 'PLA Metallic', cai, 'metallic'),
  ...([
    ['SUNLU', ['ABS', 'ASA', 'TPU', 'PA', 'PC'], sunlu],
    ['Polymaker', ['PETG', 'ABS', 'ASA', 'TPU', 'PA', 'PC'], prime],
    ['eSUN', ['PETG', 'ABS', 'ASA', 'TPU', 'PA'], esun],
    ['Kexcelled', ['PETG', 'ABS', 'ASA', 'TPU', 'PA', 'PC'], 'https://kexcelled3d.com/'],
    ['CAILAB', ['PETG', 'ABS'], cai],
  ] as const).flatMap(([vendor, bases, source]) => bases.map(base => series(vendor, base, `${vendor.toLowerCase()}-${base.toLowerCase()}`, `${base} · 通用外观参考`, source))),
];
export const materialSeries = allSeries.filter(item => includesVendor(item.vendor));
export const filamentVendors = ['SUNLU', 'Polymaker', 'eSUN', 'Kexcelled', 'CAILAB'].filter(includesVendor);
export const baseMaterials = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'PA', 'PC'].filter(base => materialSeries.some(item => item.baseMaterial === base));

export function catalogAppearance(profile: SupplierProfile): MaterialRecord['appearance'] {
  if (profile.origin || !profile.catalogHex) return undefined;
  const seriesId = profile.vendor === 'SUNLU' ? 'sunlu-pla-catalog' : profile.vendor === 'Polymaker' ? 'polymaker-panchroma-catalog' : undefined;
  if (!seriesId) return undefined;
  return { vendor: profile.vendor, baseMaterial: profile.materialType, seriesId, colorCode: profile.sku || undefined, sku: profile.sku || undefined, origin: 'catalog' };
}
export function filamentPreview(vendor: string, baseMaterial: string, seriesId: string | undefined, finish: FinishId, hex: string): MaterialRecord {
  const template = materialTemplates.find(item => item.id === finish)!;
  const product = materialSeries.find(item => item.id === seriesId);
  return {
    version: 2, id: `preview:${vendor}:${baseMaterial}:${finish}`, materialId: `DEMO-${baseMaterial}-${finish.toUpperCase()}`,
    name: `${product?.name ?? template.name} · ${hex}`, hex, colorSpace: 'srgb', renderRule: FILAMENT_RULE,
    transparency: 0, metalness: template.metalness, roughness: template.roughness, ior: 1.5, optics: { ...template.optics },
    appearance: { vendor, baseMaterial, seriesId, templateId: finish, origin: 'template', source: product?.source },
  };
}
export interface FilamentColorInput { name: string; hex: string; colorCode: string; sku: string; source: string }
export function createFilamentColor(preview: MaterialRecord, input: FilamentColorInput, id: string): MaterialRecord {
  const surface: MaterialRecord = JSON.parse(JSON.stringify(preview));
  delete surface.supplier; delete surface.overrides; delete surface.referenceImage;
  return {
    ...surface, id, materialId: `LOCAL-${id}`, name: input.name.trim(), hex: input.hex.toUpperCase(),
    appearance: { ...preview.appearance!, colorCode: input.colorCode.trim() || undefined, sku: input.sku.trim() || undefined, source: input.source.trim() || undefined, origin: 'user' },
  };
}
export const filamentIdentity = (material: MaterialRecord) => ({
  vendor: material.supplier?.vendor || material.appearance?.vendor || 'Generic',
  type: material.supplier?.materialType || material.appearance?.baseMaterial || 'Unknown',
});
