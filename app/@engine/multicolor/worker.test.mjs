import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import vm from 'node:vm';
import { inflateRawSync } from 'node:zlib';
import * as upstream from '../../../packages/color-quantization/index.js';
import { sampleFaces } from '../../../packages/color-quantization/vendor/quantize.js';

const quantizationAPI = { ...upstream, sampleFaces };
const workerRoot = new URL('../../../public/print-worker/', import.meta.url);

function createRuntime(imagePixels) {
  const pending = new Map();
  const context = vm.createContext({
    Blob, CompressionStream, TextEncoder, console, structuredClone,
    Float32Array, Float64Array, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int8Array, Int32Array, ArrayBuffer,
    MCQuantizationAPI: quantizationAPI,
    postMessage(message) {
      if (message.type !== 'progress') {
        const done = pending.get(message.requestId);
        pending.delete(message.requestId);
        done?.(message);
      }
    },
  });
  context.self = context;
  if (imagePixels) {
    context.createImageBitmap = async () => ({ width: 8, height: 8, close() {} });
    context.OffscreenCanvas = class {
      getContext() { return { drawImage() {}, getImageData() { return { data: imagePixels }; } }; }
    };
  }
  context.importScripts = (...paths) => {
    for (const path of paths) vm.runInContext(readFileSync(new URL(path, workerRoot), 'utf8'), context);
  };
  vm.runInContext(readFileSync(new URL('worker.js', workerRoot), 'utf8'), context);
  let id = 0;
  const request = (type, payload = {}, revision = 0, projectId = 'test') => new Promise((resolve) => {
    const requestId = ++id;
    pending.set(requestId, resolve);
    context.onmessage({ data: { ...payload, type, projectId, requestId, editRevision: revision } });
  });
  return { request, context };
}

function model() {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    faceMat: new Uint16Array([0, 1]), uvs: null, colors: null,
    materials: [{ image: -1, factor: [1, 0, 0] }, { image: -1, factor: [0, 0, 1] }],
    images: [],
  };
}

const options = { slotHex: ['#FF0000', '#0000FF'], precision: 6, scale: 80 };

function baseColorModel() {
  const colors = [20, 80, 140, 200, 240];
  const positions = [];
  const indices = [];
  const vertexColors = [];
  for (let face = 0; face < colors.length; face += 1) {
    const vertex = face * 3;
    positions.push(face, 0, 0, face + 0.8, 0, 0, face + 0.4, 0.7, 0);
    indices.push(vertex, vertex + 1, vertex + 2);
    vertexColors.push(...Array(3).fill([colors[face], colors[face], colors[face]]).flat());
  }
  return {
    positions: new Float32Array(positions), indices: new Uint32Array(indices), faceMat: new Uint16Array(colors.length),
    uvs: null, colors: new Float32Array(vertexColors), materials: [{ image: -1, factor: [1, 1, 1] }], images: [],
  };
}

async function labeledRuntime() {
  const runtime = createRuntime();
  assert.equal((await runtime.request('init', model())).type, 'init');
  const response = await runtime.request('label', options);
  assert.equal(response.type, 'label');
  assert.deepEqual(Array.from(response.label), [0, 1]);
  return runtime;
}

async function unzip(blob) {
  const bytes = Buffer.from(await blob.arrayBuffer());
  const files = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const method = bytes.readUInt16LE(offset + 8);
    const size = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extra = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 30, offset + 30 + nameLength).toString();
    const begin = offset + 30 + nameLength + extra;
    const compressed = bytes.subarray(begin, begin + size);
    files.set(name, (method === 8 ? inflateRawSync(compressed) : compressed).toString());
    offset = begin + size;
  }
  return files;
}

test('paint, connected fill, undo and reset preserve the automatic regions', async () => {
  const { request } = await labeledRuntime();
  const painted = await request('paintHigh', { faces: new Uint32Array([0, 0]), label: 1 });
  assert.deepEqual(Array.from(painted.label), [1, 1]);
  const undone = await request('undo');
  assert.deepEqual(Array.from(undone.label), [0, 1]);
  const filled = await request('fillHigh', { seed: 0, label: 1, tol: 0 });
  assert.deepEqual(Array.from(filled.faces), [0]);
  assert.deepEqual(Array.from((await request('reset')).label), [0, 1]);
});

test('segmentation is independent of the legacy lightness tolerance flag', async () => {
  const { request } = createRuntime();
  assert.equal((await request('init', baseColorModel())).type, 'init');
  const palette = { slotHex: ['#2F7D57', '#217D0B', '#D8CEC3'], precision: 6, scale: 80 };
  const baseColor = await request('label', { ...palette, shadeTol: false });
  const legacyFlag = await request('label', { ...palette, shadeTol: true });
  assert.deepEqual(Array.from(legacyFlag.label), Array.from(baseColor.label));
});

