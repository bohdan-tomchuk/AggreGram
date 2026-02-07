<template>
  <ForgotPasswordForm :loading="loading" @submit="onForgotPassword" />
</template>

<script setup lang="ts">
import ForgotPasswordForm from '@features/auth/ui/ForgotPasswordForm.vue'

definePageMeta({
  layout: 'auth',
})

useHead({ title: 'Forgot password — AggreGram' })

const loading = ref(false)

function onForgotPassword(_payload: { email: string }) {
  // Will be wired to auth store in Phase 3
  loading.value = true
  setTimeout(() => { loading.value = false }, 1000)
}
</script>
