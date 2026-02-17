import type {
  InitConnectionResponse,
  SubmitPhoneResponse,
  SubmitCodeResponse,
  Submit2FAResponse,
  TelegramConnectionStatus,
  MessageResponse,
} from '@aggregram/types'

export interface SessionHealthResponse {
  status: 'connected' | 'disconnected' | 'error'
  userId: string
  authorized: boolean
  sessionStatus?: 'active' | 'expired' | 'revoked'
  telegramUserId?: string
  message: string
  timestamp: string
  error?: string
}

export function telegramApi($api: typeof $fetch) {
  return {
    initConnection(method: 'qr' | 'phone') {
      return $api<InitConnectionResponse>('/telegram/connect/init', {
        method: 'POST',
        body: { method },
      })
    },

    submitPhone(phoneNumber: string) {
      return $api<SubmitPhoneResponse>('/telegram/connect/phone', {
        method: 'POST',
        body: { phoneNumber },
      })
    },

    submitCode(code: string) {
      return $api<SubmitCodeResponse>('/telegram/connect/code', {
        method: 'POST',
        body: { code },
      })
    },

    submit2FA(password: string) {
      return $api<Submit2FAResponse>('/telegram/connect/2fa', {
        method: 'POST',
        body: { password },
      })
    },

    refreshQr() {
      return $api<InitConnectionResponse>('/telegram/connect/qr/refresh', {
        method: 'POST',
      })
    },

    getConnection() {
      return $api<TelegramConnectionStatus>('/telegram/connection')
    },

    disconnect() {
      return $api<MessageResponse>('/telegram/connection', {
        method: 'DELETE',
      })
    },

    getSessionHealth() {
      return $api<SessionHealthResponse>('/health/session', {
        method: 'GET',
      })
    },
  }
}
