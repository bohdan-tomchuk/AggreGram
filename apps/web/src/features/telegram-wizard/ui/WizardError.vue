<template>
  <div class="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8">
    <!-- Error Icon -->
    <div class="flex justify-center mb-6">
      <div class="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
        <svg
          class="w-10 h-10 text-red-600 dark:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
    </div>

    <!-- Title -->
    <h2 class="text-2xl font-semibold text-center text-gray-900 dark:text-white mb-3">
      Connection Failed
    </h2>

    <!-- Error Message -->
    <div class="mb-8">
      <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p class="text-sm text-red-800 dark:text-red-200 text-center">
          {{ errorMessage || 'An unexpected error occurred during the Telegram connection setup.' }}
        </p>
      </div>
    </div>

    <!-- Additional Info -->
    <div v-if="telegramUserId" class="mb-6 text-center">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Telegram User ID: <span class="font-mono font-medium">{{ telegramUserId }}</span>
      </p>
    </div>

    <!-- Actions -->
    <div class="space-y-3">
      <button
        type="button"
        class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
        @click="emit('retry')"
      >
        Try Again
      </button>

      <button
        type="button"
        class="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors duration-200"
        @click="emit('start-over')"
      >
        Start Over
      </button>
    </div>

    <!-- Help Text -->
    <div class="mt-6 text-center">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        If the problem persists, try disconnecting and reconnecting your Telegram account.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  errorMessage?: string
  telegramUserId?: string
}>()

const emit = defineEmits<{
  retry: []
  'start-over': []
}>()
</script>
