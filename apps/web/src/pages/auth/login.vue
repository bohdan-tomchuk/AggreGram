<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <UCard class="w-full max-w-md">
      <template #header>
        <h2 class="text-2xl font-bold text-center">Telegram Channel Crawler</h2>
      </template>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Email</label>
          <UInput
            v-model="form.email"
            type="email"
            placeholder="your@email.com"
            required
          />
          <p v-if="errors.email" class="mt-1 text-sm text-red-500">{{ errors.email }}</p>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Password</label>
          <UInput
            v-model="form.password"
            type="password"
            placeholder="••••••••"
            required
          />
          <p v-if="errors.password" class="mt-1 text-sm text-red-500">{{ errors.password }}</p>
        </div>

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
        <UAlert color="error" variant="soft" :title="errors.general" />
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
