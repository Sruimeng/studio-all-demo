/* ============================================================
 * worker.js — 分色计算 Worker
 * 消息：init / palette / label / lowpoly / paintHigh / paintLow / export3mf / exportGLB / selftest
 * ============================================================ */
/* global MC, MCMesh, MCDecimate, MCLow, MCExport, MCRefine */
importScripts("./color.js", "./palette.js", "./mesh.js", "./decimate.js", "./lowpoly.js", "./export3mf.js", "./refinement.js");

const S = {}; // 全部状态

let active = null;
let projectId = null;
let editRevision = -1;
let sequence = Promise.resolve();
let captured = null;
const post = (type, data, transfer) => {
  if (captured) { if (type !== "progress") captured.push({ type, ...data }); return; }
  self.postMessage({ ...data, type, projectId: active.projectId, requestId: active.requestId, editRevision: active.editRevision }, transfer || []);
};
const progress = (reqId) => (p, text) => post("progress", { reqId, p, text });

const PREC = { // 精细程度 1..6
  minArea: [6, 3, 1.5, 0.8, 0.4, 0.15],   // mm²，小于该面积的色块并入邻色
  smooth:  [3, 2, 2, 1, 1, 0],
  maxDepth: [1, 2, 3, 4, 5, 6],
  minEdge: [1.6, 1.2, 0.9, 0.65, 0.45, 0.35], // mm
  purity:  [0.75, 0.8, 0.86, 0.9, 0.93, 0.96],
  mapPass: [3, 2, 2, 1, 1, 0],
  denoise: [5, 4, 3, 3, 2, 1],                // 保边平滑迭代次数
  lambda: [0.014, 0.01, 0.007, 0.005, 0.003, 0.0015], // 邻域一致性权重（OKLab²）
};
const SIGMA2 = 0.07 * 0.07; // 保边平滑的颜色尺度
// BaseColor maps can contain baked highlights; keep luminance secondary to hue/chroma.
const COLOR_LIGHTNESS_WEIGHT = 0.25;

async function decodeImage(blob, max) {
  const bmp = await createImageBitmap(blob);
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
  const cv = new OffscreenCanvas(w, h);
  const cx = cv.getContext("2d");
  cx.drawImage(bmp, 0, 0, w, h);
  const data = cx.getImageData(0, 0, w, h).data;
  bmp.close && bmp.close();
  return { w, h, data };
}
function texKeys(tex, factor) {
  const N = tex.w * tex.h;
  const keys = new Uint32Array(N);
  const d = tex.data;
  const lutC = factor && factor.some((f) => Math.abs(f - 1) > 1e-3)
    ? factor.map((f) => { const t = new Uint8Array(256); for (let i = 0; i < 256; i += 1) t[i] = Math.round(MC.linearToSrgb(MC.S2L[i] * f) * 255); return t; })
    : null;
  for (let i = 0; i < N; i += 1) {
    let r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    if (lutC) { r = lutC[0][r]; g = lutC[1][g]; b = lutC[2][b]; }
    keys[i] = MC.cellKey(r, g, b);
  }
  return keys;
}

// ---------------- init ----------------
async function init(m, reqId) {
  validateMesh(m);
  const pr = progress(reqId);
  Object.keys(S).forEach((k) => delete S[k]);
  const { positions, indices, uvs, colors, vertexFactors, faceMat, partOfVertex } = m;
  const materials = m.materials.map(mt => ({ ...mt, factor: mt.factor.slice() }));
  const images = m.images.slice();
  const occupied = new Set();
  for (const mt of materials) {
    if (mt.image < 0) continue;
    if (occupied.has(mt.image)) { images.push(images[mt.image]); mt.image = images.length - 1; }
    occupied.add(mt.image);
  }
  const nv = positions.length / 3, nf = indices.length / 3;
  Object.assign(S, { positions, indices, uvs, colors, faceMat, materials, nv, nf, warnings: [], geometryKey: geometryKey(positions, indices) });
  S.refineInput = m;
  pr(0.02, "焊接顶点");
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < nv; i += 1) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  S.bbox = { minX, minY, minZ, maxX, maxY, maxZ, diag };
  const w = MCMesh.weld(positions, diag * 1e-6);
  S.wid = w.wid; S.wpos = w.wpos; S.nw = w.nw;
  S.widx = new Uint32Array(nf * 3);
  for (let i = 0; i < nf * 3; i += 1) S.widx[i] = w.wid[indices[i]];
  pr(0.12, "建立邻接");
  S.twin = MCMesh.halfEdgeTwins(S.widx, nf);
  let open = 0;
  for (let h = 0; h < nf * 3; h += 1) if (S.twin[h] < 0) open += 1;
  pr(0.22, "解码贴图");
  S.tex = [];
  for (let i = 0; i < images.length; i += 1) {
    if (!images[i]) { S.tex.push(null); continue; }
    try {
      const t = await decodeImage(images[i], 4096);
      S.tex.push(t);
    } catch (e) { S.tex.push(null); S.warnings.push(`Texture ${i} could not be decoded.`); }
  }
  // 材质 → 用于量化的贴图键（低模标签图用 ≤2048）
  S.matImage = materials.map((mt) => (mt.image >= 0 && S.tex[mt.image] && uvs && !mt.vertexColors ? mt.image : -1));
  if (materials.some(mt => mt.image >= 0 && mt.vertexColors)) S.warnings.push("Texture with vertex-color modulation uses surface projection. Use Surface mode to paint those regions.");
  S.mapTex = [];
  for (let i = 0; i < S.tex.length; i += 1) {
    const t = S.tex[i];
    if (!t) { S.mapTex.push(null); continue; }
    const mat = materials.find((mt) => mt.image === i);
    let mt = t;
    if (Math.max(t.w, t.h) > 2048) mt = await decodeImage(images[i], 2048);
    S.mapTex.push({ w: mt.w, h: mt.h, keys: texKeys(mt, mat && mat.factor) });
  }
  pr(0.3, "采样面颜色");
  // 每面 4 个采样键 + 面积
  const fkeys = new Uint32Array(nf * 4);
  const area = new Float32Array(nf);
  const hist = new Float64Array(MC.CELLS);
  const wts = [[2 / 3, 1 / 6, 1 / 6], [1 / 6, 2 / 3, 1 / 6], [1 / 6, 1 / 6, 2 / 3], [1 / 3, 1 / 3, 1 / 3]];
  const matLut = materials.map((mt) => (mt.factor && mt.factor.some((f) => Math.abs(f - 1) > 1e-3)
    ? mt.factor.map((f) => { const t = new Uint8Array(256); for (let i = 0; i < 256; i += 1) t[i] = Math.round(MC.linearToSrgb(MC.S2L[i] * f) * 255); return t; })
    : null));
  const matConst = materials.map((mt) => MC.cellKey(...mt.factor.map((f) => Math.round(MC.linearToSrgb(f) * 255))));
  for (let f = 0; f < nf; f += 1) {
    const i0 = indices[f * 3], i1 = indices[f * 3 + 1], i2 = indices[f * 3 + 2];
    const ax = positions[i0 * 3], ay = positions[i0 * 3 + 1], az = positions[i0 * 3 + 2];
    const ux = positions[i1 * 3] - ax, uy = positions[i1 * 3 + 1] - ay, uz = positions[i1 * 3 + 2] - az;
    const vx = positions[i2 * 3] - ax, vy = positions[i2 * 3 + 1] - ay, vz = positions[i2 * 3 + 2] - az;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const A = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
    area[f] = A;
    const mi = faceMat[f];
    const mt = materials[mi];
    const img = mt.image >= 0 && S.tex[mt.image] && uvs ? mt.image : -1;
    for (let s = 0; s < 4; s += 1) {
      let key;
      if (img >= 0) {
        const t = S.tex[img];
        const wt = wts[s];
        let u = wt[0] * uvs[i0 * 2] + wt[1] * uvs[i1 * 2] + wt[2] * uvs[i2 * 2];
        let v = wt[0] * uvs[i0 * 2 + 1] + wt[1] * uvs[i1 * 2 + 1] + wt[2] * uvs[i2 * 2 + 1];
        u -= Math.floor(u); v -= Math.floor(v);
        const x = u * t.w - 0.5, y = v * t.h - 0.5;
        let x0 = Math.floor(x), y0 = Math.floor(y);
        const fx = x - x0, fy = y - y0;
        let x1 = x0 + 1, y1 = y0 + 1;
        x0 = (x0 + t.w) % t.w; x1 = x1 % t.w; y0 = (y0 + t.h) % t.h; y1 = y1 % t.h;
        const d = t.data;
        const p00 = (y0 * t.w + x0) * 4, p10 = (y0 * t.w + x1) * 4, p01 = (y1 * t.w + x0) * 4, p11 = (y1 * t.w + x1) * 4;
        const ch = (c) => (d[p00 + c] * (1 - fx) + d[p10 + c] * fx) * (1 - fy) + (d[p01 + c] * (1 - fx) + d[p11 + c] * fx) * fy;
        let r = Math.round(ch(0)), g = Math.round(ch(1)), b = Math.round(ch(2));
        const lc = matLut[mi];
        if (lc) { r = lc[0][r]; g = lc[1][g]; b = lc[2][b]; }
        if (mt.vertexColors && vertexFactors) {
          const factor = c => wt[0] * vertexFactors[i0 * 3 + c] + wt[1] * vertexFactors[i1 * 3 + c] + wt[2] * vertexFactors[i2 * 3 + c];
          r = Math.round(MC.linearToSrgb(MC.S2L[r] * factor(0)) * 255);
          g = Math.round(MC.linearToSrgb(MC.S2L[g] * factor(1)) * 255);
          b = Math.round(MC.linearToSrgb(MC.S2L[b] * factor(2)) * 255);
        }
        key = MC.cellKey(r, g, b);
      } else if (colors) {
        const wt = wts[s];
        const r = wt[0] * colors[i0 * 3] + wt[1] * colors[i1 * 3] + wt[2] * colors[i2 * 3];
        const g = wt[0] * colors[i0 * 3 + 1] + wt[1] * colors[i1 * 3 + 1] + wt[2] * colors[i2 * 3 + 1];
        const b = wt[0] * colors[i0 * 3 + 2] + wt[1] * colors[i1 * 3 + 2] + wt[2] * colors[i2 * 3 + 2];
        key = MC.cellKey(Math.round(r), Math.round(g), Math.round(b));
      } else key = matConst[mi];
      fkeys[f * 4 + s] = key;
      hist[key] += A / 4;
    }
    if ((f & 262143) === 0) pr(0.3 + 0.35 * f / nf, `采样面颜色 ${f.toLocaleString()}/${nf.toLocaleString()}`);
  }
  S.fkeys = fkeys; S.area = area; S.hist = hist;
  const cok = MC.cellOklab();
  const faceOk = new Float32Array(nf * 3);
  for (let f = 0; f < nf; f += 1) {
    let L = 0, A = 0, B = 0;
    for (let s = 0; s < 4; s += 1) { const k = fkeys[f * 4 + s] * 3; L += cok[k]; A += cok[k + 1]; B += cok[k + 2]; }
    faceOk[f * 3] = L / 4; faceOk[f * 3 + 1] = A / 4; faceOk[f * 3 + 2] = B / 4;
  }
  S.faceOk = faceOk;
  let totalArea = 0;
  for (let f = 0; f < nf; f += 1) totalArea += area[f];
  S.totalArea = totalArea;
  // 零件
  S.facePart = null;
  if (partOfVertex) {
    S.facePart = new Uint16Array(nf);
    for (let f = 0; f < nf; f += 1) S.facePart[f] = partOfVertex[indices[f * 3]];
    let np = 0;
    for (let f = 0; f < nf; f += 1) if (S.facePart[f] + 1 > np) np = S.facePart[f] + 1;
    S.nParts = np;
  }
  pr(0.68, "提取基础色");
  S.cache = {};
  getBase(0.5);
  pr(0.75, "构建拾取加速结构");
  const bvh = MCMesh.buildBVH(S.wpos, S.widx, nf);
  S.bvh = bvh;
  S.highPaint = new Int8Array(nf).fill(-1);
  S.undo = [];
  S.low = null;
  pr(1, "完成");
  // 体积（单位³）
  let vol = 0;
  for (let f = 0; f < nf; f += 1) {
    const a = S.widx[f * 3] * 3, b = S.widx[f * 3 + 1] * 3, c = S.widx[f * 3 + 2] * 3;
    const p = S.wpos;
    vol += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  S.volume = Math.abs(vol);
  const bvhOut = { bounds: bvh.bounds.slice(), info: bvh.info.slice(), order: bvh.order.slice() };
  post("init", {
    reqId, nf, nv, nw: S.nw, open, bbox: S.bbox, hasUv: !!uvs, hasColors: !!colors,
    textured: S.matImage.some((x) => x >= 0), nParts: S.nParts || 0,
    warnings: S.warnings, base: getBase(0.5).base.map((b) => ({ hex: b.hex, w: b.w })),
    wpos: S.wpos.slice(), widx: S.widx.slice(), bvh: bvhOut, volume: S.volume, totalArea, faceOk: faceOk.slice(),
  }, [bvhOut.bounds.buffer, bvhOut.info.buffer, bvhOut.order.buffer]);
}

