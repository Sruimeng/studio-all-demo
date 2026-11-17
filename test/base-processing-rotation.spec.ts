import { expect, it } from 'vitest';
import { Euler, MathUtils, Quaternion } from 'three';
import { snapPlaneRotation } from '../app/@feature/base-processing/rotation-snap';

const rotation = (x: number, y: number, z: number) => new Quaternion().setFromEuler(new Euler(...[x, y, z].map(MathUtils.degToRad) as [number, number, number], 'XYZ'));

it('snaps all axes and wrapped quarter turns, while keeping free angles outside the magnetic zone', () => {
  for (const axis of [0, 1, 2]) for (const angle of [-179, -91, -1, 1, 89, 91, 179, 269, 359]) {
    const values: [number, number, number] = [0, 0, 0]; values[axis] = angle;
    const input = rotation(...values), original = input.clone();
    values[axis] = Math.round(angle / 90) * 90;
    expect(snapPlaneRotation(input).angleTo(rotation(...values))).toBeLessThan(1e-7);
    expect(input.equals(original)).toBe(true);
  }
  for (const values of [[15, 30, 45], [31, -37, 56], [85, 0, 0], [95, 0, 0]] as const) {
    const input = rotation(...values);
    expect(snapPlaneRotation(input).angleTo(input)).toBeLessThan(1e-7);
  }
  expect(snapPlaneRotation(rotation(88, 30, 15)).angleTo(rotation(90, 30, 15))).toBeLessThan(1e-7);
});
