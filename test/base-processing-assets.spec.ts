import createManifold from 'manifold-3d';
import { joinBaseText } from '../app/@feature/base-processing/text-solid';
import { Matrix4 } from 'three';
import { readFile } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';
import { Box3, Mesh, MeshStandardMaterial, SRGBColorSpace, Vector3 } from 'three';
import { buildTextMesh } from '../app/@feature/base-processing/text-geometry';
import { conformTextToBase, subdivideText, textBaseSurface, textSurfaceOrientation } from '../app/@feature/base-processing/text-surface';
import { cutMesh } from '../app/@engine/base-processing/geometry';
import { baseAssetPresets, createBaseAssetLibrary, resizeBaseAsset } from '../app/@feature/base-processing/base-assets';

afterEach(() => vi.unstubAllGlobals());

it.each(['black-disc', 'white-cloud'] as const)('loads the bundled %s with original normals/UVs, normalizes dimensions, caches and disposes it', async shape => {
  const bytes = await readFile(new URL(`../public${baseAssetPresets[shape].url}`, import.meta.url));
  const realFetch = globalThis.fetch, close = vi.fn();
  vi.stubGlobal('self', globalThis);
  // Texture decoding is a browser responsibility, exercised by the UI check.
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4, height: 4, close })));
  const fetchAsset = vi.fn((url: string | URL | Request, options?: RequestInit) => String(url).startsWith('blob:') ? realFetch(url, options) : Promise.resolve(new Response(bytes)));
  vi.stubGlobal('fetch', fetchAsset);
  const library = createBaseAssetLibrary();
  try {
    const pending = library.get(shape); expect(library.get(shape)).toBe(pending);
    const asset = await pending;
    expect(await library.get(shape)).toBe(asset);
    expect(fetchAsset.mock.calls.filter(([url]) => String(url) === baseAssetPresets[shape].url)).toHaveLength(1);
    const bounds = new Box3().setFromObject(asset.root);
    for (const value of bounds.getSize(new Vector3()).toArray()) expect(value).toBeCloseTo(1, 5);
    expect(bounds.max.y).toBeCloseTo(0, 6); expect(bounds.min.y).toBeCloseTo(-1, 6);
    expect(bounds.getCenter(new Vector3()).toArray()).toEqual([0, expect.closeTo(-0.5, 6), 0]);
    let rendered!: Mesh;
    asset.root.traverse(object => { if (object instanceof Mesh) rendered = object; });
    expect(rendered.geometry.getAttribute('normal').count).toBe(rendered.geometry.getAttribute('position').count);
    expect(rendered.geometry.getAttribute('uv').count).toBe(rendered.geometry.getAttribute('position').count);
    const material = rendered.material as MeshStandardMaterial;
    expect(material.map).toBeTruthy(); expect(material.map!.colorSpace).toBe(SRGBColorSpace);
    const mesh = resizeBaseAsset(asset, 50, 40, 10), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    mesh.positions.forEach((v, i) => { min[i % 3] = Math.min(min[i % 3]!, v); max[i % 3] = Math.max(max[i % 3]!, v); });
    expect(min).toEqual([-25, -10, -20]); expect(max).toEqual([25, 0, 20]);
    expect(asset.mesh.positions).not.toBe(mesh.positions); expect(mesh.indices).toBe(asset.mesh.indices);
    if (shape === 'black-disc') {
      const base = resizeBaseAsset(asset,50,50,10), surface = textBaseSurface(base);
      const hit = surface.raycast(new Vector3(0,30,10),new Vector3(0,-1,0))!;
      const orientation = textSurfaceOrientation(hit.normal), label = subdivideText(buildTextMesh('O'));
      const fitted = conformTextToBase(label,base,hit.point,orientation,0.4,1.8)!;
      expect(fitted).not.toBeNull();
      const transform = new Matrix4().compose(hit.point.clone().addScaledVector(hit.normal,0.9*0.4-0.08),orientation,new Vector3().setScalar(0.4));
      const positions = fitted.mesh.positions.slice(), point = new Vector3();
      for (let i=0;i<positions.length;i+=3) point.fromArray(positions,i).applyMatrix4(transform).toArray(positions,i);
      const module = await createManifold(); module.setup();
      const joined = joinBaseText(module,base,{positions,indices:fitted.mesh.indices});
      expect(joined.volume).toBeGreaterThan(0); expect(new Set(joined.faceMaterials)).toEqual(new Set([0,1]));
    }
    if (shape === 'white-cloud') {
      const cloud = resizeBaseAsset(asset, 50, 41.2, 7.45), surface = textBaseSurface(cloud), label = subdivideText(buildTextMesh('Text'));
      // These rays traverse curved lobes and the valleys of the user's GLB.
      const before = cloud.indices.slice();
      let previous: ReturnType<typeof surface.raycast> = null, orientation: ReturnType<typeof textSurfaceOrientation> | undefined;
      for (const angle of [25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45]) {
        const direction = new Vector3(Math.sin(angle * Math.PI / 180), 0, Math.cos(angle * Math.PI / 180));
        const hit = surface.raycast(direction.clone().multiplyScalar(40).setY(-1.5), direction.negate())!;
        expect(hit).not.toBeNull();
        const stable = surface.smooth(hit, 0.26);
        if (previous) expect(surface.follow(previous, stable, 0.3)).not.toBeNull();
        const nextOrientation = textSurfaceOrientation(stable.normal, orientation);
        if (orientation) expect(orientation.angleTo(nextOrientation)).toBeLessThan(0.25);
        orientation = nextOrientation; previous = stable;
        const fitted = conformTextToBase(label, cloud, stable.point, orientation, 0.4, 1.8);
        expect(fitted, `cloud lobe ${angle}°`).not.toBeNull();
        expect(Array.from(fitted!.mesh.positions).every(Number.isFinite)).toBe(true);
        if (angle === 45) {
          const stats = cutMesh(fitted!.mesh, { normal: [0, 1, 0], offset: -100, cap: true }).stats;
          expect(stats.boundary).toBe(0); expect(stats.nonManifold).toBe(0);
          const module = await createManifold(); module.setup();
          const transform = new Matrix4().compose(stable.point.clone().addScaledVector(stable.normal, 0.9 * 0.4 - 0.08), orientation, new Vector3().setScalar(0.4));
          const positions = fitted!.mesh.positions.slice(), point = new Vector3();
          for (let i = 0; i < positions.length; i += 3) point.fromArray(positions,i).applyMatrix4(transform).toArray(positions,i);
          const joined = joinBaseText(module,cloud,{positions,indices:fitted!.mesh.indices});
          expect(joined.volume).toBeGreaterThan(0); expect(new Set(joined.faceMaterials)).toEqual(new Set([0,1]));
        }
      }
      const groove = surface.raycast(new Vector3(40, -3.7, 0), new Vector3(-1, 0, 0))!;
      expect(conformTextToBase(label, cloud, groove.point, textSurfaceOrientation(groove.normal), 0.4, 1.8)).toBeNull();
      expect(cloud.indices.every((value, i) => value === before[i])).toBe(true);

    }
    const dispose = vi.spyOn(rendered.geometry, 'dispose'); library.dispose();
    expect(dispose).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
    library.dispose(); expect(dispose).toHaveBeenCalledOnce();
  } finally { library.dispose(); }
}, 45000);

it('evicts failed downloads so retry can fetch again, and aborts requests on disposal', async () => {
  const fetchAsset = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', fetchAsset);
  const library = createBaseAssetLibrary();
  await expect(library.get('black-disc')).rejects.toThrow('503');
  await expect(library.get('black-disc')).rejects.toThrow('503'); expect(fetchAsset).toHaveBeenCalledTimes(2);
  fetchAsset.mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))));
  const pending = library.get('white-cloud'); library.dispose();
  await expect(pending).rejects.toThrow('aborted');
  await expect(library.get('white-cloud')).rejects.toThrow('disposed');
});
