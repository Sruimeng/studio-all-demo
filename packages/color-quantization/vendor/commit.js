// Vendored from vast-enterprise/color-quantization, 80c58f2168d72800e8170f6998987262eeae780d.
// Local patches and redistribution restrictions: ../UPSTREAM.md.
// Commit / bake stage: JavaScript port of python/commit.py. Cuts the mesh along the color borders of one level K
// and returns one label per triangle (write it with glb.js writeCommittedGLB). Stage names are the worker's own:
// ApplyCut, RegionMap, BoundaryNetwork, ConstraintCollect, FaceTriangulate, CutFaceSample, CutFaceAdjacency,
// RegionGraph, MrfSolve, Fairing, Weld. See python/commit.py for the description of every stage.
import { sampleFaces, cutLevel, npSum } from './quantize.js';

const DP_EPS = 1.0, SMOOTH_ALPHA = 0.5, CORNER_DEG = 60.0, CORNER_MOVE = 2.0, FLAT_TOL = 0.3, FLAT_DEPTH = 8, HANDLE_FRAC = 1.0 / 3;
const EXT_DIV = 60.0, SPLIT_CORNER = 1e-3, SPLIT_MERGE = 2e-4, GRAZING = 2e-4, MIN_CHORD = 1e-9, DEGEN_UV = 1e-12, EDGE_EPS = 1e-7;
const HASH_SCALE = 1e6, SEARCH_R = 2, MRF_LAMBDA = 35.0, CONTRAST_FLOOR = 0.05, CONTRAST_MIN_VAR = 1.0, ICM_ITERS = 24, EXPANSION_CYCLES = 8;
const FAIR_ITERS = 10, TAUBIN_LAMBDA = 0.5, TAUBIN_MU = -0.53, FOLD_GUARD_DEG = 30.0, BAND_RINGS = 2, BAND_ITERS = 10, BAND_GUARD_DEG = 30.0;
const GUARD_BISECT = 12, NOREGION = -1, UNCOVERED = 255;

/** Python's round(): half to even */
function pyRound(x) { const r = Math.round(x); return (Math.abs(x % 1) === 0.5) ? 2 * Math.round(x / 2) : r; }
const norm3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

/** insertion-ordered index of non-negative integer keys (exact up to 2^53): id(key) -> 0, 1, 2, ... in order of first insert */
class KeyIndex {
  constructor(hint = 1024) { this.cap = 1; while (this.cap < 2 * hint) this.cap <<= 1; this.slot = new Int32Array(this.cap).fill(-1); this.keys = new Float64Array(hint); this.size = 0; }
  _h(k) { const lo = k % 4294967296, hi = (k - lo) / 4294967296; let h = Math.imul(lo | 0, 0x9E3779B1) ^ Math.imul((hi | 0) + 0x632BE5AB, 0x85EBCA77); h ^= h >>> 15; return h & (this.cap - 1); }
  _grow() {
    const old = this.keys.subarray(0, this.size); this.cap <<= 1; this.slot = new Int32Array(this.cap).fill(-1);
    for (let i = 0; i < old.length; i++) { let h = this._h(old[i]); while (this.slot[h] >= 0) h = (h + 1) & (this.cap - 1); this.slot[h] = i; }
  }
  get(k) { let h = this._h(k); for (;;) { const i = this.slot[h]; if (i < 0) return -1; if (this.keys[i] === k) return i; h = (h + 1) & (this.cap - 1); } }
  id(k) {
    let h = this._h(k);
    for (;;) {
      const i = this.slot[h];
      if (i < 0) break;
      if (this.keys[i] === k) return i;
      h = (h + 1) & (this.cap - 1);
    }
    const i = this.size++;
    if (i >= this.keys.length) { const nk = new Float64Array(this.keys.length * 2); nk.set(this.keys); this.keys = nk; }
    this.keys[i] = k; this.slot[h] = i;
    if (2 * this.size > this.cap) this._grow();
    return i;
  }
}
/** growable typed array */
class Vec {
  constructor(C = Int32Array, n = 1024) { this.C = C; this.a = new C(n); this.n = 0; }
  push(v) { if (this.n === this.a.length) { const b = new this.C(this.a.length * 2); b.set(this.a); this.a = b; } this.a[this.n++] = v; }
  get data() { return this.a.subarray(0, this.n); }
}

// ======================================================================================
// UV index (worker O0): triangle UV/world arrays, UV grid, exact position weld
// ======================================================================================
/** weld float32 xyz by exact bit pattern (+0 == -0); ids in order of first appearance */
export function weldExact(P) {
  const n = (P.length / 3) | 0, f = new Float32Array(P), u = new Uint32Array(f.buffer);
  for (let i = 0; i < u.length; i++) if (f[i] === 0) u[i] = 0;
  let cap = 1; while (cap < 2 * n + 2) cap <<= 1;
  const table = new Int32Array(cap).fill(-1), ids = new Int32Array(n), first = [];
  for (let i = 0; i < n; i++) {
    const a = u[3 * i], b = u[3 * i + 1], c = u[3 * i + 2];
    let h = (Math.imul(a, 0x9E3779B1) ^ Math.imul(b ^ (b >>> 15), 0x85EBCA77) ^ Math.imul(c ^ (c >>> 13), 0xC2B2AE3D)) >>> 0;
    h = (h ^ (h >>> 16)) & (cap - 1);
    for (;;) {
      const t = table[h];
      if (t < 0) { table[h] = first.length; ids[i] = first.length; first.push(i); break; }
      const j = first[t];
      if (u[3 * j] === a && u[3 * j + 1] === b && u[3 * j + 2] === c) { ids[i] = t; break; }
      h = (h + 1) & (cap - 1);
    }
  }
  const pos = new Float32Array(first.length * 3);
  first.forEach((j, k) => { pos[3 * k] = f[3 * j]; pos[3 * k + 1] = f[3 * j + 1]; pos[3 * k + 2] = f[3 * j + 2]; });
  return { ids, pos };
}

function buildUVIndex(triUV, triWorld) {
  const n = (triUV.length / 6) | 0, grid = Math.max(1, Math.ceil(Math.sqrt(n)));
  const cl = (a) => Math.min(Math.max(Math.floor(a * grid), 0), grid - 1);
  const box = new Int32Array(4 * n), cnt = new Int32Array(grid * grid + 1);
  for (let t = 0; t < n; t++) {
    const u0 = triUV[6 * t], v0 = triUV[6 * t + 1], u1 = triUV[6 * t + 2], v1 = triUV[6 * t + 3], u2 = triUV[6 * t + 4], v2 = triUV[6 * t + 5];
    const x0 = cl(Math.min(u0, u1, u2)), x1 = cl(Math.max(u0, u1, u2)), y0 = cl(Math.min(v0, v1, v2)), y1 = cl(Math.max(v0, v1, v2));
    box[4 * t] = x0; box[4 * t + 1] = x1; box[4 * t + 2] = y0; box[4 * t + 3] = y1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cnt[y * grid + x + 1]++;
  }
  for (let i = 0; i < grid * grid; i++) cnt[i + 1] += cnt[i];
  const offs = cnt.slice(), fill = cnt.slice(0, grid * grid), tris = new Int32Array(offs[grid * grid]);
  for (let t = 0; t < n; t++) for (let y = box[4 * t + 2]; y <= box[4 * t + 3]; y++) for (let x = box[4 * t]; x <= box[4 * t + 1]; x++) tris[fill[y * grid + x]++] = t;
  const { ids, pos } = weldExact(triWorld);
  return { n, grid, triUV: Float64Array.from(triUV), triWorld, cellOffs: offs, cellTris: tris, vid: ids, V: pos.length / 3,
    wpos: Float64Array.from(pos), wpos32: pos };
}

// ======================================================================================
// RegionMap (kp) + BoundaryNetwork walks (Rp)
// ======================================================================================
function regionMap(flat, W, H) {
  const N = W * H, p = new Int32Array(N);
  for (let i = 0; i < N; i++) p[i] = i;
  const find = (x) => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
  const unite = (q, r) => { const a = find(q), b = find(r); if (a !== b) { if (a < b) p[b] = a; else p[a] = b; } };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const q = y * W + x, m = flat[q]; if (m === 255) continue;
    if (x + 1 < W && flat[q + 1] === m) unite(q, q + 1);
    if (y + 1 < H && flat[q + W] === m) unite(q, q + W);
  }
  const rid = new Int32Array(N).fill(-1), remap = new Int32Array(N).fill(-1); let n = 0;
  for (let q = 0; q < N; q++) {
    if (flat[q] === 255) continue;
    const r = find(q); if (remap[r] < 0) remap[r] = n++;
    rid[q] = remap[r];
  }
  return { rid, n };
}

function boundaryWalks(rid, W, H) {
  const S = W + 1, at = (y, x) => rid[y * W + x];
  const n0 = [], n1 = [], rA = [], rB = [];
  for (let x = 0; x <= W; x++) for (let y = 0; y < H; y++) {
    const a = x >= 1 ? at(y, x - 1) : -1, b = x < W ? at(y, x) : -1;
    if (a !== b) { n0.push(y * S + x); n1.push((y + 1) * S + x); rA.push(a); rB.push(b); }
  }
  for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) {
    const a = y >= 1 ? at(y - 1, x) : -1, b = y < H ? at(y, x) : -1;
    if (a !== b) { n0.push(y * S + x); n1.push(y * S + x + 1); rA.push(a); rB.push(b); }
  }
  const ne = n0.length, NN = S * (H + 1), deg = new Uint8Array(NN), inc = new Int32Array(NN * 4).fill(-1), order = [];
  for (let e = 0; e < ne; e++) for (const nd of [n0[e], n1[e]]) { if (deg[nd] === 0) order.push(nd); inc[nd * 4 + deg[nd]] = e; deg[nd]++; }
  const vis = new Uint8Array(ne), wnodes = [], woff = [], wedge = [], wclosed = [], starts = [], sedge = [];
  for (const nd of order) if (deg[nd] !== 2) for (let j = 0; j < deg[nd]; j++) { starts.push(nd); sedge.push(inc[nd * 4 + j]); }
  const ns = starts.length;
  for (let si = 0; si < ns + ne; si++) {
    let x, e, closed;
    if (si < ns) { x = starts[si]; e = sedge[si]; closed = 0; if (vis[e]) continue; }
    else { e = si - ns; if (vis[e]) continue; x = n0[e]; closed = 1; }
    woff.push(wnodes.length); wedge.push(e); wclosed.push(closed); wnodes.push(x);
    let A = x, M = e;
    for (;;) {
      vis[M] = 1;
      const C = n0[M] === A ? n1[M] : n0[M];
      wnodes.push(C); A = C;
      if (deg[A] !== 2) break;
      let T = -1;
      for (let j = 0; j < deg[A]; j++) { const b = inc[A * 4 + j]; if (b !== M && !vis[b]) { T = b; break; } }
      if (T === -1) break;
      M = T;
    }
  }
  woff.push(wnodes.length);
  return { wnodes, woff, wedge, wclosed, rA, rB };
}

