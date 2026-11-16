export function planeFixture(kind = 'flat-regions', { width = 32, height = 24, cells = 8 } = {}) {
  const triWorld = [], triUV = [];
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    const a = [x / cells, y / cells], b = [(x + 1) / cells, y / cells];
    const c = [(x + 1) / cells, (y + 1) / cells], d = [x / cells, (y + 1) / cells];
    for (const triangle of [[a, b, c], [a, c, d]]) for (const [u, v] of triangle) {
      triWorld.push(u, v, 0); triUV.push(u, v);
    }
  }
  const data = new Uint8Array(width * height * 3);
  const feature = (u, v) => u >= 0.375 && u < 0.5 && v >= 0.375 && v < 0.5;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = (x + 0.5) / width, v = (y + 0.5) / height;
    let rgb;
    if (kind === 'solid') rgb = [255, 0, 0];
    else if (kind === 'flat-regions') rgb = u < 0.5 ? [220, 40, 40] : [35, 70, 220];
    else if (kind === 'smooth-shading') rgb = [Math.round(55 + 160 * u), Math.round(45 + 140 * u), Math.round(40 + 120 * u)];
    else if (kind === 'small-distinctive-color') rgb = feature(u, v) ? [20, 220, 60] : u < 0.5 ? [205, 45, 45] : [30, 55, 195];
    else throw new Error(`Unknown fixture ${kind}`);
    data.set(rgb, (y * width + x) * 3);
  }
  const input = { triWorld: new Float32Array(triWorld), triUV: new Float32Array(triUV), texture: { width, height, data }, flipY: false };
  return { name: kind, input, cells, feature: kind === 'small-distinctive-color' ? feature : null };
}

export function twoColorFixture() {
  return {
    triWorld: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 2, 1, 0]),
    triUV: new Float32Array([0, 0, 0.4, 0, 0, 1, 0.6, 0, 1, 0, 1, 1]),
    texture: { width: 8, height: 8, data: Uint8Array.from({ length: 8 * 8 * 3 }, (_, i) => i % 3 === (Math.floor(i / 3) % 8 < 4 ? 0 : 2) ? 255 : 0) },
    flipY: false,
  };
}
