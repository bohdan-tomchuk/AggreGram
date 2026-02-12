<template>
  <div class="space-y-8">
    <WizardStepIndicator :current-step="2" :labels="stepLabels" />

    <div class="text-center">
      <h2 class="text-2xl font-display font-bold text-gray-900 dark:text-white">
        Enter Code
      </h2>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
        We sent a code to <span class="font-medium text-gray-700 dark:text-gray-300">{{ phoneDisplay }}</span>
      </p>
    </div>

    <div v-if="error" class="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
    </div>

    <div class="flex justify-center">
      <CodeInput
        ref="codeInputRef"
        v-model="code"
        :length="5"
        @complete="onComplete"
      />
    </div>

    <div v-if="loading" class="flex justify-center">
      <UIcon name="i-lucide-loader-2" class="size-5 text-brand-500 animate-spin" />
    </div>

    <div class="flex flex-col items-center gap-3">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        <template v-if="resendCountdown > 0">
          Resend code in <span class="font-medium text-gray-700 dark:text-gray-300">{{ formattedCountdown }}</span>
        </template>
        <button
          v-else
          type="button"
          class="text-brand-500 hover:text-brand-600 font-medium"
          @click="emit('resend')"
        >
          Resend code
        </button>
      </p>

      <button
        type="button"
        class="text-sm text-brand-500 hover:text-brand-600 font-medium"
        @click="emit('wrong-number')"
      >
        Wrong number?
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import WizardStepIndicator from './WizardStepIndicator.vue'
import CodeInput from '@shared/ui/CodeInput.vue'

defineProps<{
  phoneDisplay: string
  loading: boolean
  error: string
  stepLabels: string[]
}>()

const emit = defineEmits<{
  submit: [payload: { code: string }]
  resend: []
  'wrong-number': []
}>()

const code = ref('')
const codeInputRef = ref<InstanceType<typeof CodeInput> | null>(null)

const RESEND_SECONDS = 45
const resendCountdown = ref(RESEND_SECONDS)
let timer: ReturnType<typeof setInterval> | null = null

const formattedCountdown = computed(() => {
  const mins = Math.floor(resendCountdown.value / 60)
  const secs = resendCountdown.value % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

function startTimer() {
  resendCountdown.value = RESEND_SECONDS
  timer = setInterval(() => {
    if (resendCountdown.value > 0) {
      resendCountdown.value--
    } else if (timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

function onComplete(value: string) {
  emit('submit', { code: value })
}

onMounted(() => {
  startTimer()
  codeInputRef.value?.focus()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>
