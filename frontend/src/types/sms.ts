export interface SMSSettings {
  id: number
  account_id: number
  auth_token: string
  sender_id: string
  send_rate: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SMSContact {
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

export interface SMSCampaign {
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
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface SMSCampaignMessage {
  id: number
  campaign_id: number
  contact_id: number
  aakash_msg_id: string
  status: string
  network: string
  credits: number
  error_reason: string
  submitted_at: string | null
  delivered_at: string | null
  failed_at: string | null
  created_at: string
}

export interface SMSCampaignRecipient {
  id: number
  contact_id: number
  phone: string
  contact_name: string
  status: string
  network: string
  credits: number
  error_reason: string
  submitted_at: string | null
  delivered_at: string | null
  failed_at: string | null
  created_at: string
}

export interface SMSContactListResponse {
  data: {
    results: SMSContact[]
    total: number
    page: number
    per_page: number
  }
}

export interface SMSCampaignListResponse {
  data: {
    results: SMSCampaign[]
    total: number
    page: number
    per_page: number
  }
}

export interface SMSOverviewStats {
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
  credit_balance: number
  recent_campaigns: SMSCampaign[]
}

export interface SMSNetworkBreakdown {
  network: string
  count: number
  credits: number
}

export interface SMSContactGroup {
  id: number
  account_id: number
  name: string
  description: string
  color: string
  created_at: string
  updated_at: string
}

export interface SMSContactGroupWithCount extends SMSContactGroup {
  member_count: number
}
