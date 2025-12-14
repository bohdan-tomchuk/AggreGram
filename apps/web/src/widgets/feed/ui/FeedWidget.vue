<template>
  <div class="space-y-4">
    <div v-if="loading" class="space-y-4">
      <USkeleton v-for="i in 10" :key="i" class="h-32" />
    </div>

    <div v-else-if="posts.length" class="space-y-4">
      <UCard v-for="post in posts" :key="post.id">
        <div class="space-y-2">
          <div class="flex justify-between items-start">
            <div>
              <UBadge>{{ post.channel?.title }}</UBadge>
              <p class="text-sm text-gray-500 mt-1">
                {{ formatDate(post.postedAt) }}
              </p>
            </div>
          </div>

          <p class="text-base" v-html="post.highlight || post.textContent"></p>

          <div class="flex gap-4 text-sm text-gray-500">
            <span v-if="post.views">{{ post.views }} views</span>
            <span v-if="post.forwards">{{ post.forwards }} forwards</span>
          </div>
        </div>
      </UCard>
    </div>

    <UAlert v-else title="No posts found" description="Try adjusting your filters" />
  </div>
</template>

<script setup lang="ts">
import type { Post } from '@telegram-crawler/types';

interface Props {
  posts: Post[];
  loading: boolean;
}

defineProps<Props>();

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleString();
};
</script>
