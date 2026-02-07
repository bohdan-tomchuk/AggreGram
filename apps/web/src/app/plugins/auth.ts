export default defineNuxtPlugin({
  name: 'auth',
  dependsOn: ['api'],
  async setup() {
    const authStore = useAuthStore()
    const token = useCookie('auth-token')

    if (token.value) {
      await authStore.fetchUser()
    }
  },
})