test('owned palette selects only the supplied SKU candidates and reports source color and Delta E', async () => {
  const { request } = createRuntime();
  assert.equal((await request('init', model())).type, 'init');
  const cands = [{ id: 'red-sku', hex: '#FF0000' }, { id: 'blue-sku', hex: '#0000FF' }, { id: 'unused', hex: '#00FF00' }];
  const result = await request('palette', { mode: 'owned', N: 2, protect: true, cands });
  assert.equal(result.type, 'palette');
  assert.deepEqual(Array.from(result.slots, slot => slot.filamentId).sort(), ['blue-sku', 'red-sku']);
  assert.ok(result.slots.every(slot => /^#[0-9A-F]{6}$/.test(slot.sourceHex)));
  assert.ok(result.slots.every(slot => slot.de < 0.3 && Math.abs(slot.w - 0.5) < 0.01));
  const labeled = await request('label', { ...options, slotHex: result.slots.map(slot => slot.sourceHex) });
  assert.deepEqual(Array.from(labeled.label, index => result.slots[index].filamentId), ['red-sku', 'blue-sku']);
  const limited = await request('palette', { mode: 'owned', N: 1, cands });
  assert.equal(limited.slots.length, 1);
  assert.ok(limited.slots[0].de > 0);
  const expanded = await request('palette', { mode: 'owned', N: 3, cands });
  assert.equal(expanded.slots.length, 2);
});

test('SKU color distance uses standard lightness weight for neutral colors', async () => {
  const { request, context } = createRuntime();
  const input = model();
  input.materials = [{ image: -1, factor: [0.5, 0.5, 0.5] }];
  input.faceMat.fill(0);
  await request('init', input);
  const result = await request('palette', { mode: 'owned', N: 1, cands: [{ id: 'dark', hex: '#404040' }] });
  const source = context.MC.oklabToLab(...result.slots[0].ok);
  const candidate = context.MC.hexToLab('#404040');
  const expected = context.MC.deltaE00(...source, ...candidate, 1);
  assert.ok(Math.abs(result.slots[0].de - expected) < 0.01);
});

test('snapshot restores overrides and rejects a different mesh with the same face count', async () => {
  const { request } = await labeledRuntime();
  await request('paintHigh', { faces: new Uint32Array([0]), label: 1 });
  const { snapshot } = await request('snapshot');
  await request('reset');
  assert.deepEqual(Array.from((await request('restore', { snapshot })).label), [1, 1]);
  const other = model();
  other.positions[0] = 2;
  await request('init', other);
  assert.equal((await request('restore', { snapshot })).type, 'error');
});

test('requests are serialized, project isolated, and stale edits rejected', async () => {
  const { request } = createRuntime();
  const init = request('init', model(), 4);
  const label = request('label', options, 4);
  assert.equal((await init).type, 'init');
  assert.equal((await label).type, 'label');
  assert.equal((await request('paintHigh', { faces: new Uint32Array([0]), label: 1 }, 3)).type, 'error');
  assert.equal((await request('snapshot', {}, 4, 'different-project')).type, 'error');
  assert.deepEqual(Array.from((await request('snapshot', {}, 4)).snapshot.labels), [0, 1]);
});

test('3MF retains distinct same-color material IDs and millimeter geometry', async () => {
  const { request } = await labeledRuntime();
  const result = await request('export3mf', {
    scheme: 'high', scale: 80, name: 'A&B', withConfig: true,
    filaments: [{ hex: '#FF0000', id: 'metal' }, { hex: '#FF0000', id: 'clear' }],
    materialData: [{ id: 'metal', metalness: 1 }, { id: 'clear', transparency: 0.75 }],
  });
  assert.equal(result.type, 'export');
  const files = await unzip(result.blob);
  const xml = files.get('3D/3dmodel.model');
  assert.match(xml, /unit="millimeter"/);
  assert.match(xml, /name="Application">Tripo Demo</);
  assert.match(xml, /A&amp;B/);
  assert.match(xml, /name="metal" displaycolor="#FF0000FF"/);
  assert.match(xml, /name="clear" displaycolor="#FF0000FF"/);
  assert.match(xml, /z="80"/);
  assert.match(xml, /pid="2" p1="0" paint_color="4"/);
  assert.match(xml, /pid="2" p1="1" paint_color="8"/);
  const metadata = JSON.parse(files.get('Metadata/materials.json'));
  assert.deepEqual(metadata.slots.map(s => s.id), ['metal', 'clear']);
  assert.equal(metadata.materialData[1].transparency, 0.75);
});

test('four-color self-test emits all four leaf codes', async () => {
  const { request } = createRuntime();
  const result = await request('selftest');
  assert.equal(result.type, 'export');
  const files = await unzip(result.blob);
  assert.equal(result.code, '480C1C3');
  assert.match(files.get('3D/3dmodel.model'), /paint_color="480C1C3"/);
  assert.equal(JSON.parse(files.get('Metadata/materials.json')).slots.length, 4);
});

test('low-mesh projection preserves paint and snapshot across restore', async () => {
  const { request } = await labeledRuntime();
  const low = await request('lowpoly', { ...options, target: 0 });
  assert.equal(low.type, 'lowpoly');
  assert.equal(low.leafFace.length, low.leafLab.length);
  assert.ok(low.leafLab.includes(0));
  assert.ok(low.leafLab.includes(1));
  const { snapshot } = await request('snapshot');
  const restored = await request('restore', { snapshot });
  assert.equal(restored.type, 'restore');
  assert.deepEqual(Array.from(restored.low.leafLab), Array.from(low.leafLab));
});

test('UV brush, fill, undo and restored overrides survive label regeneration', async () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const offset = (y * 8 + x) * 4;
    pixels[offset + (x < 4 ? 0 : 2)] = 255;
    pixels[offset + 3] = 255;
  }
  const { request } = createRuntime(pixels);
  const input = model();
  input.uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  input.images = [new Blob(['test image'])];
  input.materials = [{ image: 0, factor: [1, 1, 1] }];
  input.faceMat = new Uint16Array(2);
  assert.equal((await request('init', input)).type, 'init');
  const lowOptions = { ...options, target: 0 };
  assert.equal((await request('lowpoly', lowOptions)).stats.low.hasUv, true);
  await request('paintLow', { dabs: [{ img: 0, u: 0.2, v: 0.2, r: 0.2, label: 1 }] });
  let result = await request('snapshot');
  assert.ok(result.snapshot.lowOverrides[0].includes(1));
  await request('undo');
  result = await request('snapshot');
  assert.ok(result.snapshot.lowOverrides[0].every(value => value === -1));
  const fill = await request('fillLow', { img: 0, u: 0.15, v: 0.15, tol: 0, label: 1 });
  assert.ok(fill.count > 0);
  const { snapshot } = await request('snapshot');
  const before = await request('lowpoly', lowOptions);
  await request('reset');
  const restored = await request('restore', { snapshot });
  assert.deepEqual(Array.from(restored.low.leafLab), Array.from(before.leafLab));
  assert.deepEqual(Array.from((await request('snapshot')).snapshot.lowOverrides[0]), Array.from(snapshot.lowOverrides[0]));
});


