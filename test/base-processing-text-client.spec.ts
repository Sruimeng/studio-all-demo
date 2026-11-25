import { afterEach, expect, it, vi } from 'vitest';
import { TextSolidClient, TextSolidCancelled } from '../app/@feature/base-processing/text-solid-client';
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn(); terminate = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
}
const mesh = { positions: new Float32Array([0,0,0,1,0,0,0,1,0]), indices: new Uint32Array([0,1,2]) };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); FakeWorker.instances = []; });
it('transfers copies, cancels old jobs and rejects stale results', async () => {
  vi.stubGlobal('Worker',FakeWorker);
  const client = new TextSolidClient(), first = client.run(mesh,mesh), old = FakeWorker.instances[0]!;
  const rejected = expect(first).rejects.toBeInstanceOf(TextSolidCancelled);
  const second = client.run(mesh,mesh), worker = FakeWorker.instances[1]!; await rejected;
  const request = worker.postMessage.mock.calls[0]![0];
  expect(request.base.positions).not.toBe(mesh.positions); expect(request.text.indices).not.toBe(mesh.indices);
  old.onmessage!({data:{id:old.postMessage.mock.calls[0]![0].id,result:'stale'}});
  const result = { ...mesh, faceMaterials: new Uint8Array([1]), volume: 1 };
  worker.onmessage!({data:{id:request.id,result}});
  expect(await second).toBe(result); expect(old.terminate).toHaveBeenCalledOnce(); expect(worker.terminate).toHaveBeenCalledOnce();
});
it('terminates stalled calculations and allows a new request', async () => {
  vi.useFakeTimers(); vi.stubGlobal('Worker',FakeWorker);
  const client = new TextSolidClient(), pending = client.run(mesh,mesh);
  const rejected = expect(pending).rejects.toThrow('耗时过长');
  await vi.advanceTimersByTimeAsync(60000); await rejected;
  expect(FakeWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
  const retry = client.run(mesh,mesh), rejectedRetry = expect(retry).rejects.toBeInstanceOf(TextSolidCancelled);
  client.cancel(); await rejectedRetry;
});
