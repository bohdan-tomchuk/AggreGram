<template>
  <div class="flex flex-col w-full py-6">
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

    <!-- Footer info -->
    <div class="px-4 pt-4 border-t border-gray-200 dark:border-gray-800">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        v{{ version }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
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

const version = '0.1.0'

const isActive = (path: string) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>
