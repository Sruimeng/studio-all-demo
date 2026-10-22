import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { PrintMeshInput } from '~/@engine/multicolor';
import { fingerprint } from '~/@feature/workspace/print-preparation';
import { markerColors, optionsKey, type SegmentGroup, type SegmentMode, type SegmentOptions, type SegmentPiece, type SegmentPlan } from './types';
import { presetTarget, referenceGroups, referenceLabel } from './reference';

export function geometryKey(mesh: PrintMeshInput) { return fingerprint([mesh.positions, mesh.topologyVertices ?? [], mesh.faceDomain ?? []]); }
export function validatePlan(plan: SegmentPlan, mesh: PrintMeshInput) {
  if (plan.key !== geometryKey(mesh)) throw new Error('方案对应的模型版本已变化，请重新生成。');
  const ids = new Set(plan.groups.map(g => g.id));
  if (!plan.groups.length || ids.size !== plan.groups.length || plan.groups.some(g => !Number.isInteger(g.id) || !g.name.trim() || !/^#[\da-f]{6}$/i.test(g.color))) throw new Error('部件清单无效。');
  if (plan.labels.length !== mesh.positions.length / 9 || plan.labels.some(id => !ids.has(id))) throw new Error('存在未分配的模型区域，请补充分配。');
  const used = new Set([...plan.labels, ...(plan.mask?.labels ?? [])]);
  if (plan.groups.some(g => !used.has(g.id))) throw new Error('存在空部件，请合并或删除后再试。');
}

// Edge adjacency honors original topology and mesh domains; coincident surfaces in separate meshes never join.
export function topology(mesh: PrintMeshInput) {
  const n = mesh.positions.length / 9, ids = mesh.topologyVertices ?? new Uint32Array(n * 3);
  if (!mesh.topologyVertices) {
    const vertices = new Map<string, number>();
    for (let i = 0; i < ids.length; i++) {
      const key = `${mesh.faceDomain?.[Math.floor(i / 3)] ?? 0}:${mesh.positions[i * 3]},${mesh.positions[i * 3 + 1]},${mesh.positions[i * 3 + 2]}`;
      if (!vertices.has(key)) vertices.set(key, vertices.size); ids[i] = vertices.get(key)!;
    }
  }
  const edges = new Map<string, number[]>();
  for (let f = 0; f < n; f++) for (let c = 0; c < 3; c++) {
    const a = ids[f * 3 + c]!, b = ids[f * 3 + (c + 1) % 3]!;
    const key = `${mesh.faceDomain?.[f] ?? 0}:${Math.min(a, b)}:${Math.max(a, b)}`;
    const faces = edges.get(key); if (faces) faces.push(f); else edges.set(key, [f]);
  }
  const neighbors: number[][] = Array.from({ length: n }, () => []);
  for (const faces of edges.values()) if (faces.length === 2 && faces[0] !== faces[1]) { neighbors[faces[0]!]!.push(faces[1]!); neighbors[faces[1]!]!.push(faces[0]!); }
  return { neighbors, edges };
}

export function connectedPieces(mesh: PrintMeshInput, plan: SegmentPlan): SegmentPiece[] {
  validatePlan(plan, mesh);
  const { neighbors, edges } = topology(mesh), visited = new Uint8Array(plan.labels.length);
  const pieces: SegmentPiece[] = [], owners = new Int32Array(plan.labels.length).fill(-1);
  for (let seed = 0; seed < visited.length; seed++) {
    if (visited[seed]) continue;
    const group = plan.groups.find(g => g.id === plan.labels[seed])!;
    const faces = [seed]; visited[seed] = 1;
    for (let i = 0; i < faces.length; i++) for (const next of neighbors[faces[i]!]!) if (!visited[next] && plan.labels[next] === group.id) { visited[next] = 1; faces.push(next); }
    const id = pieces.length; for (const f of faces) owners[f] = id;
    pieces.push({ id, groupId: group.id, name: group.name, color: group.color, faces, boundary: 0, nonManifold: 0 });
  }
  for (const faces of edges.values()) {
    const counts = new Map<number, number>();
    for (const f of faces) counts.set(owners[f]!, (counts.get(owners[f]!) ?? 0) + 1);
    for (const [id, count] of counts) { if (count === 1) pieces[id]!.boundary++; if (count > 2) pieces[id]!.nonManifold++; }
  }
  const totals = new Map<number, number>(), counts = new Map<number, number>();
  for (const p of pieces) totals.set(p.groupId, (totals.get(p.groupId) ?? 0) + 1);
  for (const p of pieces) { const count = (counts.get(p.groupId) ?? 0) + 1; counts.set(p.groupId, count); if (totals.get(p.groupId)! > 1) p.name += ` · ${count}`; }
  return pieces;
}

export function extractGroup(mesh: PrintMeshInput, pieces: SegmentPiece[], scale = 1, marker = false) {
  const root = new Group(); root.name = 'Segment result';
  for (const piece of pieces) {
    const positions = new Float32Array(piece.faces.length * 9);
    piece.faces.forEach((face, i) => { for (let c = 0; c < 9; c++) positions[i * 9 + c] = mesh.positions[face * 9 + c]! * scale; });
    const geo = new BufferGeometry(); geo.setAttribute('position', new BufferAttribute(positions, 3)); geo.computeVertexNormals();
    const part = new Mesh(geo, new MeshStandardMaterial({ color: marker ? piece.color : '#d9dadc', roughness: 0.65 }));
    part.name = piece.name; part.userData = { segmentPiece: piece.id, groupId: piece.groupId, boundaryEdges: piece.boundary, nonManifoldEdges: piece.nonManifold, sealedBySegment: false };
    root.add(part);
  }
  return root;
}

export function assignFaces(plan: SegmentPlan, faces: readonly number[], target: number, newName?: string): SegmentPlan {
  if (!faces.length || faces.some(f => !Number.isInteger(f) || f < 0 || f >= plan.labels.length)) throw new Error('请先选择有效的模型区域。');
  const next: SegmentPlan = { ...plan, labels: [...plan.labels], groups: [...plan.groups] };
  if (newName) { target = Math.max(...next.groups.map(g => g.id)) + 1; next.groups.push({ id: target, name: newName.trim() || '新部件', color: markerColors[target % markerColors.length]! }); }
  if (!next.groups.some(g => g.id === target)) throw new Error('目标部件不存在。');
  if (faces.every(f => plan.labels[f] === target)) return plan;
  for (const f of faces) next.labels[f] = target;
  // Keep groups referenced by the 2D mask even when a 3D brush temporarily
  // moves all of their visible faces to another group.
  const used = new Set([...next.labels, ...(next.mask?.labels ?? [])]); next.groups = next.groups.filter(g => used.has(g.id)); next.edited = true;
  if (next.mask) next.maskOutdated = true;
  return next;
}

export async function faceColors(mesh: PrintMeshInput): Promise<Float32Array> {
  const images = await Promise.all(mesh.images.map(async blob => {
    if (!blob) return null;
    const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) { bitmap.close(); throw new Error('无法读取贴图。'); }
    ctx.drawImage(bitmap, 0, 0); bitmap.close(); return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }));
  const colors = new Float32Array(mesh.positions.length / 3);
  for (let f = 0; f < colors.length / 3; f++) {
    const material = mesh.materials[mesh.faceMat[f]!]!, image = images[material?.image ?? -1];
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let v = 0; v < 3; v++) {
        const i = f * 3 + v;
        if (image) {
          const u = Math.max(0, Math.min(1, mesh.uvs![i * 2]!)), y = Math.max(0, Math.min(1, mesh.uvs![i * 2 + 1]!));
          const pixel = (Math.min(image.height - 1, Math.floor(y * image.height)) * image.width + Math.min(image.width - 1, Math.floor(u * image.width))) * 4;
          // Texture RGB is used only to suggest groups, never treated as calibrated filament color.
          sum += image.data[pixel + c]!;
        } else sum += mesh.colors?.[i * 3 + c] ?? 220;
      }
      colors[f * 3 + c] = sum / 3;
    }
  }
  return colors;
}

