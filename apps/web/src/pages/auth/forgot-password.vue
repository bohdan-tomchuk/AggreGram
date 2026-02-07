<template>
  <ForgotPasswordForm
    :loading="authStore.loading"
    :server-error="serverError"
    :success="success"
    @submit="onForgotPassword"
  />
</template>

<script setup lang="ts">
import ForgotPasswordForm from '@features/auth/ui/ForgotPasswordForm.vue'
import { useAuthStore } from '@shared/model/stores/authStore'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

useHead({ title: 'Forgot password — AggreGram' })

const authStore = useAuthStore()
const serverError = ref('')
const success = ref(false)

async function onForgotPassword(payload: { email: string }) {
  serverError.value = ''
  try {
    await authStore.forgotPassword(payload.email)
    success.value = true
  } catch (e: any) {
    const msg = e?.data?.message
    serverError.value = Array.isArray(msg) ? msg[0] : msg || 'Something went wrong'
  }
}
</script>
