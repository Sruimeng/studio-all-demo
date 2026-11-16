import { QuantizationError, validateAnalysis, validateLevel, validatePreview, validateMesh } from './src/validate.js';

export function createQuantizationWorker(options = {}) {
  if (!options || typeof options !== 'object') throw new TypeError('Worker options must be an object.');
  for (const key of ['createWorker', 'onLog', 'onProgress', 'onError']) if (options[key] !== undefined && typeof options[key] !== 'function') throw new TypeError(`${key} must be a function.`);
  let worker;
  if (options.createWorker) {
    worker = options.createWorker(new URL('./worker-entry.js', import.meta.url), { type: 'module' });
  } else {
    if (typeof Worker !== 'function') throw new QuantizationError('ERR_WORKER_UNAVAILABLE', 'Provide createWorker outside a browser.');
    // Vite needs the literal URL inside the native constructor to bundle the worker's module graph.
    worker = new Worker(new URL('./worker-entry.js', import.meta.url), { type: 'module' });
  }
  const pending = new Map();
  let nextId = 0, disposed = false, state = 'empty', metadata = null;
  const error = (code, message) => new QuantizationError(code, message);
  const detach = () => {
    worker.removeEventListener('message', receive);
    worker.removeEventListener('error', fatal);
    worker.removeEventListener('messageerror', fatal);
  };
  const stop = reason => {
    if (disposed) return;
    disposed = true; state = 'empty'; metadata = null; detach();
    for (const task of pending.values()) task.reject(reason);
    pending.clear(); worker.terminate();
  };
  const fatal = event => {
    const reason = error('ERR_WORKER_FATAL', event.message || 'Worker failed or could not deserialize a message.');
    stop(reason); options.onError?.(reason);
  };
  const receive = ({ data }) => {
    if (disposed) return;
    const task = pending.get(data?.id);
    if (!task) { fatal({ message: 'Worker returned an unknown request id.' }); return; }
    if (data.type === 'log' && typeof data.message === 'string') { options.onLog?.(data.message, data.id); return; }
    if (data.type === 'progress' && typeof data.stage === 'string' && Number.isFinite(data.fraction) && data.fraction >= 0 && data.fraction <= 1) { options.onProgress?.(data.stage, data.fraction, data.id); return; }
    if (data.type !== 'error' && (data.type !== 'result' || data.command !== task.type || data.result === undefined)) { fatal({ message: 'Malformed worker response.' }); return; }
    if (data.type === 'result') {
      try {
        switch (task.type) {
          case 'analyze':
            validateAnalysis(data.result);
            metadata = { width: data.result.width, height: data.result.height, leaves: data.result.leafLab.length };
            break;
          case 'getLevel': validateLevel(data.result, task.colorCount, metadata.leaves); break;
          case 'preview': validatePreview(data.result, task.colorCount, metadata.width, metadata.height); break;
          case 'commit': validateMesh(data.result, task.colorCount); break;
        }
      } catch (reason) { stop(reason); options.onError?.(reason); return; }
    }
    pending.delete(data.id);
    if (task.type === 'analyze') {
      state = data.type === 'result' ? 'ready' : 'empty';
      if (state === 'empty') metadata = null;
    }
    if (data.type === 'error') task.reject(error(data.code || 'ERR_QUANTIZATION', data.message || 'Worker request failed.'));
    else task.resolve(data.result);
  };
  worker.addEventListener('message', receive);
  worker.addEventListener('error', fatal);
  worker.addEventListener('messageerror', fatal);
  const request = (type, payload) => new Promise((resolve, reject) => {
    if (disposed) { reject(error('ERR_WORKER_DISPOSED', 'Worker is disposed.')); return; }
    if (type === 'analyze' ? state === 'analyzing' : state !== 'ready') { reject(error('ERR_SEQUENCE', 'Await a successful analyze before sending this request.')); return; }
    if (type === 'analyze') state = 'analyzing';
    const id = ++nextId;
    pending.set(id, { type, colorCount: payload.colorCount, resolve, reject });
    try { worker.postMessage({ id, type, ...payload }); }
    catch (reason) {
      pending.delete(id); if (type === 'analyze') state = 'empty'; reject(reason);
    }
  });
  return {
    analyze: (input, analyzeOptions = {}) => request('analyze', { input, options: analyzeOptions }),
    getLevel: colorCount => request('getLevel', { colorCount }),
    preview: colorCount => request('preview', { colorCount }),
    commit: colorCount => request('commit', { colorCount }),
    dispose: () => stop(error('ERR_WORKER_DISPOSED', 'Worker was terminated.')),
  };
}
