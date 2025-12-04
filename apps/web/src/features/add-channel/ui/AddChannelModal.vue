<template>
  <UModal v-model:open="isOpen" title="Add Channel">
    <template #body>
      <form id="add-channel-form" @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Channel Username or Link</label>
          <UInput
            v-model="form.usernameOrLink"
            placeholder="@channel or t.me/channel"
            required
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Topic</label>
          <UInput v-model="form.topic" placeholder="Technology" required />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Type</label>
          <USelect
            v-model="form.channelType"
            :items="['news', 'personal_blog', 'official']"
            required
          />
        </div>

        <UAlert v-if="error" color="error" variant="soft" :title="error" />
      </form>
    </template>

    <template #footer>
      <div class="flex gap-2">
        <UButton type="submit" form="add-channel-form" :loading="loading">Add Channel</UButton>
        <UButton color="neutral" variant="ghost" @click="modelValue = false">Cancel</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { channelApi } from '~/entities/channel/api';

const modelValue = defineModel<boolean>({ default: false });
const emit = defineEmits(['added']);

// Sync with UModal's open prop
const isOpen = computed({
  get: () => modelValue.value,
  set: (value) => {
    modelValue.value = value;
  },
});

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
    modelValue.value = false;
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
