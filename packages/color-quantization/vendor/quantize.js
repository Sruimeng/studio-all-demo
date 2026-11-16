// Vendored from vast-enterprise/color-quantization, 80c58f2168d72800e8170f6998987262eeae780d.
// Local patches and redistribution restrictions: ../UPSTREAM.md.
// Multi-level texture color quantization: JavaScript port of python/quantize.py (itself a port of MakerWorld's
// client-side color analysis, CQA1 algorithmVersion 1). Same stages, same constants, same operation order, so
// results match the Python version (apart from last-bit differences in Math.sin/cos/exp/pow).

export const KL = 2.0, PREMERGE_STOP = 3.5, LEAF_MAX_DE = 3.5, EXTINCTION_DE = 10.0, ELIGIBLE_RATIO = 1e-3,
  DEGENERATE_RATIO = 5e-5, UNIFORM_MIX = 0.5, MAX_COLORS = 32, KMED_ITERS = 16, MEDOID_ALL_MAX = 128,
  MEDOID_CANDIDATES = 24, JND = 1.0, SUGGEST_CUT = 7.0, BILATERAL_ITERS = 8;

const f32 = Math.fround;

/** numpy's 1-D float64 sum (pairwise, 8 accumulators, blocks of 128, starts from -0.0) */
export function npSum(a, s = 0, n = a.length - s) {
  if (n < 8) { let r = -0.0; for (let i = 0; i < n; i++) r += a[s + i]; return r; }
  if (n <= 128) {
    const r = [a[s], a[s + 1], a[s + 2], a[s + 3], a[s + 4], a[s + 5], a[s + 6], a[s + 7]]; let i = 8;
    for (; i < n - (n % 8); i += 8) for (let j = 0; j < 8; j++) r[j] += a[s + i + j];
    let res = ((r[0] + r[1]) + (r[2] + r[3])) + ((r[4] + r[5]) + (r[6] + r[7]));
    for (; i < n; i++) res += a[s + i];
    return res;
  }
  let n2 = Math.floor(n / 2); n2 -= n2 % 8;
  return npSum(a, s, n2) + npSum(a, s + n2, n - n2);
}

// ---------------- color ----------------
export function srgbToLab(r, g, b) {   // worker Yr(r,g,b,false): 0..255 floats -> Lab
  const lin = [r, g, b].map((v) => { const e = v / 255.0; return e > 0.04045 ? ((e + 0.055) / 1.055) ** 2.4 : e / 12.92; });
  const X = (lin[0] * 0.4124564 + lin[1] * 0.3575761 + lin[2] * 0.1804375) * 100 / 95.047;
  const Y = (lin[0] * 0.2126729 + lin[1] * 0.7151522 + lin[2] * 0.072175) * 100 / 100.0;
  const Z = (lin[0] * 0.0193339 + lin[1] * 0.119192 + lin[2] * 0.9503041) * 100 / 108.883;
  const f = [X, Y, Z].map((t) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116));
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}