function getBase(wL) {
  const k = String(wL);
  if (!S.cache[k]) S.cache[k] = { base: MC.baseClusters(S.hist, 24, wL), levels: {} };
  return S.cache[k];
}
function getLevels(wL, protect) {
  const c = getBase(wL);
  const k = String(!!protect);
  if (!c.levels[k]) c.levels[k] = MC.mergeTree(c.base, !!protect, wL);
  return c.levels[k];
}
// ---------------- palette ----------------
// m: {mode:'free'|'owned'|'plans', N, protect, cands:[{id,hex}], locked:[id], plans:[{key,cands:[{id,hex,penalty}]}]}
function palette(m, reqId) {
  const wL = COLOR_LIGHTNESS_WEIGHT;
  const levels = getLevels(wL, m.protect);
  const points = getBase(wL).base; // 细粒度点
  const K0 = points.length;
  const N = Math.max(1, Math.min(m.N, K0));
  const lvl = levels[N] || levels[K0];
  const res = { reqId, K0 };
  if (m.mode === "free") {
    res.slots = lvl.map((c) => ({ hex: c.hex, ok: c.ok, w: c.w, de: 0, filamentId: null }));
  } else {
    const run = (cands, n, locked) => {
      const cc = cands.map((c) => ({ id: c.id, hex: c.hex, lab: MC.hexToLab(c.hex), penalty: c.penalty || 0 }));
      const matchKL = 1;
      const r = MC.pam(points, cc, n, locked, matchKL);
      return MC.slotsFromPam(points, cc, r, locked, matchKL).map((s) => ({
        hex: s.cand.hex, ok: s.ok, w: s.w, de: s.de, filamentId: s.cand.id, sourceHex: MC.oklabToHex(s.ok[0], s.ok[1], s.ok[2]),
      }));
    };
    if (m.cands && m.cands.length) res.slots = run(m.cands, m.N, m.locked);
    if (m.plans) {
      res.plans = m.plans.map((p) => {
        const slots = run(p.cands, m.N, p.locked || []);
        const de = slots.reduce((s, x) => s + x.de * x.w, 0) / Math.max(1e-9, slots.reduce((s, x) => s + x.w, 0));
        return { key: p.key, slots, de };
      });
    }
  }
  // 误差曲线：每个颜色数下，“可见”基础簇（面积 ≥0.2%）到所属合并簇的最大 OKLab 距离
  const w2 = wL * wL;
  // 过渡色：落在两个更大色块连线上的小色块（边界抗锯齿 / 渐变），不计入
  const dist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 * w2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  const transitional = points.map((b, bi) => {
    if (b.w >= 0.03) return false;
    for (let i = 0; i < K0; i += 1) {
      const p = points[i];
      if (i === bi || p.w <= b.w) continue;
      for (let j = i + 1; j < K0; j += 1) {
        const q = points[j];
        if (j === bi || q.w <= b.w) continue;
        const d = [0, 1, 2].map((t) => q.ok[t] - p.ok[t]);
        const v = [0, 1, 2].map((t) => b.ok[t] - p.ok[t]);
        const wv = [w2, 1, 1];
        const dd = d[0] * d[0] * wv[0] + d[1] * d[1] + d[2] * d[2];
        if (dd <= 0) continue;
        const t = (v[0] * d[0] * wv[0] + v[1] * d[1] + v[2] * d[2]) / dd;
        if (t <= 0.05 || t >= 0.95) continue;
        const proj = [0, 1, 2].map((k) => p.ok[k] + d[k] * t);
        if (dist(b.ok, proj) < 0.025) return true;
      }
    }
    return false;
  });
  res.errCurve = [];
  for (let k = 1; k <= K0; k += 1) {
    const lv = levels[k];
    if (!lv) { res.errCurve[k] = null; continue; }
    let e = 0;
    lv.forEach((c) => c.members.forEach((bi) => {
      const b = points[bi];
      if (b.w < 0.002 || transitional[bi]) return;
      const dl = b.ok[0] - c.ok[0], da = b.ok[1] - c.ok[1], db = b.ok[2] - c.ok[2];
      e = Math.max(e, Math.sqrt(dl * dl * w2 + da * da + db * db));
    }));
    res.errCurve[k] = e;
  }
  post("palette", res);
}

