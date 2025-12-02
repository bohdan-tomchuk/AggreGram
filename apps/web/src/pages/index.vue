<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <header class="bg-white dark:bg-gray-800 shadow">
      <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 class="text-2xl font-bold">Telegram Channel Crawler</h1>
        <UButton @click="handleLogout">Logout</UButton>
      </div>
    </header>

    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside class="lg:col-span-1">
          <ChannelList />
        </aside>

        <main class="lg:col-span-3">
          <div class="mb-4">
            <UInput
              v-model="searchQuery"
              placeholder="Search posts..."
              @input="debouncedSearch"
              icon="i-heroicons-magnifying-glass"
            />
          </div>

          <FeedWidget :posts="posts" :loading="feedLoading" />

          <div v-if="meta" class="mt-4 flex justify-center">
            <UPagination
              v-model="currentPage"
              :total="meta.totalPages"
              @update:model-value="loadFeed"
            />
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { postApi } from '~/entities/post/api';
import { authApi } from '~/features/auth/api';
import { useUserStore } from '~/entities/user/model/store';
import ChannelList from '~/widgets/channel-list/ui/ChannelList.vue';
import FeedWidget from '~/widgets/feed/ui/FeedWidget.vue';
import type { Post } from '@telegram-crawler/types';
import { useDebounceFn } from '@vueuse/core';

const posts = ref<Post[]>([]);
const feedLoading = ref(false);
const currentPage = ref(1);
const searchQuery = ref('');
const meta = ref<any>(null);
const userStore = useUserStore();

const loadFeed = async () => {
  feedLoading.value = true;
  try {
    if (searchQuery.value) {
      const result = await postApi.search(searchQuery.value, { page: currentPage.value });
      posts.value = result.data;
      meta.value = result.meta;
    } else {
      const result = await postApi.getFeed({ page: currentPage.value });
      posts.value = result.data;
      meta.value = result.meta;
    }
  } finally {
    feedLoading.value = false;
  }
};

const debouncedSearch = useDebounceFn(() => {
  currentPage.value = 1;
  loadFeed();
}, 500);

const handleLogout = async () => {
  await authApi.logout();
  userStore.clearUser();
  await navigateTo('/auth/login');
};

onMounted(loadFeed);
</script>