const pow7 = (x) => { const x2 = x * x; return (x * x2) * (x2 * x2); };   // numba's x**7
const P25_7 = 6103515625.0;
export function de2000(L1, a1, b1, L2, a2, b2, kL) {   // worker lh()
  const pe = Math.PI / 180;
  const h = (L1 + L2) / 2;
  const d = Math.sqrt(a1 * a1 + b1 * b1), y = Math.sqrt(a2 * a2 + b2 * b2);
  const p = pow7((d + y) / 2);
  const m = 0.5 * (1 - Math.sqrt(p / (p + P25_7)));
  const x = (1 + m) * a1, w = (1 + m) * a2;
  const C1 = Math.sqrt(x * x + b1 * b1), C2 = Math.sqrt(w * w + b2 * b2);
  const M = (C1 + C2) / 2;
  let h1 = (x === 0 && b1 === 0) ? 0.0 : Math.atan2(b1, x) * 180 / Math.PI; if (h1 < 0) h1 += 360;
  let h2 = (w === 0 && b2 === 0) ? 0.0 : Math.atan2(b2, w) * 180 / Math.PI; if (h2 < 0) h2 += 360;
  let dh;
  if (C1 * C2 === 0) dh = 0.0;
  else { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dL = L2 - L1, dC = C2 - C1;
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin(dh * pe / 2);
  let F;
  if (C1 * C2 === 0) F = h1 + h2;
  else if (Math.abs(h1 - h2) <= 180) F = (h1 + h2) / 2;
  else if (h1 + h2 < 360) F = (h1 + h2 + 360) / 2;
  else F = (h1 + h2 - 360) / 2;
  const k = 1 - 0.17 * Math.cos((F - 30) * pe) + 0.24 * Math.cos(2 * F * pe) + 0.32 * Math.cos((3 * F + 6) * pe) - 0.2 * Math.cos((4 * F - 63) * pe);
  const t = (F - 275) / 25, L = 30 * Math.exp(-(t * t));
  const C = pow7(M);
  const z = 2 * Math.sqrt(C / (C + P25_7));
  const hh = (h - 50) * (h - 50), U = 1 + 0.015 * hh / Math.sqrt(20 + hh);
  const W = 1 + 0.045 * M, B = 1 + 0.015 * M * k;
  const D = -Math.sin(2 * L * pe) * z;
  const N = dL / (kL * U), V = dC / W, j = dH / B;
  return Math.sqrt(N * N + V * V + j * j + D * V * j);
}
const de = (l1, l2, kL = KL) => de2000(l1[0], l1[1], l1[2], l2[0], l2[1], l2[2], kL);

// ---------------- 1. surface sampling ----------------
function radicalInverse(n) {
  let t = n >>> 0;
  t = ((t << 16) | (t >>> 16)) >>> 0;
  t = (((t & 0x00FF00FF) << 8) | ((t & 0xFF00FF00) >>> 8)) >>> 0;
  t = (((t & 0x0F0F0F0F) << 4) | ((t & 0xF0F0F0F0) >>> 4)) >>> 0;
  t = (((t & 0x33333333) << 2) | ((t & 0xCCCCCCCC) >>> 2)) >>> 0;
  t = (((t & 0x55555555) << 1) | ((t & 0xAAAAAAAA) >>> 1)) >>> 0;
  return t * 2.3283064365386963e-10;
}
const RADICAL = Array.from({ length: 13 }, (_, i) => radicalInverse(i));

/** tex = { width, height, data: Uint8Array RGB }. inF32: the inputs are float32 arrays (numba keeps float32 math
 *  for differences and cross products of float32 inputs); false for float64 inputs (commit's cut faces). */
export function sampleFaces(triUV, triWorld, tex, flipY, inF32 = true) {
  const W = tex.width, H = tex.height, T = tex.data, n = (triUV.length / 6) | 0;
  const r32 = inF32 ? f32 : (v) => v;
  const faceLab = new Float32Array(n * 3), faceRgb = new Float32Array(n * 3), faceArea = new Float64Array(n), faceValid = new Uint8Array(n);
  for (let f = 0; f < n; f++) {
    const p = 9 * f;
    const e1x = r32(triWorld[p + 3] - triWorld[p]), e1y = r32(triWorld[p + 4] - triWorld[p + 1]), e1z = r32(triWorld[p + 5] - triWorld[p + 2]);
    const e2x = r32(triWorld[p + 6] - triWorld[p]), e2y = r32(triWorld[p + 7] - triWorld[p + 1]), e2z = r32(triWorld[p + 8] - triWorld[p + 2]);
    const cx = r32(r32(e1y * e2z) - r32(e1z * e2y)), cy = r32(r32(e1z * e2x) - r32(e1x * e2z)), cz = r32(r32(e1x * e2y) - r32(e1y * e2x));
    const area = 0.5 * r32(Math.sqrt(r32(r32(r32(cx * cx) + r32(cy * cy)) + r32(cz * cz))));
    faceArea[f] = area;
    const q6 = 6 * f, u0 = triUV[q6], v0 = triUV[q6 + 1], u1 = triUV[q6 + 2], v1 = triUV[q6 + 3], u2 = triUV[q6 + 4], v2 = triUV[q6 + 5];
    const uvArea = 0.5 * Math.abs(r32(u1 - u0) * W * r32(v2 - v0) * H - r32(v1 - v0) * H * r32(u2 - u0) * W);
    const C = Math.min(12, Math.max(1, Math.ceil(Math.sqrt(Math.max(uvArea, 1.0) / 64))));
    let a0 = 0, a1 = 0, a2 = 0;
    for (let s = 0; s < C; s++) {
      const e = (s + 0.5) / C, o = RADICAL[s + 1], q = Math.sqrt(e);
      const k0 = 1 - q, k1 = q * (1 - o), k2 = q * o;
      const U = u0 * k0 + u1 * k1 + u2 * k2, V = v0 * k0 + v1 * k1 + v2 * k2;
      const c = U * W - 0.5, a = (flipY ? (1 - V) : V) * H - 0.5;
      let x0 = Math.floor(c), y0 = Math.floor(a); const fx = c - x0, fy = a - y0;
      const x1 = Math.min(Math.max(x0 + 1, 0), W - 1), y1 = Math.min(Math.max(y0 + 1, 0), H - 1);
      x0 = Math.min(Math.max(x0, 0), W - 1); y0 = Math.min(Math.max(y0, 0), H - 1);
      const i00 = 3 * (y0 * W + x0), i01 = 3 * (y0 * W + x1), i10 = 3 * (y1 * W + x0), i11 = 3 * (y1 * W + x1);
      a0 += T[i00] * (1 - fx) * (1 - fy) + T[i01] * fx * (1 - fy) + T[i10] * (1 - fx) * fy + T[i11] * fx * fy;
      a1 += T[i00 + 1] * (1 - fx) * (1 - fy) + T[i01 + 1] * fx * (1 - fy) + T[i10 + 1] * (1 - fx) * fy + T[i11 + 1] * fx * fy;
      a2 += T[i00 + 2] * (1 - fx) * (1 - fy) + T[i01 + 2] * fx * (1 - fy) + T[i10 + 2] * (1 - fx) * fy + T[i11 + 2] * fx * fy;
    }
    const r = a0 / C, g = a1 / C, b = a2 / C;
    const lab = srgbToLab(r, g, b);
    faceLab[3 * f] = lab[0]; faceLab[3 * f + 1] = lab[1]; faceLab[3 * f + 2] = lab[2];
    faceRgb[3 * f] = r / 255; faceRgb[3 * f + 1] = g / 255; faceRgb[3 * f + 2] = b / 255;
    faceValid[f] = area > 0 ? 1 : 0;
  }
  return { faceLab, faceRgb, faceArea, faceValid };
}

// ---------------- 2a/2b. face histogram + premerge ----------------
function faceHistogram(faceLab, faceRgb, faceArea, faceValid) {
  const A = new Float64Array(32768), L = [new Float64Array(32768), new Float64Array(32768), new Float64Array(32768)];
  const n = faceArea.length;
  for (let f = 0; f < n; f++) {
    if (!(faceValid[f] === 1 && faceArea[f] > 0)) continue;
    const q = [0, 1, 2].map((c) => Math.min(31, Math.max(0, Math.floor(faceRgb[3 * f + c] * 255 + 0.5) >> 3)));
    const key = (q[0] << 10) | (q[1] << 5) | q[2];
    A[key] += faceArea[f];
    for (let c = 0; c < 3; c++) L[c][key] += faceLab[3 * f + c] * faceArea[f];
  }
  const lab = [], area = [];
  for (let k = 0; k < 32768; k++) if (A[k] > 0) { lab.push([L[0][k] / A[k], L[1][k] / A[k], L[2][k] / A[k]]); area.push(A[k]); }
  return { lab, area };
}

function premerge(lab, area, stop, kL, maxDistanceMatrixBytes) {   // worker Ud()
  const n = lab.length;
  // This bounds only the quadratic distance matrix, not total kernel memory.
  if (n * n * Float64Array.BYTES_PER_ELEMENT > maxDistanceMatrixBytes) {
    const error = new Error(`Premerge distance matrix needs ${n * n * 8} bytes; budget is ${maxDistanceMatrixBytes}.`);
    error.code = 'ERR_DISTANCE_MATRIX_BUDGET';
    throw error;
  }
  const active = new Uint8Array(n).fill(1), D = new Float64Array(n * n);
  for (let s = 0; s < n; s++) for (let c = s + 1; c < n; c++) {
    const d = de2000(lab[s][0], lab[s][1], lab[s][2], lab[c][0], lab[c][1], lab[c][2], kL); D[s * n + c] = d; D[c * n + s] = d;
  }
  const nnIdx = new Int32Array(n).fill(-1), nnDist = new Float64Array(n).fill(Infinity);
  const nn = (i) => {
    let best = -1, bd = Infinity; const row = i * n;
    for (let u = 0; u < n; u++) { if (u === i || !active[u]) continue; if (D[row + u] < bd) { bd = D[row + u]; best = u; } }
    nnIdx[i] = best; nnDist[i] = bd;
  };
  for (let i = 0; i < n; i++) nn(i);
  let alive = n;
  while (alive > 1) {
    let bi = -1, bj = -1, bd = Infinity;
    for (let c = 0; c < n; c++) {
      if (!active[c]) continue; const a = nnIdx[c];
      if (a < 0 || !active[a]) continue;
      if (nnDist[c] < bd) { bd = nnDist[c]; bi = Math.min(c, a); bj = Math.max(c, a); }
    }
    if (bi < 0 || bj < 0 || bd > stop) break;
    const e = area[bi] + area[bj];
    for (let k = 0; k < 3; k++) lab[bi][k] = (lab[bi][k] * area[bi] + lab[bj][k] * area[bj]) / e;
    area[bi] = e; active[bj] = 0;
    for (let l = 0; l < n; l++) {
      if (l === bi || l === bj || !active[l]) continue;
      const d = de2000(lab[bi][0], lab[bi][1], lab[bi][2], lab[l][0], lab[l][1], lab[l][2], kL); D[bi * n + l] = d; D[l * n + bi] = d;
    }
    nn(bi);
    for (let l = 0; l < n; l++) {
      if (l === bi || l === bj || !active[l]) continue;
      const f = nnIdx[l];
      if (f === bj || f === bi || f === -1) { nn(l); continue; }
      const h = D[l * n + bi];
      if (h < nnDist[l] || (h === nnDist[l] && bi < nnIdx[l])) { nnIdx[l] = bi; nnDist[l] = h; }
    }
    alive -= 1;
  }
  const ol = [], oa = [];
  for (let i = 0; i < n; i++) if (active[i]) { ol.push(lab[i].slice()); oa.push(area[i]); }
  return { lab: ol, area: oa };
}

// ---------------- 2c-2g. eligibility, weighting, center selection ----------------
function eligibility(lab, area, total) {   // worker Gd(), exact = false
  const n = area.length, elig = new Uint8Array(n), why = new Array(n).fill(null);
  const order = [...Array(n).keys()].sort((i, j) => (area[j] - area[i]) || (i - j));
  const d0 = order[0]; elig[d0] = 1; why[d0] = 'dominant';
  for (let y = 1; y < n; y++) {
    const g = order[y];
    if (area[g] < DEGENERATE_RATIO * total) { why[g] = 'degenerate'; continue; }
    const cov = area[g] >= ELIGIBLE_RATIO * total;
    let x = Infinity;
    if (!cov) for (let w = 0; w < y; w++) {
      const b = order[w]; if (why[b] === 'degenerate') continue;
      const dd = de(lab[g], lab[b]);
      if (dd < x) { x = dd; if (x < EXTINCTION_DE) break; }
    }
    if (cov) { elig[g] = 1; why[g] = 'coverage'; }
    else if (x >= EXTINCTION_DE) { elig[g] = 1; why[g] = 'distinct'; }
    else why[g] = 'absorbed';
  }
  const ids = []; for (let i = 0; i < n; i++) if (elig[i]) ids.push(i);
  if (ids.length > MAX_COLORS) {
    const pri = (i) => (why[i] === 'distinct' || why[i] === 'dominant' ? 0 : 1);
    ids.sort((i, j) => (pri(i) - pri(j)) || (area[j] - area[i]) || (i - j));
    for (const i of ids.slice(MAX_COLORS)) { elig[i] = 0; why[i] = 'absorbed'; }
  }
  return { elig, why };
}

function assign(lab, centers) {   // worker Uo()
  const a = new Int32Array(lab.length), dist = new Float64Array(lab.length);
  for (let s = 0; s < lab.length; s++) {
    let best = 0, bd = Infinity;
    for (let c = 0; c < centers.length; c++) { const d = de(lab[s], lab[centers[c]]); if (d < bd) { bd = d; best = c; } }
    a[s] = best; dist[s] = bd;
  }
  return { a, dist };
}

function selectLeaves(lab, area) {   // worker Yd() + n0() + o0()
  const total = npSum(Float64Array.from(area)), n = area.length;
  const { elig, why } = eligibility(lab, area, total);
  let ne = 0; for (let i = 0; i < n; i++) ne += elig[i];
  const w = area.map((ar, i) => (elig[i] === 1 ? (1 - UNIFORM_MIX) * ar / total + UNIFORM_MIX / ne : (1 - UNIFORM_MIX) * ar / total));
  const E = elig;
  const sq = (i, j) => { const a = lab[i][0] - lab[j][0], b = lab[i][1] - lab[j][1], c = lab[i][2] - lab[j][2]; return a * a + b * b + c * c; };
  const maxd = (dist) => { let m = 0.0; for (let i = 0; i < n; i++) if (E[i] && dist[i] > m) m = dist[i]; return m; };
  const medoid = (members, cur) => {   // t0()
    if (!members.length) return cur;
    let cand = members;
    if (members.length > MEDOID_ALL_MAX) {
      const ws = npSum(Float64Array.from(members, (i) => w[i]));
      const mu = [0, 0, 0];
      for (const i of members) for (let c = 0; c < 3; c++) mu[c] += lab[i][c] * w[i];
      for (let c = 0; c < 3; c++) mu[c] /= ws;
      const dmu = (i) => { const a = lab[i][0] - mu[0], b = lab[i][1] - mu[1], c = lab[i][2] - mu[2]; return a * a + b * b + c * c; };
      cand = members.slice().sort((i, j) => (dmu(i) - dmu(j)) || (i - j)).slice(0, MEDOID_CANDIDATES);
      if (!cand.includes(cur)) cand.push(cur);
    }
    const cost = (c) => { let s = 0; for (const r of members) { const d = de(lab[r], lab[c]); s += w[r] * (d * d); } return s; };
    let best = cur, bc = cost(cur);
    for (const i of cand) { if (i === cur) continue; const c = cost(i); if (c < bc || (c === bc && i < best)) { best = i; bc = c; } }
    return best;
  };
  const kmedoids = (centers) => {   // ml()
    const e = centers.slice();
    for (let it = 0; it < KMED_ITERS; it++) {
      const { a } = assign(lab, e);
      const groups = e.map(() => []);
      for (let i = 0; i < a.length; i++) groups[a[i]].push(i);
      let changed = false;
      for (let c = 0; c < e.length; c++) { const m = medoid(groups[c], e[c]); if (m !== e[c]) { e[c] = m; changed = true; } }
      if (!changed) break;
    }
    return e;
  };
  // e0(): seeding
  const T = Math.min(MAX_COLORS, n), Kmin = Math.min(2, T);
  let first = 0, fw = null;
  for (let i = 0; i < n; i++) if (E[i] && (fw === null || w[i] > fw)) { fw = w[i]; first = i; }
  let centers = [first], { a, dist } = assign(lab, centers);
  while (centers.length < T && !(centers.length >= Kmin && maxd(dist) <= LEAF_MAX_DE)) {
    let best = -1, bv = -1.0;
    for (let s = 0; s < n; s++) {
      if (!E[s]) continue;
      let r = Infinity; for (const c of centers) r = Math.min(r, sq(s, c));
      const v = w[s] * r; if (v > bv && r > 0) { best = s; bv = v; }
    }
    if (best < 0) break;
    centers.push(best); ({ a, dist } = assign(lab, centers));
  }
  // n0(): refine + grow
  centers = kmedoids(centers); ({ a, dist } = assign(lab, centers));
  while (centers.length < Math.min(MAX_COLORS, n) && maxd(dist) > LEAF_MAX_DE) {
    let best = -1, bv = -1.0;
    for (let s = 0; s < n; s++) { if (!E[s]) continue; const v = w[s] * (dist[s] * dist[s]); if (v > bv && dist[s] > 0) { best = s; bv = v; } }
    if (best < 0) break;
    centers.push(best); centers = kmedoids(centers); ({ a, dist } = assign(lab, centers));
  }
  const leafWeight = new Array(centers.length).fill(0);
  for (let i = 0; i < n; i++) leafWeight[a[i]] += area[i];
  return { leafLab: centers.map((c) => lab[c].slice()), leafWeight, eligible: elig, reasons: why };
}

// ---------------- 3. dendrogram ----------------
function dendrogram(leafLab, leafWeight) {   // worker fh()
  const a = leafLab.map((l, i) => ({ lab: l.slice(), w: leafWeight[i] > 0 ? leafWeight[i] : 1e-6, rep: i }));
  const merges = []; let jnd = 0;
  const merge = (x, y) => { const e = x.w + y.w; x.lab = x.lab.map((v, k) => (v * x.w + y.lab[k] * y.w) / e); x.w = e; };
  for (const phase of ['jnd', 'cost']) {
    while (a.length > 1) {
      let h = Infinity, l = -1, f = -1;
      for (let d = 0; d < a.length; d++) for (let y = d + 1; y < a.length; y++) {
        let g = de(a[d].lab, a[y].lab); if (phase === 'cost') g = g * g;
        if (g < h) { h = g; l = d; f = y; }
      }
      if (phase === 'jnd' && h >= JND) break;
      merges.push({ intoLeaf: a[l].rep, fromLeaf: a[f].rep, cost: phase === 'jnd' ? 0 : h,
        deltaE2000: phase === 'jnd' ? h : de(a[l].lab, a[f].lab, 1.0), mergeDistance: de(a[l].lab, a[f].lab), byJnd: phase === 'jnd' });
      merge(a[l], a[f]); a.splice(f, 1);
      if (phase === 'jnd') jnd += 1;
    }
  }
  return { merges, jnd };
}

function suggestedCount(merges, leafCount, jnd) {   // worker Ih()/Th()
  const maxSel = Math.min(MAX_COLORS, Math.max(1, leafCount - jnd));
  const c = Math.min(maxSel, leafCount - jnd);
  if (c <= 1) return [Math.max(1, Math.min(maxSel, c)), maxSel];
  const u = merges.filter((m) => m.mergeDistance > SUGGEST_CUT).length + 1;
  return [Math.min(maxSel, Math.max(1, u)), maxSel];
}

// ---------------- 4-6. texel labelling ----------------
function uvCoverage(px, W, H) {   // worker v0()/P0(); px: per-triangle pixel coords (n*6)
  const mask = new Uint8Array(W * H), n = (px.length / 6) | 0;
  for (let t = 0; t < n; t++) {
    const o = px[6 * t], s = px[6 * t + 1], r = px[6 * t + 2], i = px[6 * t + 3], c = px[6 * t + 4], a = px[6 * t + 5];
    if ((c - o) * (i - s) - (a - s) * (r - o) === 0) continue;
    const x0 = Math.max(0, Math.floor(Math.min(o, r, c))), x1 = Math.min(W - 1, Math.ceil(Math.max(o, r, c)));
    const y0 = Math.max(0, Math.floor(Math.min(s, i, a))), y1 = Math.min(H - 1, Math.ceil(Math.max(s, i, a)));
    for (let y = y0; y <= y1; y++) for (let g = x0; g <= x1; g++) {
      const p = g + 0.5, m = y + 0.5;
      const e1 = (p - r) * (a - i) - (m - i) * (c - r), e2 = (p - c) * (s - a) - (m - a) * (o - c), e3 = (p - o) * (i - s) - (m - s) * (r - o);
      if ((e1 >= 0 && e2 >= 0 && e3 >= 0) || (e1 <= 0 && e2 <= 0 && e3 <= 0)) mask[y * W + g] = 1;
    }
  }
  return mask;
}

function bilateral(img, mask, W, H, iters, progress) {   // worker A0(): Jacobi passes, masked neighbourhood
  const sw = new Float64Array(25);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) sw[(dy + 2) * 5 + dx + 2] = Math.exp(-(dx * dx + dy * dy) / 8.0);
  const rw = new Float64Array(765 * 255 + 1); for (let i = 0; i < rw.length; i++) rw[i] = Math.exp(-i / (2.0 * 28 * 28));
  let cur = img.slice(), nxt = img.slice();
  for (let it = 0; it < iters; it++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const q = y * W + x; if (mask[q] !== 1) continue;
      const r0 = cur[3 * q], g0 = cur[3 * q + 1], b0 = cur[3 * q + 2];
      let sr = 0.0, sg = 0.0, sb = 0.0, ws = 0.0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= H) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= W) continue;
          const k = yy * W + xx; if (mask[k] !== 1) continue;
          const R = cur[3 * k], G = cur[3 * k + 1], B = cur[3 * k + 2];
          const wt = sw[(dy + 2) * 5 + dx + 2] * rw[(R - r0) * (R - r0) + (G - g0) * (G - g0) + (B - b0) * (B - b0)];
          sr += R * wt; sg += G * wt; sb += B * wt; ws += wt;
        }
      }
      nxt[3 * q] = Math.floor(sr / ws + 0.5); nxt[3 * q + 1] = Math.floor(sg / ws + 0.5); nxt[3 * q + 2] = Math.floor(sb / ws + 0.5);
    }
    const t = cur; cur = nxt; nxt = t; nxt.set(cur);
    if (progress) progress((it + 1) / iters);
  }
  return cur;
}

