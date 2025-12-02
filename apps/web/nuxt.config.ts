// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  srcDir: 'src/',

  modules: ['@nuxt/ui', '@pinia/nuxt'],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
