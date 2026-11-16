import type { Analysis, AnalyzeOptions, Callbacks, CommittedMesh, Level, Preview, QuantizationInput } from './index.js';
export interface WorkerPort {
  postMessage(message: unknown): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
  terminate(): unknown;
}
export interface WorkerOptions {
  /** Receives the packaged module entry URL. Default: new Worker(url, options). */
  createWorker?: (url: URL, options: { type: 'module' }) => WorkerPort;
  onLog?: (message: string, requestId: number) => void;
  onProgress?: (stage: string, fraction: number, requestId: number) => void;
  onError?: (error: Error) => void;
}
export interface QuantizationWorker {
  /** Copies input through structured clone; never transfers caller buffers. */
  analyze(input: QuantizationInput, options?: Omit<AnalyzeOptions, keyof Callbacks>): Promise<Analysis>;
  getLevel(colorCount: number): Promise<Level>;
  preview(colorCount: number): Promise<Preview>;
  commit(colorCount: number): Promise<CommittedMesh>;
  /** Terminates running synchronous work and rejects every pending request. */
  dispose(): void;
}
export function createQuantizationWorker(options?: WorkerOptions): QuantizationWorker;
