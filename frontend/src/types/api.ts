// API Key types
export interface APIKey {
  id: number
  account_id: number
  channel: 'sms' | 'whatsapp' | 'email' | 'telegram'
  key_prefix: string
  name: string
  is_test: boolean
  is_active: boolean
  rate_limit: number
  webhook_url: string | null
  last_used_at: string | null
  created_at: string
}

export interface APIKeyCreateRequest {
  channel: 'sms' | 'whatsapp' | 'email' | 'telegram'
  name: string
  is_test: boolean
  rate_limit?: number
  webhook_url?: string
}

export interface APIKeyCreateResponse {
  id: number
  key: string
  prefix: string
  channel: string
  name: string
  is_test: boolean
  webhook_secret: string
  message: string
}

export interface APIKeyUpdateRequest {
  name?: string
  rate_limit?: number
  webhook_url?: string
}

// Credit types
export interface CreditBalance {
  id: number
  account_id: number
  channel: string
  balance: number
  reserved: number
  updated_at: string
}

export interface CreditTransaction {
  id: number
  account_id: number
  channel: string
  type: 'purchase' | 'deduct' | 'refund' | 'bonus' | 'admin_adjust'
  amount: number
  balance_after: number
  message_id: number | null
  description: string | null
  admin_user_id: number | null
  created_at: string
}

export interface AdminCreditEntry {
  account_id: number
  account_name: string
  channel: string
  balance: number
  reserved: number
}

export interface AdminAdjustRequest {
  channel: 'sms' | 'whatsapp' | 'email' | 'telegram'
  amount: number
  description: string
}

// API Message types
export interface APIMessage {
  id: number
  account_id: number
  channel: string
  to: string
  from: string | null
  subject: string | null
  content_preview: string | null
  status: string
  provider_message_id: string | null
  credits_charged: number
  error_message: string | null
  reference: string | null
  created_at: string
  sent_at: string | null
  delivered_at: string | null
}
