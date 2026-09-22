/* ============================================================
 * lowpoly.js — 低模 + UV 多色方案
 *   1) 贴图逐像素量化 → 标签图（可叠加手工补色）
 *   2) 低模三角形在 UV 空间自适应四分细分：纯度够 / 到最大层 / 边长小于喷嘴 → 叶子
 *   3) 细分树按 TriangleSelector 规则编码（Bambu paint_color / Prusa mmu_segmentation）
 * ============================================================ */
(function (root) {
  "use strict";
  const MC = root.MC;

  // TriangleSelector 3 边分裂的子三角形布局（v0,m01,v1,m12,v2,m20）
  // children[0]=(v0,m01,m20) [1]=(m01,v1,m12) [2]=(m12,v2,m20) [3]=(m01,m12,m20)
  const CHILD_LAYOUT = [[0, 1, 5], [1, 2, 3], [3, 4, 5], [1, 3, 5]];

  // ---------- 标签图 ----------
  function majority3(lab, w, h, n) {
    const out = new Uint8Array(lab.length);
    const cnt = new Uint16Array(n);
    for (let y = 0; y < h; y += 1) {
      const y0 = y > 0 ? y - 1 : 0, y1 = y < h - 1 ? y + 1 : h - 1;
      for (let x = 0; x < w; x += 1) {
        const x0 = x > 0 ? x - 1 : 0, x1 = x < w - 1 ? x + 1 : w - 1;
        cnt.fill(0);
        for (let yy = y0; yy <= y1; yy += 1) for (let xx = x0; xx <= x1; xx += 1) cnt[lab[yy * w + xx]] += 1;
        let best = lab[y * w + x], bc = cnt[best];
        for (let q = 0; q < n; q += 1) if (cnt[q] > bc) { bc = cnt[q]; best = q; }
        out[y * w + x] = best;
      }
    }
    return out;
  }
  // tex: {w,h,keys:Uint32Array}（每像素 18-bit 键）
  function labelMap(tex, lut, n, passes, override) {
    const N = tex.w * tex.h;
    let lab = new Uint8Array(N);
    for (let i = 0; i < N; i += 1) lab[i] = lut[tex.keys[i]];
    for (let p = 0; p < passes; p += 1) lab = majority3(lab, tex.w, tex.h, n);
    if (override) for (let i = 0; i < N; i += 1) if (override[i] >= 0 && override[i] < n) lab[i] = override[i];
    return lab;
  }

  // 保边平滑 + ICM 的标签图（与高模同一套逻辑，作用在贴图像素上）
  function labelMapSmart(tex, P, n, wL, iters, lambda, override, sigma2) {
    const W = tex.w, H = tex.h, N = W * H;
    const w2 = wL * wL;
    const cok = MC.cellOklab();
    let cur = new Float32Array(N * 3);
    for (let i = 0; i < N; i += 1) { const k = tex.keys[i] * 3; cur[i * 3] = cok[k]; cur[i * 3 + 1] = cok[k + 1]; cur[i * 3 + 2] = cok[k + 2]; }
    let nxt = new Float32Array(N * 3);
    const wgt = (a, b) => {
      const dl = cur[a] - cur[b], da = cur[a + 1] - cur[b + 1], db = cur[a + 2] - cur[b + 2];
      const q = 1 / (1 + (dl * dl * w2 + da * da + db * db) / sigma2);
      return q * q;
    };
    for (let it = 0; it < iters; it += 1) {
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const i = y * W + x, o = i * 3;
          let sL = cur[o], sA = cur[o + 1], sB = cur[o + 2], ws = 1;
          if (x > 0) { const g = o - 3, w = wgt(o, g); sL += cur[g] * w; sA += cur[g + 1] * w; sB += cur[g + 2] * w; ws += w; }
          if (x < W - 1) { const g = o + 3, w = wgt(o, g); sL += cur[g] * w; sA += cur[g + 1] * w; sB += cur[g + 2] * w; ws += w; }
          if (y > 0) { const g = o - W * 3, w = wgt(o, g); sL += cur[g] * w; sA += cur[g + 1] * w; sB += cur[g + 2] * w; ws += w; }
          if (y < H - 1) { const g = o + W * 3, w = wgt(o, g); sL += cur[g] * w; sA += cur[g + 1] * w; sB += cur[g + 2] * w; ws += w; }
          nxt[o] = sL / ws; nxt[o + 1] = sA / ws; nxt[o + 2] = sB / ws;
        }
      }
      const t = cur; cur = nxt; nxt = t;
    }
    const lab = new Uint8Array(N);
    const D = (o, l) => {
      const dl = cur[o] - P[l * 3], da = cur[o + 1] - P[l * 3 + 1], db = cur[o + 2] - P[l * 3 + 2];
      return dl * dl * w2 + da * da + db * db;
    };
    for (let i = 0; i < N; i += 1) {
      let best = 0, bd = Infinity;
      for (let l = 0; l < n; l += 1) { const d = D(i * 3, l); if (d < bd) { bd = d; best = l; } }
      lab[i] = best;
    }
    // ICM（4 邻域）
    const nbL = new Int32Array(4), nbW = new Float32Array(4), nbI = new Int32Array(4);
    for (let it = 0; it < 3; it += 1) {
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const i = y * W + x, o = i * 3;
          nbI[0] = x > 0 ? i - 1 : -1; nbI[1] = x < W - 1 ? i + 1 : -1; nbI[2] = y > 0 ? i - W : -1; nbI[3] = y < H - 1 ? i + W : -1;
          for (let k = 0; k < 4; k += 1) { const g = nbI[k]; if (g < 0) { nbL[k] = -1; continue; } nbL[k] = lab[g]; nbW[k] = wgt(o, g * 3); }
          const curL = lab[i];
          let best = curL, bc = Infinity;
          for (let k = -1; k < 4; k += 1) {
            const l = k < 0 ? curL : nbL[k];
            if (l < 0 || (k >= 0 && l === curL)) continue;
            let c = D(o, l);
            for (let j = 0; j < 4; j += 1) if (nbL[j] >= 0 && nbL[j] !== l) c += lambda * 0.75 * nbW[j];
            if (c < bc) { bc = c; best = l; }
          }
          lab[i] = best;
        }
      }
    }
    if (override) for (let i = 0; i < N; i += 1) if (override[i] >= 0 && override[i] < n) lab[i] = override[i];
    return { lab, den: cur };
  }

  // ---------- 细分 ----------
  // opts: {lpos,lidx,luv,lmat,nlf, maps:[{w,h,lab}] (按材质→贴图), matImage:[], scale, maxDepth, minEdge, purity, n,
  //        projector(x,y,z)->label（无 UV 时）}
  function subdivideAll(opts, progress) {
    const { lpos, lidx, luv, lmat, nlf, maps, matImage, scale, maxDepth, minEdge, purity, n, projector, faceFilter } = opts;
    let nib = new Uint8Array(Math.max(1024, nlf * 2));
    let nn = 0;
    const off = new Uint32Array(nlf + 1);
    let leaves = new Float32Array(Math.max(1024, nlf * 9 * 2));
    let leafLab = new Uint8Array(Math.max(128, nlf * 2));
    let leafFace = new Uint32Array(Math.max(128, nlf * 2));
    let nl = 0;
    const counts = new Float64Array(n);
    const minEdge2 = (minEdge / scale) * (minEdge / scale);
    const B = new Float64Array(6 * 3);  // 6 个节点的重心坐标

    const pushNib = (v) => {
      if (nn >= nib.length) { const a = new Uint8Array(nib.length * 2); a.set(nib); nib = a; }
      nib[nn++] = v;
    };
    const pushLeaf = (f, b0, b1, b2, label) => {
      if ((nl + 1) * 9 > leaves.length) { const a = new Float32Array(leaves.length * 2); a.set(leaves); leaves = a; }
      if (nl + 1 > leafLab.length) {
        const a = new Uint8Array(leafLab.length * 2); a.set(leafLab); leafLab = a;
        const c = new Uint32Array(leafFace.length * 2); c.set(leafFace); leafFace = c;
      }
      const i0 = lidx[f * 3] * 3, i1 = lidx[f * 3 + 1] * 3, i2 = lidx[f * 3 + 2] * 3;
      const bs = [b0, b1, b2];
      for (let k = 0; k < 3; k += 1) {
        const b = bs[k];
        for (let d = 0; d < 3; d += 1) leaves[nl * 9 + k * 3 + d] = b[0] * lpos[i0 + d] + b[1] * lpos[i1 + d] + b[2] * lpos[i2 + d];
      }
      leafLab[nl] = label; leafFace[nl] = f; nl += 1;
    };
    const pushState = (label) => {
      const s = label + 1;
      if (s < 3) pushNib(s << 2);
      else { pushNib(0b1100); pushNib(s - 3); }
    };

    function sampleTri(f, b0, b1, b2) {
      counts.fill(0);
      if (luv && maps) {
        const img = matImage[lmat[f]];
        const m = img >= 0 ? maps[img] : null;
        if (m) {
          const u0 = luv[f * 6], v0 = luv[f * 6 + 1], u1 = luv[f * 6 + 2], v1 = luv[f * 6 + 3], u2 = luv[f * 6 + 4], v2 = luv[f * 6 + 5];
          const W = m.w, H = m.h;
          const P = [b0, b1, b2].map((b) => [
            (b[0] * u0 + b[1] * u1 + b[2] * u2) * W - 0.5,
            (b[0] * v0 + b[1] * v1 + b[2] * v2) * H - 0.5,
          ]);
          const xmin = Math.ceil(Math.min(P[0][0], P[1][0], P[2][0])), xmax = Math.floor(Math.max(P[0][0], P[1][0], P[2][0]));
          const ymin = Math.ceil(Math.min(P[0][1], P[1][1], P[2][1])), ymax = Math.floor(Math.max(P[0][1], P[1][1], P[2][1]));
          const area = (xmax - xmin + 1) * (ymax - ymin + 1);
          let total = 0;
          if (area > 0 && area < 64000000) {
            const step = area > 4096 ? Math.ceil(Math.sqrt(area / 2048)) : 1;
            const ax = P[0][0], ay = P[0][1], bx = P[1][0], by = P[1][1], cx = P[2][0], cy = P[2][1];
            const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
            if (Math.abs(det) > 1e-12) {
              for (let y = ymin; y <= ymax; y += step) {
                for (let x = xmin; x <= xmax; x += step) {
                  const w0 = ((bx - x) * (cy - y) - (cx - x) * (by - y)) / det;
                  const w1 = ((cx - x) * (ay - y) - (ax - x) * (cy - y)) / det;
                  if (w0 < -1e-9 || w1 < -1e-9 || w0 + w1 > 1 + 1e-9) continue;
                  let xi = x % W; if (xi < 0) xi += W;
                  let yi = y % H; if (yi < 0) yi += H;
                  counts[m.lab[yi * W + xi]] += 1; total += 1;
                }
              }
            }
          }
          if (total === 0) { // 太小：取质心最近像素
            let x = Math.round((P[0][0] + P[1][0] + P[2][0]) / 3), y = Math.round((P[0][1] + P[1][1] + P[2][1]) / 3);
            x %= W; if (x < 0) x += W; y %= H; if (y < 0) y += H;
            counts[m.lab[y * W + x]] += 1;
          }
          return;
        }
      }
      // 无 UV / 无贴图：投影到高模最近面
      const i0 = lidx[f * 3] * 3, i1 = lidx[f * 3 + 1] * 3, i2 = lidx[f * 3 + 2] * 3;
      const pts = [[1 / 3, 1 / 3, 1 / 3], [2 / 3, 1 / 6, 1 / 6], [1 / 6, 2 / 3, 1 / 6], [1 / 6, 1 / 6, 2 / 3]];
      for (const w of pts) {
        const b = [0, 1, 2].map((k) => w[0] * b0[k] + w[1] * b1[k] + w[2] * b2[k]);
        const x = b[0] * lpos[i0] + b[1] * lpos[i1] + b[2] * lpos[i2];
        const y = b[0] * lpos[i0 + 1] + b[1] * lpos[i1 + 1] + b[2] * lpos[i2 + 1];
        const z = b[0] * lpos[i0 + 2] + b[1] * lpos[i1 + 2] + b[2] * lpos[i2 + 2];
        const l = projector(x, y, z);
        counts[l] += w === pts[0] ? 1.5 : 1;
      }
    }
    function maxEdge2(f, b0, b1, b2) {
      const i0 = lidx[f * 3] * 3, i1 = lidx[f * 3 + 1] * 3, i2 = lidx[f * 3 + 2] * 3;
      const p = [b0, b1, b2].map((b) => [0, 1, 2].map((d) => b[0] * lpos[i0 + d] + b[1] * lpos[i1 + d] + b[2] * lpos[i2 + d]));
      const e = (a, c) => (p[a][0] - p[c][0]) ** 2 + (p[a][1] - p[c][1]) ** 2 + (p[a][2] - p[c][2]) ** 2;
      return Math.max(e(0, 1), e(1, 2), e(2, 0));
    }
    function rec(f, b0, b1, b2, depth) {
      sampleTri(f, b0, b1, b2);
      let best = 0, bc = -1, tot = 0;
      for (let q = 0; q < n; q += 1) { tot += counts[q]; if (counts[q] > bc) { bc = counts[q]; best = q; } }
      const pure = tot <= 0 || bc / tot >= purity;
      if (pure || depth >= maxDepth || maxEdge2(f, b0, b1, b2) <= minEdge2) {
        pushState(best);
        pushLeaf(f, b0, b1, b2, best);
        return;
      }
      pushNib(0b0011); // 3 边分裂，special side = 0
      const nodes = [b0, [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2, (b0[2] + b1[2]) / 2], b1,
        [(b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2, (b1[2] + b2[2]) / 2], b2,
        [(b2[0] + b0[0]) / 2, (b2[1] + b0[1]) / 2, (b2[2] + b0[2]) / 2]];
      for (let ci = 3; ci >= 0; ci -= 1) { // 与 PrusaSlicer 一致：子节点逆序写出
        const L = CHILD_LAYOUT[ci];
        rec(f, nodes[L[0]], nodes[L[1]], nodes[L[2]], depth + 1);
      }
    }
    void B;
    const E0 = [1, 0, 0], E1 = [0, 1, 0], E2 = [0, 0, 1];
    for (let f = 0; f < nlf; f += 1) {
      off[f] = nn;
      if (!faceFilter || faceFilter(f)) rec(f, E0, E1, E2, 0);
      if (progress && (f & 8191) === 0) progress(f / nlf, `细分：${f.toLocaleString()}/${nlf.toLocaleString()}`);
    }
    off[nlf] = nn;
    return { nib: nib.slice(0, nn), off, leaves: leaves.slice(0, nl * 9), leafLab: leafLab.slice(0, nl), leafFace: leafFace.slice(0, nl), nl };
  }

  // 一个面的编码串（字符逆序）
  const HEX = "0123456789ABCDEF";
  function faceString(nib, off, f) {
    const s = off[f], e = off[f + 1];
    let out = "";
    for (let i = e - 1; i >= s; i -= 1) out += HEX[nib[i]];
    return out;
  }
  // 单一状态（不细分）的编码
  function stateString(label) {
    const s = label + 1;
    return s < 3 ? HEX[s << 2] : HEX[s - 3] + "C";
  }

  root.MCLow = { labelMap, labelMapSmart, subdivideAll, faceString, stateString, CHILD_LAYOUT };
})(typeof self !== "undefined" ? self : this);
