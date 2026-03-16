export interface TelegramSettings {
  id: number
  account_id: number
  bot_token: string
  bot_username: string
  webhook_secret: string
  send_rate: number
  is_active: boolean
  qr_code_url: string
  created_at: string
  updated_at: string
}

export interface TelegramContact {
  id: number
  account_id: number
  chat_id: number
  username: string
  first_name: string
  last_name: string
  name: string
  email: string
  opted_in: boolean
  opted_in_at: string | null
  opted_out_at: string | null
  tags: string[]
  attributes: Record<string, string>
  created_at: string
  updated_at: string
}

export interface TelegramCampaign {
  id: number
  account_id: number
  name: string
  message_text: string
  message_type: string
  media_url: string
  buttons: { text: string; url: string }[]
  status: string
  target_filter: Record<string, any>
  total_targets: number
  sent_count: number
  delivered_count: number
  failed_count: number
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface TelegramCampaignMessage {
  id: number
  campaign_id: number
  contact_id: number
  telegram_msg_id: number
  status: string
  error_reason: string
  submitted_at: string | null
  delivered_at: string | null
  failed_at: string | null
  created_at: string
}

export interface TelegramCampaignRecipient {
  id: number
  contact_id: number
  chat_id: number
  contact_name: string
  username: string
  status: string
  error_reason: string
  submitted_at: string | null
  delivered_at: string | null
  failed_at: string | null
  created_at: string
}

export interface TelegramContactListResponse {
  data: {
    results: TelegramContact[]
    total: number
    page: number
    per_page: number
  }
}

export interface TelegramCampaignListResponse {
  data: {
    results: TelegramCampaign[]
    total: number
    page: number
    per_page: number
  }
}

export interface TelegramOverviewStats {
  contacts: {
    total_contacts: number
    opted_in: number
    total_campaigns: number
  }
  messages: {
    total_sent: number
    total_delivered: number
    total_failed: number
  }
  recent_campaigns: TelegramCampaign[]
}

export interface TelegramContactGroup {
  id: number
  account_id: number
  name: string
  description: string
  color: string
  created_at: string
  updated_at: string
}

export interface TelegramContactGroupWithCount extends TelegramContactGroup {
  member_count: number
}
