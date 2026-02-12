<template>
  <div class="flex items-center justify-center gap-1">
    <template v-for="(label, i) in labels" :key="i">
      <!-- Step circle + label -->
      <div class="flex flex-col items-center">
        <div
          :class="[
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
            i < currentStep
              ? 'bg-brand-500 text-white'
              : i === currentStep
                ? 'bg-brand-500 text-white ring-4 ring-brand-500/20'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
          ]"
        >
          <UIcon v-if="i < currentStep" name="i-lucide-check" class="size-4" />
          <span v-else>{{ i + 1 }}</span>
        </div>
        <span
          :class="[
            'mt-1.5 text-xs font-medium hidden sm:block',
            i <= currentStep
              ? 'text-brand-600 dark:text-brand-400'
              : 'text-gray-400 dark:text-gray-500',
          ]"
        >
          {{ label }}
        </span>
      </div>

      <!-- Connector line -->
      <div
        v-if="i < labels.length - 1"
        :class="[
          'w-8 sm:w-12 h-0.5 mb-5 sm:mb-6 transition-colors',
          i < currentStep
            ? 'bg-brand-500'
            : 'bg-gray-200 dark:bg-gray-700',
        ]"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  currentStep: number
  labels: string[]
}>()
</script>
