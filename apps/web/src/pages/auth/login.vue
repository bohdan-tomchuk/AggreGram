<template>
  <LoginForm :loading="loading" @submit="onLogin" />
</template>

<script setup lang="ts">
import LoginForm from '@features/auth/ui/LoginForm.vue'

definePageMeta({
  layout: 'auth',
})

useHead({ title: 'Sign in — AggreGram' })

const loading = ref(false)

function onLogin(_payload: { email: string; password: string; rememberMe: boolean }) {
  // Will be wired to auth store in Phase 3
  loading.value = true
  setTimeout(() => { loading.value = false }, 1000)
}
</script>
