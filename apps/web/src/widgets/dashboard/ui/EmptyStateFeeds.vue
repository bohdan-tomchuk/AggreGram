<template>
  <div class="flex items-center justify-center h-full">
    <div class="max-w-md w-full mx-auto">
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <!-- Icon circle -->
        <div class="mx-auto mb-6 w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
          <UIcon name="i-lucide-rss" class="size-8 text-primary-500" />
        </div>

        <!-- Heading -->
        <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white mb-2">
          Create Your First Feed
        </h2>

        <!-- Description -->
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Aggregate content from your favorite Telegram channels into a personalized feed channel.
        </p>

        <!-- CTA button -->
        <UButton
          block
          size="lg"
          color="primary"
          @click="navigateTo('/feeds/new')"
        >
          Create Feed
        </UButton>

        <!-- Helper text -->
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-4">
          You can add multiple source channels to each feed
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// No props or logic needed - pure presentation component
</script>
