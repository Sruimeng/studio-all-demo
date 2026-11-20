import { Box3, BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineLoop, Mesh, MeshBasicMaterial, Object3D, Plane, PlaneGeometry, Raycaster, Vector2, Vector3, type Camera, type Scene } from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { watch } from 'vue';
import { createBaseRotationRing } from './base-rotation-ring';
import type { BaseProcessingController } from './use-base-processing';

export interface BaseGizmoFeedback { x: number; y: number; value: number; kind: 'scale' | 'rotation' }
type Target = 'base' | 'text';

/** Translation, uniform scale and base Y rotation share selection and pointer ownership. */
export function createBaseTranslationControls(camera: Camera, scene: Scene, canvas: HTMLCanvasElement, selectableBase: Object3D, tool: BaseProcessingController, onDragging: (dragging: boolean) => void, selectableText?: Object3D, onFeedback: (value: BaseGizmoFeedback | null) => void = () => {}) {
  const previousTouchAction = canvas.style.touchAction;
  const transform = new TransformControls(camera, canvas), proxy = new Object3D(), helper = transform.getHelper();
  // Claim gizmo events in the capture phase, before OrbitControls sees them.
  transform.disconnect(); canvas.style.touchAction = 'none';
  transform.setMode('translate'); transform.setSpace('world'); transform.setSize(0.9);
  transform.setColors('#ed777a', '#87cf9a', '#829efa', '#ffdb57');
  scene.add(proxy, helper);
  const scaleHandles = new Group(), handleGeometry = new PlaneGeometry(1, 1);
  scaleHandles.name = 'base-scale-handles'; scaleHandles.visible = false;
  const handleObjects = Array.from({ length: 4 }, (_, index) => {
    const material = new MeshBasicMaterial({ color: '#c4c1d6', transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    const handle = new Mesh(handleGeometry, material); handle.name = `scale-corner-${index}`; handle.renderOrder = 31; scaleHandles.add(handle); return handle;
  });
  const outlineGeometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
  const outlineMaterial = new LineBasicMaterial({ color: '#b5b1cb', transparent: true, opacity: 0.65, depthTest: false, depthWrite: false, toneMapped: false });
  const outline = new LineLoop(outlineGeometry, outlineMaterial); outline.frustumCulled = false; outline.renderOrder = 30; scaleHandles.add(outline); scene.add(scaleHandles);
  const rotationRing = createBaseRotationRing(camera, scene, canvas);
  const raycaster = new Raycaster(), point = new Vector2(), bounds = new Box3(), corner = new Vector3();
  const screenCorners = Array.from({ length: 4 }, () => new Vector2());
  // The public pointer methods only read normalized x/y/button, despite the DOM typings.
  type TransformPointer = Parameters<TransformControls['pointerHover']>[0];
  let gizmoPointer: number | null = null;
  let click: { id: number; x: number; y: number; moved: boolean } | null = null;
  let dragTarget: Target = 'base', hoveredCorner = -1, hoveredRing = false;
  let rotationDrag: { id: number; x: number; y: number } | null = null;
  let directDrag: { id: number; plane: Plane; offset: Vector3; x: number; y: number; moved: boolean; attachedX: number; attachedY: number } | null = null;
  let pendingTextMove: PointerEvent | null = null;
  let scaleDrag: { id: number; target: Target; corner: number; start: Vector2; direction: Vector2; distance: number; scale: number } | null = null;
  function coordinates(event: PointerEvent, button = event.button): Exclude<TransformPointer, null> {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 2 - 1, y: -(event.clientY - rect.top) / rect.height * 2 + 1, button } as Exclude<TransformPointer, null>;
  }
  function hits(event: PointerEvent, target: Object3D | undefined) {
    if (!target?.visible) return [];
    const p = coordinates(event); point.set(p.x, p.y);
    camera.updateMatrixWorld(); target.updateWorldMatrix(true, true);
    raycaster.setFromCamera(point, camera);
    return raycaster.intersectObject(target, true);
  }
  function hitTarget(event: PointerEvent) { return hits(event, selectableBase).length > 0; }
  function hitText(event: PointerEvent) {
    const text = hits(event, selectableText)[0], base = hits(event, selectableBase)[0];
    return !!text && (!base || text.distance < base.distance);
  }
  function hitVisibleGizmo(event: PointerEvent) {
    const p = coordinates(event); raycaster.setFromCamera(point.set(p.x, p.y), camera);
    const visible: Object3D[] = [];
    helper.traverseVisible(object => {
      if (object instanceof Mesh && !Array.isArray(object.material) && object.material.visible && object.material.opacity > 0.05) visible.push(object);
    });
    return raycaster.intersectObjects(visible, false).length > 0;
  }
  function interactive() { return !tool.busy && !!tool.source && tool.mode === 'add'; }
  function selectedTarget() { return dragTarget === 'text' ? selectableText : selectableBase; }
  function scalePivot() {
    return dragTarget === 'base' ? new Vector3(...tool.basePosition) : new Vector3(...tool.textContact);
  }
  function paintHandles() {
    const translating = gizmoPointer !== null || !!directDrag || !!rotationDrag;
    rotationRing.paint(!!rotationDrag || hoveredRing, gizmoPointer !== null || !!directDrag || !!scaleDrag);
    handleObjects.forEach((handle, index) => {
      const active = index === (scaleDrag?.corner ?? hoveredCorner);
      handle.material.color.set(active ? '#ffdb57' : '#c4c1d6');
      handle.material.opacity = translating || (scaleDrag && !active) ? 0.25 : 1;
    });
    outlineMaterial.opacity = translating ? 0.2 : scaleDrag ? 0.4 : 0.65;
  }
  function update() {
    flushTextMove();
    const target = interactive() && (tool.baseSelected || tool.textSelected) ? selectedTarget() : undefined;
    scaleHandles.visible = false; rotationRing.object.visible = false;
    if (!target?.visible) { onFeedback(null); return; }
    target.updateWorldMatrix(true, true); camera.updateMatrixWorld();
    bounds.setFromObject(target);
    if (bounds.isEmpty()) { onFeedback(null); return; }
    const rect = canvas.getBoundingClientRect(), w = rect.width, h = rect.height;
    if (!w || !h) return;
    // Project only the eight cached bounding-box corners, not all mesh vertices.
    // Constant-pixel handles stay usable when zooming, including million-face assets.
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      corner.set(x, y, z).project(camera);
      if (corner.z <= -1 || corner.z >= 1) { onFeedback(null); return; }
      const sx = (corner.x + 1) * w / 2, sy = (1 - corner.y) * h / 2;
      left = Math.min(left, sx); right = Math.max(right, sx); top = Math.min(top, sy); bottom = Math.max(bottom, sy);
    }
    left -= 12; right += 12; top -= 12; bottom += 12;
    screenCorners[0]!.set(left, bottom); screenCorners[1]!.set(right, bottom);
    screenCorners[2]!.set(right, top); screenCorners[3]!.set(left, top);
    const depth = bounds.getCenter(new Vector3()).project(camera).z;
    const unproject = (x: number, y: number) => new Vector3(x / w * 2 - 1, 1 - y / h * 2, depth).unproject(camera);
    const pixelSize = unproject(1, 0).distanceTo(unproject(0, 0));
    const positions = outlineGeometry.getAttribute('position');
    screenCorners.forEach((screen, index) => {
      const handle = handleObjects[index]!;
      handle.position.copy(unproject(screen.x, screen.y)); camera.getWorldQuaternion(handle.quaternion);
      handle.scale.setScalar(pixelSize * (index === (scaleDrag?.corner ?? hoveredCorner) ? 11 : 9));
      positions.setXYZ(index, handle.position.x, handle.position.y, handle.position.z);
    });
    positions.needsUpdate = true;
    // Encircle the local footprint, so turning a square does not resize the ring.
    const radius = Math.hypot(tool.baseWidth, tool.baseDepth) * tool.baseTransform.getMaxScaleOnAxis() / 2 + pixelSize * 14;
    rotationRing.update(new Vector3(...tool.basePivot), radius, dragTarget === 'base');
    paintHandles(); scaleHandles.visible = true; scaleHandles.updateMatrixWorld(true);
    if (scaleDrag) {
      const screen = screenCorners[scaleDrag.corner]!;
      onFeedback({ x: Math.max(12, Math.min(w - 84, screen.x + 16)), y: Math.max(12, Math.min(h - 36, screen.y - 32)), kind: 'scale', value: scaleDrag.target === 'text' ? tool.textScale : tool.baseScale });
    } else if (rotationDrag) {
      onFeedback({ x: Math.max(12, Math.min(w - 100, rotationDrag.x + 16)), y: Math.max(12, Math.min(h - 36, rotationDrag.y - 32)), kind: 'rotation', value: tool.baseRotationY });
    } else onFeedback(null);
  }
  function hitScale(event: PointerEvent) {
    if (!scaleHandles.visible) return -1;
    const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
    // A slightly larger invisible hit area makes small handles easy to grab.
    return screenCorners.findIndex(screen => Math.abs(x - screen.x) <= 10 && Math.abs(y - screen.y) <= 10);
  }
  function beginScale(event: PointerEvent) {
    const index = hitScale(event); if (index < 0) return false;
    const rect = canvas.getBoundingClientRect(), pivot = scalePivot().project(camera);
    const origin = new Vector2((pivot.x + 1) * rect.width / 2, (1 - pivot.y) * rect.height / 2);
    const direction = screenCorners[index]!.clone().sub(origin), distance = Math.max(direction.length(), 24);
    direction.normalize();
    scaleDrag = { id: event.pointerId, target: dragTarget, corner: index, start: new Vector2(event.clientX, event.clientY), direction, distance, scale: dragTarget === 'text' ? tool.textScale : tool.baseScale };
    click = null; hoveredCorner = index; transform.axis = null; transform.enabled = false;
    transform.setColors('#695253', '#506257', '#505970', '#ffdb57');
    tool.dragging = true; onDragging(true); canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = index % 2 ? 'nwse-resize' : 'nesw-resize'; update();
    event.preventDefault(); event.stopImmediatePropagation(); return true;
  }
  function beginRotation(event: PointerEvent) {
    if (!rotationRing.begin(event, tool.baseRotationY)) return false;
    const rect = canvas.getBoundingClientRect();
    rotationDrag = { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
    click = null; hoveredCorner = -1; hoveredRing = true; transform.axis = null; transform.enabled = false;
    transform.setColors('#695253', '#506257', '#505970', '#ffdb57');
    tool.dragging = true; onDragging(true); canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing'; update();
    event.preventDefault(); event.stopImmediatePropagation(); return true;
  }
  function draggingChanged() { tool.dragging = transform.dragging || !!scaleDrag || !!directDrag || !!rotationDrag; onDragging(tool.dragging); }
  function changed() {
    if (!transform.dragging) return;
    if (dragTarget === 'text') tool.setTextWorldPosition(proxy.position.toArray());
    else tool.setBaseWorldCenter(proxy.position.toArray());
    proxy.position.fromArray(dragTarget === 'text' ? tool.textPivot : tool.basePivot);
  }
  function endDrag() {
    pendingTextMove = null; tool.endTextSurfaceDrag();
    const id = gizmoPointer ?? directDrag?.id ?? scaleDrag?.id ?? rotationDrag?.id ?? null;
    gizmoPointer = null; directDrag = null; scaleDrag = null; rotationDrag = null; rotationRing.end(); click = null; hoveredCorner = -1; hoveredRing = false;
    transform.pointerUp(null); transform.setColors('#ed777a', '#87cf9a', '#829efa', '#ffdb57');
    if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    tool.dragging = false; canvas.style.cursor = ''; onDragging(false); onFeedback(null);
  }
  function sync() {
    const enabled = interactive() && (tool.baseSelected || tool.textSelected);
    const nextTarget = tool.textSelected && !tool.baseSelected ? 'text' : 'base';
    if ((gizmoPointer !== null || directDrag || scaleDrag || rotationDrag) && (!enabled || nextTarget !== dragTarget)) endDrag();
    if (!enabled) {
      transform.detach(); transform.enabled = false; scaleHandles.visible = false; rotationRing.object.visible = false; canvas.style.cursor = ''; onFeedback(null); return;
    }
    transform.enabled = !scaleDrag && !rotationDrag;
    dragTarget = nextTarget;
    proxy.position.fromArray(dragTarget === 'text' ? tool.textPivot : tool.basePivot);
    if (!transform.dragging) {
      proxy.quaternion.identity();
      if (transform.object !== proxy) transform.attach(proxy);
    }
    proxy.updateMatrixWorld(); helper.updateMatrixWorld();
  }
  function down(event: PointerEvent) {
    if (gizmoPointer !== null || directDrag || scaleDrag || rotationDrag) { event.stopImmediatePropagation(); return; }
    if (event.button !== 0 || !event.isPrimary || !interactive()) { click = null; return; }
    sync(); update();
    click = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    // Visible scale corners and the ring win over oversized translation hit zones.
    if (beginScale(event) || beginRotation(event)) return;
    const textHit = hitText(event);
    if (transform.enabled && (!textHit || hitVisibleGizmo(event))) {
      camera.updateMatrixWorld(); helper.updateMatrixWorld();
      transform.setTranslationSnap(event.shiftKey ? 1 : null);
      transform.pointerHover(coordinates(event)); transform.pointerDown(coordinates(event));
    }
    if (transform.dragging) {
      gizmoPointer = event.pointerId; click = null; if (dragTarget === 'text') tool.beginTextSurfaceDrag();
      canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (textHit) {
      tool.selectText();
      const position = new Vector3(...tool.textPosition), plane = new Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()), position);
      const intersection = raycaster.ray.intersectPlane(plane, new Vector3());
      if (!intersection) return;
      directDrag = { id: event.pointerId, plane, offset: position.clone().sub(intersection), x: event.clientX, y: event.clientY, moved: false, attachedX: event.clientX, attachedY: event.clientY };
      tool.beginTextSurfaceDrag();
      click = null; tool.dragging = true; onDragging(true); canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }
  // Coalesce high-frequency pointer events to one surface update per frame.
  function flushTextMove() {
    const event = pendingTextMove; pendingTextMove = null;
    if (!event || !directDrag) return;
    directDrag.moved ||= Math.hypot(event.clientX - directDrag.x, event.clientY - directDrag.y) > 4;
    if (!directDrag.moved) return;
    const p = coordinates(event); camera.updateMatrixWorld(); raycaster.setFromCamera(point.set(p.x, p.y), camera);
    let attached = tool.setTextSurfaceFromRay(raycaster.ray.origin.toArray(), raycaster.ray.direction.toArray());
    const rect = canvas.getBoundingClientRect();
    // Probe before falling back to free movement: no temporary detach/rebuild.
    if (!attached) for (const [dx, dy] of [[-12, 0], [12, 0], [0, -12], [0, 12]]) {
      raycaster.setFromCamera(point.set(p.x + dx! * 2 / rect.width, p.y + dy! * 2 / rect.height), camera);
      attached = tool.setTextSurfaceFromRay(raycaster.ray.origin.toArray(), raycaster.ray.direction.toArray(), true);
      if (attached) break;
    }
    raycaster.setFromCamera(point.set(p.x, p.y), camera);
    if (!attached && Math.hypot(event.clientX - directDrag.attachedX, event.clientY - directDrag.attachedY) < 24) attached = tool.retainTextSurface();
    if (attached) {
      if (!tool.textSurfaceHeld) {
        directDrag.attachedX = event.clientX; directDrag.attachedY = event.clientY;
        const position = new Vector3(...tool.textPosition);
        directDrag.plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()), position);
        const intersection = raycaster.ray.intersectPlane(directDrag.plane, new Vector3());
        if (intersection) directDrag.offset.copy(position).sub(intersection);
      }
    } else {
      const next = raycaster.ray.intersectPlane(directDrag.plane, new Vector3());
      if (next) tool.setTextPosition(next.add(directDrag.offset).toArray());
    }
  }
  function move(event: PointerEvent) {
    if (rotationDrag) {
      if (event.pointerId === rotationDrag.id) {
        const value = rotationRing.move(event); if (value !== null) tool.setBaseRotationY(value);
        const rect = canvas.getBoundingClientRect(); rotationDrag.x = event.clientX - rect.left; rotationDrag.y = event.clientY - rect.top;
      }
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (scaleDrag) {
      if (event.pointerId === scaleDrag.id) {
        const delta = new Vector2(event.clientX, event.clientY).sub(scaleDrag.start);
        // Signed movement clamps at the minimum instead of growing again after crossing the pivot.
        const ratio = 1 + delta.dot(scaleDrag.direction) / scaleDrag.distance;
        const value = Math.min(3, Math.max(scaleDrag.target === 'text' ? 0.05 : 0.25, scaleDrag.scale * ratio));
        if (scaleDrag.target === 'text') tool.setTextScale(value); else tool.setBaseScale(value);
      }
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (directDrag) {
      if (event.pointerId === directDrag.id) pendingTextMove = event;
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (click?.id === event.pointerId && Math.hypot(event.clientX - click.x, event.clientY - click.y) > 5) click.moved = true;
    if (gizmoPointer !== null) {
      if (gizmoPointer === event.pointerId) { transform.pointerMove(coordinates(event, -1)); sync(); }
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (event.buttons) return;
    hoveredCorner = hitScale(event); hoveredRing = hoveredCorner < 0 && rotationRing.hit(event) !== null;
    if (transform.enabled) {
      if (hoveredCorner >= 0 || hoveredRing) transform.axis = null;
      else { helper.updateMatrixWorld(); transform.pointerHover(coordinates(event)); }
    }
    paintHandles();
    canvas.style.cursor = hoveredCorner >= 0 ? (hoveredCorner % 2 ? 'nwse-resize' : 'nesw-resize') : hoveredRing || transform.enabled && transform.axis ? 'grab' : interactive() && hitText(event) ? 'grab' : interactive() && hitTarget(event) ? 'pointer' : '';
  }
  function up(event: PointerEvent) {
    if (gizmoPointer !== null || directDrag || scaleDrag || rotationDrag) {
      if ((gizmoPointer ?? directDrag?.id ?? scaleDrag?.id ?? rotationDrag?.id) === event.pointerId) { flushTextMove(); endDrag(); sync(); }
      event.stopImmediatePropagation(); return;
    }
    const candidate = click; click = null;
    if (!candidate || candidate.id !== event.pointerId || candidate.moved || event.button !== 0 || Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > 5 || !interactive()) return;
    if (hitText(event) && selectableText) tool.selectText();
    else { tool.selectText(false); tool.selectBase(hitTarget(event)); }
  }
  function lost(event: PointerEvent) {
    if (gizmoPointer === event.pointerId || directDrag?.id === event.pointerId || scaleDrag?.id === event.pointerId || rotationDrag?.id === event.pointerId) { endDrag(); sync(); }
    if (click?.id === event.pointerId) click = null;
  }
  function leave() { if (!tool.dragging) { hoveredCorner = -1; hoveredRing = false; transform.axis = null; paintHandles(); canvas.style.cursor = ''; } }
  function key(event: KeyboardEvent) {
    if (!interactive()) return;
    transform.setTranslationSnap(event.shiftKey ? 1 : null);
    if (event.type === 'keydown' && event.key === 'Escape') { endDrag(); tool.selectBase(false); tool.selectText(false); }
  }
  function blur() { transform.setTranslationSnap(null); endDrag(); sync(); }
  transform.addEventListener('dragging-changed', draggingChanged); transform.addEventListener('objectChange', changed);
  canvas.addEventListener('pointerdown', down, true); canvas.addEventListener('pointermove', move, true); canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', lost); canvas.addEventListener('lostpointercapture', lost); canvas.addEventListener('pointerleave', leave);
  window.addEventListener('keydown', key); window.addEventListener('keyup', key); window.addEventListener('blur', blur);
  const stopReplacement = watch(() => [tool.source, tool.baseShape, tool.textContent, tool.textFont, tool.textAdded], () => { endDrag(); sync(); }, { flush: 'sync' });
  const unwatch = watch(() => [tool.busy, tool.source, tool.mode, tool.baseSelected, tool.textSelected, tool.basePivot, tool.textPivot, tool.baseScale, tool.textScale], sync, { immediate: true, flush: 'sync' });
  return {
    // Called after scene transforms and OrbitControls update, before each render.
    update,
    dispose() {
      unwatch(); stopReplacement(); endDrag();
      transform.removeEventListener('dragging-changed', draggingChanged); transform.removeEventListener('objectChange', changed);
      canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('pointermove', move, true); canvas.removeEventListener('pointerup', up, true);
      canvas.removeEventListener('pointercancel', lost); canvas.removeEventListener('lostpointercapture', lost); canvas.removeEventListener('pointerleave', leave);
      window.removeEventListener('keydown', key); window.removeEventListener('keyup', key); window.removeEventListener('blur', blur);
      rotationRing.dispose(); transform.dispose(); handleGeometry.dispose(); handleObjects.forEach(handle => handle.material.dispose()); outlineGeometry.dispose(); outlineMaterial.dispose();
      scene.remove(proxy, helper, scaleHandles); canvas.style.touchAction = previousTouchAction;
    },
  };
}
