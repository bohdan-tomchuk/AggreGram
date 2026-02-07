<template>
  <RegisterForm :loading="loading" @submit="onRegister" />
</template>

<script setup lang="ts">
import RegisterForm from '@features/auth/ui/RegisterForm.vue'

definePageMeta({
  layout: 'auth',
})

useHead({ title: 'Create account — AggreGram' })

const loading = ref(false)

function onRegister(_payload: { email: string; password: string }) {
  // Will be wired to auth store in Phase 3
  loading.value = true
  setTimeout(() => { loading.value = false }, 1000)
}
</script>
