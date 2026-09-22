export const RENDER_RULE = 'studio-v1: roughnessFinal=0.5+0.5*(roughness*roughnessMap.g)' as const;
export interface MaterialRecord {
  id: string;
  materialId: string;
  name: string;
  hex: string;
  transparency: number;
  metalness: number;
  roughness: number;
  referenceImage?: string;
  colorSpace: 'srgb';
  renderRule: typeof RENDER_RULE;
}
