import type { MaterialRecord } from '../../materials';
import type { PrintSnapshot } from '../../../@engine/multicolor';
export interface RegionAssignment { index: number; sourceHex: string; material: MaterialRecord }
export interface PrintProject {
  version: 1; id: string; name: string; updatedAt: string;
  files: Array<{ name: string; path: string; type: string; data: Blob }>;
  regions: RegionAssignment[];
  height: number; colorCount: number; precision: number; scheme: 'high' | 'low';
  snapshot: PrintSnapshot | null;
}
