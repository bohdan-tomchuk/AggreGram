<template>
  <div class="space-y-8">
    <WizardStepIndicator :current-step="twoFaStepIndex" :labels="stepLabels" />

    <div class="text-center">
      <div class="mx-auto mb-4 w-14 h-14 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
        <UIcon name="i-lucide-shield-check" class="size-7 text-brand-500" />
      </div>
      <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white">
        Two-Factor Authentication
      </h2>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Enter your Telegram 2FA password to continue.
      </p>
    </div>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <div v-if="error" class="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
        <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
      </div>

      <UFormField label="Password">
        <UInput
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Enter your 2FA password"
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

      <p v-if="hint" class="text-sm text-gray-500 dark:text-gray-400">
        Hint: <span class="font-medium text-gray-700 dark:text-gray-300">{{ hint }}</span>
      </p>

      <UButton
        type="submit"
        block
        size="lg"
        color="primary"
        :loading="loading"
        :disabled="loading || !password.trim()"
      >
        Verify
      </UButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import WizardStepIndicator from './WizardStepIndicator.vue'

const props = defineProps<{
  hint: string
  loading: boolean
  error: string
  stepLabels: string[]
  twoFaStepIndex: number
}>()

const emit = defineEmits<{
  submit: [payload: { password: string }]
}>()

const password = ref('')
const showPassword = ref(false)

function onSubmit() {
  if (!password.value.trim()) return
  emit('submit', { password: password.value })
}
</script>
