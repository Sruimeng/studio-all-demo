/* ============================================================
 * palette.js — 调色板引擎（Worker 内使用）
 *   1) 面积加权直方图 → 确定性 k-means++（K0 个基础簇，OKLab）
 *   2) 层次合并树：N→N-1 只合并一对，滑杆稳定、实时
 *   3) 受限选色：在候选耗材上做 k-medoids(PAM)，距离 CIEDE2000
 * ============================================================ */
(function (root) {
  "use strict";
  const MC = root.MC;

  // ---------- 1. 直方图 → 基础簇 ----------
  function baseClusters(hist, K0, wL) {
    const w2 = (wL || 1) * (wL || 1);
    const ok = MC.cellOklab();
    let n = 0;
    for (let k = 0; k < hist.length; k += 1) if (hist[k] > 0) n += 1;
    const P = new Float32Array(n * 3), W = new Float64Array(n);
    let j = 0, total = 0;
    for (let k = 0; k < hist.length; k += 1) {
      if (hist[k] <= 0) continue;
      P[j * 3] = ok[k * 3]; P[j * 3 + 1] = ok[k * 3 + 1]; P[j * 3 + 2] = ok[k * 3 + 2];
      W[j] = hist[k]; total += hist[k]; j += 1;
    }
    if (n === 0) return [];
    const K = Math.min(K0, n);
    const rnd = MC.mulberry32(20260915);
    const C = new Float64Array(K * 3);
    const D = new Float64Array(n).fill(Infinity);
    // k-means++（按权重）
    let pick = 0;
    { let r = rnd() * total; for (pick = 0; pick < n - 1; pick += 1) { r -= W[pick]; if (r <= 0) break; } }
    C[0] = P[pick * 3]; C[1] = P[pick * 3 + 1]; C[2] = P[pick * 3 + 2];
    for (let c = 1; c < K; c += 1) {
      let sum = 0;
      for (let i = 0; i < n; i += 1) {
        const dl = P[i * 3] - C[(c - 1) * 3], da = P[i * 3 + 1] - C[(c - 1) * 3 + 1], db = P[i * 3 + 2] - C[(c - 1) * 3 + 2];
        const d = dl * dl * w2 + da * da + db * db;
        if (d < D[i]) D[i] = d;
        sum += W[i] * D[i];
      }
      let r = rnd() * sum, i = 0;
      for (; i < n - 1; i += 1) { r -= W[i] * D[i]; if (r <= 0) break; }
      C[c * 3] = P[i * 3]; C[c * 3 + 1] = P[i * 3 + 1]; C[c * 3 + 2] = P[i * 3 + 2];
    }
    const A = new Uint8Array(n);
    const S = new Float64Array(K * 4);
    for (let it = 0; it < 16; it += 1) {
      S.fill(0);
      for (let i = 0; i < n; i += 1) {
        let best = 0, bd = Infinity;
        for (let c = 0; c < K; c += 1) {
          const dl = P[i * 3] - C[c * 3], da = P[i * 3 + 1] - C[c * 3 + 1], db = P[i * 3 + 2] - C[c * 3 + 2];
          const d = dl * dl * w2 + da * da + db * db;
          if (d < bd) { bd = d; best = c; }
        }
        A[i] = best;
        const w = W[i];
        S[best * 4] += P[i * 3] * w; S[best * 4 + 1] += P[i * 3 + 1] * w; S[best * 4 + 2] += P[i * 3 + 2] * w; S[best * 4 + 3] += w;
      }
      for (let c = 0; c < K; c += 1) {
        const w = S[c * 4 + 3];
        if (w > 0) { C[c * 3] = S[c * 4] / w; C[c * 3 + 1] = S[c * 4 + 1] / w; C[c * 3 + 2] = S[c * 4 + 2] / w; }
      }
    }
    const out = [];
    for (let c = 0; c < K; c += 1) {
      const w = S[c * 4 + 3];
      if (w <= 0) continue;
      const okc = [C[c * 3], C[c * 3 + 1], C[c * 3 + 2]];
      out.push({ ok: okc, lab: MC.oklabToLab(okc[0], okc[1], okc[2]), hex: MC.oklabToHex(okc[0], okc[1], okc[2]), w: w / total });
    }
    out.sort((a, b) => b.w - a.w);
    return out;
  }

  // ---------- 2. 层次合并 ----------
  // 返回 levels[N] = [{ok, lab, hex, w, members:[基础簇下标]}]，N = 1..K0
  function mergeTree(base, protect, wL) {
    const w2 = (wL || 1) * (wL || 1);
    const gamma = protect ? 0.3 : 1.0;
    let clusters = base.map((b, i) => ({ ok: b.ok.slice(), w: b.w, members: [i] }));
    const levels = [];
    const snap = () => clusters.map((c) => ({
      ok: c.ok.slice(), w: c.w, members: c.members.slice(),
      lab: MC.oklabToLab(c.ok[0], c.ok[1], c.ok[2]), hex: MC.oklabToHex(c.ok[0], c.ok[1], c.ok[2]),
    })).sort((a, b) => b.w - a.w);
    levels[clusters.length] = snap();
    while (clusters.length > 1) {
      let bi = 0, bj = 1, bc = Infinity;
      for (let i = 0; i < clusters.length; i += 1) {
        for (let j = i + 1; j < clusters.length; j += 1) {
          const a = clusters[i], b = clusters[j];
          const dl = a.ok[0] - b.ok[0], da = a.ok[1] - b.ok[1], db = a.ok[2] - b.ok[2];
          const d2 = dl * dl * w2 + da * da + db * db;
          const cost = d2 * Math.pow((a.w * b.w) / (a.w + b.w), gamma);
          if (cost < bc) { bc = cost; bi = i; bj = j; }
        }
      }
      const a = clusters[bi], b = clusters[bj], w = a.w + b.w;
      const m = { ok: [0, 1, 2].map((t) => (a.ok[t] * a.w + b.ok[t] * b.w) / w), w, members: a.members.concat(b.members) };
      clusters = clusters.filter((_, i) => i !== bi && i !== bj);
      clusters.push(m);
      levels[clusters.length] = snap();
    }
    return levels;
  }

  // ---------- 3. 受限选色（PAM） ----------
  // points: 基础簇 [{lab,w}]；cands: [{id, lab, penalty?}]；locked: 必选 id 列表
  function pam(points, cands, N, locked, kL) {
    const P = points.length, M = cands.length;
    if (!M) return { chosen: [], cost: Infinity };
    const D = new Float64Array(P * M);
    for (let i = 0; i < P; i += 1) {
      for (let m = 0; m < M; m += 1) {
        const a = points[i].lab, b = cands[m].lab;
        D[i * M + m] = MC.deltaE00(a[0], a[1], a[2], b[0], b[1], b[2], kL) + (cands[m].penalty || 0);
      }
    }
    const lockedIdx = [];
    (locked || []).forEach((id) => { const k = cands.findIndex((c) => c.id === id); if (k >= 0 && !lockedIdx.includes(k)) lockedIdx.push(k); });
    const K = Math.max(lockedIdx.length, Math.min(N, M));
    const total = (set) => {
      let s = 0;
      for (let i = 0; i < P; i += 1) {
        let best = Infinity;
        for (const m of set) if (D[i * M + m] < best) best = D[i * M + m];
        s += best * points[i].w;
      }
      return s;
    };
    let S = lockedIdx.slice();
    while (S.length < K) { // 贪心构建
      let bm = -1, bc = Infinity;
      for (let m = 0; m < M; m += 1) {
        if (S.includes(m)) continue;
        const c = total(S.concat(m));
        if (c < bc) { bc = c; bm = m; }
      }
      if (bm < 0) break;
      S.push(bm);
    }
    let cur = total(S);
    for (let it = 0; it < 30; it += 1) { // 交换
      let improved = false;
      for (let si = lockedIdx.length; si < S.length; si += 1) {
        for (let m = 0; m < M; m += 1) {
          if (S.includes(m)) continue;
          const T = S.slice(); T[si] = m;
          const c = total(T);
          if (c < cur - 1e-9) { S = T; cur = c; improved = true; }
        }
      }
      if (!improved) break;
    }
    // 每个点归属
    const assign = new Int32Array(P);
    for (let i = 0; i < P; i += 1) {
      let best = Infinity, bs = 0;
      S.forEach((m, s) => { if (D[i * M + m] < best) { best = D[i * M + m]; bs = s; } });
      assign[i] = bs;
    }
    return { chosen: S, assign, cost: cur, D, M };
  }

  // 从 PAM 结果整理槽位：按面积降序；去掉没分到面积的非锁定项
  function slotsFromPam(points, cands, res, lockedIds, kL = 1) {
    const slots = res.chosen.map((m) => ({ cand: cands[m], w: 0, ok: [0, 0, 0], de: 0 }));
    points.forEach((p, i) => {
      const s = slots[res.assign[i]];
      s.w += p.w; s.ok[0] += p.ok[0] * p.w; s.ok[1] += p.ok[1] * p.w; s.ok[2] += p.ok[2] * p.w;
      const cl = s.cand.lab;
      s.de += MC.deltaE00(p.lab[0], p.lab[1], p.lab[2], cl[0], cl[1], cl[2], kL) * p.w;
    });
    const out = [];
    slots.forEach((s) => {
      const locked = lockedIds && lockedIds.includes(s.cand.id);
      if (s.w <= 0 && !locked) return;
      if (s.w > 0) { s.ok = s.ok.map((v) => v / s.w); s.de /= s.w; }
      else s.ok = MC.hexToOklab(s.cand.hex);
      out.push(s);
    });
    out.sort((a, b) => b.w - a.w);
    return out;
  }

  root.MC = root.MC || {};
  Object.assign(root.MC, { baseClusters, mergeTree, pam, slotsFromPam });
})(typeof self !== "undefined" ? self : this);
