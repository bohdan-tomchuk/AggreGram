<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
    <!-- Header: Name + Status Badge -->
    <div class="flex items-start justify-between gap-3 mb-3">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate flex-1">
        {{ feed.name }}
      </h3>
      <UBadge :color="statusColor" variant="subtle" size="xs">
        {{ feed.status }}
      </UBadge>
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

const statusColor = computed(() => {
  const colors: Record<FeedStatus, string> = {
    active: 'green',
    paused: 'amber',
    draft: 'neutral',
    error: 'red',
  }
  return colors[props.feed.status]
})

const sourceCountText = computed(() => {
  const count = props.feed.sourceCount
  return count === 1 ? '1 source' : `${count} sources`
})

function handleManage() {
  navigateTo(`/feeds/${props.feed.id}`)
}
</script>
