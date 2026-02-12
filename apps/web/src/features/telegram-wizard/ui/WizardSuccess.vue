<template>
  <div class="space-y-8">
    <div class="text-center">
      <div class="mx-auto mb-4 w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
        <UIcon name="i-lucide-check" class="size-8 text-green-500" />
      </div>
      <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white">
        You're All Set!
      </h2>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
        Your Telegram account is connected. Your bot
        <span class="font-medium text-gray-700 dark:text-gray-300">@{{ botUsername }}</span>
        is ready to create personalized feeds.
      </p>
    </div>

    <!-- Bot card -->
    <div class="mx-auto max-w-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
          <UIcon name="i-lucide-bot" class="size-5 text-white" />
        </div>
        <div class="min-w-0">
          <p class="font-medium text-gray-900 dark:text-white truncate">@{{ botUsername }}</p>
          <p class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Ready to create feeds
          </p>
        </div>
      </div>
    </div>

    <div class="space-y-3">
      <UButton
        block
        size="lg"
        color="primary"
        @click="emit('create-feed')"
      >
        Create Your First Feed
      </UButton>
      <UButton
        block
        size="lg"
        variant="outline"
        color="neutral"
        @click="emit('go-dashboard')"
      >
        Go to Dashboard
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  botUsername: string
}>()

const emit = defineEmits<{
  'create-feed': []
  'go-dashboard': []
}>()
</script>
