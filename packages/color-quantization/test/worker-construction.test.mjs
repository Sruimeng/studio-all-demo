import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { twoColorFixture } from './fixtures.mjs';
import { nodeWorker } from './node-worker-adapter.mjs';

function setWorker(t, descriptor) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, ...descriptor });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'Worker', original);
    else delete globalThis.Worker;
  });
}

test('default construction keeps the literal native module Worker shape required by Vite', async () => {
  const source = await readFile(new URL('../worker.js', import.meta.url), 'utf8');
  // An indirect URL or globalThis.Worker regresses bundling even if static-module execution still works.
  assert.match(source, /new Worker\(new URL\('\.\/worker-entry\.js', import\.meta\.url\), \{ type: 'module' \}\)/);
});

test('root and worker-client imports do not access Worker; creation without it is coded', async t => {
  setWorker(t, { get() { throw new Error('Worker was accessed during module import.'); } });
  await import(new URL('../index.js?node-import-safety', import.meta.url));
  const { createQuantizationWorker } = await import(new URL('../worker.js?node-import-safety', import.meta.url));
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: undefined });
  assert.throws(() => createQuantizationWorker(), error => error.code === 'ERR_WORKER_UNAVAILABLE');
});

test('default native constructor resolves the packaged entry and completes a real worker lifecycle', { timeout: 15000 }, async t => {
  const calls = [];
  setWorker(t, {
    value: class Worker {
      constructor(url, options) {
        calls.push({ url, options });
        return nodeWorker(url);
      }
    },
  });
  const { createQuantizationWorker } = await import('@tripo3d/color-quantization/worker');
  const client = createQuantizationWorker();
  t.after(() => client.dispose());
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.href, new URL('../worker-entry.js', import.meta.url).href);
  assert.deepEqual(calls[0].options, { type: 'module' });
  const analysis = await client.analyze(twoColorFixture());
  const k = analysis.suggestedColorCount;
  assert.equal((await client.getLevel(k)).K, k);
  assert.equal((await client.preview(k)).colorCount, k);
  assert.equal((await client.commit(k)).K, k);
  client.dispose();
  await assert.rejects(client.preview(k), error => error.code === 'ERR_WORKER_DISPOSED');
});

test('constructor injection bypasses the native Worker guard and receives the packaged URL', { timeout: 15000 }, async t => {
  setWorker(t, { get() { throw new Error('Injected construction must not access native Worker.'); } });
  const { createQuantizationWorker } = await import('@tripo3d/color-quantization/worker');
  let calls = 0;
  const client = createQuantizationWorker({ createWorker(url, options) {
    calls++;
    assert.equal(url.href, new URL('../worker-entry.js', import.meta.url).href);
    assert.deepEqual(options, { type: 'module' });
    return nodeWorker(url);
  } });
  t.after(() => client.dispose());
  assert.equal(calls, 1);
  const analysis = await client.analyze(twoColorFixture());
  assert.equal((await client.getLevel(analysis.suggestedColorCount)).K, analysis.suggestedColorCount);
});
