<template>
  <div class="space-y-8">
    <WizardStepIndicator :current-step="0" :labels="stepLabels" />

    <div class="text-center">
      <div class="mx-auto mb-4 w-14 h-14 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
        <UIcon name="i-lucide-link" class="size-7 text-brand-500" />
      </div>
      <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white">
        Connect Your Telegram
      </h2>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
        Link your Telegram account to create personalized feeds. Your credentials stay private and encrypted.
      </p>
    </div>

    <div class="space-y-3">
      <button
        type="button"
        :class="[
          'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-colors text-left',
          selected === 'qr'
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
        ]"
        @click="selected = 'qr'"
      >
        <div
          :class="[
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            selected === 'qr'
              ? 'bg-brand-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500',
          ]"
        >
          <UIcon name="i-lucide-qr-code" class="size-5" />
        </div>
        <div class="min-w-0">
          <p class="font-medium text-gray-900 dark:text-white">
            Scan QR Code
            <span class="text-xs text-brand-500 font-normal ml-1">Recommended</span>
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Quick and secure</p>
        </div>
        <div class="ml-auto shrink-0">
          <div
            :class="[
              'w-5 h-5 rounded-full border-2 flex items-center justify-center',
              selected === 'qr'
                ? 'border-brand-500'
                : 'border-gray-300 dark:border-gray-600',
            ]"
          >
            <div v-if="selected === 'qr'" class="w-2.5 h-2.5 rounded-full bg-brand-500" />
          </div>
        </div>
      </button>

      <button
        type="button"
        :class="[
          'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-colors text-left',
          selected === 'phone'
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
        ]"
        @click="selected = 'phone'"
      >
        <div
          :class="[
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            selected === 'phone'
              ? 'bg-brand-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500',
          ]"
        >
          <UIcon name="i-lucide-smartphone" class="size-5" />
        </div>
        <div class="min-w-0">
          <p class="font-medium text-gray-900 dark:text-white">Phone Number</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Sign in with your phone number</p>
        </div>
        <div class="ml-auto shrink-0">
          <div
            :class="[
              'w-5 h-5 rounded-full border-2 flex items-center justify-center',
              selected === 'phone'
                ? 'border-brand-500'
                : 'border-gray-300 dark:border-gray-600',
            ]"
          >
            <div v-if="selected === 'phone'" class="w-2.5 h-2.5 rounded-full bg-brand-500" />
          </div>
        </div>
      </button>
    </div>

    <UButton
      block
      size="lg"
      color="primary"
      @click="emit('select-method', selected)"
    >
      Continue with {{ selected === 'qr' ? 'QR Code' : 'Phone Number' }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import WizardStepIndicator from './WizardStepIndicator.vue'
import type { AuthMethod } from '../model/types'

defineProps<{
  stepLabels: string[]
}>()

const emit = defineEmits<{
  'select-method': [method: AuthMethod]
}>()

const selected = ref<AuthMethod>('qr')
</script>
