import { FILAMENT_RULE, OPENPBR_RULE, RENDER_RULE, type MaterialRecord } from './types';
import { materialHex, supplierModification } from './supplier';
import { filamentIdentity, materialSeries, materialTemplates } from './filaments';

const legacySampleIds = new Map([
  ['porcelain', 'PLA-001'], ['coral', 'PLA-002'], ['carbon', 'PLA-003'],
  ['ochre', 'PLA-004'], ['sage', 'PLA-005'], ['glacier', 'PLA-006'],
]);

export const withoutLegacySamples = (materials: MaterialRecord[]): MaterialRecord[] =>
  materials.filter(material => material.supplier || legacySampleIds.get(material.id) !== material.materialId);

export function validateMaterial(material: MaterialRecord, catalog: MaterialRecord[]): string | null {
  if (!material || typeof material.id !== 'string' || !material.id || typeof material.materialId !== 'string' || typeof material.name !== 'string' || material.colorSpace !== 'srgb' || ![RENDER_RULE, OPENPBR_RULE, FILAMENT_RULE].includes(material.renderRule)) return 'Invalid material record / 材质数据无效';
  if (!material.materialId.trim() || !material.name.trim()) return 'Name and material ID are required / 名称和材质 ID 必填';
  if (catalog.some(item => item.id !== material.id && item.materialId.toLowerCase() === material.materialId.trim().toLowerCase())) return 'Material ID already exists / 材质 ID 已存在';
  if (!/^#[\da-f]{6}$/i.test(material.hex)) return 'Use a six-digit HEX color / 请输入六位 HEX 颜色';
  if ([material.transparency, material.metalness, material.roughness].some(value => !Number.isFinite(value) || value < 0 || value > 1)) return 'Parameters must be between 0 and 1 / 参数范围为 0–1';
  if (material.ior !== undefined && (!Number.isFinite(material.ior) || material.ior < 1 || material.ior > 3)) return 'IOR must be between 1 and 3 / 折射率范围为 1–3';
  if (material.appearanceBinding) {
    const binding = material.appearanceBinding;
    if (typeof binding !== 'object' || Array.isArray(binding) || ['id', 'materialId', 'name'].some(key => typeof binding[key as 'id'] !== 'string' || !binding[key as 'id'].trim()) || binding.id === material.id || typeof binding.overridden !== 'boolean' || ['sourceFile', 'sourceSha256'].some(key => { const value = binding[key as 'sourceFile']; return value !== undefined && typeof value !== 'string'; })) return 'Invalid appearance binding / 外观绑定无效';
  }
  if (material.appearance) {
    const value = material.appearance;
    if (typeof value.vendor !== 'string' || !value.vendor.trim() || typeof value.baseMaterial !== 'string' || !value.baseMaterial.trim() || !['catalog', 'template', 'user'].includes(value.origin)) return 'Invalid filament identity / 耗材关系无效';
    if (value.templateId !== undefined && !materialTemplates.some(item => item.id === value.templateId)) return 'Invalid material template';
    if (value.seriesId !== undefined && !materialSeries.some(item => item.id === value.seriesId && item.vendor === value.vendor && item.baseMaterial === value.baseMaterial)) return 'Invalid material series';
    if (['sku', 'colorCode', 'source'].some(key => { const entry = value[key as 'sku']; return entry !== undefined && typeof entry !== 'string'; })) return 'Invalid color metadata';
  }
  if (material.optics) {
    const optics = material.optics;
    if (typeof optics !== 'object' || Array.isArray(optics)) return 'Invalid optics record';
    if (['transmission', 'sheen', 'clearcoat'].some(key => { const value = optics[key as 'transmission']; return value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1); })) return 'Invalid optical weight / 光学权重范围为 0–1';
    if (optics.thickness !== undefined && (!Number.isFinite(optics.thickness) || optics.thickness < 0 || optics.thickness > 100)) return 'Invalid optical thickness';
    if (optics.attenuationDistance !== undefined && (!Number.isFinite(optics.attenuationDistance) || optics.attenuationDistance <= 0 || optics.attenuationDistance > 10000)) return 'Invalid attenuation distance';
  }
  if (material.overrides) {
    if (material.overrides.colorMode && !['catalog', 'linear-srgb', 'srgb'].includes(material.overrides.colorMode)) return 'Invalid color interpretation';
    if (material.overrides.hex && !/^#[\da-f]{6}$/i.test(material.overrides.hex)) return 'Invalid override color';
    if (['transparency', 'metalness', 'roughness'].some(key => { const value = material.overrides![key as 'roughness']; return value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1); })) return 'Invalid parameter override';
    if (material.overrides.ior !== undefined && (!Number.isFinite(material.overrides.ior) || material.overrides.ior < 1 || material.overrides.ior > 3)) return 'Invalid IOR override';
  }
  if (material.supplier) {
    const supplier = material.supplier;
    if (!supplier || typeof supplier.sku !== 'string' || typeof supplier.vendor !== 'string' || !['paired', 'color-only', 'unmatched', 'imported'].includes(supplier.status) || !Array.isArray(supplier.issues) || !supplier.issues.every(issue => typeof issue === 'string') || !supplier.source || typeof supplier.source.parameters !== 'object' || !supplier.source.parameters) return 'Invalid supplier profile';
    if (!supplier.sku.trim() && (typeof supplier.catalogId !== 'string' || !supplier.catalogId.trim())) return 'Supplier SKU or catalog ID is required';
    const color = supplier.source.parameters.base_color;
    if (supplier.source.file && (!Array.isArray(color) || color.length !== 3 || !color.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0))) return 'Invalid source base color';
  }
  return null;
}

