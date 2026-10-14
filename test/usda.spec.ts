import { describe, expect, it } from 'vitest';
import { importUSDAMaterials } from '../app/@feature/materials/usda';
import { supplierMaterials, materialSurface, restoreSupplier, withOverrides } from '../app/@feature/materials/supplier';
import { validateMaterial } from '../app/@feature/materials/catalog';

const source = supplierMaterials.find(item => item.materialId === 'CA19017')!.supplier!;
const usda = (body = source.source.materialUSDA!) => new File([`#usda 1.0\n${body}`], 'sample.usda');
describe('USDA material import', () => {
  it('imports all supplied OpenPBR material blocks without geometry or SKU inference', async () => {
    for (const entry of supplierMaterials.filter(item => item.supplier?.source.file)) {
      const profile = entry.supplier!;
      const [material] = await importUSDAMaterials(usda(profile.source.materialUSDA!));
      expect(material!.supplier!.source.parameters).toMatchObject(profile.source.parameters);
      expect(material!.supplier).toMatchObject({ origin: 'local-usda', status: 'imported', catalogHex: null, vendor: '' });
      expect(material!.supplier!.source.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(materialSurface(material!).baseColor).toEqual(profile.source.parameters.base_color);
      expect(validateMaterial(material!, [])).toBeNull();
    }
  });
  it('keeps imported identity and source color when restoring local adjustments', async () => {
    const [material] = await importUSDAMaterials(usda());
    material!.materialId = 'LOCAL-17'; material!.name = 'Local';
    const edited = withOverrides({ ...material!, hex: '#123456', roughness: 0.1 });
    expect(materialSurface(edited).hex).toBe('#123456');
    const restored = restoreSupplier(edited);
    expect(restored).toMatchObject({ id: material!.id, materialId: 'LOCAL-17', name: 'Local', roughness: 0.45 });
    expect(materialSurface(restored).baseColor).toEqual(source.source.parameters.base_color);
  });
  it('imports multiple materials and supports schema defaults', async () => {
    const shader = (name: string) => `def Material "${name}" { token outputs:mtlx:surface.connect = </${name}/P.outputs:surface> def Shader "P" { uniform token info:id = "ND_open_pbr_surface_surfaceshader" } }`;
    const records = await importUSDAMaterials(usda(shader('A') + shader('B')));
    expect(records.map(item => item.name)).toEqual(['A', 'B']);
    expect(records[0]!.roughness).toBe(0.3);
  });
  it('rejects invalid files, unbound shaders, connections, composition and unsupported effects', async () => {
    await expect(importUSDAMaterials(new File(['binary'], 'file.usda'))).rejects.toThrow('header');
    await expect(importUSDAMaterials(new File(['#usda 1.0'], 'file.usd'))).rejects.toThrow('20');
    for (const [before, after, message] of [
      ['float inputs:transmission_weight = 0', 'float inputs:transmission_weight = 1', 'transmission_weight'],
      ['color3f inputs:base_color = (0.0330598, 0.219725, 0.354378)', 'color3f inputs:base_color.connect = </texture.outputs:rgb>', 'connected'],
      ['token outputs:mtlx:surface.connect', 'token outputs:unbound.connect', 'bound'],
    ]) {
      const text = source.source.materialUSDA!;
      expect(text).toContain(before);
      await expect(importUSDAMaterials(usda(text.replace(before, after)))).rejects.toThrow(message);
    }
    await expect(importUSDAMaterials(usda('subLayers = [@other.usda@]'))).rejects.toThrow('External');
    await expect(importUSDAMaterials(usda('def Material "Bad" {'))).rejects.toThrow('Incomplete');
  });
});

it('rejects unknown inputs, malformed numbers, vectors, types and commented output bindings', async () => {
  const text = source.source.materialUSDA!;
  for (const replacement of ['float inputs:unknown_lobe = 1', 'float inputs:base_weight = 1garbage', 'float inputs:base_weight = (1,1,1)', 'color3f inputs:base_color = (0.1,,0.3)', 'float inputs:base_weight.timeSamples = { 0: 1 }']) {
    await expect(importUSDAMaterials(usda(text.replace('float inputs:base_weight = 1', replacement)))).rejects.toThrow();
  }
  await expect(importUSDAMaterials(usda(text.replace('token outputs:mtlx:surface.connect', '# token outputs:mtlx:surface.connect')))).rejects.toThrow('bound');
});
