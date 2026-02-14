import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  future: {
    compatibilityVersion: 4,
  },

  devtools: { enabled: true },

  // Add srcDir to tell Nuxt where source code lives
  srcDir: 'src/',

  dir: {
    layouts: 'app/layouts',
    middleware: 'app/middleware',
    plugins: 'app/plugins',
  },

  // Update aliases for all FSD layers (absolute paths from project root)
  alias: {
    '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    '@entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
    '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
    '@widgets': fileURLToPath(new URL('./src/widgets', import.meta.url)),
  },

  modules: [
    '@nuxt/ui',
    '@nuxt/fonts',
    '@pinia/nuxt',
    '@nuxt/eslint',
  ],

  fonts: {
    families: [
      { name: 'Inter', provider: 'google' },
      { name: 'Space Grotesk', provider: 'google' },
    ],
  },

  // CSS path (~ refers to srcDir)
  css: ['~/app/styles/main.css'],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false, // Disabled temporarily - vue-tsc dependency issue
  },

  // Update auto-import directories (relative to srcDir)
  imports: {
    dirs: [
      'shared/api',
      'shared/lib',
      'shared/model/composables',
      'shared/model/stores',
      'entities/telegram/model',
      'entities/feed/model',
    ],
  },

  ui: {
    colors: {
      primary: 'brand',
      secondary: 'neutral',
      success: 'green',
      warning: 'amber',
      error: 'red',
      neutral: 'zinc',
    },
  },
})
