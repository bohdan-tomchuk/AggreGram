import type { TelegramAuthStep, SetupStage } from '@aggregram/types'

export type AuthMethod = 'qr' | 'phone'

export interface WizardStepConfig {
  label: string
  key: string
}

/** Step definitions for the QR auth path */
export const QR_STEPS: WizardStepConfig[] = [
  { label: 'Connect', key: 'start' },
  { label: 'Scan', key: 'qr' },
  { label: '2FA', key: '2fa' },
]

/** Step definitions for the phone auth path */
export const PHONE_STEPS: WizardStepConfig[] = [
  { label: 'Connect', key: 'start' },
  { label: 'Phone', key: 'phone' },
  { label: 'Verify', key: 'code' },
  { label: '2FA', key: '2fa' },
]

/** Map TelegramAuthStep to the wizard step index for each path */
export function getStepIndex(step: TelegramAuthStep, method: AuthMethod): number {
  if (method === 'qr') {
    switch (step) {
      case 'idle': return 0
      case 'awaiting_qr_scan': return 1
      case 'awaiting_2fa': return 2
      default: return 0
    }
  }
  // phone path
  switch (step) {
    case 'idle': return 0
    case 'awaiting_phone': return 1
    case 'awaiting_code': return 2
    case 'awaiting_2fa': return 3
    default: return 0
  }
}

export type { TelegramAuthStep, SetupStage }
