<template>
  <DashboardLayout>
    <!-- Loading state -->
    <div v-if="connectionLoading || feedsLoading" class="flex items-center justify-center h-full">
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
    <EmptyStateFeeds v-else-if="!feedStore.hasFeeds" />

    <!-- Feed Grid: Show feeds when they exist -->
    <div v-else class="space-y-6">
      <!-- Error banner if any feed has error status -->
      <UAlert
        v-if="hasErrorFeeds"
        color="error"
        icon="i-lucide-alert-triangle"
        title="Some feeds have errors"
        description="One or more of your feeds encountered errors. Check the feed details for more information."
      />

      <!-- Status Widget -->
      <StatusWidget />

      <!-- Feed Grid -->
      <FeedGrid />
    </div>
  </DashboardLayout>
</template>

<script setup lang="ts">
import EmptyStateTelegram from '@widgets/dashboard/ui/EmptyStateTelegram.vue'
import EmptyStateFeeds from '@widgets/dashboard/ui/EmptyStateFeeds.vue'
import FeedGrid from '@widgets/dashboard/ui/FeedGrid.vue'
import DashboardLayout from '@widgets/dashboard/ui/DashboardLayout.vue'
import StatusWidget from '@widgets/dashboard/ui/StatusWidget.vue'

definePageMeta({
  middleware: 'auth',
})

const telegramStore = useTelegramStore()
const feedStore = useFeedStore()
const connectionLoading = ref(true)
const feedsLoading = ref(false)

const hasErrorFeeds = computed(() => {
  return feedStore.feeds.some(feed => feed.status === 'error')
})

onMounted(async () => {
  try {
    await telegramStore.fetchConnection()

    // Only fetch feeds if user is connected to Telegram
    if (telegramStore.isConnected) {
      feedsLoading.value = true
      try {
        await feedStore.fetchFeeds()
      } catch (error) {
        console.error('Failed to fetch feeds:', error)
      } finally {
        feedsLoading.value = false
      }
    }
  } catch (error) {
    // Default to not connected on API error
    // Store will handle the state internally
    console.error('Failed to fetch connection status:', error)
  } finally {
    connectionLoading.value = false
  }
})
</script>
