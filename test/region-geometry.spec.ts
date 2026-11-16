import { expect, it } from 'vitest';
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { acceleratedRaycast } from 'three-mesh-bvh';
import { regionGeometry, regionPickingGeometry } from '../app/@engine/viewer/region-geometry';

it('reuses positions and authored normals while label edits keep picking aligned', () => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 2, 1, 0]);
  const normals = new Float32Array(positions.length); for (let i = 2; i < normals.length; i += 3) normals[i] = 1;
  const data = { positions, normals, labels: new Uint8Array([0, 1]) };
  const geometry = regionGeometry(data, 2);
  const picking = regionPickingGeometry(data); const tree = picking.boundsTree;
  const normalAttribute = geometry.getAttribute('normal'); const positionAttribute = geometry.getAttribute('position');
  const edited = regionGeometry({ ...data, labels: new Uint8Array([1, 0]) }, 2, geometry);
  expect(edited).toBe(geometry);
  expect(edited.getAttribute('normal')).toBe(normalAttribute); expect(edited.getAttribute('position')).toBe(positionAttribute);
  expect(Array.from(edited.index!.array)).toEqual([3, 4, 5, 0, 1, 2]);
  expect(regionPickingGeometry({ ...data, labels: new Uint8Array([1, 0]) }, picking)).toBe(picking);
  expect(picking.boundsTree).toBe(tree);
  const mesh = new Mesh(picking, new MeshBasicMaterial()); mesh.raycast = acceleratedRaycast;
  const hit = new Raycaster(new Vector3(0.2, 0.2, 1), new Vector3(0, 0, -1)).intersectObject(mesh)[0]!;
  expect(hit.faceIndex).toBe(0);
  expect(Math.floor(picking.index!.getX(hit.faceIndex! * 3) / 3)).toBe(0);
  geometry.dispose(); picking.dispose(); mesh.material.dispose();
});

it('maps the first visible leaf to its original source face after material regrouping', () => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, -0.01, 1, 0, -0.01, 0, 1, -0.01]);
  const data = { positions, labels: new Uint8Array([1, 0]), faceMap: new Uint32Array([37, 91]) };
  const geometry = regionGeometry(data, 2), picking = regionPickingGeometry(data);
  const mesh = new Mesh(picking, new MeshBasicMaterial()); mesh.raycast = acceleratedRaycast;
  const raycaster = new Raycaster(new Vector3(0.2, 0.2, 1), new Vector3(0, 0, -1)); raycaster.firstHitOnly = true;
  const hit = raycaster.intersectObject(mesh)[0]!;
  const leaf = Math.floor(picking.index!.getX(hit.faceIndex! * 3) / 3);
  expect(data.faceMap[leaf]).toBe(37);
  const edited = { ...data, labels: new Uint8Array([0, 1]) };
  regionGeometry(edited, 2, geometry);
  expect(regionPickingGeometry(edited, picking)).toBe(picking);
  expect(data.faceMap[Math.floor(picking.index!.getX(raycaster.intersectObject(mesh)[0]!.faceIndex! * 3) / 3)]).toBe(37);
  geometry.dispose(); picking.dispose(); mesh.material.dispose();
});
