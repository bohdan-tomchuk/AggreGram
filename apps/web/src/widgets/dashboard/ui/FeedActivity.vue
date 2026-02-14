<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        Recent Activity
      </h3>
      <button
        v-if="isActive"
        @click="fetchJobs"
        :disabled="loading"
        class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
      >
        <UIcon
          name="i-lucide-refresh-cw"
          :class="['size-3', loading && 'animate-spin']"
        />
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading && jobs.length === 0" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader-circle" class="size-5 text-gray-400 animate-spin" />
    </div>

    <!-- Empty state -->
    <div v-else-if="jobs.length === 0" class="text-center py-8">
      <div class="mx-auto w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center mb-2">
        <UIcon name="i-lucide-activity" class="size-5 text-gray-400" />
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        No sync activity yet
      </p>
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Sync jobs will appear here once your feed becomes active
      </p>
    </div>

    <!-- Jobs timeline -->
    <div v-else class="space-y-3">
      <div
        v-for="job in jobs"
        :key="job.id"
        class="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <!-- Status icon -->
        <div class="mt-0.5">
          <div
            :class="[
              'w-8 h-8 rounded-full flex items-center justify-center',
              getJobColorClasses(job.status).bg
            ]"
          >
            <UIcon
              :name="getJobIcon(job.status)"
              :class="['size-4', getJobColorClasses(job.status).icon]"
            />
          </div>
        </div>

        <!-- Job details -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 mb-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ getJobTitle(job.status) }}
            </p>
            <time class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ formatTime(job.createdAt) }}
            </time>
          </div>

          <!-- Stats -->
          <div v-if="job.status === 'completed'" class="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-download" class="size-3" />
              {{ job.messagesFetched }} fetched
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-send" class="size-3" />
              {{ job.messagesPosted }} posted
            </span>
            <span v-if="job.completedAt" class="flex items-center gap-1">
              <UIcon name="i-lucide-clock" class="size-3" />
              {{ formatDuration(job.startedAt!, job.completedAt) }}
            </span>
          </div>

          <!-- Running state -->
          <p v-else-if="job.status === 'running'" class="text-xs text-gray-500 dark:text-gray-400">
            Sync in progress...
          </p>

          <!-- Error message -->
          <p v-else-if="job.status === 'failed' && job.errorMessage" class="text-xs text-red-600 dark:text-red-400">
            {{ job.errorMessage }}
          </p>

          <!-- Pending state -->
          <p v-else-if="job.status === 'pending'" class="text-xs text-gray-500 dark:text-gray-400">
            Waiting to start...
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AggregationJob } from '@aggregram/types'

const props = defineProps<{
  feedId: string
  isActive?: boolean
}>()

const feedStore = useFeedStore()
const jobs = ref<AggregationJob[]>([])
const loading = ref(false)
let refreshInterval: NodeJS.Timeout | null = null

onMounted(async () => {
  await fetchJobs()

  // Auto-refresh every 30s for active feeds
  if (props.isActive) {
    refreshInterval = setInterval(fetchJobs, 30000)
  }
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})

// Watch for isActive changes
watch(() => props.isActive, (active) => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }

  if (active) {
    refreshInterval = setInterval(fetchJobs, 30000)
  }
})

async function fetchJobs() {
  loading.value = true
  try {
    jobs.value = await feedStore.getJobs(props.feedId)
  } finally {
    loading.value = false
  }
}

function getJobIcon(status: string) {
  switch (status) {
    case 'completed':
      return 'i-lucide-check-circle'
    case 'running':
      return 'i-lucide-loader-circle'
    case 'failed':
      return 'i-lucide-x-circle'
    case 'pending':
      return 'i-lucide-clock'
    default:
      return 'i-lucide-circle'
  }
}

function getJobColorClasses(status: string) {
  switch (status) {
    case 'completed':
      return {
        bg: 'bg-green-50 dark:bg-green-900/30',
        icon: 'text-green-600 dark:text-green-400'
      }
    case 'running':
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/30',
        icon: 'text-blue-600 dark:text-blue-400 animate-spin'
      }
    case 'failed':
      return {
        bg: 'bg-red-50 dark:bg-red-900/30',
        icon: 'text-red-600 dark:text-red-400'
      }
    case 'pending':
      return {
        bg: 'bg-gray-50 dark:bg-gray-900',
        icon: 'text-gray-600 dark:text-gray-400'
      }
    default:
      return {
        bg: 'bg-gray-50 dark:bg-gray-900',
        icon: 'text-gray-600 dark:text-gray-400'
      }
  }
}

function getJobTitle(status: string) {
  switch (status) {
    case 'completed':
      return 'Sync completed'
    case 'running':
      return 'Syncing...'
    case 'failed':
      return 'Sync failed'
    case 'pending':
      return 'Sync pending'
    default:
      return 'Unknown status'
  }
}

function formatTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

function formatDuration(startStr: string, endStr: string) {
  const start = new Date(startStr)
  const end = new Date(endStr)
  const diffMs = end.getTime() - start.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return `${diffSec}s`

  const diffMin = Math.floor(diffSec / 60)
  const remainingSec = diffSec % 60
  return `${diffMin}m ${remainingSec}s`
}
</script>
