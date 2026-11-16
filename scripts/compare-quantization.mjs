import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { analyze, renderPreview } from '../packages/color-quantization/index.js';
import { de2000, srgbToLab } from '../packages/color-quantization/vendor/quantize.js';
import { planeFixture } from '../packages/color-quantization/test/fixtures.mjs';

const workerRoot = new URL('../public/print-worker/', import.meta.url);
const WARMUPS = 2, REPEATS = 5;

function createRuntime(input) {
  const { width, height, data } = input.texture;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) { rgba.set(data.subarray(i * 3, i * 3 + 3), i * 4); rgba[i * 4 + 3] = 255; }
  const pending = new Map();
  const context = vm.createContext({
    Blob, CompressionStream, TextEncoder, console,
    createImageBitmap: async () => ({ width, height, close() {} }),
    OffscreenCanvas: class {
      constructor(w, h) { if (w !== width || h !== height) throw new Error('Comparison does not support implicit texture resizing.'); }
      getContext() { return { drawImage() {}, getImageData() { return { data: rgba }; } }; }
    },
    postMessage(message) {
      if (message.type === 'progress') return;
      const task = pending.get(message.requestId); pending.delete(message.requestId);
      if (!task) throw new Error(`Unexpected current-worker response ${message.requestId}`);
      if (message.type === 'error') task.reject(new Error(message.message)); else task.resolve(message);
    },
  });
  context.self = context;
  context.importScripts = (...paths) => {
    for (const path of paths) vm.runInContext(readFileSync(new URL(path, workerRoot), 'utf8'), context, { filename: path });
  };
  vm.runInContext(readFileSync(new URL('worker.js', workerRoot), 'utf8'), context, { filename: 'worker.js' });
  let id = 0;
  return {
    request: (type, payload = {}) => new Promise((resolve, reject) => {
      const requestId = ++id; pending.set(requestId, { resolve, reject });
      context.onmessage({ data: { ...payload, type, projectId: 'quantization-comparison', requestId, editRevision: 0 } });
    }),
    maxCount: () => Math.min(16, vm.runInContext('S.interactive.base.length', context)),
  };
}

function currentInput(input) {
  const faces = input.triWorld.length / 9;
  return {
    positions: input.triWorld.slice(), indices: Uint32Array.from({ length: faces * 3 }, (_, i) => i),
    uvs: input.triUV.slice(), faceMat: new Uint16Array(faces), colors: null,
    materials: [{ image: 0, factor: [1, 1, 1] }], images: [new Blob(['procedural pixels supplied by deterministic decode stub'])],
  };
}

async function timed(job) {
  const cpu = process.cpuUsage(), start = performance.now();
  const value = await job();
  const wallMs = performance.now() - start, used = process.cpuUsage(cpu);
  return { value, timing: { cpuMs: (used.user + used.system) / 1000, wallMs } };
}

function summary(samples) {
  const median = key => samples.map(s => s[key]).sort((a, b) => a - b)[Math.floor(samples.length / 2)];
  return { repeats: samples.length, medianCpuMs: median('cpuMs'), medianWallMs: median('wallMs'), samples };
}

const rgbFromHex = hex => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
const delta = (a, b) => de2000(...a, ...b, 1);

function surfaceError(fixture, current, preview) {
  const { input, cells, feature } = fixture, { width, height, data } = input.texture;
  const gridWidth = 128, gridHeight = 96;
  const colors = Array.from(current.slots, slot => rgbFromHex(slot.sourceHex ?? slot.hex));
  const currentColors = new Set(), packageColors = new Set();
  const stats = [0, 1].map(() => ({ sum: 0, max: 0, featureCount: 0, featureKept: 0, backgroundCount: 0, backgroundFalsePositive: 0 }));
  const featureLab = srgbToLab(20, 220, 60);
  for (let y = 0; y < gridHeight; y++) for (let x = 0; x < gridWidth; x++) {
    const u = (x + 0.5) / gridWidth, v = (y + 0.5) / gridHeight;
    const tx = Math.min(width - 1, Math.floor(u * width)), ty = Math.min(height - 1, Math.floor(v * height)), texel = ty * width + tx;
    const source = srgbToLab(...data.subarray(texel * 3, texel * 3 + 3));
    const cx = Math.floor(u * cells), cy = Math.floor(v * cells);
    const face = (cy * cells + cx) * 2 + (v * cells - cy <= u * cells - cx ? 0 : 1);
    const faceColor = colors[current.label[face]];
    if (!faceColor || preview.data[texel * 4 + 3] !== 255) throw new Error('Comparison sample is missing a current face label or package texel label.');
    const texelColor = [...preview.data.subarray(texel * 4, texel * 4 + 3)];
    currentColors.add(faceColor.join(',')); packageColors.add(texelColor.join(','));
    [faceColor, texelColor].forEach((rgb, index) => {
      const lab = srgbToLab(...rgb), error = delta(source, lab), s = stats[index];
      s.sum += error; s.max = Math.max(s.max, error);
      if (!feature) return;
      if (feature(u, v)) { s.featureCount++; if (error <= 10) s.featureKept++; }
      else { s.backgroundCount++; if (delta(lab, featureLab) <= 10) s.backgroundFalsePositive++; }
    });
  }
  const report = (s, unique) => ({
    meanDeltaE00: s.sum / (gridWidth * gridHeight), maxDeltaE00: s.max, effectiveUniqueSurfaceColors: unique,
    smallFeature: !feature ? null : {
      samples: s.featureCount, retainedWithinDeltaE10: s.featureKept / s.featureCount,
      backgroundFalsePositiveWithinFeatureDeltaE10: s.backgroundFalsePositive / s.backgroundCount,
    },
  });
  return { grid: [gridWidth, gridHeight], current: report(stats[0], currentColors.size), package: report(stats[1], packageColors.size) };
}