function labelTexels(filtered, mask, leafLab) {   // worker C0() + I0()
  const N = mask.length, cnt = new Float64Array(32768), sums = [new Float64Array(32768), new Float64Array(32768), new Float64Array(32768)];
  const key = new Int32Array(N);
  for (let q = 0; q < N; q++) {
    if (mask[q] !== 1) continue;
    const r = filtered[3 * q], g = filtered[3 * q + 1], b = filtered[3 * q + 2], k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    key[q] = k; cnt[k] += 1; sums[0][k] += r; sums[1][k] += g; sums[2][k] += b;
  }
  const binLeaf = new Int32Array(32768).fill(-1);
  for (let b = 0; b < 32768; b++) {
    if (!cnt[b]) continue;
    const lab = srgbToLab(Math.floor(sums[0][b] / cnt[b] + 0.5), Math.floor(sums[1][b] / cnt[b] + 0.5), Math.floor(sums[2][b] / cnt[b] + 0.5));
    let best = 0, bd = Infinity;
    for (let i = 0; i < leafLab.length; i++) {
      const d0 = leafLab[i][0] - lab[0], d1 = leafLab[i][1] - lab[1], d2 = leafLab[i][2] - lab[2], d = d0 * d0 + d1 * d1 + d2 * d2;
      if (d < bd) { bd = d; best = i; }
    }
    binLeaf[b] = best;
  }
  const lidx = new Uint8Array(N).fill(255), texelCount = new Array(leafLab.length).fill(0);
  for (let q = 0; q < N; q++) if (mask[q] === 1) { const l = binLeaf[key[q]]; lidx[q] = l; texelCount[l] += 1; }
  return { lidx, texelCount };
}

