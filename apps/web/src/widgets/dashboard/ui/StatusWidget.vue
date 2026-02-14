<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        System Status
      </h3>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="ghost"
        size="xs"
        :loading="loading"
        @click="refresh"
      />
    </div>

    <!-- Loading state -->
    <div v-if="loading && !sessionHealth" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader-circle" class="size-6 text-gray-400 animate-spin" />
    </div>

    <!-- Status content -->
    <div v-else class="space-y-4">
      <!-- Session Health -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            :class="[
              'size-2 rounded-full',
              sessionStatusColor === 'success' ? 'bg-green-500' :
              sessionStatusColor === 'warning' ? 'bg-yellow-500' :
              'bg-red-500'
            ]"
          />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Telegram Connection
          </span>
        </div>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          {{ sessionStatusText }}
        </span>
      </div>

      <!-- Active Feeds Count -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-rss" class="size-4 text-gray-400" />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Active Feeds
          </span>
        </div>
        <span class="text-xs font-semibold text-gray-900 dark:text-white">
          {{ feedHealth?.feeds?.active || 0 }}
        </span>
      </div>

      <!-- Messages Aggregated (last hour) -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-message-circle" class="size-4 text-gray-400" />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Messages (last hour)
          </span>
        </div>
        <span class="text-xs font-semibold text-gray-900 dark:text-white">
          {{ feedHealth?.messages?.postedLastHour || 0 }}
        </span>
      </div>

      <!-- Job Success Rate -->
      <div v-if="feedHealth?.jobs" class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-activity" class="size-4 text-gray-400" />
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Success Rate
          </span>
        </div>
        <span
          :class="[
            'text-xs font-semibold',
            feedHealth.jobs.successRate >= 90 ? 'text-green-600 dark:text-green-400' :
            feedHealth.jobs.successRate >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-red-600 dark:text-red-400'
          ]"
        >
          {{ feedHealth.jobs.successRate }}%
        </span>
      </div>

      <!-- Last Updated -->
      <div class="pt-3 border-t border-gray-200 dark:border-gray-700">
        <p class="text-xs text-gray-400 dark:text-gray-500 text-center">
          Updated {{ lastUpdatedText }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { $api } = useNuxtApp()
const authStore = useAuthStore()

const sessionHealth = ref<any>(null)
const feedHealth = ref<any>(null)
const loading = ref(true)
const lastUpdated = ref<Date>(new Date())

const sessionStatusColor = computed(() => {
  if (!sessionHealth.value) return 'error'
  if (sessionHealth.value.status === 'connected') return 'success'
  if (sessionHealth.value.status === 'disconnected') return 'warning'
  return 'error'
})

const sessionStatusText = computed(() => {
  if (!sessionHealth.value) return 'Unknown'
  if (sessionHealth.value.status === 'connected') return 'Connected'
  if (sessionHealth.value.status === 'disconnected') return 'Disconnected'
  return 'Error'
})

const lastUpdatedText = computed(() => {
  const seconds = Math.floor((Date.now() - lastUpdated.value.getTime()) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
})

async function fetchHealth() {
  try {
    const [sessionRes, feedRes] = await Promise.all([
      ($api as typeof $fetch)('/health/session', {
        headers: {
          Authorization: `Bearer ${authStore.accessToken}`,
        },
      }),
      ($api as typeof $fetch)('/health/feeds'),
    ])

    sessionHealth.value = sessionRes
    feedHealth.value = feedRes
    lastUpdated.value = new Date()
  } catch (error) {
    console.error('Failed to fetch health status:', error)
  } finally {
    loading.value = false
  }
}

async function refresh() {
  loading.value = true
  await fetchHealth()
}

// Auto-refresh every 30 seconds
let refreshInterval: NodeJS.Timeout

onMounted(() => {
  fetchHealth()
  refreshInterval = setInterval(fetchHealth, 30000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>