// ---------------- 高模标签 ----------------
function makeLut(slotHex, wL) {
  const n = slotHex.length;
  const pal = new Float32Array(n * 3);
  slotHex.forEach((h, i) => { const o = MC.hexToOklab(h); pal[i * 3] = o[0]; pal[i * 3 + 1] = o[1]; pal[i * 3 + 2] = o[2]; });
  return MC.buildLut(pal, n, wL);
}
function slotOk(slotHex) {
  const P = new Float32Array(slotHex.length * 3);
  slotHex.forEach((h, i) => { const o = MC.hexToOklab(h); P[i * 3] = o[0]; P[i * 3 + 1] = o[1]; P[i * 3 + 2] = o[2]; });
  return P;
}
// 网格上的保边平滑：颜色相近的邻面互相平均，边界处权重迅速衰减
function denoiseFaces(F, iters, w2) {
  const nf = S.nf, twin = S.twin;
  let cur = F, nxt = new Float32Array(F.length);
  for (let it = 0; it < iters; it += 1) {
    for (let f = 0; f < nf; f += 1) {
      const o = f * 3;
      const L = cur[o], A = cur[o + 1], B = cur[o + 2];
      let sL = L, sA = A, sB = B, ws = 1;
      for (let e = 0; e < 3; e += 1) {
        const t = twin[o + e];
        if (t < 0) continue;
        const g = ((t / 3) | 0) * 3;
        const dl = cur[g] - L, da = cur[g + 1] - A, db = cur[g + 2] - B;
        const q = 1 / (1 + (dl * dl * w2 + da * da + db * db) / SIGMA2);
        const w = q * q;
        sL += cur[g] * w; sA += cur[g + 1] * w; sB += cur[g + 2] * w; ws += w;
      }
      nxt[o] = sL / ws; nxt[o + 1] = sA / ws; nxt[o + 2] = sB / ws;
    }
    const t = cur === F ? new Float32Array(F.length) : cur;
    cur = nxt; nxt = t;
  }
  return cur;
}
function labelHigh(m, reqId) {
  const pr = progress(reqId);
  const { slotHex, precision, scale, unifyParts } = m;
  const n = slotHex.length;           // 区域数（分区用的提取色）
  const regionMap = m.regionMap || slotHex.map((_, i) => i);
  const ns = m.slotCount || n;        // 耗材色槽数
  const nf = S.nf;
  const wL = COLOR_LIGHTNESS_WEIGHT, w2 = wL * wL;
  const p = Math.max(1, Math.min(6, precision)) - 1;
  const P = slotOk(slotHex);
  S.nSlots = n;
  pr(0.1, "保边平滑");
  const F = denoiseFaces(S.faceOk, PREC.denoise[p], w2);
  S.faceDen = F;
  pr(0.35, "匹配耗材");
  const lab = new Uint8Array(nf);
  const D = (o, l) => {
    const dl = F[o] - P[l * 3], da = F[o + 1] - P[l * 3 + 1], db = F[o + 2] - P[l * 3 + 2];
    return dl * dl * w2 + da * da + db * db;
  };
  for (let f = 0; f < nf; f += 1) {
    let best = 0, bd = Infinity;
    for (let l = 0; l < n; l += 1) { const d = D(f * 3, l); if (d < bd) { bd = d; best = l; } }
    lab[f] = best;
  }
  const twin = S.twin;
  if (unifyParts && S.facePart) {
    const acc = new Float64Array(S.nParts * n);
    for (let f = 0; f < nf; f += 1) acc[S.facePart[f] * n + lab[f]] += S.area[f];
    const pl = new Uint8Array(S.nParts);
    for (let q = 0; q < S.nParts; q += 1) {
      let best = 0, bv = -1;
      for (let l = 0; l < n; l += 1) if (acc[q * n + l] > bv) { bv = acc[q * n + l]; best = l; }
      pl[q] = best;
    }
    for (let f = 0; f < nf; f += 1) lab[f] = pl[S.facePart[f]];
  } else {
    pr(0.5, "邻域一致性");
    // ICM：数据项 = 与耗材的色差；平滑项 = 与颜色相近邻面不同标签的惩罚
    const lambda = PREC.lambda[p];
    const cand = new Int32Array(5);
    const nw = new Float32Array(3), nl = new Int32Array(3);
    for (let it = 0; it < 4; it += 1) {
      let changed = 0;
      for (let f = 0; f < nf; f += 1) {
        const o = f * 3;
        let nc = 0;
        for (let e = 0; e < 3; e += 1) {
          const t = twin[o + e];
          if (t < 0) { nl[e] = -1; continue; }
          const g = (t / 3) | 0, go = g * 3;
          const dl = F[go] - F[o], da = F[go + 1] - F[o + 1], db = F[go + 2] - F[o + 2];
          const q = 1 / (1 + (dl * dl * w2 + da * da + db * db) / SIGMA2);
          nw[e] = q * q; nl[e] = lab[g];
        }
        const cur = lab[f];
        cand[nc++] = cur;
        for (let e = 0; e < 3; e += 1) { const l = nl[e]; if (l >= 0 && l !== cur && (nc < 2 || cand[1] !== l) && (nc < 3 || cand[2] !== l)) cand[nc++] = l; }
        let best = cur, bc = Infinity;
        for (let k = 0; k < nc; k += 1) {
          const l = cand[k];
          let c = D(o, l);
          for (let e = 0; e < 3; e += 1) if (nl[e] >= 0 && nl[e] !== l) c += lambda * nw[e];
          if (c < bc) { bc = c; best = l; }
        }
        if (best !== cur) { lab[f] = best; changed += 1; }
      }
      if (changed < nf * 0.0005) break;
    }
    pr(0.7, "清理碎色块");
    const minA = PREC.minArea[p] / (scale * scale);
    for (let pass = 0; pass < 3; pass += 1) if (!removeIslands(lab, minA)) break;
  }
  // 区域 → 色槽
  S.regionLabel = lab.slice();
  for (let f = 0; f < nf; f += 1) lab[f] = regionMap[lab[f]];
  S.autoLabel = lab.slice();
  // 手工补色（按色槽下标）
  const hp = S.highPaint;
  for (let f = 0; f < nf; f += 1) if (hp[f] >= 0 && hp[f] < ns) lab[f] = hp[f];
  S.label = lab;
  S.nSlots = ns;
  pr(0.9, "统计");
  const stats = statsHigh(scale, ns);
  const out = lab.slice();
  post("label", { reqId, label: out, stats }, [out.buffer]);
}

