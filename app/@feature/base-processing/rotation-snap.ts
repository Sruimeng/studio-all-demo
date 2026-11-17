import { Euler, MathUtils, Quaternion } from 'three';

/** Magnetic quarter-turn stops, in the same XYZ angles shown by the gizmo. */
export function snapPlaneRotation(rotation: Quaternion): Quaternion {
  const angles = new Euler().setFromQuaternion(rotation, 'XYZ');
  const step = Math.PI / 2, tolerance = MathUtils.degToRad(4);
  let snapped = false;
  for (const axis of ['x', 'y', 'z'] as const) {
    const target = Math.round(angles[axis] / step) * step;
    if (Math.abs(angles[axis] - target) <= tolerance) {
      snapped ||= angles[axis] !== target;
      angles[axis] = target;
    }
  }
  return snapped ? new Quaternion().setFromEuler(angles).normalize() : rotation.clone();
}
