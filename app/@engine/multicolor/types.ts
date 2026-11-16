export interface PrintMeshInput {
  positions: Float32Array;
  normals?: Float32Array;
  indices: Uint32Array;
  uvs: Float32Array | null;
  /** sRGB components, 0–255; material factors already applied. */
  colors: Uint8Array | Float32Array | null;
  vertexFactors?: Float32Array;
  faceMat: Uint16Array | Uint32Array;
  materials: Array<{ image: number; factor: [number, number, number]; vertexColors?: boolean }>;
  images: Array<Blob | null>;
  partOfVertex?: Uint16Array;
  quantizationUnsupported?: string;
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

export interface QuantizationInfo {
  algorithm: 'upstream' | 'surface-compatibility';
  maxColorCount: number;
  suggestedColorCount: number;
  reason?: string;
  texture?: {
    originalWidth: number; originalHeight: number;
    width: number; height: number;
    maxEdge: 2048; downsampled: boolean;
  };
}

export interface SurfacePreview {
  positions: Float32Array;
  normals?: Float32Array;
  labels: Uint8Array;
  faceMap: Uint32Array;
  supplementalSampling?: {
    method: 'upstream-sample-faces-nearest-original-leaf';
    /** Adaptive triangles requiring source sampling because no covered raster cell was sampled. */
    sampleCount: number;
    /** Distinct original faces containing those triangles. */
    faceCount: number;
  };
}

export type RegionEditTool = 'orbit' | 'select' | 'exclude' | 'protect' | 'unprotect';
export interface SurfaceEditResult {
  label: Uint8Array | null;
  surface?: SurfacePreview;
  surfaceLabels?: Uint8Array;
  overlay: Uint8Array;
  selectedCount: number;
  protectedCount: number;
  candidateCount: number;
  editedCount: number;
  pending: 'cleanup' | 'selection' | null;
  left: number;
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
  sourceColors?: Array<{ hex: string; w: number }> | null;
  quantization?: QuantizationInfo;
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
export interface PreserveOptions {
  cands: Array<{ id: string; hex: string }>;
  scale: number;
}
export interface PreserveResult extends LabelResult { slots: PaletteSlot[] }
export interface RegionPreviewOptions extends PreserveOptions { N: number; detail: number }
export interface RegionPreviewResult {
  slots: PaletteSlot[];
  label: Uint8Array;
  regionCount: number;
  cacheHit: boolean;
  actualColorCount?: number;
  quantization?: QuantizationInfo;
  surface?: SurfacePreview;
}

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
  surfaceEdit?: {
    quantization: { N: number; detail: number; scale: number } | null;
    inputFingerprint?: string;
    surfaceKey?: string;
    overrides: number[];
    protected: number[];
  };
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
export interface RestoreResult { label: Uint8Array | null; low: LowResult | null; surface?: SurfacePreview; editing?: SurfaceEditResult }
export interface RequestIdentity { projectId: string; requestId: number; editRevision: number }
export interface PrintProgress extends RequestIdentity { p: number; text: string }

export interface PrintCommands {
  init: [PrintMeshInput, InitResult];
  palette: [PaletteOptions, PaletteResult];
  label: [LabelOptions, LabelResult];
  preserve: [PreserveOptions, PreserveResult];
  preview: [RegionPreviewOptions, RegionPreviewResult];
  lowpoly: [LowOptions, LowResult];
  editDetect: [{ areaMM2: number; scale: number }, SurfaceEditResult];
  editPick: [{ seed: number; angle: number; tool: Exclude<RegionEditTool, 'orbit'> }, SurfaceEditResult];
  editApply: [{ label: number }, SurfaceEditResult];
  editCancel: [Record<string, never>, SurfaceEditResult];
  editClearProtection: [Record<string, never>, SurfaceEditResult];
  editUndo: [Record<string, never>, SurfaceEditResult];
  editReset: [Record<string, never>, SurfaceEditResult];
  paintHigh: [{ faces: Uint32Array; label: number }, EditResult];
  brushHigh: [{ hits: Array<{ face: number; point: [number, number, number]; radius: number }>; label: number }, EditResult];
  fillHigh: [{ seed: number; label: number; tol: number }, EditResult];
  paintLow: [{ dabs: LowDab[] }, EditResult];
  fillLow: [{ img: number; u: number; v: number; label: number; tol: number }, EditResult];
  undo: [Record<string, never>, EditResult];
  reset: [Record<string, never>, EditResult];
  snapshot: [Record<string, never>, { snapshot: PrintSnapshot }];
  restore: [{ snapshot: PrintSnapshot; scheme?: 'high' | 'low' }, RestoreResult];
  export3mf: [ExportOptions, ExportResult];
  selftest: [{ withConfig?: boolean; bed?: [number, number] }, ExportResult];
}