// ---------------- per-arc simplify / refine / smooth (Bp) ----------------
function segd2(px, py, ax, ay, bx, by) {   // dc
  const i = bx - ax, c = by - ay, a = i * i + c * c;
  if (a === 0) return (px - ax) ** 2 + (py - ay) ** 2;
  let u = ((px - ax) * i + (py - ay) * c) / a; u = u < 0 ? 0 : (u > 1 ? 1 : u);
  const dx = px - (ax + u * i), dy = py - (ay + u * c);
  return dx * dx + dy * dy;
}
const sq = (v) => v * v;

function dp(X, Y, e, o, eps) {   // yc
  const r = eps * eps, keep = new Uint8Array(o - e + 1); keep[0] = 1; keep[o - e] = 1;
  const st = [[e, o]];
  while (st.length) {
    const [l, f] = st.pop(); let h = -1.0, d = -1;
    for (let y = l + 1; y < f; y++) { const g = segd2(X[y], Y[y], X[l], Y[l], X[f], Y[f]); if (g > h) { h = g; d = y; } }
    if (d !== -1 && h > r) { keep[d - e] = 1; st.push([l, d]); st.push([d, f]); }
  }
  const out = []; for (let u = e; u <= o; u++) if (keep[u - e]) out.push(u);
  return out;
}

function dpClosed(X, Y, eps) {   // Cp
  const o = X.length;
  if (o <= 3) { const u = []; for (let i = 0; i < o - 1; i++) u.push(i); return u.length ? u : [0]; }
  let s = 0, r = -1.0;
  for (let u = 1; u < o; u++) { const h = sq(X[u] - X[0]) + sq(Y[u] - Y[0]); if (h > r) { r = h; s = u; } }
  const a = new Set([...dp(X, Y, 0, s, eps), ...dp(X, Y, s, o - 1, eps)]); a.delete(o - 1);
  return [...a].sort((x, y) => x - y);
}

function fit(X, Y, e, o) {   // Fu
  const s = o - e + 1; if (s < 2) return null;
  let cx = 0, cy = 0; for (let i = e; i <= o; i++) cx += X[i]; for (let i = e; i <= o; i++) cy += Y[i]; cx /= s; cy /= s;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = e; i <= o; i++) sxx += sq(X[i] - cx);
  for (let i = e; i <= o; i++) sxy += (X[i] - cx) * (Y[i] - cy);
  for (let i = e; i <= o; i++) syy += sq(Y[i] - cy);
  const l = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return [cx, cy, Math.cos(l), Math.sin(l)];
}

function isect(n, t) {   // Tp
  const e = t[2] * n[3] - n[2] * t[3]; if (Math.abs(e) < 1e-3) return null;
  const o = t[0] - n[0], s = t[1] - n[1], r = (-o * t[3] + t[2] * s) / e;
  return [n[0] + r * n[2], n[1] + r * n[3]];
}

function span(keep, c, d, o, closed) {   // Bu
  const r = keep.length;
  if (d > 0) return c + 1 < r ? [keep[c], keep[c + 1]] : (closed ? [keep[r - 1], o - 1] : null);
  return c - 1 >= 0 ? [keep[c - 1], keep[c]] : (closed ? [keep[r - 1], o - 1] : null);
}

function refine(X, Y, keep, o, closed) {   // Ip
  const r = keep.length, out = [];
  for (let c = 0; c < r; c++) {
    const a = keep[c], u = X[a], l = Y[a];
    if ((!closed && (c === 0 || c === r - 1)) || r < 3) { out.push([u, l]); continue; }
    const h = span(keep, c, -1, o, closed), d = span(keep, c, 1, o, closed);
    if (!h || !d) { out.push([u, l]); continue; }
    const y = fit(X, Y, h[0], h[1]), g = fit(X, Y, d[0], d[1]);
    const p = (y && g) ? isect(y, g) : null;
    if (!p || sq(p[0] - u) + sq(p[1] - l) > CORNER_MOVE ** 2) out.push([u, l]); else out.push(p);
  }
  return out;
}

function corners(P, closed, deg) {   // Ep
  const o = P.length, s = new Array(o).fill(false);
  if (!closed && o > 0) { s[0] = true; s[o - 1] = true; }
  if (o < 3) return s;
  const r = Math.cos(deg * Math.PI / 180);
  for (let i = 0; i < o; i++) {
    if (!closed && (i === 0 || i === o - 1)) continue;
    const c = (i - 1 + o) % o, a = (i + 1) % o;
    const u = P[i][0] - P[c][0], l = P[i][1] - P[c][1], f = P[a][0] - P[i][0], h = P[a][1] - P[i][1];
    const d = Math.sqrt(u * u + l * l), y = Math.sqrt(f * f + h * h);
    if (d === 0 || y === 0) continue;
    const g = Math.max(-1.0, Math.min(1.0, (u * f + l * h) / (d * y)));
    if (g <= r) s[i] = true;
  }
  return s;
}

function handle(p, t, alpha, sign, lim) {   // zu
  let r = sign * alpha * t[0], i = sign * alpha * t[1]; const c = Math.sqrt(r * r + i * i);
  if (c > lim && c > 0) { const a = lim / c; r *= a; i *= a; }
  return [p[0] + r, p[1] + i];
}

function flatten(n, t, e, o, depth, out) {   // gc
  const L2 = FLAT_TOL * FLAT_TOL;
  if ((segd2(t[0], t[1], n[0], n[1], o[0], o[1]) <= L2 && segd2(e[0], e[1], n[0], n[1], o[0], o[1]) <= L2) || depth >= FLAT_DEPTH) { out.push(n); return; }
  const mid = (p, q) => [(p[0] + q[0]) * 0.5, (p[1] + q[1]) * 0.5];
  const a = mid(n, t), u = mid(t, e), l = mid(e, o), f = mid(a, u), h = mid(u, l), d = mid(f, h);
  flatten(n, a, f, d, depth + 1, out); flatten(d, h, l, o, depth + 1, out);
}

function smooth(P, corner, closed, alpha) {   // vp
  const s = P.length; if (s < 3 || alpha <= 0) return P;
  const tin = new Array(s), tout = new Array(s);
  for (let u = 0; u < s; u++) {
    const l = (u - 1 + s) % s, f = (u + 1) % s;
    if (corner[u]) { tin[u] = [P[u][0] - P[l][0], P[u][1] - P[l][1]]; tout[u] = [P[f][0] - P[u][0], P[f][1] - P[u][1]]; }
    else { const h = [0.5 * (P[f][0] - P[l][0]), 0.5 * (P[f][1] - P[l][1])]; tin[u] = h; tout[u] = h; }
  }
  if (!closed) {
    tout[0] = [P[1][0] - P[0][0], P[1][1] - P[0][1]]; tin[0] = tout[0];
    tin[s - 1] = [P[s - 1][0] - P[s - 2][0], P[s - 1][1] - P[s - 2][1]]; tout[s - 1] = tin[s - 1];
  }
  const out = [];
  for (let u = 0; u < (closed ? s : s - 1); u++) {
    const f = (u + 1) % s, h = P[u], d = P[f], g = HANDLE_FRAC * Math.hypot(d[0] - h[0], d[1] - h[1]);
    flatten(h, handle(h, tout[u], alpha, 1, g), handle(d, tin[f], alpha, -1, g), d, 0, out);
  }
  if (!closed) out.push(P[s - 1]);
  return out;
}

function boundaryNetwork(rid, W, H) {
  const S = W + 1, { wnodes, woff, wedge, wclosed, rA, rB } = boundaryWalks(rid, W, H), arcs = [];
  for (let k = 0; k < wedge.length; k++) {
    const closed = !!wclosed[k], X = [], Y = [];
    for (let i = woff[k]; i < woff[k + 1]; i++) { X.push(wnodes[i] % S); Y.push(Math.floor(wnodes[i] / S)); }
    const o = X.length;
    const keep = closed ? dpClosed(X, Y, DP_EPS) : dp(X, Y, 0, o - 1, DP_EPS);
    let P = refine(X, Y, keep, o, closed);
    P = smooth(P, corners(P, closed, CORNER_DEG), closed, SMOOTH_ALPHA);
    const pts = new Float32Array(P.length * 2); P.forEach((p, i) => { pts[2 * i] = p[0]; pts[2 * i + 1] = p[1]; });
    arcs.push({ points: pts, regionA: rA[wedge[k]], regionB: rB[wedge[k]], closed });
  }
  return arcs;
}

// ======================================================================================
// Constrained Delaunay triangulation of one face (stand-in for the worker's cdt_wasm)
// ======================================================================================
class CDTError extends Error {}
const EK = 1048576;

