import { describe, expect, it } from 'vitest';
import { materialSeries, materialTemplates, filamentPreview, createFilamentColor, filamentIdentity } from '../app/@feature/materials/filaments';
import { supplierMaterials, materialSurface, cloneMaterial } from '../app/@feature/materials/supplier';
import { validateMaterial, materialsCSV } from '../app/@feature/materials/catalog';
import { applySurface, createPrintMaterial } from '../app/@engine/viewer/material';
import { appearanceTemplates, bindAppearance, detachAppearance, inheritAppearance, isAppearanceSource } from '../app/@feature/materials/binding';
import { importUSDAMaterials } from '../app/@feature/materials/usda';

const input = { name: '自定义玫瑰', hex: '#cf809f', colorCode: 'MY-01', sku: 'TEST-175-1KG', source: 'User color chart' };
describe('library appearance bindings', () => {
  it('binds all five shared appearances to the same SKU and resets optics when switching', () => {
    const color = cloneMaterial(supplierMaterials.find(item => item.materialId === 'CA19001')!);
    expect(appearanceTemplates.map(item => item.name.split(' · ')[0])).toEqual(['Basic', 'Matte', 'Silk', 'Metallic', 'Translucent']);
    const bound = appearanceTemplates.map(source => bindAppearance(color, source));
    bound.forEach((value, index) => {
      expect(value.id).toBe(color.id); expect(value.materialId).toBe(color.materialId); expect(value.hex).toBe(color.hex);
      expect(value.supplier).toEqual(color.supplier); expect(value.appearance!.seriesId).toBe(color.appearance!.seriesId);
      expect(value.appearanceBinding!.id).toBe(appearanceTemplates[index]!.id);
      expect(value.appearance!.templateId).toBe(materialTemplates[index]!.id); expect(validateMaterial(value, [])).toBeNull();
      expect(materialSurface(value).roughness).toBe(materialTemplates[index]!.roughness);
    });
    const glass = bound[4]!;
    expect(glass.optics!.transmission).toBe(0.85);
    const matte = bindAppearance(glass, appearanceTemplates[1]!);
    expect(matte.appearanceBinding!.name).toBe('Matte · 哑光'); expect(matte.optics).toEqual({});
    expect(matte.appearance!.templateId).toBe('matte');
    const custom = createFilamentColor(matte, input, 'shared-color');
    expect(custom.appearanceBinding).toEqual(matte.appearanceBinding); expect(custom.appearance!.templateId).toBe('matte');
  });
  it('inherits imported OpenPBR appearance without leaking source color or supplier identity', async () => {
    const [source] = await importUSDAMaterials(new File(['#usda 1.0\ndef Material "Brushed" { token outputs:mtlx:surface.connect = </Brushed/Surface.outputs:surface>\n def Shader "Surface" { uniform token info:id = "ND_open_pbr_surface_surfaceshader"\n color3f inputs:base_color = (0.05, 0.1, 0.2)\n float inputs:specular_roughness = 0.18\n float inputs:base_metalness = 0.7\n } }'], 'brushed.usda'));
    const color = cloneMaterial(supplierMaterials.find(item => item.materialId === 'CA19001')!);
    const sourceBefore = cloneMaterial(source!); const before = cloneMaterial(color);
    const bound = bindAppearance(color, source!);
    expect(materialSurface(bound)).toMatchObject({ hex: color.hex, roughness: 0.18, metalness: 0.7, renderRule: 'openpbr-subset-v1' });
    expect(materialSurface(bound).baseColor).toBeUndefined();
    expect(bound.appearanceBinding).toMatchObject({ id: source!.id, materialId: source!.materialId, name: source!.name, overridden: false, sourceFile: 'brushed.usda' });
    expect(bound.appearance!.templateId).toBeUndefined(); expect(bound.supplier).toEqual(color.supplier); expect(bound.materialId).toBe(color.materialId);
    expect(source).toEqual(sourceBefore); expect(color).toEqual(before); expect(validateMaterial(bound, [])).toBeNull();
    expect(materialsCSV([bound])).toContain('appearance_material_id'); expect(materialsCSV([bound])).toContain('brushed.usda');
    const next = inheritAppearance(supplierMaterials.find(item => item.materialId === 'CA19017')!, bound);
    expect(next.appearanceBinding).toEqual(bound.appearanceBinding); expect(next.hex).not.toBe(bound.hex); expect(materialSurface(next).roughness).toBe(0.18);
    const custom = createFilamentColor(next, input, 'bound-custom');
    expect(custom.appearanceBinding).toEqual(bound.appearanceBinding); expect(materialSurface(custom).metalness).toBe(0.7);
    expect(detachAppearance(bound).appearanceBinding).toBeUndefined(); expect(materialSurface(detachAppearance(bound))).toMatchObject({ roughness: 0.18, metalness: 0.7 });
  });
  it('preserves a complete optical snapshot and blocks self or chained bindings', () => {
    const source = { ...filamentPreview('CAILAB', 'PLA', undefined, 'translucent', '#112233'), id: 'own-material', materialId: 'OWN-01', name: 'Our translucent material', appearance: undefined };
    const color = supplierMaterials[0]!; const bound = bindAppearance(color, source);
    expect(isAppearanceSource(source)).toBe(true); expect(isAppearanceSource(bound)).toBe(false);
    expect(bound.optics!.transmission).toBe(0.85); source.optics!.transmission = 0.2;
    expect(bound.optics!.transmission).toBe(0.85);
    expect(bindAppearance(bound, source).optics!.transmission).toBe(0.2);
    expect(() => bindAppearance(source, source)).toThrow('independent'); expect(() => bindAppearance(source, bound)).toThrow('independent');
    expect(validateMaterial({ ...bound, appearanceBinding: { ...bound.appearanceBinding!, id: bound.id } }, [])).toContain('绑定');
  });
});
describe('filament templates, series and colors', () => {
  it('keeps catalog colors unclassified and never expands their colors to other series', () => {
    expect(new Set(materialSeries.map(item => item.vendor))).toEqual(new Set(['SUNLU', 'Polymaker', 'eSUN', 'Kexcelled', 'CAILAB']));
    expect(new Set(materialSeries.map(item => item.id)).size).toBe(materialSeries.length);
    expect(supplierMaterials.filter(item => item.appearance?.seriesId === 'sunlu-pla-catalog')).toHaveLength(33);
    expect(supplierMaterials.filter(item => item.appearance?.seriesId === 'polymaker-panchroma-catalog')).toHaveLength(26);
    expect(supplierMaterials.every(item => !item.appearance?.templateId)).toBe(true);
    expect(supplierMaterials.filter(item => item.appearance?.seriesId === 'sunlu-silk')).toHaveLength(0);
    expect(materialSeries.find(item => item.id === 'polymaker-matte')!.aliases).toContain('PolyTerra PLA');
    expect(materialSeries.filter(item => item.vendor === 'CAILAB').map(item => item.baseMaterial)).not.toContain('PC');
  });
  it('preserves one color across five distinct surfaces, with physical transmission and dielectric silk', () => {
    const presets = materialTemplates.map(item => filamentPreview('Polymaker', 'PLA', undefined, item.id, '#CF809F'));
    presets.forEach(item => expect(validateMaterial(item, [])).toBeNull());
    expect(new Set(presets.map(item => item.hex))).toEqual(new Set(['#CF809F']));
    expect(new Set(presets.map(item => JSON.stringify(materialSurface(item)))).size).toBe(5);
    const glass = presets.find(item => item.appearance!.templateId === 'translucent')!;
    expect(glass.transparency).toBe(0);
    expect(glass.optics).toMatchObject({ transmission: 0.85, thickness: 1.2 });
    expect(presets.find(item => item.appearance!.templateId === 'silk')!.metalness).toBe(0);
    expect(presets.find(item => item.appearance!.templateId === 'metallic')!.metalness).toBeLessThan(1);
  });
  it('resets optical lobes when reusing a GPU material for other finishes and legacy records', () => {
    const preview = (finish: 'silk' | 'translucent' | 'matte') => materialSurface(filamentPreview('CAILAB', 'PLA', undefined, finish, '#CF809F'));
    const entry = createPrintMaterial(preview('translucent'));
    expect(entry.material.transmission).toBe(0.85); expect(entry.material.opacity).toBe(1); expect(entry.material.transparent).toBe(false);
    expect(entry.uniforms.studioRoughness.value).toBe(0); expect(entry.uniforms.printThicknessWorld.value).toBe(1);
    applySurface(entry.material, preview('silk'));
    expect(entry.material.transmission).toBe(0); expect(entry.material.thickness).toBe(0); expect(entry.material.sheen).toBe(0.65);
    applySurface(entry.material, preview('matte'));
    expect(entry.material.sheen).toBe(0); expect(entry.material.clearcoat).toBe(0); expect(entry.material.roughness).toBe(0.85);
    applySurface(entry.material, { hex: '#FFFFFF', transparency: 0.2, metalness: 0, roughness: 0.1 });
    expect(entry.uniforms.studioRoughness.value).toBe(1); expect(entry.uniforms.printThicknessWorld.value).toBe(0); expect(entry.material.opacity).toBe(0.8); expect(entry.material.transmission).toBe(0);
    entry.material.dispose();
  });
  it('separates optional official identifiers from local IDs and preserves the complete relationship in JSON and CSV', () => {
    const preview = filamentPreview('CAILAB', 'PLA', 'cailab-matte', 'matte', '#808080');
    const color = createFilamentColor(preview, input, 'color-1');
    expect(color.hex).toBe('#CF809F'); expect(color.materialId).toBe('LOCAL-color-1');
    expect(color.appearance).toMatchObject({ seriesId: 'cailab-matte', vendor: 'CAILAB', baseMaterial: 'PLA', templateId: 'matte', colorCode: 'MY-01', sku: 'TEST-175-1KG', origin: 'user' });
    expect(color.supplier).toBeUndefined(); expect(validateMaterial(color, [])).toBeNull();
    expect(cloneMaterial(color)).toEqual(color);
    expect(filamentIdentity(color)).toEqual({ vendor: 'CAILAB', type: 'PLA' });
    expect(materialsCSV([color])).toContain('"cailab-matte","matte","MY-01","TEST-175-1KG","User color chart","user"');
    const noSku = createFilamentColor(preview, { ...input, sku: '', colorCode: '' }, 'color-2');
    expect(noSku.appearance!.sku).toBeUndefined(); expect(noSku.appearance!.colorCode).toBeUndefined();
    expect(preview.hex).toBe('#808080');
  });
  it('rejects cross-vendor relationships and invalid optical payloads before save or restore', () => {
    const color = createFilamentColor(filamentPreview('CAILAB', 'PLA', 'cailab-matte', 'matte', '#808080'), input, 'color');
    expect(validateMaterial({ ...color, appearance: { ...color.appearance!, vendor: 'SUNLU' } }, [])).toContain('series');
    expect(validateMaterial({ ...color, optics: { transmission: NaN } }, [])).toContain('光学');
    expect(validateMaterial({ ...color, optics: { attenuationDistance: 0 } }, [])).toContain('attenuation');
  });
});
