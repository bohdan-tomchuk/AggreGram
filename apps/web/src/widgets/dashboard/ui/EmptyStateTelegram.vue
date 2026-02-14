<template>
  <div class="flex items-center justify-center min-h-[60vh]">
    <div class="max-w-md w-full mx-auto">
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <!-- Icon circle -->
        <div class="mx-auto mb-6 w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
          <UIcon name="i-lucide-link" class="size-8 text-primary-500" />
        </div>

        <!-- Heading -->
        <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white mb-2">
          Connect Your Telegram
        </h2>

        <!-- Description -->
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Link your Telegram account to start aggregating channels into personalized feeds.
        </p>

        <!-- CTA button -->
        <UButton
          block
          size="lg"
          color="primary"
          @click="navigateTo('/setup/telegram')"
        >
          Connect Telegram
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// No props or logic needed - pure presentation component
</script>
