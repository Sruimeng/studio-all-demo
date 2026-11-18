import { describe, expect, it } from 'vitest';
import { BoxGeometry, BufferGeometry, ExtrudeGeometry, Path, Shape, TorusGeometry } from 'three';
import { checkGeometry, cutMesh, cutSTL, normalized, weldMesh } from '../app/@engine/base-processing';
import type { CutPlane, CutResult, MeshData } from '../app/@engine/base-processing';

function mesh(geometry: BufferGeometry): MeshData {
  const positions = new Float32Array(geometry.getAttribute('position').array);
  const indices = geometry.index ? new Uint32Array(geometry.index.array) : Uint32Array.from({ length: positions.length / 3 }, (_, i) => i);
  geometry.dispose(); return { positions, indices };
}
const cube = () => mesh(new BoxGeometry(20, 20, 20));
const bottom: CutPlane = { normal: [0, 1, 0], offset: 0, cap: true };
function closed(result: MeshData) {
  expect(checkGeometry(result)).toEqual({ boundary: 0, nonManifold: 0, winding: 0, degenerate: 0, duplicates: 0 });
}
function volume(m: MeshData) {
  let total = 0;
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, b, c] = Array.from(m.indices.subarray(i, i + 3), id => Array.from(m.positions.subarray(id * 3, id * 3 + 3)));
    total += a![0]! * (b![1]! * c![2]! - b![2]! * c![1]!) + a![1]! * (b![2]! * c![0]! - b![0]! * c![2]!) + a![2]! * (b![0]! * c![1]! - b![1]! * c![0]!);
  }
  return total / 6;
}
function capArea(r: CutResult) {
  let area = 0;
  for (let i = r.surfaceIndexCount; i < r.indices.length; i += 3) {
    const [a, b, c] = Array.from(r.indices.subarray(i, i + 3), id => Array.from(r.positions.subarray(id * 3, id * 3 + 3)));
    const u = b!.map((v,k) => v - a![k]!), v = c!.map((v,k) => v - a![k]!);
    area += Math.hypot(u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!) / 2;
  }
  return area;
}
describe('base processing geometry', () => {
  it('cuts and seals a box without changing the input buffers', () => {
    const source = cube(), p = source.positions.slice(), idx = source.indices.slice();
    const result = cutMesh(source, bottom);
    closed(result); expect(volume(result)).toBeCloseTo(4000, 4); expect(capArea(result)).toBeCloseTo(400, 4);
    expect(result.stats.capFaces).toBeGreaterThan(0); expect(result.stats.capDeviation).toBeLessThan(1e-5);
    expect(source.positions).toEqual(p); expect(source.indices).toEqual(idx);
  });
  it.each([[1,1,0], [1,1,1], [0.17, 0.92, -0.63]] as [number,number,number][])('handles an oblique plane through edges and vertices (%j)', (...normal) => {
    const result = cutMesh(cube(), { ...bottom, normal });
    closed(result); expect(volume(result)).toBeCloseTo(4000, 2); expect(result.stats.capDeviation).toBeLessThan(0.00001);
  });
  it('handles a plane coinciding with the existing base without duplicate caps', () => {
    const result = cutMesh(cube(), { ...bottom, offset: -10 });
    closed(result); expect(volume(result)).toBeCloseTo(8000, 4); expect(result.stats.capFaces).toBe(0);
  });
  it('retains the opposite side when the plane is flipped', () => {
    const a = cutMesh(cube(), { ...bottom, offset: 3 });
    const b = cutMesh(cube(), { ...bottom, normal: [0,-1,0], offset: -3 });
    closed(a); closed(b); expect(volume(a) + volume(b)).toBeCloseTo(8000, 4);
    expect(Math.max(...b.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(3);
  });
  it('preserves an annular hole rather than filling a disk', () => {
    const source = mesh(new TorusGeometry(10, 3, 16, 64));
    const result = cutMesh(source, { normal: [0,0,1], offset: 0, cap: true });
    closed(result); expect(result.stats.loops).toBe(2);
    expect(volume(result)).toBeCloseTo(volume(weldMesh(source)) / 2, 2);
    expect(capArea(result)).toBeCloseTo(0.5 * 64 * Math.sin(2 * Math.PI / 64) * (13 ** 2 - 7 ** 2), 2);
    for (let i = result.surfaceIndexCount; i < result.indices.length; i += 3) {
      const ids = Array.from(result.indices.subarray(i,i+3));
      const x = ids.reduce((s,id) => s + result.positions[id*3]!,0)/3;
      const y = ids.reduce((s,id) => s + result.positions[id*3+1]!,0)/3;
      expect(Math.hypot(x,y)).toBeGreaterThan(6.9);
    }
  });
  it('seals a concave L-shaped section with a hole', () => {
    const shape = new Shape(); shape.moveTo(0,0); shape.lineTo(8,0); shape.lineTo(8,3); shape.lineTo(3,3); shape.lineTo(3,8); shape.lineTo(0,8); shape.closePath();
    const hole = new Path(); hole.moveTo(1,1); hole.lineTo(1,2); hole.lineTo(2,2); hole.lineTo(2,1); hole.closePath(); shape.holes.push(hole);
    const source = mesh(new ExtrudeGeometry(shape, { depth: 4, bevelEnabled: false, steps: 3 }));
    const result = cutMesh(source, { normal:[0,0,1], offset: 2, cap:true });
    closed(result); expect(capArea(result)).toBeCloseTo(38,4); expect(volume(result)).toBeCloseTo(76,4);
  });
  it('caps disconnected components separately', () => {
    const a = cube(), b = cube(); for (let i=0;i<b.positions.length;i+=3) b.positions[i]! += 40;
    const source = { positions: new Float32Array([...a.positions,...b.positions]), indices: new Uint32Array([...a.indices,...b.indices.map(i=>i+a.positions.length/3)]) };
    const result = cutMesh(source,bottom); closed(result); expect(result.stats.loops).toBe(2); expect(volume(result)).toBeCloseTo(8000,4);
  });
  it('leaves the cut open only when sealing is disabled', () => {
    const result = cutMesh(cube(),{...bottom,cap:false}); expect(result.stats.boundary).toBeGreaterThan(0); expect(result.stats.capFaces).toBe(0);
  });
  it('reports existing defects and refuses an unclosed cut contour', () => {
    const source = weldMesh(cube());
    const awayFromCut = { ...source, indices: source.indices.slice(0,-6) };
    expect(() => cutMesh(awayFromCut,bottom)).toThrow(/contour/i);
    const topMissing = { ...source, indices: new Uint32Array([...source.indices.slice(0,12),...source.indices.slice(18)]) };
    expect(cutMesh(topMissing,bottom).stats.boundary).toBeGreaterThan(0);
  });
  it('rejects invalid planes, empty data, and removal of the whole model', () => {
    expect(() => cutMesh(cube(), {...bottom,normal:[0,0,0]})).toThrow();
    expect(() => cutMesh(cube(), {...bottom,offset:NaN})).toThrow();
    expect(() => cutMesh(cube(), {...bottom,offset:10})).toThrow(/entire model/);
    expect(() => cutMesh({positions:new Float32Array(),indices:new Uint32Array()},bottom)).toThrow();
  });
  it('exports millimetres with the selected base lying at Z=0', () => {
    const result = cutMesh(cube(), {...bottom,offset:3}), data = new DataView(cutSTL(result));
    expect(data.getUint32(80,true)).toBe(result.indices.length/3);
    expect(data.byteLength).toBe(84+50*result.indices.length/3);
    const zs:number[]=[];
    for(let f=0;f<data.getUint32(80,true);f++) for(let c=0;c<3;c++) zs.push(data.getFloat32(84+f*50+12+c*12+8,true));
    expect(Math.min(...zs)).toBe(0); expect(Math.max(...zs)).toBe(7);
    expect(normalized([0,2,0])).toEqual([0,1,0]);
  });
});


it('seals compound oblique cuts without degenerate ears or duplicate boundary edges', () => {
  const source = mesh(new BoxGeometry(80,80,80).translate(0,40,0));
  // This normalized quaternion-derived normal used to create a near-zero-area ear.
  const normal: [number,number,number] = [-0.42261826174069966, 0.875426098065593, 0.23456971600980453];
  const offset = normal[1] * 4;
  const a = cutMesh(source, {normal,offset,cap:true});
  const b = cutMesh(source, {normal: normal.map(v => -v) as [number,number,number],offset:-offset,cap:true});
  closed(a); closed(b);
  expect(volume(a) + volume(b)).toBeCloseTo(80 ** 3, 1);
  expect(capArea(a)).toBeCloseTo(capArea(b), 2);
});

it('exports a combined model and high-detail pedestal above the cutting face limit', () => {
  const result = cutMesh(cube(), bottom), faces = 2_000_001;
  const indices = new Uint32Array(faces * 3);
  for (let i = 0; i < indices.length; i++) indices[i] = result.indices[i % 3]!;
  const combined = { ...result, indices };
  expect(() => cutMesh(combined, bottom)).toThrow(/2 million/);
  const data = new DataView(cutSTL(combined));
  expect(data.getUint32(80, true)).toBe(faces); expect(data.byteLength).toBe(84 + faces * 50);
}, 15000);
