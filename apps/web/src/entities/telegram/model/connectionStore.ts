import { defineStore } from 'pinia'
import type {
  TelegramAuthStep,
  TelegramConnectionStatus,
  SetupStage,
} from '@aggregram/types'
import { telegramApi } from '@entities/telegram/api/telegramApi'
import type { AuthMethod } from '@features/telegram-wizard/model/types'

export const useTelegramStore = defineStore('telegram', () => {
  const { $api } = useNuxtApp()
  const api = telegramApi($api as typeof $fetch)
  const toast = useToast()

  // --- State ---
  const wizardStep = ref<TelegramAuthStep>('idle')
  const authMethod = ref<AuthMethod>('qr')
  const loading = ref(false)
  const error = ref('')
  const qrCodeUrl = ref('')
  const phoneDisplay = ref('')
  const twoFactorHint = ref('')
  const botUsername = ref('')
  const telegramUserId = ref('')
  const setupStages = ref<SetupStage[]>([
    { id: 'session_connected', label: 'Session connected', status: 'pending' },
    { id: 'creating_bot', label: 'Creating your bot', status: 'pending' },
    { id: 'finalizing', label: 'Finalizing setup', status: 'pending' },
  ])

  // Full phone number stored for resend
  const fullPhoneNumber = ref('')

  // Resume context from backend
  const resumeMethod = ref<AuthMethod | null>(null)
  const resumePhone = ref('')

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let qrPollTimer: ReturnType<typeof setInterval> | null = null
  let healthCheckTimer: ReturnType<typeof setInterval> | null = null

  // Session health status from backend
  const sessionHealthStatus = ref<'connected' | 'disconnected' | 'expired' | null>(null)

  // --- Computed ---
  const isConnected = computed(() =>
    wizardStep.value === 'connected' &&
    sessionHealthStatus.value === 'connected'
  )

  // For UI states where we want to show "connected" when health status is unknown
  const isConnectedOrUnknown = computed(() =>
    wizardStep.value === 'connected' &&
    (sessionHealthStatus.value === 'connected' || sessionHealthStatus.value === null)
  )

  // --- Actions ---

  function reset(preserveResume = false) {
    // Save resume context if preserving
    const savedResumeMethod = preserveResume ? resumeMethod.value : null
    const savedResumePhone = preserveResume ? resumePhone.value : ''

    wizardStep.value = 'idle'
    authMethod.value = 'qr'
    loading.value = false
    error.value = ''
    qrCodeUrl.value = ''
    phoneDisplay.value = ''
    twoFactorHint.value = ''
    botUsername.value = ''
    telegramUserId.value = ''
    fullPhoneNumber.value = ''
    resumeMethod.value = null
    resumePhone.value = ''
    setupStages.value = [
      { id: 'session_connected', label: 'Session connected', status: 'pending' },
      { id: 'creating_bot', label: 'Creating your bot', status: 'pending' },
      { id: 'finalizing', label: 'Finalizing setup', status: 'pending' },
    ]
    stopPolling()
    stopQrPolling()

    // Restore resume context if preserving
    if (preserveResume) {
      resumeMethod.value = savedResumeMethod
      resumePhone.value = savedResumePhone
    }
  }

  function extractError(e: unknown): string {
    const data = (e as any)?.data
    if (data?.message) {
      return Array.isArray(data.message) ? data.message[0] : data.message
    }
    return 'Something went wrong. Please try again.'
  }

  async function fetchConnection(): Promise<TelegramConnectionStatus | null> {
    try {
      const status = await api.getConnection()
      applyStatus(status)
      return status
    } catch (e) {
      // Connection endpoint might 404 if no connection exists — that's fine
      wizardStep.value = 'idle'
      return null
    }
  }

  function applyStatus(status: TelegramConnectionStatus) {
    wizardStep.value = status.step

    // Set session health when connection is established
    if (status.step === 'connected') {
      sessionHealthStatus.value = 'connected'
    }

    if (status.qrCodeUrl) qrCodeUrl.value = status.qrCodeUrl
    if (status.twoFactorHint) twoFactorHint.value = status.twoFactorHint
    if (status.botUsername) botUsername.value = status.botUsername
    if (status.phoneNumber) phoneDisplay.value = status.phoneNumber
    if (status.telegramUserId) telegramUserId.value = status.telegramUserId
    if (status.error) error.value = status.error
    if (status.setupStages) setupStages.value = status.setupStages

    // Handle resume context
    if (status.resumeContext) {
      if (status.resumeContext.lastMethod) {
        resumeMethod.value = status.resumeContext.lastMethod
        authMethod.value = status.resumeContext.lastMethod
      }
      if (status.resumeContext.phoneNumber) {
        resumePhone.value = status.resumeContext.phoneNumber
      }
    }

    // Auto-start polling if in setup phase
    if (status.step === 'setting_up') {
      startPolling()
    }
  }

  async function initConnection(method: AuthMethod) {
    loading.value = true
    error.value = ''
    authMethod.value = method

    try {
      const res = await api.initConnection(method)
      wizardStep.value = res.step
      if (res.qrCodeUrl) qrCodeUrl.value = res.qrCodeUrl

      // Start QR polling if we're in QR scan mode
      if (res.step === 'awaiting_qr_scan') {
        startQrPolling()
      } else {
        stopQrPolling()
      }
    } catch (e) {
      error.value = extractError(e)
      toast.add({ title: 'Connection failed', description: error.value, color: 'error' })
    } finally {
      loading.value = false
    }
  }

  async function submitPhone(countryCode: string, phoneNumber: string) {
    loading.value = true
    error.value = ''
    const fullPhone = `${countryCode}${phoneNumber}`
    fullPhoneNumber.value = fullPhone
    phoneDisplay.value = `${countryCode} ${phoneNumber}`

    try {
      const res = await api.submitPhone(fullPhone)
      wizardStep.value = res.step
      if (res.phoneNumberMasked) phoneDisplay.value = res.phoneNumberMasked
    } catch (e) {
      error.value = extractError(e)
      toast.add({ title: 'Phone submission failed', description: error.value, color: 'error' })
    } finally {
      loading.value = false
    }
  }

  async function submitCode(code: string) {
    loading.value = true
    error.value = ''

    try {
      const res = await api.submitCode(code)
      wizardStep.value = res.step
      if (res.twoFactorHint) twoFactorHint.value = res.twoFactorHint

      // If step is setting_up, start polling
      if (res.step === 'setting_up') {
        startPolling()
      }
    } catch (e) {
      error.value = extractError(e)
      toast.add({ title: 'Code verification failed', description: error.value, color: 'error' })
    } finally {
      loading.value = false
    }
  }

  async function submit2FA(password: string) {
    loading.value = true
    error.value = ''

    try {
      const res = await api.submit2FA(password)
      wizardStep.value = res.step

      if (res.step === 'setting_up') {
        startPolling()
      }
    } catch (e) {
      error.value = extractError(e)
      toast.add({ title: '2FA verification failed', description: error.value, color: 'error' })
    } finally {
      loading.value = false
    }
  }

  async function refreshQr() {
    loading.value = true
    error.value = ''

    try {
      const res = await api.refreshQr()
      if (res.qrCodeUrl) qrCodeUrl.value = res.qrCodeUrl
    } catch (e) {
      error.value = extractError(e)
      toast.add({ title: 'QR refresh failed', description: error.value, color: 'error' })
    } finally {
      loading.value = false
    }
  }

  async function resendCode() {
    if (!fullPhoneNumber.value) return
    loading.value = true
    error.value = ''

    try {
      const res = await api.submitPhone(fullPhoneNumber.value)
      wizardStep.value = res.step
      if (res.phoneNumberMasked) phoneDisplay.value = res.phoneNumberMasked
    } catch (e) {
      error.value = extractError(e)
      toast.add({ title: 'Resend failed', description: error.value, color: 'error' })
    } finally {
      loading.value = false
    }
  }

  async function disconnect() {
    loading.value = true
    error.value = ''

    try {
      await api.disconnect()
      reset()
      toast.add({ title: 'Disconnected', description: 'Telegram account disconnected.', color: 'success' })
    } catch (e) {
      error.value = extractError(e)
      toast.add({ title: 'Disconnect failed', description: error.value, color: 'error' })
    } finally {
      loading.value = false
    }
  }

  // --- Polling for setup progress ---

  function startPolling() {
    if (!import.meta.client) return
    stopPolling()
    pollTimer = setInterval(async () => {
      try {
        const status = await api.getConnection()

        if (status.setupStages) {
          setupStages.value = status.setupStages
        }

        if (status.step === 'connected') {
          wizardStep.value = 'connected'
          sessionHealthStatus.value = 'connected'
          if (status.botUsername) botUsername.value = status.botUsername
          stopPolling()
        } else if (status.step === 'error') {
          wizardStep.value = 'error'
          if (status.error) error.value = status.error
          if (status.telegramUserId) telegramUserId.value = status.telegramUserId
          stopPolling()
          toast.add({ title: 'Setup failed', description: status.error || 'An error occurred during setup.', color: 'error' })
        }
      } catch {
        // Polling errors are silently ignored — next tick will retry
      }
    }, 2000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  // --- QR polling: detect scan, new QR, or state changes ---

  function startQrPolling() {
    if (!import.meta.client) return
    stopQrPolling()
    qrPollTimer = setInterval(async () => {
      try {
        const status = await api.getConnection()

        // QR code updated (auto-refresh from backend)
        if (status.qrCodeUrl && status.qrCodeUrl !== qrCodeUrl.value) {
          qrCodeUrl.value = status.qrCodeUrl
        }

        // Step has progressed beyond QR scan (user scanned successfully)
        if (status.step !== 'awaiting_qr_scan') {
          applyStatus(status)
          stopQrPolling()
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 3000)
  }

  function stopQrPolling() {
    if (qrPollTimer) {
      clearInterval(qrPollTimer)
      qrPollTimer = null
    }
  }

  // --- Session Health Sync ---

  async function syncSessionHealth() {
    try {
      const health = await api.getSessionHealth()

      // Update session health status - map API response to our internal status
      if (health.sessionStatus === 'expired' || health.sessionStatus === 'revoked') {
        sessionHealthStatus.value = 'expired'
      } else if (health.status === 'connected') {
        sessionHealthStatus.value = 'connected'
      } else if (health.status === 'disconnected' || health.status === 'error') {
        sessionHealthStatus.value = 'disconnected'
      }

      // Auto-reset wizard state when session expires
      if ((health.sessionStatus === 'expired' || health.sessionStatus === 'revoked') && wizardStep.value === 'connected') {
        // Reset all wizard state but preserve resume context for better UX
        reset(true)
        toast.add({
          title: 'Telegram Session Expired',
          description: 'Your Telegram connection has expired. Please reconnect.',
          color: 'warning'
        })
      }
    } catch (error) {
      // Session check failed - user likely not authenticated yet or network issue
      // Don't update sessionHealthStatus to avoid false negatives
      console.debug('Session health check failed:', error)
    }
  }

  function startHealthCheck() {
    if (!import.meta.client) return
    stopHealthCheck()
    // Initial sync
    syncSessionHealth()
    // Poll every 60 seconds
    healthCheckTimer = setInterval(syncSessionHealth, 60000)
  }

  function stopHealthCheck() {
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer)
      healthCheckTimer = null
    }
  }

  return {
    // State
    wizardStep,
    authMethod,
    loading,
    error,
    qrCodeUrl,
    phoneDisplay,
    twoFactorHint,
    botUsername,
    telegramUserId,
    setupStages,
    resumeMethod,
    resumePhone,
    sessionHealthStatus,
    // Computed
    isConnected,
    isConnectedOrUnknown,
    // Actions
    reset,
    fetchConnection,
    initConnection,
    submitPhone,
    submitCode,
    submit2FA,
    refreshQr,
    resendCode,
    disconnect,
    stopPolling,
    stopQrPolling,
    syncSessionHealth,
    startHealthCheck,
    stopHealthCheck,
  }
})
