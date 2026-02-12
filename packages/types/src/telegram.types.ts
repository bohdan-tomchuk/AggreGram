// Connection wizard state
export type TelegramAuthStep =
  | 'idle'
  | 'awaiting_qr_scan'
  | 'awaiting_phone'
  | 'awaiting_code'
  | 'awaiting_2fa'
  | 'setting_up'
  | 'connected'
  | 'error';

export interface TelegramConnectionStatus {
  step: TelegramAuthStep;
  isConnected: boolean;
  telegramUserId?: string;
  phoneNumber?: string;
  qrCodeUrl?: string;
  twoFactorHint?: string;
  botUsername?: string;
  error?: string;
  setupStages?: SetupStage[];
  resumeContext?: {
    lastMethod?: 'qr' | 'phone';
    phoneNumber?: string;
  };
}

// API request/response types
export interface InitConnectionRequest {
  method: 'qr' | 'phone';
}

export interface InitConnectionResponse {
  step: TelegramAuthStep;
  qrCodeUrl?: string;
}

export interface SubmitPhoneRequest {
  phoneNumber: string;
}

export interface SubmitPhoneResponse {
  step: 'awaiting_code';
  phoneNumberMasked: string;
}

export interface SubmitCodeRequest {
  code: string;
}

export interface SubmitCodeResponse {
  step: 'awaiting_2fa' | 'setting_up';
  twoFactorHint?: string;
}

export interface Submit2FARequest {
  password: string;
}

export interface Submit2FAResponse {
  step: 'setting_up';
}

export interface SetupProgressEvent {
  step: 'setting_up';
  stages: SetupStage[];
}

export interface SetupStage {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
}

export interface SetupCompleteResponse {
  step: 'connected';
  botUsername: string;
  botTelegramId: string;
}

export interface TelegramConnectionInfo {
  isConnected: boolean;
  telegramUserId?: string;
  phoneNumberMasked?: string;
  sessionStatus?: 'active' | 'expired' | 'revoked';
  botUsername?: string;
  botStatus?: 'active' | 'revoked' | 'error';
  lastActivityAt?: string;
}
