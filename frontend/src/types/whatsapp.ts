export interface WASettings {
  id: number
  account_id: number
  /** Which gateway session this account sends through. */
  openwa_session_id: string
  linked_phone: string
  session_status: string
  source_phone: string
  app_name: string
  webhook_secret: string
  send_rate: number
  is_active: boolean
  created_at: string
  updated_at: string
  /** When the linked number was last unlinked. Campaigns wait 24 hours after it. */
  unlinked_at: string | null
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
  /** When WhatsApp last could not resolve this number. Campaigns skip the contact for 30 days after it. */
  unreachable_at: string | null
}

export interface WATemplate {
  id: number
  account_id: number
  /** Legacy column: held the Meta template id when Gupshup was the transport.
   *  Retained because campaign delivery matching still joins on it; always empty
   *  for templates created since the move to the self-hosted gateway. */
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
  send_interval_seconds: number
  continuous: boolean
  /** Why the campaign paused itself. Empty while sending, or when a person paused it. */
  pause_reason: string
  /** The number it sends from; null means the account's default number. */
  wa_number_id: number | null
  /** Spread the run over every linked number, at the same overall pace. */
  rotate_numbers: boolean
  /** When a campaign paused at a number's daily allowance carries on by itself. */
  resume_at: string | null
}

/** One WhatsApp number an account can send from. */
export interface WANumber {
  id: number
  label: string
  linked_phone: string
  /** The gateway's session status: qr_ready, ready, disconnected, … */
  status: string
  connected: boolean
  is_default: boolean
  /** False once the number's session has gone from the gateway. */
  linked: boolean
  last_error: string
  /** Present while campaigns from this number wait out an unlink. */
  campaigns_blocked_until?: string
  campaigns_blocked_message?: string
}

export interface WACampaignMessage {
  id: number
  campaign_id: number
  contact_id: number
  /** Legacy column name; now holds the gateway's message id. */
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

export interface WACampaignRecipient {
  id: number
  contact_id: number
  phone: string
  contact_name: string
  status: string
  error_reason: string
  submitted_at: string | null
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

export interface WAContactGroup {
  id: number
  account_id: number
  name: string
  description: string
  color: string
  created_at: string
  updated_at: string
}

export interface WAContactGroupWithCount extends WAContactGroup {
  member_count: number
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

/** A WhatsApp session on the self-hosted gateway. */
export interface OpenWASession {
  id: string
  name: string
  /** created | starting | qr_ready | connected | disconnected | stopped | failed */
  status: string
  phone: string | null
  pushName: string | null
  connectedAt: string | null
  lastActive: string | null
  lastError: string | null
  restriction: string | null
  createdAt: string
  updatedAt: string
}
