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
              <UBadge color="neutral">{{ channel.channelType }}</UBadge>
            </div>
          </div>
          <div class="flex gap-1">
            <UButton icon="i-heroicons-arrow-path" size="xs" @click="refreshChannel(channel.id)" />
            <UButton icon="i-heroicons-trash" color="error" size="xs" @click="deleteChannel(channel.id)" />
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
