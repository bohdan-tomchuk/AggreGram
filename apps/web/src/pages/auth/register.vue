<template>
  <RegisterForm :loading="authStore.loading" :server-error="serverError" @submit="onRegister" />
</template>

<script setup lang="ts">
import RegisterForm from '@features/auth/ui/RegisterForm.vue'
import { useAuthStore } from '@shared/model/stores/authStore'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

useHead({ title: 'Create account — AggreGram' })

const authStore = useAuthStore()
const serverError = ref('')

async function onRegister(payload: { email: string; password: string }) {
  serverError.value = ''
  try {
    await authStore.register(payload.email, payload.password, payload.password)
    await navigateTo('/')
  } catch (e: any) {
    const msg = e?.data?.message
    serverError.value = Array.isArray(msg) ? msg[0] : msg || 'Could not create account'
  }
}
</script>
