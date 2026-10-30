import { afterEach, expect, it, vi } from 'vitest';
import { bindRefinementInput, type RefinementTool } from '../app/@engine/viewer/refinement-input';

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(dispose => dispose()); });

function setup(tool: RefinementTool = 'brush') {
  const window = new EventTarget();
  const captured = new Set<number>();
  const element = Object.assign(new EventTarget(), {
    style: { cursor: '' }, ownerDocument: { defaultView: window },
    hasPointerCapture: (id: number) => captured.has(id),
    setPointerCapture: (id: number) => { captured.add(id); },
    releasePointerCapture: (id: number) => { captured.delete(id); },
  });
  const state = { tool, busy: false, source: tool === 'source-picker' };
  const controls = { enabled: true };
  const callbacks = { stroke: vi.fn(), fill: vi.fn(), select: vi.fn(), pick: vi.fn(), hover: vi.fn(), sample: vi.fn() };
  const input = bindRefinementInput(element as unknown as HTMLElement, {
    controls, tool: () => state.tool, busy: () => state.busy,
    hit: ({ clientX, clientY }) => clientX >= 10 && clientX <= 30 && clientY >= 10 && clientY <= 30
      ? { edit: { face: clientX < 20 ? 7 : 18, point: [clientX, clientY, 0], radius: 3 }, materialIndex: state.source ? -1 : clientX < 20 ? 2 : 1, barycentric: state.source ? [0.2, 0.3, 0.5] : undefined } : null,
    ...callbacks,
  });
  cleanups.push(input.dispose);
  const send = (type: string, x: number, y = 15, props: Partial<PointerEvent> = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { pointerId: 1, button: 0, shiftKey: false, clientX: x, clientY: y }, props);
    element.dispatchEvent(event);
    return event;
  };
  return { element, window, state, controls, input, send, ...callbacks };
}

it.each(['brush', 'select', 'fill', 'picker', 'source-picker'] as const)('%s lets a background drag cross the model without editing', tool => {
  const view = setup(tool);
  view.send('pointermove', 0);
  expect(view.element.style.cursor).toBe('default');
  view.send('pointerdown', 0);
  expect(view.controls.enabled).toBe(true);
  view.send('pointermove', 15);
  expect(view.controls.enabled).toBe(true);
  expect(view.element.style.cursor).toBe('default');
  view.send('pointerup', 15);
  expect(view.stroke).not.toHaveBeenCalled();
  expect(view.select).not.toHaveBeenCalled();
  expect(view.pick).not.toHaveBeenCalled();
  expect(view.fill).not.toHaveBeenCalled();
});

it('previews color fill on hover and fills once per click without entering selection mode', () => {
  const view = setup('fill');
  view.send('pointermove', 15);
  expect(view.hover).toHaveBeenLastCalledWith(7);
  expect(view.element.style.cursor).toContain('data:image/svg+xml');
  expect(view.fill).not.toHaveBeenCalled();
  view.send('pointerdown', 15);
  expect(view.controls.enabled).toBe(false);
  expect(view.hover).toHaveBeenLastCalledWith(null);
  view.send('pointerup', 15);
  expect(view.fill).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ face: 7 }));
  view.send('pointerdown', 25);
  view.send('pointerup', 25);
  expect(view.fill).toHaveBeenCalledTimes(2);
  expect(view.select).not.toHaveBeenCalled();
  view.send('pointerleave', 40);
  expect(view.hover).toHaveBeenLastCalledWith(null);
  expect(view.element.style.cursor).toBe('default');
});

it('does not fill when a model drag ends on another region or when the picker is active', () => {
  const view = setup('fill');
  view.send('pointerdown', 15);
  view.send('pointermove', 25);
  view.send('pointerup', 25);
  expect(view.fill).not.toHaveBeenCalled();
  view.state.tool = 'picker'; view.input.reset();
  expect(view.hover).toHaveBeenLastCalledWith(null);
  view.send('pointerdown', 25); view.send('pointerup', 25);
  expect(view.pick).toHaveBeenCalledWith(1);
  expect(view.fill).not.toHaveBeenCalled();
});

