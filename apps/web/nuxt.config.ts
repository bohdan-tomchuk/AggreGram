// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  srcDir: 'src/',

  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxt/icon'],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost/api',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  vite: {
    server: {
      hmr: {
        protocol: 'ws',
      },
    },
  },
})
