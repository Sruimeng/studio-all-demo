import type { CutPlane, CutResponse, CutResult, MeshData } from './types';
export class CancelledCutError extends Error { constructor() { super('Cut cancelled'); } }
export class CutClient {
  private worker: Worker | null = null;
  private reject: ((error: Error) => void) | null = null;
  private id = 0;
  cancel() {
    this.id++; this.worker?.terminate(); this.worker = null;
    this.reject?.(new CancelledCutError()); this.reject = null;
  }
  run(mesh: MeshData, plane: CutPlane): Promise<CutResult> {
    this.cancel();
    const id = this.id;
    return new Promise((resolve, reject) => {
      this.reject = reject;
      try {
        const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        this.worker = worker;
        const finish = () => { worker.terminate(); if (this.worker === worker) { this.worker = null; this.reject = null; } };
        worker.onmessage = (event: MessageEvent<CutResponse>) => {
          if (id !== this.id || event.data.id !== id) return;
          finish();
          if ('error' in event.data) reject(new Error(event.data.error)); else resolve(event.data.result);
        };
        worker.onerror = event => { finish(); reject(new Error(event.message || '切割计算失败 / Cut worker failed')); };
        worker.onmessageerror = () => { finish(); reject(new Error('无法读取处理结果 / Invalid worker response')); };
        const positions = mesh.positions.slice(), indices = mesh.indices.slice();
        worker.postMessage({ id, mesh: { positions, indices }, plane }, [positions.buffer, indices.buffer]);
      } catch (error) { this.worker?.terminate(); this.worker = null; this.reject = null; reject(error); }
    });
  }
}
