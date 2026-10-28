import { createSite } from './app/@base/site/config';

const site = createSite(process.env.VITE_MATERIAL_VENDOR);

export default defineNuxtConfig({
  compatibilityDate: '2026-09-21',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@unocss/nuxt', '@tripo3d/design/nuxt'],
  css: ['@tripo3d/design/style.css', '~/assets/studio.css'],
  app: { head: { title: site.title, meta: [{ name: 'theme-color', content: '#141416' }, { name: 'material-vendor', content: site.vendor ?? 'all' }] } },
  typescript: { strict: true },
  nitro: { preset: 'static' },
});
