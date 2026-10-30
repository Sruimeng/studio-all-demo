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

function uvModel() {
  // One connected square split at a UV seam, plus a detached triangle sharing UVs.
  return {
    positions: new Float32Array([0,0,0, 1,0,0, 1,1,0, 0,0,0, 1,1,0, 0,1,0, 3,0,0, 4,0,0, 4,1,0]),
    indices: new Uint32Array([0,1,2,3,4,5,6,7,8]),
    topologyVertices: new Uint32Array([0,1,2,0,2,3,4,5,6]),
    faceDomain: new Uint32Array([0,0,0]), faceMat: new Uint32Array([0,0,0]),
    uvs: new Float32Array([0,0, 1,0, 1,1, 2,0, 3,1, 2,1, 0,0, 1,0, 1,1]),
    uvValid: new Uint8Array([1,1,1]), colors: null,
    materials: [{ image: -1, factor: [1,0,0] }], images: [],
  };
}
test('real UV seams, connected parts and color components remain distinct without a texture', async () => {
  const { request } = createRuntime(); await request('init', uvModel()); await request('label', options);
  const r = await request('prepareRefinement', { scheme: 'high' });
  assert.equal(r.type, 'refinement'); assert.equal(r.islandCount, 3); assert.equal(r.partCount, 2);
  assert.deepEqual(Array.from(r.uvs), Array.from(uvModel().uvs));
  const pick = (face, scope) => request('selectRefinement', { face, scope, materialGroups: [0,1] });
  assert.deepEqual(Array.from((await pick(0, 'island')).faces), [0]);
  assert.deepEqual(Array.from((await pick(0, 'part')).faces), [0,1]);
  assert.deepEqual(Array.from((await pick(0, 'color')).faces), [0,1]);
  assert.deepEqual(Array.from((await request('prepareRefinement', { scheme: 'high' })).labels), [0,0,0]);
  await request('paintRefinement', { faces: new Uint32Array([0]), label: 1 });
  assert.deepEqual(Array.from((await request('prepareRefinement', { scheme: 'high' })).labels), [1,0,0]);
  assert.deepEqual(Array.from((await pick(1, 'color')).faces), [1]);
});
test('bucket fills only the hovered connected color component, with one undo per effective click', async () => {
  const { request } = createRuntime(); await request('init', uvModel()); await request('label', options);
  await request('prepareRefinement', { scheme: 'high' });
  const groups = [0, 1];
  const preview = await request('selectRefinement', { face: 0, scope: 'color', materialGroups: groups });
  assert.deepEqual(Array.from(preview.faces), [0, 1]);
  const fill = face => request('fillRefinement', { face, label: 1, materialGroups: groups });
  const first = await fill(0);
  assert.deepEqual(Array.from(first.refinementLabels), [1, 1, 0]); assert.equal(first.left, 1);
  assert.equal((await fill(0)).left, 1);
  const second = await fill(2);
  assert.deepEqual(Array.from(second.refinementLabels), [1, 1, 1]); assert.equal(second.left, 2);
  assert.deepEqual(Array.from((await request('undo')).refinementLabels), [1, 1, 0]);
  assert.deepEqual(Array.from((await request('undo')).refinementLabels), [0, 0, 0]);
  const sameFilament = await request('fillRefinement', { face: 0, label: 1, materialGroups: [0, 0] });
  assert.equal(sameFilament.left, 0); assert.deepEqual(Array.from(sameFilament.refinementLabels), [0, 0, 0]);
});
test('multi-island paint and brush share undo, snapshot and exported material labels', async () => {
  const { request } = createRuntime(); await request('init', uvModel()); await request('label', options);
  await request('prepareRefinement', { scheme: 'high' });
  const painted = await request('paintRefinement', { faces: new Uint32Array([0,2]), label: 1 });
  assert.equal(painted.left, 1); assert.deepEqual(Array.from(painted.refinementLabels), [1,0,1]);
  const brushed = await request('brushRefinement', { hits: [{ face: 1, point: [0.1,0.9,0], radius: 0.01 }], label: 1 });
  assert.deepEqual(Array.from(brushed.refinementLabels), [1,1,1]);
  assert.deepEqual(Array.from((await request('undo')).refinementLabels), [1,0,1]);
  const { snapshot } = await request('snapshot');
  await request('reset');
  const restored = await request('restore', { snapshot });
  assert.equal(restored.type, 'restore'); assert.deepEqual(Array.from(restored.refinement.labels), [1,0,1]);
  const exported = await request('export3mf', { scheme: 'high', name: 'uv-edited', scale: 80, filaments: [{ hex: '#FF0000' }, { hex: '#0000FF' }] });
  assert.equal(exported.type, 'export');
  const xml = (await unzip(exported.blob)).get('3D/3dmodel.model');
  assert.equal((xml.match(/p1="1" paint_color="8"/g) ?? []).length, 2);
  assert.equal((xml.match(/p1="0" paint_color="4"/g) ?? []).length, 1);
});
test('UV islands join only shared geometric edges with matching UV endpoints', async () => {
  const input = uvModel(); input.uvs.set([0,0,1,1,0,1], 6);
  const { request } = createRuntime(); await request('init', input); await request('label', options);
  const r = await request('prepareRefinement', { scheme: 'high' });
  assert.equal(r.islandCount, 2);
  assert.deepEqual(Array.from((await request('selectRefinement', { face: 0, scope: 'island', materialGroups: [0,1] })).faces), [0,1]);
});
test('adaptive T junctions remain connected for color-region selection', async () => {
  const { context } = createRuntime(); const input = model();
  // Source face 0 stays whole; face 1 is divided into two along the shared diagonal.
  const positions = new Float32Array([0,0,0, 1,0,0, 1,1,0, 0,0,0, .5,.5,0, 0,1,0, .5,.5,0, 1,1,0, 0,1,0]);
  const r = context.MCRefine.create(input, positions, new Uint8Array([0,0,0]), new Uint32Array([0,1,1]));
  assert.deepEqual(Array.from(context.MCRefine.select(r, 0, 'color', [0,1])).sort(), [0,1,2]);
});

