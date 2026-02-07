<template>
  <div class="space-y-6">
    <template v-if="!success">
      <form @submit.prevent="onSubmit" class="space-y-6">
        <div>
          <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white">
            Forgot password
          </h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <div v-if="serverError" class="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
          <p class="text-sm text-red-700 dark:text-red-400">{{ serverError }}</p>
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
          :disabled="loading"
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

    <template v-else>
      <div class="text-center space-y-4">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <UIcon name="i-lucide-mail-check" class="size-6 text-green-600 dark:text-green-400" />
        </div>
        <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white">
          Check your email
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          If an account exists for <span class="font-medium text-gray-700 dark:text-gray-300">{{ form.email }}</span>, we've sent a password reset link.
        </p>
        <NuxtLink to="/auth/login">
          <UButton variant="outline" block size="lg" class="mt-4">
            Back to sign in
          </UButton>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { validateEmail } from '@shared/lib/validators'

const emit = defineEmits<{
  submit: [payload: { email: string }]
}>()

defineProps<{
  loading?: boolean
  serverError?: string
  success?: boolean
}>()

const form = reactive({
  email: '',
})

const errors = reactive({
  email: '',
})

function validate(): boolean {
  errors.email = validateEmail(form.email)
  return !errors.email
}

function onSubmit() {
  if (!validate()) return
  emit('submit', { email: form.email })
}
</script>
