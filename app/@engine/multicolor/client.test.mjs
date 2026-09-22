import { expect, test, vi } from 'vitest';
import { MulticolorClient, StalePrintRequestError } from './client';

function fixture() {
  const worker = { postMessage: vi.fn(), terminate: vi.fn() };
  const workerFactory = vi.fn(() => worker);
  const onProgress = vi.fn();
  const client = new MulticolorClient('project-a', { baseUrl: '/demo/', workerFactory, onProgress });
  const reply = (data) => worker.onmessage({ data });
  return { client, worker, workerFactory, onProgress, reply };
}

test('worker URL respects static deployment base and identities reject stale replies', async () => {
  const { client, worker, workerFactory, onProgress, reply } = fixture();
  expect(workerFactory).toHaveBeenCalledWith('/demo/print-worker/worker.js');
  const pending = client.request('snapshot', {});
  const failure = pending.catch(error => error);
  const sent = worker.postMessage.mock.calls[0][0];
  expect(sent).toMatchObject({ projectId: 'project-a', requestId: 1, editRevision: 0 });
  client.setRevision(1);
  expect(await failure).toBeInstanceOf(StalePrintRequestError);
  reply({ ...sent, type: 'progress', p: 0.5 });
  expect(onProgress).not.toHaveBeenCalled();
  const current = client.request('snapshot', {});
  const latest = worker.postMessage.mock.calls[1][0];
  reply({ ...latest, type: 'snapshot', snapshot: { version: 1 } });
  expect(await current).toMatchObject({ snapshot: { version: 1 } });
  client.dispose();
});

test('dispose rejects every pending request and future commands', async () => {
  const { client, worker } = fixture();
  const pending = client.request('snapshot', {}).catch(error => error);
  client.dispose();
  expect(await pending).toBeInstanceOf(Error);
  await expect(client.request('snapshot', {})).rejects.toThrow('disposed');
  expect(worker.terminate).toHaveBeenCalledOnce();
  client.dispose();
  expect(worker.terminate).toHaveBeenCalledOnce();
});

test('worker crashes close the client instead of leaving later requests pending', async () => {
  const { client, worker } = fixture();
  const pending = client.request('snapshot', {}).catch(error => error);
  worker.onerror({ message: 'GPU tab closed' });
  expect((await pending).message).toBe('GPU tab closed');
  await expect(client.request('snapshot', {})).rejects.toThrow('disposed');
});
