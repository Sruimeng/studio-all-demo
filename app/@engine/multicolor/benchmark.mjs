import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../../public/print-worker/', import.meta.url);
const pending = new Map();
const context = vm.createContext({ Blob, CompressionStream, TextEncoder, console,
  postMessage(result) {
    if (result.type === 'progress') return;
    pending.get(result.requestId)?.(result);
    pending.delete(result.requestId);
  },
});
context.self = context;
context.importScripts = (...paths) => paths.forEach(path => vm.runInContext(readFileSync(new URL(path, root), 'utf8'), context));
vm.runInContext(readFileSync(new URL('worker.js', root), 'utf8'), context);
let requestId = 0;
const request = (type, payload) => new Promise(resolve => {
  const id = ++requestId;
  pending.set(id, resolve);
  context.onmessage({ data: { ...payload, type, projectId: 'benchmark', requestId: id, editRevision: 0 } });
});

const width = 1000, height = 500;
const positions = new Float32Array((width + 1) * (height + 1) * 3);
const indices = new Uint32Array(width * height * 6);
for (let y = 0; y <= height; y++) for (let x = 0; x <= width; x++) {
  const offset = (y * (width + 1) + x) * 3;
  positions[offset] = x / width;
  positions[offset + 1] = y / height;
  positions[offset + 2] = Math.sin(x / 100) * 0.05;
}
let cursor = 0;
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const a = y * (width + 1) + x, b = a + 1, c = a + width + 1, d = c + 1;
  indices.set([a, b, d, a, d, c], cursor);
  cursor += 6;
}
const before = performance.now();
const initialized = await request('init', { positions, indices, uvs: null, colors: null,
  faceMat: new Uint16Array(indices.length / 3), materials: [{ image: -1, factor: [0.8, 0.2, 0.1] }], images: [],
});
if (initialized.type === 'error') throw new Error(initialized.message);
const initMs = performance.now() - before;
const labelStart = performance.now();
const result = await request('label', { slotHex: ['#ED7C59', '#FFFFFF', '#202020', '#2050A0'], precision: 3, scale: 80 });
if (result.type === 'error') throw new Error(result.message);
console.log(JSON.stringify({ runtime: process.version, fixture: 'synthetic curved grid', faces: initialized.nf,
  initMs: Math.round(initMs), labelMs: Math.round(performance.now() - labelStart),
  processPeakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
  browserOrGpu: false,
}, null, 2));
