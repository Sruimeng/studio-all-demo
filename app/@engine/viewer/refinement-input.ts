import type { ViewerHit, ViewerSettings } from './types';

export type RefinementTool = ViewerSettings['tool'] | 'picker' | 'source-picker';
export interface RefinementHit { edit: ViewerHit; materialIndex: number; barycentric?: [number, number, number] }

const pickerCursor = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="m15 4 5 5M14 5l-9 9v3l-3 3 1 1 3-3h3l10-10a2.8 2.8 0 0 0-4-4Z" fill="none" stroke="white" stroke-width="4" stroke-linejoin="round"/><path d="m15 4 5 5M14 5l-9 9v3l-3 3 1 1 3-3h3l10-10a2.8 2.8 0 0 0-4-4Z" fill="none" stroke="#242527" stroke-width="2" stroke-linejoin="round"/></svg>')}") 2 21, crosshair`;
const bucketPath = 'm9 3 10 10-8 8-9-9 8-8M3 12h15M6 2l5 5m9 9s-2 2.5-2 4a2 2 0 0 0 4 0c0-1.5-2-4-2-4Z';
const bucketCursor = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="${bucketPath}" fill="none" stroke="white" stroke-width="4" stroke-linejoin="round"/><path d="${bucketPath}" fill="none" stroke="#242527" stroke-width="1.8" stroke-linejoin="round"/></svg>`)}") 18 13, crosshair`;

/** A gesture keeps the role of its starting point, even when it crosses the silhouette. */
export function bindRefinementInput(element: HTMLElement, options: {
  controls: { enabled: boolean };
  tool: () => RefinementTool;
  busy: () => boolean;
  hit: (point: { clientX: number; clientY: number }) => RefinementHit | null;
  stroke: (hits: ViewerHit[]) => void;
  fill: (hit: ViewerHit) => void;
  select: (face: number | null, additive: boolean) => void;
  pick: (materialIndex: number) => void;
  sample?: (face: number, barycentric: [number, number, number]) => void;
  hover?: (face: number | null) => void;
}) {
  let gesture: { pointer: number; tool: RefinementTool; editing: boolean; x: number; y: number; moved: boolean; primary: boolean; stroke: ViewerHit[] } | null = null;
  let pointer: { clientX: number; clientY: number } | null = null;

  function refreshCursor() {
    const tool = options.tool();
    const overModel = pointer && !options.busy() && tool !== 'orbit' && options.hit(pointer);
    options.hover?.(tool === 'fill' && !gesture && overModel ? overModel.edit.face : null);
    element.style.cursor = tool === 'orbit' ? (gesture ? 'grabbing' : 'grab')
      : gesture && !gesture.editing ? 'default' : overModel ? (tool === 'picker' || tool === 'source-picker' ? pickerCursor : tool === 'fill' ? bucketCursor : 'crosshair') : 'default';
  }
  function reset() {
    const previous = gesture;
    gesture = null;
    options.controls.enabled = true;
    if (previous?.editing && element.hasPointerCapture(previous.pointer)) element.releasePointerCapture(previous.pointer);
    refreshCursor();
  }
  function down(event: PointerEvent) {
    if (gesture) return;
    pointer = event;
    const tool = options.tool();
    const result = event.button === 0 && !options.busy() && tool !== 'orbit' ? options.hit(event) : null;
    gesture = { pointer: event.pointerId, tool, editing: !!result, x: event.clientX, y: event.clientY, moved: false, primary: event.button === 0, stroke: result && tool === 'brush' ? [result.edit] : [] };
    // Capture phase runs before OrbitControls' pointerdown listener.
    options.controls.enabled = !gesture.editing;
    if (gesture.editing) { event.preventDefault(); element.setPointerCapture(event.pointerId); }
    refreshCursor();
  }
  function move(event: PointerEvent) {
    pointer = event;
    if (gesture?.pointer === event.pointerId) {
      gesture.moved ||= Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5;
      if (gesture.editing && gesture.tool === 'brush' && !options.busy()) {
        const result = options.hit(event);
        if (result && gesture.stroke.at(-1)?.face !== result.edit.face) gesture.stroke.push(result.edit);
      }
    }
    refreshCursor();
  }
  function up(event: PointerEvent) {
    if (!gesture || gesture.pointer !== event.pointerId) return;
    const finished = gesture;
    pointer = event;
    const result = options.hit(event);
    reset();
    if (options.busy() || finished.tool !== options.tool()) return;
    if (finished.editing) {
      if (finished.tool === 'brush' && finished.stroke.length) options.stroke(finished.stroke);
      else if (!finished.moved && result) {
        if (finished.tool === 'picker' || finished.tool === 'source-picker') {
          if (result.barycentric) options.sample?.(result.edit.face, result.barycentric);
          else if (finished.tool === 'picker') options.pick(result.materialIndex);
        }
        else if (finished.tool === 'select') options.select(result.edit.face, event.shiftKey);
        else if (finished.tool === 'fill') options.fill(result.edit);
      }
    } else if (finished.primary && !finished.moved && !result && finished.tool === 'select') options.select(null, event.shiftKey);
    refreshCursor();
  }
  function cancel(event: PointerEvent) { if (gesture?.pointer === event.pointerId) reset(); }
  function leave() { pointer = null; refreshCursor(); }
  function blur() { pointer = null; reset(); }
  element.addEventListener('pointerdown', down, true);
  element.addEventListener('pointermove', move);
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', cancel);
  element.addEventListener('lostpointercapture', cancel);
  element.addEventListener('pointerleave', leave);
  element.ownerDocument.defaultView?.addEventListener('blur', blur);
  refreshCursor();
  return {
    get editing() { return !!gesture?.editing; },
    reset,
    refreshCursor,
    dispose() {
      blur();
      element.removeEventListener('pointerdown', down, true);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', cancel);
      element.removeEventListener('lostpointercapture', cancel);
      element.removeEventListener('pointerleave', leave);
      element.ownerDocument.defaultView?.removeEventListener('blur', blur);
    },
  };
}
