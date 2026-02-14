<template>
  <DashboardLayout>
    <!-- Loading state -->
    <div v-if="connectionLoading" class="flex items-center justify-center min-h-[60vh]">
      <div class="text-center space-y-4">
        <UIcon name="i-lucide-loader-circle" class="size-8 text-gray-400 animate-spin mx-auto" />
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Loading dashboard...
        </p>
      </div>
    </div>

    <!-- Empty state: No Telegram connection -->
    <EmptyStateTelegram v-else-if="!telegramStore.isConnected" />

    <!-- Empty state: Connected but no feeds -->
    <EmptyStateFeeds v-else />
  </DashboardLayout>
</template>

<script setup lang="ts">
import EmptyStateTelegram from '@widgets/dashboard/ui/EmptyStateTelegram.vue'
import EmptyStateFeeds from '@widgets/dashboard/ui/EmptyStateFeeds.vue'
import DashboardLayout from '@widgets/dashboard/ui/DashboardLayout.vue'

definePageMeta({
  middleware: 'auth',
})

const telegramStore = useTelegramStore()
const connectionLoading = ref(true)

onMounted(async () => {
  try {
    await telegramStore.fetchConnection()
  } catch (error) {
    // Default to not connected on API error
    // Store will handle the state internally
    console.error('Failed to fetch connection status:', error)
  } finally {
    connectionLoading.value = false
  }
})
</script>
