export type SiteVendor = 'SUNLU' | 'Polymaker';

export function createSite(value?: string) {
  const vendor = value?.trim() || null;
  if (vendor && vendor !== 'SUNLU' && vendor !== 'Polymaker') throw new Error(`Unsupported site vendor: ${vendor}`);
  const id = vendor?.toLowerCase() ?? 'all';
  return {
    vendor: vendor as SiteVendor | null,
    id,
    title: vendor ? `${vendor} · Material Studio` : 'Tripo · Material Studio',
    database: vendor ? `tripo-material-studio-${id}` : 'tripo-material-studio',
    materialId: vendor === 'SUNLU' ? 'SUNLU-PLA-WHITE' : 'CA19017',
    seriesId: vendor === 'SUNLU' ? 'sunlu-pla-catalog' : 'polymaker-panchroma-catalog',
  };
}
