<template>
  <div class="space-y-4">
    <!-- Header with Add button -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        Source Channels
      </h2>
      <UButton
        icon="i-lucide-plus"
        @click="showAddModal = true"
      >
        Add Source
      </UButton>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center py-8">
      <UIcon name="i-lucide-loader-circle" class="size-6 text-gray-400 animate-spin mx-auto" />
      <p class="text-xs text-gray-500 mt-2">Loading sources...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="sources.length === 0" class="text-center py-8">
      <div class="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center mb-3">
        <UIcon name="i-lucide-rss" class="size-6 text-gray-400" />
      </div>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        No source channels added yet. Add channels to start aggregating content.
      </p>
      <UButton
        icon="i-lucide-plus"
        variant="outline"
        @click="showAddModal = true"
      >
        Add Your First Source
      </UButton>
    </div>

    <!-- Sources list -->
    <div v-else class="space-y-3">
      <div
        v-for="source in sources"
        :key="source.id"
        class="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ source.channel.title }}
            </h3>
            <span v-if="source.channel.username" class="text-xs text-gray-500 dark:text-gray-400">
              @{{ source.channel.username }}
            </span>
          </div>
          <p v-if="source.channel.description" class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
            {{ source.channel.description }}
          </p>
          <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span v-if="source.channel.subscriberCount">
              <UIcon name="i-lucide-users" class="size-3 inline mr-1" />
              {{ formatNumber(source.channel.subscriberCount) }} subscribers
            </span>
            <span>
              <UIcon name="i-lucide-calendar" class="size-3 inline mr-1" />
              Added {{ formatDate(source.addedAt) }}
            </span>
          </div>
        </div>

        <UButton
          icon="i-lucide-trash-2"
          color="red"
          variant="ghost"
          size="sm"
          :loading="removingId === source.id"
          @click="handleRemove(source.id)"
        />
      </div>
    </div>

    <!-- Add Source Modal -->
    <UModal v-model="showAddModal" :ui="{ width: 'sm:max-w-md' }">
      <div class="p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Add Source Channel
        </h3>

        <!-- Search input -->
        <div class="space-y-4">
          <UInput
            v-model="searchQuery"
            placeholder="Search for Telegram channels..."
            icon="i-lucide-search"
            size="lg"
            @input="handleSearch"
          />

          <!-- Search loading -->
          <div v-if="searchLoading" class="text-center py-8">
            <UIcon name="i-lucide-loader-circle" class="size-6 text-gray-400 animate-spin mx-auto" />
            <p class="text-xs text-gray-500 mt-2">Searching...</p>
          </div>

          <!-- Search error -->
          <div v-else-if="searchError" class="text-center py-4">
            <p class="text-sm text-red-600 dark:text-red-400">{{ searchError }}</p>
          </div>

          <!-- Search results -->
          <div v-else-if="searchResults.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
            <button
              v-for="channel in searchResults"
              :key="channel.id"
              class="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left"
              :disabled="addingChannelId === channel.id"
              @click="handleAdd(channel)"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {{ channel.title }}
                  </h4>
                  <p v-if="channel.username" class="text-xs text-gray-500 dark:text-gray-400">
                    @{{ channel.username }}
                  </p>
                  <p v-if="channel.description" class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                    {{ channel.description }}
                  </p>
                  <p v-if="channel.subscriberCount" class="text-xs text-gray-500 mt-1">
                    {{ formatNumber(channel.subscriberCount) }} subscribers
                  </p>
                </div>
                <UIcon
                  v-if="addingChannelId === channel.id"
                  name="i-lucide-loader-circle"
                  class="size-4 text-gray-400 animate-spin"
                />
                <UIcon
                  v-else
                  name="i-lucide-plus-circle"
                  class="size-4 text-primary-500"
                />
              </div>
            </button>
          </div>

          <!-- Empty search -->
          <div v-else-if="searchQuery.length >= 2" class="text-center py-8">
            <UIcon name="i-lucide-search-x" class="size-8 text-gray-400 mx-auto mb-2" />
            <p class="text-sm text-gray-500 dark:text-gray-400">
              No channels found
            </p>
          </div>

          <!-- Search hint -->
          <div v-else class="text-center py-8">
            <UIcon name="i-lucide-search" class="size-8 text-gray-400 mx-auto mb-2" />
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Type at least 2 characters to search
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-3 mt-6">
          <UButton
            variant="ghost"
            @click="showAddModal = false"
          >
            Cancel
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { FeedSource, SourceChannel } from '@aggregram/types'
import { useChannelSearch } from '@shared/model/composables/useChannelSearch'

const props = defineProps<{
  feedId: string
}>()

const feedStore = useFeedStore()
const { search, results: searchResults, loading: searchLoading, error: searchError, clear: clearSearch } = useChannelSearch()

const sources = ref<FeedSource[]>([])
const loading = ref(true)
const showAddModal = ref(false)
const searchQuery = ref('')
const removingId = ref<string | null>(null)
const addingChannelId = ref<string | null>(null)

// Load sources on mount
onMounted(async () => {
  await loadSources()
})

// Watch modal close to clear search
watch(showAddModal, (isOpen) => {
  if (!isOpen) {
    searchQuery.value = ''
    clearSearch()
    addingChannelId.value = null
  }
})

async function loadSources() {
  loading.value = true
  sources.value = await feedStore.getSources(props.feedId)
  loading.value = false
}

function handleSearch(event: Event) {
  const target = event.target as HTMLInputElement
  search(target.value)
}

async function handleAdd(channel: SourceChannel) {
  if (!channel.username) {
    alert('Channel username is required')
    return
  }

  addingChannelId.value = channel.id

  const success = await feedStore.addSource(props.feedId, {
    channelUsername: channel.username,
  })

  addingChannelId.value = null

  if (success) {
    await loadSources()
    showAddModal.value = false
    searchQuery.value = ''
    clearSearch()
  }
}

async function handleRemove(sourceId: string) {
  const confirmed = confirm('Are you sure you want to remove this source channel?')
  if (!confirmed) return

  removingId.value = sourceId
  const success = await feedStore.removeSource(props.feedId, sourceId)
  removingId.value = null

  if (success) {
    await loadSources()
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`

  return date.toLocaleDateString()
}
</script>
