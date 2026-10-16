/* Geometry-bound editing: UV overlap never aliases independent model faces. */
(function (root) {
  'use strict';
  const EPS = 1e-6;
  const quant = value => Math.round(value / EPS);
  function components(count, adjacency, enabled = () => true) {
    const ids = new Int32Array(count).fill(-1); let groups = 0;
    for (let seed = 0; seed < count; seed++) {
      if (ids[seed] >= 0 || !enabled(seed)) continue;
      const queue = [seed]; ids[seed] = groups;
      for (let q = 0; q < queue.length; q++) for (const next of adjacency[queue[q]]) {
        if (ids[next] < 0 && enabled(next)) { ids[next] = groups; queue.push(next); }
      }
      groups++;
    }
    return { ids, count: groups };
  }
  function sourceTopology(input) {
    const nf = input.indices.length / 3;
    const uv = input.rawUvs ?? input.uvs;
    const vertices = input.topologyVertices ?? (() => {
      const map = new Map(); const ids = new Uint32Array(input.positions.length / 3);
      for (let v = 0; v < ids.length; v++) {
        const key = Array.from(input.positions.subarray(v * 3, v * 3 + 3)).join(',');
        if (!map.has(key)) map.set(key, map.size); ids[v] = map.get(key);
      }
      return ids;
    })();
    const adjacent = Array.from({ length: nf }, () => []);
    const uvAdjacent = Array.from({ length: nf }, () => []);
    const faceUV = new Float32Array(nf * 6);
    const valid = new Uint8Array(nf); const atlas = new Int32Array(nf).fill(-1);
    const edges = new Map(); const faceEdges = new Array(nf * 3);
    for (let f = 0; f < nf; f++) {
      const corners = [0, 1, 2].map(c => input.indices[f * 3 + c]);
      if (uv && (!input.uvValid || input.uvValid[f])) {
        const values = corners.flatMap(v => [uv[v * 2], uv[v * 2 + 1]]);
        const area = (values[2] - values[0]) * (values[5] - values[1]) - (values[4] - values[0]) * (values[3] - values[1]);
        if (values.every(Number.isFinite) && Math.abs(area) > 1e-12) {
          valid[f] = 1; faceUV.set(values, f * 6); atlas[f] = input.faceMat[f];
        }
      }
      for (let e = 0; e < 3; e++) {
        const a = vertices[corners[e]], b = vertices[corners[(e + 1) % 3]];
        const key = `${input.faceDomain?.[f] ?? 0}:${Math.min(a, b)}:${Math.max(a, b)}`;
        const edge = { face: f, corner: e, forward: a < b, key };
        faceEdges[f * 3 + e] = edge;
        if (!edges.has(key)) edges.set(key, []); edges.get(key).push(edge);
      }
    }
    for (const list of edges.values()) {
      // Do not bridge ambiguous, non-manifold or coincident shells.
      if (list.length !== 2 || list[0].forward === list[1].forward) continue;
      const [a, b] = list; adjacent[a.face].push(b.face); adjacent[b.face].push(a.face);
      if (!valid[a.face] || !valid[b.face] || atlas[a.face] !== atlas[b.face]) continue;
      const au = a.face * 6 + a.corner * 2, av = a.face * 6 + ((a.corner + 1) % 3) * 2;
      const bu = b.face * 6 + b.corner * 2, bv = b.face * 6 + ((b.corner + 1) % 3) * 2;
      if ([0, 1].every(d => Math.abs(faceUV[au + d] - faceUV[bv + d]) < EPS && Math.abs(faceUV[av + d] - faceUV[bu + d]) < EPS)) {
        uvAdjacent[a.face].push(b.face); uvAdjacent[b.face].push(a.face);
      }
    }
    return { islands: components(nf, uvAdjacent, f => valid[f]), parts: components(nf, adjacent), faceUV, atlas, faceEdges, edges };
  }
  function barycentric(input, face, point) {
    const v = [0, 1, 2].map(c => input.indices[face * 3 + c] * 3);
    let aa = 0, ab = 0, bb = 0, ap = 0, bp = 0;
    for (let d = 0; d < 3; d++) {
      const a = input.positions[v[1] + d] - input.positions[v[0] + d];
      const b = input.positions[v[2] + d] - input.positions[v[0] + d];
      const p = point[d] - input.positions[v[0] + d];
      aa += a * a; ab += a * b; bb += b * b; ap += a * p; bp += b * p;
    }
    const det = aa * bb - ab * ab;
    if (Math.abs(det) < 1e-24) return [1, 0, 0];
    const y = (bb * ap - ab * bp) / det, z = (aa * bp - ab * ap) / det;
    return [1 - y - z, y, z];
  }
  function create(input, positions, labels, sourceFaces) {
    const topology = sourceTopology(input); const nf = labels.length;
    const uvs = new Float32Array(nf * 6); const faceIsland = new Int32Array(nf);
    const facePart = new Uint32Array(nf); const faceAtlas = new Int32Array(nf);
    const adjacency = Array.from({ length: nf }, () => []); const lines = new Map();
    for (let f = 0; f < nf; f++) {
      const source = sourceFaces[f]; faceIsland[f] = topology.islands.ids[source];
      facePart[f] = topology.parts.ids[source]; faceAtlas[f] = topology.atlas[source];
      const bary = [0, 1, 2].map(c => barycentric(input, source, positions.subarray(f * 9 + c * 3, f * 9 + c * 3 + 3)));
      for (let c = 0; c < 3; c++) for (let d = 0; d < 2; d++) {
        uvs[f * 6 + c * 2 + d] = bary[c].reduce((sum, weight, i) => sum + weight * topology.faceUV[source * 6 + i * 2 + d], 0);
      }
      // Dyadic adaptive subdivision can create T junctions. Match overlapping edge intervals,
      // not only identical endpoint pairs, including across original source triangles.
      for (let e = 0; e < 3; e++) {
        const a = bary[e], b = bary[(e + 1) % 3];
        const axis = [0, 1, 2].find(d => Math.abs(a[d] - b[d]) < EPS);
        if (axis === undefined) continue;
        let key, t0, t1;
        if (Math.abs(a[axis]) < EPS) {
          const edge = topology.faceEdges[source * 3 + (axis + 1) % 3];
          const peers = topology.edges.get(edge.key);
          // Ambiguous edges remain local to the source triangle.
          key = peers.length === 2 && peers[0].forward !== peers[1].forward ? edge.key : `${edge.key}:f${source}`;
          const end = (axis + 2) % 3;
          t0 = edge.forward ? a[end] : 1 - a[end]; t1 = edge.forward ? b[end] : 1 - b[end];
        } else { key = `inside:${source}:${axis}:${quant(a[axis])}`; t0 = a[(axis + 1) % 3]; t1 = b[(axis + 1) % 3]; }
        if (!lines.has(key)) lines.set(key, []);
        lines.get(key).push({ face: f, lo: Math.min(t0, t1), hi: Math.max(t0, t1) });
      }
    }
    for (const entries of lines.values()) {
      entries.sort((a, b) => a.lo - b.lo);
      for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length && entries[j].lo < entries[i].hi - EPS; j++) {
        const a = entries[i], b = entries[j];
        if (a.face !== b.face && Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) > EPS) {
          adjacency[a.face].push(b.face); adjacency[b.face].push(a.face);
        }
      }
    }
    return { positions, labels, sourceFaces, uvs, faceIsland, facePart, faceAtlas, islandCount: topology.islands.count, partCount: topology.parts.count, adjacency };
  }
  function select(data, face, scope, groups) {
    if (!Number.isInteger(face) || face < 0 || face >= data.labels.length) throw new Error('Invalid selected face.');
    if (scope === 'island' || scope === 'part') {
      const ids = scope === 'island' ? data.faceIsland : data.facePart; const id = ids[face];
      return id < 0 ? new Uint32Array() : Uint32Array.from(ids.reduce((faces, value, i) => { if (value === id) faces.push(i); return faces; }, []));
    }
    if (scope !== 'color') throw new Error('Invalid selection scope.');
    const group = groups[data.labels[face]]; const seen = new Uint8Array(data.labels.length); const queue = [face]; seen[face] = 1;
    for (let q = 0; q < queue.length; q++) for (const next of data.adjacency[queue[q]]) {
      if (!seen[next] && groups[data.labels[next]] === group) { seen[next] = 1; queue.push(next); }
    }
    return Uint32Array.from(queue);
  }
  root.MCRefine = { create, select };
})(typeof self !== 'undefined' ? self : this);