async function compare(fixture) {
  const { input } = fixture;
  const initialization = [], preparation = [], analysisTimes = [];
  let runtime, a;
  for (let repeat = 0; repeat < 3; repeat++) {
    runtime = createRuntime(input);
    initialization.push((await timed(() => runtime.request('init', currentInput(input)))).timing);
    preparation.push((await timed(() => runtime.request('preview', { N: 16, detail: 6, scale: 80, cands: [] }))).timing);
    const result = await timed(() => analyze(input)); a = result.value; analysisTimes.push(result.timing);
  }
  const maxK = Math.min(runtime.maxCount(), a.maxSelectableColorCount), levels = [];
  for (let k = 1; k <= maxK; k++) {
    const options = { N: k, detail: 6, scale: 80, cands: [] };
    for (let i = 0; i < WARMUPS; i++) { await runtime.request('preview', options); renderPreview(a, k); }
    const currentTimes = [], packageTimes = [];
    let current, preview;
    for (let i = 0; i < REPEATS; i++) {
      // Alternate timing order to reduce a fixed ordering bias; no rendering or worker IPC is measured.
      const currentJob = async () => { const r = await timed(() => runtime.request('preview', options)); current = r.value; currentTimes.push(r.timing); };
      const packageJob = async () => { const r = await timed(() => renderPreview(a, k)); preview = r.value; packageTimes.push(r.timing); };
      if (i % 2) { await packageJob(); await currentJob(); } else { await currentJob(); await packageJob(); }
    }
    if (current.slots.length !== k || preview.palette.length !== k) throw new Error('Requested K is not equally available.');
    levels.push({
      colorCount: k,
      current: { paletteUniqueColors: new Set(Array.from(current.slots, s => s.sourceHex ?? s.hex)).size, cachedPreview: summary(currentTimes) },
      package: { paletteUniqueColors: new Set(preview.palette.map(c => c.hex)).size, cachedPreview: summary(packageTimes) },
      error: surfaceError(fixture, current, preview),
    });
  }
  return {
    fixture: fixture.name, faces: input.triWorld.length / 9, texture: [input.texture.width, input.texture.height], texels: input.texture.width * input.texture.height,
    sourceUniqueTextureColors: new Set(Array.from({ length: input.texture.width * input.texture.height }, (_, i) => [...input.texture.data.subarray(i * 3, i * 3 + 3)].join(','))).size,
    current: { maxColorCount: runtime.maxCount(), initialization: summary(initialization), firstPreviewGraphPreparation: summary(preparation) },
    package: { maxColorCount: a.maxSelectableColorCount, analysis: summary(analysisTimes) }, levels,
  };
}

const results = [];
for (const kind of ['flat-regions', 'smooth-shading', 'small-distinctive-color']) results.push(await compare(planeFixture(kind)));
console.log(JSON.stringify({
  scope: 'Small synthetic single-texture CPU-kernel experiment; not a winner claim or production benchmark.',
  granularity: { current: 'one constant source color per original face', package: 'one palette color per covered texture texel; no mesh rebuild' },
  timing: 'Same-process process.cpuUsage user+system milliseconds and monotonic elapsed milliseconds; includes public API validation and response construction, excludes VM setup, browser rendering, texture upload and real Worker IPC. Initialization and first current preview graph preparation are separate. Initialization samples include a first cold run; cached preview has two warmups and five repeats.',
  metric: 'Arithmetic mean/max standard CIEDE2000 (kL=1) on the same uniform 128x96 unit-plane surface grid. Source and package texture use nearest texel sampling at each UV; current output uses the original containing face label. All samples have equal world area. Effective unique colors are counted on that grid. Small-feature retention is the fraction of samples inside the authored green patch with source-to-output DeltaE00 <=10; background false positives count outputs within DeltaE00 <=10 of the patch green outside the patch.',
  exclusions: 'Different output granularity: these are not like-for-like end-to-end or rendering measurements. Current init includes BVH/material processing; package analysis includes masked bilateral filtering and all K levels. No commit/remeshing timings, mesh-health claims, SKU matching, multi-material models or heavy assets.',
  results,
}, null, 2));
