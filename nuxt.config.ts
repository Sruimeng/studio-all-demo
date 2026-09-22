export default defineNuxtConfig({
  compatibilityDate: '2026-09-21',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@unocss/nuxt', '@tripo3d/design/nuxt'],
  css: ['@tripo3d/design/style.css', '~/assets/studio.css'],
  app: { head: { title: 'Tripo · Material Studio', meta: [{ name: 'theme-color', content: '#141416' }] } },
  typescript: { strict: true },
  nitro: { preset: 'static' },
});
