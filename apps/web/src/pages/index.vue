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

      <!-- Telegram connection CTA -->
      <div v-if="telegramLoaded && !telegramStore.isConnected" class="mb-8">
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mx-auto">
          <div class="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <UIcon name="i-lucide-link" class="w-6 h-6 text-primary-500" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Connect Telegram
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Link your Telegram account to start creating personalized feeds.
          </p>
          <UButton block color="primary" size="lg" @click="navigateTo('/setup/telegram')">
            Get Started
          </UButton>
        </div>
      </div>

      <!-- Connected state -->
      <div v-else-if="telegramLoaded && telegramStore.isConnected" class="mb-8">
        <div class="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-full text-green-700 dark:text-green-400 text-sm">
          <UIcon name="i-lucide-check-circle" class="w-4 h-4" />
          Telegram connected
        </div>
      </div>

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

const { $api } = useNuxtApp()
const telegramStore = useTelegramStore()
const telegramLoaded = ref(false)
const apiStatus = ref<{ ok: boolean; message: string } | null>(null)

onMounted(async () => {
  await telegramStore.fetchConnection()
  telegramLoaded.value = true
})

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
