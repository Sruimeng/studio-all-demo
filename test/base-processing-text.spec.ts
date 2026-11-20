import { expect, it } from 'vitest';
import { Box3, BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { baseSurfaceHeight, buildTextMesh, textFonts } from '../app/@feature/base-processing/text-geometry';

it('builds centered solid text with actual depth and preserves counters in letters', () => {
  const data = buildTextMesh('O'), geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(data.positions, 3));
  const bounds = new Box3().setFromBufferAttribute(geometry.getAttribute('position'));
  expect(bounds.getCenter(new Vector3()).length()).toBeLessThan(1e-6); expect(data.size[2]).toBeCloseTo(1.8);
  const mesh = new Mesh(geometry, new MeshBasicMaterial()); mesh.updateMatrixWorld();
  const ray = new Raycaster(new Vector3(0, 0, 10), new Vector3(0, 0, -1));
  expect(ray.intersectObject(mesh)).toHaveLength(0);
  ray.ray.origin.x = data.size[0] * 0.4; expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
  expect(Array.from(data.positions).every(Number.isFinite)).toBe(true);
  expect(() => buildTextMesh('   ')).toThrow(); geometry.dispose(); mesh.material.dispose();
});

it('uses actual triangle surfaces and rejects gaps or points outside the mesh', () => {
  const mesh = { positions: new Float32Array([0, 0, 0, 10, 10, 0, 0, 0, 10, 0, -5, 0, 10, -5, 0, 0, -5, 10]), indices: new Uint32Array([0, 1, 2, 3, 4, 5]) };
  expect(baseSurfaceHeight(mesh, 3, 3)).toBeCloseTo(3);
  expect(baseSurfaceHeight(mesh, 8, 8)).toBeNull(); expect(baseSurfaceHeight(mesh, -1, 0)).toBeNull();
});

it('bends a closed solid without bridging surface gaps or modifying the source mesh', async () => {
  const { subdivideText, conformTextToBase, textSurfaceOrientation } = await import('../app/@feature/base-processing/text-surface');
  const { buildBaseMesh } = await import('../app/@engine/base-processing/base');
  const { cutMesh } = await import('../app/@engine/base-processing/geometry');
  const original = buildTextMesh('O'), before = original.positions.slice(), text = subdivideText(original);
  const base = buildBaseMesh('round', 40, 40, 20, 0);
  const fitted = conformTextToBase(text, base, new Vector3(0, -10, 20), textSurfaceOrientation(new Vector3(0, 0, 1)), 1, original.size[2]);
  expect(fitted).not.toBeNull(); expect(fitted!.curved).toBe(true); expect(original.positions).toEqual(before);
  const result = cutMesh(fitted!.mesh, { normal: [0, 1, 0], offset: -100, cap: true });
  expect(result.stats.boundary).toBe(0); expect(result.stats.nonManifold).toBe(0);
  expect(conformTextToBase(text, base, new Vector3(0, 0, 20), textSurfaceOrientation(new Vector3(0, 0, 1)), 1, original.size[2])).toBeNull();
});


it('uses distinct bundled font outlines with centered depth and open letter counters', () => {
  const widths = new Set<number>();
  for (const font of textFonts) {
    const data = buildTextMesh('O', font), geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(data.positions, 3));
    const mesh = new Mesh(geometry, new MeshBasicMaterial()); mesh.updateMatrixWorld();
    try {
      widths.add(data.size[0]); expect(data.size[2]).toBeCloseTo(1.8);
      expect(new Box3().setFromBufferAttribute(geometry.getAttribute('position')).getCenter(new Vector3()).length()).toBeLessThan(1e-6);
      expect(new Raycaster(new Vector3(0, 0, 10), new Vector3(0, 0, -1)).intersectObject(mesh)).toHaveLength(0);
      expect(Array.from(data.positions).every(Number.isFinite)).toBe(true);
    } finally { geometry.dispose(); mesh.material.dispose(); }
  }
  expect(widths.size).toBe(textFonts.length);
});


it('transports the text frame smoothly across the old top/side threshold', async () => {
  const { textSurfaceOrientation } = await import('../app/@feature/base-processing/text-surface');
  let frame = textSurfaceOrientation(new Vector3(0, 0.89, Math.sqrt(1 - 0.89 ** 2)));
  for (const y of [0.899, 0.901, 0.91, 0.95, 0.99, 1]) {
    const n = new Vector3(0, y, Math.sqrt(1 - y * y)), next = textSurfaceOrientation(n, frame);
    expect(frame.angleTo(next)).toBeLessThan(0.2);
    expect(new Vector3(0, 0, 1).applyQuaternion(next).distanceTo(n)).toBeLessThan(1e-6); frame = next;
  }
});

it('follows a round contour by arc length and keeps local thickness instead of stretching along a fixed ray', async () => {
  const { conformTextToBase, subdivideText, textSurfaceOrientation } = await import('../app/@feature/base-processing/text-surface');
  const { buildBaseMesh } = await import('../app/@engine/base-processing/base');
  const base = buildBaseMesh('round', 40, 40, 20, 0), label = subdivideText(buildTextMesh('TEXT'));
  const result = conformTextToBase(label, base, new Vector3(0, -10, 20), textSurfaceOrientation(new Vector3(0, 0, 1)), 1, 1.8)!;
  expect(result).not.toBeNull();
  for (let i = 0; i < label.positions.length; i += 3) {
    const z = label.positions[i + 2]!;
    if (Math.abs(Math.abs(z) - 0.9) > 1e-4) continue;
    const x = result.mesh.positions[i]!, worldZ = result.mesh.positions[i + 2]! + 20.9;
    // The bundled round mesh is polygonal (its chord is inside radius 20).
    expect(Math.abs(Math.hypot(x, worldZ) - (20 + z + 0.9))).toBeLessThan(0.12);
  }
  const paired = new Map<string, Vector3>();
  for (let i = 0; i < label.positions.length; i += 3) {
    const key = `${label.positions[i]},${label.positions[i + 1]}`;
    if (label.positions[i + 2]! < -0.89) paired.set(key, new Vector3().fromArray(result.mesh.positions,i));
  }
  let pairs = 0;
  for (let i = 0; i < label.positions.length; i += 3) {
    const back = paired.get(`${label.positions[i]},${label.positions[i + 1]}`);
    if (back && label.positions[i + 2]! > 0.89) { expect(back.distanceTo(new Vector3().fromArray(result.mesh.positions,i))).toBeCloseTo(1.8,4); pairs++; }
  }
  expect(pairs).toBeGreaterThan(20);

});

it('rejects a word spanning disconnected surfaces, including a gap between letters', async () => {
  const { conformTextToBase, subdivideText, textSurfaceOrientation, textBaseSurface } = await import('../app/@feature/base-processing/text-surface');
  const positions = new Float32Array([-12,-8,0, -2,-8,0, -2,8,0, -12,8,0, 2,-8,0, 12,-8,0, 12,8,0, 2,8,0]);
  const base = { positions, indices: new Uint32Array([0,1,2,0,2,3,4,5,6,4,6,7]) }, surface = textBaseSurface(base);
  const a = surface.raycast(new Vector3(-4,0,5), new Vector3(0,0,-1))!, b = surface.raycast(new Vector3(4,0,5), new Vector3(0,0,-1))!;
  expect(surface.follow(a,b,0.5)).toBeNull();
  expect(conformTextToBase(subdivideText(buildTextMesh('HI')),base,a.point,textSurfaceOrientation(a.normal),1,1.8)).toBeNull();
});
