<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div class="text-center">
      <img src="@shared/assets/images/logo.webp" alt="AggreGram" class="w-16 h-16 rounded-xl mx-auto mb-4" />
      <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        AggreGram
      </h1>
      <p class="text-lg text-gray-600 dark:text-gray-400 mb-8">
        Telegram Feed Aggregation Service
      </p>
      <UButton size="lg" color="secondary" @click="checkApi">
        Check API Connection
      </UButton>
      <div v-if="apiStatus" class="mt-4">
        <p :class="apiStatus.ok ? 'text-green-600' : 'text-red-600'">
          {{ apiStatus.message }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const apiStatus = ref<{ ok: boolean; message: string } | null>(null)

const { $api } = useNuxtApp()

const checkApi = async () => {
  try {
    await $api('/')
    apiStatus.value = { ok: true, message: 'API is connected!' }
  } catch {
    apiStatus.value = {
      ok: false,
      message: 'API connection failed (expected until backend is running)',
    }
  }
}
</script>
