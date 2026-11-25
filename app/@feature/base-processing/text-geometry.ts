import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, ShapePath, Vector3, type Shape } from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import type { MeshData } from '~/@engine/base-processing';
import sansData from './fonts/helvetiker_bold.typeface.json';
import serifData from './fonts/optimer_bold.typeface.json';
import monoData from './fonts/droid_sans_mono_regular.typeface.json';

export const textFonts = ['Helvetiker', 'Optimer', 'Droid Mono'] as const;
export type TextFont = typeof textFonts[number];
const loader = new FontLoader();
const fonts = { Helvetiker: loader.parse(sansData), Optimer: loader.parse(serifData), 'Droid Mono': loader.parse(monoData) };
const fallbackGlyphs = new Map<string, { shapes: Shape[]; advance: number }>();

/** Trace system-font glyphs for characters absent from the bundled Latin font.
 * Canvas supplies only outlines; the final result is real extruded geometry,
 * including counters/holes, and is included in STL exports. */
function systemGlyph(character: string, family: TextFont) {
  const key = `${family}:${character}`, cached = fallbackGlyphs.get(key); if (cached) return cached;
  if (typeof document === 'undefined') throw new Error('该字符需要浏览器字体 / This character needs a browser font');
  const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 150;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('无法生成文字 / Could not create text');
  const cssFamily = family === 'Optimer' ? '"Songti SC", "SimSun", serif' : family === 'Droid Mono' ? 'ui-monospace, "SFMono-Regular", monospace' : '"PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.font = `700 96px ${cssFamily}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText(character, 8, 110);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const filled = (x: number, y: number) => x >= 0 && x < canvas.width && y >= 0 && y < canvas.height && pixels[(y * canvas.width + x) * 4 + 3]! >= 128;
  const edges = new Map<number, number[]>(), stride = canvas.width + 1;
  function edge(x1: number, y1: number, x2: number, y2: number) {
    const start = y1 * stride + x1, end = y2 * stride + x2;
    const outgoing = edges.get(start); if (outgoing) outgoing.push(end); else edges.set(start, [end]);
  }
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (filled(x, y)) {
    if (!filled(x, y - 1)) edge(x, y, x + 1, y);
    if (!filled(x + 1, y)) edge(x + 1, y, x + 1, y + 1);
    if (!filled(x, y + 1)) edge(x + 1, y + 1, x, y + 1);
    if (!filled(x - 1, y)) edge(x, y + 1, x, y);
  }
  const path = new ShapePath(), unit = 10 / 96;
  while (edges.size) {
    const start = edges.keys().next().value!; let current = start;
    const loop: number[] = [];
    do {
      loop.push(current); const outgoing = edges.get(current);
      if (!outgoing?.length) break;
      const next = outgoing.pop()!; if (!outgoing.length) edges.delete(current); current = next;
    } while (current !== start && loop.length < 100000);
    if (current !== start || loop.length < 4) continue;
    const corners = loop.filter((value, i) => {
      const prev = loop[(i + loop.length - 1) % loop.length]!, next = loop[(i + 1) % loop.length]!;
      return (value % stride - prev % stride) * (Math.floor(next / stride) - Math.floor(value / stride)) !== (Math.floor(value / stride) - Math.floor(prev / stride)) * (next % stride - value % stride);
    });
    corners.forEach((value, i) => {
      const x = (value % stride - 8) * unit, y = (110 - Math.floor(value / stride)) * unit;
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    });
    if (corners.length) path.currentPath!.closePath();
  }
  const result = { shapes: path.toShapes(false), advance: ctx.measureText(character).width * unit };
  if (fallbackGlyphs.size > 160) fallbackGlyphs.clear(); fallbackGlyphs.set(key, result); return result;
}

export function buildTextMesh(content: string, family: TextFont = 'Helvetiker'): MeshData & { size: [number, number, number]; seatingOffset: number } {
  const font = fonts[family], parts: BufferGeometry[] = []; let advance = 0;
  const glyphBottoms: number[] = [];
  try {
    for (const character of content) {
      const glyph = font.data.glyphs[character];
      const fallback = glyph ? null : systemGlyph(character, family);
      const shapes = glyph ? font.generateShapes(character, 10) : fallback!.shapes;
      if (shapes.length) {
        const geometry = new ExtrudeGeometry(shapes, { depth: 1.8, steps: 1, curveSegments: 8, bevelEnabled: false });
        geometry.computeBoundingBox(); glyphBottoms.push(geometry.boundingBox!.min.y);
        geometry.translate(advance, 0, 0); parts.push(geometry);
      }
      advance += glyph ? glyph.ha / font.data.resolution * 10 : fallback!.advance;
    }
    const length = parts.reduce((total, part) => total + part.getAttribute('position').array.length, 0);
    if (!length) throw new Error('请输入可见文字 / Enter visible text');
    const positions = new Float32Array(length); let offset = 0;
    for (const part of parts) { positions.set(part.getAttribute('position').array, offset); offset += part.getAttribute('position').array.length; }
    const combined = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3));
    combined.computeBoundingBox(); const bounds = combined.boundingBox!, center = bounds.getCenter(new Vector3()), size = bounds.getSize(new Vector3()).toArray();
    combined.dispose();
    for (let i = 0; i < positions.length; i += 3) { positions[i] = positions[i]! - center.x; positions[i + 1] = positions[i + 1]! - center.y; positions[i + 2] = positions[i + 2]! - center.z; }
    // Curved glyph overshoot can leave another glyph floating above a flat
    // base. Seat the entire word a small, bounded amount, retaining typography.
    const seatingOffset = Math.min(size[1] * 0.12, Math.max(...glyphBottoms) - Math.min(...glyphBottoms));
    return { positions, indices: Uint32Array.from({ length: positions.length / 3 }, (_, i) => i), size, seatingOffset };
  } finally { parts.forEach(part => part.dispose()); }
}

/** Uppermost actual surface at X/Z, including gaps and sloped imported bases. */
export function baseSurfaceHeight(mesh: MeshData, x: number, z: number): number | null {
  let height = -Infinity;
  const p = mesh.positions, indices = mesh.indices;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]! * 3, b = indices[i + 1]! * 3, c = indices[i + 2]! * 3;
    const ax = p[a]!, az = p[a + 2]!, bx = p[b]!, bz = p[b + 2]!, cx = p[c]!, cz = p[c + 2]!;
    const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(denominator) < 1e-10) continue;
    const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator;
    const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator;
    if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
    height = Math.max(height, u * p[a + 1]! + v * p[b + 1]! + (1 - u - v) * p[c + 1]!);
  }
  return Number.isFinite(height) ? height : null;
}
