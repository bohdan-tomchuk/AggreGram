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

definePageMeta({
  layout: false,
  middleware: [],
});

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