test('BVH brush dabs form a single undo operation and reject invalid coordinates', async () => {
  const { request } = await labeledRuntime();
  const result = await request('brushHigh', { hits: [{ face: 0, point: [0.6, 0.2, 0], radius: 0.1 }, { face: 1, point: [0.2, 0.8, 0], radius: 0.1 }], label: 1 });
  assert.notEqual(result.type, 'error');
  assert.equal(result.left, 1);
  assert.deepEqual(Array.from(result.label), [1, 1]);
  assert.deepEqual(Array.from((await request('undo')).label), [0, 1]);
  assert.equal((await request('brushHigh', { hits: [{ face: 0, point: [NaN, 0, 0], radius: 1 }], label: 1 })).type, 'error');
});


test('one UV stroke across texture slots is undone together', async () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4).fill(255);
  const { request } = createRuntime(pixels);
  const input = model(); input.uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  input.images = [new Blob(['test'])]; input.materials = [{ image: 0, factor: [1, 0, 0] }, { image: 0, factor: [0, 0, 1] }];
  await request('init', input); await request('lowpoly', { ...options, target: 0 });
  const result = await request('paintLow', { dabs: [{ img: 0, u: 0.5, v: 0.5, r: 0.2, label: 1 }, { img: 1, u: 0.5, v: 0.5, r: 0.2, label: 1 }] });
  assert.equal(result.left, 1);
  await request('undo');
  const { snapshot } = await request('snapshot');
  assert.ok(snapshot.lowOverrides.every(o => o.every(value => value === -1)));
});

test('texture sampling multiplies authored vertex color in linear space', async () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4).fill(255);
  const { request } = createRuntime(pixels);
  const input = model(); input.uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  input.faceMat = new Uint16Array(2); input.images = [new Blob(['test'])];
  input.materials = [{ image: 0, factor: [1, 1, 1], vertexColors: true }];
  input.vertexFactors = new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]);
  const init = await request('init', input); assert.ok(init.warnings.some(w => w.includes('vertex-color')));
  const result = await request('label', options); assert.deepEqual(Array.from(result.label), [0, 0]);
});

