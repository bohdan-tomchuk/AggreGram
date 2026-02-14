<template>
  <DashboardLayout>
    <div class="max-w-2xl mx-auto py-8">
      <!-- Back button -->
      <UButton
        variant="ghost"
        color="neutral"
        size="sm"
        class="mb-6"
        @click="navigateTo('/')"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4 mr-1.5" />
        Back to Dashboard
      </UButton>

      <!-- Page Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-display font-bold text-gray-900 dark:text-white mb-2">
          Create New Feed
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Set up a new aggregation feed. You'll be able to add source channels in the next step.
        </p>
      </div>

      <!-- Form -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Name field -->
          <UFormGroup label="Feed Name" required :error="nameError">
            <UInput
              v-model="formData.name"
              placeholder="e.g., Tech News, Crypto Updates"
              size="lg"
              :disabled="loading"
            />
            <template #hint>
              <span class="text-xs text-gray-500">
                {{ formData.name.length }}/100 characters (min 3)
              </span>
            </template>
          </UFormGroup>

          <!-- Description field -->
          <UFormGroup label="Description" hint="Optional">
            <UTextarea
              v-model="formData.description"
              placeholder="Describe what this feed aggregates..."
              :rows="3"
              :disabled="loading"
            />
            <template #hint>
              <span class="text-xs text-gray-500">Max 500 characters</span>
            </template>
          </UFormGroup>

          <!-- Polling Interval field -->
          <UFormGroup
            label="Polling Interval"
            hint="How often to check for new messages"
          >
            <USelect
              v-model="formData.pollingIntervalSec"
              :options="pollingIntervalOptions"
              option-attribute="label"
              value-attribute="value"
              size="lg"
              :disabled="loading"
            />
          </UFormGroup>

          <!-- Actions -->
          <div class="flex items-center gap-3 pt-4">
            <UButton
              type="submit"
              size="lg"
              :loading="loading"
              :disabled="!isFormValid"
            >
              <UIcon name="i-lucide-plus" class="size-4 mr-1.5" />
              Create Feed
            </UButton>

            <UButton
              variant="ghost"
              color="neutral"
              size="lg"
              :disabled="loading"
              @click="navigateTo('/')"
            >
              Cancel
            </UButton>
          </div>
        </form>
      </div>
    </div>
  </DashboardLayout>
</template>

<script setup lang="ts">
import DashboardLayout from '@widgets/dashboard/ui/DashboardLayout.vue'
import type { CreateFeedRequest } from '@aggregram/types'

definePageMeta({
  middleware: ['auth', 'telegram-connected'],
})

const feedStore = useFeedStore()
const loading = ref(false)

const formData = reactive<CreateFeedRequest>({
  name: '',
  description: '',
  pollingIntervalSec: 300,
})

const pollingIntervalOptions = [
  { label: '1 minute', value: 60 },
  { label: '5 minutes (recommended)', value: 300 },
  { label: '15 minutes', value: 900 },
  { label: '30 minutes', value: 1800 },
  { label: '1 hour', value: 3600 },
]

const nameError = computed(() => {
  const trimmedName = formData.name.trim()
  if (trimmedName.length === 0) return ''
  if (trimmedName.length < 3) return 'Name must be at least 3 characters'
  if (trimmedName.length > 100) return 'Name must not exceed 100 characters'
  return ''
})

const isFormValid = computed(() => {
  const trimmedName = formData.name.trim()
  return trimmedName.length >= 3 && trimmedName.length <= 100
})

const toast = useToast()

async function handleSubmit() {
  if (!isFormValid.value) return

  loading.value = true

  const newFeed = await feedStore.createFeed({
    name: formData.name.trim(),
    description: formData.description?.trim() || undefined,
    pollingIntervalSec: formData.pollingIntervalSec,
  })

  loading.value = false

  if (newFeed) {
    // Show success message with next steps
    toast.add({
      title: 'Feed created successfully!',
      description: 'Now add source channels to start aggregating content.',
      color: 'success',
    })
    // Navigate to feed detail page
    navigateTo(`/feeds/${newFeed.id}`)
  }
}
</script>
