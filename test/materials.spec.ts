import { initialMaterials } from './fixtures/materials';
import { describe, expect, it } from 'vitest';
import { validateMaterial, materialsCSV } from '../app/@feature/materials/catalog';
import { MeshPhysicalMaterial } from 'three';
import { applySurface } from '../app/@engine/viewer/material';
describe('material data contract', () => {
  it('rejects duplicate user IDs but permits same color with distinct IDs', () => {
    const material = { ...initialMaterials[0]!, id: 'different', materialId: 'PLA-001' };
    expect(validateMaterial(material, initialMaterials)).toContain('already exists');
    material.materialId = 'other'; expect(validateMaterial(material, initialMaterials)).toBeNull();
  });
  it('exports input values and renders transparency independently of roughness', () => {
    const material = { ...initialMaterials[0]!, transparency: 0.75, roughness: 0, metalness: 1 };
    const display = new MeshPhysicalMaterial(); applySurface(display, material);
    expect(display.opacity).toBe(0.25); expect(display.metalness).toBe(1); expect(display.roughness).toBe(0);
    const csv = materialsCSV([material]); expect(csv).toContain('"0.75","1","0"'); expect(csv).toContain('roughnessFinal=0.5');
  });
  it('rejects malformed colors and non-finite parameters', () => {
    expect(validateMaterial({ ...initialMaterials[0]!, roughness: NaN }, [])).not.toBeNull();
    expect(validateMaterial({ ...initialMaterials[0]!, hex: '#f00' }, [])).not.toBeNull();
  });
  it('escapes CSV names and formula-like IDs', () => {
    expect(materialsCSV([{ ...initialMaterials[0]!, materialId: '=SUM(A1)', name: 'snow, "white"' }])).toContain('"\'=SUM(A1)","snow, ""white"""');
  });
});