test('preserves exact face colors even when every region matches the same SKU', async () => {
  const { request } = createRuntime();
  const input = baseColorModel();
  const info = await request('init', input);
  assert.equal(info.sourceColors.length, 5);
  const result = await request('preserve', { cands: [{ id: 'single', hex: '#808080' }], scale: 80 });
  assert.equal(result.type, 'preserve');
  assert.deepEqual(Array.from(result.label), [0, 1, 2, 3, 4]);
  assert.equal(result.slots.length, 5);
  assert.ok(result.slots.every(s => s.filamentId === 'single'));
  assert.ok(Math.abs(result.slots.reduce((sum, s) => sum + s.w, 0) - 1) < 1e-8);
  await request('paintHigh', { faces: new Uint32Array([0]), label: 4 });
  const snap = (await request('snapshot')).snapshot;
  await request('preserve', { cands: [{ id: 'other', hex: '#000000' }], scale: 80 });
  assert.deepEqual(Array.from((await request('restore', { snapshot: snap })).label), [4, 1, 2, 3, 4]);
  assert.deepEqual(Array.from((await request('reset')).label), [0, 1, 2, 3, 4]);
});

test('keeps 13 source slots through snapshot and 3MF export', async () => {
  const input = baseColorModel();
  const count = 13;
  input.positions = new Float32Array(count * 9);
  input.indices = new Uint32Array(count * 3);
  input.colors = new Float32Array(count * 9);
  input.faceMat = new Uint16Array(count);
  for (let f = 0; f < count; f++) {
    input.positions.set([f * 2, 0, 0, f * 2 + 1, 0, 0, f * 2, 1, 0], f * 9);
    input.indices.set([f * 3, f * 3 + 1, f * 3 + 2], f * 3);
    input.colors.fill(10 + f * 17, f * 9, f * 9 + 9);
  }
  const { request } = createRuntime();
  assert.equal((await request('init', input)).sourceColors.length, count);
  const result = await request('preserve', { cands: [{ id: 'one', hex: '#808080' }], scale: 80 });
  const snap = (await request('snapshot')).snapshot;
  assert.equal(snap.slotCount, count);
  assert.equal((await request('restore', { snapshot: snap })).label[12], 12);
  const exported = await request('export3mf', { scheme: 'high', scale: 80, name: 'source', filaments: result.slots.map((s, i) => ({ id: `sku-${i}`, hex: s.hex })), materialData: { regionSource: 'imported' } });
  assert.equal(exported.type, 'export');
  const entries = await unzip(exported.blob);
  const xml = entries.get('3D/3dmodel.model');
  assert.match(xml, /p1="12"/);
  assert.equal(JSON.parse(entries.get('Metadata/materials.json')).slots.length, count);
});

test('does not mistake vertex gradients or textures for preserved face colors', async () => {
  const input = baseColorModel(); input.colors[3] += 5;
  const { request } = createRuntime();
  assert.equal((await request('init', input)).sourceColors, null);
  assert.equal((await request('preserve', { cands: [{ id: 'one', hex: '#808080' }], scale: 80 })).type, 'error');
});

test('textured models retain the automatic segmentation path', async () => {
  const input = baseColorModel();
  input.materials[0].image = 0; input.images = [new Blob(['texture'])];
  input.uvs = new Float32Array(Array.from({ length: input.indices.length / 3 }, () => [0, 0, 1, 0, 0, 1]).flat());
  const { request } = createRuntime(new Uint8ClampedArray(8 * 8 * 4).fill(255));
  const info = await request('init', input);
  assert.equal(info.type, 'init'); assert.equal(info.sourceColors, null); assert.equal(info.quantization.algorithm, 'upstream');
  assert.equal((await request('palette', { mode: 'free', N: 4 })).type, 'palette');
});

test('interactive color changes reuse source-region graph and restore exact source labels', async () => {
  const { request } = createRuntime(); await request('init', baseColorModel());
  const cands = [{ id: 'one', hex: '#808080' }];
  const first = await request('preview', { N: 2, detail: 6, scale: 80, cands });
  assert.equal(first.type, 'preview'); assert.equal(first.cacheHit, false); assert.equal(first.slots.length, 2);
  const full = await request('preview', { N: 5, detail: 6, scale: 80, cands });
  assert.equal(full.cacheHit, true); assert.equal(full.regionCount, 5);
  assert.equal(new Set(full.label).size, 5);
  const snap = (await request('snapshot')).snapshot;
  await request('preview', { N: 1, detail: 1, scale: 80, cands });
  assert.deepEqual(Array.from((await request('restore', { snapshot: snap })).label), Array.from(full.label));
  assert.deepEqual(Array.from((await request('preserve', { scale: 80, cands })).label), [0, 1, 2, 3, 4]);
});