function colorName(rgb: number[]) {
  const [r, g, b] = rgb as [number, number, number], max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min < 38) return max < 85 ? '深色区域' : min > 175 ? '浅色区域' : '灰色区域';
  if (r > g * 1.4 && r > b * 1.2) return '红色区域';
  if (r > 110 && g > 70 && b < g * 0.8) return '棕黄色区域';
  if (g > r && g > b) return '绿色区域';
  if (b > r && b > g) return '蓝色区域';
  return '粉紫色区域';
}

export function suggestPlan(mesh: PrintMeshInput, mode: SegmentMode, options: SegmentOptions, colors?: Float32Array): SegmentPlan {
  const count = mesh.positions.length / 9, labels = new Array<number>(count).fill(0);
  let groups: SegmentGroup[];
  const prompt = options.prompt.trim();
  if (mode === 'parts') {
    const allowed = ['', '按主要部件拆分', '头部与身体分开', '双脚单独拆出', '左右配件单独拆出'];
    if (!allowed.includes(prompt)) throw new Error('本地演示支持下方 4 条快捷要求；自由语义识别待接入服务。可先选择快捷要求，再手动调整边界。');
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < mesh.positions.length; i += 3) { minY = Math.min(minY, mesh.positions[i + 1]!); maxY = Math.max(maxY, mesh.positions[i + 1]!); minX = Math.min(minX, mesh.positions[i]!); maxX = Math.max(maxX, mesh.positions[i]!); }
    const names = prompt === '头部与身体分开' ? ['头部候选', '其余整体'] : prompt === '双脚单独拆出' ? ['脚部候选', '其余整体'] : prompt === '左右配件单独拆出' ? ['左侧配件候选', '右侧配件候选', '其余整体'] : options.detail === 'coarse' ? ['上部', '其余整体'] : ['上部', '主体', '脚部候选', ...(options.detail === 'fine' ? ['左侧配件候选', '右侧配件候选'] : [])];
    groups = names.map((name, id) => ({ id, name, color: markerColors[id]! }));
    for (let f = 0; f < count; f++) {
      const i = f * 9, y = ((mesh.positions[i + 1]! + mesh.positions[i + 4]! + mesh.positions[i + 7]!) / 3 - minY) / (maxY - minY || 1);
      const x = ((mesh.positions[i]! + mesh.positions[i + 3]! + mesh.positions[i + 6]!) / 3 - minX) / (maxX - minX || 1);
      if (prompt === '头部与身体分开') labels[f] = y > 0.57 ? 0 : 1;
      else if (prompt === '双脚单独拆出') labels[f] = y < 0.18 ? 0 : 1;
      else if (prompt === '左右配件单独拆出') labels[f] = x < 0.25 && y < 0.7 ? 0 : x > 0.75 && y < 0.7 ? 1 : 2;
      else if (options.detail === 'coarse') labels[f] = y > 0.57 ? 0 : 1;
      else labels[f] = y < 0.18 ? 2 : options.detail === 'fine' && y < 0.7 && x < 0.25 ? 3 : options.detail === 'fine' && y < 0.7 && x > 0.75 ? 4 : y > 0.57 ? 0 : 1;
    }
  } else {
    if (!colors || colors.length !== count * 3) throw new Error('当前模型没有可读取的颜色依据。');
    if (!['', '按主要颜色拆分', '合并相近颜色'].includes(prompt)) throw new Error('本地演示支持按主要颜色聚类；请使用快捷要求或在方案中手动合并颜色区域。');
    const n = options.detail === 'coarse' ? 3 : options.detail === 'fine' ? 7 : 5;
    const centers: number[][] = [[...colors.slice(0, 3)]];
    const distance = (f: number, c: number[]) => c.reduce((sum, v, k) => sum + (colors[f * 3 + k]! - v) ** 2, 0);
    for (let k = 1; k < n; k++) { let far = 0, best = -1; for (let f = 0; f < count; f += 5) { const d = Math.min(...centers.map(c => distance(f, c))); if (d > best) { far = f; best = d; } } centers.push([...colors.slice(far * 3, far * 3 + 3)]); }
    for (let pass = 0; pass < 8; pass++) {
      const sums = centers.map(() => [0, 0, 0, 0]);
      for (let f = 0; f < count; f++) { let best = Infinity, id = 0; centers.forEach((c, k) => { const d = distance(f, c); if (d < best) { best = d; id = k; } }); labels[f] = id; const sum = sums[id]!; for (let c = 0; c < 3; c++) sum[c]! += colors[f * 3 + c]!; sum[3]!++; }
      centers.forEach((c, k) => { if (sums[k]![3]) for (let i = 0; i < 3; i++) c[i] = sums[k]![i]! / sums[k]![3]!; });
    }
    if (options.mergeSimilar || prompt === '合并相近颜色') for (let i = 1; i < centers.length; i++) for (let j = 0; j < i; j++) if (Math.hypot(...centers[i]!.map((v, k) => v - centers[j]![k]!)) < 65) { for (let f = 0; f < count; f++) if (labels[f] === i) labels[f] = j; break; }
    groups = centers.map((c, id) => ({ id, name: `${colorName(c)} ${id + 1}`, color: markerColors[id % markerColors.length]! }));
    // Remove isolated one-face texture noise without discarding geometry.
    const { neighbors } = topology(mesh);
    for (let pass = 0; pass < 3; pass++) { const before = [...labels]; for (let f = 0; f < count; f++) { const ns = neighbors[f]!; const votes = new Map<number, number>(); for (const v of ns) votes.set(before[v]!, (votes.get(before[v]!) ?? 0) + 1); const best = [...votes].sort((a, b) => b[1] - a[1])[0]; if (best && best[1] >= 2) labels[f] = best[0]; } }
  }
  const used = new Set(labels); groups = groups.filter(g => used.has(g.id));
  const plan = { key: geometryKey(mesh), optionsKey: optionsKey(mode, options), labels, groups, edited: false };
  validatePlan(plan, mesh); return plan;
}

