<template>
  <form @submit.prevent="onSubmit" class="space-y-6">
    <div>
      <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white">
        Create account
      </h2>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Get started with AggreGram
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

      <div>
        <UFormField label="Password" :error="errors.password">
          <UInput
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Create a password"
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
        <div class="mt-2">
          <PasswordStrengthBar :password="form.password" />
        </div>
      </div>

      <UFormField label="Confirm password" :error="errors.confirmPassword">
        <UInput
          v-model="form.confirmPassword"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Confirm your password"
          icon="i-lucide-lock"
          class="w-full"
        />
      </UFormField>
    </div>

    <UCheckbox v-model="form.terms" :label="undefined">
      <template #label>
        <span class="text-sm text-gray-600 dark:text-gray-400">
          I agree to the
          <NuxtLink to="#" class="text-brand-500 hover:text-brand-600">Terms of Service</NuxtLink>
          and
          <NuxtLink to="#" class="text-brand-500 hover:text-brand-600">Privacy Policy</NuxtLink>
        </span>
      </template>
    </UCheckbox>
    <p v-if="errors.terms" class="text-xs text-red-500 -mt-4">{{ errors.terms }}</p>

    <UButton
      type="submit"
      block
      size="lg"
      color="primary"
      :loading="loading"
      :disabled="loading"
    >
      Create account
    </UButton>

    <p class="text-center text-sm text-gray-500 dark:text-gray-400">
      Already have an account?
      <NuxtLink to="/auth/login" class="text-brand-500 hover:text-brand-600 font-medium">
        Sign in
      </NuxtLink>
    </p>
  </form>
</template>

<script setup lang="ts">
import PasswordStrengthBar from './PasswordStrengthBar.vue'
import { validateEmail, validatePassword } from '@shared/lib/validators'

const emit = defineEmits<{
  submit: [payload: { email: string; password: string }]
}>()

defineProps<{
  loading?: boolean
  serverError?: string
}>()

const form = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  terms: false,
})

const showPassword = ref(false)

const errors = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  terms: '',
})

function validate(): boolean {
  errors.email = validateEmail(form.email)
  errors.password = validatePassword(form.password)

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password'
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match'
  } else {
    errors.confirmPassword = ''
  }

  errors.terms = form.terms ? '' : 'You must accept the terms'

  return !errors.email && !errors.password && !errors.confirmPassword && !errors.terms
}

function onSubmit() {
  if (!validate()) return
  emit('submit', { email: form.email, password: form.password })
}
</script>
