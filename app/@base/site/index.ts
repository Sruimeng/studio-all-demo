import { createSite } from './config';

export const site = createSite(import.meta.env.VITE_MATERIAL_VENDOR);
export const includesVendor = (vendor: string) => !site.vendor || vendor === site.vendor;
