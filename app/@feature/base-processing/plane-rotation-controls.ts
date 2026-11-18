import { Object3D, Raycaster, Vector2, Vector3, type Camera, type Scene } from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { watch } from 'vue';
import type { BaseProcessingController } from './use-base-processing';
import { snapPlaneRotation } from './rotation-snap';

/** Route rotation rings / base translation arrows before OrbitControls. */
export function createPlaneRotationControls(camera: Camera, scene: Scene, canvas: HTMLCanvasElement, selectablePlane: Object3D, selectableBase: Object3D, tool: BaseProcessingController, onDragging: (dragging: boolean) => void) {
  const previousTouchAction = canvas.style.touchAction;
  const transform = new TransformControls(camera, canvas), proxy = new Object3D(), helper = transform.getHelper();
  // Use the public pointer API so a gizmo drag can claim the event before OrbitControls.
  transform.disconnect(); canvas.style.touchAction = 'none';
  transform.setMode('rotate'); transform.setSpace('world'); transform.setSize(0.9);
  transform.setColors('#ed777a', '#87cf9a', '#829efa', '#ffdb57');
  scene.add(proxy, helper);
  const raycaster = new Raycaster(), point = new Vector2();
  // TransformControls' public pointer methods are typed as DOM PointerEvents,
  // although they only read the normalized x/y/button fields at runtime.
  type TransformPointer = Parameters<TransformControls['pointerHover']>[0];
  let gizmoPointer: number | null = null;
  const rotationDragOrigin = new Vector3();
  let click: { id: number; x: number; y: number; moved: boolean } | null = null;
  function coordinates(event: PointerEvent, button = event.button): Exclude<TransformPointer, null> {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 2 - 1, y: -(event.clientY - rect.top) / rect.height * 2 + 1, button } as Exclude<TransformPointer, null>;
  }
  function hitTarget(event: PointerEvent) {
    const target = tool.mode === 'add' ? selectableBase : selectablePlane;
    if (!target.visible) return false;
    const p = coordinates(event); point.set(p.x, p.y);
    camera.updateMatrixWorld(); target.updateWorldMatrix(true, true);
    raycaster.setFromCamera(point, camera);
    return raycaster.intersectObject(target, tool.mode === 'add').length > 0;
  }
  function interactive() { return !tool.busy && !!tool.source && (tool.mode === 'add' || tool.view === 'preview'); }
  function draggingChanged() { tool.dragging = transform.dragging; onDragging(transform.dragging); }
  function changed() {
    if (!transform.dragging) return;
    if (tool.mode === 'add') {
      tool.setBaseWorldCenter(proxy.position.toArray());
      proxy.position.fromArray(tool.basePivot);
    } else {
      proxy.quaternion.copy(snapPlaneRotation(proxy.quaternion));
      tool.setRotation(proxy.quaternion.toArray());
    }
  }
  function endDrag() {
    const id = gizmoPointer; gizmoPointer = null; click = null;
    transform.pointerUp(null);
    if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    tool.dragging = false; canvas.style.cursor = ''; onDragging(false);
  }
  function sync() {
    const adding = tool.mode === 'add', enabled = interactive() && (adding ? tool.baseSelected : tool.rotating);
    if (!enabled) {
      if (gizmoPointer !== null) endDrag();
      transform.detach(); transform.enabled = false; canvas.style.cursor = ''; return;
    }
    transform.enabled = true;
    proxy.position.fromArray(adding ? tool.basePivot : tool.planeCenter);
    if (!transform.dragging) {
      transform.setMode(adding ? 'translate' : 'rotate');
      if (adding) proxy.quaternion.identity(); else proxy.quaternion.fromArray(tool.rotation);
      if (transform.object !== proxy) transform.attach(proxy);
    }
    proxy.updateMatrixWorld(); helper.updateMatrixWorld();
  }
  function down(event: PointerEvent) {
    if (gizmoPointer !== null) { event.stopImmediatePropagation(); return; }
    if (event.button !== 0 || !event.isPrimary || !interactive()) { click = null; return; }
    click = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    if (!transform.enabled) return;
    camera.updateMatrixWorld(); helper.updateMatrixWorld();
    transform.setTranslationSnap(event.shiftKey ? 1 : null);
    transform.pointerHover(coordinates(event));
    transform.pointerDown(coordinates(event));
    if (transform.dragging) {
      rotationDragOrigin.copy(proxy.position);
      gizmoPointer = event.pointerId; click = null;
      canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }
  function move(event: PointerEvent) {
    if (click?.id === event.pointerId && Math.hypot(event.clientX - click.x, event.clientY - click.y) > 5) click.moved = true;
    if (gizmoPointer !== null) {
      if (gizmoPointer === event.pointerId) {
        if (tool.mode === 'flatten') {
          // Keep pointer sampling stable while the displayed center follows
          // the plane. Otherwise moving the center feeds back into rotation.
          proxy.position.copy(rotationDragOrigin);
          proxy.updateMatrixWorld(); helper.updateMatrixWorld();
        }
        transform.pointerMove(coordinates(event, -1));
        sync();
      }
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (event.buttons) return;
    if (transform.enabled) { helper.updateMatrixWorld(); transform.pointerHover(coordinates(event)); }
    canvas.style.cursor = transform.enabled && transform.axis ? 'grab' : interactive() && hitTarget(event) ? 'pointer' : '';
  }
  function up(event: PointerEvent) {
    if (gizmoPointer !== null) {
      if (gizmoPointer === event.pointerId) { endDrag(); sync(); }
      event.stopImmediatePropagation(); return;
    }
    const candidate = click; click = null;
    if (!candidate || candidate.id !== event.pointerId || candidate.moved || event.button !== 0 || Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > 5) return;
    if (!interactive()) return;
    if (tool.mode === 'add') { tool.selectBase(hitTarget(event)); return; }
    if (hitTarget(event)) tool.activateRotation();
    else tool.stopRotation();
  }
  function lost(event: PointerEvent) {
    if (gizmoPointer === event.pointerId) { endDrag(); sync(); }
    if (click?.id === event.pointerId) click = null;
  }
  function key(event: KeyboardEvent) {
    if (!transform.enabled) return;
    transform.setTranslationSnap(event.shiftKey ? 1 : null);
    if (event.type === 'keydown' && event.key === 'Escape') { endDrag(); if (tool.mode === 'add') tool.selectBase(false); else tool.stopRotation(); }
  }
  function blur() { transform.setTranslationSnap(null); endDrag(); sync(); }
  transform.addEventListener('dragging-changed', draggingChanged); transform.addEventListener('objectChange', changed);
  canvas.addEventListener('pointerdown', down, true); canvas.addEventListener('pointermove', move, true); canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', lost); canvas.addEventListener('lostpointercapture', lost);
  window.addEventListener('keydown', key); window.addEventListener('keyup', key); window.addEventListener('blur', blur);
  const unwatch = watch(() => [tool.rotating, tool.view, tool.busy, tool.source, tool.rotation, tool.planeCenter, tool.mode, tool.baseSelected, tool.basePivot], sync, { immediate: true, flush: 'sync' });
  return {
    dispose() {
      unwatch(); endDrag();
      transform.removeEventListener('dragging-changed', draggingChanged); transform.removeEventListener('objectChange', changed);
      canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('pointermove', move, true); canvas.removeEventListener('pointerup', up, true);
      canvas.removeEventListener('pointercancel', lost); canvas.removeEventListener('lostpointercapture', lost);
      window.removeEventListener('keydown', key); window.removeEventListener('keyup', key); window.removeEventListener('blur', blur);
      transform.dispose(); scene.remove(proxy, helper); canvas.style.touchAction = previousTouchAction;
    },
  };
}