function cdtFace(pointlist, segments, tol = 1e-12) {
  const n = pointlist.length / 2, ox = pointlist[0], oy = pointlist[1];
  let sc = 0; for (let i = 0; i < n; i++) sc = Math.max(sc, Math.max(Math.abs(pointlist[2 * i] - ox), Math.abs(pointlist[2 * i + 1] - oy)));
  if (!sc) sc = 1.0;
  const PX = new Float64Array(n), PY = new Float64Array(n);
  for (let i = 0; i < n; i++) { PX[i] = (pointlist[2 * i] - ox) / sc; PY[i] = (pointlist[2 * i + 1] - oy) / sc; }
  const orient = (a, b, c) => (PX[b] - PX[a]) * (PY[c] - PY[a]) - (PY[b] - PY[a]) * (PX[c] - PX[a]);
  const incircle = (a, b, c, d) => {
    const ax = PX[a] - PX[d], ay = PY[a] - PY[d], bx = PX[b] - PX[d], by = PY[b] - PY[d], cx = PX[c] - PX[d], cy = PY[c] - PY[d];
    return ((ax * ax + ay * ay) * (bx * cy - cx * by) - (bx * bx + by * by) * (ax * cy - cx * ay) + (cx * cx + cy * cy) * (ax * by - bx * ay));
  };
  const tris = new Map(), E = new Map(); let nid = 0;
  const add = (a, b, c) => { const t = nid++; tris.set(t, [a, b, c]); E.set(a * EK + b, t); E.set(b * EK + c, t); E.set(c * EK + a, t); };
  const rem = (t) => { const [a, b, c] = tris.get(t); tris.delete(t); E.delete(a * EK + b); E.delete(b * EK + c); E.delete(c * EK + a); };
  const third = (t, u, v) => { const [a, b, c] = tris.get(t); return (a === u && b === v) ? c : ((b === u && c === v) ? a : b); };
  if (orient(0, 1, 2) > 0) add(0, 1, 2); else add(0, 2, 1);
  for (let p = 3; p < n; p++) {
    let best = null, bestv = -1e300;
    for (const [t, [a, b, c]] of tris) {
      const o = [orient(a, b, p), orient(b, c, p), orient(c, a, p)], m = Math.min(o[0], o[1], o[2]);
      if (m > bestv) { bestv = m; best = [t, o]; }
    }
    if (best === null || bestv < -1e-9) throw new CDTError('point outside face');
    const [t, o] = best, [a, b, c] = tris.get(t);
    for (const q of [a, b, c]) if (Math.abs(PX[q] - PX[p]) < 1e-14 && Math.abs(PY[q] - PY[p]) < 1e-14) throw new CDTError('duplicate point');
    const on = [0, 1, 2].filter((k) => Math.abs(o[k]) <= tol);
    if (!on.length) { rem(t); add(a, b, p); add(b, c, p); add(c, a, p); continue; }
    const k = on[0], [u, v] = [[a, b], [b, c], [c, a]][k], w = third(t, u, v);
    rem(t); add(v, w, p); add(w, u, p);
    const t2 = E.get(v * EK + u);
    if (t2 !== undefined) { const x = third(t2, v, u); rem(t2); add(u, x, p); add(x, v, p); }
  }
  const cons = new Set();
  const crosses = (a, b, u, v) => {
    const o1 = orient(a, b, u), o2 = orient(a, b, v), o3 = orient(u, v, a), o4 = orient(u, v, b);
    return ((o1 > tol && o2 < -tol) || (o1 < -tol && o2 > tol)) && ((o3 > tol && o4 < -tol) || (o3 < -tol && o4 > tol));
  };
  for (let s = 0; s < segments.length; s += 2) {
    const a = segments[s], b = segments[s + 1];
    if (a === b) continue;
    const ck = Math.min(a, b) * EK + Math.max(a, b);
    if (E.has(a * EK + b) || E.has(b * EK + a)) { cons.add(ck); continue; }
    const L2 = sq(PX[b] - PX[a]) + sq(PY[b] - PY[a]);
    for (let q = 0; q < n; q++) {
      if (q === a || q === b) continue;
      if (Math.abs(orient(a, b, q)) <= tol * Math.sqrt(L2 + 1e-300)) {
        const d = (PX[q] - PX[a]) * (PX[b] - PX[a]) + (PY[q] - PY[a]) * (PY[b] - PY[a]);
        if (0 < d && d < L2) throw new CDTError('vertex on segment');
      }
    }
    const cross = [];
    for (const key of [...E.keys()]) {
      const u = Math.floor(key / EK), v = key - u * EK;
      if (u < v && E.has(v * EK + u) && crosses(a, b, u, v)) cross.push([u, v]);
    }
    for (const [u, v] of cross) if (cons.has(u * EK + v)) throw new CDTError('crossing constrained edges');
    let guard = 0;
    while (cross.length) {
      if (++guard > 20000) throw new CDTError('segment recovery did not converge');
      const [u, v] = cross.shift(), t1 = E.get(u * EK + v), t2 = E.get(v * EK + u);
      if (t1 === undefined || t2 === undefined) throw new CDTError('lost edge');
      const w1 = third(t1, u, v), w2 = third(t2, v, u);
      if (crosses(w1, w2, u, v)) {
        rem(t1); rem(t2); add(u, w2, w1); add(w2, v, w1);
        if (crosses(a, b, w1, w2)) cross.push([Math.min(w1, w2), Math.max(w1, w2)]);
      } else cross.push([u, v]);
    }
    if (!(E.has(a * EK + b) || E.has(b * EK + a))) throw new CDTError('segment not recovered');
    cons.add(ck);
  }
  for (let it = 0; it < 200; it++) {   // Lawson flips on unconstrained interior edges -> CDT
    let flipped = false;
    for (const key of [...E.keys()]) {
      const u = Math.floor(key / EK), v = key - u * EK;
      if (u > v || cons.has(key)) continue;
      const t1 = E.get(key), t2 = E.get(v * EK + u);
      if (t1 === undefined || t2 === undefined) continue;
      const w1 = third(t1, u, v), w2 = third(t2, v, u);
      if (incircle(u, v, w1, w2) > tol && crosses(w1, w2, u, v)) { rem(t1); rem(t2); add(u, w2, w1); add(w2, v, w1); flipped = true; }
    }
    if (!flipped) break;
  }
  return [...tris.values()];
}

// ======================================================================================
// ConstraintCollect (wg) + FaceTriangulate (Tg)
// ======================================================================================
const Lt = (n, t, e, o, s, r) => (s - n) * (o - t) - (r - t) * (e - n);

function clipSegTri(x0, y0, x1, y1, uv, k) {   // vy
  const c = uv[k], a = uv[k + 1], u = uv[k + 2], l = uv[k + 3], f = uv[k + 4], h = uv[k + 5];
  const d = Lt(c, a, u, l, f, h);
  if (Math.abs(d) < DEGEN_UV) return null;
  const sg = d > 0 ? 1 : -1; let g = 0.0, p = 1.0, m = -1, x = -1;
  for (let w = 0; w < 3; w++) {
    let b, A, M, C;
    if (w === 0) { b = c; A = a; M = u; C = l; } else if (w === 1) { b = u; A = l; M = f; C = h; } else { b = f; A = h; M = c; C = a; }
    const T = Lt(b, A, M, C, x0, y0) * sg, D = Lt(b, A, M, C, x1, y1) * sg - T;
    if (D === 0) { if (T < 0) return null; continue; }
    const I = -T / D;
    if (D > 0) { if (I > g) { g = I; m = w; } } else if (I < p) { p = I; x = w; }
    if (g > p) return null;
  }
  return [x0 + (x1 - x0) * g, y0 + (y1 - y0) * g, x0 + (x1 - x0) * p, y0 + (y1 - y0) * p, m, x];
}

function edgeOfPoint(uv, k, e, o) {   // eu
  const r = uv[k], i = uv[k + 1], c = uv[k + 2], a = uv[k + 3], u = uv[k + 4], l = uv[k + 5];
  const f = Lt(r, i, c, a, u, l); if (f === 0) return -1;
  const h = Math.abs(Lt(c, a, u, l, e, o) / f), d = Math.abs(Lt(u, l, r, i, e, o) / f), y = Math.abs(Lt(r, i, c, a, e, o) / f);
  if (h <= d && h <= y) return h < EDGE_EPS ? 1 : -1;
  if (y <= h && y <= d) return y < EDGE_EPS ? 0 : -1;
  return d < EDGE_EPS ? 2 : -1;
}

function baryWorld(ix, F, x, y, s) {   // yu
  const uv = ix.triUV, k = 6 * F, c = uv[k], a = uv[k + 1], u = uv[k + 2], l = uv[k + 3], f = uv[k + 4], h = uv[k + 5];
  const d = Lt(u, l, f, h, x, y) / s, yy = Lt(f, h, c, a, x, y) / s, g = Lt(c, a, u, l, x, y) / s, P = ix.triWorld, q = 9 * F;
  return [d * P[q] + yy * P[q + 3] + g * P[q + 6], d * P[q + 1] + yy * P[q + 4] + g * P[q + 7], d * P[q + 2] + yy * P[q + 5] + g * P[q + 8]];
}

function collectConstraints(arcs, ix, W, H, flipY, tolw) {
  const { grid, cellOffs: offs, cellTris: ctri, triUV, vid, wpos, V } = ix;
  const grazing = GRAZING * tolw, corner = SPLIT_CORNER * tolw, merge = SPLIT_MERGE * tolw;
  const perFace = new Map(), edgeSplits = new Map(), stats = { segments: 0, chords: 0, grazingDrops: 0 };
  const q = (v) => Math.min(Math.max(Math.floor(v * grid), 0), grid - 1);
  const snap = (F, e, x, y) => {   // tu
    const h = e, dd = (e + 1) % 3, k = 6 * F;
    const y0 = triUV[k + 2 * h], g0 = triUV[k + 2 * h + 1], p0 = triUV[k + 2 * dd], m0 = triUV[k + 2 * dd + 1];
    const dx = p0 - y0, dy = m0 - g0, b = dx * dx + dy * dy;
    if (b <= 0) return null;
    let A = ((x - y0) * dx + (y - g0) * dy) / b; A = A < 0 ? 0.0 : (A > 1 ? 1.0 : A);
    const Cv = vid[3 * F + h], Tv = vid[3 * F + dd], smin = Cv < Tv, key = smin ? Cv * V + Tv : Tv * V + Cv;
    const M = smin ? A : 1 - A;
    const S = Cv !== Tv ? norm3(wpos[3 * Tv] - wpos[3 * Cv], wpos[3 * Tv + 1] - wpos[3 * Cv + 1], wpos[3 * Tv + 2] - wpos[3 * Cv + 2]) : 0.0;
    if (S <= 0) return null;
    const P_ = A * S, v_ = (1 - A) * S, R = M * S, Fb = pyRound(R / merge);
    let kk = edgeSplits.get(key); if (!kk) { kk = new Map(); edgeSplits.set(key, kk); }
    let L = null;
    for (const U of [Fb - 1, Fb, Fb + 1]) { const Wv = kk.get(U); if (Wv !== undefined && Math.abs(Wv * S - R) < merge) { L = Wv; break; } }
    if (L === null) {
      if (P_ < corner) L = smin ? 0.0 : 1.0; else if (v_ < corner) L = smin ? 1.0 : 0.0; else L = M;
      kk.set(Fb, L);
    }
    const z = smin ? L : 1 - L;
    return [y0 + dx * z, g0 + dy * z];
  };
  for (const arc of arcs) {
    if (arc.regionA === NOREGION || arc.regionB === NOREGION) continue;
    const pts = arc.points, T = [];
    for (let i = 0; i < pts.length; i += 2) { T.push(pts[i] / W); T.push(flipY ? 1 - pts[i + 1] / H : pts[i + 1] / H); }
    if (arc.closed && pts.length >= 4) { T.push(T[0]); T.push(T[1]); }
    for (let E_ = 0; E_ < T.length - 3; E_ += 2) {
      const x0 = T[E_], y0 = T[E_ + 1], x1 = T[E_ + 2], y1 = T[E_ + 3];
      stats.segments++;
      const f = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * grid));
      const seen = new Set(), cand = []; let last = -1;
      for (let s = 0; s <= f; s++) {
        const g = s / f, cell = q(y0 + (y1 - y0) * g) * grid + q(x0 + (x1 - x0) * g);
        if (cell === last) continue;
        last = cell;
        for (let j = offs[cell]; j < offs[cell + 1]; j++) { const F = ctri[j]; if (!seen.has(F)) { seen.add(F); cand.push(F); } }
      }
      for (const F of cand) {
        const r = clipSegTri(x0, y0, x1, y1, triUV, 6 * F);
        if (r === null) continue;
        const [cx0, cy0, cx1, cy1, en, ex] = r;
        if (sq(cx1 - cx0) + sq(cy1 - cy0) < MIN_CHORD ** 2) continue;
        const z = en >= 0 ? en : edgeOfPoint(triUV, 6 * F, cx0, cy0), U = ex >= 0 ? ex : edgeOfPoint(triUV, 6 * F, cx1, cy1);
        const k = 6 * F, Wa = Lt(triUV[k], triUV[k + 1], triUV[k + 2], triUV[k + 3], triUV[k + 4], triUV[k + 5]);
        if (Wa !== 0) {
          const p1 = baryWorld(ix, F, cx1, cy1, Wa), p0 = baryWorld(ix, F, cx0, cy0, Wa);
          if (norm3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) < grazing) { stats.grazingDrops++; continue; }
        }
        let B = cx0, D = cy0, N = cx1, Vv = cy1;
        if (z >= 0) { const s_ = snap(F, z, cx0, cy0); if (s_) [B, D] = s_; }
        if (U >= 0) { const s_ = snap(F, U, cx1, cy1); if (s_) [N, Vv] = s_; }
        let pf = perFace.get(F); if (!pf) { pf = []; perFace.set(F, pf); }
        pf.push(B, D, N, Vv); stats.chords++;
      }
    }
  }
  return { perFace, edgeSplits, stats };
}

