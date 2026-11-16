import { parentPort, workerData } from 'node:worker_threads';
const backlog = [];
let listener;
globalThis.postMessage = message => parentPort.postMessage(message);
globalThis.addEventListener = (type, callback) => {
  if (type !== 'message') throw new Error(`Unsupported event ${type}`);
  listener = callback;
  for (const data of backlog.splice(0)) listener({ data });
};
parentPort.on('message', data => listener ? listener({ data }) : backlog.push(data));
await import(workerData.entry);
