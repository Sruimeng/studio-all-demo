import { SphereGeometry, TorusGeometry, CapsuleGeometry, Color } from 'three';
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const pieces = [];
const add = (name, geometry, color, position, scale = [1, 1, 1]) => { geometry.scale(...scale); geometry.translate(...position); pieces.push({ name, geometry, color }); };
add('helmet', new SphereGeometry(1, 64, 48), '#F0E6D1', [0, 3.8, 0], [1.3, 1.16, 1.1]);
add('visor', new SphereGeometry(1, 64, 32), '#344453', [0, 3.85, 0.63], [1.08, 0.73, 0.63]);
add('helmet rim', new TorusGeometry(0.85, 0.09, 12, 64), '#E87E5C', [0, 3.82, 0.93], [1.25, 0.85, 0.7]);
add('suit', new CapsuleGeometry(0.72, 0.8, 16, 48), '#F0E6D1', [0, 2.13, 0], [1.2, 1, 0.85]);
add('pack', new CapsuleGeometry(0.63, 0.6, 12, 32), '#A1B9A2', [0, 2.3, -0.6], [1.2, 1, 0.65]);
for (const side of [-1, 1]) {
  const arm = new CapsuleGeometry(0.29, 0.85, 12, 32); arm.rotateZ(side * 0.3);
  add('arm', arm, '#F0E6D1', [side * 1.07, 2.15, 0]);
  add('glove', new SphereGeometry(0.33, 32, 24), '#E87E5C', [side * 1.2, 1.48, 0.05]);
  add('leg', new CapsuleGeometry(0.37, 0.75, 12, 32), '#F0E6D1', [side * 0.48, 0.82, 0]);
  add('boot', new SphereGeometry(1, 32, 24), '#A1B9A2', [side * 0.48, 0.28, 0.16], [0.43, 0.3, 0.61]);
}
add('control panel', new SphereGeometry(1, 32, 24), '#E87E5C', [0, 2.43, 0.57], [0.5, 0.39, 0.13]);
for (const x of [-0.22, 0, 0.22]) add('button', new SphereGeometry(0.08, 16, 12), '#344453', [x, 2.43, 0.7]);
const parts = [], views = [], accessors = [], meshes = [], nodes = [], materials = []; let offset = 0;
function append(array, target) { const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength); const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4); padded.set(bytes); const id = views.length; views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) }); parts.push(padded); offset += padded.length; return id; }
function pngChunk(type, data) {
  const payload = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
  for (const byte of payload) { crc ^= byte; for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; }
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, payload, checksum]);
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 6;
const pixel = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(Buffer.from([0, 255, 255, 255, 255]))), pngChunk('IEND', Buffer.alloc(0))]);
const imageView = append(pixel);
for (const { name, geometry, color } of pieces) {
  const attrs = {};
  for (const [key, semantic] of [['position', 'POSITION'], ['normal', 'NORMAL'], ['uv', 'TEXCOORD_0']]) {
    const a = geometry.attributes[key]; const view = append(a.array, 34962); const id = accessors.length;
    const min = Array.from({ length: a.itemSize }, (_, c) => { let v = Infinity; for (let i = c; i < a.array.length; i += a.itemSize) v = Math.min(v, a.array[i]); return v; });
    const max = Array.from({ length: a.itemSize }, (_, c) => { let v = -Infinity; for (let i = c; i < a.array.length; i += a.itemSize) v = Math.max(v, a.array[i]); return v; });
    accessors.push({ bufferView: view, componentType: 5126, count: a.count, type: a.itemSize === 2 ? 'VEC2' : 'VEC3', ...(key === 'position' ? { min, max } : {}) }); attrs[semantic] = id;
  }
  const index = geometry.index.array; const ix = accessors.length;
  accessors.push({ bufferView: append(index, 34963), componentType: index.BYTES_PER_ELEMENT === 2 ? 5123 : 5125, count: index.length, type: 'SCALAR' });
  const c = new Color(color); const material = materials.length;
  materials.push({ name: color, pbrMetallicRoughness: { baseColorFactor: [c.r, c.g, c.b, 1], baseColorTexture: { index: 0 }, metallicFactor: color === '#344453' ? 0.6 : 0, roughnessFactor: 0.35 } });
  nodes.push({ name, mesh: meshes.length }); meshes.push({ primitives: [{ attributes: attrs, indices: ix, material }] });
}
const json = { asset: { version: '2.0', generator: 'Tripo Material Studio sample' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, materials, accessors, bufferViews: views, buffers: [{ byteLength: offset }], textures: [{ source: 0 }], images: [{ bufferView: imageView, mimeType: 'image/png' }] };
const text = Buffer.from(JSON.stringify(json)); const jsonBytes = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(jsonBytes);
const bin = Buffer.concat(parts); const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonBytes.length + bin.length, 8); header.writeUInt32LE(jsonBytes.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
mkdirSync('public/samples', { recursive: true }); writeFileSync('public/samples/atelier.glb', Buffer.concat([header, jsonBytes, binHeader, bin]));