function removeIslands(lab, minA) {
  const nf = S.nf, twin = S.twin, area = S.area;
  const comp = new Int32Array(nf).fill(-1);
  const queue = new Int32Array(nf);
  const smallStart = [], smallLen = [], smallArea = [];
  const members = new Int32Array(nf);
  let mcount = 0;
  let changed = false;
  let nc = 0;
  for (let s = 0; s < nf; s += 1) {
    if (comp[s] >= 0) continue;
    const L = lab[s];
    let qh = 0, qt = 0;
    queue[qt++] = s; comp[s] = nc;
    let A = 0;
    const startM = mcount;
    while (qh < qt) {
      const f = queue[qh++];
      A += area[f];
      members[mcount++] = f;
      for (let e = 0; e < 3; e += 1) {
        const t = twin[f * 3 + e];
        if (t < 0) continue;
        const g = (t / 3) | 0;
        if (comp[g] < 0 && lab[g] === L) { comp[g] = nc; queue[qt++] = g; }
      }
    }
    if (A < minA) { smallStart.push(startM); smallLen.push(mcount - startM); smallArea.push(A); }
    else mcount = startM; // 大块不保留成员
    nc += 1;
  }
  const order = smallArea.map((_, i) => i).sort((a, b) => smallArea[a] - smallArea[b]);
  const votes = new Float64Array(16);
  for (const ci of order) {
    const s0 = smallStart[ci], len = smallLen[ci];
    const L = lab[members[s0]];
    votes.fill(0);
    for (let k = s0; k < s0 + len; k += 1) {
      const f = members[k];
      for (let e = 0; e < 3; e += 1) {
        const t = twin[f * 3 + e];
        if (t < 0) continue;
        const g = (t / 3) | 0;
        if (lab[g] !== L) votes[lab[g]] += 1;
      }
    }
    let best = -1, bv = 0;
    for (let q = 0; q < 16; q += 1) if (votes[q] > bv) { bv = votes[q]; best = q; }
    if (best < 0) continue;
    for (let k = s0; k < s0 + len; k += 1) lab[members[k]] = best;
    changed = true;
  }
  return changed;
}

// 统计：各槽面积(mm²)、换料次数估算
function layerStats(scale, n, iter) {
  const lh = 0.2;
  const minY = S.bbox.minY;
  const H = (S.bbox.maxY - minY) * scale;
  const layers = Math.max(1, Math.ceil(H / lh) + 1);
  const masks = new Uint32Array(layers);
  const areaBy = new Float64Array(n);
  iter((y0, y1, A, l) => {
    areaBy[l] += A;
    let a = Math.floor((y0 - minY) * scale / lh), b = Math.floor((y1 - minY) * scale / lh);
    if (a < 0) a = 0; if (b >= layers) b = layers - 1;
    const bit = 1 << l;
    for (let k = a; k <= b; k += 1) masks[k] |= bit;
  });
  let changes = 0, prev = 0;
  const pop = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0xf0f0f0f) * 0x1010101) >>> 24; };
  for (let k = 0; k < layers; k += 1) {
    const m = masks[k];
    if (!m) continue;
    const c = pop(m);
    changes += c - ((m & prev) ? 1 : 0);
    prev = m;
  }
  const s2 = scale * scale;
  return { areaMM: Array.from(areaBy, (a) => a * s2), changes: Math.max(0, changes - 1), layers, heightMM: H };
}
function statsHigh(scale, n) {
  const nf = S.nf, lab = S.label, area = S.area, p = S.positions, idx = S.indices;
  return layerStats(scale, n, (cb) => {
    for (let f = 0; f < nf; f += 1) {
      const y0 = p[idx[f * 3] * 3 + 1], y1 = p[idx[f * 3 + 1] * 3 + 1], y2 = p[idx[f * 3 + 2] * 3 + 1];
      cb(Math.min(y0, y1, y2), Math.max(y0, y1, y2), area[f], lab[f]);
    }
  });
}

// ---------------- 低模 ----------------
function ensureLowMesh(target, pr) {
  if (S.low && S.low.target === target) return S.low;
  if (!target) { // 直接使用上传的低模
    const nf = S.nf;
    let luv = null;
    if (S.uvs && S.matImage.some((x) => x >= 0)) {
      luv = new Float32Array(nf * 6);
      for (let c = 0; c < nf * 3; c += 1) { const v = S.indices[c]; luv[c * 2] = S.uvs[v * 2]; luv[c * 2 + 1] = S.uvs[v * 2 + 1]; }
    }
    S.low = {
      target: 0, lpos: S.wpos, lidx: S.widx, luv, lmat: S.faceMat, lsrc: null, nlf: nf, nlv: S.nw, locked: 0, seam: 0, ms: 0,
      hasUv: !!luv, bvh: S.bvh, override: S.mapTex.map((t) => (t ? new Int8Array(t.w * t.h).fill(-1) : null)),
    };
    return S.low;
  }
  const nf = S.nf;
  let cornerUv = null;
  if (S.uvs && S.matImage.some((x) => x >= 0)) {
    cornerUv = new Float32Array(nf * 6);
    for (let c = 0; c < nf * 3; c += 1) { const v = S.indices[c]; cornerUv[c * 2] = S.uvs[v * 2]; cornerUv[c * 2 + 1] = S.uvs[v * 2 + 1]; }
  }
  const t0 = Date.now();
  const r = MCDecimate.decimate({ wpos: S.wpos, widx: S.widx, twin: S.twin, nf, nw: S.nw, cornerUv, faceMat: S.faceMat, target }, pr);
  r.ms = Date.now() - t0;
  r.target = target;
  r.hasUv = !!cornerUv;
  r.override = S.mapTex.map((t) => (t ? new Int8Array(t.w * t.h).fill(-1) : null));
  // 低模 BVH（用于笔刷拾取）
  r.bvh = MCMesh.buildBVH(r.lpos, r.lidx, r.nlf);
  S.low = r;
  return r;
}
function lowpoly(m, reqId) {
  const pr = progress(reqId);
  const { target, slotHex, precision, scale } = m;
  const low = ensureLowMesh(target, (p, t) => pr(p * 0.6, t));
  const nr = slotHex.length;
  const regionMap = m.regionMap || slotHex.map((_, i) => i);
  const n = m.slotCount || nr;
  const lut = makeLut(slotHex, COLOR_LIGHTNESS_WEIGHT);
  S.lut = lut; S.nSlots = n;
  const p = Math.max(1, Math.min(6, precision)) - 1;
  pr(0.62, "量化贴图");
  const wL = COLOR_LIGHTNESS_WEIGHT;
  const P = slotOk(slotHex);
  low.den = low.den || [];
  const maps = low.hasUv ? S.mapTex.map((t, i) => {
    if (!t) return null;
    const r = MCLow.labelMapSmart(t, P, nr, wL, PREC.denoise[p], PREC.lambda[p], null, SIGMA2);
    low.den[i] = r.den;
    const lab = r.lab;
    const ov = low.override[i];
    for (let k = 0; k < lab.length; k += 1) lab[k] = ov[k] >= 0 && ov[k] < n ? ov[k] : regionMap[lab[k]];
    return { w: t.w, h: t.h, lab };
  }) : null;
  // 无 UV：先保证高模标签存在（用当前调色板，不做清理）
  let projector = null;
  if (!low.hasUv) {
    if (!S.label || S.label.length !== S.nf || S.labelSlots !== slotHex.join()) {
      const lab = new Uint8Array(S.nf);
      for (let f = 0; f < S.nf; f += 1) lab[f] = regionMap[lut[S.fkeys[f * 4 + 3]]];
      S.projLabel = lab;
    } else S.projLabel = S.label.slice();
    for (let f = 0; f < S.nf; f += 1) if (S.highPaint[f] >= 0 && S.highPaint[f] < n) S.projLabel[f] = S.highPaint[f];
    const r1 = S.bbox.diag * 0.006, r2 = S.bbox.diag * 0.05;
    projector = (x, y, z) => {
      let f = MCMesh.nearestFace(S.bvh, S.wpos, S.widx, x, y, z, r1);
      if (f < 0) f = MCMesh.nearestFace(S.bvh, S.wpos, S.widx, x, y, z, r2);
      return f >= 0 ? S.projLabel[f] : 0;
    };
  }
  pr(0.66, "自适应细分");
  const t0 = Date.now();
  const sub = MCLow.subdivideAll({
    lpos: low.lpos, lidx: low.lidx, luv: low.luv, lmat: low.lmat, nlf: low.nlf, maps, matImage: S.matImage,
    scale, maxDepth: PREC.maxDepth[p], minEdge: PREC.minEdge[p], purity: PREC.purity[p], n, projector,
  }, (q, t) => pr(0.66 + 0.3 * q, t));
  low.sub = sub; low.maps = maps; low.slotHex = slotHex.slice();
  const subMs = Date.now() - t0;
  // 统计
  const L = sub.leaves;
  const stats = layerStats(scale, n, (cb) => {
    for (let i = 0; i < sub.nl; i += 1) {
      const o = i * 9;
      const ux = L[o + 3] - L[o], uy = L[o + 4] - L[o + 1], uz = L[o + 5] - L[o + 2];
      const vx = L[o + 6] - L[o], vy = L[o + 7] - L[o + 1], vz = L[o + 8] - L[o + 2];
      const A = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      cb(Math.min(L[o + 1], L[o + 4], L[o + 7]), Math.max(L[o + 1], L[o + 4], L[o + 7]), A, sub.leafLab[i]);
    }
  });
  let maxNib = 0;
  for (let f = 0; f < low.nlf; f += 1) maxNib = Math.max(maxNib, sub.off[f + 1] - sub.off[f]);
  stats.low = { nlf: low.nlf, nlv: low.nlv, leaves: sub.nl, decimateMs: low.ms, subMs, hasUv: low.hasUv, locked: low.locked, maxCode: maxNib, codeBytes: sub.nib.length };
  const leaves = sub.leaves.slice(), leafLab = sub.leafLab.slice();
  const lpos = low.lpos.slice(), lidx = low.lidx.slice();
  const b = low.bvh;
  const bvh = { bounds: b.bounds.slice(), info: b.info.slice(), order: b.order.slice() };
  const luv = low.luv ? low.luv.slice() : null;
  post("lowpoly", { reqId, leaves, leafLab, leafFace: sub.leafFace.slice(), matImage: S.matImage.slice(), lpos, lidx, luv, lmat: low.lmat.slice(), bvh, stats },
    [leaves.buffer, leafLab.buffer, lpos.buffer, lidx.buffer, bvh.bounds.buffer, bvh.info.buffer, bvh.order.buffer].concat(luv ? [luv.buffer] : []));
}

