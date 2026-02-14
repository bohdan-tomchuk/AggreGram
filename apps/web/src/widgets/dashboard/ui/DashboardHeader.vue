<template>
  <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 md:px-6 lg:px-8 py-4">
    <div class="flex items-center justify-between">
      <!-- Left: Mobile menu + optional title slot -->
      <div class="flex items-center gap-4">
        <UButton
          icon="i-lucide-menu"
          variant="ghost"
          color="neutral"
          class="md:hidden"
          @click="emit('toggle-menu')"
        />
        <slot name="title" />
      </div>

      <!-- Right: Connection badge -->
      <div class="flex items-center gap-4">
        <!-- Connection status badge -->
        <div
          v-if="telegramStore.isConnected"
          class="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-full text-sm"
        >
          <span class="w-2 h-2 rounded-full bg-green-500" />
          <span class="text-green-700 dark:text-green-400 font-medium">
            Connected
          </span>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  'toggle-menu': []
}>()

const telegramStore = useTelegramStore()
</script>
