import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial, LinearSRGBColorSpace, SRGBColorSpace, Color } from 'three';
import { supplierMaterials, supplierCatalog, cloneMaterial, materialSurface, materialProblem, restoreSupplier, withOverrides } from '../app/@feature/materials/supplier';
import { validateMaterial, materialsCSV } from '../app/@feature/materials/catalog';
import { createPrintMaterial, applySurface, patchStudioMaterial } from '../app/@engine/viewer/material';

const source = (sku: string) => cloneMaterial(supplierMaterials.find(material => material.materialId === sku)!);
describe('supplier material adaptation', () => {
  it('retains all sheet rows and unmatched USDA records without enabling unconfirmed SKUs', () => {
    expect(supplierCatalog.records).toHaveLength(28);
    expect(supplierCatalog.records.filter(record => record.source.row !== null)).toHaveLength(26);
    expect(supplierCatalog.records.filter(record => record.source.file)).toHaveLength(16);
    expect(supplierCatalog.records.filter(record => record.status === 'paired')).toHaveLength(14);
    for (const material of supplierMaterials) expect(validateMaterial(material, supplierMaterials)).toBeNull();
    expect(materialProblem(source('CA19010'))).toContain('未对应');
    expect(source('CA19006').supplier!.issues).toContain('lab-conflicts-with-color-name');
    expect(source('CA19027').supplier!.issues).toContain('lab-conflicts-with-color-name');
  });
  it('uses catalog HEX by default and retains unbounded source color for explicit experimental interpretation', () => {
    const material = source('CA19009');
    expect(material.supplier!.source.parameters.base_color).toEqual([1.0947, 0.246051, 0.742067]);
    expect(materialSurface(material).baseColor).toBeUndefined();
    const entry = createPrintMaterial(materialSurface(material));
    material.overrides = { colorMode: 'linear-srgb' };
    applySurface(entry.material, materialSurface(material));
    expect(entry.material.color.r).toBeCloseTo(1.0947);
    material.overrides.colorMode = 'srgb';
    applySurface(entry.material, materialSurface(material));
    expect(entry.material.color.r).toBeCloseTo(new Color().setRGB(1.0947, 0, 0, SRGBColorSpace).r);
    material.overrides.hex = '#123456';
    applySurface(entry.material, materialSurface(material));
    expect(entry.material.color.getHexString()).toBe('123456');
    entry.material.dispose();
  });
  it('changes render rules on an existing material and resets IOR and source color when switching back', () => {
    const entry = createPrintMaterial(materialSurface(source('CA19017')));
    expect(entry.uniforms.studioRoughness.value).toBe(0);
    expect(entry.material.roughness).toBe(0.45);
    expect(entry.material.ior).toBe(1.5);
    applySurface(entry.material, { hex: '#FF0000', roughness: 0.2, metalness: 0, transparency: 0 });
    expect(entry.uniforms.studioRoughness.value).toBe(1);
    expect(entry.material.color.getRGB(new Color(), LinearSRGBColorSpace).r).toBe(1);
    entry.material.dispose();
    const original = new MeshStandardMaterial();
    expect(patchStudioMaterial(original).studioRoughness.value).toBe(1);
    original.dispose();
  });
  it('keeps source values immutable while local edits can be restored', () => {
    const original = source('CA19017');
    const edited = withOverrides({ ...original, roughness: 0.1, hex: '#ABCDEF' });
    expect(edited.overrides).toMatchObject({ roughness: 0.1, hex: '#ABCDEF' });
    expect(edited.supplier!.source.parameters.specular_roughness).toBe(0.45);
    edited.supplier!.issues.push('local');
    expect(original.supplier!.issues).not.toContain('local');
    expect(restoreSupplier(edited).roughness).toBe(0.45);
    expect(restoreSupplier(edited).hex).toBe(original.hex);
    expect(restoreSupplier(edited).overrides).toEqual({});
  });
  it('rejects active unsupported lobes rather than silently approximating them', () => {
    const material = source('CA19017'); material.supplier!.source.parameters.transmission_weight = 0.5;
    expect(materialProblem(material)).toContain('transmission_weight');
    expect(validateMaterial({ ...source('CA19017'), overrides: { roughness: NaN } }, [])).not.toBeNull();
  });
  it('exports missing SKU colors as unavailable instead of exporting the internal placeholder', () => {
    const csv = materialsCSV([source('CA19010')]);
    expect(csv).toContain('"CA19010","CA19010","","","",""');
    expect(csv).not.toContain('#808080');
    expect(csv).toContain('"unmatched"');
  });
});
