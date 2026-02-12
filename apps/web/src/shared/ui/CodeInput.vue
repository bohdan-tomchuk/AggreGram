<template>
  <div class="flex items-center gap-3">
    <input
      v-for="(_, i) in digits"
      :key="i"
      ref="inputRefs"
      :value="digits[i]"
      type="text"
      inputmode="numeric"
      maxlength="1"
      :class="[
        'w-12 h-14 text-center text-xl font-semibold rounded-md border outline-none transition-colors',
        'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
        focused === i
          ? 'border-brand-500 ring-2 ring-brand-500/20'
          : 'border-gray-300 dark:border-gray-600',
      ]"
      @input="onInput(i, $event)"
      @keydown="onKeydown(i, $event)"
      @focus="focused = i"
      @blur="focused = -1"
      @paste="onPaste"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  length?: number
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  complete: [code: string]
}>()

const digitCount = computed(() => props.length ?? 5)
const digits = reactive<string[]>(Array(digitCount.value).fill(''))
const inputRefs = ref<HTMLInputElement[]>([])
const focused = ref(-1)

watch(() => props.modelValue, (val) => {
  if (val === undefined) return
  const chars = val.split('')
  for (let i = 0; i < digitCount.value; i++) {
    digits[i] = chars[i] || ''
  }
})

function emitValue() {
  const value = digits.join('')
  emit('update:modelValue', value)
  if (value.length === digitCount.value && digits.every(d => d !== '')) {
    emit('complete', value)
  }
}

function onInput(index: number, event: Event) {
  const target = event.target as HTMLInputElement
  const char = target.value.replace(/\D/g, '').slice(-1)
  digits[index] = char
  target.value = char

  if (char && index < digitCount.value - 1) {
    inputRefs.value[index + 1]?.focus()
  }

  emitValue()
}

function onKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace') {
    if (!digits[index] && index > 0) {
      digits[index - 1] = ''
      inputRefs.value[index - 1]?.focus()
      emitValue()
    }
  } else if (event.key === 'ArrowLeft' && index > 0) {
    inputRefs.value[index - 1]?.focus()
  } else if (event.key === 'ArrowRight' && index < digitCount.value - 1) {
    inputRefs.value[index + 1]?.focus()
  }
}

function onPaste(event: ClipboardEvent) {
  event.preventDefault()
  const pasted = (event.clipboardData?.getData('text') || '').replace(/\D/g, '')
  for (let i = 0; i < digitCount.value; i++) {
    digits[i] = pasted[i] || ''
  }
  const focusIdx = Math.min(pasted.length, digitCount.value - 1)
  inputRefs.value[focusIdx]?.focus()
  emitValue()
}

function focus() {
  inputRefs.value[0]?.focus()
}

defineExpose({ focus })
</script>
