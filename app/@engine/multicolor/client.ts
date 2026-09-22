import type { PrintCommands, PrintProgress, RequestIdentity } from './types';

type Pending = {
  identity: RequestIdentity;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

export class StalePrintRequestError extends Error {
  constructor() { super('The model or edit revision has changed.'); this.name = 'StalePrintRequestError'; }
}

export interface PrintClientOptions {
  baseUrl?: string;
  onProgress?: (progress: PrintProgress) => void;
  workerFactory?: (url: string) => Worker;
}

export class MulticolorClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private nextId = 0;
  private revision = 0;
  private disposed = false;

  constructor(readonly projectId: string, options: PrintClientOptions = {}) {
    const base = options.baseUrl ?? '/';
    const url = `${base.replace(/\/$/, '')}/print-worker/worker.js`;
    this.worker = options.workerFactory?.(url) ?? new Worker(url);
    this.worker.onmessage = ({ data }) => {
      const pending = this.pending.get(data.requestId);
      if (!pending || data.projectId !== projectId || data.editRevision !== pending.identity.editRevision) return;
      if (data.editRevision !== this.revision) {
        this.pending.delete(data.requestId);
        pending.reject(new StalePrintRequestError());
        return;
      }
      if (data.type === 'progress') { options.onProgress?.(data); return; }
      this.pending.delete(data.requestId);
      if (data.type === 'error') pending.reject(new Error(data.message));
      else pending.resolve(data);
    };
    this.worker.onerror = (event) => this.stop(new Error(event.message || 'Print worker failed.'));
    this.worker.onmessageerror = () => this.stop(new Error('Print worker response could not be decoded.'));
  }

  setRevision(revision: number) {
    if (!Number.isSafeInteger(revision) || revision < this.revision) throw new Error('Edit revisions must increase.');
    this.revision = revision;
    for (const [id, pending] of this.pending) {
      if (pending.identity.editRevision < revision) {
        pending.reject(new StalePrintRequestError());
        this.pending.delete(id);
      }
    }
  }

  request<K extends keyof PrintCommands>(type: K, payload: PrintCommands[K][0]): Promise<PrintCommands[K][1]> {
    if (this.disposed) return Promise.reject(new Error('Print worker has been disposed.'));
    const identity = { projectId: this.projectId, requestId: ++this.nextId, editRevision: this.revision };
    return new Promise((resolve, reject) => {
      this.pending.set(identity.requestId, { identity, resolve: resolve as (value: unknown) => void, reject });
      try { this.worker.postMessage({ ...payload, ...identity, type }); }
      catch (error) {
        this.pending.delete(identity.requestId);
        reject(error);
      }
    });
  }

  dispose() {
    this.stop(new Error('Print worker has been disposed.'));
  }

  private stop(error: Error) {
    if (this.disposed) return;
    this.disposed = true;
    this.worker.terminate();
    this.fail(error);
  }

  private fail(error: Error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