function paletteAt(u, v, cleaned, W, H, flipY, K) {   // ic
  const a = Math.min(Math.max(Math.floor(u * W), 0), W - 1), l = Math.min(Math.max(Math.floor((flipY ? 1 - v : v) * H), 0), H - 1);
  const f = cleaned[l * W + a];
  if (f !== UNCOVERED && f < K) return f;
  for (let h = 1; h <= SEARCH_R; h++) for (let d = -h; d <= h; d++) {
    const y = l + d; if (y < 0 || y >= H) continue;
    const g = h - Math.abs(d);
    if (g === 0) { const p = cleaned[y * W + a]; if (p !== UNCOVERED && p < K) return p; }
    else for (const xx of [a - g, a + g]) if (xx >= 0 && xx < W) { const p = cleaned[y * W + xx]; if (p !== UNCOVERED && p < K) return p; }
  }
  return -1;
}

function qExtent(P) {   // Wl/ey: max bbox extent
  const n = P.length / 3; if (!n) return 0.0;
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const v = P[3 * i + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
  const e = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
  return e > 0 ? e : EXT_DIV;
}

function lerpEdge(wpos, a, b, t) {   // Gi with canonical (min, max) vertex order
  const lo = a < b ? a : b, hi = a < b ? b : a;
  return [wpos[3 * lo] + (wpos[3 * hi] - wpos[3 * lo]) * t, wpos[3 * lo + 1] + (wpos[3 * hi + 1] - wpos[3 * lo + 1]) * t,
    wpos[3 * lo + 2] + (wpos[3 * hi + 2] - wpos[3 * lo + 2]) * t];
}
const wp = (wpos, v) => [wpos[3 * v], wpos[3 * v + 1], wpos[3 * v + 2]];

function edgePoints(Q, vids, ekey, spl) {
  const a = vids[Q], b = vids[(Q + 1) % 3], ts = spl.get(ekey[Q]);
  if (!ts || !ts.length) return [a, b, []];
  const smin = a < b;
  return [a, b, ts.map((t) => [smin ? t : 1 - t, t]).sort((x, y) => (x[0] - y[0]) || (x[1] - y[1]))];
}

function fanOne(uv, k, vids, ekey, spl, wpos, cleaned, W, H, flipY, K) {   // K(Y): degenerate or failed face
  const G = [];
  for (let Q = 0; Q < 3; Q++) {
    const [a, b, pts] = edgePoints(Q, vids, ekey, spl);
    G.push(wp(wpos, a));
    for (const [loc, can] of pts) if (loc > 0 && loc < 1) G.push(lerpEdge(wpos, a, b, can));
  }
  if (G.length < 3) return { pos: [], uv: [], pal: [] };
  const cu = (uv[k] + uv[k + 2] + uv[k + 4]) / 3, cv = (uv[k + 1] + uv[k + 3] + uv[k + 5]) / 3;
  let pal = paletteAt(cu, cv, cleaned, W, H, flipY, K); if (pal < 0) pal = 0;
  const A = wp(wpos, vids[0]), B = wp(wpos, vids[1]), C = wp(wpos, vids[2]), c = [0, 1, 2].map((i) => (A[i] + B[i] + C[i]) / 3);
  const pos = [], uvs = [], pals = [];
  for (let i = 0; i < G.length; i++) { pos.push([...c, ...G[i], ...G[(i + 1) % G.length]]); uvs.push([cu, cv, cu, cv, cu, cv]); pals.push(pal); }
  return { pos, uv: uvs, pal: pals };
}

function cutOne(uv, k, on, vids, ekey, spl, chords, wpos, cleaned, W, H, flipY, K) {
  const Re = uv[k], Fe = uv[k + 1], Be = uv[k + 2], ke = uv[k + 3], Le = uv[k + 4], ze = uv[k + 5];
  const [sn, rn, cn] = vids, pl = [Re, Fe, Be, ke, Le, ze], seg = [];
  const hk = (x, y) => pyRound(x * HASH_SCALE) + ',' + pyRound(y * HASH_SCALE);
  const hmap = new Map([[hk(Re, Fe), 0], [hk(Be, ke), 1], [hk(Le, ze), 2]]), onedge = new Map();
  const addp = (x, y) => { const key = hk(x, y), i = hmap.get(key); if (i !== undefined) return i; const j = pl.length / 2; pl.push(x, y); hmap.set(key, j); return j; };
  for (let Q = 0; Q < 3; Q++) {
    const Cq = (Q + 1) % 3, Yt = pl[2 * Q], Wt = pl[2 * Q + 1], Bt = pl[2 * Cq], Xt = pl[2 * Cq + 1];
    const [a, b, pts] = edgePoints(Q, vids, ekey, spl);
    let Sn = Q;
    for (const [loc, can] of pts) {
      const ln = addp(Yt + (Bt - Yt) * loc, Wt + (Xt - Wt) * loc);
      if (!onedge.has(ln)) onedge.set(ln, [a, b, can]);
      if (ln !== Sn) { seg.push(Sn, ln); Sn = ln; }
    }
    if (Sn !== Cq) seg.push(Sn, Cq);
  }
  if (chords) for (let i = 0; i < chords.length - 3; i += 4) {
    const w0 = addp(chords[i], chords[i + 1]), w1 = addp(chords[i + 2], chords[i + 3]);
    if (w0 !== w1) seg.push(w0, w1);
  }
  let tris;
  try { tris = cdtFace(pl, seg); } catch (e) { if (e instanceof CDTError) return null; throw e; }
  const A = wp(wpos, sn), B = wp(wpos, rn), C = wp(wpos, cn);
  const world = (i) => {   // Aa / qr
    if (i < 3) return [A, B, C][i];
    const oe = onedge.get(i); if (oe) return lerpEdge(wpos, oe[0], oe[1], oe[2]);
    const x = pl[2 * i], y = pl[2 * i + 1];
    const wa = Lt(Be, ke, Le, ze, x, y) / on, wb = Lt(Le, ze, Re, Fe, x, y) / on, wc = Lt(Re, Fe, Be, ke, x, y) / on;
    if (Math.abs(wc) < EDGE_EPS) return lerpEdge(wpos, sn, rn, sn < rn ? wb : 1 - wb);
    if (Math.abs(wa) < EDGE_EPS) return lerpEdge(wpos, rn, cn, rn < cn ? wc : 1 - wc);
    if (Math.abs(wb) < EDGE_EPS) return lerpEdge(wpos, cn, sn, cn < sn ? wa : 1 - wa);
    return [wa * A[0] + wb * B[0] + wc * C[0], wa * A[1] + wb * B[1] + wc * C[1], wa * A[2] + wb * B[2] + wc * C[2]];
  };
  const Oe = on > 0, pos = [], uvs = [], pals = [];
  for (let [i, j, kk] of tris) {
    let x0 = pl[2 * i], y0 = pl[2 * i + 1], x1 = pl[2 * j], y1 = pl[2 * j + 1], x2 = pl[2 * kk], y2 = pl[2 * kk + 1];
    if ((Lt(x0, y0, x1, y1, x2, y2) > 0) !== Oe) { [j, kk] = [kk, j]; [x1, y1, x2, y2] = [x2, y2, x1, y1]; }
    let p = paletteAt((x0 + x1 + x2) / 3, (y0 + y1 + y2) / 3, cleaned, W, H, flipY, K); if (p < 0) p = 0;
    pos.push([...world(i), ...world(j), ...world(kk)]); uvs.push([x0, y0, x1, y1, x2, y2]); pals.push(p);
  }
  return { pos, uv: uvs, pal: pals };
}

function faceCut(arcs, ix, cleaned, K, W, H, flipY, log) {   // worker Tg(), fillUncutFaces = includeUncovered = true
  const t0 = performance.now(), el = () => ((performance.now() - t0) / 1000).toFixed(1) + 's';
  const tolw = qExtent(ix.wpos32) / EXT_DIV;
  const { perFace, edgeSplits, stats: st } = collectConstraints(arcs, ix, W, H, flipY, tolw);
  log(`  ConstraintCollect: ${st.segments} arc segments -> ${st.chords} chords in ${perFace.size} faces, ${st.grazingDrops} grazing drops, ${edgeSplits.size} split edges (${el()})`);
  const { n, V, vid, wpos, triUV } = ix, ekey = new Float64Array(3 * n), active = [];
  for (let t = 0; t < n; t++) {
    let hs = false;
    for (let k = 0; k < 3; k++) {
      const a = vid[3 * t + k], b = vid[3 * t + (k + 1) % 3], key = Math.min(a, b) * V + Math.max(a, b);
      ekey[3 * t + k] = key; if (edgeSplits.has(key)) hs = true;
    }
    if (hs || perFace.has(t)) active.push(t);
  }
  const spl = new Map();
  for (const [key, d] of edgeSplits) spl.set(key, [...d.values()].filter((t) => t > 0 && t < 1).sort((a, b) => a - b));
  const out = new Map(); let nfail = 0, ndeg = 0, ncut = 0, npassive = 0;
  for (const Y of active) {
    const k = 6 * Y, on = Lt(triUV[k], triUV[k + 1], triUV[k + 2], triUV[k + 3], triUV[k + 4], triUV[k + 5]);
    const vids = [vid[3 * Y], vid[3 * Y + 1], vid[3 * Y + 2]], ek = [ekey[3 * Y], ekey[3 * Y + 1], ekey[3 * Y + 2]];
    let res = null;
    if (Math.abs(on) >= DEGEN_UV) { res = cutOne(triUV, k, on, vids, ek, spl, perFace.get(Y), wpos, cleaned, W, H, flipY, K); if (res === null) nfail++; }
    else ndeg++;
    if (res === null) res = fanOne(triUV, k, vids, ek, spl, wpos, cleaned, W, H, flipY, K);
    else { ncut++; if (!perFace.has(Y)) npassive++; }
    out.set(Y, res);
  }
  const off = new Int32Array(n + 1);
  for (let t = 0; t < n; t++) off[t + 1] = off[t] + (out.has(t) ? out.get(t).pos.length : 1);
  const tot = off[n], pos = new Float32Array(tot * 9), uv = new Float32Array(tot * 6), pal = new Int32Array(tot), src = new Int32Array(tot);
  for (let t = 0; t < n; t++) {
    const a = off[t];
    for (let i = a; i < off[t + 1]; i++) src[i] = t;
    const r = out.get(t);
    if (!r) {
      for (let c = 0; c < 3; c++) for (let d = 0; d < 3; d++) pos[9 * a + 3 * c + d] = wpos[3 * vid[3 * t + c] + d];
      for (let c = 0; c < 6; c++) uv[6 * a + c] = triUV[6 * t + c];
      const k = 6 * t, cu = (triUV[k] + triUV[k + 2] + triUV[k + 4]) / 3, cv = (triUV[k + 1] + triUV[k + 3] + triUV[k + 5]) / 3;
      const p = paletteAt(cu, cv, cleaned, W, H, flipY, K); pal[a] = p < 0 ? 0 : p;
    } else for (let i = 0; i < r.pos.length; i++) {
      pos.set(r.pos[i], 9 * (a + i)); uv.set(r.uv[i], 6 * (a + i)); pal[a + i] = r.pal[i];
    }
  }
  log(`  FaceTriangulate: ${active.length} active faces (${ncut} cut, ${npassive} of them only edge-split), ${ndeg} degenerate, ${nfail} CDT failures -> ${tot} triangles (+${tot - n}) (${el()})`);
  return { pos, uv, pal, src, stats: { active: active.length, cut: ncut, passive: npassive, degenerate: ndeg, cdtFail: nfail, triangles: tot } };
}

// ======================================================================================
// CutFaceAdjacency (wu = zg + Og + Dg, Fg)
// ======================================================================================
/** CSR from (key, value) pairs in insertion order: rows sorted by key, stable */
function csr(keys, vals, nrows) {
  const offs = new Int32Array(nrows + 1);
  for (let i = 0; i < keys.length; i++) offs[keys[i] + 1]++;
  for (let r = 0; r < nrows; r++) offs[r + 1] += offs[r];
  const fill = offs.slice(0, nrows), out = new Int32Array(keys.length);
  for (let i = 0; i < keys.length; i++) out[fill[keys[i]]++] = vals[i];
  return { offs, out, order: null };
}

function cutTopology(fillPos) {
  const F = fillPos.length / 9, { ids: tv, pos } = weldExact(fillPos), V = pos.length / 3;
  // edges in order of first appearance (face, corner k -> k+1), skipping a == b
  const emap = new KeyIndex(2 * F), ev = new Vec(Int32Array, 4 * F), eOfHalf = new Int32Array(3 * F), fOfHalf = new Int32Array(3 * F); let nh = 0;
  for (let f = 0; f < F; f++) for (let k = 0; k < 3; k++) {
    const a = tv[3 * f + k], b = tv[3 * f + (k + 1) % 3]; if (a === b) continue;
    const lo = a < b ? a : b, hi = a < b ? b : a, e = emap.id(lo * V + hi);
    if (2 * e === ev.n) { ev.push(lo); ev.push(hi); }
    eOfHalf[nh] = e; fOfHalf[nh++] = f;
  }
  const ne = ev.n / 2, E = csr(eOfHalf.subarray(0, nh), fOfHalf.subarray(0, nh), ne);
  const gv = new Int32Array(3 * F), gf = new Int32Array(3 * F); let ng = 0;
  for (let f = 0; f < F; f++) {
    const a = tv[3 * f], b = tv[3 * f + 1], c = tv[3 * f + 2];
    if (a !== b && b !== c && a !== c) { gv[ng] = a; gv[ng + 1] = b; gv[ng + 2] = c; gf[ng] = gf[ng + 1] = gf[ng + 2] = f; ng += 3; }
  }
  const VF = csr(gv.subarray(0, ng), gf.subarray(0, ng), V);
  return { F, V, tri: tv, vpos: Float64Array.from(pos), edgeVerts: ev.data.slice(), edgeOffs: E.offs, edgeFaces: E.out, vfOffs: VF.offs, vfFaces: VF.out };
}

function faceAdjacency(T) {   // worker Fg()
  const { edgeOffs: eoff, edgeFaces: ef, edgeVerts: ev, vpos: vp, F } = T, ne = ev.length / 2;
  const pmap = new KeyIndex(2 * F), pz = new Vec(Int32Array, 2 * F), pu = new Vec(Int32Array, 2 * F), pw = new Vec(Float64Array, 2 * F);
  const addPair = (a, b, L) => {
    if (a === b) return;
    const z = a < b ? a : b, U = a < b ? b : a, i = pmap.id(z * F + U);
    if (i === pz.n) { pz.push(z); pu.push(U); pw.push(L); } else pw.a[i] += L;
  };
  for (let e = 0; e < ne; e++) {
    const c = eoff[e + 1] - eoff[e]; if (c < 2) continue;
    const a = ev[2 * e], b = ev[2 * e + 1], L = norm3(vp[3 * b] - vp[3 * a], vp[3 * b + 1] - vp[3 * a + 1], vp[3 * b + 2] - vp[3 * a + 2]);
    if (c === 2) addPair(ef[eoff[e]], ef[eoff[e] + 1], L);
    else for (let i = eoff[e]; i < eoff[e + 1]; i++) for (let j = i + 1; j < eoff[e + 1]; j++) addPair(ef[i], ef[j], L);
  }
  const np_ = pz.n, src = new Int32Array(2 * np_), dst = new Int32Array(2 * np_), ww = new Float64Array(2 * np_);
  for (let i = 0; i < np_; i++) { src[2 * i] = pz.a[i]; dst[2 * i] = pu.a[i]; src[2 * i + 1] = pu.a[i]; dst[2 * i + 1] = pz.a[i]; ww[2 * i] = ww[2 * i + 1] = pw.a[i]; }
  return csrW(src, dst, ww, F);
}

function csrW(src, dst, ww, n) {
  const offs = new Int32Array(n + 1);
  for (let i = 0; i < src.length; i++) offs[src[i] + 1]++;
  for (let r = 0; r < n; r++) offs[r + 1] += offs[r];
  const fill = offs.slice(0, n), nb = new Int32Array(src.length), w = new Float64Array(src.length);
  for (let i = 0; i < src.length; i++) { const p = fill[src[i]]++; nb[p] = dst[i]; w[p] = ww[i]; }
  return { offs, nb, w };
}

// ======================================================================================
// RegionGraph + MrfSolve (Kg, qg, Zg, Jg, Wg/Ng)
// ======================================================================================
function baseline(faceLab, leafLab, leafCluster) {   // Gg
  const n = faceLab.length / 3, out = new Int32Array(n);
  for (let c = 0; c < n; c++) {
    let u = 0, best = Infinity;
    for (let f = 0; f < leafLab.length; f++) {
      const d = sq(faceLab[3 * c] - leafLab[f][0]) + sq(faceLab[3 * c + 1] - leafLab[f][1]) + sq(faceLab[3 * c + 2] - leafLab[f][2]);
      if (d < best) { best = d; u = leafCluster[f]; }
    }
    out[c] = u;
  }
  return out;
}

function regionGraph(base, offs, nb) {   // qg
  const r = base.length, p = new Int32Array(r), rk = new Uint8Array(r);
  for (let i = 0; i < r; i++) p[i] = i;
  for (let x = 0; x < r; x++) for (let m = offs[x]; m < offs[x + 1]; m++) {
    const C = nb[m];
    if (C > x && base[C] === base[x]) {
      let s = x; while (p[s] !== s) s = p[s];
      let t = C; while (p[t] !== t) t = p[t];
      if (s !== t) { if (rk[s] < rk[t]) p[s] = t; else if (rk[s] > rk[t]) p[t] = s; else { p[t] = s; rk[s]++; } }
    }
  }
  const reg = new Int32Array(r), remap = new Int32Array(r).fill(-1); let n = 0;
  for (let x = 0; x < r; x++) { let s = x; while (p[s] !== s) s = p[s]; if (remap[s] === -1) remap[s] = n++; reg[x] = remap[s]; }
  const init = new Int32Array(n); for (let x = 0; x < r; x++) init[reg[x]] = base[x];
  return { reg, n, init };
}

function regionAdjacency(reg, n, offs, nb, w) {
  const pmap = new Map(), pa = [], pb = [], ps = [];
  for (let a = 0; a < offs.length - 1; a++) for (let m = offs[a]; m < offs[a + 1]; m++) {
    const b = nb[m]; if (b <= a) continue;
    const ra = reg[a], rb = reg[b]; if (ra === rb) continue;
    const E = ra < rb ? ra : rb, M = ra < rb ? rb : ra, key = E * n + M, i = pmap.get(key);
    if (i === undefined) { pmap.set(key, pa.length); pa.push(E); pb.push(M); ps.push(w[m]); } else ps[i] += w[m];
  }
  const k = pa.length, src = new Int32Array(2 * k), dst = new Int32Array(2 * k), sw = new Float64Array(2 * k);
  for (let i = 0; i < k; i++) { src[2 * i] = pa[i]; dst[2 * i] = pb[i]; src[2 * i + 1] = pb[i]; dst[2 * i + 1] = pa[i]; sw[2 * i] = sw[2 * i + 1] = ps[i]; }
  return csrW(src, dst, sw, n);
}

function icm(labels, cost, L, offs, nb, w, scale, iters) {   // Jg
  const u = labels.length; let it = 0;
  for (let f = 0; f < iters; f++) {
    it = f + 1; let ch = 0;
    for (let d = 0; d < u; d++) {
      let m = labels[d], best = Infinity;
      for (let lab = 0; lab < L; lab++) {
        let b = cost[d * L + lab];
        for (let A = offs[d]; A < offs[d + 1]; A++) if (labels[nb[A]] !== lab) b += w[A] * scale;
        if (b < best) { best = b; m = lab; }
      }
      if (m !== labels[d]) { labels[d] = m; ch++; }
    }
    if (ch === 0) break;
  }
  return it;
}

function maxflowReach(N, s, t, eto, ecap, enext, head) {   // Ng: Dinic, then residual reachability from s
  const level = new Int32Array(N), it = new Int32Array(N), queue = new Int32Array(N), pnode = new Int32Array(N + 1), pedge = new Int32Array(N + 1);
  for (;;) {
    level.fill(-1); let qh = 0, qt = 0; level[s] = 0; queue[qt++] = s;
    while (qh < qt) {
      const r = queue[qh++];
      for (let i = head[r]; i !== -1; i = enext[i]) { const c = eto[i]; if (ecap[i] > 0 && level[c] === -1) { level[c] = level[r] + 1; queue[qt++] = c; } }
    }
    if (level[t] === -1) break;
    for (let o = 0; o < N; o++) it[o] = head[o];
    let o = 0; pnode[0] = s;
    while (o >= 0) {
      const x = pnode[o];
      if (x === t) {
        let mn = Infinity, ci = 0;
        for (let a = 0; a < o; a++) { const u = pedge[a]; if (ecap[u] < mn) { mn = ecap[u]; ci = a; } }
        for (let a = 0; a < o; a++) { const u = pedge[a]; ecap[u] -= mn; ecap[u ^ 1] += mn; }
        o = ci; continue;
      }
      let adv = false;
      while (it[x] !== -1) {
        const i = it[x], c = eto[i];
        if (ecap[i] > 0 && level[c] === level[x] + 1) { pedge[o] = i; o++; pnode[o] = c; adv = true; break; }
        it[x] = enext[i];
      }
      if (!adv) { level[x] = -1; o--; }
    }
  }
  const reach = new Uint8Array(N); let qh = 0, qt = 0; reach[s] = 1; queue[qt++] = s;
  while (qh < qt) {
    const r = queue[qh++];
    for (let i = head[r]; i !== -1; i = enext[i]) { const c = eto[i]; if (ecap[i] > 0 && !reach[c]) { reach[c] = 1; queue[qt++] = c; } }
  }
  return reach;
}

function expansion(labels, cost, L, offs, nb, w, scale, cycles) {   // Wg
  const t = labels.length, S = t, Tn = t + 1, N = t + 2, maxE = 2 * (2 * t + 4 * ((nb.length / 2) | 0) + 4);
  const eto = new Int32Array(maxE), ecap = new Float64Array(maxE), enext = new Int32Array(maxE), head = new Int32Array(N);
  const p = new Float64Array(t), m = new Float64Array(t); let cyc = 0;
  for (let b = 0; b < cycles; b++) {
    cyc = b + 1; let changed = false;
    for (let M = 0; M < L; M++) {
      head.fill(-1); let ne = 0; p.fill(0); m.fill(0);
      const edge = (aa, bb, cap) => {
        eto[ne] = bb; ecap[ne] = cap; enext[ne] = head[aa]; head[aa] = ne; ne++;
        eto[ne] = aa; ecap[ne] = 0.0; enext[ne] = head[bb]; head[bb] = ne; ne++;
      };
      for (let T = 0; T < t; T++) { p[T] += cost[T * L + labels[T]]; m[T] += cost[T * L + M]; }
      for (let T = 0; T < t; T++) {
        const E = labels[T];
        for (let I = offs[T]; I < offs[T + 1]; I++) {
          const Sx = nb[I]; if (Sx <= T) continue;
          const P = labels[Sx], v = w[I] * scale; if (v <= 0) continue;
          const R = E !== P ? v : 0.0, F = E !== M ? v : 0.0, k = M !== P ? v : 0.0;
          let Lz = F + k - R; if (Lz < -1e-9 || Lz < 0) Lz = 0.0;
          const z = Lz / 2, U = k - R - z;
          if (U >= 0) m[T] += U; else p[T] += -U;
          const Wv = F - R - z;
          if (Wv >= 0) m[Sx] += Wv; else p[Sx] += -Wv;
          if (z > 0) { edge(T, Sx, z); edge(Sx, T, z); }
        }
      }
      for (let T = 0; T < t; T++) { if (p[T] > 0) edge(S, T, p[T]); if (m[T] > 0) edge(T, Tn, m[T]); }
      const reach = maxflowReach(N, S, Tn, eto, ecap, enext, head);
      for (let T = 0; T < t; T++) if (reach[T] === 1 && labels[T] !== M) { labels[T] = M; changed = true; }
    }
    if (!changed) break;
  }
  return cyc;
}

function dataCost(faceLab, leafLab, leafCluster, L, reg, nreg, normArea) {
  const P = new Float64Array(nreg * L), v = new Float64Array(L), n = faceLab.length / 3;
  for (let B = 0; B < n; B++) {
    v.fill(Infinity);
    for (let i = 0; i < leafLab.length; i++) {
      const d = sq(faceLab[3 * B] - leafLab[i][0]) + sq(faceLab[3 * B + 1] - leafLab[i][1]) + sq(faceLab[3 * B + 2] - leafLab[i][2]);
      if (d < v[leafCluster[i]]) v[leafCluster[i]] = d;
    }
    const D = reg[B] * L;
    for (let V = 0; V < L; V++) P[D + V] += normArea[B] * v[V];
  }
  return P;
}

function mrfLabels(fill, tex, flipY, leafLab, leafCluster, L, log) {
  const t0 = performance.now(), el = () => ((performance.now() - t0) / 1000).toFixed(1) + 's';
  const s = sampleFaces(fill.uv, fill.pos, tex, flipY, false);
  const faceLab = Float64Array.from(s.faceLab), faceArea = s.faceArea, faceValid = s.faceValid;
  const T = cutTopology(fill.pos), { offs, nb, w } = faceAdjacency(T);
  log(`  CutFaceSample + CutFaceAdjacency: ${T.F} faces, ${T.V} vertices, ${nb.length / 2} adjacent pairs (${el()})`);
  const base = baseline(faceLab, leafLab, leafCluster);
  if (L <= 1 || MRF_LAMBDA <= 0) return { labels: base, base, T };
  const ma = faceArea.length ? npSum(faceArea) / faceArea.length : 0, b = ma > 0 ? 1 / ma : 1.0;
  const mw = w.length ? npSum(w) / w.length : 0, A = mw > 0 ? 1 / mw : 1.0;
  const scale = A * MRF_LAMBDA * MRF_LAMBDA;
  const { reg, n: nreg, init } = regionGraph(base, offs, nb);
  const { offs: ro, nb: rn, w: rw } = regionAdjacency(reg, nreg, offs, nb, w);
  // Zg: contrast-sensitive smoothness between regions
  const rl = new Float64Array(nreg * 3), rs = new Float64Array(nreg);
  for (let f = 0; f < T.F; f++) if (faceValid[f] === 1) {
    const r = reg[f]; for (let c = 0; c < 3; c++) rl[3 * r + c] += faceLab[3 * f + c] * faceArea[f]; rs[r] += faceArea[f];
  }
  for (let r = 0; r < nreg; r++) if (rs[r] > 0) for (let c = 0; c < 3; c++) rl[3 * r + c] /= rs[r];
  const numT = [], denT = [];
  for (let a = 0; a < T.F; a++) for (let m = offs[a]; m < offs[a + 1]; m++) {
    const c = nb[m]; if (!(faceValid[a] === 1 && faceValid[c] === 1)) continue;
    const d = sq(faceLab[3 * a] - faceLab[3 * c]) + sq(faceLab[3 * a + 1] - faceLab[3 * c + 1]) + sq(faceLab[3 * a + 2] - faceLab[3 * c + 2]);
    numT.push(d * w[m]); denT.push(w[m]);
  }
  const num = npSum(Float64Array.from(numT)), den = npSum(Float64Array.from(denT));
  const beta = 1 / (2 * Math.max(den > 0 ? num / den : 0, CONTRAST_MIN_VAR ** 2));
  const rw2 = new Float64Array(rw.length);
  for (let r = 0; r < nreg; r++) for (let m = ro[r]; m < ro[r + 1]; m++) {
    const q = rn[m], d = sq(rl[3 * r] - rl[3 * q]) + sq(rl[3 * r + 1] - rl[3 * q + 1]) + sq(rl[3 * r + 2] - rl[3 * q + 2]);
    rw2[m] = rw[m] * (CONTRAST_FLOOR + (1 - CONTRAST_FLOOR) * Math.exp(-beta * d));
  }
  const normArea = Float64Array.from(faceArea, (x) => x * b);
  const cost = dataCost(faceLab, leafLab, leafCluster, L, reg, nreg, normArea);
  const lab = init.slice();
  const it1 = icm(lab, cost, L, ro, rn, rw2, scale, ICM_ITERS), it2 = expansion(lab, cost, L, ro, rn, rw2, scale, EXPANSION_CYCLES);
  const out = new Int32Array(T.F); let changed = 0;
  for (let f = 0; f < T.F; f++) { out[f] = lab[reg[f]]; if (out[f] !== base[f]) changed++; }
  log(`  RegionGraph + MrfSolve: ${nreg} regions, ${it1} ICM sweeps + ${it2} expansion cycles, ${changed} faces relabelled (${el()})`);
  return { labels: out, base, T };
}

// ======================================================================================
// Surface projector (closest point on the original triangles, uniform grid)
// ======================================================================================
export function buildSurfaceGrid(triWorld) {
  const n = triWorld.length / 9, T = Float64Array.from(triWorld);
  const lo = new Float64Array(3 * n), hi = new Float64Array(3 * n), bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
  const elen = new Float64Array(n);
  for (let t = 0; t < n; t++) {
    for (let c = 0; c < 3; c++) {
      const a = T[9 * t + c], b = T[9 * t + 3 + c], d = T[9 * t + 6 + c];
      lo[3 * t + c] = Math.min(a, b, d); hi[3 * t + c] = Math.max(a, b, d);
      if (lo[3 * t + c] < bmin[c]) bmin[c] = lo[3 * t + c]; if (hi[3 * t + c] > bmax[c]) bmax[c] = hi[3 * t + c];
    }
    elen[t] = norm3(T[9 * t + 3] - T[9 * t], T[9 * t + 4] - T[9 * t + 1], T[9 * t + 5] - T[9 * t + 2]);
  }
  const el = npSum(elen) / n, ext = Math.max(bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2]);
  const h = Math.max(2 * el, ext / 400, 1e-12);
  const dims = [0, 1, 2].map((c) => Math.max(1, Math.ceil((bmax[c] - bmin[c]) / h)));
  const ncell = dims[0] * dims[1] * dims[2], c0 = new Int32Array(3 * n), c1 = new Int32Array(3 * n), cnt = new Int32Array(ncell + 1);
  for (let t = 0; t < n; t++) {
    for (let c = 0; c < 3; c++) {
      c0[3 * t + c] = Math.min(Math.max(Math.trunc((lo[3 * t + c] - bmin[c]) / h), 0), dims[c] - 1);
      c1[3 * t + c] = Math.min(Math.max(Math.trunc((hi[3 * t + c] - bmin[c]) / h), 0), dims[c] - 1);
    }
    for (let z = c0[3 * t + 2]; z <= c1[3 * t + 2]; z++) for (let y = c0[3 * t + 1]; y <= c1[3 * t + 1]; y++) for (let x = c0[3 * t]; x <= c1[3 * t]; x++) cnt[(z * dims[1] + y) * dims[0] + x + 1]++;
  }
  for (let i = 0; i < ncell; i++) cnt[i + 1] += cnt[i];
  const offs = cnt, fill = cnt.slice(0, ncell), ctri = new Int32Array(offs[ncell]);
  for (let t = 0; t < n; t++) for (let z = c0[3 * t + 2]; z <= c1[3 * t + 2]; z++) for (let y = c0[3 * t + 1]; y <= c1[3 * t + 1]; y++) for (let x = c0[3 * t]; x <= c1[3 * t]; x++) ctri[fill[(z * dims[1] + y) * dims[0] + x]++] = t;
  return { T, bmin, h, dims, offs, ctri, lo, hi };
}

