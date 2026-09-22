import { RENDER_RULE, type MaterialRecord } from './types';

export const initialMaterials: MaterialRecord[] = [
  ['porcelain', 'PLA-001', 'Porcelain', '#EAE8E2', 0, 0, 0.35],
  ['coral', 'PLA-002', 'Coral', '#ED735C', 0, 0, 0.35],
  ['carbon', 'PLA-003', 'Carbon', '#303438', 0, 0.05, 0.65],
  ['ochre', 'PLA-004', 'Golden sand', '#DBB970', 0, 0.6, 0.2],
  ['sage', 'PLA-005', 'Sage', '#ABC1AF', 0, 0, 0.5],
  ['glacier', 'PLA-006', 'Glacier', '#A5CEDE', 0.55, 0, 0.15],
].map(([id, materialId, name, hex, transparency, metalness, roughness]) => ({
  id: String(id), materialId: String(materialId), name: String(name), hex: String(hex),
  transparency: Number(transparency), metalness: Number(metalness), roughness: Number(roughness),
  colorSpace: 'srgb', renderRule: RENDER_RULE,
}));

export function validateMaterial(material: MaterialRecord, catalog: MaterialRecord[]): string | null {
  if (!material || typeof material.id !== 'string' || !material.id || typeof material.materialId !== 'string' || typeof material.name !== 'string' || material.colorSpace !== 'srgb' || material.renderRule !== RENDER_RULE) return 'Invalid material record / 材质数据无效';
  if (!material.materialId.trim() || !material.name.trim()) return 'Name and material ID are required / 名称和材质 ID 必填';
  if (catalog.some(item => item.id !== material.id && item.materialId.toLowerCase() === material.materialId.trim().toLowerCase())) return 'Material ID already exists / 材质 ID 已存在';
  if (!/^#[\da-f]{6}$/i.test(material.hex)) return 'Use a six-digit HEX color / 请输入六位 HEX 颜色';
  if ([material.transparency, material.metalness, material.roughness].some(value => !Number.isFinite(value) || value < 0 || value > 1)) return 'Parameters must be between 0 and 1 / 参数范围为 0–1';
  return null;
}

export const rgb = (hex: string) => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));

export function materialsCSV(materials: MaterialRecord[]): string {
  const escape = (value: unknown) => {
    let text = String(value);
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows: unknown[][] = [['material_id', 'name', 'hex', 'r', 'g', 'b', 'transparency', 'metalness', 'roughness', 'color_space', 'render_rule']];
  for (const item of materials) rows.push([item.materialId, item.name, item.hex, ...rgb(item.hex), item.transparency, item.metalness, item.roughness, item.colorSpace, item.renderRule]);
  return '\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n');
}
