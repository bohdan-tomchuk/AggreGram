import { defineStore } from 'pinia'
import type { UserProfile } from '@aggregram/types'
import { authApi } from '@entities/session/api/authApi'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  const token = useCookie('auth-token')
  const { $api } = useNuxtApp()
  const api = authApi($api as typeof $fetch)

  let refreshTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleRefresh() {
    clearRefreshTimer()
    // Refresh 1 minute before access token expiry (14 min)
    refreshTimer = setTimeout(() => {
      refreshSession()
    }, 14 * 60 * 1000)
  }

  function clearRefreshTimer() {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
  }

  function setSession(accessToken: string, userProfile: UserProfile) {
    token.value = accessToken
    user.value = userProfile
    scheduleRefresh()
  }

  function clearAuth() {
    token.value = null
    user.value = null
    clearRefreshTimer()
  }

  async function login(email: string, password: string) {
    loading.value = true
    try {
      const res = await api.login({ email, password })
      setSession(res.accessToken, res.user)
      return res
    } finally {
      loading.value = false
    }
  }

  async function register(email: string, password: string, confirmPassword: string) {
    loading.value = true
    try {
      const res = await api.register({ email, password, confirmPassword })
      setSession(res.accessToken, res.user)
      return res
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await api.logout()
    } catch {
      // Logout should succeed even if the API call fails
    } finally {
      clearAuth()
    }
  }

  async function refreshSession() {
    try {
      const res = await api.refresh()
      setSession(res.accessToken, res.user)
      return res
    } catch {
      clearAuth()
      throw new Error('Session expired')
    }
  }

  async function fetchUser() {
    try {
      const userProfile = await api.me()
      user.value = userProfile
      scheduleRefresh()
    } catch {
      clearAuth()
    }
  }

  async function forgotPassword(email: string) {
    loading.value = true
    try {
      return await api.forgotPassword({ email })
    } finally {
      loading.value = false
    }
  }

  return {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshSession,
    fetchUser,
    forgotPassword,
    clearAuth,
  }
})
