import { Color, LinearSRGBColorSpace, SRGBColorSpace } from 'three';
import type { SurfaceValues } from '~/@engine/viewer';
import { includesVendor } from '~/@base/site';
import data from './data/polymaker-pla.json';
import sunlu from './data/sunlu-pla.json';
import { catalogAppearance } from './filaments';
import { OPENPBR_RULE, RENDER_RULE, type MaterialOverrides, type MaterialRecord, type SupplierCatalog, type SupplierMaterialModification, type SupplierProfile } from './types';

export const supplierCatalogs = ([data, sunlu] as SupplierCatalog[]).filter(catalog => includesVendor(catalog.vendor));
export const supplierCatalog = supplierCatalogs[0]!;
export const cloneMaterial = (material: MaterialRecord): MaterialRecord => JSON.parse(JSON.stringify(material));
const numeric = (profile: SupplierProfile, key: string, fallback: number) => {
  const value = profile.source.parameters[key];
  return typeof value === 'number' ? value : fallback;
};
export function supplierMaterial(profile: SupplierProfile): MaterialRecord {
  const key = profile.sku || profile.catalogId;
  if (!key) throw new Error('Supplier SKU or catalog ID is required');
  const materialId = profile.sku || `${profile.vendor.toUpperCase()}-${key}`;
  return {
    version: 2, id: `${profile.vendor.toLowerCase()}:${key}`, materialId,
    name: [profile.colorNameCN || profile.colorNameEN || profile.sku, profile.colorNameEN].filter(Boolean).join(' · '),
    hex: profile.catalogHex ?? (profile.origin === 'local-usda' && Array.isArray(profile.source.parameters.base_color) ? `#${new Color().setRGB(...profile.source.parameters.base_color as [number, number, number], LinearSRGBColorSpace).getHexString().toUpperCase()}` : '#808080'), transparency: 1 - numeric(profile, 'geometry_opacity', 1),
    metalness: numeric(profile, 'base_metalness', 0), roughness: numeric(profile, 'specular_roughness', 0.35),
    ior: numeric(profile, 'specular_ior', 1.5), colorSpace: 'srgb',
    renderRule: profile.source.file ? OPENPBR_RULE : RENDER_RULE,
    supplier: profile, overrides: {},
    appearance: catalogAppearance(profile),
  };
}
export const supplierMaterials = supplierCatalogs.flatMap(catalog => catalog.records.map(supplierMaterial));

