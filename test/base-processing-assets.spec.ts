import { readFile } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';
import { Box3, Mesh, MeshStandardMaterial, SRGBColorSpace, Vector3 } from 'three';
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
    const dispose = vi.spyOn(rendered.geometry, 'dispose'); library.dispose();
    expect(dispose).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
    library.dispose(); expect(dispose).toHaveBeenCalledOnce();
  } finally { library.dispose(); }
}, 15000);

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
