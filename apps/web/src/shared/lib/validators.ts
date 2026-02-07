const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string): string {
  if (!email) return 'Email is required'
  if (!EMAIL_RE.test(email)) return 'Enter a valid email'
  return ''
}

export function validatePassword(password: string): string {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  return ''
}
