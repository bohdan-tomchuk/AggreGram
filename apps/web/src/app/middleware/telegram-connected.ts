export default defineNuxtRouteMiddleware(async (to) => {
  const telegramStore = useTelegramStore()

  // Allow navigation to /setup/telegram to prevent redirect loops
  if (to.path === '/setup/telegram') {
    return
  }

  // Fetch connection status if not already loaded
  if (telegramStore.wizardStep === 'idle' && !telegramStore.isConnected) {
    await telegramStore.fetchConnection()
  }

  // If session is expired or disconnected, redirect to reconnection flow
  if (telegramStore.sessionHealthStatus === 'expired' || telegramStore.sessionHealthStatus === 'disconnected') {
    return navigateTo('/setup/telegram?reconnect=true')
  }

  // Use strict isConnected check for protected routes
  if (!telegramStore.isConnected) {
    return navigateTo('/setup/telegram')
  }
})