test('legacy brush undo remains visible after entering shared refinement', async () => {
  const { request } = await labeledRuntime();
  await request('paintHigh', { faces: new Uint32Array([0]), label: 1 });
  await request('prepareRefinement', { scheme: 'high' });
  const result = await request('undo');
  assert.deepEqual(Array.from(result.refinement.labels), [0,1]);
});
test('refinement on adaptive UV leaves exports source triangles with edited leaf codes', async () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const i = (y * 8 + x) * 4; pixels[i + (x < 4 ? 0 : 2)] = 255; pixels[i + 3] = 255; }
  const { request } = createRuntime(pixels); const input = model();
  input.uvs = new Float32Array([0,0,1,0,1,1,0,1]); input.images = [new Blob(['test'])];
  input.materials = [{ image: 0, factor: [1,1,1] }]; input.faceMat = new Uint16Array(2);
  await request('init', input); await request('label', options);
  const low = await request('lowpoly', { ...options, target: 0 });
  assert.ok(low.leafLab.length > 2);
  const r = await request('prepareRefinement', { scheme: 'low' });
  assert.equal(r.islandCount, 1); assert.deepEqual(Array.from(r.labels), Array.from(low.leafLab));
  await request('paintRefinement', { faces: Uint32Array.from({ length: r.labels.length }, (_, i) => i), label: 1 });
  const { snapshot } = await request('snapshot'); await request('reset');
  const restored = await request('restore', { snapshot }); assert.ok(restored.refinement.labels.every(l => l === 1));
  const exported = await request('export3mf', { scheme: 'low', name: 'adaptive', scale: 80, filaments: [{ hex: '#FF0000' }, { hex: '#0000FF' }] });
  assert.equal(exported.type, 'export');
  const xml = (await unzip(exported.blob)).get('3D/3dmodel.model');
  assert.equal((xml.match(/<triangle /g) ?? []).length, 2);
  for (const [, code] of xml.matchAll(/paint_color="([0-9A-F]+)"/g)) assert.ok(!code.includes('4') && code.includes('8'));
});

test('prepared low-color export preserves confirmed partition when dimensions change', async () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const i = (y * 8 + x) * 4; pixels[i + (x < 4 ? 0 : 2)] = 255; pixels[i + 3] = 255; }
  const { request } = createRuntime(pixels); const input = model();
  input.uvs = new Float32Array([0,0,1,0,1,1,0,1]); input.images = [new Blob(['test'])];
  input.materials = [{ image: 0, factor: [1,1,1] }]; input.faceMat = new Uint16Array(2);
  await request('init', input); await request('label', options); await request('lowpoly', { ...options, target: 0 });
  const before = (await request('snapshot')).snapshot;
  const payload = { scheme: 'low', name: 'prepared', scale: 80, filaments: [{ hex: '#FF0000' }, { hex: '#0000FF' }], preservePartition: true };
  const original = await request('export3mf', payload);
  const scaled = await request('export3mf', { ...payload, scale: 160 });
  assert.equal(scaled.type, 'export');
  const codes = async result => [...(await unzip(result.blob)).get('3D/3dmodel.model').matchAll(/paint_color="([0-9A-F]+)"/g)].map(match => match[1]);
  assert.deepEqual(await codes(original), await codes(scaled));
  assert.equal(JSON.stringify((await request('snapshot')).snapshot), JSON.stringify(before));
});

