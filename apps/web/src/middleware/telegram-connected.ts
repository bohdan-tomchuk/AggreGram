export default defineNuxtRouteMiddleware(async () => {
  const telegramStore = useTelegramStore()

  // Fetch connection status if not already loaded
  if (telegramStore.wizardStep === 'idle' && !telegramStore.isConnected) {
    await telegramStore.fetchConnection()
  }

  if (!telegramStore.isConnected) {
    return navigateTo('/setup/telegram')
  }
})
