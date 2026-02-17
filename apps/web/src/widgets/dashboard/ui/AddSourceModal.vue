<template>
  <UModal v-model:open="isOpen" title="Add Source Channel" :dismissible="!isAdding" :ui="{ width: 'sm:max-w-md' }">
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
            :class="{ 'opacity-50': isAlreadyAdded(lookupResult.id) }"
            :disabled="addingChannelId === lookupResult.id || isAlreadyAdded(lookupResult.id)"
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
                v-if="isAlreadyAdded(lookupResult.id)"
                name="i-lucide-check-circle"
                class="size-4 text-green-500"
              />
              <UIcon
                v-else-if="addingChannelId === lookupResult.id"
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
          :disabled="isAdding"
          @click="close"
        >
          Cancel
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { SourceChannel } from '@aggregram/types'
import { useChannelSearch } from '@shared/model/composables/useChannelSearch'
import { useFeedStore } from '@entities/feed/model/feedStore'

const props = defineProps<{
  modelValue: boolean
  feedId: string
  existingSourceIds?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'source-added': []
}>()

const feedStore = useFeedStore()
const toast = useToast()
const { lookup, result: lookupResult, loading: lookupLoading, error: lookupError, clear: clearLookup } = useChannelSearch()

const searchQuery = ref('')
const addingChannelId = ref<string | null>(null)

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const isAdding = computed(() => addingChannelId.value !== null)

watch(isOpen, (open) => {
  if (!open) {
    searchQuery.value = ''
    clearLookup()
    addingChannelId.value = null
  }
})

function handleLookup() {
  if (searchQuery.value.trim()) {
    lookup(searchQuery.value.trim())
  }
}

function isAlreadyAdded(channelId: string): boolean {
  return props.existingSourceIds?.includes(channelId) ?? false
}

async function handleAdd(channel: SourceChannel) {
  if (!channel.username) {
    toast.add({
      title: 'Error',
      description: 'Channel username is required',
    })
    return
  }

  addingChannelId.value = channel.id

  const success = await feedStore.addSource(props.feedId, {
    channelUsername: channel.username,
  })

  addingChannelId.value = null

  if (success) {
    emit('source-added')
    isOpen.value = false
    searchQuery.value = ''
    clearLookup()
  }
}

function close() {
  isOpen.value = false
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
</script>