test('detail merges a tiny connected region but keeps disconnected pieces', async () => {
  const positions = [0, 0, 0], indices = [], materials = [];
  for (let i = 0; i < 100; i++) {
    const angle = i * Math.PI * 2 / 100;
    positions.push(Math.cos(angle) * 10, Math.sin(angle) * 10, 0);
    indices.push(0, i + 1, (i + 1) % 100 + 1); materials.push(0);
  }
  const tiny = positions.length / 3;
  positions.push((positions[3] + positions[6]) / 2 * 1.001, (positions[4] + positions[7]) / 2 * 1.001, 0);
  indices.push(2, 1, tiny); materials.push(1);
  const detached = positions.length / 3;
  positions.push(20, 0, 0, 21, 0, 0, 20, 1, 0);
  indices.push(detached, detached + 1, detached + 2); materials.push(1);
  const input = {
    positions: new Float32Array(positions), indices: new Uint32Array(indices), faceMat: new Uint16Array(materials),
    uvs: null, colors: null, materials: [{ image: -1, factor: [1, 0, 0] }, { image: -1, factor: [0, 0, 1] }], images: [],
  };
  const { request } = createRuntime(); await request('init', input);
  const cands = [{ id: 'red', hex: '#FF0000' }, { id: 'blue', hex: '#0000FF' }];
  const fine = await request('preview', { N: 2, detail: 6, scale: 80, cands });
  const coarse = await request('preview', { N: 2, detail: 1, scale: 80, cands });
  assert.notEqual(fine.label[0], fine.label[100]);
  assert.equal(coarse.label[0], coarse.label[100]); assert.notEqual(coarse.label[0], coarse.label[101]);
  const again = await request('preview', { N: 2, detail: 6, scale: 80, cands });
  assert.deepEqual(Array.from(again.label), Array.from(fine.label));
});

test('upstream preview exposes real K limits, snapshots the authoritative surface and blocks unaccepted mesh export', async () => {
  const input = baseColorModel();
  input.materials[0].image = 0; input.images = [new Blob(['texture'])];
  input.uvs = new Float32Array(Array.from({ length: input.indices.length / 3 }, () => [0, 0, 1, 0, 0, 1]).flat());
  const { request } = createRuntime(new Uint8ClampedArray(8 * 8 * 4).fill(255));
  const info = await request('init', input);
  assert.equal(info.quantization.maxColorCount, 1);
  assert.equal((await request('preview', { N: 3, detail: 3, scale: 80, cands: [] })).type, 'error');
  const result = await request('preview', { N: 1, detail: 3, scale: 80, cands: [] });
  assert.equal(result.type, 'preview'); assert.equal(result.actualColorCount, 1);
  assert.equal(result.surface.labels.length, input.indices.length / 3);
  assert.ok(result.surface.labels.every(x => x === 0));
  const snap = (await request('snapshot')).snapshot;
  const restored = await request('restore', { snapshot: snap });
  assert.deepEqual(restored.surface, result.surface);
  assert.deepEqual(Array.from((await request('snapshot')).snapshot.labels), Array.from(snap.labels));
  const exported = await request('export3mf', { scheme: 'high', scale: 80, filaments: result.slots.map(s => ({ hex: s.hex })), name: 'interactive' });
  assert.equal(exported.type, 'error'); assert.match(exported.message, /3MF/);
  assert.equal((await request('lowpoly', { ...options, target: 0 })).type, 'error');
  assert.equal((await request('preview', { N: 17, detail: 3, scale: 80, cands: [] })).type, 'error');
  assert.deepEqual(Array.from((await request('snapshot')).snapshot.labels), Array.from(snap.labels));
});

function topologyModel() {
  return {
    positions: new Float32Array([0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0, 1, -0.02, 0, 0, 2, 1, 0, 0, 0.00001, 0.1, 0, 0.00001, 0, 0.1, 0.00001]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3, 1, 0, 4, 6, 7, 8, 3, 2, 5]),
    faceMat: new Uint16Array([0, 1, 1, 1, 0]), uvs: null, colors: null,
    materials: [{ image: -1, factor: [1, 0, 0] }, { image: -1, factor: [0, 0, 1] }], images: [],
  };
}

