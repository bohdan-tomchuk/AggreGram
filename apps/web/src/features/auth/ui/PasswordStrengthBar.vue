<template>
  <div v-if="password" class="space-y-1.5">
    <div class="flex gap-1">
      <div
        v-for="i in 4"
        :key="i"
        class="h-1 flex-1 rounded-full transition-colors duration-200"
        :class="i <= strength ? barColor : 'bg-gray-200 dark:bg-gray-800'"
      />
    </div>
    <p class="text-xs" :class="color">
      {{ label }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { usePasswordStrength } from '../model/usePasswordStrength'

const props = defineProps<{
  password: string
}>()

const passwordRef = toRef(props, 'password')
const { strength, label, color, barColor } = usePasswordStrength(passwordRef)
</script>
