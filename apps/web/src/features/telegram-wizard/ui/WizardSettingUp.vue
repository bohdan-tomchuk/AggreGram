<template>
  <div class="space-y-8">
    <div class="text-center">
      <div class="mx-auto mb-4 w-14 h-14 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
        <UIcon name="i-lucide-loader-2" class="size-7 text-brand-500 animate-spin" />
      </div>
      <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white">
        Setting Up Your Account
      </h2>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Please wait while we configure your bot.
      </p>
    </div>

    <div class="space-y-4 max-w-sm mx-auto">
      <div
        v-for="stage in stages"
        :key="stage.id"
        class="flex items-center gap-3"
      >
        <!-- Status icon -->
        <div class="shrink-0">
          <UIcon
            v-if="stage.status === 'completed'"
            name="i-lucide-check-circle-2"
            class="size-6 text-green-500"
          />
          <UIcon
            v-else-if="stage.status === 'in_progress'"
            name="i-lucide-loader-2"
            class="size-6 text-brand-500 animate-spin"
          />
          <UIcon
            v-else-if="stage.status === 'error'"
            name="i-lucide-x-circle"
            class="size-6 text-red-500"
          />
          <div
            v-else
            class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center"
          >
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ stages.indexOf(stage) + 1 }}
            </span>
          </div>
        </div>

        <!-- Label -->
        <div class="min-w-0">
          <p
            :class="[
              'text-sm font-medium',
              stage.status === 'completed' ? 'text-green-700 dark:text-green-400' :
              stage.status === 'in_progress' ? 'text-gray-900 dark:text-white' :
              stage.status === 'error' ? 'text-red-700 dark:text-red-400' :
              'text-gray-400 dark:text-gray-500',
            ]"
          >
            {{ stage.label }}
          </p>
          <p v-if="stage.error" class="text-xs text-red-600 dark:text-red-400 mt-0.5">
            {{ stage.error }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SetupStage } from '../model/types'

defineProps<{
  stages: SetupStage[]
}>()
</script>
