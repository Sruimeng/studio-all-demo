import type { SegmentDocument } from '../../segmentation/types';
import type { PreparationState } from '../print-preparation';
import type { MaterialRecord } from '../../materials';
import type { PrintSnapshot } from '../../../@engine/multicolor';
import type { ViewerSettings } from '../../../@engine/viewer';
export interface RegionColorMatch {
  basis: 'catalog-hex-d65-deltae00';
  materialId: string;
  hex: string;
  meanDeltaE: number;
  areaShare: number;
}
export interface RegionAssignment {
  index: number;
  sourceHex: string;
  match?: RegionColorMatch;
  material: MaterialRecord;
}
export interface PrintProject {
  version: 1 | 2; id: string; name: string; updatedAt: string;
  files: Array<{ name: string; path: string; type: string; data: Blob }>;
  regions: RegionAssignment[];
  height: number; colorCount: number; precision: number; scheme: 'high' | 'low';
  snapshot: PrintSnapshot | null;
  viewerSettings?: ViewerSettings;
  validationMaterial?: MaterialRecord | null;
  preparation?: PreparationState;
  sourceSample?: 'chicken' | 'turkey' | 'role';
  segmentation?: SegmentDocument | null;
  segmentSourceId?: string;
  segmentOpenPieces?: number;
}
