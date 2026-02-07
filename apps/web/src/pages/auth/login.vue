<template>
  <LoginForm :loading="authStore.loading" :server-error="serverError" @submit="onLogin" />
</template>

<script setup lang="ts">
import LoginForm from '@features/auth/ui/LoginForm.vue'
import { useAuthStore } from '@shared/model/stores/authStore'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

useHead({ title: 'Sign in — AggreGram' })

const authStore = useAuthStore()
const serverError = ref('')

async function onLogin(payload: { email: string; password: string; rememberMe: boolean }) {
  serverError.value = ''
  try {
    await authStore.login(payload.email, payload.password)
    await navigateTo('/')
  } catch (e: any) {
    const msg = e?.data?.message
    serverError.value = Array.isArray(msg) ? msg[0] : msg || 'Invalid email or password'
  }
}
</script>
