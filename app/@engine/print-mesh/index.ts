import { Color, Mesh, Vector2, Vector3, type Object3D, type MeshStandardMaterial, type Texture } from 'three';
import { getModelGeometryTopology, getModelMeshEdgeDomain } from '../model';
import type { PrintMeshInput } from '../multicolor';

export async function toPrintMesh(root: Object3D): Promise<PrintMeshInput> {
  root.updateWorldMatrix(true, true);
  const meshes: Mesh[] = [];
  root.traverse(object => { if (object instanceof Mesh && object.geometry.getAttribute('position')) meshes.push(object); });
  let count = 0;
  for (const mesh of meshes) count += mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count;
  if (!count) throw new Error('Model has no triangles / 模型没有三角面');
  const positions = new Float32Array(count * 3);
  const indices = new Uint32Array(count);
  const vertexFactors = new Float32Array(count * 3).fill(1);
  const colors = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const rawUvs = new Float32Array(count * 2);
  const uvValid = new Uint8Array(count / 3);
  const topologyVertices = new Uint32Array(count);
  const faceDomain = new Uint32Array(count / 3);
  const domains = new Map<symbol | Mesh, number>();
  const vertexIds = new Map<string, number>();
  const faceMat = new Uint32Array(count / 3);
  const materials: PrintMeshInput['materials'] = [];
  const images: Array<Blob | null> = [];
  const texIds = new Map<Texture, number>();
  const point = new Vector3(); const uv = new Vector2(); const linear = new Color();
  let cursor = 0, anyUV = false;
  for (const mesh of meshes) {
    const geo = mesh.geometry;
    const identity = getModelMeshEdgeDomain(mesh) ?? mesh;
    if (!domains.has(identity)) domains.set(identity, domains.size);
    const domain = domains.get(identity)!;
    const topology = getModelGeometryTopology(geo);
    const pos = geo.getAttribute('position'); const tex = geo.getAttribute('uv'); const col = geo.getAttribute('color');
    const sourceMaterials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MeshStandardMaterial[];
    const offset = materials.length;
    for (const source of sourceMaterials) {
      let image = -1;
      if (source.map && tex) {
        image = texIds.get(source.map) ?? -1;
        if (image < 0) {
          const input = source.map.image as CanvasImageSource & { width: number; height: number };
          const canvas = document.createElement('canvas');
          canvas.width = input.width; canvas.height = input.height;
          const ctx = canvas.getContext('2d');
          if (!ctx || !input.width) throw new Error('Cannot read texture pixels');
          ctx.drawImage(input, 0, 0);
          const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Cannot decode texture')), 'image/png'));
          image = images.length; images.push(blob); texIds.set(source.map, image);
        }
      }
      const c = source.color ?? new Color(1, 1, 1);
      // Vertex colors already contain the base color when there is no texture.
      materials.push({ image, vertexColors: !!col && source.vertexColors, factor: image >= 0 ? [c.r, c.g, c.b] : [1, 1, 1] });
    }
    const size = geo.index?.count ?? pos.count;
    const reversed = mesh.matrixWorld.determinant() < 0;
    for (let face = 0; face < size; face += 3) {
      const group = geo.groups.find(item => face >= item.start && face < item.start + item.count);
      const materialIndex = group?.materialIndex ?? 0;
      const material = sourceMaterials[materialIndex] ?? sourceMaterials[0]!;
      faceMat[cursor / 3] = offset + materialIndex;
      faceDomain[cursor / 3] = domain;
      uvValid[cursor / 3] = tex ? 1 : 0;
      for (let corner = 0; corner < 3; corner++) {
        const index = face + (reversed && corner > 0 ? 3 - corner : corner);
        const vertex = geo.index ? geo.index.getX(index) : index;
        const sourceId = topology ? `s${topology.cornerVertexIds[topology.renderVertexCorners[vertex]!]}` : `p${pos.getX(vertex)},${pos.getY(vertex)},${pos.getZ(vertex)}`;
        const key = `${domain}:${sourceId}`;
        if (!vertexIds.has(key)) vertexIds.set(key, vertexIds.size);
        topologyVertices[cursor] = vertexIds.get(key)!;
        mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld);
        positions.set(point.toArray(), cursor * 3); indices[cursor] = cursor;
        if (col && material.vertexColors) vertexFactors.set([col.getX(vertex), col.getY(vertex), col.getZ(vertex)], cursor * 3);
        linear.copy(material.color ?? new Color(1, 1, 1));
        if (col && material.vertexColors) linear.multiply(new Color(col.getX(vertex), col.getY(vertex), col.getZ(vertex)));
        linear.convertLinearToSRGB();
        colors.set([linear.r * 255, linear.g * 255, linear.b * 255], cursor * 3);
        if (tex) {
          anyUV = true; uv.set(tex.getX(vertex), tex.getY(vertex));
          rawUvs.set([uv.x, uv.y], cursor * 2);
          if (material.map) { material.map.updateMatrix(); material.map.transformUv(uv); }
          uvs.set([uv.x, uv.y], cursor * 2);
        }
        cursor++;
      }
    }
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return { positions, indices, colors, vertexFactors, uvs: anyUV ? uvs : null, faceMat, materials, images, rawUvs: anyUV ? rawUvs : null, uvValid, topologyVertices, faceDomain };
}
export { uvHit } from './paint';
