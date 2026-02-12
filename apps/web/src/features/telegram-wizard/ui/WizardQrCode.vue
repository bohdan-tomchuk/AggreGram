<template>
  <div class="space-y-8">
    <WizardStepIndicator :current-step="1" :labels="stepLabels" />

    <div class="text-center">
      <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white">
        Scan QR Code
      </h2>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
        Open Telegram on your phone, go to
        <span class="font-medium text-gray-700 dark:text-gray-300">Settings &rarr; Devices &rarr; Link Desktop Device</span>
        and scan this code.
      </p>
    </div>

    <div class="flex justify-center">
      <div class="w-56 h-56 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex items-center justify-center">
        <div v-if="loading" class="flex flex-col items-center gap-3">
          <UIcon name="i-lucide-loader-2" class="size-8 text-brand-500 animate-spin" />
          <span class="text-sm text-gray-500">Generating...</span>
        </div>
        <img
          v-else-if="qrCodeUrl"
          :src="qrCodeUrl"
          alt="Telegram QR code"
          class="w-full h-full object-contain"
        />
        <div v-else class="flex flex-col items-center gap-3">
          <UIcon name="i-lucide-qr-code" class="size-12 text-gray-300 dark:text-gray-600" />
          <span class="text-sm text-gray-400">QR code will appear here</span>
        </div>
      </div>
    </div>

    <div class="flex flex-col items-center gap-3">
      <UButton
        variant="ghost"
        color="primary"
        icon="i-lucide-refresh-cw"
        :loading="loading"
        @click="emit('refresh')"
      >
        Refresh QR Code
      </UButton>

      <button
        type="button"
        class="text-sm text-brand-500 hover:text-brand-600 font-medium"
        @click="emit('switch-to-phone')"
      >
        Use phone number instead
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import WizardStepIndicator from './WizardStepIndicator.vue'

defineProps<{
  qrCodeUrl: string
  loading: boolean
  stepLabels: string[]
}>()

const emit = defineEmits<{
  refresh: []
  'switch-to-phone': []
}>()
</script>
