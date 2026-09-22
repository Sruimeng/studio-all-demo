export interface PrintMeshInput {
  positions: Float32Array;
  indices: Uint32Array;
  uvs: Float32Array | null;
  /** sRGB components, 0–255; material factors already applied. */
  colors: Uint8Array | Float32Array | null;
  vertexFactors?: Float32Array;
  faceMat: Uint16Array | Uint32Array;
  materials: Array<{ image: number; factor: [number, number, number]; vertexColors?: boolean }>;
  images: Array<Blob | null>;
  partOfVertex?: Uint16Array;
}

export interface PrintBounds {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
  diag: number;
}

export interface PrintBvh {
  bounds: Float32Array;
  info: Int32Array;
  order: Uint32Array;
}

export interface InitResult {
  nf: number; nv: number; nw: number; open: number;
  bbox: PrintBounds;
  hasUv: boolean; hasColors: boolean; textured: boolean;
  nParts: number; volume: number; totalArea: number;
  base: Array<{ hex: string; w: number }>;
  wpos: Float32Array; widx: Uint32Array;
  bvh: PrintBvh;
  faceOk: Float32Array;
  warnings: string[];
}

export interface PaletteOptions {
  mode: 'free' | 'owned';
  N: number;
  protect?: boolean;
  cands?: Array<{ id: string; hex: string; penalty?: number }>;
  locked?: string[];
}

export interface PaletteSlot {
  hex: string; ok: number[]; w: number; de: number;
  filamentId: string | null;
  sourceHex?: string;
}

export interface PaletteResult {
  slots: PaletteSlot[];
  K0: number;
  errCurve: Array<number | null>;
}

export interface LabelOptions {
  slotHex: string[];
  precision: number;
  scale: number;
  unifyParts?: boolean;
  regionMap?: number[];
  slotCount?: number;
}

export interface LowOptions extends LabelOptions {
  /** Zero preserves the uploaded mesh. */
  target: number;
}

export interface PrintStats {
  areaMM: number[];
  changes: number;
  layers: number;
  heightMM: number;
  low?: {
    nlf: number; nlv: number; leaves: number;
    decimateMs: number; subMs: number; hasUv: boolean;
    locked: number; maxCode: number; codeBytes: number;
  };
}

export interface LabelResult { label: Uint8Array; stats: PrintStats }

export interface LowResult {
  leaves: Float32Array;
  leafLab: Uint8Array;
  leafFace: Uint32Array;
  lpos: Float32Array; lidx: Uint32Array;
  luv: Float32Array | null;
  lmat: Uint16Array | Uint32Array;
  bvh: PrintBvh;
  stats: PrintStats;
  matImage: number[];
}

export interface LowDab {
  img: number; u: number; v: number; r: number; label: number;
  seed?: [number, number, number]; tol?: number;
}

export interface PrintSnapshot {
  version: 1;
  faceCount: number;
  geometryKey: string;
  highPaint: number[];
  labels: number[] | null;
  autoLabels: number[] | null;
  regionLabels: number[] | null;
  slotCount: number;
  labelOptions: LabelOptions | null;
  lowOptions: LowOptions | null;
  lowOverrides: Array<number[] | null>;
}

export interface EditResult {
  ok?: boolean;
  left: number;
  label: Uint8Array | null;
  faces?: Uint32Array;
  count?: number;
}

export interface ExportOptions {
  scheme: 'high' | 'low';
  scale: number;
  name: string;
  filaments: Array<{ hex: string; id?: string; name?: string; type?: string; vendor?: string }>;
  materialData?: unknown;
  withConfig?: boolean;
  bed?: [number, number];
}

export interface ExportResult { blob: Blob; size: number; code?: string }
export interface RestoreResult { label: Uint8Array | null; low: LowResult | null }
export interface RequestIdentity { projectId: string; requestId: number; editRevision: number }
export interface PrintProgress extends RequestIdentity { p: number; text: string }

export interface PrintCommands {
  init: [PrintMeshInput, InitResult];
  palette: [PaletteOptions, PaletteResult];
  label: [LabelOptions, LabelResult];
  lowpoly: [LowOptions, LowResult];
  paintHigh: [{ faces: Uint32Array; label: number }, EditResult];
  brushHigh: [{ hits: Array<{ face: number; point: [number, number, number]; radius: number }>; label: number }, EditResult];
  fillHigh: [{ seed: number; label: number; tol: number }, EditResult];
  paintLow: [{ dabs: LowDab[] }, EditResult];
  fillLow: [{ img: number; u: number; v: number; label: number; tol: number }, EditResult];
  undo: [Record<string, never>, EditResult];
  reset: [Record<string, never>, EditResult];
  snapshot: [Record<string, never>, { snapshot: PrintSnapshot }];
  restore: [{ snapshot: PrintSnapshot }, RestoreResult];
  export3mf: [ExportOptions, ExportResult];
  selftest: [{ withConfig?: boolean; bed?: [number, number] }, ExportResult];
}
