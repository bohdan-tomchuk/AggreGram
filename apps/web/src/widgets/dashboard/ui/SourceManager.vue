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
    <UModal v-model:open="showAddModal" title="Add Source Channel" :ui="{ width: 'sm:max-w-md' }">
      <template #body>
        <div class="space-y-4">
          <!-- Username input + lookup button -->
          <div class="flex gap-2">
            <UInput
              v-model="searchQuery"
              placeholder="Enter channel username (e.g. @durov)"
              icon="i-lucide-at-sign"
              size="lg"
              class="flex-1"
              :disabled="lookupLoading"
              @keydown.enter="handleLookup"
            />
            <UButton
              icon="i-lucide-search"
              size="lg"
              :loading="lookupLoading"
              :disabled="!searchQuery.trim()"
              @click="handleLookup"
            >
              Find
            </UButton>
          </div>

          <!-- Lookup loading -->
          <div v-if="lookupLoading" class="text-center py-8">
            <UIcon name="i-lucide-loader-circle" class="size-6 text-gray-400 animate-spin mx-auto" />
            <p class="text-xs text-gray-500 mt-2">Looking up channel...</p>
          </div>

          <!-- Lookup error -->
          <div v-else-if="lookupError" class="text-center py-4">
            <UIcon name="i-lucide-search-x" class="size-8 text-gray-400 mx-auto mb-2" />
            <p class="text-sm text-red-600 dark:text-red-400">{{ lookupError }}</p>
          </div>

          <!-- Result channel card -->
          <div v-else-if="lookupResult" class="space-y-2">
            <button
              class="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left"
              :disabled="addingChannelId === lookupResult.id"
              @click="handleAdd(lookupResult)"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {{ lookupResult.title }}
                  </h4>
                  <p v-if="lookupResult.username" class="text-xs text-gray-500 dark:text-gray-400">
                    @{{ lookupResult.username }}
                  </p>
                  <p v-if="lookupResult.description" class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                    {{ lookupResult.description }}
                  </p>
                  <p v-if="lookupResult.subscriberCount" class="text-xs text-gray-500 mt-1">
                    {{ formatNumber(lookupResult.subscriberCount) }} subscribers
                  </p>
                </div>
                <UIcon
                  v-if="addingChannelId === lookupResult.id"
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

          <!-- Initial hint -->
          <div v-else class="text-center py-8">
            <UIcon name="i-lucide-at-sign" class="size-8 text-gray-400 mx-auto mb-2" />
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Enter a channel username and press Enter or click Find
            </p>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton
            variant="ghost"
            @click="showAddModal = false"
          >
            Cancel
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { FeedSource, SourceChannel } from '@aggregram/types'
import { useChannelSearch } from '@shared/model/composables/useChannelSearch'
import { useFeedStore } from '@entities/feed/model/feedStore'

const props = defineProps<{
  feedId: string
}>()

const feedStore = useFeedStore()
const { lookup, result: lookupResult, loading: lookupLoading, error: lookupError, clear: clearLookup } = useChannelSearch()

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

// Watch modal close to clear lookup
watch(showAddModal, (isOpen) => {
  if (!isOpen) {
    searchQuery.value = ''
    clearLookup()
    addingChannelId.value = null
  }
})

async function loadSources() {
  loading.value = true
  sources.value = await feedStore.getSources(props.feedId)
  loading.value = false
}

function handleLookup() {
  if (searchQuery.value.trim()) {
    lookup(searchQuery.value.trim())
  }
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
    clearLookup()
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
