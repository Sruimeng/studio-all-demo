(function (root) {
  'use strict';

  function sourceTopology(S) {
    if (S.editTopology) return S.editTopology;
    const p = S.positions, idx = S.indices, adjacency = new Uint32Array(S.nf * 3), counts = new Uint8Array(S.nf);
    const normals = new Float32Array(S.nf * 3);
    const equal = (a, b) => p[a] === p[b] && p[a + 1] === p[b + 1] && p[a + 2] === p[b + 2];
    for (let f = 0; f < S.nf; f++) {
      const a = idx[f * 3] * 3, b = idx[f * 3 + 1] * 3, c = idx[f * 3 + 2] * 3;
      const x = p[b] - p[a], y = p[b + 1] - p[a + 1], z = p[b + 2] - p[a + 2];
      const u = p[c] - p[a], v = p[c + 1] - p[a + 1], w = p[c + 2] - p[a + 2];
      const nx = y * w - z * v, ny = z * u - x * w, nz = x * v - y * u, length = Math.hypot(nx, ny, nz) || 1;
      normals[f * 3] = nx / length; normals[f * 3 + 1] = ny / length; normals[f * 3 + 2] = nz / length;
      for (let e = 0; e < 3; e++) {
        const t = S.twin[f * 3 + e];
        if (t < 0) continue;
        const g = Math.floor(t / 3), ge = t % 3;
        // The picking weld is tolerant; editing only accepts exact, oppositely oriented source edges.
        if (!equal(idx[f * 3 + e] * 3, idx[g * 3 + (ge + 1) % 3] * 3) || !equal(idx[f * 3 + (e + 1) % 3] * 3, idx[t] * 3)) continue;
        adjacency[f * 3 + counts[f]++] = g;
      }
    }
    S.editTopology = { neighbors: f => adjacency.subarray(f * 3, f * 3 + counts[f]), normals };
    return S.editTopology;
  }

  function create(S, surface, options = null) {
    const base = surface ? surface.labels.slice() : S.autoLabel.slice();
    S.surfaceEdit = {
      surface, options, base, labels: surface ? base.slice() : S.label.slice(), overrides: surface ? new Int8Array(base.length).fill(-1) : S.highPaint.slice(),
      protected: new Uint8Array(base.length), selected: new Uint8Array(base.length), plan: null, pending: null, topology: null,
    };
    return S.surfaceEdit;
  }

  function ensure(S) {
    if (!S.label) throw new Error('Create region labels before editing.');
    return S.surfaceEdit || create(S, null);
  }

  function topology(S, edit) {
    if (edit.topology) return edit.topology;
    const source = sourceTopology(S);
    if (!edit.surface) {
      edit.topology = { neighbors: source.neighbors, area: S.area };
      return edit.topology;
    }
    const { positions: p, faceMap } = edit.surface, n = faceMap.length;
    const area = new Float64Array(n), first = new Uint32Array(S.nf), count = new Uint32Array(S.nf);
    for (let f = 0; f < n; f++) { if (!count[faceMap[f]]) first[faceMap[f]] = f; count[faceMap[f]]++; area[f] = root.MCQuantization.triangleArea(p, f); }
    if (n === S.nf && faceMap.every((parent, f) => parent === f)) {
      edit.topology = { neighbors: source.neighbors, area }; return edit.topology;
    }
    const adjacency = Array.from({ length: n }, () => []), lines = new Map(), refined = new Uint8Array(S.nf);
    for (let parent = 0; parent < S.nf; parent++) if (count[parent] > 1) { refined[parent] = 1; for (const g of source.neighbors(parent)) refined[g] = 1; }
    const bary = S.quantization.barycentric, resolution = 2 ** edit.options.detail;
    const gcd = (a, b) => { while (b) { const t = a % b; a = b; b = t; } return a || 1; };
    for (let f = 0; f < n; f++) {
      const parentFace = faceMap[f];
      if (count[parentFace] === 1) for (const g of source.neighbors(parentFace)) if (count[g] === 1) adjacency[f].push(first[g]);
      if (!refined[parentFace]) continue;
      for (let e = 0; e < 3; e++) {
        const a = f * 6 + e * 2, b = f * 6 + ((e + 1) % 3) * 2, parent = faceMap[f];
        const x = bary[a], y = bary[a + 1], u = bary[b], v = bary[b + 1];
        let key, t, end;
        const boundary = y === 0 && v === 0 ? 0 : x + y === resolution && u + v === resolution ? 1 : x === 0 && u === 0 ? 2 : -1;
        if (boundary >= 0) {
          const av = S.widx[parent * 3 + boundary], bv = S.widx[parent * 3 + (boundary + 1) % 3];
          key = av < bv ? `e:${av}|${bv}` : `e:${bv}|${av}`;
          t = boundary === 0 ? x : boundary === 1 ? y : resolution - y;
          end = boundary === 0 ? u : boundary === 1 ? v : resolution - v;
          if (av > bv) { t = resolution - t; end = resolution - end; }
        } else {
          let dx = u - x, dy = v - y;
          const divisor = gcd(Math.abs(dx), Math.abs(dy)); dx /= divisor; dy /= divisor;
          if (dx < 0 || dx === 0 && dy < 0) { dx = -dx; dy = -dy; }
          key = `f:${parent}:${dx},${dy}:${dx * y - dy * x}`;
          t = dx * x + dy * y; end = dx * u + dy * v;
        }
        const edge = { f, lo: Math.min(t, end), hi: Math.max(t, end), sign: end > t ? 1 : -1 };
        const list = lines.get(key) || []; list.push(edge); lines.set(key, list);
      }
    }
    // Dyadic barycentric intervals join adaptive T-junctions without welding nearby sheets.
    for (const list of lines.values()) {
      list.sort((a, b) => a.lo - b.lo);
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length && list[j].lo < list[i].hi; j++) {
        const a = list[i], b = list[j], af = faceMap[a.f], bf = faceMap[b.f];
        if (af !== bf && count[af] === 1 && count[bf] === 1) continue;
        if (a.f === b.f || a.sign === b.sign || af !== bf && !source.neighbors(af).includes(bf)) continue;
        if (Math.min(a.hi, b.hi) <= Math.max(a.lo, b.lo)) continue;
        adjacency[a.f].push(b.f); adjacency[b.f].push(a.f);
      }
    }
    edit.topology = { neighbors: f => adjacency[f], area };
    return edit.topology;
  }

  function geometricRegion(S, seed, angle) {
    if (!Number.isInteger(seed) || seed < 0 || seed >= S.nf || !Number.isFinite(angle) || angle < 1 || angle > 80) throw new Error('Choose a face and a sensitivity in 1–80 degrees.');
    const { neighbors, normals: n } = sourceTopology(S), cos = Math.cos(angle * Math.PI / 180);
    const dot = (a, b) => n[a * 3] * n[b * 3] + n[a * 3 + 1] * n[b * 3 + 1] + n[a * 3 + 2] * n[b * 3 + 2];
    const seen = new Uint8Array(S.nf), queue = [seed]; seen[seed] = 1;
    for (let i = 0; i < queue.length; i++) for (const g of neighbors(queue[i])) {
      if (seen[g] || dot(queue[i], g) < cos || dot(seed, g) < cos) continue;
      seen[g] = 1; queue.push(g);
    }
    return seen;
  }

  function pick(S, m) {
    if (!['select', 'exclude', 'protect', 'unprotect'].includes(m.tool)) throw new Error('Unknown region tool.');
    const edit = ensure(S), region = geometricRegion(S, m.seed, m.angle);
    if (edit.pending === 'cleanup') { edit.plan = null; edit.pending = null; }
    const protect = m.tool === 'protect' || m.tool === 'unprotect';
    for (let i = 0; i < edit.labels.length; i++) if (region[edit.surface ? edit.surface.faceMap[i] : i]) {
      if (protect) edit.protected[i] = m.tool === 'protect' ? 1 : 0;
      else edit.selected[i] = m.tool === 'select' ? 1 : 0;
    }
    if (!protect) edit.pending = edit.selected.some(Boolean) ? 'selection' : null;
  }

  function detect(S, m) {
    if (!Number.isFinite(m.areaMM2) || m.areaMM2 <= 0 || m.areaMM2 > 10000 || !Number.isFinite(m.scale) || m.scale <= 0) throw new Error('Choose a positive area (up to 10000 mm²) and physical scale.');
    const edit = ensure(S), { neighbors, area } = topology(S, edit), labels = edit.labels, n = labels.length;
    const comp = new Int32Array(n).fill(-1), groups = [], threshold = m.areaMM2 / (m.scale * m.scale);
    for (let seed = 0; seed < n; seed++) {
      if (comp[seed] >= 0) continue;
      const id = groups.length, faces = [seed]; comp[seed] = id;
      let sum = 0, protectedRegion = false;
      for (let q = 0; q < faces.length; q++) {
        const f = faces[q]; sum += area[f]; protectedRegion ||= !!edit.protected[f];
        for (const g of neighbors(f)) if (comp[g] < 0 && labels[g] === labels[seed]) { comp[g] = id; faces.push(g); }
      }
      groups.push({ faces, area: sum, protected: protectedRegion });
    }
    const plan = new Int8Array(n).fill(-1);
    for (let id = 0; id < groups.length; id++) {
      const group = groups[id];
      if (group.protected || group.area >= threshold) continue;
      const votes = new Map();
      for (const f of group.faces) for (const g of neighbors(f)) {
        const neighbor = groups[comp[g]];
        if (comp[g] === id || neighbor.area <= group.area) continue;
        votes.set(comp[g], (votes.get(comp[g]) || 0) + Math.sqrt(Math.min(area[f], area[g])));
      }
      let target = -1, score = 0;
      for (const [candidate, vote] of votes) if (vote > score) { target = candidate; score = vote; }
      if (target < 0) continue;
      const label = labels[groups[target].faces[0]];
      for (const f of group.faces) plan[f] = label;
    }
    edit.selected.fill(0); edit.plan = plan; edit.pending = 'cleanup';
  }

  function cancel(S) {
    const edit = ensure(S); edit.plan = null; edit.selected.fill(0); edit.pending = null;
  }

  function apply(S, label, pushUndo) {
    const edit = ensure(S);
    if (!edit.pending) throw new Error('Detect stray colors or select a geometric region first.');
    if (!Number.isInteger(label) || label < 0 || label >= S.nSlots) throw new Error('Choose an existing color / SKU region.');
    const faces = [], prev = [];
    for (let f = 0; f < edit.labels.length; f++) {
      const next = edit.pending === 'cleanup' ? edit.plan[f] : edit.selected[f] ? label : -1;
      if (next < 0 || next === edit.labels[f]) continue;
      faces.push(f); prev.push(edit.overrides[f]); edit.overrides[f] = next; edit.labels[f] = next;
      if (!edit.surface) S.highPaint[f] = next;
    }
    if (faces.length) pushUndo({ type: 'surface', faces: Uint32Array.from(faces), prev: Int8Array.from(prev) });
    cancel(S); sync(S);
  }

  function sync(S) {
    const edit = ensure(S);
    for (let i = 0; i < edit.labels.length; i++) edit.labels[i] = edit.overrides[i] < 0 ? edit.base[i] : edit.overrides[i];
    if (!edit.surface) { S.label = edit.labels.slice(); return; }
    const votes = new Float64Array(S.nf * S.nSlots);
    for (let i = 0; i < edit.labels.length; i++) votes[edit.surface.faceMap[i] * S.nSlots + edit.labels[i]] += root.MCQuantization.triangleArea(edit.surface.positions, i);
    for (let f = 0; f < S.nf; f++) {
      S.label[f] = 0;
      for (let k = 1; k < S.nSlots; k++) if (votes[f * S.nSlots + k] > votes[f * S.nSlots + S.label[f]]) S.label[f] = k;
    }
  }

  function result(S, includeGeometry = false) {
    const edit = ensure(S), overlay = new Uint8Array(edit.labels.length);
    let selectedCount = 0, protectedCount = 0, candidateCount = 0;
    for (let i = 0; i < overlay.length; i++) {
      if (edit.protected[i]) { overlay[i] = 2; protectedCount++; }
      if (edit.selected[i]) { overlay[i] = 1; selectedCount++; }
      if (edit.pending === 'cleanup' && edit.plan[i] >= 0) { overlay[i] = 1; candidateCount++; }
    }
    let editedCount = 0;
    for (const value of edit.overrides) if (value >= 0) editedCount++;
    return { label: S.label.slice(), surface: edit.surface && includeGeometry ? { ...edit.surface, labels: edit.labels.slice() } : undefined, surfaceLabels: edit.surface ? edit.labels.slice() : undefined, overlay, selectedCount, protectedCount, candidateCount, editedCount, pending: edit.pending, left: S.undo.length };
  }

  function restore(S, data) {
    const edit = ensure(S), n = edit.labels.length;
    if (!Array.isArray(data.overrides) || data.overrides.length !== n || data.overrides.some(x => !Number.isInteger(x) || x < -1 || x >= S.nSlots)
      || !Array.isArray(data.protected) || data.protected.length !== n || data.protected.some(x => x !== 0 && x !== 1)) throw new Error('Invalid surface edit snapshot.');
    edit.overrides = Int8Array.from(data.overrides); edit.protected = Uint8Array.from(data.protected); sync(S);
  }

  root.MCSurfaceEdit = { create, ensure, pick, detect, cancel, apply, sync, result, restore, geometricRegion };
})(typeof self !== 'undefined' ? self : this);
