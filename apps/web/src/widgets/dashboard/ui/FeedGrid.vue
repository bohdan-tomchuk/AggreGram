<template>
  <div class="h-full flex flex-col">
    <!-- Header Section -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-display font-bold text-gray-900 dark:text-white">
          Your Feeds
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ feedCountText }}
        </p>
      </div>
      <UButton
        size="lg"
        color="primary"
        @click="navigateTo('/feeds/new')"
      >
        <UIcon name="i-lucide-plus" class="size-5 mr-2" />
        Create Feed
      </UButton>
    </div>

    <!-- Feed Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      <FeedCard
        v-for="feed in feedStore.feeds"
        :key="feed.id"
        :feed="feed"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import FeedCard from './FeedCard.vue'
import { useFeedStore } from '@entities/feed/model/feedStore'

const feedStore = useFeedStore()

const feedCountText = computed(() => {
  const total = feedStore.feeds.length
  const active = feedStore.activeFeeds.length

  if (total === 0) return 'No feeds yet'
  if (total === 1) return '1 feed'

  return `${total} feeds · ${active} active`
})
</script>
