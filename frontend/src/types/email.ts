// Email Marketing Platform Types

export type SubscriberStatus = 'enabled' | 'disabled' | 'blocklisted' | 'unconfirmed' | 'unsubscribed'

export type CampaignStatus = 'draft' | 'running' | 'scheduled' | 'paused' | 'cancelled' | 'finished'

export type CampaignType = 'regular' | 'optin'

export type ContentType = 'richtext' | 'html' | 'markdown' | 'plain'

export interface Subscriber {
  id: number
  uuid: string
  email: string
  name: string
  status: SubscriberStatus
  lists: List[]
  attribs: Record<string, string | number | boolean>
  created_at: string
  updated_at: string
}

export interface SubscriberListResponse {
  data: {
    results: Subscriber[]
    query: string
    total: number
    per_page: number
    page: number
  }
}

export interface Campaign {
  id: number
  uuid: string
  name: string
  subject: string
  from_email: string
  status: CampaignStatus
  type: CampaignType
  tags: string[]
  content_type: ContentType
  body: string
  altbody: string
  send_at: string | null
  started_at: string | null
  to_send: number
  sent: number
  lists: List[]
  views: number
  clicks: number
  bounces: number
  created_at: string
  updated_at: string
}

export interface CampaignListResponse {
  data: {
    results: Campaign[]
    query: string
    total: number
    per_page: number
    page: number
  }
}

export interface List {
  id: number
  uuid: string
  name: string
  type: 'public' | 'private' | 'temporary'
  optin: 'single' | 'double'
  tags: string[]
  description: string
  subscriber_count: number
  created_at: string
  updated_at: string
}

export interface ListResponse {
  data: {
    results: List[]
    total: number
    per_page: number
    page: number
  }
}

export interface Template {
  id: number
  name: string
  type: ContentType
  subject: string
  body: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface TemplateListResponse {
  data: Template[]
}

export interface MediaItem {
  id: number
  uuid: string
  filename: string
  content_type: string
  thumb_url: string
  url: string
  created_at: string
}

export interface MediaListResponse {
  data: MediaItem[]
}

export interface DashboardStats {
  subscribers: {
    total: number
    orphans: number
    to_lists: { list_id: number; list_name: string; subscriber_count: number }[]
  }
  campaigns: {
    total: number
    by_status: { status: CampaignStatus; count: number }[]
  }
  messages: {
    total_sent: number
    open_rate: number
    click_rate: number
    bounce_rate: number
  }
}

export interface Form {
  id: number
  uuid: string
  name: string
  url: string
  lists: List[]
  created_at: string
  updated_at: string
}

export interface AutomationStep {
  id: number
  type: 'wait' | 'email' | 'condition'
  delay: string | null
  campaign_id: number | null
  condition: string | null
  order: number
}

export interface Automation {
  id: number
  uuid: string
  name: string
  status: 'active' | 'inactive'
  trigger: 'subscribe' | 'campaign_open' | 'campaign_click'
  trigger_list_id: number | null
  steps: AutomationStep[]
  created_at: string
  updated_at: string
}

// API Request types
export interface CreateSubscriberPayload {
  email: string
  name: string
  status: SubscriberStatus
  lists: number[]
  attribs?: Record<string, string | number | boolean>
}

export interface UpdateSubscriberPayload {
  email?: string
  name?: string
  status?: SubscriberStatus
  lists?: number[]
  attribs?: Record<string, string | number | boolean>
}

export interface CreateCampaignPayload {
  name: string
  subject: string
  from_email: string
  type: CampaignType
  content_type: ContentType
  body: string
  altbody?: string
  lists: number[]
  tags?: string[]
  send_at?: string
}

export interface UpdateCampaignPayload {
  name?: string
  subject?: string
  from_email?: string
  body?: string
  altbody?: string
  lists?: number[]
  tags?: string[]
  send_at?: string
}

export interface CreateListPayload {
  name: string
  type: 'public' | 'private' | 'temporary'
  optin: 'single' | 'double'
  description?: string
  tags?: string[]
}

export interface CreateTemplatePayload {
  name: string
  type: ContentType
  subject?: string
  body: string
}

export interface UpdateTemplatePayload {
  name?: string
  type?: ContentType
  subject?: string
  body?: string
}

export interface SMTPSettings {
  host: string
  port: number
  auth_protocol: 'login' | 'cram' | 'plain' | 'none'
  username: string
  password: string
  tls_type: 'none' | 'STARTTLS' | 'TLS'
  max_conns: number
  max_msg_retries: number
  idle_timeout: string
  wait_timeout: string
}

export interface AppSettings {
  'app.site_name': string
  'app.root_url': string
  'app.favicon_url': string
  'app.from_email': string
  'app.notify_emails': string[]
  'app.lang': string
  'app.batch_size': number
  'app.concurrency': number
  'app.max_send_errors': number
  'app.message_rate': number
  smtp: SMTPSettings[]
}

export interface PaginationParams {
  page?: number
  per_page?: number
  query?: string
  order_by?: string
  order?: 'asc' | 'desc'
}
