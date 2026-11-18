import { expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { loadCustomBase } from '../app/@feature/base-processing/custom-base';
import { hexToHSV, hsvToHex } from '../app/@feature/base-processing/color';

it('loads a local STL base with normalized bounds and its original dimensions', async () => {
  const mesh = new Mesh(new BoxGeometry(20, 4, 10), new MeshStandardMaterial());
  const stl = new STLExporter().parse(mesh);
  const asset = await loadCustomBase([new File([stl], 'base.stl')]);
  expect(asset.size).toEqual([20, 4, 10]); expect(asset.mesh.indices.length / 3).toBe(12);
  const ys = asset.mesh.positions.filter((_, i) => i % 3 === 1);
  expect(Math.min(...ys)).toBe(-1); expect(Math.max(...ys)).toBe(0);
  asset.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
});

it('loads local OBJ geometry and rejects missing, oversized or flat models', async () => {
  const asset = await loadCustomBase([new File(['v 0 0 0\nv 2 0 0\nv 0 1 0\nv 0 0 3\nf 1 2 3\nf 1 4 2\nf 1 3 4\nf 2 4 3\n'], 'base.obj')]);
  expect(asset.size).toEqual([2, 1, 3]); asset.dispose();
  await expect(loadCustomBase([new File([''], 'base.txt')])).rejects.toThrow('Select one');
  await expect(loadCustomBase([{ name: 'base.glb', size: 151 * 1024 * 1024 } as File])).rejects.toThrow('150 MB');
  await expect(loadCustomBase([new File(['v 0 0 0\nv 1 0 0\nv 0 0 1\nf 1 2 3'], 'flat.obj')])).rejects.toThrow('Invalid base dimensions');
});

it('round-trips preset and custom colors through the picker, including grayscale and hue boundaries', () => {
  for (const hex of ['#ffffff', '#000000', '#ffdb57', '#87cf9a', '#829efa', '#383a42', '#23748d', '#ff0000', '#00ff00', '#0000ff', '#ff00ff']) {
    expect(hsvToHex(...hexToHSV(hex))).toBe(hex);
  }
  expect(hsvToHex(120, 1, 0.5)).toBe('#008000'); expect(hsvToHex(359, 0, 1)).toBe('#ffffff');
});
