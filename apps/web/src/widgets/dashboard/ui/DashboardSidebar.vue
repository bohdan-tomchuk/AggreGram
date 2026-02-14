<template>
  <div class="flex flex-col w-full pt-6 pb-4">
    <!-- Logo and branding -->
    <div class="px-4 mb-8">
      <NuxtLink to="/" class="flex items-center gap-3">
        <img
          src="@shared/assets/images/logo.webp"
          alt="AggreGram"
          class="w-8 h-8 rounded-lg"
        />
        <span class="text-lg font-display font-bold text-gray-900 dark:text-white">
          AggreGram
        </span>
      </NuxtLink>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-2 space-y-1">
      <UButton
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :icon="item.icon"
        variant="ghost"
        :color="isActive(item.path) ? 'primary' : 'neutral'"
        block
        class="justify-start"
        :class="{
          'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400': isActive(item.path),
          'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800': !isActive(item.path)
        }"
        @click="emit('navigate')"
      >
        {{ item.label }}
      </UButton>
    </nav>

    <!-- User section -->
    <div class="border-t border-gray-200 dark:border-gray-800">
      <div class="px-4 py-3 flex items-center gap-3">
        <!-- User avatar -->
        <div class="shrink-0 w-8 h-8 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center">
          <span class="text-white text-sm font-medium">
            {{ userInitial }}
          </span>
        </div>
        <!-- User email -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
            {{ authStore.user?.email }}
          </p>
        </div>
      </div>

      <!-- Logout button -->
      <div class="px-3 pb-3">
        <UButton
          icon="i-lucide-log-out"
          variant="ghost"
          color="neutral"
          block
          class="justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          @click="handleLogout"
        >
          Sign Out
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const emit = defineEmits<{
  navigate: []
}>()

const navItems = [
  {
    label: 'Dashboard',
    icon: 'i-lucide-layout-dashboard',
    path: '/',
  },
  {
    label: 'Feeds',
    icon: 'i-lucide-rss',
    path: '/feeds',
  },
  {
    label: 'Settings',
    icon: 'i-lucide-settings',
    path: '/settings',
  },
]

const userInitial = computed(() => {
  const email = authStore.user?.email || ''
  return email.charAt(0).toUpperCase()
})

const isActive = (path: string) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/auth/login')
}
</script>
