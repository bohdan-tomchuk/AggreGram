<template>
  <form @submit.prevent="onSubmit" class="space-y-6">
    <div>
      <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white">
        Sign in
      </h2>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Welcome back to AggreGram
      </p>
    </div>

    <div v-if="serverError" class="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
      <p class="text-sm text-red-700 dark:text-red-400">{{ serverError }}</p>
    </div>

    <div class="space-y-4">
      <UFormField label="Email" :error="errors.email">
        <UInput
          v-model="form.email"
          type="email"
          placeholder="you@example.com"
          icon="i-lucide-mail"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Password" :error="errors.password">
        <UInput
          v-model="form.password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Enter your password"
          icon="i-lucide-lock"
          class="w-full"
        >
          <template #trailing>
            <button
              type="button"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              @click="showPassword = !showPassword"
            >
              <UIcon :name="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-4" />
            </button>
          </template>
        </UInput>
      </UFormField>
    </div>

    <div class="flex items-center justify-between">
      <UCheckbox v-model="form.rememberMe" label="Remember me" />
      <NuxtLink
        to="/auth/forgot-password"
        class="text-sm text-brand-500 hover:text-brand-600"
      >
        Forgot password?
      </NuxtLink>
    </div>

    <UButton
      type="submit"
      block
      size="lg"
      color="primary"
      :loading="loading"
      :disabled="loading"
    >
      Sign in
    </UButton>

    <p class="text-center text-sm text-gray-500 dark:text-gray-400">
      Don't have an account?
      <NuxtLink to="/auth/register" class="text-brand-500 hover:text-brand-600 font-medium">
        Sign up
      </NuxtLink>
    </p>
  </form>
</template>

<script setup lang="ts">
import { validateEmail } from '@shared/lib/validators'

const emit = defineEmits<{
  submit: [payload: { email: string; password: string; rememberMe: boolean }]
}>()

const props = defineProps<{
  loading?: boolean
  serverError?: string
}>()

const form = reactive({
  email: '',
  password: '',
  rememberMe: false,
})

const showPassword = ref(false)

const errors = reactive({
  email: '',
  password: '',
})

watch(() => props.serverError, () => {
  // Clear field errors when a new server error arrives
})

function validate(): boolean {
  errors.email = validateEmail(form.email)
  errors.password = form.password ? '' : 'Password is required'

  return !errors.email && !errors.password
}

function onSubmit() {
  if (!validate()) return
  emit('submit', { ...form })
}
</script>