// ---------------- level cuts (worker ti()) ----------------
export function labToSrgb8(lab) {   // worker dh()
  const [L, a, b] = lab, s = (L + 16) / 116, r = s + a / 500, i = s - b / 200;
  let X = r ** 3 > 0.008856 ? r ** 3 : (116 * r - 16) / 903.3;
  let Y = L > 903.3 * 0.008856 ? s ** 3 : L / 903.3;
  let Z = i ** 3 > 0.008856 ? i ** 3 : (116 * i - 16) / 903.3;
  X *= 0.95047; Z *= 1.08883;
  const lin = [X * 3.2404542 - Y * 1.5371385 - Z * 0.4985314, -X * 0.969266 + Y * 1.8760108 + Z * 0.041556, X * 0.0556434 - Y * 0.2040259 + Z * 1.0572252];
  return lin.map((t) => { t = Math.max(t, 0); const e = t <= 0.0031308 ? t * 12.92 : 1.055 * t ** (1 / 2.4) - 0.055; return Math.floor(Math.min(Math.max(e, 0), 1) * 255 + 0.5); });
}

/** Replay the first (N-K) merges; clusters are ordered by weight (largest first) like the worker. */
export function cutLevel(leafLab, leafWeight, merges, jnd, K) {
  const n = leafLab.length; let a = Math.min(Math.max(n - K, jnd), merges.length, n); a = Math.max(a, 0);
  const parent = [...Array(n).keys()];
  const find = (x) => { while (parent[x] !== x) x = parent[x]; return x; };
  for (const m of merges.slice(0, a)) { const c = find(m.intoLeaf), t = find(m.fromLeaf); if (c !== t) parent[t] = c; }
  const roots = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i); if (!roots.has(r)) roots.set(r, [[0, 0, 0], 0.0]);
    const w = leafWeight[i] > 0 ? leafWeight[i] : 1e-6, v = roots.get(r);
    for (let c = 0; c < 3; c++) v[0][c] += leafLab[i][c] * w; v[1] += w;
  }
  const order = [...roots.keys()].sort((x, y) => roots.get(y)[1] - roots.get(x)[1]);
  const rank = new Map(order.map((r, k) => [r, k]));
  let total = 0; for (const v of roots.values()) total += v[1];
  const clusters = order.map((r) => {
    const [s, w] = roots.get(r), lab = s.map((x) => x / w), rgb = labToSrgb8(lab);
    return { rgb, lab, weight: w, areaRatio: w / total, hex: '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('') };
  });
  return { K: clusters.length, leafToCluster: [...Array(n).keys()].map((i) => rank.get(find(i))), clusters };
}