// ---------------- 补色 ----------------
function pushUndo(op) { S.undo.push(op); if (S.undo.length > 30) S.undo.shift(); }
function okDist2(F, o, seed, w2) {
  const dl = F[o] - seed[0], da = F[o + 1] - seed[1], db = F[o + 2] - seed[2];
  return dl * dl * w2 + da * da + db * db;
}
function paintHigh(m) {
  const { faces, label } = m;
  const prev = new Int8Array(faces.length);
  for (let i = 0; i < faces.length; i += 1) { prev[i] = S.highPaint[faces[i]]; S.highPaint[faces[i]] = label; }
  pushUndo({ type: "high", faces: faces.slice(), prev });
  if (S.label) for (let i = 0; i < faces.length; i += 1) S.label[faces[i]] = label;
}
// 高模智能填充：tol=0 → 同一色块；否则按平滑后的原色相似度连通扩散
function fillHigh(m) {
  const { seed, label, tol } = m;
  const nf = S.nf, twin = S.twin;
  const F = S.faceDen || S.faceOk;
  const w2 = 0.25;
  const seedC = [F[seed * 3], F[seed * 3 + 1], F[seed * 3 + 2]];
  const seedL = S.label ? S.label[seed] : -1;
  const t2 = tol * tol;
  const mark = new Uint8Array(nf);
  const q = new Int32Array(nf);
  let qh = 0, qt = 0;
  q[qt++] = seed; mark[seed] = 1;
  while (qh < qt) {
    const f = q[qh++];
    for (let e = 0; e < 3; e += 1) {
      const t = twin[f * 3 + e];
      if (t < 0) continue;
      const g = (t / 3) | 0;
      if (mark[g]) continue;
      const ok = tol <= 0 ? S.label && S.label[g] === seedL : okDist2(F, g * 3, seedC, w2) <= t2;
      if (!ok) continue;
      mark[g] = 1; q[qt++] = g;
    }
  }
  const faces = q.slice(0, qt);
  paintHigh({ faces: new Uint32Array(faces), label });
  return new Uint32Array(faces);
}
function clearPaint() {
  S.refinement = null;
  if (S.highPaint) S.highPaint.fill(-1);
  if (S.low) S.low.override.forEach((o) => o && o.fill(-1));
  S.undo = [];
}
function paintLowPixels(img, idxList, label, batch) {
  const o = S.low.override[img];
  const prev = new Int8Array(idxList.length);
  for (let i = 0; i < idxList.length; i += 1) { prev[i] = o[idxList[i]]; o[idxList[i]] = label; }
  const op = { type: "low", img, idx: new Uint32Array(idxList), prev };
  if (batch) batch.push(op); else pushUndo(op);
}
// 低模补色：dabs=[{img,u,v,r(uv半径),label, seed?, tol?}]
function paintLow(m) {
  const low = S.low;
  if (!low) return;
  const byImg = new Map();
  for (const d of m.dabs) {
    const o = low.override[d.img];
    const t = S.mapTex[d.img];
    if (!o || !t) continue;
    const den = low.den && low.den[d.img];
    const list = byImg.get(d.img) || { label: d.label, set: new Set() };
    const cx = d.u * t.w, cy = d.v * t.h, rx = Math.max(0.5, d.r * t.w), ry = Math.max(0.5, d.r * t.h);
    const t2 = (d.tol || 0) * (d.tol || 0);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        let xi = x % t.w; if (xi < 0) xi += t.w;
        let yi = y % t.h; if (yi < 0) yi += t.h;
        const k = yi * t.w + xi;
        if (d.seed && den && okDist2(den, k * 3, d.seed, 0.25) > t2) continue;
        list.set.add(k);
      }
    }
    byImg.set(d.img, list);
  }
  const operations = [];
  byImg.forEach((v, img) => paintLowPixels(img, [...v.set], v.label, operations));
  if (operations.length) pushUndo({ type: "batch", operations });
}
// 低模智能填充：在 UV 标签图上按原色相似度 4 邻域扩散
function fillLow(m) {
  const low = S.low;
  const { img, u, v, label, tol } = m;
  const t = S.mapTex[img];
  const den = low.den[img];
  const lab = low.maps && low.maps[img] ? low.maps[img].lab : null;
  if (!t || !den) return 0;
  const W = t.w, H = t.h;
  let x0 = Math.floor(u * W) % W; if (x0 < 0) x0 += W;
  let y0 = Math.floor(v * H) % H; if (y0 < 0) y0 += H;
  const s = y0 * W + x0;
  const seedC = [den[s * 3], den[s * 3 + 1], den[s * 3 + 2]];
  const seedL = lab ? lab[s] : -1;
  const t2 = tol * tol;
  const mark = new Uint8Array(W * H);
  const q = new Int32Array(W * H);
  let qh = 0, qt = 0;
  q[qt++] = s; mark[s] = 1;
  while (qh < qt) {
    const k = q[qh++];
    const x = k % W, y = (k / W) | 0;
    for (let j = 0; j < 4; j += 1) {
      const g = j === 0 ? (x > 0 ? k - 1 : -1) : j === 1 ? (x < W - 1 ? k + 1 : -1) : j === 2 ? (y > 0 ? k - W : -1) : (y < H - 1 ? k + W : -1);
      if (g < 0 || mark[g]) continue;
      const ok = tol <= 0 ? lab && lab[g] === seedL : okDist2(den, g * 3, seedC, 0.25) <= t2;
      if (!ok) continue;
      mark[g] = 1; q[qt++] = g;
    }
  }
  paintLowPixels(img, q.subarray(0, qt), label);
  return qt;
}
function undo() {
  const op = S.undo.pop();
  if (!op) return false;
  const operations = op.type === "batch" ? op.operations : [op];
  for (const op of operations) {
  if (op.type === "refinement") { for (let i = 0; i < op.faces.length; i++) S.refinement.labels[op.faces[i]] = op.prev[i]; }
  else if (op.type === "high") for (let i = 0; i < op.faces.length; i += 1) S.highPaint[op.faces[i]] = op.prev[i];
  else { const o = S.low.override[op.img]; for (let i = 0; i < op.idx.length; i += 1) o[op.idx[i]] = op.prev[i]; }
  }
  return true;
}
// 槽位变化时重映射补色
function remapPaint(m) {
  const map = m.map; // old slot → new slot
  const r = (v) => (v < 0 ? v : v < map.length ? map[v] : -1);
  if (S.highPaint) for (let f = 0; f < S.nf; f += 1) if (S.highPaint[f] >= 0) S.highPaint[f] = r(S.highPaint[f]);
  if (S.low) S.low.override.forEach((o) => { if (o) for (let i = 0; i < o.length; i += 1) if (o[i] >= 0) o[i] = r(o[i]); });
}

