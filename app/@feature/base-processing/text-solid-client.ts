import type { MeshData } from '~/@engine/base-processing';
import type { TextSolidResult } from './text-solid';
export interface TextSolidRequest { id: number; base: MeshData; text: MeshData }
export type TextSolidResponse = { id: number; result: TextSolidResult } | { id: number; error: string };
export class TextSolidCancelled extends Error { constructor() { super('Text joining cancelled'); } }
export class TextSolidClient {
  private worker: Worker | null = null;
  private reject: ((error: Error) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private id = 0;
  private finish() {
    this.worker?.terminate(); this.worker = null; this.reject = null;
    if (this.timer) clearTimeout(this.timer); this.timer = null;
  }
  cancel() { this.id++; const reject = this.reject; this.finish(); reject?.(new TextSolidCancelled()); }
  run(base: MeshData, text: MeshData): Promise<TextSolidResult> {
    this.cancel(); const id = this.id;
    return new Promise((resolve, reject) => {
      this.reject = reject;
      try {
        const worker = new Worker(new URL('./text-solid.worker.ts', import.meta.url), { type: 'module' }); this.worker = worker;
        const fail = (error: Error) => { if (id !== this.id) return; this.finish(); reject(error); };
        worker.onmessage = (event: MessageEvent<TextSolidResponse>) => {
          if (id !== this.id || event.data.id !== id) return;
          this.finish(); if ('error' in event.data) reject(new Error(event.data.error)); else resolve(event.data.result);
        };
        worker.onerror = event => fail(new Error(event.message || '文字连接失败 / Text joining failed'));
        worker.onmessageerror = () => fail(new Error('无法读取文字连接结果 / Invalid text join result'));
        this.timer = setTimeout(() => fail(new Error('文字连接耗时过长，请简化底座或文字后重试 / Simplify the base or text and try again')), 60000);
        const copy = (mesh: MeshData) => ({ positions: mesh.positions.slice(), indices: mesh.indices.slice() });
        const request = { id, base: copy(base), text: copy(text) };
        worker.postMessage(request, [request.base.positions.buffer, request.base.indices.buffer, request.text.positions.buffer, request.text.indices.buffer]);
      } catch (error) { this.finish(); reject(error); }
    });
  }
}
