import { BoxGeometry, SphereGeometry, Mesh, Group, MeshStandardMaterial } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mkdirSync, writeFileSync } from 'node:fs';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
};
const root = new Group();
const material = new MeshStandardMaterial({ color: '#B8B8B8', roughness: 0.45, metalness: 0 });
const add = (name, geometry, position) => {
  const mesh = new Mesh(geometry, material); mesh.name = name; mesh.position.set(...position); root.add(mesh);
};
add('flat-face', new BoxGeometry(30, 32, 6), [-23, 20, 0]);
add('curved-surface', new SphereGeometry(18, 64, 48), [20, 22, 0]);
add('thin-wall-1mm', new BoxGeometry(30, 10, 1), [-23, 41, 0]);
add('base', new BoxGeometry(90, 4, 40), [0, 2, 0]);
root.updateMatrixWorld(true);
const result = await new GLTFExporter().parseAsync(root, { binary: true });
mkdirSync('public/samples', { recursive: true });
writeFileSync('public/samples/material-check.glb', new Uint8Array(result));
