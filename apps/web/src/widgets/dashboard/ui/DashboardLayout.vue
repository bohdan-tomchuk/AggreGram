<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex w-full">
    <!-- Mobile sidebar overlay -->
    <Transition
      enter-active-class="transition-opacity duration-300"
      leave-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMobileMenuOpen"
        class="fixed inset-0 z-40 bg-gray-900/50 md:hidden"
        @click="isMobileMenuOpen = false"
      />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-300"
      leave-active-class="transition-transform duration-300"
      enter-from-class="-translate-x-full"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="isMobileMenuOpen"
        class="fixed top-0 left-0 bottom-0 z-50 w-60 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 md:hidden"
      >
        <DashboardSidebar @navigate="isMobileMenuOpen = false" />
      </aside>
    </Transition>

    <div class="flex w-full">
      <!-- Desktop sidebar -->
      <aside class="hidden md:flex w-60 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <DashboardSidebar />
      </aside>

      <!-- Main content area -->
      <div class="flex-1 flex flex-col min-w-0">
        <DashboardHeader @toggle-menu="isMobileMenuOpen = true" />

        <main class="flex-1 p-4 md:p-6 lg:p-8">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import DashboardSidebar from './DashboardSidebar.vue'
import DashboardHeader from './DashboardHeader.vue'

const isMobileMenuOpen = ref(false)
</script>
