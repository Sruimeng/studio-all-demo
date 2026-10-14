import { RENDER_RULE, type MaterialRecord } from '../../app/@feature/materials/types';

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

