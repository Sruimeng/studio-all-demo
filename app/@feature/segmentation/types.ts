export type SegmentMode = 'parts' | 'colors';
export interface SegmentOptions { prompt: string; detail: 'coarse' | 'standard' | 'fine'; mergeSimilar: boolean }
export interface SegmentGroup { id: number; name: string; color: string; sourceColor?: string }
export interface SegmentReference { id: string; name: string; url: string; width: number; height: number; sample: 'chicken' | 'turkey' }
export interface SegmentMask { referenceId: string; width: number; height: number; labels: number[] }
export interface SegmentPlan {
  key: string; optionsKey: string; groups: SegmentGroup[]; labels: number[]; edited: boolean;
  mask?: SegmentMask;
  mappingDirty?: boolean;
  /** Direct 3D painting changed face ownership; the reference mask is now historical. */
  maskOutdated?: boolean;
  method?: 'reference-demo-v1';
}
export interface SegmentResult { plan: SegmentPlan; createdAt: string; confirmed?: boolean; projectId?: string }
export interface SegmentDraft { options: SegmentOptions; plan: SegmentPlan | null; result: SegmentResult | null; previousPlan?: SegmentPlan }
export interface SegmentDocument {
  version: 1; geometryKey: string; mode: SegmentMode; drafts: Record<SegmentMode, SegmentDraft>;
  reference?: SegmentReference;
}
export interface SegmentPiece { id: number; groupId: number; name: string; color: string; faces: number[]; boundary: number; nonManifold: number }
export const markerColors = ['#83b8ff', '#f2bb6b', '#a699ed', '#77cab3', '#ef91ab', '#c9d77d', '#abceda', '#e7a885'];
export const freshDraft = (): SegmentDraft => ({ options: { prompt: '', detail: 'standard', mergeSimilar: true }, plan: null, result: null });
export const optionsKey = (mode: SegmentMode, options: SegmentOptions) => JSON.stringify([mode, options.prompt.trim(), options.detail, options.mergeSimilar]);
