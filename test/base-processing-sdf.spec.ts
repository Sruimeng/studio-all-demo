import { beforeAll, expect, it } from 'vitest';
import createManifold, { type ManifoldToplevel } from 'manifold-3d';
import { BoxGeometry, Matrix4, Vector3 } from 'three';
import { createLocalSurfaceSdf } from '../app/@feature/base-processing/text-sdf';
import { joinBaseText } from '../app/@feature/base-processing/text-solid';
import { buildTextMesh } from '../app/@feature/base-processing/text-geometry';
import { buildBaseMesh } from '../app/@engine/base-processing/base';
import { conformTextToBase, subdivideText, textSurfaceOrientation } from '../app/@feature/base-processing/text-surface';
import { checkGeometry } from '../app/@engine/base-processing/geometry';
import type { MeshData } from '../app/@engine/base-processing';

let module: ManifoldToplevel;
beforeAll(async () => { module = await createManifold(); module.setup(); });
function transformed(mesh: MeshData, transform: Matrix4) {
  const positions = mesh.positions.slice(), p = new Vector3();
  for (let i = 0; i < positions.length; i += 3) p.fromArray(positions, i).applyMatrix4(transform).toArray(positions, i);
  return { positions, indices: mesh.indices };
}
function checked(mesh: MeshData) {
  expect(checkGeometry(mesh)).toEqual({ boundary: 0, nonManifold: 0, winding: 0, degenerate: 0, duplicates: 0 });
}
it('samples signed distances on both sides, refines to the surface and reuses its local cache', () => {
  let queries = 0;
  const field = createLocalSurfaceSdf(p => { queries++; return { point: new Vector3(p.x,p.y,0), normal: new Vector3(0,0,1), distance: Math.abs(p.z) }; }, 0.1);
  expect(field.sample(new Vector3(0.13,0.17,0.15))!.distance).toBeCloseTo(0.15);
  const count = queries; field.sample(new Vector3(0.13,0.17,0.15)); expect(queries).toBe(count);
  expect(field.sample(new Vector3(0.13,0.17,-0.15))!.distance).toBeCloseTo(-0.15);
  expect(field.project(new Vector3(0.13,0.17,0.15), new Vector3(0,0,1), 0.2)!.point.z).toBeCloseTo(0);
  expect(field.project(new Vector3(0.13,0.17,0.15), new Vector3(1,0,0), 0.2)).toBeNull();
  expect(field.project(new Vector3(0.13,0.17,0.15), new Vector3(0,0,1), 0.05)).toBeNull();
});
it.each([1, 0.05])('joins solid text at %sx without filling the O counter or losing its material domain', scale => {
  const base = buildBaseMesh('square', 40 * scale, 40 * scale, 4 * scale, 0), original = base.positions.slice();
  const letter = buildTextMesh('O');
  const transform = new Matrix4().makeRotationX(-Math.PI / 2).scale(new Vector3(scale,scale,scale)).setPosition(0,0.82 * scale,0);
  const text = transformed(letter, transform), result = joinBaseText(module, base, text);
  checked(result); expect(base.positions).toEqual(original);
  expect(result.volume).toBeGreaterThan(40 * 40 * 4 * scale ** 3);
  expect(new Set(result.faceMaterials)).toEqual(new Set([0,1]));
  // At letter height the central counter is still empty; no generated text
  // triangle crosses the central ray. Geometry keeps exact source outlines.
  const { Mesh, Manifold } = module;
  const solid = new Manifold(new Mesh({ numProp: 3, vertProperties: result.positions, triVerts: result.indices }));
  const probe = Manifold.cube([0.3*scale,0.5*scale,0.3*scale], true).translate([0,scale,0]);
  const inside = solid.intersect(probe);
  expect(inside.volume()).toBe(0); inside.delete(); probe.delete(); solid.delete();
});
it('joins curved text with a closed interface and rejects disconnected glyphs', () => {
  const base = buildBaseMesh('round',40,40,20,0), letter = buildTextMesh('O');
  const orientation = textSurfaceOrientation(new Vector3(0,0,1));
  const fitted = conformTextToBase(subdivideText(letter), base, new Vector3(0,-10,20), orientation,1,1.8)!;
  expect(fitted).not.toBeNull();
  const text = transformed(fitted.mesh,new Matrix4().makeTranslation(0,-10,20.82));
  const result = joinBaseText(module,base,text); checked(result);
  expect(() => joinBaseText(module,base,transformed(text,new Matrix4().makeTranslation(0,0,50)))).toThrow('未连接');
});
it('rejects open imported bases instead of silently exporting overlapping shells', () => {
  const g = new BoxGeometry(40,4,40); g.translate(0,-2,0);
  const base = { positions: new Float32Array(g.attributes.position!.array), indices: new Uint32Array(g.index!.array).slice(3) }; g.dispose();
  const text = transformed(buildTextMesh('O'),new Matrix4().makeTranslation(0,1,0));
  expect(() => joinBaseText(module,base,text)).toThrow('封闭');
});

it('seats the default standing word so rounded glyph overshoot cannot leave other letters floating', () => {
  const base = buildBaseMesh('round',60,60,10,0), letter = subdivideText(buildTextMesh('Text'));
  const metrics = buildTextMesh('Text');
  const text = transformed(letter,new Matrix4().makeTranslation(0, metrics.size[1]/2 - metrics.seatingOffset - 0.08, 12));
  checked(joinBaseText(module,base,text));
});
