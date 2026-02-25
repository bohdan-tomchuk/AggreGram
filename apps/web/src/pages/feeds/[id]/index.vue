<template>
  <DashboardLayout>
    <div class="max-w-7xl mx-auto py-8">
      <!-- Back button -->
      <UButton
        variant="ghost"
        color="neutral"
        size="sm"
        class="mb-6"
        @click="navigateTo('/')"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4 mr-1.5" />
        Back to Dashboard
      </UButton>

      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center h-64">
        <div class="text-center space-y-4">
          <UIcon name="i-lucide-loader-circle" class="size-8 text-gray-400 animate-spin mx-auto" />
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Loading feed...
          </p>
        </div>
      </div>

      <!-- Feed content -->
      <div v-else-if="feed" class="space-y-6">
        <!-- Header with status -->
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-3xl font-display font-bold text-gray-900 dark:text-white mb-2">
              {{ feed.name }}
            </h1>
            <p v-if="feed.description" class="text-sm text-gray-500 dark:text-gray-400">
              {{ feed.description }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <UBadge
              :color="statusColor"
              variant="subtle"
              size="lg"
              class="capitalize"
            >
              {{ feed.status }}
            </UBadge>
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="outline"
              size="sm"
              :loading="deleteLoading"
              @click="handleDeleteFeed"
            >
              Delete
            </UButton>
          </div>
        </div>

        <!-- Error banner for error status feeds -->
        <UAlert
          v-if="feed.status === 'error'"
          color="error"
          icon="i-lucide-alert-triangle"
          title="Feed Error"
          description="This feed encountered an error. Please check your Telegram connection or try recreating the channel."
          :actions="[
            { 
                label: 'Check Connection', 
                variant: 'solid', 
                color: 'error', 
                onClick: () => {
                    navigateTo('/')
                }
            },
          ]"
        />

        <!-- Feed Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-rss" class="size-5 text-gray-400" />
              <div>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ feed.sourceCount || 0 }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">Source Channels</p>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-clock" class="size-5 text-gray-400" />
              <div>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ pollingIntervalLabel }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">Polling Interval</p>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-message-circle" class="size-5 text-gray-400" />
              <div>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ feed.feedChannel ? 'Created' : 'Not Created' }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">Channel Status</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state: No sources added yet -->
        <UAlert
          v-if="!feed.sourceCount || feed.sourceCount === 0"
          color="primary"
          icon="i-lucide-info"
          title="Add Source Channels"
          description="Add Telegram channels to aggregate content from. You need at least one source to create a feed channel."
          :actions="[
            { label: 'Manage Sources', variant: 'solid', click: () => manageSources() },
          ]"
        />

        <!-- Empty state: No channel created yet (draft status) -->
        <UAlert
          v-else-if="feed.status === 'draft' && !feed.feedChannel"
          color="primary"
          icon="i-lucide-rocket"
          title="Create Telegram Channel"
          description="Ready to start aggregating! Create a Telegram channel where messages will be forwarded."
          :actions="[
            {
              label: 'Create Channel',
              variant: 'solid',
              loading: channelCreationLoading,
              onClick: handleCreateChannel
            },
          ]"
        />

        <!-- Channel Info (if created) -->
        <div v-if="feed.feedChannel" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Telegram Channel
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ feed.feedChannel.title }}
              </p>
            </div>
            <UButton
              v-if="feed.feedChannel.inviteLink"
              :to="feed.feedChannel.inviteLink"
              target="_blank"
              external
              icon="i-lucide-external-link"
              size="sm"
            >
              Open in Telegram
            </UButton>
          </div>

          <!-- Active feed controls -->
          <div v-if="feed.status === 'active' || feed.status === 'paused'" class="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <UButton
              v-if="feed.status === 'active'"
              icon="i-lucide-refresh-cw"
              variant="outline"
              size="sm"
              :loading="syncLoading"
              @click="handleSyncNow"
            >
              Sync Now
            </UButton>

            <UButton
              v-if="feed.status === 'active'"
              icon="i-lucide-pause"
              variant="outline"
              size="sm"
              color="neutral"
              @click="handlePause"
            >
              Pause
            </UButton>

            <UButton
              v-if="feed.status === 'paused'"
              icon="i-lucide-play"
              variant="solid"
              size="sm"
              color="primary"
              @click="handleResume"
            >
              Resume
            </UButton>
          </div>
        </div>

        <!-- Source Management -->
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Source Channels
            </h3>
            <UButton
              icon="i-lucide-plus"
              size="sm"
              @click="manageSources"
            >
              Manage Sources
            </UButton>
          </div>

          <!-- Sources list -->
          <div v-if="sources.length > 0" class="space-y-2">
            <div
              v-for="source in sources"
              :key="source.id"
              class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
            >
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-hash" class="size-4 text-gray-400" />
                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ source.channel.title }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    @{{ source.channel.username }}
                  </p>
                </div>
              </div>
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                size="xs"
                @click="handleRemoveSource(source.id)"
              />
            </div>
          </div>

          <!-- Empty sources -->
          <div v-else class="text-center py-8">
            <UIcon name="i-lucide-inbox" class="size-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p class="text-sm text-gray-500 dark:text-gray-400">
              No source channels added yet
            </p>
          </div>
        </div>

        <!-- Add Source Modal -->
        <AddSourceModal
          v-if="feed"
          v-model="showAddSourceModal"
          :feed-id="feed.id"
          :existing-source-ids="sources.map((s: FeedSource) => s.channel.id)"
          @source-added="handleSourceAdded"
        />
      </div>

      <!-- Error state -->
      <div v-else class="flex flex-col items-center justify-center h-64">
        <UIcon name="i-lucide-alert-circle" class="size-12 text-red-500 mb-4" />
        <p class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Failed to load feed
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {{ feedStore.error || 'An unexpected error occurred' }}
        </p>
        <UButton @click="loadFeed">
          Try Again
        </UButton>
      </div>
    </div>
  </DashboardLayout>
