import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyze, commit, renderPreview } from '@tripo3d/color-quantization';
import { createQuantizationWorker } from '@tripo3d/color-quantization/worker';
import { planeFixture, twoColorFixture } from './fixtures.mjs';
import { nodeWorker } from './node-worker-adapter.mjs';

const code = expected => error => error.code === expected;

test('real packaged worker retains input/analysis, correlates concurrent K requests and copies buffers', { timeout: 15000 }, async t => {
  const progress = [], logs = [];
  const client = createQuantizationWorker({ createWorker: nodeWorker, onProgress: (...args) => progress.push(args), onLog: (...args) => logs.push(args) });
  t.after(() => client.dispose());
  await assert.rejects(client.preview(1), code('ERR_SEQUENCE'));
  const input = twoColorFixture(), original = structuredClone(input);
  const analyzing = client.analyze(input);
  await assert.rejects(client.analyze(input), code('ERR_SEQUENCE'));
  await assert.rejects(client.getLevel(1), code('ERR_SEQUENCE'));
  const a = await analyzing;
  assert.deepEqual(input, original);
  assert.ok(input.triWorld.byteLength > 0 && input.texture.data.byteLength > 0);
  assert.deepEqual(a, analyze(original));
  const jobs = await Promise.all([client.getLevel(2), client.preview(1), client.getLevel(1), client.preview(2), client.commit(2)]);
  assert.equal(jobs[0].K, 2); assert.equal(jobs[2].K, 1);
  assert.deepEqual(jobs[1], renderPreview(a, 1)); assert.deepEqual(jobs[3], renderPreview(a, 2));
  assert.deepEqual(jobs[4], commit(original, a, { colorCount: 2 }));
  a.leafIndexMap.fill(99); input.texture.data.fill(0);
  assert.deepEqual(await client.preview(2), renderPreview(analyze(original), 2));
  assert.ok(progress.length > 10 && progress.every(([stage, fraction, id]) => typeof stage === 'string' && fraction >= 0 && fraction <= 1 && Number.isSafeInteger(id)));
  assert.ok(logs.length > 2);
  await assert.rejects(client.commit(1.2), code('ERR_COLOR_COUNT'));
  const bad = twoColorFixture(); bad.texture.data = new Uint8Array(1);
  await assert.rejects(client.analyze(bad), code('ERR_INVALID_INPUT'));
  await assert.rejects(client.preview(1), code('ERR_SEQUENCE'));
  await client.analyze(original);
  await assert.rejects(client.analyze(original, { maxDistanceMatrixBytes: 1 }), code('ERR_DISTANCE_MATRIX_BUDGET'));
  await client.analyze(original);
  const pending = [client.preview(1), client.commit(2), client.getLevel(2)];
  client.dispose(); client.dispose();
  for (const job of pending) await assert.rejects(job, code('ERR_WORKER_DISPOSED'));
  await assert.rejects(client.preview(1), code('ERR_WORKER_DISPOSED'));
});

test('dispose terminates a running synchronous analysis; it is not cooperative cancellation', { timeout: 15000 }, async t => {
  let sawProgress = false;
  const client = createQuantizationWorker({ createWorker: nodeWorker, onProgress() { sawProgress = true; client.dispose(); } });
  t.after(() => client.dispose());
  await assert.rejects(client.analyze(planeFixture('smooth-shading', { width: 64, height: 64 }).input), code('ERR_WORKER_DISPOSED'));
  assert.equal(sawProgress, true);
});

test('fatal real worker errors reject pending work and make the client unusable', { timeout: 15000 }, async t => {
  const failures = [];
  const client = createQuantizationWorker({ createWorker: () => nodeWorker(new URL('./fatal-worker.mjs', import.meta.url)), onError: e => failures.push(e) });
  t.after(() => client.dispose());
  await assert.rejects(client.analyze(twoColorFixture()), code('ERR_WORKER_FATAL'));
  assert.match(failures[0].message, /Intentional worker failure/);
  await assert.rejects(client.getLevel(1), code('ERR_WORKER_DISPOSED'));
});

test('malformed analysis responses and unknown IDs from real workers fail closed', { timeout: 15000 }, async t => {
  for (const [mode, expected] of [['bad-analysis', 'ERR_INVALID_ANALYSIS'], ['unknown-id', 'ERR_WORKER_FATAL']]) {
    const client = createQuantizationWorker({ createWorker: () => nodeWorker(new URL('./malformed-worker.mjs', import.meta.url)) });
    t.after(() => client.dispose());
    await assert.rejects(client.analyze({ ...twoColorFixture(), mode }), code(expected));
    await assert.rejects(client.preview(1), code('ERR_WORKER_DISPOSED'));
  }
});

test('real entry returns coded sequence, malformed-message and unknown-command errors', { timeout: 15000 }, async t => {
  const port = nodeWorker(new URL('../worker-entry.js', import.meta.url));
  t.after(() => port.terminate());
  const queue = [], waiters = [];
  port.addEventListener('message', ({ data }) => {
    if (data.type === 'progress' || data.type === 'log') return;
    const waiter = waiters.shift(); if (waiter) waiter(data); else queue.push(data);
  });
  const next = () => queue.length ? Promise.resolve(queue.shift()) : new Promise(resolve => waiters.push(resolve));
  port.postMessage({ id: 1, type: 'preview', colorCount: 1 });
  assert.equal((await next()).code, 'ERR_SEQUENCE');
  port.postMessage({ type: 'preview' });
  assert.equal((await next()).code, 'ERR_PROTOCOL');
  port.postMessage({ id: 2, type: 'analyze', input: twoColorFixture() });
  assert.equal((await next()).type, 'result');
  port.postMessage({ id: 3, type: 'unknown' });
  const result = await next(); assert.equal(result.id, 3); assert.equal(result.code, 'ERR_PROTOCOL');
  port.postMessage({ id: 4, type: 'getLevel', colorCount: 0 });
  assert.equal((await next()).code, 'ERR_COLOR_COUNT');
});
