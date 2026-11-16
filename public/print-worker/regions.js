/* global MC */
(function (root) {
  'use strict';
  const lightness = 0.25;
  const distance = (a, b) => (a[0] - b[0]) ** 2 * lightness ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

  function build(s, base, sourceLabels) {
    const { nf, positions: p, indices: idx, twin } = s;
    const normals = new Float32Array(nf * 3);
    const seeds = sourceLabels || new Uint8Array(nf);
    for (let f = 0; f < nf; f++) {
      const a = idx[f * 3] * 3, b = idx[f * 3 + 1] * 3, c = idx[f * 3 + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
      const length = Math.hypot(x, y, z) || 1;
      normals[f * 3] = x / length; normals[f * 3 + 1] = y / length; normals[f * 3 + 2] = z / length;
      if (!sourceLabels) {
        const color = s.faceOk.subarray(f * 3, f * 3 + 3);
        let best = Infinity;
        base.forEach((b, i) => { const d = distance(color, b.ok); if (d < best) { best = d; seeds[f] = i; } });
      }
    }
    const continuity = (f, g) => normals[f * 3] * normals[g * 3] + normals[f * 3 + 1] * normals[g * 3 + 1] + normals[f * 3 + 2] * normals[g * 3 + 2];
    const faceRegion = new Uint32Array(nf).fill(0xffffffff), queue = new Uint32Array(nf);
    const sizes = new Uint32Array(nf), regionSeed = new Uint8Array(nf);
    let count = 0;
    for (let seed = 0; seed < nf; seed++) {
      if (faceRegion[seed] !== 0xffffffff) continue;
      let begin = 0, end = 1; queue[0] = seed; faceRegion[seed] = count;
      while (begin < end) {
        const f = queue[begin++];
        for (let edge = 0; edge < 3; edge++) {
          const t = twin[f * 3 + edge]; if (t < 0) continue;
          const g = Math.floor(t / 3);
          if (faceRegion[g] === 0xffffffff && seeds[g] === seeds[f] && continuity(f, g) >= 0.98) {
            faceRegion[g] = count; queue[end++] = g;
          }
        }
      }
      sizes[count] = end; regionSeed[count] = seeds[seed]; count++;
    }
    let edges = 0;
    for (let h = 0; h < twin.length; h++) if (twin[h] > h && faceRegion[Math.floor(h / 3)] !== faceRegion[Math.floor(twin[h] / 3)]) edges += 2;
    const head = new Int32Array(count).fill(-1), tail = new Int32Array(count).fill(-1);
    const to = new Uint32Array(edges), next = new Int32Array(edges), score = new Float32Array(edges);
    let cursor = 0;
    const add = (a, b, weight) => { to[cursor] = b; next[cursor] = head[a]; score[cursor] = weight; if (tail[a] < 0) tail[a] = cursor; head[a] = cursor++; };
    for (let h = 0; h < twin.length; h++) {
      if (twin[h] <= h) continue;
      const f = Math.floor(h / 3), g = Math.floor(twin[h] / 3), a = faceRegion[f], b = faceRegion[g];
      if (a !== b) { const weight = continuity(f, g); add(a, b, weight); add(b, a, weight); }
    }
    return { faceRegion, count, sizes: sizes.slice(0, count), seed: regionSeed.slice(0, count), head, tail, to, next, score, base, levels: MC.mergeTree(base, true, lightness), merges: new Map() };
  }

  function merge(graph, detail) {
    if (graph.merges.has(detail)) return graph.merges.get(detail);
    const { count, to, score, seed } = graph;
    const parent = Uint32Array.from({ length: count }, (_, i) => i), sizes = graph.sizes.slice();
    const head = graph.head.slice(), tail = graph.tail.slice(), next = graph.next.slice();
    const find = value => { let r = value; while (parent[r] !== r) r = parent[r]; while (parent[value] !== value) { const p = parent[value]; parent[value] = r; value = p; } return r; };
    const fractions = [0.03, 0.01, 0.003, 0.001, 0.0003, 0];
    const threshold = Math.ceil(graph.faceRegion.length * fractions[detail - 1]);
    const heap = [];
    const push = (id, size) => {
      const value = { id, size }; let i = heap.length; heap.push(value);
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p].size <= size) break; heap[i] = heap[p]; i = p; } heap[i] = value;
    };
    const pop = () => {
      const first = heap[0], last = heap.pop();
      if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let c = i * 2 + 1; if (c + 1 < heap.length && heap[c + 1].size < heap[c].size) c++; if (last.size <= heap[c].size) break; heap[i] = heap[c]; i = c; } heap[i] = last; }
      return first;
    };
    sizes.forEach((size, id) => { if (size < threshold) push(id, size); });
    while (heap.length) {
      const { id, size } = pop();
      if (parent[id] !== id || sizes[id] !== size || size >= threshold) continue;
      let best = -1, weight = -Infinity;
      for (let e = head[id]; e >= 0; e = next[e]) {
        const neighbor = find(to[e]);
        if (neighbor === id) continue;
        if (score[e] > weight || score[e] === weight && (best < 0 || sizes[neighbor] > sizes[best])) { best = neighbor; weight = score[e]; }
      }
      if (best < 0) continue;
      parent[id] = best; sizes[best] += size;
      if (head[id] >= 0) { next[tail[id]] = head[best]; head[best] = head[id]; if (tail[best] < 0) tail[best] = tail[id]; }
      if (sizes[best] < threshold) push(best, sizes[best]);
    }
    const result = Uint8Array.from({ length: count }, (_, i) => seed[find(i)]);
    graph.merges.set(detail, result);
    return result;
  }

  function preview(graph, options, area, totalArea) {
    const { base } = graph;
    const clusters = graph.levels[Math.min(options.N, base.length)];
    const baseToSlot = new Uint8Array(base.length);
    const candidates = options.cands.map(c => ({ ...c, lab: MC.hexToLab(c.hex) }));
    const slots = clusters.map((cluster, index) => {
      const representative = cluster.members.reduce((best, i) => distance(base[i].ok, cluster.ok) < distance(base[best].ok, cluster.ok) ? i : best, cluster.members[0]);
      cluster.members.forEach(i => { baseToSlot[i] = index; });
      const source = base[representative], lab = MC.hexToLab(source.hex);
      let best = candidates[0], de = Infinity;
      for (const c of candidates) { const d = MC.deltaE00(...lab, ...c.lab); if (d < de) { best = c; de = d; } }
      return { hex: best?.hex ?? source.hex, sourceHex: source.hex, ok: source.ok, filamentId: best?.id ?? null, w: 0, de: 0 };
    });
    const merged = merge(graph, options.detail), labels = new Uint8Array(graph.faceRegion.length);
    for (let f = 0; f < labels.length; f++) {
      const seed = merged[graph.faceRegion[f]], slot = baseToSlot[seed], w = area[f] / Math.max(totalArea, 1e-12);
      labels[f] = slot; slots[slot].w += w;
    }
    // At most 24 source colors: color-error work stays independent of face count.
    const weights = new Float64Array(base.length);
    for (let f = 0; f < labels.length; f++) weights[merged[graph.faceRegion[f]]] += area[f] / Math.max(totalArea, 1e-12);
    base.forEach((source, i) => { const slot = slots[baseToSlot[i]]; slot.de += MC.deltaE00(...MC.hexToLab(source.hex), ...MC.hexToLab(slot.hex)) * weights[i]; });
    slots.forEach(slot => { slot.de /= Math.max(slot.w, 1e-12); });
    return { label: labels, slots };
  }
  root.MCRegions = { build, preview };
})(typeof self !== 'undefined' ? self : this);
