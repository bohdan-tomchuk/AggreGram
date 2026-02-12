import type {
  InitConnectionResponse,
  SubmitPhoneResponse,
  SubmitCodeResponse,
  Submit2FAResponse,
  TelegramConnectionStatus,
  MessageResponse,
} from '@aggregram/types'

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
  }
}