const CP = new Float64Array(4);
function closestOnTri(px, py, pz, T, f) {   // Ericson; CP = [d2, qx, qy, qz]
  const k = 9 * f, ax = T[k], ay = T[k + 1], az = T[k + 2], bx = T[k + 3], by = T[k + 4], bz = T[k + 5], cx = T[k + 6], cy = T[k + 7], cz = T[k + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az, apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let qx, qy, qz;
  if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; }
  else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { qx = bx; qy = by; qz = bz; }
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 !== d3 ? d1 / (d1 - d3) : 0.0; qx = ax + v * abx; qy = ay + v * aby; qz = az + v * abz; }
      else {
        const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { qx = cx; qy = cy; qz = cz; }
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 !== d6 ? d2 / (d2 - d6) : 0.0; qx = ax + w * acx; qy = ay + w * acy; qz = az + w * acz; }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
              const den2 = (d4 - d3) + (d5 - d6), w = den2 !== 0 ? (d4 - d3) / den2 : 0.0;
              qx = bx + w * (cx - bx); qy = by + w * (cy - by); qz = bz + w * (cz - bz);
            } else {
              const den = va + vb + vc;
              if (den === 0) { qx = ax; qy = ay; qz = az; }
              else { const v = vb / den, w = vc / den; qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w; }
            }
          }
        }
      }
    }
  }
  CP[0] = (px - qx) ** 2 + (py - qy) ** 2 + (pz - qz) ** 2; CP[1] = qx; CP[2] = qy; CP[3] = qz;
}

