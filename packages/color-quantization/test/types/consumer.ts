import { analyze, getLevel, renderPreview, commit, QuantizationError, type Analysis, type QuantizationInput, type CommittedMesh } from '@tripo3d/color-quantization';
import { createQuantizationWorker, type WorkerPort } from '@tripo3d/color-quantization/worker';

const input: QuantizationInput = {
  triWorld: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  triUV: new Float32Array([0, 0, 1, 0, 0, 1]),
  texture: { width: 1, height: 1, data: new Uint8Array([255, 0, 0]) }, flipY: false,
};
const a: Analysis = analyze(input, { maxDistanceMatrixBytes: 128 * 1024 * 1024, log: message => message.toUpperCase(), progress: (stage, fraction) => `${stage}:${fraction}` });
const count: number = getLevel(a, 1).K;
const rgba: Uint8Array = renderPreview(a, count).data;
const mesh: CommittedMesh = commit(input, a, { colorCount: count });
const indices: Int32Array = mesh.T;
const port: WorkerPort = new Worker(new URL('../../worker-entry.js', import.meta.url), { type: 'module' });
port.terminate();
const client = createQuantizationWorker({
  createWorker: (url, options) => new Worker(url, options),
  onProgress: (stage, fraction, id) => `${id}:${stage}:${fraction}`,
  onLog: (message, id) => `${id}:${message}`,
  onError: error => error.message,
});
const workerAnalysis: Analysis = await client.analyze(input, { maxDistanceMatrixBytes: 1024 });
const workerMesh: CommittedMesh = await client.commit(workerAnalysis.suggestedColorCount);
await client.getLevel(1); await client.preview(1); client.dispose();
const errorCode: string = new QuantizationError('ERR_EXAMPLE', 'example').code;
void [rgba, indices, workerMesh, errorCode];
// @ts-expect-error K is numeric, not text.
getLevel(a, '2');
// @ts-expect-error Worker callbacks belong to client construction, not structured-clone options.
client.analyze(input, { log() {} });