/** Push labels into uncovered (255) texels so sampling at UV seams never hits a hole (np.roll wraps). */
export function dilateLabels(lidx, W, H, iters = 16) {
  const out = lidx.slice(), N = W * H, hole = new Uint8Array(N), src = new Uint8Array(N);
  for (let it = 0; it < iters; it++) {
    let any = false; for (let q = 0; q < N; q++) { hole[q] = out[q] === 255 ? 1 : 0; any = any || hole[q] === 1; }
    if (!any) break;
    for (const [dy, dx] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      for (let y = 0; y < H; y++) { const ys = (y - dy + H) % H; for (let x = 0; x < W; x++) src[y * W + x] = out[ys * W + ((x - dx + W) % W)]; }
      for (let q = 0; q < N; q++) if (hole[q] && src[q] !== 255 && out[q] === 255) out[q] = src[q];
    }
  }
  return out;
}

// ---------------- driver ----------------
/** triUV (n*6), triWorld (n*9) Float32Array; tex = { width, height, data: Uint8Array RGB } */
export function analyze(triUV, triWorld, tex, flipY = false, log = () => {}, progress = () => {}, maxDistanceMatrixBytes = 128 * 1024 * 1024) {
  const t0 = performance.now(), W = tex.width, H = tex.height;
  const el = () => ((performance.now() - t0) / 1000).toFixed(1) + 's';
  progress('Sampling faces', 0);
  const { faceLab, faceRgb, faceArea, faceValid } = sampleFaces(triUV, triWorld, tex, flipY, true);
  const bins = faceHistogram(faceLab, faceRgb, faceArea, faceValid);
  progress('Merging colors', 0.1);
  const mac = premerge(bins.lab.map((l) => l.slice()), bins.area.slice(), PREMERGE_STOP, KL, maxDistanceMatrixBytes);
  const sel = selectLeaves(mac.lab, mac.area);
  let ne = 0; for (const e of sel.eligible) ne += e;
  log(`faces -> ${bins.area.length} RGB bins -> ${mac.area.length} macro colors -> ${ne} eligible -> ${sel.leafLab.length} leaves (${el()})`);
  const { merges, jnd } = dendrogram(sel.leafLab, sel.leafWeight);
  const [sugg, maxSel] = suggestedCount(merges, sel.leafLab.length, jnd);
  const n = (triUV.length / 6) | 0, px = new Float64Array(n * 6);
  for (let k = 0; k < n * 3; k++) { px[2 * k] = f32(triUV[2 * k] * W); px[2 * k + 1] = f32((flipY ? 1 - triUV[2 * k + 1] : triUV[2 * k + 1]) * H); }
  const mask = uvCoverage(px, W, H);
  progress('Bilateral filter', 0.2);
  const filtered = bilateral(tex.data, mask, W, H, BILATERAL_ITERS, (f) => progress('Bilateral filter', 0.2 + 0.75 * f));
  const { lidx, texelCount } = labelTexels(filtered, mask, sel.leafLab);
  let covered = 0; for (let q = 0; q < mask.length; q++) covered += mask[q];
  log(`bilateral + texel labelling done, ${covered} covered texels (${el()})`);
  const levels = [];
  for (let K = 1; K <= maxSel; K++) levels.push(cutLevel(sel.leafLab, sel.leafWeight, merges, jnd, K));
  return { leafLab: sel.leafLab, leafWeight: sel.leafWeight, leafTexelCount: texelCount, merges, jndMergeCount: jnd,
    suggestedColorCount: sugg, maxSelectableColorCount: maxSel, totalCovered: covered, levels,
    width: W, height: H, leafIndexMap: lidx };
}