test('appending a paint slot preserves labels and history, survives restore and exports', async () => {
  for (const scheme of ['high', 'low']) {
    const { request } = await labeledRuntime();
    if (scheme === 'low') await request('lowpoly', { ...options, target: 0 });
    await request('prepareRefinement', { scheme });
    await request('paintRefinement', { faces: new Uint32Array([0]), label: 1 });
    const before = (await request('snapshot')).snapshot;
    assert.equal((await request('appendSlot', { expectedCount: 2 })).slotCount, 3);
    const added = (await request('snapshot')).snapshot;
    assert.deepEqual(added.refinement.labels, before.refinement.labels);
    assert.deepEqual(added.labels, before.labels);
    assert.deepEqual(added.labelOptions.slotHex, before.labelOptions.slotHex);
    assert.equal(added.labelOptions.slotCount, 3);
    if (scheme === 'low') assert.equal(added.lowOptions.slotCount, 3);
    const painted = await request('paintRefinement', { faces: new Uint32Array([0]), label: 2 });
    assert.equal(painted.left, 2);
    assert.equal(painted.refinementLabels[0], 2);
    const paintedSnapshot = (await request('snapshot')).snapshot;
    const undone = await request('undo');
    assert.equal(undone.left, 1); assert.equal(undone.refinementLabels[0], 1);
    assert.equal((await request('snapshot')).snapshot.slotCount, 3);
    const restored = await request('restore', { snapshot: paintedSnapshot });
    assert.equal(restored.type, 'restore'); assert.equal(restored.refinement.labels[0], 2);
    const again = await request('paintRefinement', { faces: new Uint32Array([1]), label: 2 });
    assert.equal(again.type, 'ack');
    const exported = await request('export3mf', { scheme, scale: 80, name: 'added', filaments: ['#FF0000', '#0000FF', '#00FF00'].map(hex => ({ hex })) });
    assert.equal(exported.type, 'export');
    const files = await unzip(exported.blob);
    assert.equal(JSON.parse(files.get('Metadata/materials.json')).slots.length, 3);
    assert.equal((await request('appendSlot', { expectedCount: 2 })).type, 'error');
    for (let count = 3; count < 12; count++) assert.equal((await request('appendSlot', { expectedCount: count })).slotCount, count + 1);
    assert.equal((await request('appendSlot', { expectedCount: 12 })).type, 'error');
  }
});

test('source sampling stays independent of paint, palette and undo', async () => {
  const { request } = await labeledRuntime();
  await request('paintHigh', { faces: new Uint32Array([0]), label: 1 });
  const before = (await request('snapshot')).snapshot;
  assert.equal((await request('sampleSource', { face: 0, barycentric: [0.2, 0.3, 0.5] })).hex, '#FF0000');
  assert.equal((await request('sampleSource', { face: 1, barycentric: [1, 0, 0] })).hex, '#0000FF');
  assert.deepEqual((await request('snapshot')).snapshot, before);
  assert.equal((await request('sampleSource', { face: 99, barycentric: [1, 0, 0] })).type, 'error');
  assert.equal((await request('sampleSource', { face: 0, barycentric: [1, 1, 1] })).type, 'error');
  assert.equal((await request('undo')).left, 0);
});

test('source sampling interpolates linear vertex colors and applies texture/material/vertex factors', async () => {
  const plain = createRuntime(); const input = model();
  input.colors = new Float32Array([255,0,0, 0,255,0, 0,0,255, 255,255,255]);
  await plain.request('init', input);
  assert.equal((await plain.request('sampleSource', { face: 0, barycentric: [0.5, 0.5, 0] })).hex, '#BCBC00');
  const pixels = new Uint8ClampedArray(8 * 8 * 4).fill(255);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) pixels[(y * 8 + x) * 4 + 2] = 0;
  const textured = createRuntime(pixels);
  input.uvs = new Float32Array([0.25,0.5, .75,.5, .25,.5, .75,.5]);
  input.materials = [{ image: 0, factor: [.5,1,1], vertexColors: true }];
  input.faceMat = new Uint16Array(2); input.images = [new Blob(['image'])];
  input.vertexFactors = new Float32Array([1,.5,1, 1,.5,1, 1,.5,1, 1,.5,1]);
  await textured.request('init', input);
  assert.equal((await textured.request('sampleSource', { face: 0, barycentric: [1,0,0] })).hex, '#BCBC00');
  assert.equal((await textured.request('sampleSource', { face: 0, barycentric: [0,1,0] })).hex, '#BCBCFF');
});
