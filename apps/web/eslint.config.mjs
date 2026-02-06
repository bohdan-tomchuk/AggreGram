// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Disable multi-word component name rule for pages directory
    // Pages like index.vue are standard in Nuxt and shouldn't require multi-word names
    'vue/multi-word-component-names': ['error', {
      ignores: ['index', 'default', 'error']
    }]
  }
})
