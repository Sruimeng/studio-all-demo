import { markerColors, type SegmentGroup, type SegmentMask, type SegmentMode, type SegmentOptions, type SegmentPlan, type SegmentReference } from './types';
import { englishText } from '~/@base/locale/translate';

// This is a curated example adapter, not a vision service. IDs are semantic identifiers,
// never texture colors, face indices or filament assignments.
export const legacyChickenReference: SegmentReference = { id: 'chicken-source-600-v1', name: '小鸡 · 原生成参考图', url: '/samples/cartoon-chicken-reference.jpg', width: 600, height: 600, sample: 'chicken' };
export const chickenReference: SegmentReference = { id: 'chicken-source-1024-v2', name: '小鸡 · 生成参考图', url: '/samples/cartoon-chicken-reference.png', width: 1024, height: 1024, sample: 'chicken' };
const partNames = ['身体', '鸡冠', '喙', '双脚', '背包', '右侧配件', '腹部浅色区域'];
const colorNames = ['深灰色区域', '红色区域', '橙色区域', '粉色区域', '棕色区域', '灰色区域', '白色区域'];
const sourceColors = ['#343433', '#bb292c', '#de7f48', '#c783ab', '#b88e54', '#777574', '#c0c0c0'];
export const promptExamples = {
  parts: ['按主要部件拆分', '鸡冠单独拆出，其余保持整体。', '背包单独拆出，其余保持整体。', '双脚单独拆出，其余保持整体。'],
  colors: ['按主要颜色拆分', '红色区域单独拆出，其余保持整体。', '合并相近颜色'],
};
export function suggestedPrompt(mode: SegmentMode) {
  return mode === 'parts' ? '将鸡冠、喙、身体、双脚、背包和右侧配件分别拆出；身体保持整体。' : '分成深灰色、红色、橙色、粉色、棕色和白色区域；合并同色区域的阴影与渐变。';
}
/** Keep known English presets compatible with the demo's saved prompt rules. */
export function canonicalPrompt(mode: SegmentMode, value: string): string {
  return [...promptExamples[mode], suggestedPrompt(mode)].find(prompt => englishText(prompt) === value.trim()) ?? value;
}
export function presetTarget(mode: SegmentMode, prompt: string): number | null {
  if (!prompt.trim() || prompt === suggestedPrompt(mode) || prompt === promptExamples[mode][0] || (mode === 'colors' && prompt === '合并相近颜色')) return null;
  const presets: Record<string, number> = { '鸡冠单独拆出，其余保持整体。': 1, '背包单独拆出，其余保持整体。': 4, '双脚单独拆出，其余保持整体。': 3, '红色区域单独拆出，其余保持整体。': 1 };
  if (promptExamples[mode].includes(prompt) && presets[prompt] !== undefined) return presets[prompt]!;
  throw new Error('自定义描述已保留。理解任意描述需要接入算法。可在已有 2D 分区中调整区域。');
}
export function semanticGroup(r: number, g: number, b: number, x: number, y: number, mode: SegmentMode, detail: SegmentOptions['detail']): number {
  // Coordinates describe the supplied chicken reference; they are not a generic model capability.
  if (y < 0.235 && r > g * 1.25 && r > b * 1.15) return 1;
  if (y < 0.34 && x > 0.49 && r > g * 1.13 && g > b * 1.13) return detail === 'coarse' && mode === 'parts' ? 0 : 2;
  if (y > 0.78 && r > g * 1.12 && b > g * 1.05) return 3;
  if (mode === 'parts' && x > 0.68 && y > 0.45 && y < 0.62) return 5;
  if (r > 105 && g > 60 && r > g * 1.09 && g > b * 1.14 && x < 0.49 && y > 0.4 && y < 0.78) return 4;
  if (mode === 'colors' && x > 0.49 && x < 0.68 && y > 0.54 && y < 0.8 && Math.min(r, g, b) > 120 && Math.max(r, g, b) - Math.min(r, g, b) < 35) return 6;
  if (mode === 'parts' && detail === 'fine' && y > 0.54 && y < 0.79 && Math.min(r, g, b) > 125 && Math.max(r, g, b) - Math.min(r, g, b) < 30) return 6;
  return 0;
}
export function referenceGroups(mode: SegmentMode, ids: Iterable<number>, target: number | null): SegmentGroup[] {
  return [...new Set(ids)].filter(id => id >= 0).sort((a, b) => a - b).map(id => ({ id, name: target !== null && id === 0 ? '其余整体' : id === 7 ? '暖色区域' : id >= 8 ? `${colorNames[id - 8] ?? '颜色区域'} · 深色` : (mode === 'parts' ? partNames : colorNames)[id] ?? `区域 ${id + 1}`, color: markerColors[id % markerColors.length]!, sourceColor: sourceColors[id >= 8 ? id - 8 : id === 7 ? 4 : id] }));
}
export function referenceLabel(r: number, g: number, b: number, x: number, y: number, mode: SegmentMode, options: SegmentOptions): number {
  const explicitParts = mode === 'parts' && options.prompt.trim() && options.prompt !== '按主要部件拆分';
  let id = semanticGroup(r, g, b, x, y, mode, explicitParts ? 'standard' : options.detail);
  if (mode === 'colors') {
    if (options.detail === 'coarse' && [1, 2, 4].includes(id)) id = 7;
    if (options.detail === 'fine' && id === 0 && x > 0.68 && y > 0.45 && y < 0.62 && Math.min(r, g, b) > 60) id = 5;
    if (!options.mergeSimilar && options.prompt !== '合并相近颜色' && options.detail !== 'coarse' && ((id === 0 && Math.max(r, g, b) < 32) || (id === 4 && r < 150))) id += 8;
  }
  return id;
}
export function makeReferenceMask(data: Uint8ClampedArray, width: number, height: number, mode: SegmentMode, options: SegmentOptions, referenceId: string): SegmentMask {
  if (data.length !== width * height * 4) throw new Error('参考图像素数据不完整。');
  const target = presetTarget(mode, options.prompt), labels = new Array<number>(width * height).fill(-1);
  const effective = target === null ? options : { ...options, detail: 'standard' as const, mergeSimilar: true };
  // Original image has a cyan studio backdrop; reject it and antialiased cyan fringe.
  for (let i = 0; i < labels.length; i++) {
    const r = data[i * 4]!, g = data[i * 4 + 1]!, b = data[i * 4 + 2]!;
    // A ratio alone mistakes subtle cyan reflections on black surfaces for holes.
    // Require actual backdrop brightness/chroma while retaining real gaps in the silhouette.
    if (data[i * 4 + 3]! < 128 || (Math.min(g, b) > 90 && Math.min(g, b) - r > 28 && g > r * 1.2 && b > r * 1.15 && Math.abs(g - b) < 55)) continue;
    const x = (i % width) / width, y = Math.floor(i / width) / height;
    let id = referenceLabel(r, g, b, x, y, mode, effective);
    // Curated semantic coverage for this exact image: absorb the bag's shading without
    // pulling the chicken's dark, warm reflections into the brown group.
    if ((x < 0.335 && y > 0.46 && y < 0.74) || (x < 0.38 && y > 0.61 && y < 0.74)) id = mode === 'colors' && effective.detail === 'coarse' ? 7 : 4;
    // Pink bounce light under the body is not part of the feet.
    if (id === 3 && (r - g < 24 || b - g < 16)) id = 0;
    labels[i] = target === null || target === id ? id : 0;
  }
  cleanReferenceLabels(labels, width, height);
  return { referenceId, width, height, labels };
}
function cleanReferenceLabels(labels: number[], width: number, height: number) {
  const largest = new Map<number, number>(), small: { pixels: number[]; label: number; neighbor: number }[] = [];
  const seen = new Uint8Array(labels.length), queue = new Int32Array(labels.length);
  const limit = Math.max(2, Math.round(width * height * 0.00008));
  // Remove only tiny disconnected classification fragments. Keep the largest
  // component of every group, and retain disconnected meaningful areas (e.g. the bag).
  for (let seed = 0; seed < labels.length; seed++) {
    const label = labels[seed]!; if (label < 0 || seen[seed]) continue;
    let head = 0, tail = 1; queue[0] = seed; seen[seed] = 1;
    const neighbors = new Map<number, number>();
    while (head < tail) {
      const i = queue[head++]!, x = i % width;
      for (const n of [i - width, i + width, x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1]) {
        if (n < 0 || n >= labels.length || labels[n]! < 0) continue;
        if (labels[n] === label) { if (!seen[n]) { seen[n] = 1; queue[tail++] = n; } }
        else neighbors.set(labels[n]!, (neighbors.get(labels[n]!) ?? 0) + 1);
      }
    }
    largest.set(label, Math.max(largest.get(label) ?? 0, tail));
    if (tail < limit && neighbors.size) small.push({ pixels: Array.from(queue.subarray(0, tail)), label, neighbor: [...neighbors].sort((a, b) => b[1] - a[1])[0]![0] });
  }
  for (const part of small) if (part.pixels.length < largest.get(part.label)!) for (const i of part.pixels) labels[i] = part.neighbor;
  // Majority smoothing at source resolution, restricted to foreground pixels.
  // Never close real background gaps, expand the silhouette or erase a small group.
  const radius = Math.min(width, height) >= 768 ? 2 : 1;
  const maxLabel = labels.reduce((max, id) => Math.max(max, id), 0), votes = new Uint16Array(maxLabel + 1);
  for (let pass = 0; pass < 2; pass++) {
    const before = labels.slice(), counts = new Uint32Array(maxLabel + 1);
    for (const id of labels) if (id >= 0) counts[id]!++;
    for (let y = radius; y < height - radius; y++) for (let x = radius; x < width - radius; x++) {
      const i = y * width + x, current = before[i]!; if (current < 0) continue;
      votes.fill(0); let total = 0, best = current;
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        const id = before[i + dy * width + dx]!; if (id < 0) continue;
        votes[id]!++; total++; if (votes[id]! > votes[best]!) best = id;
      }
      if (best !== current && votes[best]! > total / 2 && counts[current]! > limit) { labels[i] = best; counts[current]!--; counts[best]!++; }
    }
  }
}
export async function readReference(reference: SegmentReference) {
  const img = new Image(); img.src = reference.url; await img.decode();
  const canvas = document.createElement('canvas'); const ratio = Math.min(1, 1024 / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * ratio); canvas.height = Math.round(img.height * ratio);
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('无法读取参考图。');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
export function validateMask(mask: SegmentMask, groups: SegmentGroup[], referenceId?: string) {
  const ids = new Set(groups.map(g => g.id));
  if (referenceId && mask.referenceId !== referenceId) throw new Error('参考图已变化，请重新生成 2D 方案。');
  if (!Number.isInteger(mask.width) || !Number.isInteger(mask.height) || mask.width < 1 || mask.height < 1 || mask.labels.length !== mask.width * mask.height || mask.labels.some(id => id !== -1 && !ids.has(id)) || !mask.labels.some(id => id >= 0)) throw new Error('2D 方案存在未分配区域或无效分组。');
}
export function assignPixels(plan: SegmentPlan, pixels: readonly number[], target: number, name?: string): SegmentPlan {
  if (!plan.mask) throw new Error('请先生成参考图分区。');
  const valid = pixels.filter(i => Number.isInteger(i) && i >= 0 && i < plan.mask!.labels.length && plan.mask!.labels[i]! >= 0);
  if (!valid.length) throw new Error('请先选择参考图中的有效区域，背景不能分配为部件。');
  const next: SegmentPlan = JSON.parse(JSON.stringify(plan));
  if (name) { target = Math.max(...next.groups.map(g => g.id)) + 1; next.groups.push({ id: target, name: name.trim(), color: markerColors[target % markerColors.length]! }); }
  if (!next.groups.some(g => g.id === target)) throw new Error('请选择已有部件。');
  let changed = false;
  for (const i of valid) { if (next.mask!.labels[i] !== target) changed = true; next.mask!.labels[i] = target; }
  if (changed) {
    next.mappingDirty = true; next.edited = true;
    const before = new Set(plan.mask.labels), after = new Set(next.mask!.labels);
    const emptied = new Set(next.groups.filter(g => before.has(g.id) && !after.has(g.id)).map(g => g.id));
    // Keep a complete draft mesh label set for persistence validation, while the dirty
    // mapping blocks all geometry use. Empty visible groups are no longer actionable.
    next.labels = next.labels.map(id => emptied.has(id) ? target : id);
    next.groups = next.groups.filter(g => !emptied.has(g.id));
  }
  validateMask(next.mask!, next.groups); return next;
}
export function mergePlanGroups(plan: SegmentPlan, ids: number[]): SegmentPlan {
  if (ids.length < 2 || !ids.every(id => plan.groups.some(g => g.id === id))) throw new Error('请选择至少两个有效分组。');
  const next: SegmentPlan = JSON.parse(JSON.stringify(plan)), target = ids[0]!;
  next.labels = next.labels.map(id => ids.includes(id) ? target : id);
  if (next.mask) next.mask.labels = next.mask.labels.map(id => ids.includes(id) ? target : id);
  next.groups = next.groups.filter(g => !ids.includes(g.id) || g.id === target); next.edited = true;
  return next;
}
// The demo can carry whole semantic groups from a 2D proposal into its sample
// geometry adapter. A pixel-level split needs a real image-to-mesh service.
export function previewGroupMapping(original: SegmentMask, edited: SegmentPlan) {
  const mask = edited.mask!;
  validateMask(mask, edited.groups, original.referenceId);
  if (mask.width !== original.width || mask.height !== original.height) throw new Error('参考图尺寸已变化，请更新分区方案。');
  const mapping = new Map<number, number>();
  for (let i = 0; i < original.labels.length; i++) {
    const source = original.labels[i]!, target = mask.labels[i]!;
    if ((source < 0) !== (target < 0)) throw new Error('不能将背景分配为部件或丢弃模型区域。');
    if (source < 0) continue;
    if (mapping.has(source) && mapping.get(source) !== target) throw new Error('局部 2D 边界修改需要算法映射到 3D，当前 demo 尚未接入。修改仍保留，可撤销局部修改后继续；整组分配、合并和改名可生成示例分件。');
    mapping.set(source, target);
  }
  return mapping;
}
export function applyPreviewToGeometry(geometry: SegmentPlan, original: SegmentMask, edited: SegmentPlan): SegmentPlan {
  const mapping = previewGroupMapping(original, edited), groups = edited.groups.map(group => ({ ...group }));
  for (const group of geometry.groups) {
    if (mapping.has(group.id)) continue;
    // Unseen surfaces remain present. Avoid a collision with a newly created
    // 2D group whose ID happens to equal an unseen geometry group's ID.
    const id = groups.some(g => g.id === group.id) ? Math.max(...groups.map(g => g.id)) + 1 : group.id;
    mapping.set(group.id, id); groups.push({ ...group, id });
  }
  return { ...geometry, labels: geometry.labels.map(id => mapping.get(id)!), groups, mask: edited.mask, edited: edited.edited };
}
export function connectedPixels(mask: SegmentMask, seed: number, allSimilar = false): number[] {
  if (!Number.isInteger(seed) || seed < 0 || seed >= mask.labels.length || mask.labels[seed]! < 0) return [];
  const label = mask.labels[seed]!;
  if (allSimilar) return mask.labels.flatMap((v, i) => v === label ? [i] : []);
  const seen = new Uint8Array(mask.labels.length), pixels = [seed]; seen[seed] = 1;
  for (let p = 0; p < pixels.length; p++) {
    const i = pixels[p]!, x = i % mask.width;
    for (const n of [i - mask.width, i + mask.width, ...(x > 0 ? [i - 1] : []), ...(x < mask.width - 1 ? [i + 1] : [])]) if (n >= 0 && n < seen.length && !seen[n] && mask.labels[n] === label) { seen[n] = 1; pixels.push(n); }
  }
  return pixels;
}
export function splitProblem(plan: SegmentPlan | null | undefined, referenceId?: string) {
  if (!plan?.mask || !plan.method) return '请先生成参考图分区方案。';
  if (plan.mask.referenceId !== referenceId) return '参考图已变化，请重新生成方案。';
  if (plan.mappingDirty) return '2D 边界已修改，需算法将新方案映射到 3D。当前可保存或下载方案，不能导出旧的 3D 结果。';
  return '';
}
