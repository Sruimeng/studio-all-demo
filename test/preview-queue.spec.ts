import { afterEach, expect, it, vi } from 'vitest';
import { createPreviewQueue } from '../app/@feature/workspace/preview-queue';

const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
afterEach(() => vi.useRealTimers());
it('debounces input and never publishes an outdated in-flight result', async () => {
  vi.useFakeTimers();
  const first = deferred(), runs: number[] = [], published: number[] = [], pending: boolean[] = [];
  const queue = createPreviewQueue<number>({
    pending: value => pending.push(value), error: error => { throw error; },
    async run(value, current) { runs.push(value); if (value === 2) await first.promise; if (current()) published.push(value); },
  });
  queue.schedule(1); queue.schedule(2);
  await vi.advanceTimersByTimeAsync(60); expect(runs).toEqual([2]);
  queue.schedule(3); queue.schedule(4); await vi.advanceTimersByTimeAsync(60);
  expect(runs).toEqual([2]); first.resolve(); await queue.flush();
  expect(runs).toEqual([2, 4]); expect(published).toEqual([4]); expect(pending.at(-1)).toBe(false);
});
it('cancels a replaced project and flushes the final value before saving', async () => {
  vi.useFakeTimers(); const results: number[] = [];
  const queue = createPreviewQueue<number>({ pending: vi.fn(), error: vi.fn(), async run(value, current) { if (current()) results.push(value); } });
  queue.schedule(1); queue.cancel(); await vi.advanceTimersByTimeAsync(100); expect(results).toEqual([]);
  queue.schedule(5); await queue.flush(); expect(results).toEqual([5]);
});
