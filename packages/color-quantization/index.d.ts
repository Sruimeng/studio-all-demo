export interface QuantizationInput {
  triWorld: Float32Array;
  triUV: Float32Array;
  texture: { width: number; height: number; data: Uint8Array };
  flipY: boolean;
}
export interface Callbacks {
  log?: (message: string) => void;
  progress?: (stage: string, fraction: number) => void;
}
export interface AnalyzeOptions extends Callbacks {
  /** Premerge distance matrix only; default 128 MiB, not a total heap limit. */
  maxDistanceMatrixBytes?: number;
}
export interface PaletteColor {
  rgb: number[];
  lab: number[];
  weight: number;
  areaRatio: number;
  hex: string;
}
export interface Level {
  K: number;
  leafToCluster: number[];
  clusters: PaletteColor[];
}
export interface Merge {
  intoLeaf: number;
  fromLeaf: number;
  cost: number;
  deltaE2000: number;
  mergeDistance: number;
  byJnd: boolean;
}
/** Treat analysis as immutable. Structured clones retain the content binding. */
export interface Analysis {
  version: 1;
  inputFingerprint: string;
  integrity: string;
  flipY: boolean;
  faceCount: number;
  leafLab: number[][];
  leafWeight: number[];
  leafTexelCount: number[];
  merges: Merge[];
  jndMergeCount: number;
  suggestedColorCount: number;
  maxSelectableColorCount: number;
  totalCovered: number;
  levels: Level[];
  width: number;
  height: number;
  /** 255 means uncovered. */
  leafIndexMap: Uint8Array;
}
export interface Preview {
  width: number;
  height: number;
  /** Uncovered texels are transparent black; covered texels are opaque. */
  data: Uint8Array;
  palette: PaletteColor[];
  colorCount: number;
}
export interface CommittedMesh {
  /** xyz vertices, upstream field name. */
  P: Float32Array;
  /** Three vertex indices per face. */
  T: Int32Array;
  /** One palette index per face. */
  lab: Int32Array;
  palette: PaletteColor[];
  K: number;
  cutStats: { active: number; cut: number; passive: number; degenerate: number; cdtFail: number; triangles: number };
  fairStats: { movable: number; band: number; damped?: number; pinned?: number };
  weldStats: { input: number; degenerate: number; duplicates: number; openEdgesBefore?: number; holesClosed?: number };
}
export interface CommitOptions extends Callbacks { colorCount: number }
export class QuantizationError extends Error {
  constructor(code: string, message: string);
  code: string;
}
export const DEFAULT_DISTANCE_MATRIX_BYTES: number;
export function analyze(input: QuantizationInput, options?: AnalyzeOptions): Analysis;
export function getLevel(analysis: Analysis, colorCount: number): Level;
export function renderPreview(analysis: Analysis, colorCount: number): Preview;
export function commit(input: QuantizationInput, analysis: Analysis, options: CommitOptions): CommittedMesh;
