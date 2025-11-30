# Task ID: 9

**Title:** Build Authentication UI and Channel Management Pages

**Status:** pending

**Dependencies:** 8

**Priority:** high

**Description:** Create login page with form validation, implement channel list widget with add/edit/delete functionality, and build unified feed widget with post cards and filters.

**Details:**

1. Create apps/web/src/pages/auth/login.vue:
```vue
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <UCard class="w-full max-w-md">
      <template #header>
        <h2 class="text-2xl font-bold text-center">Telegram Channel Crawler</h2>
      </template>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <UFormGroup label="Email" name="email" :error="errors.email">
          <UInput
            v-model="form.email"
            type="email"
            placeholder="your@email.com"
            required
          />
        </UFormGroup>

        <UFormGroup label="Password" name="password" :error="errors.password">
          <UInput
            v-model="form.password"
            type="password"
            placeholder="••••••••"
            required
          />
        </UFormGroup>

        <UButton
          type="submit"
          block
          :loading="loading"
          :disabled="loading"
        >
          Log In
        </UButton>
      </form>

      <div v-if="errors.general" class="mt-4">
        <UAlert color="red" variant="soft" :title="errors.general" />
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { authApi } from '~/features/auth/api';
import { useUserStore } from '~/entities/user/model/store';

const form = reactive({
  email: '',
  password: '',
});

const errors = reactive({
  email: '',
  password: '',
  general: '',
});

const loading = ref(false);
const userStore = useUserStore();

const handleLogin = async () => {
  loading.value = true;
  errors.email = '';
  errors.password = '';
  errors.general = '';

  try {
    await authApi.login(form.email, form.password);
    const user = await authApi.getCurrentUser();
    userStore.setUser(user);
    await navigateTo('/');
  } catch (error: any) {
    errors.general = error.message || 'Login failed';
  } finally {
    loading.value = false;
  }
};
</script>
```

2. Create apps/web/src/entities/channel/api/index.ts:
```typescript
import type { Channel } from '@telegram-crawler/types';

export const channelApi = {
  async getAll(filters?: { topic?: string; channelType?: string; isActive?: boolean }) {
    const api = useApi();
    const params = new URLSearchParams();
    if (filters?.topic) params.append('topic', filters.topic);
    if (filters?.channelType) params.append('channelType', filters.channelType);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
    
    return api.request<Channel[]>(`/channels?${params.toString()}`);
  },

  async create(data: { usernameOrLink: string; topic: string; channelType: string }) {
    const api = useApi();
    return api.request<Channel>('/channels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<Channel>) {
    const api = useApi();
    return api.request<Channel>(`/channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    const api = useApi();
    return api.request(`/channels/${id}`, { method: 'DELETE' });
  },

  async refresh(id: string) {
    const api = useApi();
    return api.request<Channel>(`/channels/${id}/refresh`, { method: 'POST' });
  },
};
```

3. Create apps/web/src/features/add-channel/ui/AddChannelModal.vue:
```vue
<template>
  <UModal v-model="isOpen">
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">Add Channel</h3>
      </template>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <UFormGroup label="Channel Username or Link" name="usernameOrLink">
          <UInput
            v-model="form.usernameOrLink"
            placeholder="@channel or t.me/channel"
            required
          />
        </UFormGroup>

        <UFormGroup label="Topic" name="topic">
          <UInput v-model="form.topic" placeholder="Technology" required />
        </UFormGroup>

        <UFormGroup label="Type" name="channelType">
          <USelect
            v-model="form.channelType"
            :options="['news', 'personal_blog', 'official']"
            required
          />
        </UFormGroup>

        <div class="flex gap-2">
          <UButton type="submit" :loading="loading">Add Channel</UButton>
          <UButton color="gray" variant="ghost" @click="isOpen = false">Cancel</UButton>
        </div>
      </form>

      <UAlert v-if="error" color="red" variant="soft" :title="error" class="mt-4" />
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import { channelApi } from '~/entities/channel/api';

const isOpen = defineModel<boolean>();
const emit = defineEmits(['added']);

const form = reactive({
  usernameOrLink: '',
  topic: '',
  channelType: 'news',
});

const loading = ref(false);
const error = ref('');