/** closest point on the grid's triangles for every point (in place); hint[ids[q]] = last hit triangle */
export function projectBatch(pts, ids, hint, G) {
  const { T, bmin, h, dims, offs, ctri, lo, hi } = G, rmax = Math.max(dims[0], dims[1], dims[2]);
  for (let q = 0; q < ids.length; q++) {
    const px = pts[3 * q], py = pts[3 * q + 1], pz = pts[3 * q + 2], hv = hint[ids[q]];
    let best = Infinity, bx = px, by = py, bz = pz, bt = -1;
    if (hv >= 0) { closestOnTri(px, py, pz, T, hv); best = CP[0]; bx = CP[1]; by = CP[2]; bz = CP[3]; bt = hv; }
    const ix = Math.min(Math.max(Math.trunc((px - bmin[0]) / h), 0), dims[0] - 1), iy = Math.min(Math.max(Math.trunc((py - bmin[1]) / h), 0), dims[1] - 1);
    const iz = Math.min(Math.max(Math.trunc((pz - bmin[2]) / h), 0), dims[2] - 1);
    for (let r = 0; r <= rmax; r++) {
      if (r >= 1 && best <= ((r - 1) * h) ** 2) break;
      for (let zz = iz - r; zz <= iz + r; zz++) {
        if (zz < 0 || zz >= dims[2]) continue;
        for (let yy = iy - r; yy <= iy + r; yy++) {
          if (yy < 0 || yy >= dims[1]) continue;
          for (let xx = ix - r; xx <= ix + r; xx++) {
            if (xx < 0 || xx >= dims[0]) continue;
            if (Math.max(Math.abs(xx - ix), Math.abs(yy - iy), Math.abs(zz - iz)) !== r) continue;
            const c = (zz * dims[1] + yy) * dims[0] + xx;
            for (let k = offs[c]; k < offs[c + 1]; k++) {
              const f = ctri[k], f3 = 3 * f;
              // exact prune: the closest point lies inside the triangle's box (margin covers rounding)
              const ex = Math.max(lo[f3] - px, px - hi[f3], 0), ey = Math.max(lo[f3 + 1] - py, py - hi[f3 + 1], 0), ez = Math.max(lo[f3 + 2] - pz, pz - hi[f3 + 2], 0);
              if (ex * ex + ey * ey + ez * ez > best * (1 + 1e-6) + 1e-30) continue;
              closestOnTri(px, py, pz, T, f);
              if (CP[0] < best) { best = CP[0]; bx = CP[1]; by = CP[2]; bz = CP[3]; bt = f; }
            }
          }
        }
      }
    }
    if (bt >= 0) { pts[3 * q] = bx; pts[3 * q + 1] = by; pts[3 * q + 2] = bz; hint[ids[q]] = bt; }
  }
}

