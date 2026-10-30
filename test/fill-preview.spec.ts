import { expect, it, vi } from 'vitest';
import { createFillPreview } from '../app/@feature/workspace/fill-preview';

function setup() {
  const pending: Array<(faces: Uint32Array) => void> = [];
  const load = vi.fn(() => new Promise<Uint32Array>(resolve => pending.push(resolve)));
  const publish = vi.fn();
  return { ...createFillPreview(load, publish), load, publish, resolve: async (faces: number[]) => { pending.shift()!(Uint32Array.from(faces)); await Promise.resolve(); } };
}
it('coalesces pointer movement into the latest region and reuses its face set', async () => {
  const preview = setup();
  preview.hover(0); preview.hover(1); preview.hover(2);
  expect(preview.load).toHaveBeenCalledTimes(1);
  await preview.resolve([0]);
  expect(preview.load).toHaveBeenLastCalledWith(2);
  expect(preview.publish).not.toHaveBeenCalledWith(new Uint32Array([0]));
  await preview.resolve([2, 3]);
  expect(preview.publish).toHaveBeenLastCalledWith(new Uint32Array([2, 3]));
  preview.hover(3);
  expect(preview.load).toHaveBeenCalledTimes(2);
});
it('does not restore an old outline after leaving, changing tools or replacing the model', async () => {
  const preview = setup();
  preview.hover(0); preview.clear();
  await preview.resolve([0, 1]);
  expect(preview.publish).toHaveBeenLastCalledWith(new Uint32Array());
  preview.hover(0); await preview.resolve([0, 2]);
  expect(preview.publish).toHaveBeenLastCalledWith(new Uint32Array([0, 2]));
  preview.hover(null);
  expect(preview.publish).toHaveBeenLastCalledWith(new Uint32Array());
});
it('allows the latest hover after an edit invalidates a pending response', async () => {
  const preview = setup();
  preview.hover(0); preview.clear(); preview.hover(0);
  await preview.resolve([0, 1]);
  await preview.resolve([0, 3]);
  expect(preview.publish).toHaveBeenLastCalledWith(new Uint32Array([0, 3]));
});