const handleSubmit = async () => {
  loading.value = true;
  error.value = '';

  try {
    const channel = await channelApi.create(form);
    emit('added', channel);
    isOpen.value = false;
    form.usernameOrLink = '';
    form.topic = '';
    form.channelType = 'news';
  } catch (err: any) {
    error.value = err.message || 'Failed to add channel';
  } finally {
    loading.value = false;
  }
};
</script>
```

4. Create apps/web/src/widgets/channel-list/ui/ChannelList.vue:
```vue
<template>
  <div class="space-y-4">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-bold">Channels</h2>
      <UButton @click="showAddModal = true">Add Channel</UButton>
    </div>

    <div v-if="loading" class="space-y-2">
      <USkeleton v-for="i in 5" :key="i" class="h-16" />
    </div>

    <div v-else-if="channels.length" class="space-y-2">
      <UCard v-for="channel in channels" :key="channel.id" class="hover:shadow-md transition">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-semibold">{{ channel.title }}</h3>
            <p class="text-sm text-gray-500">@{{ channel.username }}</p>
            <div class="flex gap-2 mt-2">
              <UBadge>{{ channel.topic }}</UBadge>
              <UBadge color="gray">{{ channel.channelType }}</UBadge>
            </div>
          </div>
          <div class="flex gap-1">
            <UButton icon="i-heroicons-arrow-path" size="xs" @click="refreshChannel(channel.id)" />
            <UButton icon="i-heroicons-trash" color="red" size="xs" @click="deleteChannel(channel.id)" />
          </div>
        </div>
      </UCard>
    </div>

    <UAlert v-else title="No channels yet" description="Add your first channel to get started" />

    <AddChannelModal v-model="showAddModal" @added="loadChannels" />
  </div>
</template>

<script setup lang="ts">
import { channelApi } from '~/entities/channel/api';
import AddChannelModal from '~/features/add-channel/ui/AddChannelModal.vue';
import type { Channel } from '@telegram-crawler/types';

const channels = ref<Channel[]>([]);
const loading = ref(false);
const showAddModal = ref(false);

const loadChannels = async () => {
  loading.value = true;
  try {
    channels.value = await channelApi.getAll();
  } finally {
    loading.value = false;
  }
};

const deleteChannel = async (id: string) => {
  if (confirm('Remove this channel?')) {
    await channelApi.delete(id);
    await loadChannels();
  }
};

const refreshChannel = async (id: string) => {
  await channelApi.refresh(id);
  await loadChannels();
};

onMounted(loadChannels);
</script>
```

5. Create apps/web/src/entities/post/api/index.ts:
```typescript
import type { Post } from '@telegram-crawler/types';

interface FeedResponse {
  data: Post[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const postApi = {
  async getFeed(params?: {
    channelId?: string;
    topic?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const api = useApi();
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value) query.append(key, String(value));
    });
    return api.request<FeedResponse>(`/posts?${query.toString()}`);
  },

