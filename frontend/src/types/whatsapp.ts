export interface WASettings {
  id: number
  account_id: number
  gupshup_app_id: string
  gupshup_api_key: string
  source_phone: string
  app_name: string
  waba_id: string
  webhook_secret: string
  send_rate: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WAContact {
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

export interface WATemplate {
  id: number
  account_id: number
  gupshup_id: string
  name: string
  category: string
  language: string
  status: string
  header_type: string
  header_text: string
  body_text: string
  footer_text: string
  button_type: string
  buttons: any[]
  sample_values: string[]
  synced_at: string | null
  created_at: string
  updated_at: string
}

export interface WACampaign {
  id: number
  account_id: number
  name: string
  template_id: number | null
  status: string
  target_filter: Record<string, any>
  template_params: any[]
  total_targets: number
  sent_count: number
  delivered_count: number
  read_count: number
  failed_count: number
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface WACampaignMessage {
  id: number
  campaign_id: number
  contact_id: number
  gupshup_msg_id: string
  wa_msg_id: string
  status: string
  error_reason: string
  submitted_at: string | null
  enqueued_at: string | null
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  failed_at: string | null
  created_at: string
}

export interface WAContactListResponse {
  data: {
    results: WAContact[]
    total: number
    page: number
    per_page: number
  }
}

export interface WACampaignListResponse {
  data: {
    results: WACampaign[]
    total: number
    page: number
    per_page: number
  }
}

export interface WAOverviewStats {
  contacts: {
    total_contacts: number
    opted_in: number
    total_campaigns: number
  }
  messages: {
    total_sent: number
    total_delivered: number
    total_read: number
    total_failed: number
  }
  recent_campaigns: WACampaign[]
}
