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

  // --- Computed ---
  const isConnected = computed(() => wizardStep.value === 'connected')

  // --- Actions ---

  function reset() {
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
    stopPolling()
    pollTimer = setInterval(async () => {
      try {
        const status = await api.getConnection()

        if (status.setupStages) {
          setupStages.value = status.setupStages
        }

        if (status.step === 'connected') {
          wizardStep.value = 'connected'
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
    // Computed
    isConnected,
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
  }
})
