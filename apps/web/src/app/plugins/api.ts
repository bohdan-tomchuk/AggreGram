export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const token = useCookie('auth-token')

  const api = $fetch.create({
    baseURL: config.public.apiBase as string,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    onRequest({ options }) {
      // Add auth token if available
      if (token.value) {
        options.headers = new Headers({
          ...options.headers as HeadersInit,
          Authorization: `Bearer ${token.value}`,
        })
      }
    },
    async onResponseError({ response }) {
      // Handle global errors
      if (response.status === 401) {
        // Redirect to login on unauthorized
        await nuxtApp.runWithContext(() => navigateTo('/login'))
      } else {
        console.error('API Error:', response.status, response._data)
      }
    },
  })

  return {
    provide: {
      api,
    },
  }
})
