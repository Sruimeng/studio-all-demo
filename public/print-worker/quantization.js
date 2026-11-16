(function (root) {
  'use strict';

  function domain(m) {
    if (m.quantizationUnsupported) return m.quantizationUnsupported;
    const used = new Set(m.faceMat);
    if (!m.materials.some(mt => mt.image >= 0)) return '无单张 baseColor 贴图；使用表面兼容分色，不是上游贴图算法。';
    if (used.size !== 1) return '多材质输入使用表面兼容分色；未把第一张贴图套用到其他部件。';
    const mt = m.materials[[...used][0]];
    if (mt.image < 0 || !m.uvs) return '缺少贴图或 UV；使用表面兼容分色。';
    if (mt.vertexColors) return '贴图叠加顶点色使用表面兼容分色；上游仅支持单张 RGB 贴图。';
    return null;
  }

  function analyze(S, m, progress) {
    const reason = domain(m);
    if (reason) return { algorithm: 'surface-compatibility', maxColorCount: 16, suggestedColorCount: 4, reason };
    if (!root.MCQuantizationAPI) throw new Error('Upstream quantizer is unavailable. Load the bundled module worker; no legacy fallback was used.');
    const mt = S.materials[S.faceMat[0]], tex = S.tex[mt.image];
    if (!tex) throw new Error('Cannot decode the upstream baseColor texture. No legacy fallback was used.');
    const triWorld = new Float32Array(S.nf * 9), triUV = new Float32Array(S.nf * 6);
    for (let c = 0; c < S.indices.length; c++) {
      const v = S.indices[c];
      triWorld.set(S.positions.subarray(v * 3, v * 3 + 3), c * 3);
      triUV.set(S.uvs.subarray(v * 2, v * 2 + 2), c * 2);
    }
    const rgb = new Uint8Array(tex.w * tex.h * 3);
    for (let i = 0; i < tex.w * tex.h; i++) for (let c = 0; c < 3; c++) {
      // Material factors are linear; the uploaded texture bytes are still unmodified sRGB.
      rgb[i * 3 + c] = Math.min(255, Math.max(0, Math.round(root.MC.linearToSrgb(root.MC.S2L[tex.data[i * 4 + c]] * mt.factor[c]) * 255)));
    }
    const input = { triWorld, triUV, texture: { width: tex.w, height: tex.h, data: rgb }, flipY: false };
    const analysis = root.MCQuantizationAPI.analyze(input, { maxDistanceMatrixBytes: 512 * 1024 * 1024, progress: (stage, fraction) => progress(fraction, stage) });
    const texture = { originalWidth: tex.originalWidth, originalHeight: tex.originalHeight, width: tex.w, height: tex.h, maxEdge: 2048, downsampled: tex.originalWidth !== tex.w || tex.originalHeight !== tex.h };
    if (texture.downsampled) S.warnings.push(`分色预览贴图已从 ${texture.originalWidth} × ${texture.originalHeight} 缩小至 ${texture.width} × ${texture.height}；原模型与源文件保持不变。`);
    S.quantization = { analysis, triUV, texture: input.texture };
    return { algorithm: 'upstream', maxColorCount: Math.min(16, analysis.maxSelectableColorCount), suggestedColorCount: Math.min(16, analysis.suggestedColorCount), texture };
  }

  function preview(S, m) {
    const analysis = S.quantization.analysis;
    const level = root.MCQuantizationAPI.getLevel(analysis, m.N);
    const map = new Uint8Array(analysis.leafIndexMap.length);
    for (let i = 0; i < map.length; i++) {
      const leaf = analysis.leafIndexMap[i];
      map[i] = leaf === 255 ? 255 : level.leafToCluster[leaf];
    }
    const supplemented = new Set();
    let supplementalSampleCount = 0;
    const sampleUV = new Float64Array(6), sampleWorld = new Float64Array(9);
    const uncoveredLabel = (face, ...corners) => {
      for (let c = 0; c < 3; c++) {
        const weights = corners[c];
        for (let d = 0; d < 2; d++) sampleUV[c * 2 + d] = weights[0] * S.quantization.triUV[face * 6 + d] + weights[1] * S.quantization.triUV[face * 6 + 2 + d] + weights[2] * S.quantization.triUV[face * 6 + 4 + d];
        for (let d = 0; d < 3; d++) sampleWorld[c * 3 + d] = weights[0] * S.positions[S.indices[face * 3] * 3 + d] + weights[1] * S.positions[S.indices[face * 3 + 1] * 3 + d] + weights[2] * S.positions[S.indices[face * 3 + 2] * 3 + d];
      }
      // Commit's baseline compares sampled Lab to original leaves, not the merged palette or another UV island.
      const { faceLab } = root.MCQuantizationAPI.sampleFaces(sampleUV, sampleWorld, S.quantization.texture, false, false);
      let nearest = 0, distance = Infinity;
      for (let leaf = 0; leaf < analysis.leafLab.length; leaf++) {
        const lab = analysis.leafLab[leaf];
        const d = (faceLab[0] - lab[0]) ** 2 + (faceLab[1] - lab[1]) ** 2 + (faceLab[2] - lab[2]) ** 2;
        if (d < distance) { nearest = leaf; distance = d; }
      }
      supplemented.add(face); supplementalSampleCount++;
      return level.leafToCluster[nearest];
    };
    const sub = root.MCLow.subdivideAll({
      lpos: S.positions, lidx: S.indices, luv: S.quantization.triUV, lmat: S.faceMat, nlf: S.nf,
      maps: [{ w: analysis.width, h: analysis.height, lab: map }], matImage: S.materials.map(() => 0),
      scale: m.scale, maxDepth: m.detail, minEdge: [1.6, 1.2, 0.9, 0.65, 0.45, 0.35][m.detail - 1], purity: 1,
      n: level.K, clampUv: true, captureBary: true, uncoveredLabel,
    });
    S.quantization.barycentric = sub.leafBary;
    const candidates = m.cands.map(c => ({ ...c, lab: root.MC.hexToLab(c.hex) }));
    const slots = level.clusters.map(color => {
      let best = null, de = Infinity;
      const sourceHex = color.hex.toUpperCase(), lab = root.MC.hexToLab(sourceHex);
      for (const candidate of candidates) {
        const distance = root.MC.deltaE00(...lab, ...candidate.lab);
        if (distance < de) { best = candidate; de = distance; }
      }
      return { hex: best?.hex ?? sourceHex, sourceHex, w: color.areaRatio, de: best ? de : 0, ok: root.MC.hexToOklab(sourceHex), filamentId: best?.id ?? null };
    });
    const votes = new Float64Array(S.nf * level.K), label = new Uint8Array(S.nf);
    for (let i = 0; i < sub.nl; i++) votes[sub.leafFace[i] * level.K + sub.leafLab[i]] += triangleArea(sub.leaves, i);
    for (let f = 0; f < S.nf; f++) for (let k = 1; k < level.K; k++) if (votes[f * level.K + k] > votes[f * level.K + label[f]]) label[f] = k;
    const normals = S.sourceNormals ? new Float32Array(sub.leaves.length) : undefined;
    if (normals) for (let f = 0; f < sub.nl; f++) for (let corner = 0; corner < 3; corner++) {
      const b = f * 6 + corner * 2, resolution = 2 ** m.detail;
      const weights = [1 - (sub.leafBary[b] + sub.leafBary[b + 1]) / resolution, sub.leafBary[b] / resolution, sub.leafBary[b + 1] / resolution];
      const offset = f * 9 + corner * 3;
      for (let c = 0; c < 3; c++) for (let v = 0; v < 3; v++) normals[offset + c] += weights[v] * S.sourceNormals[S.indices[sub.leafFace[f] * 3 + v] * 3 + c];
      const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]) || 1;
      for (let c = 0; c < 3; c++) normals[offset + c] /= length;
    }
    const supplementalSampling = { method: 'upstream-sample-faces-nearest-original-leaf', sampleCount: supplementalSampleCount, faceCount: supplemented.size };
    return { slots, label, surface: { positions: sub.leaves, normals, labels: sub.leafLab, faceMap: sub.leafFace, supplementalSampling } };
  }

  function triangleArea(p, f) {
    const i = f * 9, x = p[i + 3] - p[i], y = p[i + 4] - p[i + 1], z = p[i + 5] - p[i + 2];
    const u = p[i + 6] - p[i], v = p[i + 7] - p[i + 1], w = p[i + 8] - p[i + 2];
    return Math.hypot(y * w - z * v, z * u - x * w, x * v - y * u) * 0.5;
  }
  root.MCQuantization = { domain, analyze, preview, triangleArea };
})(typeof self !== 'undefined' ? self : this);
