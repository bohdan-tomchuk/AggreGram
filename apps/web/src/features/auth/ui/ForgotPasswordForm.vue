<template>
  <form @submit.prevent="onSubmit" class="space-y-6">
    <div>
      <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white">
        Forgot password
      </h2>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Enter your email and we'll send you a reset link
      </p>
    </div>

    <UFormField label="Email" :error="errors.email">
      <UInput
        v-model="form.email"
        type="email"
        placeholder="you@example.com"
        icon="i-lucide-mail"
        class="w-full"
      />
    </UFormField>

    <UButton
      type="submit"
      block
      size="lg"
      color="primary"
      :loading="loading"
    >
      Send reset link
    </UButton>

    <p class="text-center text-sm text-gray-500 dark:text-gray-400">
      <NuxtLink to="/auth/login" class="text-brand-500 hover:text-brand-600 font-medium">
        Back to sign in
      </NuxtLink>
    </p>
  </form>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  submit: [payload: { email: string }]
}>()

defineProps<{
  loading?: boolean
}>()

const form = reactive({
  email: '',
})

const errors = reactive({
  email: '',
})

function validate(): boolean {
  errors.email = ''

  if (!form.email) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email'
  }

  return !errors.email
}

function onSubmit() {
  if (!validate()) return
  emit('submit', { email: form.email })
}
</script>
