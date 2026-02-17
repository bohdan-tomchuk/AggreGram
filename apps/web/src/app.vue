<template>
  <div>
    <UApp>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UApp>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@shared/model/stores/authStore'
import { useTelegramStore } from '@entities/telegram/model/connectionStore'

useHead({
  title: 'AggreGram',
  meta: [
    { name: 'description', content: 'Telegram Feed Aggregation Service' },
  ],
  link: [
    { rel: 'icon', type: 'image/webp', href: '/logo.webp' },
  ],
})

// Initialize session health sync when user is authenticated
const authStore = useAuthStore()
const telegramStore = useTelegramStore()

watch(() => authStore.isAuthenticated, (isAuth) => {
  if (isAuth) {
    telegramStore.startHealthCheck()
  } else {
    telegramStore.stopHealthCheck()
  }
}, { immediate: true })

onUnmounted(() => {
  telegramStore.stopHealthCheck()
})
</script>
