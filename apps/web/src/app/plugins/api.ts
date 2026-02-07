export default defineNuxtPlugin({
  name: 'api',
  setup(nuxtApp) {
    const config = useRuntimeConfig()
    const token = useCookie('auth-token')

    let refreshPromise: Promise<void> | null = null

    const api = $fetch.create({
      baseURL: config.public.apiBase as string,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      onRequest({ options }) {
        if (token.value) {
          options.headers = new Headers({
            ...options.headers as HeadersInit,
            Authorization: `Bearer ${token.value}`,
          })
        }
      },
      async onResponseError({ response, request, options }) {
        if (response.status === 401 && !(options as any)._retry) {
          // Attempt silent refresh — queue concurrent refreshes
          if (!refreshPromise) {
            refreshPromise = $fetch<{ accessToken: string }>('/auth/refresh', {
              baseURL: config.public.apiBase as string,
              method: 'POST',
              credentials: 'include',
            })
              .then((res) => {
                token.value = res.accessToken
              })
              .catch(() => {
                token.value = null
              })
              .finally(() => {
                refreshPromise = null
              })
          }

          await refreshPromise

          // If refresh succeeded, retry the original request
          if (token.value) {
            (options as any)._retry = true
            return $fetch(request, {
              ...options,
              headers: {
                ...options.headers as HeadersInit,
                Authorization: `Bearer ${token.value}`,
              },
            })
          }

          // Refresh failed — redirect to login
          await nuxtApp.runWithContext(() => navigateTo('/auth/login'))
        }
      },
    })

    return {
      provide: {
        api,
      },
    }
  },
})
