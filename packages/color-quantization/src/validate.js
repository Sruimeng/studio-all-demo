import { cutLevel } from '../vendor/quantize.js';
import { analysisIntegrity } from './fingerprint.js';

export class QuantizationError extends Error {
  constructor(code, message) { super(message); this.name = 'QuantizationError'; this.code = code; }
}
export const fail = (message, code = 'ERR_INVALID_INPUT') => { throw new QuantizationError(code, message); };
const integer = (x, min, max) => Number.isSafeInteger(x) && x >= min && x <= max;
const vector = (v, length) => Array.isArray(v) && v.length === length && v.every(Number.isFinite);
const digest = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const ordinaryBuffer = array => array.buffer instanceof ArrayBuffer;

export function callbacks(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) fail('Options must be an object.');
  for (const key of ['log', 'progress']) if (options[key] !== undefined && typeof options[key] !== 'function') fail(`${key} must be a function.`);
  return options;
}

export function validateInput(input) {
  if (!input || typeof input !== 'object') fail('Input must contain triWorld, triUV, texture and flipY.');
  const { triWorld: p, triUV: uv, texture: tex, flipY } = input;
  if (!(p instanceof Float32Array) || !ordinaryBuffer(p) || !p.length || p.length % 9) fail('triWorld must be a nonempty Float32Array with 9 floats per face (non-shared buffer).');
  if (!(uv instanceof Float32Array) || !ordinaryBuffer(uv) || uv.length !== p.length / 9 * 6) fail('triUV must be a Float32Array with 6 floats per face, matching triWorld.');
  if (typeof flipY !== 'boolean') fail('flipY must be an explicit boolean.');
  if (!tex || !integer(tex.width, 1, 0x7fffffff) || !integer(tex.height, 1, 0x7fffffff) || !integer(tex.width * tex.height, 1, 0x7fffffff)) fail('Texture dimensions must be positive finite integers with a supported texel count.');
  if (!(tex.data instanceof Uint8Array) || !ordinaryBuffer(tex.data) || tex.data.length !== tex.width * tex.height * 3) fail('texture.data must contain exactly width * height * 3 RGB bytes (Uint8Array).');
  for (const value of p) if (!Number.isFinite(value)) fail('triWorld contains non-finite geometry.');
  for (const value of uv) if (!Number.isFinite(value) || value < 0 || value > 1) fail('triUV must be finite and within [0,1]; repeat wrapping is unsupported.');
  // Match upstream float32 surface-area arithmetic so overflow/underflow cannot seed an empty histogram.
  const f = Math.fround;
  let total = 0;
  for (let i = 0; i < p.length; i += 9) {
    const x = f(p[i + 3] - p[i]), y = f(p[i + 4] - p[i + 1]), z = f(p[i + 5] - p[i + 2]);
    const u = f(p[i + 6] - p[i]), v = f(p[i + 7] - p[i + 1]), w = f(p[i + 8] - p[i + 2]);
    const cx = f(f(y * w) - f(z * v)), cy = f(f(z * u) - f(x * w)), cz = f(f(x * v) - f(y * u));
    const area = 0.5 * f(Math.sqrt(f(f(f(cx * cx) + f(cy * cy)) + f(cz * cz))));
    if (!Number.isFinite(area) || area <= 0) fail(`Face ${i / 9} must have positive finite float32 surface area.`);
    total += area;
  }
  if (!Number.isFinite(total) || total <= 0) fail('Mesh must have positive finite surface area.');
}

export function validateAnalysis(a) {
  const bad = message => fail(`Invalid analysis: ${message}`, 'ERR_INVALID_ANALYSIS');
  if (!a || a.version !== 1 || !digest(a.inputFingerprint) || !digest(a.integrity) || typeof a.flipY !== 'boolean' || !integer(a.faceCount, 1, 0x7fffffff)) bad('missing version or input binding.');
  if (!integer(a.width, 1, 0x7fffffff) || !integer(a.height, 1, 0x7fffffff) || !integer(a.width * a.height, 1, 0x7fffffff)) bad('texture dimensions.');
  if (!(a.leafIndexMap instanceof Uint8Array) || !ordinaryBuffer(a.leafIndexMap) || a.leafIndexMap.length !== a.width * a.height) bad('leaf map dimensions or type.');
  const n = a.leafLab?.length;
  if (!integer(n, 1, 32) || !Array.isArray(a.leafLab) || !a.leafLab.every(v => vector(v, 3))) bad('leaf Lab colors.');
  if (!vector(a.leafWeight, n) || a.leafWeight.some(w => w < 0) || !(a.leafWeight.reduce((s, w) => s + w, 0) > 0)) bad('leaf weights.');
  if (!Array.isArray(a.merges) || a.merges.length !== n - 1 || !integer(a.jndMergeCount, 0, n - 1)) bad('merge tree size.');
  const alive = new Set(Array.from({ length: n }, (_, i) => i));
  a.merges.forEach((m, i) => {
    if (!m || !alive.has(m.intoLeaf) || !alive.has(m.fromLeaf) || m.intoLeaf === m.fromLeaf) bad('merge references.');
    if (![m.cost, m.deltaE2000, m.mergeDistance].every(v => Number.isFinite(v) && v >= 0) || m.byJnd !== (i < a.jndMergeCount)) bad('merge distances or JND order.');
    alive.delete(m.fromLeaf);
  });
  if (a.maxSelectableColorCount !== n - a.jndMergeCount || !integer(a.suggestedColorCount, 1, a.maxSelectableColorCount)) bad('selectable color counts.');
  if (!Array.isArray(a.levels) || a.levels.length !== a.maxSelectableColorCount) bad('level count.');
  for (let k = 1; k <= a.maxSelectableColorCount; k++) {
    const l = a.levels[k - 1];
    if (!l || l.K !== k || !Array.isArray(l.leafToCluster) || l.leafToCluster.length !== n || l.leafToCluster.some(c => !integer(c, 0, k - 1))) bad(`level ${k} mapping.`);
    if (!Array.isArray(l.clusters) || l.clusters.length !== k) bad(`level ${k} palette.`);
    for (const c of l.clusters) {
      if (!c || !vector(c.rgb, 3) || c.rgb.some(v => !integer(v, 0, 255)) || !vector(c.lab, 3) || !Number.isFinite(c.weight) || c.weight <= 0 || !Number.isFinite(c.areaRatio) || c.areaRatio <= 0 || c.areaRatio > 1 || c.hex !== '#' + c.rgb.map(v => v.toString(16).padStart(2, '0')).join('')) bad(`level ${k} color.`);
    }
    const expected = cutLevel(a.leafLab, a.leafWeight, a.merges, a.jndMergeCount, k);
    if (JSON.stringify([l.K, l.leafToCluster, l.clusters.map(c => [c.rgb, c.lab, c.weight, c.areaRatio, c.hex])]) !== JSON.stringify([expected.K, expected.leafToCluster, expected.clusters.map(c => [c.rgb, c.lab, c.weight, c.areaRatio, c.hex])])) bad(`level ${k} disagrees with merge tree.`);
  }
  const counts = new Array(n).fill(0);
  let covered = 0;
  for (const label of a.leafIndexMap) {
    if (label === 255) continue;
    if (label >= n) bad('leaf map label outside palette.');
    counts[label]++; covered++;
  }
  if (!vector(a.leafTexelCount, n) || a.leafTexelCount.some((c, i) => c !== counts[i]) || a.totalCovered !== covered) bad('covered texel counts.');
  if (analysisIntegrity(a) !== a.integrity) bad('content integrity mismatch; analysis must remain immutable.');
}

