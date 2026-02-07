export function usePasswordStrength(password: Ref<string>) {
  const strength = computed(() => {
    const val = password.value
    if (!val || val.length < 8) return 0

    let score = 0
    if (/[a-z]/.test(val)) score++
    if (/[A-Z]/.test(val)) score++
    if (/[0-9]/.test(val)) score++
    if (/[^a-zA-Z0-9]/.test(val)) score++

    return score
  })

  const label = computed(() => {
    const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
    return labels[strength.value]
  })

  const color = computed(() => {
    const colors = ['text-gray-400', 'text-red-500', 'text-amber-500', 'text-brand-500', 'text-green-500']
    return colors[strength.value]
  })

  const barColor = computed(() => {
    const colors = ['bg-gray-200', 'bg-red-500', 'bg-amber-500', 'bg-brand-500', 'bg-green-500']
    return colors[strength.value]
  })

  return { strength, label, color, barColor }
}
