export interface MessengerSettings {
  id: number
  account_id: number
  page_id: string
  page_access_token: string
  app_id: string
  app_secret: string
  verify_token: string
  webhook_secret: string
  send_rate: number
  is_active: boolean
  opt_in_keyword: string
  welcome_message: string
  keyword_prompt: string
  created_at: string
  updated_at: string
}

export interface MessengerContact {
  id: number
  account_id: number
  psid: string
  name: string
  email: string
  profile_pic: string
  opted_in: boolean
  opted_in_at: string | null
  opted_out_at: string | null
  tags: string[]
  attributes: Record<string, string>
  created_at: string
  updated_at: string
}

export interface MessengerCampaign {
  id: number
  account_id: number
  name: string
  message_text: string
  image_url: string
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

export interface MessengerCampaignRecipient {
  id: number
  contact_id: number
  psid: string
  contact_name: string
  status: string
  error_reason: string
  submitted_at: string | null
  delivered_at: string | null
  read_at: string | null
  failed_at: string | null
  created_at: string
}

export interface MessengerContactListResponse {
  data: {
    results: MessengerContact[]
    total: number
    page: number
    per_page: number
  }
}

export interface MessengerCampaignListResponse {
  data: {
    results: MessengerCampaign[]
    total: number
    page: number
    per_page: number
  }
}

export interface MessengerOverviewStats {
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
  recent_campaigns: MessengerCampaign[]
}

export interface MessengerContactGroup {
  id: number
  account_id: number
  name: string
  description: string
  color: string
  created_at: string
  updated_at: string
}

export interface MessengerContactGroupWithCount extends MessengerContactGroup {
  member_count: number
}