// ---------------- 导出 ----------------
async function export3mf(m, reqId) {
  const pr = progress(reqId);
  const { scheme, scale, filaments, name, withConfig, bed } = m;
  let blob;
  if (S.refinement) {
    const r = S.refinement;
    if (S.refinementScheme === 'low' && S.low?.sub) {
      // Keep the watertight source mesh; change leaf states in the existing subdivision codes.
      const sub = S.low.sub; let leaf = 0; const codes = [];
      for (let f = 0; f < S.low.nlf; f++) {
        const encoded = [];
        for (let i = sub.off[f]; i < sub.off[f + 1]; i++) {
          const value = sub.nib[i];
          if (value & 3) encoded.push(value);
          else {
            if ((value >> 2) === 3) i++;
            const state = r.labels[leaf++] + 1;
            if (state < 3) encoded.push(state << 2); else encoded.push(12, state - 3);
          }
        }
        codes.push(encoded.reverse().map(v => '0123456789ABCDEF'[v]).join(''));
      }
      if (leaf !== r.labels.length) throw new Error('Refinement topology does not match the export mesh.');
      blob = await MCExport.build3mf({ name, pos: S.low.lpos, idx: S.low.lidx, nf: S.low.nlf, scale, filaments, withConfig, bed, materialData: m.materialData, faceCode: f => codes[f] }, pr);
    } else {
      blob = await MCExport.build3mf({ name, pos: S.wpos, idx: S.widx, nf: S.nf, scale, filaments, withConfig, bed, materialData: m.materialData,
        faceSlot: f => r.labels[f], faceCode: f => MCLow.stateString(r.labels[f]) }, pr);
    }
  } else if (scheme === "low") {
    const low = S.low;
    const sub = low.sub;
    blob = await MCExport.build3mf({
      name, pos: low.lpos, idx: low.lidx, nf: low.nlf, scale, filaments, withConfig, bed, materialData: m.materialData,
      faceCode: (f) => MCLow.faceString(sub.nib, sub.off, f),
    }, pr);
  } else {
    const lab = S.label;
    const codes = []; for (let i = 0; i < 16; i += 1) codes.push(MCLow.stateString(i));
    blob = await MCExport.build3mf({
      name, pos: S.wpos, idx: S.widx, nf: S.nf, scale, filaments, withConfig, bed, materialData: m.materialData, faceSlot: (f) => lab[f],
      faceCode: (f) => codes[lab[f]],
    }, pr);
  }
  post("export", { reqId, blob, size: blob.size });
}
async function exportGLB(m, reqId) {
  const low = S.low;
  if (!low || !low.hasUv) throw new Error("当前低模没有 UV，无法导出贴图版 GLB");
  const { scale, slotHex, name } = m;
  const rgb = slotHex.map((h) => MC.hexToRgb255(h));
  const prims = [];
  const mats = Array.from(new Set(low.lmat));
  for (const mi of mats) {
    const mt = materials[mi];
    const img = mt.image >= 0 && S.tex[mt.image] && uvs ? mt.image : -1;
    const map = img >= 0 ? low.maps[img] : null;
    if (!map) continue;
    // 该材质的面 → 展开为非共享顶点（每角独立 UV）
    const faces = [];
    for (let f = 0; f < low.nlf; f += 1) if (low.lmat[f] === mi) faces.push(f);
    const pos = new Float32Array(faces.length * 9), uv = new Float32Array(faces.length * 6), idx = new Uint32Array(faces.length * 3);
    faces.forEach((f, i) => {
      for (let k = 0; k < 3; k += 1) {
        const v = low.lidx[f * 3 + k];
        pos[i * 9 + k * 3] = low.lpos[v * 3]; pos[i * 9 + k * 3 + 1] = low.lpos[v * 3 + 1]; pos[i * 9 + k * 3 + 2] = low.lpos[v * 3 + 2];
        uv[i * 6 + k * 2] = low.luv[f * 6 + k * 2]; uv[i * 6 + k * 2 + 1] = low.luv[f * 6 + k * 2 + 1];
        idx[i * 3 + k] = i * 3 + k;
      }
    });
    const cv = new OffscreenCanvas(map.w, map.h);
    const cx = cv.getContext("2d");
    const im = cx.createImageData(map.w, map.h);
    for (let i = 0; i < map.lab.length; i += 1) {
      const c = rgb[map.lab[i]] || [128, 128, 128];
      im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = 255;
    }
    cx.putImageData(im, 0, 0);
    const png = new Uint8Array(await (await cv.convertToBlob({ type: "image/png" })).arrayBuffer());
    prims.push({ pos, uv, idx, png });
  }
  const blob = MCExport.buildGLB(prims, scale, name);
  post("export", { reqId, blob, size: blob.size });
}

// 编码自检：一块方板，分 4 个子三角形 + 深层细分，分别绑定 1..4 号耗材
async function selftest(m, reqId) {
  // 一个大三角形（边长 80mm，放在 XY 平面，z 方向加厚成三棱柱）
  const L = 80, T = 3;
  const P = [[0, 0], [L, 0], [0, L]];
  const pos = new Float32Array(18);
  // Y-up：打印面(x,z)，高度 y
  P.forEach((p, i) => { pos[i * 3] = p[0]; pos[i * 3 + 1] = T; pos[i * 3 + 2] = -p[1]; pos[(i + 3) * 3] = p[0]; pos[(i + 3) * 3 + 1] = 0; pos[(i + 3) * 3 + 2] = -p[1]; });
  const idx = new Uint32Array([0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0]);
  // 顶面：子三角形 0..3 分别为状态 1..4（1 号=角 v0, 2 号=角 v1, 3 号=角 v2, 4 号=中心）
  const nibs = [0b0011];
  for (let ci = 3; ci >= 0; ci -= 1) { const s = ci + 1; if (s < 3) nibs.push(s << 2); else { nibs.push(0b1100); nibs.push(s - 3); } }
  const HEX = "0123456789ABCDEF";
  const top = nibs.slice().reverse().map((x) => HEX[x]).join("");
  const blob = await MCExport.build3mf({
    name: "paint-encoding-selftest", pos, idx, nf: 8, scale: 1, withConfig: m.withConfig, bed: m.bed,
    filaments: [{ hex: "#E53935" }, { hex: "#43A047" }, { hex: "#1E88E5" }, { hex: "#FDD835" }],
    faceCode: (f) => (f === 0 ? top : null),
  });
  post("export", { reqId, blob, size: blob.size, code: top });
}


function geometryKey(positions, indices) {
  let hash = 2166136261;
  for (const array of [positions, indices]) {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619);
  }
  return `${positions.length}:${indices.length}:${hash >>> 0}`;
}

function validateMesh(m) {
  if (!m.positions?.length || m.positions.length % 3 || !m.indices?.length || m.indices.length % 3) throw new Error("Mesh must contain triangles.");
  const nv = m.positions.length / 3, nf = m.indices.length / 3;
  if (!m.materials?.length || m.faceMat?.length !== nf || !Array.isArray(m.images)) throw new Error("Mesh material table is incomplete.");
  if (m.uvs && m.uvs.length !== nv * 2 || m.colors && m.colors.length !== nv * 3) throw new Error("Vertex attribute lengths do not match.");
  for (const value of m.positions) if (!Number.isFinite(value)) throw new Error("Mesh has non-finite positions.");
  for (const value of m.indices) if (!Number.isInteger(value) || value < 0 || value >= nv) throw new Error("Mesh index is outside the vertex table.");
  for (const value of m.faceMat) if (!Number.isInteger(value) || value < 0 || value >= m.materials.length) throw new Error("Mesh references an unknown material.");
  for (const mt of m.materials) if (!Array.isArray(mt.factor) || mt.factor.length !== 3 || mt.factor.some(x => !Number.isFinite(x) || x < 0)) throw new Error("Invalid material color factor.");
}