/** Curated chicken adapter: material cues and mesh connectivity replace horizontal slicing.
 * This is still surface extraction, not semantic solid partitioning or watertight completion. */
export function suggestReferenceGeometry(mesh: PrintMeshInput, mode: SegmentMode, options: SegmentOptions, colors: Float32Array): SegmentPlan {
  const count = mesh.positions.length / 9, target = presetTarget(mode, options.prompt);
  const effective = target === null ? options : { ...options, detail: 'standard' as const, mergeSimilar: true };
  if (colors.length !== count * 3) throw new Error('当前示例缺少颜色依据。');
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) { minX = Math.min(minX, mesh.positions[i]!); maxX = Math.max(maxX, mesh.positions[i]!); minY = Math.min(minY, mesh.positions[i + 1]!); maxY = Math.max(maxY, mesh.positions[i + 1]!); }
  const labels = Array.from({ length: count }, (_, f) => {
    const i = f * 9, x = (mesh.positions[i]! + mesh.positions[i + 3]! + mesh.positions[i + 6]!) / 3, y = (mesh.positions[i + 1]! + mesh.positions[i + 4]! + mesh.positions[i + 7]!) / 3;
    const id = referenceLabel(colors[f * 3]!, colors[f * 3 + 1]!, colors[f * 3 + 2]!, 0.19 + 0.67 * (x - minX) / (maxX - minX || 1), 0.955 - 0.88 * (y - minY) / (maxY - minY || 1), mode, effective);
    return target === null || target === id ? id : 0;
  });
  const { neighbors } = topology(mesh);
  for (let pass = 0; pass < 6; pass++) {
    const before = [...labels];
    for (let f = 0; f < count; f++) {
      const votes = new Map<number, number>(); for (const n of neighbors[f]!) votes.set(before[n]!, (votes.get(before[n]!) ?? 0) + 1);
      const best = [...votes].sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] >= 2 && !neighbors[f]!.some(n => before[n] === before[f])) labels[f] = best[0];
    }
  }
  // Absorb tiny disconnected texture islands, retaining every face and the original geometry.
  const seen = new Uint8Array(count);
  for (let seed = 0; seed < count; seed++) {
    if (seen[seed]) continue;
    const component = [seed], label = labels[seed]!, votes = new Map<number, number>(); seen[seed] = 1;
    for (let i = 0; i < component.length; i++) for (const n of neighbors[component[i]!]!) {
      if (labels[n] !== label) votes.set(labels[n]!, (votes.get(labels[n]!) ?? 0) + 1);
      else if (!seen[n]) { seen[n] = 1; component.push(n); }
    }
    if (component.length < Math.max(12, count * 0.004) && votes.size) { const next = [...votes].sort((a, b) => b[1] - a[1])[0]![0]; for (const f of component) labels[f] = next; }
  }
  const plan: SegmentPlan = { key: geometryKey(mesh), optionsKey: optionsKey(mode, options), labels, groups: referenceGroups(mode, labels, target), edited: false, method: 'reference-demo-v1' };
  validatePlan(plan, mesh); return plan;
}