// ======================================================================================
// Fairing (gp/yp: hp prep, up Taubin, fp band, Tu normal guard)
// ======================================================================================
const FN = new Float64Array(3);
function faceNormal(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const l = bx - ax, f = by - ay, hh = bz - az, d = cx - ax, y = cy - ay, g = cz - az;
  const p = f * g - hh * y, m = hh * d - l * g, x = l * y - f * d, w = Math.sqrt(p * p + m * m + x * x);
  if (w === 0) return false;
  FN[0] = p / w; FN[1] = m / w; FN[2] = x / w; return true;
}

function guardOk(t, x, y, z, px, py, pz, tri, vfo, vff, triN, cosmax) {   // Mu
  for (let k = vfo[t]; k < vfo[t + 1]; k++) {
    const b = vff[k];
    if (triN[3 * b] === 0 && triN[3 * b + 1] === 0 && triN[3 * b + 2] === 0) continue;
    const E = tri[3 * b], F = tri[3 * b + 1], I = tri[3 * b + 2];
    const ok = faceNormal(E === t ? x : px[E], E === t ? y : py[E], E === t ? z : pz[E], F === t ? x : px[F], F === t ? y : py[F], F === t ? z : pz[F],
      I === t ? x : px[I], I === t ? y : py[I], I === t ? z : pz[I]);
    if (!ok || FN[0] * triN[3 * b] + FN[1] * triN[3 * b + 1] + FN[2] * triN[3 * b + 2] < cosmax) return false;
  }
  return true;
}

function guardedMove(t, x, y, z, px, py, pz, tri, vfo, vff, triN, cosmax, stats) {   // Tu
  if (guardOk(t, x, y, z, px, py, pz, tri, vfo, vff, triN, cosmax)) { px[t] = x; py[t] = y; pz[t] = z; return; }
  stats[0]++;
  const l = px[t], f = py[t], h = pz[t]; let d = 0.0, yy = 1.0;
  for (let g = 0; g < GUARD_BISECT; g++) {
    const p = (d + yy) * 0.5;
    if (guardOk(t, l + (x - l) * p, f + (y - f) * p, h + (z - h) * p, px, py, pz, tri, vfo, vff, triN, cosmax)) d = p; else yy = p;
  }
  if (d <= 0) { stats[1]++; return; }
  px[t] = l + (x - l) * d; py[t] = f + (y - f) * d; pz[t] = h + (z - h) * d;
}

function fairPrep(T, labels) {   // hp
  const { F, V, tri, vpos, edgeVerts: ev, edgeOffs: eoff, edgeFaces: ef } = T;
  const n0 = new Int32Array(V), n1 = new Int32Array(V), cnt = new Int32Array(V), pinned = new Uint8Array(V); let nb = 0;
  for (let A = 0; A < ev.length / 2; A++) {
    const M = ev[2 * A], C = ev[2 * A + 1], T0 = eoff[A], E1 = eoff[A + 1];
    if (E1 - T0 < 2) { pinned[M] = 1; pinned[C] = 1; continue; }
    let diff = false; const I = labels[ef[T0]];
    for (let S = T0 + 1; S < E1; S++) if (labels[ef[S]] !== I) { diff = true; break; }
    if (diff) {
      nb++;
      for (const [o, s] of [[M, C], [C, M]]) {
        const r = cnt[o];
        if (r === 0) { n0[o] = s; cnt[o] = 1; }
        else if (r === 1) { if (n0[o] !== s) { n1[o] = s; cnt[o] = 2; } }
        else if (n0[o] !== s && n1[o] !== s && r < 255) cnt[o] = r + 1;
      }
    }
  }
  const mv = []; for (let A = 0; A < V; A++) if (cnt[A] !== 0 && pinned[A] === 0 && cnt[A] === 2) mv.push(A);
  const triN = new Float64Array(3 * F);
  for (let A = 0; A < F; A++) {
    const C = tri[3 * A], T_ = tri[3 * A + 1], E = tri[3 * A + 2];
    if (C === T_ || T_ === E || C === E) continue;
    if (faceNormal(vpos[3 * C], vpos[3 * C + 1], vpos[3 * C + 2], vpos[3 * T_], vpos[3 * T_ + 1], vpos[3 * T_ + 2], vpos[3 * E], vpos[3 * E + 1], vpos[3 * E + 2])) {
      triN[3 * A] = FN[0]; triN[3 * A + 1] = FN[1]; triN[3 * A + 2] = FN[2];
    }
  }
  return { n0, n1, cnt, pinned, mv: Int32Array.from(mv), triN, nb };
}

function bandVertices(movable, V, tri, vfo, vff, pinned, cnt, rings) {
  const F = new Int32Array(V).fill(-1), band = []; let cur = [];
  for (const D of movable) if (F[D] === -1) { F[D] = 0; cur.push(D); }
  for (let B = 1; B <= rings; B++) {
    const nxt = [];
    for (const V_ of cur) for (let H = vfo[V_]; H < vfo[V_ + 1]; H++) {
      const Z = vff[H];
      for (let G = 0; G < 3; G++) {
        const K = tri[3 * Z + G]; if (K === V_ || F[K] !== -1) continue;
        if (pinned[K] === 1 || cnt[K] > 0) { F[K] = -2; continue; }
        F[K] = B; band.push(K); nxt.push(K);
      }
    }
    cur = nxt;
  }
  return Int32Array.from(band.filter((D) => vfo[D + 1] > vfo[D]));
}

function fairing(T, labels, triWorld, log, progress) {
  const t0 = performance.now(), el = () => ((performance.now() - t0) / 1000).toFixed(1) + 's';
  const { n0, n1, cnt, pinned, mv, triN, nb: nbe } = fairPrep(T, labels);
  const V = T.V, px = new Float64Array(V), py = new Float64Array(V), pz = new Float64Array(V);
  for (let i = 0; i < V; i++) { px[i] = T.vpos[3 * i]; py[i] = T.vpos[3 * i + 1]; pz[i] = T.vpos[3 * i + 2]; }
  const done = () => { const out = new Float64Array(3 * V); for (let i = 0; i < V; i++) { out[3 * i] = px[i]; out[3 * i + 1] = py[i]; out[3 * i + 2] = pz[i]; } return out; };
  if (!mv.length) return { vpos: done(), stats: { movable: 0, band: 0 } };
  const grid = buildSurfaceGrid(triWorld), hint = new Int32Array(V).fill(-1), { tri, vfOffs: vfo, vfFaces: vff } = T;
  const stats = [0, 0], buf = new Float64Array(3 * mv.length);
  const cosT = Math.cos(FOLD_GUARD_DEG * Math.PI / 180), cosB = Math.cos(BAND_GUARD_DEG * Math.PI / 180);
  const apply = (ids, b, cosmax) => { for (let k = 0; k < ids.length; k++) guardedMove(ids[k], b[3 * k], b[3 * k + 1], b[3 * k + 2], px, py, pz, tri, vfo, vff, triN, cosmax, stats); };
  for (let it = 0; it < FAIR_ITERS; it++) {
    for (const S of [TAUBIN_LAMBDA, TAUBIN_MU]) {
      const sx = px.slice(), sy = py.slice(), sz = pz.slice();
      for (let k = 0; k < mv.length; k++) {
        const L = mv[k], z = n0[L], U = n1[L];
        buf[3 * k] = sx[L] + S * (0.5 * (sx[z] + sx[U]) - sx[L]);
        buf[3 * k + 1] = sy[L] + S * (0.5 * (sy[z] + sy[U]) - sy[L]);
        buf[3 * k + 2] = sz[L] + S * (0.5 * (sz[z] + sz[U]) - sz[L]);
      }
      projectBatch(buf, mv, hint, grid);
      apply(mv, buf, cosT);
    }
    progress && progress((it + 1) / (FAIR_ITERS + BAND_ITERS));
  }
  let moved = 0; for (const i of mv) moved += Math.sqrt((px[i] - T.vpos[3 * i]) ** 2 + (py[i] - T.vpos[3 * i + 1]) ** 2 + (pz[i] - T.vpos[3 * i + 2]) ** 2);
  const U = bandVertices(mv, V, tri, vfo, vff, pinned, cnt, BAND_RINGS), bbuf = new Float64Array(3 * U.length);
  for (let it = 0; it < BAND_ITERS; it++) {
    if (!U.length) break;
    const sx = px.slice(), sy = py.slice(), sz = pz.slice();
    for (let q = 0; q < U.length; q++) {
      const H = U[q]; let Z = 0.0, G = 0.0, K = 0.0, st = 0;
      for (let k = vfo[H]; k < vfo[H + 1]; k++) { const f = vff[k]; for (let j = 0; j < 3; j++) { const v = tri[3 * f + j]; if (v !== H) { Z += sx[v]; G += sy[v]; K += sz[v]; st++; } } }
      bbuf[3 * q] = Z / st; bbuf[3 * q + 1] = G / st; bbuf[3 * q + 2] = K / st;
    }
    projectBatch(bbuf, U, hint, grid);
    apply(U, bbuf, cosB);
    progress && progress((FAIR_ITERS + it + 1) / (FAIR_ITERS + BAND_ITERS));
  }
  log(`  Fairing: ${nbe} border edges, ${mv.length} border vertices moved (sum ${moved.toPrecision(4)}), ${U.length} band vertices, ${stats[0]} guard-damped / ${stats[1]} pinned moves (${el()})`);
  return { vpos: done(), stats: { movable: mv.length, band: U.length, damped: stats[0], pinned: stats[1] } };
}

