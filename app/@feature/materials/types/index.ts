export const RENDER_RULE = 'studio-v1: roughnessFinal=0.5+0.5*(roughness*roughnessMap.g)' as const;
export const OPENPBR_RULE = 'openpbr-subset-v1' as const;
export const FILAMENT_RULE = 'filament-preview-v1' as const;
export type FinishId = 'basic' | 'matte' | 'silk' | 'metallic' | 'translucent';
export interface MaterialOptics {
  transmission?: number;
  thickness?: number;
  attenuationDistance?: number;
  sheen?: number;
  clearcoat?: number;
}
export interface FilamentAppearance {
  vendor: string;
  baseMaterial: string;
  seriesId?: string;
  templateId?: FinishId;
  colorCode?: string;
  sku?: string;
  source?: string;
  origin: 'catalog' | 'template' | 'user';
}
export interface MaterialTemplate {
  id: FinishId;
  name: string;
  nameCN: string;
  roughness: number;
  metalness: number;
  optics: MaterialOptics;
}
export interface MaterialSeries {
  id: string;
  vendor: string;
  baseMaterial: string;
  name: string;
  templateId?: FinishId;
  aliases?: string[];
  source: string;
}
export type ColorMode = 'catalog' | 'linear-srgb' | 'srgb';
export interface SupplierProfile {
  vendor: string;
  sku: string;
  catalogId?: string;
  product: string;
  colorFamily?: string;
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
    sheet?: string;
    rawHex?: string;
    swatchHex?: string;
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
export interface SupplierMaterialModification {
  id: string;
  materialId: string;
  vendor: string;
  changes: Array<{ field: keyof MaterialOverrides; source: string | number | null; value: string | number | null }>;
}
export interface AppearanceBinding {
  id: string;
  materialId: string;
  name: string;
  overridden: boolean;
  sourceFile?: string;
  sourceSha256?: string;
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
  renderRule: typeof RENDER_RULE | typeof OPENPBR_RULE | typeof FILAMENT_RULE;
  ior?: number;
  optics?: MaterialOptics;
  appearanceBinding?: AppearanceBinding;
  appearance?: FilamentAppearance;
  supplier?: SupplierProfile;
  overrides?: MaterialOverrides;
}
