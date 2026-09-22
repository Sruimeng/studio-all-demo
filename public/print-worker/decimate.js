/* ============================================================
 * decimate.js — QEM 半边折叠减面（保留 UV 接缝 / 材质边界，保持水密）
 *   只做 u→v 折叠（保留原顶点位置与原 UV，无需重新插值）
 *   顶点分类：Manifold(可向任意邻点折叠) / Seam(沿接缝折叠) / Locked
 * ============================================================ */
(function (root) {
  "use strict";

  function decimate(opt, progress) {
    const { wpos, widx, twin, nf, nw, cornerUv, faceMat, target } = opt;
    const hasUv = !!cornerUv;
    const cv = new Int32Array(widx);              // 角 → 顶点（可变）
    const cnext = new Int32Array(nf * 3).fill(-1);
    const vhead = new Int32Array(nw).fill(-1);
    for (let c = nf * 3 - 1; c >= 0; c -= 1) { const v = cv[c]; cnext[c] = vhead[v]; vhead[v] = c; }
    const cuv = hasUv ? new Float32Array(cornerUv) : null;
    const fdead = new Uint8Array(nf);
    const vdead = new Uint8Array(nw);
    const kind = new Uint8Array(nw); // 0 manifold, 1 seam, 2 locked
    const seamCount = new Uint8Array(nw);
    const uvEq = (c1, c2) => !hasUv || (Math.abs(cuv[c1 * 2] - cuv[c2 * 2]) < 1e-6 && Math.abs(cuv[c1 * 2 + 1] - cuv[c2 * 2 + 1]) < 1e-6);
    const nextC = (c) => (c % 3 === 2 ? c - 2 : c + 1);

    // ---- 二次误差矩阵 ----
    const Q = new Float64Array(nw * 10);
    const addPlane = (v, a, b, c, d, w) => {
      const o = v * 10;
      Q[o] += w * a * a; Q[o + 1] += w * a * b; Q[o + 2] += w * a * c; Q[o + 3] += w * a * d;
      Q[o + 4] += w * b * b; Q[o + 5] += w * b * c; Q[o + 6] += w * b * d;
      Q[o + 7] += w * c * c; Q[o + 8] += w * c * d; Q[o + 9] += w * d * d;
    };
    const fn = new Float32Array(3);
    const faceNormal = (i0, i1, i2, out) => {
      const ax = wpos[i0 * 3], ay = wpos[i0 * 3 + 1], az = wpos[i0 * 3 + 2];
      const ux = wpos[i1 * 3] - ax, uy = wpos[i1 * 3 + 1] - ay, uz = wpos[i1 * 3 + 2] - az;
      const vx = wpos[i2 * 3] - ax, vy = wpos[i2 * 3 + 1] - ay, vz = wpos[i2 * 3 + 2] - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (out) { out[0] = nx; out[1] = ny; out[2] = nz; }
      return len;
    };
    for (let f = 0; f < nf; f += 1) {
      const a = cv[f * 3], b = cv[f * 3 + 1], c = cv[f * 3 + 2];
      const len = faceNormal(a, b, c, fn);
      if (len <= 0) continue;
      const nx = fn[0] / len, ny = fn[1] / len, nz = fn[2] / len;
      const d = -(nx * wpos[a * 3] + ny * wpos[a * 3 + 1] + nz * wpos[a * 3 + 2]);
      const w = len * 0.5;
      addPlane(a, nx, ny, nz, d, w); addPlane(b, nx, ny, nz, d, w); addPlane(c, nx, ny, nz, d, w);
    }
    // ---- 边分类：边界/非流形 → 锁定；接缝/材质边 → 约束平面 ----
    for (let h = 0; h < nf * 3; h += 1) {
      const t = twin[h];
      const a = cv[h], b = cv[nextC(h)];
      if (t < 0) { kind[a] = 2; kind[b] = 2; continue; }
      if (t < h) continue;
      const f = (h / 3) | 0, g = (t / 3) | 0;
      // twin 半边 t 的方向是 b→a
      const seam = faceMat[f] !== faceMat[g] || !uvEq(h, nextC(t)) || !uvEq(nextC(h), t);
      if (!seam) continue;
      if (seamCount[a] < 255) seamCount[a] += 1;
      if (seamCount[b] < 255) seamCount[b] += 1;
      // 约束平面：过边、垂直于面
      const len = faceNormal(cv[f * 3], cv[f * 3 + 1], cv[f * 3 + 2], fn);
      if (len <= 0) continue;
      const ex = wpos[b * 3] - wpos[a * 3], ey = wpos[b * 3 + 1] - wpos[a * 3 + 1], ez = wpos[b * 3 + 2] - wpos[a * 3 + 2];
      let px = ey * fn[2] - ez * fn[1], py = ez * fn[0] - ex * fn[2], pz = ex * fn[1] - ey * fn[0];
      const pl = Math.sqrt(px * px + py * py + pz * pz);
      if (pl <= 0) continue;
      px /= pl; py /= pl; pz /= pl;
      const d = -(px * wpos[a * 3] + py * wpos[a * 3 + 1] + pz * wpos[a * 3 + 2]);
      const w = 20 * (ex * ex + ey * ey + ez * ez);
      addPlane(a, px, py, pz, d, w); addPlane(b, px, py, pz, d, w);
    }
    for (let v = 0; v < nw; v += 1) {
      if (kind[v] === 2) continue;
      if (seamCount[v] === 0) kind[v] = 0;
      else if (seamCount[v] === 2) kind[v] = 1;
      else kind[v] = 2;
    }
    // 焊接后可能出现孤立顶点
    for (let v = 0; v < nw; v += 1) if (vhead[v] < 0) vdead[v] = 1;

    const quadErr = (o1, o2, x, y, z) => {
      const q = (k) => Q[o1 + k] + Q[o2 + k];
      return q(0) * x * x + 2 * q(1) * x * y + 2 * q(2) * x * z + 2 * q(3) * x
        + q(4) * y * y + 2 * q(5) * y * z + 2 * q(6) * y
        + q(7) * z * z + 2 * q(8) * z + q(9);
    };

    // ---- 邻接工具 ----
    const tmpC = [];
    const liveCorners = (v, out) => {
      out.length = 0;
      for (let c = vhead[v]; c >= 0; c = cnext[c]) {
        if (cv[c] !== v || fdead[(c / 3) | 0]) continue;
        out.push(c);
      }
      return out;
    };
    const nbrMark = new Int32Array(nw).fill(-1);
    let markStamp = 0;
    const nbrs = (v, out) => {
      out.length = 0; markStamp += 1;
      for (let c = vhead[v]; c >= 0; c = cnext[c]) {
        if (cv[c] !== v || fdead[(c / 3) | 0]) continue;
        const f = (c / 3) | 0;
        for (let k = 0; k < 3; k += 1) {
          const w = cv[f * 3 + k];
          if (w !== v && nbrMark[w] !== markStamp) { nbrMark[w] = markStamp; out.push(w); }
        }
      }
      return out;
    };
    // 是否为接缝边（通过当前两侧面判断）
    const edgeFaces = (u, v, out) => {
      out.length = 0;
      for (let c = vhead[u]; c >= 0; c = cnext[c]) {
        if (cv[c] !== u) continue;
        const f = (c / 3) | 0;
        if (fdead[f]) continue;
        if (cv[f * 3] === v || cv[f * 3 + 1] === v || cv[f * 3 + 2] === v) out.push(c);
      }
      return out;
    };
    const compact = (v) => {
      let prev = -1;
      for (let c = vhead[v]; c >= 0;) {
        const nx = cnext[c];
        if (cv[c] !== v || fdead[(c / 3) | 0]) {
          if (prev < 0) vhead[v] = nx; else cnext[prev] = nx;
        } else prev = c;
        c = nx;
      }
    };
    const cornerOf = (f, v) => (cv[f * 3] === v ? f * 3 : cv[f * 3 + 1] === v ? f * 3 + 1 : f * 3 + 2);

    const nA = [], nB = [], ef = [], lc = [];
    const n0 = new Float32Array(3), n1 = new Float32Array(3);
    // 检查 u→v 合法性；合法时返回 true，并把新 UV 规则写进 rule
    const rule = { ucA: -1, vcA: -1, vcB: -1 };
    function canCollapse(u, v) {
      if (vdead[u] || vdead[v] || kind[u] === 2) return false;
      edgeFaces(u, v, ef);
      if (ef.length !== 2) return false;
      const fA = (ef[0] / 3) | 0, fB = (ef[1] / 3) | 0;
      const ucA = ef[0], ucB = ef[1];
      const vcA = cornerOf(fA, v), vcB = cornerOf(fB, v);
      const seamEdge = faceMat[fA] !== faceMat[fB] || !uvEq(ucA, ucB) || !uvEq(vcA, vcB);
      if (kind[u] === 0 && seamEdge) return false;
      if (kind[u] === 1 && !seamEdge) return false;
      if (kind[u] === 1 && kind[v] === 0) return false;
      // link 条件
      nbrs(u, nA);
      const stampU = markStamp;
      nbrs(v, nB);
      let common = 0;
      for (let i = 0; i < nA.length; i += 1) if (nbrMark[nA[i]] === markStamp) common += 1;
      void stampU;
      if (common !== 2) return false;
      // 翻面 & UV 翻转检查
      const px = wpos[v * 3], py = wpos[v * 3 + 1], pz = wpos[v * 3 + 2];
      liveCorners(u, lc);
      for (let i = 0; i < lc.length; i += 1) {
        const c = lc[i], f = (c / 3) | 0;
        if (f === fA || f === fB) continue;
        const a = cv[f * 3], b = cv[f * 3 + 1], d = cv[f * 3 + 2];
        const l0 = faceNormal(a, b, d, n0);
        if (l0 <= 0) continue;
        const k = c - f * 3;
        const ox = wpos[u * 3], oy = wpos[u * 3 + 1], oz = wpos[u * 3 + 2];
        wpos[u * 3] = px; wpos[u * 3 + 1] = py; wpos[u * 3 + 2] = pz;
        const l1 = faceNormal(a, b, d, n1);
        wpos[u * 3] = ox; wpos[u * 3 + 1] = oy; wpos[u * 3 + 2] = oz;
        if (l1 <= 1e-12) return false;
        const dot = (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]) / (l0 * l1);
        if (dot < 0.3) return false;
        if (hasUv) {
          const src = kind[u] === 0 || uvEq(c, ucA) ? vcA : vcB;
          const i0 = f * 3, i1 = f * 3 + 1, i2 = f * 3 + 2;
          const U = (ci) => (ci === c ? cuv[src * 2] : cuv[ci * 2]);
          const V = (ci) => (ci === c ? cuv[src * 2 + 1] : cuv[ci * 2 + 1]);
          const before = (cuv[i1 * 2] - cuv[i0 * 2]) * (cuv[i2 * 2 + 1] - cuv[i0 * 2 + 1]) - (cuv[i2 * 2] - cuv[i0 * 2]) * (cuv[i1 * 2 + 1] - cuv[i0 * 2 + 1]);
          const after = (U(i1) - U(i0)) * (V(i2) - V(i0)) - (U(i2) - U(i0)) * (V(i1) - V(i0));
          if (before * after < 0) return false;
        }
        void k;
      }
      rule.ucA = ucA; rule.vcA = vcA; rule.vcB = vcB;
      return true;
    }

    // ---- 堆 ----
    let hcap = nw + 16;
    let hcost = new Float64Array(hcap), hv = new Int32Array(hcap), hto = new Int32Array(hcap), hver = new Int32Array(hcap);
    let hn = 0;
    const ver = new Int32Array(nw);
    const hswap = (i, j) => {
      let t = hcost[i]; hcost[i] = hcost[j]; hcost[j] = t;
      let s = hv[i]; hv[i] = hv[j]; hv[j] = s;
      s = hto[i]; hto[i] = hto[j]; hto[j] = s;
      s = hver[i]; hver[i] = hver[j]; hver[j] = s;
    };
    const hpush = (cost, v, to) => {
      if (hn >= hcap) {
        hcap *= 2;
        const a = new Float64Array(hcap); a.set(hcost); hcost = a;
        const b = new Int32Array(hcap); b.set(hv); hv = b;
        const c = new Int32Array(hcap); c.set(hto); hto = c;
        const d = new Int32Array(hcap); d.set(hver); hver = d;
      }
      let i = hn++;
      hcost[i] = cost; hv[i] = v; hto[i] = to; hver[i] = ver[v];
      while (i > 0) { const p = (i - 1) >> 1; if (hcost[p] <= hcost[i]) break; hswap(i, p); i = p; }
    };
    const hpop = () => {
      hn -= 1;
      if (hn > 0) {
        hswap(0, hn);
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < hn && hcost[l] < hcost[m]) m = l;
          if (r < hn && hcost[r] < hcost[m]) m = r;
          if (m === i) break;
          hswap(i, m); i = m;
        }
      }
      return hn; // 弹出元素位于下标 hn
    };

    const cand = [];
    const evCost = new Float64Array(256), evV = new Int32Array(256);
    const dirty = new Uint8Array(nw);
    // validate=false：只取代价最小的邻点（下界），弹出时再校验
    function evaluate(u, validate) {
      ver[u] += 1;
      dirty[u] = 0;
      if (vdead[u] || kind[u] === 2) return;
      nbrs(u, cand);
      const n = cand.length;
      if (n > 256) return;
      let m = -1, mc = Infinity;
      for (let i = 0; i < n; i += 1) {
        const v = cand[i];
        if (kind[u] === 1 && kind[v] === 0) { evV[i] = -1; continue; }
        const c = quadErr(u * 10, v * 10, wpos[v * 3], wpos[v * 3 + 1], wpos[v * 3 + 2]);
        evCost[i] = c; evV[i] = v;
        if (c < mc) { mc = c; m = i; }
      }
      if (m < 0) return;
      if (!validate) { hpush(mc, u, evV[m]); return; }
      for (let tries = 0; tries < n; tries += 1) {
        m = -1; mc = Infinity;
        for (let i = 0; i < n; i += 1) if (evV[i] >= 0 && evCost[i] < mc) { mc = evCost[i]; m = i; }
        if (m < 0) break;
        const v = evV[m];
        evV[m] = -1;
        if (canCollapse(u, v)) { hpush(mc, u, v); return; }
      }
    }

    for (let v = 0; v < nw; v += 1) {
      evaluate(v, false);
      if ((v & 131071) === 0 && progress) progress(0.1 * v / nw, "减面：计算误差");
    }

    let liveFaces = 0;
    for (let f = 0; f < nf; f += 1) {
      const a = cv[f * 3], b = cv[f * 3 + 1], c = cv[f * 3 + 2];
      if (a === b || b === c || a === c) fdead[f] = 1; else liveFaces += 1;
    }
    const startFaces = liveFaces;
    let steps = 0;
    const affected = [];
    const lastTried = new Int32Array(nw).fill(-1);
    while (liveFaces > target && hn > 0) {
      const top = hpop();
      const u = hv[top], v = hto[top];
      if (hver[top] !== ver[u] || vdead[u]) continue;
      if (vdead[v] || dirty[u]) { evaluate(u, false); continue; }
      if (!canCollapse(u, v)) {
        // 同一目标连续失败 → 走校验版评估，避免死循环
        if (lastTried[u] === v) evaluate(u, true); else { lastTried[u] = v; evaluate(u, true); }
        continue;
      }
      // 执行 u → v
      const { ucA, vcA, vcB } = rule;
      liveCorners(u, tmpC);
      const moved = tmpC.slice();
      const opp = [];
      const useA = hasUv ? [cuv[ucA * 2], cuv[ucA * 2 + 1]] : null;
      for (let i = 0; i < moved.length; i += 1) {
        const c = moved[i], f = (c / 3) | 0;
        if (cv[f * 3] === v || cv[f * 3 + 1] === v || cv[f * 3 + 2] === v) {
          fdead[f] = 1; liveFaces -= 1;
          for (let k = 0; k < 3; k += 1) { const w = cv[f * 3 + k]; if (w !== u && w !== v) opp.push(w); }
          continue;
        }
        if (hasUv) {
          const inA = kind[u] === 0 || (Math.abs(cuv[c * 2] - useA[0]) < 1e-6 && Math.abs(cuv[c * 2 + 1] - useA[1]) < 1e-6);
          const src = inA ? vcA : vcB;
          cuv[c * 2] = cuv[src * 2]; cuv[c * 2 + 1] = cuv[src * 2 + 1];
        }
      }
      for (let i = 0; i < moved.length; i += 1) {
        const c = moved[i], f = (c / 3) | 0;
        if (fdead[f]) continue;
        cv[c] = v;
        cnext[c] = vhead[v]; vhead[v] = c;
      }
      vdead[u] = 1;
      compact(v);
      for (let i = 0; i < opp.length; i += 1) compact(opp[i]);
      for (let k = 0; k < 10; k += 1) Q[v * 10 + k] += Q[u * 10 + k];
      nbrs(v, affected);
      for (let i = 0; i < affected.length; i += 1) dirty[affected[i]] = 1;
      evaluate(v, false);
      steps += 1;
      if ((steps & 32767) === 0 && progress) progress(0.1 + 0.9 * (startFaces - liveFaces) / Math.max(1, startFaces - target), `减面：${liveFaces.toLocaleString()} 面`);
      if ((steps & 65535) === 0 && hn > 6 * nw) {
        hn = 0;
        for (let w = 0; w < nw; w += 1) if (!vdead[w]) evaluate(w, false);
      }
    }

    // ---- 输出 ----
    const vmap = new Int32Array(nw).fill(-1);
    let nlv = 0, nlf = 0;
    for (let f = 0; f < nf; f += 1) if (!fdead[f]) nlf += 1;
    const lidx = new Uint32Array(nlf * 3);
    const luv = hasUv ? new Float32Array(nlf * 6) : null;
    const lmat = new Uint16Array(nlf);
    const lsrc = new Uint32Array(nlf);
    let j = 0;
    for (let f = 0; f < nf; f += 1) {
      if (fdead[f]) continue;
      for (let k = 0; k < 3; k += 1) {
        const w = cv[f * 3 + k];
        if (vmap[w] < 0) vmap[w] = nlv++;
        lidx[j * 3 + k] = vmap[w];
        if (luv) { luv[j * 6 + k * 2] = cuv[(f * 3 + k) * 2]; luv[j * 6 + k * 2 + 1] = cuv[(f * 3 + k) * 2 + 1]; }
      }
      lmat[j] = faceMat[f];
      lsrc[j] = f;
      j += 1;
    }
    const lpos = new Float32Array(nlv * 3);
    for (let w = 0; w < nw; w += 1) {
      const m = vmap[w];
      if (m < 0) continue;
      lpos[m * 3] = wpos[w * 3]; lpos[m * 3 + 1] = wpos[w * 3 + 1]; lpos[m * 3 + 2] = wpos[w * 3 + 2];
    }
    let locked = 0, seam = 0;
    for (let v = 0; v < nw; v += 1) { if (kind[v] === 2) locked += 1; else if (kind[v] === 1) seam += 1; }
    return { lpos, lidx, luv, lmat, lsrc, nlv, nlf, locked, seam };
  }

  root.MCDecimate = { decimate };
})(typeof self !== "undefined" ? self : this);
