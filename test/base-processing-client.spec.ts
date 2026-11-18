import { afterEach, describe, expect, it, vi } from 'vitest';
import { CutClient, CancelledCutError } from '../app/@engine/base-processing';
import type { CutResult } from '../app/@engine/base-processing';
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: { message: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn(); terminate = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
}
const source = { positions: new Float32Array([0,0,0, 1,0,0, 0,1,0]), indices: new Uint32Array([0,1,2]) };
const plane = { normal: [0,1,0] as [number,number,number], offset: 0, cap: true };
afterEach(() => { vi.unstubAllGlobals(); FakeWorker.instances = []; });
describe('base processing worker isolation', () => {
  it('transfers a copy and terminates the worker after completion', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const client = new CutClient(), promise = client.run(source,plane), worker = FakeWorker.instances[0]!;
    const request = worker.postMessage.mock.calls[0]![0];
    expect(request.mesh.positions).not.toBe(source.positions);
    expect(request.mesh.indices).not.toBe(source.indices);
    expect(request.mesh.positions).toEqual(source.positions);
    const result = { ...source } as CutResult;
    worker.onmessage!({data:{id:request.id,result}});
    expect(await promise).toBe(result); expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('rejects cancellation and ignores a stale response after a new request', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const client = new CutClient(), first = client.run(source,plane);
    const rejection = expect(first).rejects.toBeInstanceOf(CancelledCutError);
    const old = FakeWorker.instances[0]!, second = client.run(source,plane), latest = FakeWorker.instances[1]!;
    await rejection; expect(old.terminate).toHaveBeenCalledOnce();
    old.onmessage!({data:{id:old.postMessage.mock.calls[0]![0].id,result:'stale'}});
    const value = {...source} as CutResult;
    latest.onmessage!({data:{id:latest.postMessage.mock.calls[0]![0].id,result:value}});
    expect(await second).toBe(value);
  });
  it('surfaces errors and cleans up', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const client = new CutClient(), promise = client.run(source,plane), worker=FakeWorker.instances[0]!;
    const rejection=expect(promise).rejects.toThrow('broken mesh');
    worker.onmessage!({data:{id:worker.postMessage.mock.calls[0]![0].id,error:'broken mesh'}});
    await rejection; expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