export function restoreSupplier(material: MaterialRecord): MaterialRecord {
  if (!material.supplier) return cloneMaterial(material);
  return { ...supplierMaterial(material.supplier), ...(material.supplier.origin === 'local-usda' ? { id: material.id, materialId: material.materialId, name: material.name } : {}), referenceImage: material.referenceImage };
}
export function withOverrides(material: MaterialRecord): MaterialRecord {
  if (!material.supplier) return cloneMaterial(material);
  const baseline = supplierMaterial(material.supplier);
  const overrides = { ...material.overrides };
  for (const field of ['hex', 'transparency', 'metalness', 'roughness', 'ior'] as const) {
    if (material[field] !== baseline[field]) Object.assign(overrides, { [field]: material[field] });
    else delete overrides[field];
  }
  return cloneMaterial({ ...material, version: 2, overrides });
}
export function materialSurface(material: MaterialRecord): SurfaceValues {
  const value = { ...material, ...material.overrides };
  const surface: SurfaceValues = { hex: value.hex, transparency: value.transparency, metalness: value.metalness, roughness: value.roughness, ior: value.ior, renderRule: value.renderRule, optics: value.optics };
  const mode = material.overrides?.colorMode ?? (material.supplier?.origin === 'local-usda' ? 'linear-srgb' : 'catalog');
  const color = material.supplier?.source.parameters.base_color;
  if (!material.appearanceBinding && mode !== 'catalog' && Array.isArray(color) && color.length === 3 && !material.overrides?.hex) {
    surface.baseColor = color as [number, number, number];
    surface.baseColorSpace = mode;
  }
  return surface;
}
export function materialHex(material: MaterialRecord): string {
  const surface = materialSurface(material);
  if (!surface.baseColor) return surface.hex;
  const color = new Color().setRGB(...surface.baseColor, surface.baseColorSpace === 'srgb' ? SRGBColorSpace : LinearSRGBColorSpace);
  return `#${color.getHexString().toUpperCase()}`;
}
export function supplierCatalogHex(material: MaterialRecord): string | null {
  if (!material.supplier || material.supplier.origin === 'local-usda') return material.hex;
  return material.supplier.catalogHex;
}
export function supplierModification(material: MaterialRecord): SupplierMaterialModification | null {
  const supplier = material.supplier;
  if (!supplier || supplier.origin === 'local-usda') return null;
  const overrides = material.overrides ?? {};
  const baseline = supplierMaterial(supplier);
  const changes = (Object.entries(overrides) as Array<[keyof MaterialOverrides, unknown]>).flatMap(([field, value]) => {
    if (!['hex', 'transparency', 'metalness', 'roughness', 'ior', 'colorMode'].includes(field) || (field === 'colorMode' && value === 'catalog')) return [];
    const source = field === 'hex' ? supplier.catalogHex : field === 'colorMode' ? 'catalog' : baseline[field as keyof MaterialRecord] as string | number | null | undefined;
    const current = field === 'hex' ? materialHex(material) : value;
    return [{ field, source: source ?? null, value: (current as string | number | null) ?? null }];
  });
  return changes.length ? { id: material.id, materialId: material.materialId, vendor: supplier.vendor, changes } : null;
}
export function materialProblem(material: MaterialRecord): string | null {
  if (material.supplier?.status === 'unmatched') return 'SKU is not in the spreadsheet / SKU 未对应表格，请先向供应商确认';
  if (material.supplier?.source.file) {
    const parameters = material.supplier.source.parameters;
    for (const key of ['base_weight', 'specular_weight']) if (parameters[key] !== 1) return `Unsupported OpenPBR input: ${key}`;
    for (const key of ['coat_weight', 'transmission_weight', 'subsurface_weight', 'fuzz_weight', 'thin_film_weight', 'emission_luminance', 'specular_roughness_anisotropy', 'base_diffuse_roughness']) {
      if (parameters[key] !== 0) return `Unsupported OpenPBR input: ${key}`;
    }
    if (!Array.isArray(parameters.specular_color) || parameters.specular_color.some(value => value !== 1)) return 'Unsupported OpenPBR specular color';
  }
  return null;
}
export function supplierIssue(issue: string, english = false): string {
  const messages: Record<string, [string, string]> = {
    'lab-conflicts-with-color-name': ['Lab 明度与颜色名冲突，待复核', 'Lab lightness conflicts with the color name'],
    'color-name-conflict': ['中英文颜色名不一致', 'Chinese and English color names differ'],
    'source-color-space-unknown': ['USDA 颜色空间待确认', 'USDA color space is unconfirmed'],
    'base-color-outside-unit-range': ['源颜色分量超出 0–1，原值保留', 'Source color exceeds 0–1; original values retained'],
    'material-name-needs-confirmation': ['材质名后缀需确认对应关系', 'Material name suffix needs SKU confirmation'],
    'sku-not-in-spreadsheet': ['SKU 未对应表格，暂不能应用', 'SKU is absent from the spreadsheet; assignment disabled'],
    'openpbr-missing': ['缺少 OpenPBR，使用色卡与演示外观参数', 'No OpenPBR; using catalog color and demo appearance values'],
    'sku-not-provided': ['供应商未提供 SKU；目录编号仅供 Demo 使用', 'Supplier SKU not provided; catalog ID is for this demo'],
    'hex-swatch-mismatch': ['表格 HEX 与色块不一致，预览和匹配使用 HEX 文字', 'Spreadsheet HEX differs from the swatch; preview and matching use the HEX text'],
  };
  return messages[issue]?.[english ? 1 : 0] ?? issue;
}