test('cleanup previews are reversible, area-scaled and topology-local; protection, apply, undo and restore are exact', async () => {
  const { request } = createRuntime();
  await request('init', topologyModel());
  await request('preserve', { scale: 1, cands: [] });
  const before = (await request('snapshot')).snapshot;
  const detected = await request('editDetect', { areaMM2: 0.05, scale: 1 });
  assert.equal(detected.type, 'edit'); assert.equal(detected.candidateCount, 1);
  assert.deepEqual(Array.from(detected.overlay), [0, 0, 1, 0, 0]);
  assert.deepEqual((await request('snapshot')).snapshot, before);
  await request('editCancel'); assert.deepEqual((await request('snapshot')).snapshot, before);
  assert.equal((await request('editDetect', { areaMM2: 0.05, scale: 10 })).candidateCount, 0);
  await request('editPick', { seed: 2, angle: 1, tool: 'protect' });
  assert.equal((await request('editDetect', { areaMM2: 0.05, scale: 1 })).candidateCount, 0);
  const protectedSnapshot = (await request('snapshot')).snapshot;
  assert.deepEqual(Array.from(protectedSnapshot.surfaceEdit.protected), [1, 1, 1, 0, 0]);
  await request('editClearProtection');
  await request('restore', { snapshot: protectedSnapshot });
  assert.equal((await request('editDetect', { areaMM2: 0.05, scale: 1 })).candidateCount, 0);
  await request('editPick', { seed: 2, angle: 1, tool: 'unprotect' });
  await request('editDetect', { areaMM2: 0.05, scale: 1 });
  const applied = await request('editApply', { label: 0 });
  assert.equal(applied.left, 1); assert.equal(applied.pending, null);
  assert.deepEqual(Array.from(applied.label), [0, 1, 0, 1, 0]);
  const saved = (await request('snapshot')).snapshot;
  assert.deepEqual((await request('restore', { snapshot: saved })).label, applied.label);
  // Restore intentionally clears undo history; repeat one application to check atomic undo.
  await request('restore', { snapshot: before });
  await request('editDetect', { areaMM2: 0.05, scale: 1 }); await request('editApply', { label: 0 });
  assert.equal((await request('editUndo')).left, 0);
  assert.deepEqual((await request('snapshot')).snapshot, before);
});

test('geometric selection crosses original colors but stops at creases and disconnected nearby sheets', async () => {
  const { request } = createRuntime(); await request('init', topologyModel()); await request('preserve', { scale: 1, cands: [] });
  const before = (await request('snapshot')).snapshot;
  const selection = await request('editPick', { seed: 0, angle: 30, tool: 'select' });
  assert.deepEqual(Array.from(selection.overlay), [1, 1, 1, 0, 0]);
  assert.equal(selection.selectedCount, 3);
  assert.equal((await request('editPick', { seed: 0, angle: 30, tool: 'exclude' })).selectedCount, 0);
  await request('editPick', { seed: 0, angle: 30, tool: 'select' }); await request('editCancel');
  assert.deepEqual((await request('snapshot')).snapshot, before);
  await request('editPick', { seed: 0, angle: 30, tool: 'select' });
  const applied = await request('editApply', { label: 0 });
  assert.deepEqual(Array.from(applied.label), [0, 0, 0, 1, 0]); assert.equal(applied.left, 1);
  assert.equal((await request('preview', { N: 2, detail: 6, scale: 1, cands: [] })).type, 'error');
  await request('editUndo'); assert.deepEqual((await request('snapshot')).snapshot, before);
  assert.equal((await request('editPick', { seed: 0, angle: 81, tool: 'select' })).type, 'error');
  await request('editPick', { seed: 0, angle: 30, tool: 'select' });
  await request('init', topologyModel()); await request('preserve', { scale: 1, cands: [] });
  assert.equal((await request('editApply', { label: 0 })).type, 'error');
});

