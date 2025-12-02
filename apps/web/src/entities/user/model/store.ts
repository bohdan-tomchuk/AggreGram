import { defineStore } from 'pinia';
import type { User } from '@telegram-crawler/types';

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null);
  const isAuthenticated = computed(() => !!user.value);

  const setUser = (newUser: User | null) => {
    user.value = newUser;
  };

  const clearUser = () => {
    user.value = null;
  };

  return {
    user,
    isAuthenticated,
    setUser,
    clearUser,
  };
});
