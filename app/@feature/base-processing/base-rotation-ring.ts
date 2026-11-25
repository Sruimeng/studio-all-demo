import { Group, Plane, Raycaster, Vector2, Vector3, type Camera, type Scene } from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const segments = 128, turn = Math.PI * 2;
const normalize = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180;

/** A world-Y ring with screen-space picking, including when viewed edge-on. */
export function createBaseRotationRing(camera: Camera, scene: Scene, canvas: HTMLCanvasElement) {
  const object = new Group(); object.name = 'base-y-rotation-ring'; object.visible = false;
  const vertices = Array.from({ length: segments + 1 }, (_, i) => new Vector3(Math.cos(i / segments * turn), 0, -Math.sin(i / segments * turn)));
  const geometry = new LineGeometry().setPositions(vertices.flatMap(v => v.toArray()));
  const material = new LineMaterial({ color: '#87cf9a', linewidth: 2.5, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const line = new Line2(geometry, material); line.renderOrder = 32; line.frustumCulled = false; object.add(line); scene.add(object);
  const screen = vertices.map(() => new Vector3()), raycaster = new Raycaster(), plane = new Plane(new Vector3(0, 1, 0));
  let width = 0, height = 0;
  let drag: { start: Vector2; tangent: Vector2; pixelsPerRadian: number; previous: number; angle: number; planar: boolean } | null = null;
  function project(angle: number) {
    const p = new Vector3(Math.cos(angle), 0, -Math.sin(angle)).multiplyScalar(object.scale.x).add(object.position).project(camera);
    return new Vector2((p.x + 1) * width / 2, (1 - p.y) * height / 2);
  }
  function local(event: PointerEvent) { const rect = canvas.getBoundingClientRect(); return new Vector2(event.clientX - rect.left, event.clientY - rect.top); }
  function planeAngle(event: PointerEvent) {
    const p = local(event); raycaster.setFromCamera(new Vector2(p.x / width * 2 - 1, 1 - p.y / height * 2), camera);
    const intersection = raycaster.ray.intersectPlane(plane, new Vector3());
    if (!intersection || intersection.distanceToSquared(object.position) < 1e-8) return null;
    return Math.atan2(-(intersection.z - object.position.z), intersection.x - object.position.x);
  }
  function update(center: Vector3, radius: number, visible: boolean) {
    object.visible = visible;
    if (!visible) return;
    const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
    if (!width || !height) { object.visible = false; return; }
    object.position.copy(center); object.scale.setScalar(radius); object.updateMatrixWorld(true);
    material.resolution.set(width, height); plane.setFromNormalAndCoplanarPoint(new Vector3(0, 1, 0), center);
    vertices.forEach((v, i) => {
      const p = screen[i]!.copy(v).multiplyScalar(radius).add(center).project(camera);
      p.x = (p.x + 1) * width / 2; p.y = (1 - p.y) * height / 2;
    });
  }
  function hit(event: PointerEvent) {
    if (!object.visible) return null;
    const p = local(event); let distance = 8, depth = Infinity, angle: number | null = null;
    for (let i = 0; i < segments; i++) {
      const a = screen[i]!, b = screen[i + 1]!;
      if (a.z <= -1 || a.z >= 1 || b.z <= -1 || b.z >= 1) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy), z = a.z + t * (b.z - a.z);
      if (d < distance - 0.01 || (d <= distance && z < depth)) { distance = d; depth = z; angle = (i + t) / segments * turn; }
    }
    return angle;
  }
  function begin(event: PointerEvent, degrees: number) {
    const angle = hit(event); if (angle === null) return false;
    const tangent = project(angle + 0.01).sub(project(angle - 0.01)).multiplyScalar(50);
    let pixelsPerRadian = tangent.length();
    // At the tips of an edge-on ellipse, use a stable horizontal drag direction.
    if (pixelsPerRadian < 24) { tangent.set(1, 0); pixelsPerRadian = Math.max(40, project(0).distanceTo(project(Math.PI)) / 2, project(Math.PI / 2).distanceTo(project(-Math.PI / 2)) / 2); }
    tangent.normalize();
    const start = planeAngle(event), view = camera.getWorldPosition(new Vector3()).sub(object.position).normalize();
    drag = { start: local(event), tangent, pixelsPerRadian, previous: start ?? 0, angle: degrees * Math.PI / 180, planar: Math.abs(view.y) > 0.18 && start !== null };
    return true;
  }
  function move(event: PointerEvent) {
    if (!drag) return null;
    if (drag.planar) {
      const next = planeAngle(event); if (next === null) return null;
      // Accumulate wrapped deltas so ±180° and repeated full turns never clamp.
      drag.angle += Math.atan2(Math.sin(next - drag.previous), Math.cos(next - drag.previous)); drag.previous = next;
    } else {
      const next = local(event); drag.angle += next.clone().sub(drag.start).dot(drag.tangent) / drag.pixelsPerRadian; drag.start.copy(next);
    }
    return normalize(Math.round(drag.angle * 180 / Math.PI * 10) / 10);
  }
  return {
    object, update, hit, begin, move,
    paint(active: boolean, muted: boolean) { material.color.set(active ? '#ffdb57' : '#87cf9a'); material.opacity = muted ? 0.25 : 1; material.linewidth = active ? 3.5 : 2.5; },
    end() { drag = null; },
    dispose() { drag = null; geometry.dispose(); material.dispose(); scene.remove(object); },
  };
}