</template>

<script setup lang="ts">
import DashboardLayout from '@widgets/dashboard/ui/DashboardLayout.vue'
import AddSourceModal from '@widgets/dashboard/ui/AddSourceModal.vue'
import type { FeedWithDetails, FeedSource } from '@aggregram/types'
import { useFeedStore } from '@entities/feed/model/feedStore'

definePageMeta({
  middleware: ['auth', 'telegram-connected'],
})

const route = useRoute()
const feedStore = useFeedStore()
const toast = useToast()

const feedId = computed(() => route.params.id as string)
const feed = ref<FeedWithDetails | null>(null)
const sources = ref<FeedSource[]>([])
const loading = ref(true)
const channelCreationLoading = ref(false)
const syncLoading = ref(false)
const deleteLoading = ref(false)
const showAddSourceModal = ref(false)

const statusColor = computed(() => {
  switch (feed.value?.status) {
    case 'active':
      return 'success'
    case 'paused':
      return 'warning'
    case 'error':
      return 'error'
    default:
      return 'neutral'
  }
})

const pollingIntervalLabel = computed(() => {
  if (!feed.value) return '-'
  const sec = feed.value.pollingIntervalSec
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)}min`
  return `${Math.round(sec / 3600)}hr`
})

async function loadFeed() {
  loading.value = true
  feed.value = await feedStore.getFeed(feedId.value)

  if (feed.value) {
    // Load sources
    sources.value = await feedStore.getSources(feedId.value)
  }

  loading.value = false
}

async function handleCreateChannel() {
  channelCreationLoading.value = true
  const success = await feedStore.createChannel(feedId.value)

  if (success && import.meta.client) {
    // Poll feed status every 2s to check if channel was created
    const pollInterval = setInterval(async () => {
      await loadFeed()
      if (feed.value?.feedChannel || feed.value?.status === 'active') {
        clearInterval(pollInterval)
        toast.add({
          title: 'Channel created!',
          description: 'Your feed channel is ready. You can now open it in Telegram.',
          color: 'success',
        })
      }
    }, 2000)

    // Stop polling after 60 seconds
    setTimeout(() => clearInterval(pollInterval), 60000)
  }

  channelCreationLoading.value = false
}

async function handleSyncNow() {
  syncLoading.value = true
  await feedStore.syncFeed(feedId.value)
  syncLoading.value = false
}

async function handlePause() {
  const success = await feedStore.pauseFeed(feedId.value)
  if (success) {
    await loadFeed()
  }
}

async function handleResume() {
  const success = await feedStore.resumeFeed(feedId.value)
  if (success) {
    await loadFeed()
  }
}

async function handleRemoveSource(sourceId: string) {
  const success = await feedStore.removeSource(feedId.value, sourceId)
  if (success) {
    sources.value = sources.value.filter((s: FeedSource) => s.id !== sourceId)
    await loadFeed()
  }
}

function manageSources() {
  showAddSourceModal.value = true
}

async function handleDeleteFeed() {
  if (!confirm('Are you sure you want to delete this feed? This will also delete the Telegram channel.')) {
    return
  }
  deleteLoading.value = true
  const success = await feedStore.deleteFeed(feedId.value)
  deleteLoading.value = false
  if (success) {
    await navigateTo('/')
  }
}

async function handleSourceAdded() {
  // Reload feed to update sourceCount and sources list
  await loadFeed()
  toast.add({
    title: 'Source added',
    description: 'Channel added to your feed successfully.',
    color: 'success',
  })
}

onMounted(() => {
  loadFeed()
})
</script>
