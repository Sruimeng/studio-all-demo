import { cloneMaterial, materialHex, materialProblem, materialSurface, withOverrides } from './supplier';
import { materialTemplates } from './filaments';
import { FILAMENT_RULE, type MaterialRecord } from './types';

export const appearanceTemplates: MaterialRecord[] = materialTemplates.map(item => ({
  version: 2, id: `appearance:${item.id}`, materialId: `APPEARANCE-${item.id.toUpperCase()}`,
  name: `${item.name} · ${item.nameCN}`, hex: '#B6B6B6', colorSpace: 'srgb', renderRule: FILAMENT_RULE,
  transparency: 0, metalness: item.metalness, roughness: item.roughness, ior: 1.5, optics: { ...item.optics },
}));

export const isAppearanceSource = (material: MaterialRecord) => !material.appearance && !material.appearanceBinding && (!material.supplier || material.supplier.origin === 'local-usda');

export function inheritAppearance(color: MaterialRecord, source: MaterialRecord): MaterialRecord {
  const value = cloneMaterial(color);
  const surface = materialSurface(source);
  value.hex = materialHex(color);
  value.renderRule = source.renderRule;
  value.transparency = surface.transparency;
  value.metalness = surface.metalness;
  value.roughness = surface.roughness;
  value.ior = surface.ior ?? 1.5;
  value.optics = surface.optics ? { ...surface.optics } : undefined;
  value.appearanceBinding = source.appearanceBinding ? { ...source.appearanceBinding } : undefined;
  if (value.appearance) value.appearance.templateId = source.appearance?.templateId;
  return withOverrides(value);
}

export function bindAppearance(color: MaterialRecord, source: MaterialRecord): MaterialRecord {
  if (color.id === source.id || !isAppearanceSource(source)) throw new Error('Choose an independent library material / 请选择独立的库内材质');
  const problem = materialProblem(source);
  if (problem) throw new Error(problem);
  const value = inheritAppearance(color, source);
  value.appearanceBinding = {
    id: source.id, materialId: source.materialId, name: source.name, overridden: false,
    sourceFile: source.supplier?.source.file ?? undefined,
    sourceSha256: source.supplier?.source.sha256 ?? undefined,
  };
  if (value.appearance) value.appearance.templateId = materialTemplates.find(item => source.id === `appearance:${item.id}`)?.id;
  return value;
}

export function detachAppearance(material: MaterialRecord): MaterialRecord {
  const value = cloneMaterial(material);
  delete value.appearanceBinding;
  return value;
}
