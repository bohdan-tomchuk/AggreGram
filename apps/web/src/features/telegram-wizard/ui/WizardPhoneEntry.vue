<template>
  <div class="space-y-8">
    <WizardStepIndicator :current-step="1" :labels="stepLabels" />

    <div class="text-center">
      <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white">
        Enter Phone Number
      </h2>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
        We'll send a verification code to your Telegram app.
      </p>
    </div>

    <form class="space-y-4" @submit.prevent="onSubmit">
      <div v-if="error" class="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
        <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
      </div>

      <div class="flex gap-2">
        <UInput
          v-model="countryCode"
          class="w-24 shrink-0"
          placeholder="+1"
          icon="i-lucide-globe"
        />
        <UInput
          v-model="phoneNumber"
          class="flex-1"
          type="tel"
          placeholder="Phone number"
          icon="i-lucide-phone"
        />
      </div>

      <UButton
        type="submit"
        block
        size="lg"
        color="primary"
        :loading="loading"
        :disabled="loading || !phoneNumber.trim()"
      >
        Send Code
      </UButton>
    </form>

    <div class="text-center">
      <button
        type="button"
        class="text-sm text-brand-500 hover:text-brand-600 font-medium"
        @click="emit('switch-to-qr')"
      >
        Use QR code instead
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import WizardStepIndicator from './WizardStepIndicator.vue'

defineProps<{
  loading: boolean
  error: string
  stepLabels: string[]
}>()

const emit = defineEmits<{
  submit: [payload: { countryCode: string; phoneNumber: string }]
  'switch-to-qr': []
}>()

const countryCode = ref('+1')
const phoneNumber = ref('')

function onSubmit() {
  if (!phoneNumber.value.trim()) return
  emit('submit', {
    countryCode: countryCode.value,
    phoneNumber: phoneNumber.value,
  })
}
</script>