function validateLabel(m) {
  if (!m.slotHex?.length || m.slotHex.length > 12 || m.slotHex.some(h => !/^#[a-f0-9]{6}$/i.test(h))) throw new Error("Choose 1–12 valid colors.");
  if (!Number.isFinite(m.scale) || m.scale <= 0) throw new Error("Print scale must be positive.");
  if (!Number.isInteger(m.precision) || m.precision < 1 || m.precision > 6) throw new Error("Precision must be 1–6.");
  const slots = m.slotCount || m.slotHex.length;
  if (slots < 1 || slots > 12 || !Number.isInteger(slots)) throw new Error("Choose 1–12 material slots.");
  if (m.regionMap && (m.regionMap.length !== m.slotHex.length || m.regionMap.some(v => !Number.isInteger(v) || v < 0 || v >= slots))) throw new Error("Invalid region mapping.");
}

function requireLabel(label) {
  if (!Number.isInteger(label) || label < 0 || label >= S.nSlots) throw new Error("Invalid paint slot.");
}

// Extend the paint palette without introducing a new segmentation candidate.
function appendSlot(expectedCount) {
  if (!Number.isInteger(expectedCount) || expectedCount !== S.nSlots || expectedCount < 1 || expectedCount >= 12) throw new Error('Cannot add another material slot.');
  S.nSlots++;
  if (S.lastLabel) S.lastLabel = { ...S.lastLabel, slotCount: S.nSlots };
  if (S.lastLow) S.lastLow = { ...S.lastLow, slotCount: S.nSlots };
}

function sampleSource(face, weights) {
  if (!Number.isInteger(face) || face < 0 || face >= S.nf || !Array.isArray(weights) || weights.length !== 3 || weights.some(w => !Number.isFinite(w) || w < -1e-5 || w > 1.00001) || Math.abs(weights.reduce((a, b) => a + b, 0) - 1) > 1e-4) throw new Error('Invalid source color sample.');
  const vertices = Array.from(S.indices.subarray(face * 3, face * 3 + 3));
  const mix = (data, stride, channel) => vertices.reduce((sum, vertex, i) => sum + weights[i] * data[vertex * stride + channel], 0);
  const mt = S.materials[S.faceMat[face]], texture = S.tex[mt.image];
  const linear = value => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  let rgb;
  if (texture && S.uvs) {
    const u = mix(S.uvs, 2, 0), v = mix(S.uvs, 2, 1);
    const x = (u - Math.floor(u)) * texture.w - 0.5, y = (v - Math.floor(v)) * texture.h - 0.5;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const pixel = (px, py, c) => linear(texture.data[(((py + texture.h) % texture.h) * texture.w + (px + texture.w) % texture.w) * 4 + c] / 255);
    rgb = [0, 1, 2].map(c => {
      const value = (pixel(x0, y0, c) * (1 - fx) + pixel(x0 + 1, y0, c) * fx) * (1 - fy) + (pixel(x0, y0 + 1, c) * (1 - fx) + pixel(x0 + 1, y0 + 1, c) * fx) * fy;
      return value * mt.factor[c] * (mt.vertexColors && S.refineInput.vertexFactors ? mix(S.refineInput.vertexFactors, 3, c) : 1);
    });
  } else if (S.colors) {
    rgb = [0, 1, 2].map(c => vertices.reduce((sum, vertex, i) => sum + weights[i] * linear(S.colors[vertex * 3 + c] / 255), 0));
  } else rgb = mt.factor;
  return '#' + rgb.map(value => Math.round(Math.max(0, Math.min(1, MC.linearToSrgb(value))) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function refreshHigh() {
  if (!S.autoLabel) return;
  S.label = S.autoLabel.slice();
  for (let f = 0; f < S.nf; f++) if (S.highPaint[f] >= 0 && S.highPaint[f] < S.nSlots) S.label[f] = S.highPaint[f];
}

function editAck(reqId, extra = {}) {
  post("ack", { reqId, left: S.undo.length, label: S.label ? S.label.slice() : null, refinementLabels: S.refinement?.labels.slice(), ...extra });
}

function snapshot() {
  return {
    refinement: S.refinement ? { scheme: S.refinementScheme, positions: Array.from(S.refinement.positions), labels: Array.from(S.refinement.labels), sourceFaces: Array.from(S.refinement.sourceFaces) } : undefined,
    version: 1, faceCount: S.nf, geometryKey: S.geometryKey,
    highPaint: Array.from(S.highPaint), labels: S.label ? Array.from(S.label) : null,
    autoLabels: S.autoLabel ? Array.from(S.autoLabel) : null,
    regionLabels: S.regionLabel ? Array.from(S.regionLabel) : null,
    slotCount: S.nSlots || 0, labelOptions: S.lastLabel || null,
    lowOptions: S.lastLow || null,
    lowOverrides: S.low ? S.low.override.map(o => o ? Array.from(o) : null) : [],
  };
}

function restore(m, reqId) {
  const snap = m.snapshot;
  if (!snap || snap.version !== 1 || snap.faceCount !== S.nf || snap.geometryKey !== S.geometryKey || snap.highPaint?.length !== S.nf) throw new Error("Snapshot does not match this mesh.");
  if (!Number.isInteger(snap.slotCount) || snap.slotCount < 0 || snap.slotCount > 12) throw new Error("Invalid snapshot slots.");
  const validLabels = (a, min, length) => a === null || Array.isArray(a) && a.length === length && a.every(x => Number.isInteger(x) && x >= min && x < snap.slotCount);
  if (!validLabels(snap.highPaint, -1, S.nf) || !validLabels(snap.labels, 0, S.nf) || !validLabels(snap.autoLabels, 0, S.nf) || !validLabels(snap.regionLabels, 0, S.nf)) throw new Error("Invalid snapshot labels.");
  if (snap.lowOptions) validateLabel(snap.lowOptions);
  if (snap.labelOptions) validateLabel(snap.labelOptions);
  if (!Array.isArray(snap.lowOverrides)) throw new Error("Invalid UV overrides.");
  for (let i = 0; i < snap.lowOverrides.length; i++) {
    const map = S.mapTex[i], ov = snap.lowOverrides[i];
    if (ov !== null && (!map || !validLabels(ov, -1, map.w * map.h))) throw new Error("UV override dimensions do not match.");
  }
  let refinement = null;
  if (snap.refinement) {
    const r = snap.refinement;
    if (!['high', 'low', undefined].includes(r.scheme) || !Array.isArray(r.labels) || !r.labels.length || !Array.isArray(r.positions) || r.positions.length !== r.labels.length * 9 || r.positions.some(v => !Number.isFinite(v)) || !validLabels(r.labels, 0, r.labels.length)
      || !Array.isArray(r.sourceFaces) || r.sourceFaces.length !== r.labels.length || r.sourceFaces.some(f => !Number.isInteger(f) || f < 0 || f >= S.nf)) throw new Error('Invalid refinement snapshot.');
    refinement = MCRefine.create(S.refineInput, Float32Array.from(r.positions), Uint8Array.from(r.labels), Uint32Array.from(r.sourceFaces));
  }
  S.refinement = refinement;
  S.refinementScheme = snap.refinement?.scheme ?? (snap.lowOptions && snap.refinement?.labels.length !== S.nf ? 'low' : 'high');
  S.highPaint = Int8Array.from(snap.highPaint);
  S.label = snap.labels ? Uint8Array.from(snap.labels) : null;
  S.autoLabel = snap.autoLabels ? Uint8Array.from(snap.autoLabels) : null;
  S.regionLabel = snap.regionLabels ? Uint8Array.from(snap.regionLabels) : null;
  S.nSlots = snap.slotCount;
  S.lastLabel = snap.labelOptions;
  S.lastLow = snap.lowOptions;
  S.undo = [];
  let result = null;
  if (snap.lowOptions) {
    const low = ensureLowMesh(snap.lowOptions.target, () => {});
    low.override = S.mapTex.map((t, i) => t ? (snap.lowOverrides[i] ? Int8Array.from(snap.lowOverrides[i]) : new Int8Array(t.w * t.h).fill(-1)) : null);
    const responses = [];
    captured = responses;
    try { lowpoly(snap.lowOptions, reqId); } finally { captured = null; }
    result = responses.find(r => r.type === "lowpoly") || null;
  }
  post("restore", { reqId, label: S.label ? S.label.slice() : null, low: result, refinement: refinement ? refinementResult() : undefined });
}

function refinementResult() {
  const { adjacency, bvh, ...result } = S.refinement;
  return result;
}
function prepareRefinement(scheme) {
  if (S.refinement) return;
  S.refinementScheme = scheme;
  if (scheme === 'low' && S.low?.sub) {
    const sub = S.low.sub;
    if (S.low.target !== 0) throw new Error('Refinement needs the original mesh.');
    S.refinement = MCRefine.create(S.refineInput, sub.leaves.slice(), sub.leafLab.slice(), sub.leafFace.slice());
  } else {
    if (!S.label) throw new Error('Generate colors before refining.');
    const positions = new Float32Array(S.nf * 9);
    for (let c = 0; c < S.indices.length; c++) positions.set(S.positions.subarray(S.indices[c] * 3, S.indices[c] * 3 + 3), c * 3);
    S.refinement = MCRefine.create(S.refineInput, positions, S.label.slice(), Uint32Array.from({ length: S.nf }, (_, f) => f));
  }
}
function paintRefinement(faces, label) {
  requireLabel(label);
  const r = S.refinement;
  if (!r || !faces || Array.from(faces).some(f => !Number.isInteger(f) || f < 0 || f >= r.labels.length)) throw new Error('Invalid refinement selection.');
  const changed = Uint32Array.from(new Set(Array.from(faces).filter(f => r.labels[f] !== label)));
  if (!changed.length) return;
  const prev = Uint8Array.from(changed, f => r.labels[f]);
  for (const f of changed) r.labels[f] = label;
  pushUndo({ type: 'refinement', faces: changed, prev });
}

async function dispatch(m) {
  active = m;
  try {
    if (typeof m.projectId !== "string" || !Number.isSafeInteger(m.requestId) || !Number.isSafeInteger(m.editRevision)) throw new Error("Missing request identity.");
    if (projectId !== null && m.projectId !== projectId) throw new Error("This worker belongs to another project.");
    if (m.editRevision < editRevision) throw new Error("Stale edit revision.");
    projectId = m.projectId; editRevision = m.editRevision;
    const reqId = m.requestId;
    if (m.type !== "init" && m.type !== "selftest" && !S.positions) throw new Error("Load a model first.");
    switch (m.type) {
      case "init": await init(m, reqId); break;
      case "appendSlot": appendSlot(m.expectedCount); post('slot', { reqId, slotCount: S.nSlots }); break;
      case "sampleSource": post('sourceColor', { reqId, hex: sampleSource(m.face, m.barycentric) }); break;
      case "prepareRefinement": prepareRefinement(m.scheme); post('refinement', { reqId, ...refinementResult() }); break;
      case "selectRefinement":
        if (!S.refinement || !Array.isArray(m.materialGroups) || m.materialGroups.length !== S.nSlots) throw new Error('Prepare refinement first.');
        post('selection', { reqId, faces: MCRefine.select(S.refinement, m.face, m.scope, m.materialGroups) }); break;
      case "paintRefinement": paintRefinement(m.faces, m.label); editAck(reqId); break;
      case "fillRefinement": {
        if (!S.refinement || !Array.isArray(m.materialGroups) || m.materialGroups.length !== S.nSlots) throw new Error('Prepare refinement first.');
        requireLabel(m.label);
        const faces = MCRefine.select(S.refinement, m.face, 'color', m.materialGroups);
        // Selecting another slot of the same filament is not a color edit.
        if (m.materialGroups[S.refinement.labels[m.face]] !== m.materialGroups[m.label]) paintRefinement(faces, m.label);
        editAck(reqId); break;
      }
      case "brushRefinement": {
        const r = S.refinement; if (!r) throw new Error('Prepare refinement first.');
        const idx = Uint32Array.from({ length: r.positions.length / 3 }, (_, i) => i);
        r.bvh ??= MCMesh.buildBVH(r.positions, idx, r.labels.length);
        const faces = new Set();
        for (const hit of m.hits) {
          if (!Number.isInteger(hit.face) || hit.face < 0 || hit.face >= r.labels.length || !Number.isFinite(hit.radius) || hit.radius <= 0 || hit.point.length !== 3 || hit.point.some(v => !Number.isFinite(v))) throw new Error('Invalid brush hit.');
          faces.add(hit.face); MCMesh.sphereQuery(r.bvh, r.positions, idx, ...hit.point, hit.radius, f => faces.add(f));
        }
        paintRefinement(Uint32Array.from(faces), m.label); editAck(reqId); break;
      }
      case "palette":
        if (!Number.isInteger(m.N) || m.N < 1 || m.N > 12) throw new Error("Choose 1–12 colors.");
        if (m.mode !== "free" && (!m.cands?.length || m.cands.some(c => !/^#[a-f0-9]{6}$/i.test(c.hex)))) throw new Error("Choose valid materials.");
        palette(m, reqId); break;
      case "label": validateLabel(m); S.lastLabel = m; labelHigh(m, reqId); S.labelSlots = m.slotHex.join(); break;
      case "lowpoly": validateLabel(m); S.lastLow = m; lowpoly(m, reqId); break;
      case "brushHigh": {
        requireLabel(m.label);
        const selected = new Set();
        for (const hit of m.hits) {
          if (!Number.isInteger(hit.face) || hit.face < 0 || hit.face >= S.nf || !Number.isFinite(hit.radius) || hit.radius <= 0 || hit.point.length !== 3 || hit.point.some(v => !Number.isFinite(v))) throw new Error("Invalid brush hit.");
          selected.add(hit.face);
          MCMesh.sphereQuery(S.bvh, S.wpos, S.widx, ...hit.point, hit.radius, face => selected.add(face));
        }
        paintHigh({ faces: new Uint32Array(selected), label: m.label }); editAck(reqId); break;
      }
      case "paintHigh":
        requireLabel(m.label);
        if (!m.faces || Array.from(m.faces).some(f => !Number.isInteger(f) || f < 0 || f >= S.nf)) throw new Error("Invalid face selection.");
        m.faces = new Uint32Array(new Set(m.faces));
        paintHigh(m); editAck(reqId); break;
      case "fillHigh":
        requireLabel(m.label);
        if (!Number.isInteger(m.seed) || m.seed < 0 || m.seed >= S.nf) throw new Error("Invalid seed face.");
        editAck(reqId, { faces: fillHigh(m) }); break;
      case "paintLow":
        if (!S.low) throw new Error("Create UV labels first.");
        for (const dab of m.dabs) { requireLabel(dab.label); if (!Number.isFinite(dab.r) || dab.r <= 0 || dab.r > 1 || !Number.isFinite(dab.u) || !Number.isFinite(dab.v)) throw new Error("Invalid UV brush."); }
        paintLow(m); editAck(reqId); break;
      case "fillLow":
        requireLabel(m.label);
        if (!S.low || !S.mapTex[m.img] || !Number.isFinite(m.u) || !Number.isFinite(m.v)) throw new Error("Invalid UV selection.");
        editAck(reqId, { count: fillLow(m) }); break;
      case "reset": case "clearPaint": clearPaint(); refreshHigh(); editAck(reqId); break;
      case "undo": {
        const legacy = S.refinement && S.undo.length && S.undo[S.undo.length - 1].type !== 'refinement';
        const ok = undo(); refreshHigh();
        if (legacy) {
          const scheme = S.refinementScheme; S.refinement = null;
          if (scheme === 'low' && S.lastLow) { captured = []; try { lowpoly(S.lastLow, reqId); } finally { captured = null; } }
          prepareRefinement(scheme);
        }
        editAck(reqId, { ok, refinement: legacy ? refinementResult() : undefined }); break;
      }
      case "snapshot": post("snapshot", { reqId, snapshot: snapshot() }); break;
      case "restore": restore(m, reqId); break;
      case "export3mf":
        if (!Number.isFinite(m.scale) || m.scale <= 0 || !m.filaments?.length || m.filaments.length > 12 || m.filaments.some(f => !/^#[a-f0-9]{6}$/i.test(f.hex))) throw new Error("Invalid export scale or material slots.");
        if (m.scheme === "low" ? !S.low?.sub : !S.label) throw new Error("Create color labels before exporting.");
        if (m.filaments.length < S.nSlots) throw new Error("Export is missing material slots.");
        if (!m.preservePartition && !S.refinement && m.scheme === "low" && S.lastLow) {
          captured = [];
          try { lowpoly({ ...S.lastLow, scale: m.scale }, reqId); } finally { captured = null; }
        }
        await export3mf(m, reqId); break;
      case "selftest": await selftest(m, reqId); break;
      default: throw new Error(`Unknown print command: ${m.type}`);
    }
  } catch (err) {
    post("error", { reqId: m.requestId, message: err instanceof Error ? err.message : String(err) });
  } finally { active = null; }
}

self.onmessage = ({ data }) => {
  sequence = sequence.then(() => dispatch(data));
};
