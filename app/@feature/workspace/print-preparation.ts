import type { InitResult } from '~/@engine/multicolor';
import type { PrintDisplay } from '~/@engine/viewer';
import { materialHex, materialProblem } from '~/@feature/materials/supplier';
import type { RegionAssignment } from './types';

export const slicers = ['Bambu Studio', 'Creality Print', 'OrcaSlicer', 'Anycubic'] as const;
export type Slicer = typeof slicers[number];
export type PrepTask = 'check' | 'size' | 'color' | '';
export interface PreparationState {
  version: 1;
  engaged: boolean;
  activeModule: 'multi-color' | 'print';
  origin: 'print' | null;
  slicer: Slicer;
  mode: 'single' | 'multi';
  expanded: PrepTask;
  sizeConfirmedHeight: number | null;
  checkedKey: string | null;
  colorStarted: boolean;
  confirmedColor: { fingerprint: string; geometryKey: string } | null;
}
export const newPreparation = (): PreparationState => ({ version: 1, engaged: false, activeModule: 'multi-color', origin: null, slicer: 'Bambu Studio', mode: 'single', expanded: 'size', sizeConfirmedHeight: null, checkedKey: null, colorStarted: false, confirmedColor: null });
export function restorePreparation(value?: PreparationState): PreparationState {
  if (!value) return newPreparation();
  if (value.version !== 1 || !slicers.includes(value.slicer) || !['single', 'multi'].includes(value.mode) || !['print', 'multi-color'].includes(value.activeModule) || ![null, 'print'].includes(value.origin) || !['check', 'size', 'color', ''].includes(value.expanded) || typeof value.engaged !== 'boolean' || typeof value.colorStarted !== 'boolean' || (value.sizeConfirmedHeight !== null && (!Number.isFinite(value.sizeConfirmedHeight) || value.sizeConfirmedHeight < 10 || value.sizeConfirmedHeight > 320)) || (value.checkedKey !== null && typeof value.checkedKey !== 'string') || (value.confirmedColor !== null && (typeof value.confirmedColor?.fingerprint !== 'string' || typeof value.confirmedColor?.geometryKey !== 'string'))) throw new Error('Invalid print preparation data');
  return JSON.parse(JSON.stringify(value));
}

// Two independent 32-bit accumulators: stable across reloads, independent of view and scale.
export function fingerprint(parts: ArrayLike<number>[], metadata = ''): string {
  let a = 2166136261, b = 5381;
  const add = (n: number) => { a = Math.imul(a ^ n, 16777619); b = Math.imul(b, 33) ^ n; };
  const buffer = new ArrayBuffer(8), view = new DataView(buffer);
  for (const part of parts) {
    add(part.length);
    for (let i = 0; i < part.length; i++) { view.setFloat64(0, part[i]!); add(view.getUint32(0)); add(view.getUint32(4)); }
  }
  for (let i = 0; i < metadata.length; i++) add(metadata.charCodeAt(i));
  return `${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}
export function colorResult(display: PrintDisplay | null, regions: RegionAssignment[]) {
  if (!display?.labels.length || display.positions.length !== display.labels.length * 9) return { problem: '尚无完整分色结果，请先生成分色方案。', used: [], fingerprint: '' };
  const indices = [...new Set(display.labels)].sort((a, b) => a - b);
  const used = [...new Map(indices.flatMap(i => { const material = regions[i]?.material; return material ? [[material.id, material] as const] : []; })).values()];
  for (const i of indices) {
    const region = regions[i];
    if (!region?.material || !region.material.id || !region.material.materialId || region.index !== i || materialProblem(region.material)) return { problem: '有打印区域尚未分配有效耗材，请完成耗材分配。', used, fingerprint: '' };
    if (!/^#[\da-f]{6}$/i.test(materialHex(region.material))) return { problem: '有打印区域的耗材颜色无效。', used, fingerprint: '' };
  }
  return { problem: '', used, fingerprint: fingerprint([display.positions, display.labels], JSON.stringify(indices.map(i => [i, regions[i]!.material]))) };
}
export interface MeshCheck {
  available: boolean; boundary: number; nonManifold: number; degenerate: number; winding: number; duplicates: number; geometryKey: string;
}
export function inspectMesh(info: InitResult | null): MeshCheck {
  const result: MeshCheck = { available: false, boundary: 0, nonManifold: 0, degenerate: 0, winding: 0, duplicates: 0, geometryKey: '' };
  if (!info?.wpos?.length || !info.widx?.length || info.widx.length % 3 || info.wpos.length % 3 || info.wpos.some(n => !Number.isFinite(n)) || info.widx.some(i => i * 3 >= info.wpos.length)) return result;
  result.available = true; result.geometryKey = fingerprint([info.wpos, info.widx]);
  const edges = new Map<string, { count: number; direction: number }>();
  const faces = new Set<string>();
  const p = info.wpos;
  for (let f = 0; f < info.widx.length; f += 3) {
    const ids = [info.widx[f]!, info.widx[f + 1]!, info.widx[f + 2]!];
    const face = [...ids].sort((a, b) => a - b).join(':');
    if (faces.has(face)) result.duplicates++; faces.add(face);
    const [a, b, c] = ids.map(i => i * 3) as [number, number, number];
    const u = [p[b]! - p[a]!, p[b + 1]! - p[a + 1]!, p[b + 2]! - p[a + 2]!];
    const v = [p[c]! - p[a]!, p[c + 1]! - p[a + 1]!, p[c + 2]! - p[a + 2]!];
    if (Math.hypot(u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!) === 0) result.degenerate++;
    for (let e = 0; e < 3; e++) {
      const x = ids[e]!, y = ids[(e + 1) % 3]!, key = `${Math.min(x, y)}:${Math.max(x, y)}`;
      const edge = edges.get(key) ?? { count: 0, direction: 0 }; edge.count++; edge.direction += x < y ? 1 : -1; edges.set(key, edge);
    }
  }
  for (const edge of edges.values()) {
    if (edge.count === 1) result.boundary++;
    if (edge.count > 2) result.nonManifold++;
    if (edge.count === 2 && edge.direction !== 0) result.winding++;
  }
  return result;
}

/** A plain, millimetre-scaled STL for monochrome workflows; never changes color assignments. */
export function monochromeSTL(info: InitResult, scale: number): Blob {
  if (!Number.isFinite(scale) || scale <= 0 || !inspectMesh(info).available) throw new Error('无法导出：模型几何无效。');
  const count = info.widx.length / 3, buffer = new ArrayBuffer(84 + count * 50), out = new DataView(buffer);
  out.setUint32(80, count, true);
  const { bbox, wpos, widx } = info;
  for (let f = 0; f < count; f++) {
    const points = [0, 1, 2].map(c => { const i = widx[f * 3 + c]! * 3; return [(wpos[i]! - (bbox.minX + bbox.maxX) / 2) * scale, -(wpos[i + 2]! - (bbox.minZ + bbox.maxZ) / 2) * scale, (wpos[i + 1]! - bbox.minY) * scale]; });
    const [a, b, c] = points as [number[], number[], number[]];
    const u = b.map((n, i) => n - a[i]!), v = c.map((n, i) => n - a[i]!);
    const normal = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    const length = Math.hypot(...normal) || 1;
    const values = [...normal.map(n => n / length), ...points.flat()];
    values.forEach((n, i) => out.setFloat32(84 + f * 50 + i * 4, n, true));
  }
  return new Blob([buffer], { type: 'model/stl' });
}
