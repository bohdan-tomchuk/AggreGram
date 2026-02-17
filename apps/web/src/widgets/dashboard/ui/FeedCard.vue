<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
    <!-- Header: Name + Status Badge -->
    <div class="flex items-start justify-between gap-3 mb-3">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate flex-1">
        {{ feed.name }}
      </h3>
      <span :class="statusClass">{{ feed.status }}</span>
    </div>

    <!-- Description -->
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 min-h-10">
      <span v-if="feed.description">{{ feed.description }}</span>
      <span v-else class="italic">No description</span>
    </p>

    <!-- Metadata: Source Count + Channel Status -->
    <div class="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
      <div class="flex items-center gap-1.5">
        <UIcon name="i-lucide-radio-tower" class="size-3.5" />
        <span>{{ sourceCountText }}</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <UButton
        block
        size="sm"
        color="primary"
        variant="soft"
        @click="handleManage"
      >
        <UIcon name="i-lucide-settings" class="size-4 mr-1.5" />
        Manage
      </UButton>
      <UButton
        v-if="feed.channel"
        block
        size="sm"
        color="neutral"
        variant="soft"
        :to="feed.channel.inviteLink"
        target="_blank"
        external
      >
        <UIcon name="i-lucide-external-link" class="size-4 mr-1.5" />
        Open
      </UButton>
      <UButton
        v-else
        block
        size="sm"
        color="neutral"
        variant="soft"
        disabled
      >
        No Channel
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeedWithDetails, FeedStatus } from '@aggregram/types'

interface Props {
  feed: FeedWithDetails
}

const props = defineProps<Props>()

const statusClass = computed(() => {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize'
  const classes: Record<FeedStatus, string> = {
    active: `${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`,
    paused: `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`,
    draft: `${base} bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400`,
    error: `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`,
  }
  return classes[props.feed.status]
})

const sourceCountText = computed(() => {
  const count = props.feed.sourceCount
  return count === 1 ? '1 source' : `${count} sources`
})

function handleManage() {
  navigateTo(`/feeds/${props.feed.id}`)
}
</script>
