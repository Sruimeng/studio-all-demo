export interface PreviewQueueOptions<T> {
  run: (value: T, isCurrent: () => boolean) => Promise<void>;
  pending: (value: boolean) => void;
  error: (error: unknown) => void;
  delay?: number;
}

export function createPreviewQueue<T>(options: PreviewQueueOptions<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queued: { value: T; version: number } | undefined;
  let running = false, ready = false, version = 0;
  const waiters: Array<() => void> = [];
  const idle = () => { if (!running && !queued) { options.pending(false); waiters.splice(0).forEach(resolve => resolve()); } };
  const drain = async () => {
    if (running || !queued || !ready) return;
    const job = queued; queued = undefined; running = true; ready = false;
    const isCurrent = () => job.version === version;
    try { await options.run(job.value, isCurrent); }
    catch (error) { if (isCurrent()) options.error(error); }
    finally { running = false; if (queued && ready) void drain(); else idle(); }
  };
  const cancel = () => { version++; clearTimeout(timer); queued = undefined; ready = false; idle(); };
  return {
    schedule(value: T) {
      queued = { value, version: ++version }; ready = false; options.pending(true);
      clearTimeout(timer); timer = setTimeout(() => { ready = true; void drain(); }, options.delay ?? 60);
    },
    cancel,
    flush(): Promise<void> {
      if (!running && !queued) return Promise.resolve();
      clearTimeout(timer); ready = true;
      const done = new Promise<void>(resolve => waiters.push(resolve));
      void drain(); return done;
    },
  };
}
