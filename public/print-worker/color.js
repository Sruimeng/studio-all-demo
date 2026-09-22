/* ============================================================
 * color.js — 色彩数学（主线程与 Worker 共用，经典脚本）
 *   sRGB ⇄ 线性 ⇄ OKLab；sRGB → CIELAB(D65)；CIEDE2000
 *   18-bit 颜色格子（每通道 6 bit）：采样键 / 直方图 / LUT 共用
 * ============================================================ */
(function (root) {
  "use strict";

  const S2L = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const c = i / 255;
    S2L[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function linearToSrgb(c) {
    c = c < 0 ? 0 : c > 1 ? 1 : c;
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  // 线性 sRGB → OKLab
  function linToOklab(r, g, b, out, o) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    out[o] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    out[o + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    out[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  }
  function oklabToLin(L, a, b, out, o) {
    const l = L + 0.3963377774 * a + 0.2158037573 * b;
    const m = L - 0.1055613458 * a - 0.0638541728 * b;
    const s = L - 0.0894841775 * a - 1.291485548 * b;
    const l3 = l * l * l, m3 = m * m * m, s3 = s * s * s;
    out[o] = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    out[o + 1] = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    out[o + 2] = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  }
  // 线性 sRGB → CIELAB (D65 / 2°)
  function linToLab(r, g, b, out, o) {
    const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
    const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
    const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(X), fy = f(Y), fz = f(Z);
    out[o] = 116 * fy - 16;
    out[o + 1] = 500 * (fx - fy);
    out[o + 2] = 200 * (fy - fz);
  }

  // CIEDE2000
  function deltaE00(L1, a1, b1, L2, a2, b2, kL) {
    const rad = Math.PI / 180;
    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
    const Cb = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + 6103515625)));
    const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
    const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    let h1p = Math.atan2(b1, a1p) / rad; if (h1p < 0) h1p += 360;
    let h2p = Math.atan2(b2, a2p) / rad; if (h2p < 0) h2p += 360;
    const dLp = L2 - L1, dCp = C2p - C1p;
    let dhp = 0;
    if (C1p * C2p !== 0) {
      dhp = h2p - h1p;
      if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360;
    }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
    const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
    let hbp = h1p + h2p;
    if (C1p * C2p !== 0) {
      if (Math.abs(h1p - h2p) > 180) hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
      else hbp = (h1p + h2p) / 2;
    }
    const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad)
      + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
    const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
    const Rc = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + 6103515625));
    const Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
    const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
    const Rt = -Math.sin(2 * dTheta * rad) * Rc;
    const x = dLp / (Sl * (kL || 1)), y = dCp / Sc, z = dHp / Sh;
    return Math.sqrt(x * x + y * y + z * z + Rt * y * z);
  }

  function hexToRgb255(hex) {
    const h = hex.replace("#", "");
    const v = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function rgb255ToHex(r, g, b) {
    const c = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
    return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
  }
  const _t = new Float64Array(3);
  function hexToOklab(hex) {
    const [r, g, b] = hexToRgb255(hex);
    linToOklab(S2L[r], S2L[g], S2L[b], _t, 0);
    return [_t[0], _t[1], _t[2]];
  }
  function hexToLab(hex) {
    const [r, g, b] = hexToRgb255(hex);
    linToLab(S2L[r], S2L[g], S2L[b], _t, 0);
    return [_t[0], _t[1], _t[2]];
  }
  function oklabToHex(L, a, b) {
    oklabToLin(L, a, b, _t, 0);
    return rgb255ToHex(linearToSrgb(_t[0]) * 255, linearToSrgb(_t[1]) * 255, linearToSrgb(_t[2]) * 255);
  }
  function oklabToLab(L, a, b) {
    oklabToLin(L, a, b, _t, 0);
    const r = Math.max(0, _t[0]), g = Math.max(0, _t[1]), bl = Math.max(0, _t[2]);
    linToLab(r, g, bl, _t, 0);
    return [_t[0], _t[1], _t[2]];
  }

  // ---- 18-bit 颜色格子 ----
  const CELL_BITS = 6, CELLS = 1 << (CELL_BITS * 3); // 262144
  function cellKey(r, g, b) { return ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2); }
  let CELL_OKLAB = null;
  function cellOklab() {
    if (CELL_OKLAB) return CELL_OKLAB;
    CELL_OKLAB = new Float32Array(CELLS * 3);
    const t = new Float64Array(3);
    for (let k = 0; k < CELLS; k += 1) {
      const r = ((k >> 12) & 63) * 4 + 2, g = ((k >> 6) & 63) * 4 + 2, b = (k & 63) * 4 + 2;
      linToOklab(S2L[r], S2L[g], S2L[b], t, 0);
      CELL_OKLAB[k * 3] = t[0]; CELL_OKLAB[k * 3 + 1] = t[1]; CELL_OKLAB[k * 3 + 2] = t[2];
    }
    return CELL_OKLAB;
  }
  // 为调色板(OKLab 平铺数组)构建 格子→标签 查找表
  function buildLut(palOk, n, wL) {
    const w2 = (wL || 1) * (wL || 1);
    const ok = cellOklab();
    const lut = new Uint8Array(CELLS);
    for (let k = 0; k < CELLS; k += 1) {
      const L = ok[k * 3], A = ok[k * 3 + 1], B = ok[k * 3 + 2];
      let best = 0, bd = Infinity;
      for (let q = 0; q < n; q += 1) {
        const dl = L - palOk[q * 3], da = A - palOk[q * 3 + 1], db = B - palOk[q * 3 + 2];
        const d = dl * dl * w2 + da * da + db * db;
        if (d < bd) { bd = d; best = q; }
      }
      lut[k] = best;
    }
    return lut;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  root.MC = root.MC || {};
  Object.assign(root.MC, {
    S2L, srgbToLinear, linearToSrgb, linToOklab, oklabToLin, linToLab, deltaE00,
    hexToRgb255, rgb255ToHex, hexToOklab, hexToLab, oklabToHex, oklabToLab,
    CELLS, cellKey, cellOklab, buildLut, mulberry32,
  });
})(typeof self !== "undefined" ? self : this);