test('textured default calls the package once, reuses analysis for K and uses upstream assignments, not the old labeler', async () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const i = (y * 8 + x) * 4; pixels[i + (x < 4 ? 0 : 2)] = 255; pixels[i + 3] = 255; }
  const input = model(); input.faceMat.fill(0); input.materials = [{ image: 0, factor: [0.8, 0.8, 0.8] }];
  input.images = [new Blob(['texture'])]; input.uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  const { request, context } = createRuntime(pixels);
  let calls = 0, capturedInput, capturedAnalysis;
  context.MCQuantizationAPI = { ...quantizationAPI, analyze(data, options) { calls++; capturedInput = data; capturedAnalysis = upstream.analyze(data, options); return capturedAnalysis; } };
  const info = await request('init', input);
  assert.equal(info.type, 'init'); assert.equal(calls, 1); assert.equal(capturedInput.flipY, false);
  assert.deepEqual(Array.from(capturedInput.triWorld), [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0]);
  assert.deepEqual(Array.from(capturedInput.triUV), [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  const expectedByte = Math.round(context.MC.linearToSrgb(0.8) * 255);
  assert.equal(capturedInput.texture.data[0], expectedByte); // Exactly one linear-space factor.
  context.MCRegions.preview = () => { throw new Error('Old assignment must not run'); };
  context.MCLow.labelMapSmart = () => { throw new Error('Old UV relabeling must not run'); };
  const k = Math.min(2, info.quantization.maxColorCount); assert.equal(k, 2);
  const result = await request('preview', { N: k, detail: 6, scale: 80, cands: [] });
  assert.equal(result.type, 'preview'); assert.equal(result.cacheHit, false);
  const level = upstream.getLevel(capturedAnalysis, k);
  assert.deepEqual(Array.from(result.slots, s => s.sourceHex), level.clusters.map(c => c.hex.toUpperCase()));
  const oracle = upstream.renderPreview(capturedAnalysis, k);
  for (let f = 0; f < result.surface.labels.length; f++) {
    const p = result.surface.positions, i = f * 9;
    const x = Math.min(7, Math.floor((p[i] + p[i + 3] + p[i + 6]) / 3 * 8));
    const y = Math.min(7, Math.floor((p[i + 1] + p[i + 4] + p[i + 7]) / 3 * 8));
    assert.equal(result.slots[result.surface.labels[f]].sourceHex, '#' + Array.from(oracle.data.slice((y * 8 + x) * 4, (y * 8 + x) * 4 + 3), b => b.toString(16).padStart(2, '0')).join('').toUpperCase());
  }
  const snapshot = (await request('snapshot')).snapshot;
  const cleanup = await request('editDetect', { areaMM2: 10000, scale: 1 });
  assert.equal(cleanup.candidateCount, 0, 'Each half-plane is one connected island, including adaptive T-junctions');
  await request('editCancel');
  assert.deepEqual((await request('snapshot')).snapshot, snapshot);
  await request('editPick', { seed: 0, angle: 30, tool: 'select' });
  const changed = await request('editApply', { label: 0 }); assert.equal(changed.left, 1);
  const saved = (await request('snapshot')).snapshot;
  assert.deepEqual((await request('restore', { snapshot: saved })).surface.labels, changed.surfaceLabels);
  await request('restore', { snapshot });
  const one = await request('preview', { N: 1, detail: 6, scale: 80, cands: [] });
  assert.equal(one.cacheHit, true); assert.equal(one.slots.length, 1); assert.equal(calls, 1);
  assert.ok(one.surface.labels.every(label => label === 0));
});

test('textured analyze errors are reported without silently falling back; multi-material input is explicitly separate', async () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4).fill(255), input = model();
  input.faceMat.fill(0); input.materials = [{ image: 0, factor: [1, 1, 1] }]; input.images = [new Blob(['texture'])]; input.uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  const { request, context } = createRuntime(pixels);
  context.MCQuantizationAPI = { ...quantizationAPI, analyze() { throw new Error('ERR_DISTANCE_MATRIX_BUDGET: fixture'); } };
  const failed = await request('init', input); assert.equal(failed.type, 'error'); assert.match(failed.message, /ERR_DISTANCE_MATRIX_BUDGET/);
  assert.equal((await request('preview', { N: 1, detail: 3, scale: 80, cands: [] })).type, 'error');
  input.materials.push({ image: 0, factor: [0, 0, 1] }); input.faceMat[1] = 1;
  const info = await request('init', input); assert.equal(info.type, 'init');
  assert.equal(info.quantization.algorithm, 'surface-compatibility'); assert.match(info.quantization.reason, /多材质/);
});

