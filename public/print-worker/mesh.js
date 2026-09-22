/* ============================================================
 * mesh.js — 大网格基础设施（typed array，面向 200 万面）
 *   焊接 / 半边邻接 / BVH（构建在 Worker，射线与球查询在主线程）
 * ============================================================ */
(function (root) {
  "use strict";

  function nextPow2(n) { let p = 1; while (p < n) p <<= 1; return p; }

  // 按量化坐标焊接：返回 wid(原顶点→焊接id), wpos
  function weld(positions, eps) {
    const nv = positions.length / 3;
    const size = nextPow2(nv * 2);
    const mask = size - 1;
    const table = new Int32Array(size).fill(-1);
    const wid = new Uint32Array(nv);
    const rep = new Int32Array(nv); // 焊接 id → 代表原顶点
    const inv = 1 / eps;
    let nw = 0;
    for (let i = 0; i < nv; i += 1) {
      const x = Math.round(positions[i * 3] * inv), y = Math.round(positions[i * 3 + 1] * inv), z = Math.round(positions[i * 3 + 2] * inv);
      let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & mask;
      for (;;) {
        const t = table[h];
        if (t < 0) { table[h] = nw; rep[nw] = i; wid[i] = nw; nw += 1; break; }
        const j = rep[t];
        if (Math.round(positions[j * 3] * inv) === x && Math.round(positions[j * 3 + 1] * inv) === y && Math.round(positions[j * 3 + 2] * inv) === z) { wid[i] = t; break; }
        h = (h + 1) & mask;
      }
    }
    const wpos = new Float32Array(nw * 3);
    for (let w = 0; w < nw; w += 1) { const j = rep[w]; wpos[w * 3] = positions[j * 3]; wpos[w * 3 + 1] = positions[j * 3 + 1]; wpos[w * 3 + 2] = positions[j * 3 + 2]; }
    return { wid, wpos, nw };
  }

  // 半边邻接：twin[h] = 对侧半边 (f*3+e)；-1 边界；-2 非流形
  function halfEdgeTwins(widx, nf) {
    const nh = nf * 3;
    const size = nextPow2(Math.ceil(nh * 1.3));
    const mask = size - 1;
    const table = new Int32Array(size).fill(-1);
    const twin = new Int32Array(nh).fill(-1);
    for (let h = 0; h < nh; h += 1) {
      const f = (h / 3) | 0, e = h - f * 3;
      const a = widx[h], b = widx[f * 3 + ((e + 1) % 3)];
      if (a === b) { twin[h] = -2; continue; }
      const lo = a < b ? a : b, hi = a < b ? b : a;
      let k = (Math.imul(lo, 73856093) ^ Math.imul(hi, 19349663)) & mask;
      for (;;) {
        const t = table[k];
        if (t < 0) { table[k] = h; break; }
        const tf = (t / 3) | 0, te = t - tf * 3;
        const ta = widx[t], tb = widx[tf * 3 + ((te + 1) % 3)];
        if ((ta === lo && tb === hi) || (ta === hi && tb === lo)) {
          if (twin[t] === -1) { twin[t] = h; twin[h] = t; }
          else { // 第三条及以上：非流形
            if (twin[t] >= 0) twin[twin[t]] = -2;
            twin[t] = -2; twin[h] = -2;
          }
          break;
        }
        k = (k + 1) & mask;
      }
    }
    return twin;
  }

  // ---------- BVH ----------
  // nodes: bounds Float32(6/节点)，info Int32(2/节点)：内部节点 [left, -1-right]? 统一：
  //   叶子：info0 = start, info1 = count (>0)；内部：info0 = 右子节点, info1 = 0（左子节点 = 自身+1）
  function buildBVH(pos, widx, nf) {
    const cen = new Float32Array(nf * 3);
    for (let f = 0; f < nf; f += 1) {
      const a = widx[f * 3] * 3, b = widx[f * 3 + 1] * 3, c = widx[f * 3 + 2] * 3;
      cen[f * 3] = (pos[a] + pos[b] + pos[c]) / 3;
      cen[f * 3 + 1] = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3;
      cen[f * 3 + 2] = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
    }
    const order = new Uint32Array(nf);
    for (let i = 0; i < nf; i += 1) order[i] = i;
    const maxNodes = Math.ceil(nf / 2) * 2 + 1;
    let bounds = new Float32Array(Math.min(maxNodes, 1 << 20) * 6);
    let info = new Int32Array(bounds.length / 3);
    let nn = 0;
    const LEAF = 8;
    const alloc = () => {
      if ((nn + 1) * 6 > bounds.length) {
        const nb = new Float32Array(bounds.length * 2); nb.set(bounds); bounds = nb;
        const ni = new Int32Array(info.length * 2); ni.set(info); info = ni;
      }
      return nn++;
    };
    function select(lo, hi, k, axis) { // quickselect on order[lo,hi)
      while (hi - lo > 1) {
        const pv = cen[order[(lo + hi) >> 1] * 3 + axis];
        let i = lo, j = hi - 1;
        while (i <= j) {
          while (cen[order[i] * 3 + axis] < pv) i += 1;
          while (cen[order[j] * 3 + axis] > pv) j -= 1;
          if (i <= j) { const t = order[i]; order[i] = order[j]; order[j] = t; i += 1; j -= 1; }
        }
        if (k <= j) hi = j + 1; else if (k >= i) lo = i; else return;
      }
    }
    const stack = [[0, nf, -1]]; // start, end, parentSlotToPatch
    // 递归改迭代：前序，左子节点紧随其后
    const build = (start, end) => {
      const node = alloc();
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      let cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
      for (let i = start; i < end; i += 1) {
        const f = order[i];
        for (let k = 0; k < 3; k += 1) {
          const p = widx[f * 3 + k] * 3;
          const x = pos[p], y = pos[p + 1], z = pos[p + 2];
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
          if (z < z0) z0 = z; if (z > z1) z1 = z;
        }
        const cx = cen[f * 3], cy = cen[f * 3 + 1], cz = cen[f * 3 + 2];
        if (cx < cx0) cx0 = cx; if (cx > cx1) cx1 = cx;
        if (cy < cy0) cy0 = cy; if (cy > cy1) cy1 = cy;
        if (cz < cz0) cz0 = cz; if (cz > cz1) cz1 = cz;
      }
      const o = node * 6;
      bounds[o] = x0; bounds[o + 1] = y0; bounds[o + 2] = z0; bounds[o + 3] = x1; bounds[o + 4] = y1; bounds[o + 5] = z1;
      return { node, ex: [cx1 - cx0, cy1 - cy0, cz1 - cz0] };
    };
    stack.length = 0;
    const work = [{ start: 0, end: nf, patch: -1 }];
    while (work.length) {
      const { start, end, patch } = work.pop();
      const { node, ex } = build(start, end);
      if (patch >= 0) info[patch * 2] = node;
      const n = end - start;
      if (n <= LEAF || Math.max(ex[0], ex[1], ex[2]) <= 0) {
        info[node * 2] = start; info[node * 2 + 1] = n;
        continue;
      }
      const axis = ex[0] >= ex[1] && ex[0] >= ex[2] ? 0 : ex[1] >= ex[2] ? 1 : 2;
      const mid = (start + end) >> 1;
      select(start, end, mid, axis);
      info[node * 2 + 1] = 0;
      // 先压右（稍后处理），再压左（立即处理 → 左子节点 = node+1）
      work.push({ start: mid, end, patch: node });
      work.push({ start, end: mid, patch: -1 });
    }
    return { bounds: bounds.slice(0, nn * 6), info: info.slice(0, nn * 2), order, nodes: nn };
  }

  // 射线：返回 {face, t, u, v} 或 null
  function raycastBVH(bvh, pos, widx, ox, oy, oz, dx, dy, dz) {
    const { bounds, info, order } = bvh;
    const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz;
    const stack = new Int32Array(128);
    let sp = 0; stack[sp++] = 0;
    let bestT = Infinity, bestF = -1;
    while (sp) {
      const n = stack[--sp];
      const o = n * 6;
      let t0 = ((idx >= 0 ? bounds[o] : bounds[o + 3]) - ox) * idx;
      let t1 = ((idx >= 0 ? bounds[o + 3] : bounds[o]) - ox) * idx;
      const ty0 = ((idy >= 0 ? bounds[o + 1] : bounds[o + 4]) - oy) * idy;
      const ty1 = ((idy >= 0 ? bounds[o + 4] : bounds[o + 1]) - oy) * idy;
      if (t0 > ty1 || ty0 > t1) continue;
      if (ty0 > t0) t0 = ty0; if (ty1 < t1) t1 = ty1;
      const tz0 = ((idz >= 0 ? bounds[o + 2] : bounds[o + 5]) - oz) * idz;
      const tz1 = ((idz >= 0 ? bounds[o + 5] : bounds[o + 2]) - oz) * idz;
      if (t0 > tz1 || tz0 > t1) continue;
      if (tz0 > t0) t0 = tz0; if (tz1 < t1) t1 = tz1;
      if (t1 < 0 || t0 > bestT) continue;
      const cnt = info[n * 2 + 1];
      if (cnt > 0) {
        const s = info[n * 2];
        for (let i = s; i < s + cnt; i += 1) {
          const f = order[i];
          const a = widx[f * 3] * 3, b = widx[f * 3 + 1] * 3, c = widx[f * 3 + 2] * 3;
          const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
          const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
          const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (Math.abs(det) < 1e-12) continue;
          const inv = 1 / det;
          const tx = ox - pos[a], ty = oy - pos[a + 1], tz = oz - pos[a + 2];
          const u = (tx * px + ty * py + tz * pz) * inv;
          if (u < 0 || u > 1) continue;
          const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
          const v = (dx * qx + dy * qy + dz * qz) * inv;
          if (v < 0 || u + v > 1) continue;
          const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
          if (t > 1e-9 && t < bestT) { bestT = t; bestF = f; }
        }
      } else {
        stack[sp++] = info[n * 2]; // 右
        stack[sp++] = n + 1;       // 左
      }
    }
    return bestF >= 0 ? { face: bestF, t: bestT } : null;
  }

  // 球查询：质心在球内的面 → 回调
  function sphereQuery(bvh, pos, widx, cx, cy, cz, r, cb) {
    const { bounds, info, order } = bvh;
    const r2 = r * r;
    const stack = new Int32Array(128);
    let sp = 0; stack[sp++] = 0;
    while (sp) {
      const n = stack[--sp];
      const o = n * 6;
      const qx = Math.max(bounds[o], Math.min(cx, bounds[o + 3])) - cx;
      const qy = Math.max(bounds[o + 1], Math.min(cy, bounds[o + 4])) - cy;
      const qz = Math.max(bounds[o + 2], Math.min(cz, bounds[o + 5])) - cz;
      if (qx * qx + qy * qy + qz * qz > r2) continue;
      const cnt = info[n * 2 + 1];
      if (cnt > 0) {
        const s = info[n * 2];
        for (let i = s; i < s + cnt; i += 1) {
          const f = order[i];
          const a = widx[f * 3] * 3, b = widx[f * 3 + 1] * 3, c = widx[f * 3 + 2] * 3;
          const x = (pos[a] + pos[b] + pos[c]) / 3 - cx, y = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3 - cy, z = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3 - cz;
          if (x * x + y * y + z * z <= r2) cb(f);
        }
      } else {
        stack[sp++] = info[n * 2];
        stack[sp++] = n + 1;
      }
    }
  }

  // 最近面（质心）查询：用于“无 UV 的低模”投影取色
  function nearestFace(bvh, pos, widx, cx, cy, cz, maxR) {
    const { bounds, info, order } = bvh;
    let best = -1, bd = maxR * maxR;
    const stack = new Int32Array(128);
    let sp = 0; stack[sp++] = 0;
    while (sp) {
      const n = stack[--sp];
      const o = n * 6;
      const qx = Math.max(bounds[o], Math.min(cx, bounds[o + 3])) - cx;
      const qy = Math.max(bounds[o + 1], Math.min(cy, bounds[o + 4])) - cy;
      const qz = Math.max(bounds[o + 2], Math.min(cz, bounds[o + 5])) - cz;
      if (qx * qx + qy * qy + qz * qz > bd) continue;
      const cnt = info[n * 2 + 1];
      if (cnt > 0) {
        const s = info[n * 2];
        for (let i = s; i < s + cnt; i += 1) {
          const f = order[i];
          const a = widx[f * 3] * 3, b = widx[f * 3 + 1] * 3, c = widx[f * 3 + 2] * 3;
          const x = (pos[a] + pos[b] + pos[c]) / 3 - cx, y = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3 - cy, z = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3 - cz;
          const d = x * x + y * y + z * z;
          if (d < bd) { bd = d; best = f; }
        }
      } else {
        stack[sp++] = info[n * 2];
        stack[sp++] = n + 1;
      }
    }
    return best;
  }

  root.MCMesh = { weld, halfEdgeTwins, buildBVH, raycastBVH, sphereQuery, nearestFace };
})(typeof self !== "undefined" ? self : this);
