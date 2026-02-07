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
const emit = defineEmits<{
  submit: [payload: { email: string; password: string; rememberMe: boolean }]
}>()

defineProps<{
  loading?: boolean
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

function validate(): boolean {
  errors.email = ''
  errors.password = ''

  if (!form.email) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email'
  }

  if (!form.password) {
    errors.password = 'Password is required'
  }

  return !errors.email && !errors.password
}

function onSubmit() {
  if (!validate()) return
  emit('submit', { ...form })
}
</script>
