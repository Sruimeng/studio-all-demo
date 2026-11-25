import { orientClosedMesh } from './text-solid-repair';
import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { MeshData } from '~/@engine/base-processing';

export interface TextSolidResult extends MeshData {
  /** One material domain per triangle: base = 0, text = 1. */
  faceMaterials: Uint8Array;
  volume: number;
}
function signedVolume(mesh: MeshData) {
  const p = mesh.positions, ids = mesh.indices; let volume = 0;
  for (let i = 0; i < ids.length; i += 3) {
    const a = ids[i]! * 3, b = ids[i + 1]! * 3, c = ids[i + 2]! * 3;
    volume += p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!) + p[a + 1]! * (p[b + 2]! * p[c]! - p[b]! * p[c + 2]!) + p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!);
  }
  return volume / 6;
}

/** Preserve original triangles and thin strokes instead of voxelizing a whole
 * base. SDF handles local placement; this exact mesh boolean removes internal
 * overlap and carries source material IDs through the final printable solid. */
export function joinBaseText(module: ManifoldToplevel, base: MeshData, text: MeshData): TextSolidResult {
  const owned: Manifold[] = [], { Manifold, Mesh } = module;
  const firstId = Manifold.reserveIDs(2);
  const keep = (solid: Manifold) => { owned.push(solid); return solid; };
  function solid(input: MeshData, id: number, name: string, repaired = false): Manifold {
    if (!input.positions.length || input.positions.length % 3 || !input.indices.length || input.indices.length % 3 || input.positions.some(v => !Number.isFinite(v)) || input.indices.some(v => v >= input.positions.length / 3)) throw new Error(`${name}网格无效 / Invalid ${name === '文字' ? 'text' : 'base'} mesh`);
    if (input.indices.length > 6_000_000) throw new Error('网格过于复杂，请先减面 / Reduce the mesh before joining text');
    const indices = input.indices.slice();
    // Some imported assets and demo primitives have globally reversed winding.
    if (signedVolume(input) < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!];
    const mesh = new Mesh({ numProp: 3, vertProperties: input.positions.slice(), triVerts: indices, runIndex: new Uint32Array([0, indices.length]), runOriginalID: new Uint32Array([id]) });
    mesh.merge();
    let value: Manifold;
    try { value = keep(new Manifold(mesh)); }
    catch {
      if (!repaired) {
        try { return solid(orientClosedMesh(input), id, name, true); } catch { /* Report a recoverable error without modifying the source. */ }
      }
      throw new Error(`${name}不是封闭实体，请修复网格后重试 / Repair the ${name === '文字' ? 'text' : 'base'} mesh before joining`);
    }
    if (value.status() !== 'NoError' || value.isEmpty() || value.volume() <= 0) throw new Error(`${name}不是有效封闭实体 / Invalid closed ${name === '文字' ? 'text' : 'base'} solid`);
    return value;
  }
  try {
    const baseSolid = solid(base, firstId, '底座'), textSolid = solid(text, firstId + 1, '文字');
    // Every separate glyph (including dots) needs a positive-volume connection.
    for (const part of textSolid.decompose().map(keep)) {
      const contact = keep(baseSolid.intersect(part));
      if (contact.volume() <= Math.max(1e-12, part.volume() * 1e-7)) throw new Error('部分文字未连接到底座，请向内移动或缩小文字 / Move text inward or scale it down so every part touches the base');
    }
    const joined = keep(baseSolid.add(textSolid));
    if (joined.status() !== 'NoError' || joined.isEmpty()) throw new Error('文字连接失败，请调整位置 / Could not join text to the base');
    if (joined.volume() <= baseSolid.volume() + Math.max(1e-12, textSolid.volume() * 1e-6)) throw new Error('文字完全埋入底座，请向外移动 / Text is buried inside the base');
    const output = joined.getMesh(), positions = output.vertProperties.slice(), indices = output.triVerts.slice();
    const faceMaterials = new Uint8Array(indices.length / 3);
    for (let run = 0; run < output.runOriginalID.length; run++) {
      faceMaterials.fill(output.runOriginalID[run] === firstId + 1 ? 1 : 0, output.runIndex[run]! / 3, output.runIndex[run + 1]! / 3);
    }
    return { positions, indices, faceMaterials, volume: joined.volume() };
  } finally { for (const value of owned.reverse()) value.delete(); }
}
