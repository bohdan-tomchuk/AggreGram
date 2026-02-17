<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-12">
    <div class="w-full max-w-md">
      <WizardStart
        v-if="telegramStore.wizardStep === 'idle'"
        :step-labels="stepLabels"
        @select-method="onSelectMethod"
      />

      <WizardQrCode
        v-else-if="telegramStore.wizardStep === 'awaiting_qr_scan'"
        :qr-code-url="telegramStore.qrCodeUrl"
        :loading="telegramStore.loading"
        :step-labels="stepLabels"
        @refresh="onRefreshQr"
        @switch-to-phone="onSwitchToPhone"
      />

      <WizardPhoneEntry
        v-else-if="telegramStore.wizardStep === 'awaiting_phone'"
        :loading="telegramStore.loading"
        :error="telegramStore.error"
        :step-labels="stepLabels"
        @submit="onSubmitPhone"
        @switch-to-qr="onSwitchToQr"
      />

      <WizardVerifyCode
        v-else-if="telegramStore.wizardStep === 'awaiting_code'"
        :phone-display="telegramStore.phoneDisplay"
        :loading="telegramStore.loading"
        :error="telegramStore.error"
        :step-labels="stepLabels"
        @submit="onSubmitCode"
        @resend="onResendCode"
        @wrong-number="onWrongNumber"
      />

      <Wizard2FA
        v-else-if="telegramStore.wizardStep === 'awaiting_2fa'"
        :hint="telegramStore.twoFactorHint"
        :loading="telegramStore.loading"
        :error="telegramStore.error"
        :step-labels="stepLabels"
        :two-fa-step-index="twoFaStepIndex"
        @submit="onSubmit2FA"
      />

      <WizardSettingUp
        v-else-if="telegramStore.wizardStep === 'setting_up'"
        :stages="telegramStore.setupStages"
      />

      <WizardSuccess
        v-else-if="telegramStore.wizardStep === 'connected'"
        :bot-username="telegramStore.botUsername"
        @create-feed="onCreateFeed"
        @go-dashboard="onGoDashboard"
      />

      <WizardError
        v-else-if="telegramStore.wizardStep === 'error'"
        :error-message="telegramStore.error"
        :telegram-user-id="telegramStore.telegramUserId"
        @retry="onRetryAfterError"
        @start-over="onStartOver"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import WizardStart from '@features/telegram-wizard/ui/WizardStart.vue'
import WizardQrCode from '@features/telegram-wizard/ui/WizardQrCode.vue'
import WizardPhoneEntry from '@features/telegram-wizard/ui/WizardPhoneEntry.vue'
import WizardVerifyCode from '@features/telegram-wizard/ui/WizardVerifyCode.vue'
import Wizard2FA from '@features/telegram-wizard/ui/Wizard2FA.vue'
import WizardSettingUp from '@features/telegram-wizard/ui/WizardSettingUp.vue'
import WizardSuccess from '@features/telegram-wizard/ui/WizardSuccess.vue'
import WizardError from '@features/telegram-wizard/ui/WizardError.vue'
import {
  QR_STEPS,
  PHONE_STEPS,
  type AuthMethod,
} from '@features/telegram-wizard/model/types'
import { useTelegramStore } from '@entities/telegram/model/connectionStore'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Connect Telegram — AggreGram' })

const telegramStore = useTelegramStore()

// --- Computed ---
const stepLabels = computed(() => {
  const steps = telegramStore.authMethod === 'qr' ? QR_STEPS : PHONE_STEPS
  return steps.map(s => s.label)
})

const twoFaStepIndex = computed(() => {
  return telegramStore.authMethod === 'qr' ? 2 : 3
})

// --- Lifecycle ---
onMounted(async () => {
  const route = useRoute()
  const reconnect = route.query.reconnect === 'true'

  // Always fetch connection status first
  const status = await telegramStore.fetchConnection()

  // Sync health status to ensure accurate connection state
  if (status?.step === 'connected') {
    await telegramStore.syncSessionHealth()
  }

  // Handle reconnection flow
  if (reconnect) {
    // Reset wizard state only if not already reset by health check
    if (telegramStore.wizardStep !== 'idle') {
      telegramStore.reset(true) // Preserve resume context
    }
    // Pre-select auth method from resume context if available
    if (telegramStore.resumeMethod) {
      telegramStore.authMethod = telegramStore.resumeMethod
    }
    return
  }

  // If already truly connected, redirect to dashboard
  if (telegramStore.isConnected) {
    navigateTo('/')
    return
  }

  // If resume context exists, pre-select the method
  if (telegramStore.resumeMethod) {
    telegramStore.authMethod = telegramStore.resumeMethod
  }
})

onUnmounted(() => {
  telegramStore.stopPolling()
  telegramStore.stopQrPolling()
})

// --- Handlers ---
async function onSelectMethod(method: AuthMethod) {
  await telegramStore.initConnection(method)
}

async function onRefreshQr() {
  await telegramStore.refreshQr()
}

async function onSwitchToPhone() {
  telegramStore.error = ''
  telegramStore.authMethod = 'phone'
  await telegramStore.initConnection('phone')
}

async function onSwitchToQr() {
  telegramStore.error = ''
  telegramStore.authMethod = 'qr'
  await telegramStore.initConnection('qr')
}

async function onSubmitPhone(payload: { countryCode: string; phoneNumber: string }) {
  await telegramStore.submitPhone(payload.countryCode, payload.phoneNumber)
}

async function onSubmitCode(payload: { code: string }) {
  await telegramStore.submitCode(payload.code)
}

async function onResendCode() {
  await telegramStore.resendCode()
}

function onWrongNumber() {
  telegramStore.wizardStep = 'awaiting_phone'
  telegramStore.error = ''
}

async function onSubmit2FA(payload: { password: string }) {
  await telegramStore.submit2FA(payload.password)
}

function onCreateFeed() {
  navigateTo('/')
}

function onGoDashboard() {
  navigateTo('/')
}

async function onRetryAfterError() {
  // Try to fetch connection status again to see current state
  const status = await telegramStore.fetchConnection()
  
  // If we're still in error state or have no status, reset and start over
  if (!status || status.step === 'error') {
    telegramStore.reset()
  }
}

function onStartOver() {
  telegramStore.reset()
}
</script>