// ======================================================================================
// Weld (sd/Ja/fi), optional hole closing (rd/zh)
// ======================================================================================
/** worker $a(): for every undirected edge, |#forward - #backward| directed half-edges are left unpaired */
function directedOpenEdges(tri) {
  const nf = tri.length / 3; let vmax = 0;
  for (let i = 0; i < tri.length; i++) if (tri[i] > vmax) vmax = tri[i];
  const M = vmax + 1, emap = new KeyIndex(2 * nf), cap = 3 * nf;
  const ek = new Float64Array(cap), elo = new Int32Array(cap), ehi = new Int32Array(cap), cf = new Int32Array(cap), cb = new Int32Array(cap);
  const ff = new Int32Array(cap).fill(-1), fb = new Int32Array(cap).fill(-1);
  for (let f = 0; f < nf; f++) {
    const t0 = tri[3 * f], t1 = tri[3 * f + 1], t2 = tri[3 * f + 2]; if (t0 === t1 || t1 === t2 || t0 === t2) continue;
    for (let j = 0; j < 3; j++) {
      const a = j === 0 ? t0 : (j === 1 ? t1 : t2), b = j === 0 ? t1 : (j === 1 ? t2 : t0);
      const lo = a < b ? a : b, hi = a < b ? b : a, key = lo * M + hi, r = emap.id(key);
      if (r === emap.size - 1 && cf[r] === 0 && cb[r] === 0) { ek[r] = key; elo[r] = lo; ehi[r] = hi; }
      if (a < b) { cf[r]++; if (ff[r] < 0) ff[r] = f; } else { cb[r]++; if (fb[r] < 0) fb[r] = f; }
    }
  }
  const bad = [];
  for (let r = 0; r < emap.size; r++) if (cf[r] !== cb[r]) bad.push(r);
  bad.sort((x, y) => ek[x] - ek[y]);
  let total = 0; const left = [];
  for (const r of bad) {
    const d = Math.abs(cf[r] - cb[r]); total += d;
    const e = cf[r] > cb[r] ? [elo[r], ehi[r], ff[r]] : [ehi[r], elo[r], fb[r]];   // one object, repeated (Python list * k)
    for (let k = 0; k < d; k++) left.push(e);
  }
  return { nopen: total, left };
}

function weld(tri, vpos, labels, closeHoles) {
  const nF = tri.length / 3; let degenerate = 0;
  // group faces by sorted vertex triple (open addressing, groups numbered in order of first appearance)
  let cap = 1; while (cap < 2 * nF + 2) cap <<= 1;
  const slot = new Int32Array(cap).fill(-1), gkey = new Int32Array(3 * nF), grp = new Int32Array(nF).fill(-1), sgn = new Int8Array(nF);
  let ng = 0;
  for (let f = 0; f < nF; f++) {
    const a = tri[3 * f], b = tri[3 * f + 1], c = tri[3 * f + 2];
    if (a === b || b === c || a === c) { degenerate++; continue; }
    let x = a, y = b, z = c, t;
    if (x > y) { t = x; x = y; y = t; } if (y > z) { t = y; y = z; z = t; } if (x > y) { t = x; x = y; y = t; }
    sgn[f] = ((a > b) + (a > c) + (b > c)) % 2 === 0 ? 1 : -1;
    let h = (Math.imul(x, 0x9E3779B1) ^ Math.imul(y + 0x7F4A7C15, 0x85EBCA77) ^ Math.imul(z + 0x165667B1, 0xC2B2AE3D)) >>> 0;
    h = (h ^ (h >>> 16)) & (cap - 1);
    for (;;) {
      const g = slot[h];
      if (g < 0) { slot[h] = ng; gkey[3 * ng] = x; gkey[3 * ng + 1] = y; gkey[3 * ng + 2] = z; grp[f] = ng++; break; }
      if (gkey[3 * g] === x && gkey[3 * g + 1] === y && gkey[3 * g + 2] === z) { grp[f] = g; break; }
      h = (h + 1) & (cap - 1);
    }
  }
  const np = new Int32Array(ng), nn = new Int32Array(ng);
  for (let f = 0; f < nF; f++) if (grp[f] >= 0) { if (sgn[f] > 0) np[grp[f]]++; else nn[grp[f]]++; }
  // keep the first |#pos - #neg| faces of the majority orientation; order: group rank, then face index
  const goff = new Int32Array(ng + 1), tp = new Int32Array(ng), tn = new Int32Array(ng), sel = new Uint8Array(nF);
  for (let f = 0; f < nF; f++) {
    const g = grp[f]; if (g < 0) continue;
    if (sgn[f] > 0) { if (tp[g] < np[g] - nn[g]) { tp[g]++; sel[f] = 1; goff[g + 1]++; } }
    else if (tn[g] < nn[g] - np[g]) { tn[g]++; sel[f] = 1; goff[g + 1]++; }
  }
  for (let g = 0; g < ng; g++) goff[g + 1] += goff[g];
  const fs = new Int32Array(goff[ng]), fill = goff.slice(0, ng);
  for (let f = 0; f < nF; f++) if (sel[f]) fs[fill[grp[f]]++] = f;
  const Tl = [], lab = [];
  for (const f of fs) { Tl.push(tri[3 * f], tri[3 * f + 1], tri[3 * f + 2]); lab.push(labels[f]); }
  let P = Float32Array.from(vpos);
  const stats = { input: nF, degenerate, duplicates: nF - degenerate - fs.length };
  if (closeHoles) {
    const { nopen, left } = directedOpenEdges(Tl);
    if (nopen) {
      const bySrc = new Map();
      for (const e of left) { if (!bySrc.has(e[0])) bySrc.set(e[0], []); bySrc.get(e[0]).push(e); }
      const used = new Set(), loops = [];
      for (const e of left) {
        if (used.has(e)) continue;
        const loop = []; let m = e;
        while (m && !used.has(m)) {
          used.add(m); loop.push(m); let nxt = null;
          for (const w of bySrc.get(m[1]) || []) if (!used.has(w)) { nxt = w; break; }
          m = nxt;
        }
        if (loop.length >= 3) loops.push(loop);
      }
      const addP = [];
      for (const loop of loops) {
        const c = [0, 0, 0]; for (const e of loop) for (let k = 0; k < 3; k++) c[k] += P[3 * e[0] + k];
        const ci = P.length / 3 + addP.length / 3; addP.push(...c.map((v) => v / loop.length));
        for (const [s, t, face] of loop) { Tl.push(t, s, ci); lab.push(lab[face >= 0 ? face : 0]); }
      }
      if (addP.length) { const Q = new Float32Array(P.length + addP.length); Q.set(P); Q.set(addP, P.length); P = Q; }
      stats.openEdgesBefore = nopen; stats.holesClosed = loops.length;
    }
  }
  return { P, T: Int32Array.from(Tl), lab: Int32Array.from(lab), stats };
}

// ======================================================================================
// driver
// ======================================================================================
/** triUV/triWorld: Float32Array from glb.js; tex = { width, height, data: RGB }; analysis: leafLab, leafWeight, merges,
 *  jndMergeCount, leafIndexMap, width, height (from quantize.analyze or readCQA1). */
export function commit(triUV, triWorld, tex, analysis, K, flipY = false, log = () => {}, progress = () => {}) {
  const t0 = performance.now(), el = () => ((performance.now() - t0) / 1000).toFixed(1) + 's';
  const A = analysis, W = A.width, H = A.height;
  const maxK = A.leafLab.length - A.jndMergeCount; K = Math.min(Math.max(K | 0, 1), maxK);
  const cut = cutLevel(A.leafLab, A.leafWeight, A.merges, A.jndMergeCount, K);
  const l2c = new Uint8Array(256); cut.leafToCluster.forEach((c, i) => { l2c[i] = c; }); l2c[255] = UNCOVERED;
  const idx = new Uint8Array(W * H); for (let q = 0; q < idx.length; q++) idx[q] = l2c[A.leafIndexMap[q]];
  log(`ApplyCut: K=${K} ` + cut.clusters.map((c) => c.hex).join(' '));
  progress('Tracing color borders', 0.02);
  const { rid, n: nreg } = regionMap(idx, W, H);
  const arcs = boundaryNetwork(rid, W, H);
  log(`RegionMap: ${nreg} regions; BoundaryNetwork: ${arcs.length} arcs, ${arcs.reduce((s, a) => s + a.points.length / 2, 0)} points (${el()})`);
  progress('Cutting faces', 0.15);
  const ix = buildUVIndex(triUV, triWorld);
  log(`FaceCut (${ix.V} welded vertices):`);
  const fill = faceCut(arcs, ix, idx, cut.K, W, H, flipY, log);
  log('MRF:');
  progress('Labelling (MRF)', 0.45);
  const { labels, T } = mrfLabels(fill, tex, flipY, A.leafLab, cut.leafToCluster, cut.K, log);
  progress('Fairing borders', 0.6);
  const { vpos, stats: fst } = fairing(T, labels, ix.triWorld, log, (f) => progress('Fairing borders', 0.6 + 0.35 * f));
  const closed = directedOpenEdges(ix.vid).nopen === 0;
  const { P, T: Tr, lab, stats: wst } = weld(T.tri, vpos, labels, closed);
  log(`Weld: ${wst.input} -> ${Tr.length / 3} triangles (${wst.degenerate} degenerate, ${wst.duplicates} duplicate dropped` +
    (closed ? `, source closed: ${wst.openEdgesBefore || 0} open half-edges, ${wst.holesClosed || 0} holes closed` : ', source open') + `) (${el()})`);
  return { P, T: Tr, lab, palette: cut.clusters, K, cutStats: fill.stats, fairStats: fst, weldStats: wst };
}