export function validateCount(a, k) {
  if (!integer(k, 1, a.maxSelectableColorCount)) fail(`colorCount must be an integer in [1, ${a.maxSelectableColorCount}].`, 'ERR_COLOR_COUNT');
}

export function validatePalette(palette, k) {
  const bad = () => fail('Invalid result palette: expected finite Lab, RGB8, positive weights and matching hex.', 'ERR_INVALID_RESULT');
  if (!Array.isArray(palette) || palette.length !== k) bad();
  for (const c of palette) {
    if (!c || !vector(c.rgb, 3) || c.rgb.some(v => !integer(v, 0, 255)) || !vector(c.lab, 3) || !Number.isFinite(c.weight) || c.weight <= 0 || !Number.isFinite(c.areaRatio) || c.areaRatio <= 0 || c.areaRatio > 1 || c.hex !== '#' + c.rgb.map(v => v.toString(16).padStart(2, '0')).join('')) bad();
  }
}

export function validateLevel(level, k, leafCount) {
  if (!level || level.K !== k || !Array.isArray(level.leafToCluster) || level.leafToCluster.length !== leafCount || level.leafToCluster.some(c => !integer(c, 0, k - 1)) || new Set(level.leafToCluster).size !== k) fail('Invalid result level: K or leaf mapping disagrees with analysis.', 'ERR_INVALID_RESULT');
  validatePalette(level.clusters, k);
}

export function validatePreview(preview, k, width, height) {
  if (!preview || preview.colorCount !== k || preview.width !== width || preview.height !== height || !(preview.data instanceof Uint8Array) || preview.data.length !== width * height * 4) fail('Invalid preview: dimensions, K or RGBA buffer disagree with analysis.', 'ERR_INVALID_RESULT');
  validatePalette(preview.palette, k);
  const allowed = new Set(preview.palette.map(c => (c.rgb[0] << 16) | (c.rgb[1] << 8) | c.rgb[2]));
  for (let i = 0; i < preview.data.length; i += 4) {
    const d = preview.data, rgb = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    if (d[i + 3] === 0 && rgb === 0 || d[i + 3] === 255 && allowed.has(rgb)) continue;
    fail('Invalid preview: pixel is neither an opaque palette color nor transparent black.', 'ERR_INVALID_RESULT');
  }
}

export function validateMesh(result, k) {
  const bad = message => fail(`Invalid committed mesh: ${message}`, 'ERR_INVALID_RESULT');
  if (!result || !(result.P instanceof Float32Array) || !result.P.length || result.P.length % 3 || !(result.T instanceof Int32Array) || !result.T.length || result.T.length % 3 || !(result.lab instanceof Int32Array) || result.lab.length !== result.T.length / 3 || result.K !== k || result.palette?.length !== k) bad('array types, sizes or palette count.');
  validatePalette(result.palette, k);
  for (const value of result.P) if (!Number.isFinite(value)) bad('non-finite position.');
  for (const value of result.T) if (!integer(value, 0, result.P.length / 3 - 1)) bad('index outside vertex table.');
  for (const label of result.lab) if (!integer(label, 0, k - 1)) bad('face label outside palette.');
  const { P: p, T: t } = result;
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
    const x = p[b] - p[a], y = p[b + 1] - p[a + 1], z = p[b + 2] - p[a + 2];
    const u = p[c] - p[a], v = p[c + 1] - p[a + 1], w = p[c + 2] - p[a + 2];
    if (!(Math.hypot(y * w - z * v, z * u - x * w, x * v - y * u) > 0)) bad(`degenerate face ${i / 3}.`);
  }
  for (const stats of [result.cutStats, result.fairStats, result.weldStats]) if (!stats || Object.values(stats).some(v => !Number.isSafeInteger(v) || v < 0)) bad('stage statistics.');
}
