import { Worker } from 'node:worker_threads';

export function nodeWorker(entry) {
  const worker = new Worker(new URL('./node-worker-bootstrap.mjs', import.meta.url), { workerData: { entry: entry.href } });
  const listeners = new Map();
  let terminated = false;
  worker.on('exit', code => {
    if (!terminated) for (const listener of listeners.get('error')?.keys() ?? []) listener({ message: `Worker exited unexpectedly (${code}).` });
  });
  const port = {
    postMessage: message => worker.postMessage(message),
    addEventListener(type, listener) {
      const wrapped = type === 'message' ? data => listener({ data }) : error => listener({ error, message: error.message });
      if (!listeners.has(type)) listeners.set(type, new Map());
      listeners.get(type).set(listener, wrapped); worker.on(type, wrapped);
    },
    removeEventListener(type, listener) {
      const wrapped = listeners.get(type)?.get(listener);
      if (wrapped) worker.off(type, wrapped);
      listeners.get(type)?.delete(listener);
    },
    terminate() { terminated = true; return worker.terminate(); },
  };
  return port;
}
