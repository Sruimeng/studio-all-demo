import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import vm from 'node:vm';
import { inflateRawSync } from 'node:zlib';

const workerRoot = new URL('../../../public/print-worker/', import.meta.url);

function createRuntime(imagePixels) {
  const pending = new Map();
  const context = vm.createContext({
    Blob, CompressionStream, TextEncoder, console,
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
