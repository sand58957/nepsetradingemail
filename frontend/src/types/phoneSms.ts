// Phone SMS (own SIM): SMS Marketing's screens, sending through the account's
// own Android phone with the SMSGate app.

export interface PhoneSMSSettings {
  id: number
  account_id: number
  server_url: string
  username: string
  device_id: string
  sim_number: number
  daily_limit: number
  send_gap_seconds: number
  webhooks_registered_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PhoneSMSSettingsResponse {
  configured: boolean
  settings?: PhoneSMSSettings
  password?: string
  signing_key?: string
  signing_key_set?: boolean
  webhook_url?: string
  defaults?: { server_url: string; daily_limit: number; send_gap_seconds: number }
}

export interface PhoneSMSSettingsUpdate {
  server_url: string
  username: string
  password: string
  device_id: string
  sim_number: number
  daily_limit: number
  send_gap_seconds: number
  signing_key: string
}

export interface PhoneSMSSimCard {
  slotIndex: number
  simNumber: number
  phoneNumber?: string | null
  carrierName?: string | null
}

export interface PhoneSMSDevice {
  id: string
  name: string
  lastSeen: string
  simCards?: PhoneSMSSimCard[]
}

export interface PhoneSMSConnectionResult {
  connected: boolean
  devices: PhoneSMSDevice[]
  webhooks: string
  webhookUrl: string
}

export interface PhoneSMSInboxItem {
  id: number
  contact_id: number | null
  contact_name: string
  phone: string
  message: string
  sim_number: number
  opted_out: boolean
  received_at: string
}

export interface PhoneSMSContact {
  id: number
  account_id: number
  phone: string
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

export interface PhoneSMSCampaign {
  id: number
  account_id: number
  name: string
  message_text: string
  status: string
  target_filter: Record<string, any>
  total_targets: number
  sent_count: number
  delivered_count: number
  failed_count: number
  credits_used: number
  pause_reason: string
  resume_at: string | null
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface PhoneSMSCampaignMessage {
  id: number
  campaign_id: number
  contact_id: number
  gateway_msg_id: string
  status: string
  network: string
  credits: number
  error_reason: string
  submitted_at: string | null
  sent_at: string | null
  delivered_at: string | null
  failed_at: string | null
  created_at: string
}

export interface PhoneSMSCampaignRecipient {
  id: number
  contact_id: number
  phone: string
  contact_name: string
  status: string
  network: string
  credits: number
  error_reason: string
  submitted_at: string | null
  sent_at: string | null
  delivered_at: string | null
  failed_at: string | null
  created_at: string
}

export interface PhoneSMSContactListResponse {
  data: {
    results: PhoneSMSContact[]
    total: number
    page: number
    per_page: number
  }
}

export interface PhoneSMSCampaignListResponse {
  data: {
    results: PhoneSMSCampaign[]
    total: number
    page: number
    per_page: number
  }
}

export interface PhoneSMSOverviewStats {
  contacts: {
    total_contacts: number
    opted_in: number
    total_campaigns: number
  }
  messages: {
    total_sent: number
    total_delivered: number
    total_failed: number
    total_credits: number
  }
  recent_campaigns: PhoneSMSCampaign[]
  connected: boolean
  sent_today: number
  daily_limit: number
  remaining_today: number
  replies_7d: number
}

export interface PhoneSMSNetworkBreakdown {
  network: string
  count: number
  credits: number
}

export interface PhoneSMSContactGroup {
  id: number
  account_id: number
  name: string
  description: string
  color: string
  created_at: string
  updated_at: string
}

export interface PhoneSMSContactGroupWithCount extends PhoneSMSContactGroup {
  member_count: number
}