it('paints only model hits and keeps the camera locked until a brush gesture ends outside the model', () => {
  const view = setup();
  view.send('pointermove', 15);
  expect(view.element.style.cursor).toBe('crosshair');
  expect(view.send('pointerdown', 15).defaultPrevented).toBe(true);
  expect(view.controls.enabled).toBe(false);
  view.send('pointermove', 25);
  view.send('pointermove', 40);
  expect(view.element.style.cursor).toBe('default');
  expect(view.controls.enabled).toBe(false);
  view.send('pointerup', 40);
  expect(view.stroke.mock.calls[0]![0].map((hit: { face: number }) => hit.face)).toEqual([7, 18]);
  expect(view.controls.enabled).toBe(true);
});

it('selects a color region with Shift without rotating, and ignores a drag started on it', () => {
  const view = setup('select');
  view.send('pointerdown', 15);
  expect(view.controls.enabled).toBe(false);
  view.send('pointerup', 15, 15, { shiftKey: true });
  expect(view.select).toHaveBeenCalledWith(7, true);
  view.select.mockClear();
  view.send('pointerdown', 15);
  view.send('pointermove', 40);
  expect(view.controls.enabled).toBe(false);
  view.send('pointerup', 40);
  expect(view.select).not.toHaveBeenCalled();
});

it('picks the displayed material without painting or selecting faces', () => {
  const view = setup('picker');
  view.send('pointermove', 25);
  expect(view.element.style.cursor).toContain('data:image/svg+xml');
  view.send('pointerdown', 25);
  view.send('pointerup', 25);
  expect(view.pick).toHaveBeenCalledExactlyOnceWith(1);
  expect(view.sample).not.toHaveBeenCalled();
  expect(view.stroke).not.toHaveBeenCalled();
  expect(view.select).not.toHaveBeenCalled();
  expect(view.controls.enabled).toBe(true);
});

it('uses the same picker to sample original colors and select preview filaments', () => {
  const view = setup('picker');
  view.state.source = true;
  view.send('pointerdown', 15); view.send('pointerup', 15);
  expect(view.sample).toHaveBeenCalledExactlyOnceWith(7, [0.2, 0.3, 0.5]);
  expect(view.pick).not.toHaveBeenCalled();
  view.state.source = false;
  view.send('pointerdown', 25); view.send('pointerup', 25);
  expect(view.pick).toHaveBeenCalledExactlyOnceWith(1);
  expect(view.sample).toHaveBeenCalledTimes(1);
  expect(view.fill).not.toHaveBeenCalled();
  expect(view.stroke).not.toHaveBeenCalled();
  expect(view.select).not.toHaveBeenCalled();
});

it.each(['pointercancel', 'lostpointercapture', 'blur'])('discards unfinished edits and restores navigation on %s', event => {
  const view = setup();
  view.send('pointerdown', 15);
  if (event === 'blur') view.window.dispatchEvent(new Event(event));
  else view.send(event, 15);
  view.send('pointerup', 15);
  expect(view.stroke).not.toHaveBeenCalled();
  expect(view.controls.enabled).toBe(true);
  view.send('pointerdown', 0);
  expect(view.controls.enabled).toBe(true);
});

it('keeps right-button navigation and busy-model gestures free of edits', () => {
  const view = setup();
  view.send('pointerdown', 15, 15, { button: 2 });
  expect(view.controls.enabled).toBe(true);
  view.send('pointerup', 15, 15, { button: 2 });
  view.state.busy = true;
  view.send('pointerdown', 15);
  expect(view.controls.enabled).toBe(true);
  view.send('pointerup', 15);
  expect(view.stroke).not.toHaveBeenCalled();
});

it('cancels a pending stroke when the tool changes and leaves no handlers after teardown', () => {
  const view = setup();
  view.send('pointerdown', 15);
  view.state.tool = 'picker'; view.input.reset();
  view.send('pointerup', 15);
  expect(view.stroke).not.toHaveBeenCalled();
  expect(view.pick).not.toHaveBeenCalled();
  view.input.dispose();
  view.send('pointerdown', 15);
  expect(view.controls.enabled).toBe(true);
});

it('samples the source face only on a model click, while background drag remains navigation', () => {
  const view = setup('source-picker');
  view.send('pointerdown', 0); view.send('pointermove', 25); view.send('pointerup', 25);
  expect(view.sample).not.toHaveBeenCalled();
  view.send('pointerdown', 25); view.send('pointerup', 25);
  expect(view.sample).toHaveBeenCalledExactlyOnceWith(18, [0.2, 0.3, 0.5]);
  expect(view.pick).not.toHaveBeenCalled(); expect(view.fill).not.toHaveBeenCalled(); expect(view.stroke).not.toHaveBeenCalled();
});
