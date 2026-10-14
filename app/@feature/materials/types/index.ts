export const RENDER_RULE = 'studio-v1: roughnessFinal=0.5+0.5*(roughness*roughnessMap.g)' as const;
export const OPENPBR_RULE = 'openpbr-subset-v1' as const;
export type ColorMode = 'catalog' | 'linear-srgb' | 'srgb';
export interface SupplierProfile {
  vendor: string;
  sku: string;
  product: string;
  colorNameEN: string;
  colorNameCN: string;
  materialType: string;
  catalogHex: string | null;
  pantone: string | null;
  d65Lab: [number, number, number] | null;
  status: 'paired' | 'color-only' | 'unmatched' | 'imported';
  origin?: 'local-usda';
  issues: string[];
  source: {
    spreadsheet: string;
    row: number | null;
    file: string | null;
    sha256: string | null;
    materialName: string | null;
    colorSpace: 'unknown';
    parameters: Record<string, number | boolean | number[]>;
    materialUSDA: string | null;
  };
}
export interface SupplierCatalog { version: 1; vendor: string; records: SupplierProfile[] }
export interface MaterialImportResult { imported: number; errors: string[] }
export interface MaterialOverrides {
  hex?: string;
  transparency?: number;
  metalness?: number;
  roughness?: number;
  ior?: number;
  colorMode?: ColorMode;
}
export interface MaterialRecord {
  version?: 2;
  id: string;
  materialId: string;
  name: string;
  hex: string;
  transparency: number;
  metalness: number;
  roughness: number;
  referenceImage?: string;
  colorSpace: 'srgb';
  renderRule: typeof RENDER_RULE | typeof OPENPBR_RULE;
  ior?: number;
  supplier?: SupplierProfile;
  overrides?: MaterialOverrides;
}
