/* ============================================================
 * export3mf.js — 导出（Worker 内）
 *   ZIP（CompressionStream deflate-raw，流式分块，适配 200 万面）
 *   3MF：单对象 + 每三角形 paint_color / slic3rpe:mmu_segmentation
 *   GLB：低模 + UV + 分色贴图（可给 Bambu Studio 2.7 贴图转色使用）
 * ============================================================ */
(function (root) {
  "use strict";

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crcUpdate(crc, bytes) {
    let c = crc ^ 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // 条目：{name, chunks: async iterable<Uint8Array>}；返回 Blob
  async function zip(entries) {
    const parts = [];
    const central = [];
    let offset = 0;
    const enc = new TextEncoder();
    for (const e of entries) {
      const nameBytes = enc.encode(e.name);
      const cs = new CompressionStream("deflate-raw");
      const writer = cs.writable.getWriter();
      const reader = cs.readable.getReader();
      const comp = [];
      let compSize = 0;
      const pump = (async () => {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          comp.push(value); compSize += value.length;
        }
      })();
      let crc = 0, size = 0;
      for await (const chunk of e.chunks) {
        crc = crcUpdate(crc, chunk);
        size += chunk.length;
        await writer.write(chunk);
      }
      await writer.close();
      await pump;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 8, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, compSize, true); lh.setUint32(22, size, true);
      lh.setUint16(26, nameBytes.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, nameBytes, ...comp);
      central.push({ nameBytes, crc, compSize, size, offset });
      offset += 30 + nameBytes.length + compSize;
      if (size >= 0xffffffff || offset >= 0xffffffff) throw new Error("文件超过 4GB，暂不支持");
    }
    const cdStart = offset;
    for (const c of central) {
      const h = new DataView(new ArrayBuffer(46));
      h.setUint32(0, 0x02014b50, true); h.setUint16(4, 20, true); h.setUint16(6, 20, true); h.setUint16(8, 0x0800, true);
      h.setUint16(10, 8, true); h.setUint16(12, 0, true); h.setUint16(14, 0x21, true);
      h.setUint32(16, c.crc, true); h.setUint32(20, c.compSize, true); h.setUint32(24, c.size, true);
      h.setUint16(28, c.nameBytes.length, true); h.setUint32(42, c.offset, true);
      parts.push(h.buffer, c.nameBytes);
      offset += 46 + c.nameBytes.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, central.length, true); end.setUint16(10, central.length, true);
    end.setUint32(12, offset - cdStart, true); end.setUint32(16, cdStart, true);
    parts.push(end.buffer);
    return new Blob(parts, { type: "application/octet-stream" });
  }

  async function* textChunks(gen) {
    const enc = new TextEncoder();
    let buf = [];
    let len = 0;
    for (const s of gen) {
      buf.push(s); len += s.length;
      if (len > 1 << 20) { yield enc.encode(buf.join("")); buf = []; len = 0; }
    }
    if (buf.length) yield enc.encode(buf.join(""));
  }
  async function* once(bytes) { yield bytes; }
  const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));
  const fmt = (v) => { const s = v.toFixed(4); return s.indexOf(".") >= 0 ? s.replace(/0+$/, "").replace(/\.$/, "") : s; };

  // opt: {name, pos(Float32 模型单位 Y-up), idx(Uint32), nf, scale, faceCode(f)->string|null, filaments:[{hex,type,name}], withConfig, bed:[x,y]}
  async function build3mf(opt, progress) {
    const { pos, idx, nf, scale, faceCode, filaments, name } = opt;
    const nv = pos.length / 3;
    // Y-up → Z-up：(x,y,z) → (x,-z,y)；缩放到 mm；XY 居中、Z 落地
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity;
    for (let i = 0; i < nv; i += 1) {
      const X = pos[i * 3] * scale, Y = -pos[i * 3 + 2] * scale, Z = pos[i * 3 + 1] * scale;
      if (X < minX) minX = X; if (X > maxX) maxX = X;
      if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
      if (Z < minZ) minZ = Z;
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const bed = opt.bed || [128, 128];
    function* modelXml() {
      yield '<?xml version="1.0" encoding="UTF-8"?>\n';
      yield '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06">\n';
      yield ' <metadata name="Application">Tripo Demo</metadata>\n';
      yield ' <metadata name="BambuStudio:3mfVersion">1</metadata>\n';
      yield ' <metadata name="slic3rpe:Version3mf">1</metadata>\n';
      yield ' <metadata name="slic3rpe:MmPaintingVersion">1</metadata>\n';
      yield ` <metadata name="Title">${esc(name)}</metadata>\n`;
      yield ' <metadata name="Designer">Tripo 多色打印 Demo</metadata>\n';
      yield ' <resources>\n';
      yield '  <basematerials id="2">\n';
      for (const material of filaments) yield `   <base name="${esc(material.id || material.name || material.hex)}" displaycolor="${esc(material.hex.toUpperCase())}FF"/>\n`;
      yield '  </basematerials>\n';
      yield `  <object id="1" type="model" name="${esc(name)}">\n   <mesh>\n    <vertices>\n`;
      for (let i = 0; i < nv; i += 1) {
        const X = pos[i * 3] * scale - cx, Y = -pos[i * 3 + 2] * scale - cy, Z = pos[i * 3 + 1] * scale - minZ;
        yield `     <vertex x="${fmt(X)}" y="${fmt(Y)}" z="${fmt(Z)}"/>\n`;
      }
      yield '    </vertices>\n    <triangles>\n';
      for (let f = 0; f < nf; f += 1) {
        const code = faceCode(f);
        const slot = opt.faceSlot ? opt.faceSlot(f) : 0;
        const a = idx[f * 3], b = idx[f * 3 + 1], c = idx[f * 3 + 2];
        if (code) yield `     <triangle v1="${a}" v2="${b}" v3="${c}" pid="2" p1="${slot}" paint_color="${code}" slic3rpe:mmu_segmentation="${code}"/>\n`;
        else yield `     <triangle v1="${a}" v2="${b}" v3="${c}" pid="2" p1="${slot}"/>\n`;
        if (progress && (f & 65535) === 0) progress(f / nf, `写入 3MF：${f.toLocaleString()}/${nf.toLocaleString()} 面`);
      }
      yield '    </triangles>\n   </mesh>\n  </object>\n </resources>\n';
      yield ` <build>\n  <item objectid="1" transform="1 0 0 0 1 0 0 0 1 ${fmt(bed[0])} ${fmt(bed[1])} 0" printable="1"/>\n </build>\n</model>\n`;
    }
    const ct = '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
      + '<Default Extension="config" ContentType="text/xml"/>'
      + '<Default Extension="json" ContentType="application/json"/>'
      + '<Default Extension="png" ContentType="image/png"/></Types>';
    const rels = '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
    const enc = new TextEncoder();
    const entries = [
      { name: "[Content_Types].xml", chunks: once(enc.encode(ct)) },
      { name: "_rels/.rels", chunks: once(enc.encode(rels)) },
      { name: "3D/3dmodel.model", chunks: textChunks(modelXml()) },
    ];
    entries.push({ name: "Metadata/materials.json", chunks: once(enc.encode(JSON.stringify({
      version: 1, application: "Tripo Demo", colorSpace: "sRGB",
      renderRule: "opacity = 1 - transparency; roughness = 0.5 + 0.5 * inputRoughness",
      slots: filaments.map((material, index) => ({ index, ...material })),
      materialData: opt.materialData ?? null,
    }, null, 2))) });
    if (opt.withConfig) {
      const project = {
        name: "project_settings", from: "project", version: "02.07.01.62",
        filament_colour: filaments.map((f) => f.hex.toUpperCase()),
        filament_type: filaments.map((f) => f.type || "PLA"),
        filament_vendor: filaments.map((f) => f.vendor || "Generic"),
      };
      entries.push({ name: "Metadata/project_settings.config", chunks: once(enc.encode(JSON.stringify(project, null, 4))) });
      const ms = `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n  <object id="1">\n    <metadata key="name" value="${esc(name)}"/>\n    <metadata key="extruder" value="1"/>\n  </object>\n</config>\n`;
      entries.push({ name: "Metadata/model_settings.config", chunks: once(enc.encode(ms)) });
    }
    return zip(entries);
  }

  // GLB：prims = [{pos(Float32 模型单位), uv(Float32), idx(Uint32), png(Uint8Array)}]；scale → 米
  function buildGLB(prims, scale, name) {
    const bufParts = [];
    let blen = 0;
    const align4 = () => { const pad = (4 - (blen % 4)) % 4; if (pad) { bufParts.push(new Uint8Array(pad)); blen += pad; } };
    const bufferViews = [], accessors = [], meshesPrims = [], images = [], textures = [], materials = [];
    const addView = (arr, target) => {
      align4();
      const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
      bufParts.push(u8.slice());
      const v = { buffer: 0, byteOffset: blen, byteLength: u8.length };
      if (target) v.target = target;
      bufferViews.push(v);
      blen += u8.length;
      return bufferViews.length - 1;
    };
    prims.forEach((p, i) => {
      const nv = p.pos.length / 3;
      const P = new Float32Array(nv * 3);
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let k = 0; k < nv * 3; k += 1) {
        P[k] = p.pos[k] * scale / 1000;
        const d = k % 3;
        if (P[k] < mn[d]) mn[d] = P[k]; if (P[k] > mx[d]) mx[d] = P[k];
      }
      const pv = addView(P, 34962);
      accessors.push({ bufferView: pv, componentType: 5126, count: nv, type: "VEC3", min: mn, max: mx });
      const pa = accessors.length - 1;
      const uvv = addView(p.uv, 34962);
      accessors.push({ bufferView: uvv, componentType: 5126, count: nv, type: "VEC2" });
      const ua = accessors.length - 1;
      const iv = addView(p.idx, 34963);
      accessors.push({ bufferView: iv, componentType: 5125, count: p.idx.length, type: "SCALAR" });
      const ia = accessors.length - 1;
      const imgView = addView(p.png);
      images.push({ bufferView: imgView, mimeType: "image/png", name: `labels_${i}` });
      textures.push({ source: images.length - 1, sampler: 0 });
      materials.push({ name: `print_colors_${i}`, pbrMetallicRoughness: { baseColorTexture: { index: textures.length - 1 }, metallicFactor: 0, roughnessFactor: 0.8 } });
      meshesPrims.push({ attributes: { POSITION: pa, TEXCOORD_0: ua }, indices: ia, material: materials.length - 1 });
    });
    align4();
    const json = {
      asset: { version: "2.0", generator: "Tripo 多色打印 Demo" },
      scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name }],
      meshes: [{ name, primitives: meshesPrims }],
      accessors, bufferViews, buffers: [{ byteLength: blen }],
      images, textures, materials,
      samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 10497, wrapT: 10497 }],
    };
    let jb = new TextEncoder().encode(JSON.stringify(json));
    const jpad = (4 - (jb.length % 4)) % 4;
    const jfull = new Uint8Array(jb.length + jpad); jfull.set(jb); jfull.fill(0x20, jb.length);
    const total = 12 + 8 + jfull.length + 8 + blen;
    const head = new DataView(new ArrayBuffer(20));
    head.setUint32(0, 0x46546c67, true); head.setUint32(4, 2, true); head.setUint32(8, total, true);
    head.setUint32(12, jfull.length, true); head.setUint32(16, 0x4e4f534a, true);
    const bh = new DataView(new ArrayBuffer(8));
    bh.setUint32(0, blen, true); bh.setUint32(4, 0x004e4942, true);
    return new Blob([head.buffer, jfull, bh.buffer, ...bufParts], { type: "model/gltf-binary" });
  }

  root.MCExport = { zip, build3mf, buildGLB, crcUpdate };
})(typeof self !== "undefined" ? self : this);
