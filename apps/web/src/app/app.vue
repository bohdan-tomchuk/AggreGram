<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'AggreGram',
  meta: [
    { name: 'description', content: 'Telegram Feed Aggregation Service' },
  ],
  link: [
    { rel: 'icon', type: 'image/webp', href: '/logo.webp' },
  ],
})
</script>