test('isolated subpixel UV triangles use upstream source samples without changing any covered assignment', async () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const i = (y * 8 + x) * 4;
    pixels[i + (x < 3 || x === 7 && y === 7 ? 0 : 2)] = 255; pixels[i + 3] = 255;
  }
  const input = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 2, 1, 0, 4, 0, 0, 4.1, 0, 0, 4, 0.1, 0]),
    indices: new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8]),
    uvs: new Float32Array([0, 0, 0.3, 0, 0, 0.3, 0.55, 0, 0.85, 0, 0.55, 0.7, 0.99, 0.99, 0.999, 0.99, 0.99, 0.999]),
    colors: null, faceMat: new Uint16Array(3), materials: [{ image: 0, factor: [1, 1, 1] }], images: [new Blob(['texture'])],
  };
  const { request, context } = createRuntime(pixels);
  let analysis, boundInput, suppliedMap;
  context.MCQuantizationAPI = { ...quantizationAPI, analyze(data, options) { boundInput = data; analysis = upstream.analyze(data, options); return analysis; } };
  const info = await request('init', input); assert.equal(info.type, 'init');
  assert.equal(analysis.leafIndexMap[63], 255, 'The isolated chart has no covered texel center');
  const before = analysis.leafIndexMap.slice(), K = info.quantization.maxColorCount;
  const level = upstream.getLevel(analysis, K), oracleBefore = upstream.renderPreview(analysis, K);
  const subdivide = context.MCLow.subdivideAll;
  context.MCLow.subdivideAll = options => { suppliedMap = options.maps[0].lab; return subdivide(options); };
  const preview = await request('preview', { N: K, detail: 1, scale: 80, cands: [] });
  assert.equal(preview.type, 'preview'); assert.ok(preview.surface.faceMap.includes(2));
  assert.deepEqual({ ...preview.surface.supplementalSampling }, { method: 'upstream-sample-faces-nearest-original-leaf', sampleCount: 1, faceCount: 1 });
  const sampled = sampleFaces(Float64Array.from(input.uvs.slice(12)), Float64Array.from(input.positions.slice(18)), boundInput.texture, false, false).faceLab;
  let leaf = 0, distance = Infinity;
  analysis.leafLab.forEach((lab, i) => { const d = lab.reduce((sum, c, channel) => sum + (sampled[channel] - c) ** 2, 0); if (d < distance) { distance = d; leaf = i; } });
  const isolated = Array.from(preview.surface.faceMap).indexOf(2);
  assert.equal(preview.surface.labels[isolated], level.leafToCluster[leaf]);
  assert.equal(preview.slots[preview.surface.labels[isolated]].sourceHex, preview.slots[preview.surface.labels[0]].sourceHex, 'The tiny red chart must not borrow a nearby blue island label');
  for (let i = 0; i < before.length; i++) assert.equal(suppliedMap[i], before[i] === 255 ? 255 : level.leafToCluster[before[i]]);
  assert.deepEqual(analysis.leafIndexMap, before);
  assert.deepEqual(upstream.renderPreview(analysis, K), oracleBefore);
  const snapshot = (await request('snapshot')).snapshot;
  assert.deepEqual((await request('restore', { snapshot })).surface, preview.surface);
});

test('upstream preview bounds texture resolution, reports source dimensions and restores deterministically', async () => {
  const { request, context } = createRuntime(new Uint8ClampedArray(8 * 8 * 4).fill(255));
  const decoded = [];
  context.createImageBitmap = async () => ({ width: 4096, height: 8, close() { this.width = 0; this.height = 0; } });
  context.OffscreenCanvas = class {
    constructor(width, height) { this.width = width; this.height = height; decoded.push([width, height]); }
    getContext() { return { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(this.width * this.height * 4).fill(255) }) }; }
  };
  const input = model(); input.faceMat.fill(0); input.materials = [{ image: 0, factor: [1, 1, 1] }];
  const image = new Blob(['unchanged original image']); input.images = [image]; input.uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  const info = await request('init', input); assert.equal(info.type, 'init');
  assert.deepEqual({ ...info.quantization.texture }, { originalWidth: 4096, originalHeight: 8, width: 2048, height: 4, maxEdge: 2048, downsampled: true });
  assert.deepEqual(decoded, [[2048, 4]]); assert.ok(info.warnings.some(w => w.includes('4096 × 8') && w.includes('2048 × 4')));
  assert.equal(await image.text(), 'unchanged original image');
  const preview = await request('preview', { N: 1, detail: 3, scale: 80, cands: [] }); assert.equal(preview.type, 'preview');
  const snapshot = (await request('snapshot')).snapshot;
  await request('init', input);
  const restored = await request('restore', { snapshot });
  assert.equal(restored.type, 'restore'); assert.deepEqual(restored.surface, preview.surface);
  assert.equal((await request('snapshot')).snapshot.surfaceEdit.inputFingerprint, snapshot.surfaceEdit.inputFingerprint);
});

test('keeps source colors without inventing SKU matches for a vendor with no catalog', async () => {
  const { request } = createRuntime();
  const info = await request('init', baseColorModel());
  for (const [type, options] of [['preserve', {}], ['preview', { N: 2, detail: 6 }]]) {
    const result = await request(type, { ...options, scale: 80, cands: [] });
    assert.equal(result.type, type);
    assert.ok(result.slots.length > 0);
    assert.ok(result.slots.every(slot => slot.filamentId === null && slot.hex === slot.sourceHex));
    assert.equal(result.label.length, info.nf);
  }
});