export const rgb = (hex: string) => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));

export function materialsCSV(materials: MaterialRecord[]): string {
  const escape = (value: unknown) => {
    let text = String(value);
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows: unknown[][] = [['material_id', 'name', 'hex', 'r', 'g', 'b', 'transparency', 'metalness', 'roughness', 'color_space', 'render_rule', 'vendor', 'material_type', 'catalog_hex', 'pantone', 'd65_l', 'd65_a', 'd65_b', 'ior', 'color_interpretation', 'source_file', 'source_sha256', 'issues', 'status', 'series_id', 'template_id', 'color_code', 'sales_sku', 'color_source', 'appearance_origin', 'transmission', 'thickness_mm', 'attenuation_distance_mm', 'sheen', 'clearcoat', 'supplier_modifications']];
  for (const item of materials) {
    const hex = item.supplier?.status === 'unmatched' ? '' : materialHex(item);
    const identity = filamentIdentity(item);
    rows.push([item.materialId, item.name, hex, ...(hex ? rgb(hex) : ['', '', '']), item.transparency, item.metalness, item.roughness, item.colorSpace, item.renderRule, identity.vendor, identity.type, item.supplier?.catalogHex ?? '', item.supplier?.pantone ?? '', ...(item.supplier?.d65Lab ?? ['', '', '']), item.ior ?? '', item.overrides?.colorMode ?? (item.supplier?.origin === 'local-usda' ? 'linear-srgb' : 'catalog'), item.supplier?.source.file ?? '', item.supplier?.source.sha256 ?? '', item.supplier?.issues.join('; ') ?? '', item.supplier?.status ?? 'local', item.appearance?.seriesId ?? '', item.appearance?.templateId ?? '', item.appearance?.colorCode ?? '', item.appearance?.sku ?? item.supplier?.sku ?? '', item.appearance?.source ?? '', item.appearance?.origin ?? '', item.optics?.transmission ?? 0, item.optics?.thickness ?? 0, item.optics?.attenuationDistance ?? '', item.optics?.sheen ?? 0, item.optics?.clearcoat ?? 0, JSON.stringify(supplierModification(item)?.changes ?? [])]);
  }
  rows[0]!.push('appearance_material_id', 'appearance_material_name', 'appearance_source_id', 'appearance_overridden', 'appearance_source_file', 'appearance_source_sha256');
  materials.forEach((item, index) => rows[index + 1]!.push(item.appearanceBinding?.materialId ?? '', item.appearanceBinding?.name ?? '', item.appearanceBinding?.id ?? '', item.appearanceBinding?.overridden ?? '', item.appearanceBinding?.sourceFile ?? '', item.appearanceBinding?.sourceSha256 ?? ''));
  return '\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n');
}
