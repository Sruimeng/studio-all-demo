export type Point3 = [number, number, number];
export interface MeshData { positions: Float32Array; indices: Uint32Array }
/** The normal points INTO the retained half-space; coordinates are millimetres. */
export interface CutPlane { normal: Point3; offset: number; cap: boolean }
export interface GeometryCheck { boundary: number; nonManifold: number; winding: number; degenerate: number; duplicates: number }
export interface CutResult extends MeshData {
  surfaceIndexCount: number;
  plane: CutPlane;
  stats: GeometryCheck & { sourceFaces: number; removedFaces: number; splitFaces: number; capFaces: number; loops: number; capDeviation: number };
}
export interface CutRequest { id: number; mesh: MeshData; plane: CutPlane }
export type CutResponse = { id: number; result: CutResult } | { id: number; error: string };
