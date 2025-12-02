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
