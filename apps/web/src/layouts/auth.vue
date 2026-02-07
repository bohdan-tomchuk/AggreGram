<template>
  <div class="min-h-screen flex flex-col lg:flex-row">
    <!-- Brand panel -->
    <div
      class="bg-gray-100 dark:bg-gray-900 px-8 py-8 lg:w-6/10 lg:py-0 flex flex-col justify-center items-center"
    >
      <div class="text-center max-w-[400px]">
        <div class="flex items-center justify-center gap-3 mb-4">
          <img src="@shared/assets/images/logo.webp" alt="AggreGram" class="w-14 h-14 rounded-lg" />
          <h1 class="text-2xl lg:text-3xl font-display font-bold text-gray-900 dark:text-white">
            AggreGram
          </h1>
        </div>
        <p class="text-gray-500 dark:text-gray-400 text-base hidden lg:block">
          Aggregate your favorite Telegram channels into personalized feeds.
          Stay informed, your way.
        </p>
      </div>
    </div>

    <!-- Form panel -->
    <div
      class="flex-1 flex items-center justify-center px-6 py-12 lg:px-8 bg-white dark:bg-gray-950"
    >
      <div class="w-full max-w-[360px]">
        <slot />
      </div>
    </div>
  </div>
</template>