  async search(q: string, params?: { topic?: string; dateFrom?: string; dateTo?: string; page?: number }) {
    const api = useApi();
    const query = new URLSearchParams({ q });
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value) query.append(key, String(value));
    });
    return api.request<FeedResponse>(`/posts/search?${query.toString()}`);
  },
};
```

6. Create apps/web/src/widgets/feed/ui/FeedWidget.vue:
```vue
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

          <div v-if="post.hasMedia && post.mediaThumbnail" class="mt-2">
            <img :src="post.mediaThumbnail" alt="Post media" class="rounded max-h-64 object-cover" />
          </div>

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
```

7. Create apps/web/src/pages/index.vue:
```vue
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
```

**Test Strategy:**

1. Component tests for login page:
   - Form validation works
   - Login button shows loading state
   - Error messages display correctly
   - Successful login navigates to /
2. Component tests for AddChannelModal:
   - Form fields validate correctly
   - Submit creates channel via API
   - Error handling displays errors
3. Component tests for ChannelList:
   - Channels load and display
   - Add button opens modal
   - Delete confirms and removes channel
   - Refresh updates channel metadata
4. Component tests for FeedWidget:
   - Posts render correctly
   - Media thumbnails display
   - Date formatting works
   - Search highlights render HTML correctly
5. Integration test for index page:
   - Feed loads on mount
   - Search debounces and updates feed
   - Pagination works
   - Logout clears state and redirects
6. E2E test:
   - Login -> view feed -> add channel -> search posts -> logout

## Subtasks

### 9.1. Create login page with form validation and error handling

**Status:** pending  
**Dependencies:** None  

Build the authentication login page with email/password form, client-side validation, loading states, and error message display using Nuxt UI components.

**Details:**

Create apps/web/src/pages/auth/login.vue with UCard, UFormGroup, UInput, UButton, and UAlert components. Implement reactive form state with email and password fields. Add error state management for field-level and general errors. Include form submit handler with loading state that calls authApi.login(), handles success navigation to '/', and displays error messages on failure. Apply Tailwind classes for centered layout with dark mode support.

### 9.2. Build API integration layer for channels

**Status:** pending  
**Dependencies:** None  

Implement the channel API client with methods for CRUD operations including getAll with filters, create, update, delete, and refresh functionality.

**Details:**

Create apps/web/src/entities/channel/api/index.ts exporting channelApi object. Implement getAll() method with optional filters (topic, channelType, isActive) using URLSearchParams for query building. Add create() method accepting usernameOrLink, topic, and channelType. Implement update() for partial channel updates and delete() for removal. Add refresh() method to trigger channel data refresh. All methods use useApi() composable and return typed Promise<Channel> or Promise<Channel[]> responses.

### 9.3. Build API integration layer for posts and feed

**Status:** pending  
**Dependencies:** None  

Create the post API client with feed retrieval, search functionality, and pagination support using typed response interfaces.

**Details:**

Create apps/web/src/entities/post/api/index.ts with FeedResponse interface containing data array and meta object (total, page, limit, totalPages). Implement postApi.getFeed() accepting optional params for channelId, topic, dateFrom, dateTo, page, and limit. Add postApi.search() method with query string 'q' and optional filtering params. Both methods build URLSearchParams from provided options and return typed FeedResponse promises using useApi() composable.

### 9.4. Create AddChannelModal with form validation

**Status:** pending  
**Dependencies:** 9.2  

Build reusable modal component for adding new channels with form fields for username/link, topic, and type selection including validation and error handling.

**Details:**

Create apps/web/src/features/add-channel/ui/AddChannelModal.vue using UModal and UCard components. Implement v-model binding for modal open state. Add form with UFormGroup/UInput for usernameOrLink (accepts @channel or t.me/channel format), topic input, and USelect for channelType with options ['news', 'personal_blog', 'official']. Include reactive form state, loading state, and error message display. Implement handleSubmit that calls channelApi.create(), emits 'added' event with created channel, resets form, and closes modal on success. Show error in UAlert on failure.

### 9.5. Build ChannelList widget with CRUD operations

**Status:** pending  
**Dependencies:** 9.2, 9.4  

Create the channel list sidebar widget displaying all channels with add/refresh/delete actions, loading states, and empty state handling.

**Details:**

Create apps/web/src/widgets/channel-list/ui/ChannelList.vue with channels array ref and loading state. Implement loadChannels() async function calling channelApi.getAll(). Display loading skeleton (USkeleton) when fetching, empty state (UAlert) when no channels exist, or grid of UCard components for each channel showing title, username, topic/type badges. Add header with 'Add Channel' button triggering AddChannelModal. Include action buttons for refresh (calls channelApi.refresh) and delete (shows confirmation, calls channelApi.delete). Call loadChannels() on mount and after add/delete operations.

### 9.6. Implement FeedWidget with post cards and media display

**Status:** pending  
**Dependencies:** 9.3  

Build the feed widget component that displays post cards with content, media thumbnails, metadata, and proper HTML highlight rendering.

**Details:**

Create apps/web/src/widgets/feed/ui/FeedWidget.vue accepting posts array and loading boolean as props. Display loading skeletons (USkeleton) when loading is true. Render UCard for each post showing channel badge, formatted date (using formatDate helper), text content with v-html for highlight support (ensure proper sanitization), optional media thumbnail image with max-height constraint, and engagement metrics (views, forwards). Show empty state UAlert when no posts exist. Include formatDate utility function converting Date/string to localized string format.

### 9.7. Create search input with debouncing

**Status:** pending  
**Dependencies:** 9.3  

Implement debounced search input component that triggers feed updates after user stops typing, preventing excessive API calls.

**Details:**

In apps/web/src/pages/index.vue, add UInput component with v-model bound to searchQuery ref, placeholder 'Search posts...', and magnifying glass icon. Import useDebounceFn from @vueuse/core. Create debouncedSearch function wrapping loadFeed() call with 500ms delay using useDebounceFn. Bind @input event to debouncedSearch. Ensure search resets currentPage to 1 before triggering loadFeed. Modify loadFeed() to check searchQuery value and call either postApi.search() or postApi.getFeed() accordingly, passing current page parameter.

### 9.8. Build pagination component integration

**Status:** pending  
**Dependencies:** 9.3, 9.6  

Add pagination controls to the feed using UPagination component with page state management and feed reload on page change.

**Details:**

In apps/web/src/pages/index.vue, add currentPage ref initialized to 1 and meta ref for pagination metadata. Display UPagination component below FeedWidget bound to currentPage with v-model, :total set to meta.totalPages. Add @update:model-value listener calling loadFeed(). Update loadFeed() to pass currentPage in params to both postApi.search() and postApi.getFeed(). Store returned meta object containing total, page, limit, and totalPages in meta ref. Only render pagination when meta exists and has multiple pages.

### 9.9. Implement main index page layout with authentication

**Status:** pending  
**Dependencies:** 9.5, 9.6, 9.7, 9.8  

Build the main application page combining header, channel list sidebar, feed widget, and search/pagination into responsive grid layout with logout functionality.

**Details:**

Create apps/web/src/pages/index.vue with full layout: header bar containing app title and logout button, responsive grid with lg:grid-cols-4 (1 column for ChannelList sidebar, 3 for main feed area). Import and render ChannelList in aside, FeedWidget in main section with posts and feedLoading props. Add search input above feed and UPagination below. Initialize posts array, feedLoading, currentPage, searchQuery, and meta refs. Implement loadFeed() combining search/feed logic. Add handleLogout() calling authApi.logout(), clearing userStore, and navigating to /auth/login. Call loadFeed() on mount. Apply Tailwind classes for spacing, backgrounds, and dark mode support.
