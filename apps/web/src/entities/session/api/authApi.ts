import type {
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  UserProfile,
} from '@aggregram/types'

export function authApi($api: typeof $fetch) {
  return {
    login(data: LoginRequest) {
      return $api<AuthResponse>('/auth/login', { method: 'POST', body: data })
    },

    register(data: RegisterRequest) {
      return $api<AuthResponse>('/auth/register', { method: 'POST', body: data })
    },

    refresh() {
      return $api<AuthResponse>('/auth/refresh', { method: 'POST' })
    },

    logout() {
      return $api<MessageResponse>('/auth/logout', { method: 'POST' })
    },

    forgotPassword(data: ForgotPasswordRequest) {
      return $api<MessageResponse>('/auth/forgot-password', { method: 'POST', body: data })
    },

    me() {
      return $api<UserProfile>('/auth/me')
    },
  }
}
