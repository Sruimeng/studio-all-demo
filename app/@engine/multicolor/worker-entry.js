import * as quantization from '../../../packages/color-quantization/index.js';
import { sampleFaces } from '../../../packages/color-quantization/vendor/quantize.js';

globalThis.MCQuantizationAPI = { ...quantization, sampleFaces };
const waiting = [];
let starting = false;

// Public scripts stay local runtime modules; the numerical package is bundled by Vite.
globalThis.onmessage = event => {
  waiting.push(event);
  if (starting) return;
  starting = true;
  void start(event.data.workerBase ?? '/');
};

async function start(base) {
  try {
    const root = new URL(`${base.replace(/\/$/, '')}/print-worker/`, globalThis.location.origin);
    if (root.origin !== globalThis.location.origin) throw new Error('Print worker scripts must be same-origin.');
    for (const name of ['color', 'palette', 'mesh', 'decimate', 'lowpoly', 'export3mf', 'regions', 'quantization', 'surface-edit', 'worker']) {
      await import(/* @vite-ignore */ new URL(`${name}.js`, root).href);
    }
    const dispatch = globalThis.onmessage;
    for (const event of waiting.splice(0)) dispatch(event);
  } catch (error) {
    const fail = ({ data }) => globalThis.postMessage({ type: 'error', projectId: data.projectId, requestId: data.requestId, editRevision: data.editRevision, message: `Module worker startup failed: ${error instanceof Error ? error.message : String(error)}` });
    globalThis.onmessage = fail;
    for (const event of waiting.splice(0)) fail(event);
  }
}
