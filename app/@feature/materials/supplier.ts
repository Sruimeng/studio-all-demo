import { Color, LinearSRGBColorSpace, SRGBColorSpace } from 'three';
import type { SurfaceValues } from '~/@engine/viewer';
import data from './data/polymaker-pla.json';
import { OPENPBR_RULE, RENDER_RULE, type MaterialRecord, type SupplierCatalog, type SupplierProfile } from './types';

export const supplierCatalog = data as SupplierCatalog;
export const cloneMaterial = (material: MaterialRecord): MaterialRecord => JSON.parse(JSON.stringify(material));
const numeric = (profile: SupplierProfile, key: string, fallback: number) => {
  const value = profile.source.parameters[key];
  return typeof value === 'number' ? value : fallback;
};
export function supplierMaterial(profile: SupplierProfile): MaterialRecord {
  return {
    version: 2, id: `${profile.vendor.toLowerCase()}:${profile.sku}`, materialId: profile.sku,
    name: [profile.colorNameCN || profile.colorNameEN || profile.sku, profile.colorNameEN].filter(Boolean).join(' · '),
    hex: profile.catalogHex ?? '#808080', transparency: 1 - numeric(profile, 'geometry_opacity', 1),
    metalness: numeric(profile, 'base_metalness', 0), roughness: numeric(profile, 'specular_roughness', 0.35),
    ior: numeric(profile, 'specular_ior', 1.5), colorSpace: 'srgb',
    renderRule: profile.source.file ? OPENPBR_RULE : RENDER_RULE,
    supplier: profile, overrides: {},
  };
}
export const supplierMaterials = supplierCatalog.records.map(supplierMaterial);

export function restoreSupplier(material: MaterialRecord): MaterialRecord {
  if (!material.supplier) return cloneMaterial(material);
  return { ...supplierMaterial(material.supplier), referenceImage: material.referenceImage };
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
  const surface: SurfaceValues = { hex: value.hex, transparency: value.transparency, metalness: value.metalness, roughness: value.roughness, ior: value.ior, renderRule: value.renderRule };
  const mode = material.overrides?.colorMode ?? 'catalog';
  const color = material.supplier?.source.parameters.base_color;
  if (mode !== 'catalog' && Array.isArray(color) && color.length === 3 && !material.overrides?.hex) {
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
  };
  return messages[issue]?.[english ? 1 : 0] ?? issue;
}
