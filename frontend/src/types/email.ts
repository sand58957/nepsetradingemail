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
  thumb_url: string | null
  url: string
  created_at: string
  meta?: {
    width?: number
    height?: number
  }
}

export interface MediaListResponse {
  data: {
    results: MediaItem[]
    query: string
    total: number
    per_page: number
    page: number
  }
}

export interface MediaFolder {
  id: number
  name: string
  user_id: number
  item_count: number
  created_at: string
  updated_at: string
}

export interface MediaFolderListResponse {
  success: boolean
  data: MediaFolder[]
}

export interface CreateMediaFolderRequest {
  name: string
}

export interface ImportFromURLRequest {
  url: string
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

// ============================================================
// Import Types
// ============================================================

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type ImportSource = 'csv' | 'api' | 'webhook'

export interface ImportHistoryRecord {
  id: number
  source: ImportSource
  filename: string | null
  status: ImportStatus
  total: number
  successful: number
  failed: number
  skipped: number
  list_ids: number[]
  field_mapping: Record<string, string>
  error_log: ImportError[]
  summary: Record<string, number>
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ImportError {
  email?: string
  error: string
}

export interface ImportHistoryListResponse {
  success: boolean
  data: ImportHistoryRecord[]
  total: number
  page: number
  per_page: number
}

export interface ListmonkImportStatus {
  data: {
    name: string
    total: number
    imported: number
    status: string
  }
}

export interface ImportWebhook {
  id: number
  name: string
  secret_key: string
  list_ids: number[]
  is_active: boolean
  trigger_count: number
  created_at: string
  updated_at: string
}

export interface ImportAnalytics {
  total_imports: number
  total_records: number
  total_successful: number
  total_failed: number
  total_skipped: number
  active_webhooks: number
  suppressed_emails: number
}

export interface CSVImportParams {
  mode: 'subscribe' | 'blocklist'
  delim: string
  lists: number[]
  overwrite: boolean
}

export interface APIImportPayload {
  subscribers: {
    email: string
    name: string
    status?: string
    attribs?: Record<string, string | number | boolean>
  }[]
  list_ids: number[]
  overwrite: boolean
}

export interface APIImportResult {
  success: boolean
  data: {
    import_id: number
    total: number
    successful: number
    failed: number
    skipped: number
    errors: ImportError[]
  }
}

export interface SuppressionEntry {
  id: number
  email: string
  reason: string
  created_at: string
}

export interface SuppressionListResponse {
  success: boolean
  data: SuppressionEntry[]
  total: number
  page: number
  per_page: number
}

// ============================================================
// Account Settings Types
// ============================================================

export interface CompanyProfile {
  company_name: string
  website: string
  address: string
  city: string
  country: string
  timezone: string
  time_format: '12h' | '24h'
  show_branding: boolean
}

export interface SocialLink {
  platform: string
  url: string
}

export interface BrandDefaults {
  sender_name: string
  sender_email: string
  custom_reply_to: boolean
  reply_to_email: string
  add_recipient_name: boolean
  logo_url: string
  force_update_logo: boolean
  font_family: string
  color_primary: string
  color_secondary: string
  color_heading: string
  color_text: string
  color_border: string
  track_opens: boolean
  google_analytics: boolean
  ga_campaigns: boolean
  ga_automations: boolean
  social_links: SocialLink[]
  company_details: string
  auto_generate_footer: boolean
  force_update_footer: boolean
  unsubscribe_disclaimer: string
  unsubscribe_link_text: string
}

export interface SendingDomain {
  domain: string
  status: 'verified' | 'pending' | 'failed'
  domain_alignment: boolean
}

export interface SiteDomain {
  domain: string
  status: 'verified' | 'pending' | 'failed'
  ssl: boolean
  site: string
}

export interface DomainsConfig {
  sending_domains: SendingDomain[]
  site_domains: SiteDomain[]
}

// Per-account domain record (from app_domains table)
export interface DomainRecord {
  id: number
  account_id: number
  domain: string
  type: 'sending' | 'site'
  status: 'verified' | 'pending' | 'failed'
  dkim_public_key?: string
  dkim_selector: string
  verification_hash: string
  domain_alignment: boolean
  ssl: boolean
  site: string
  sendgrid_domain_id: number
  sendgrid_dns: any
  from_email: string
  from_name: string
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface DnsRecord {
  label: string
  type: string
  name: string
  value: string
  status?: string
}

export interface DnsRecordsResponse {
  domain_id: number
  domain: string
  records: DnsRecord[]
}

export interface DnsRecordResult {
  record_type: string
  expected: string
  found: string
  status: 'pass' | 'fail'
}

export interface DomainVerificationResult {
  domain: string
  all_passed: boolean
  records: DnsRecordResult[]
  checked_at: string
}

export interface EcommerceConfig {
  enabled: boolean
  provider: string
  api_key: string
  store_url: string
}

export interface LinkTrackingConfig {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_term: string
  utm_content: string
}

export interface AccountSettings {
  company_profile: CompanyProfile
  brand_defaults: BrandDefaults
  domains: DomainsConfig
  ecommerce: EcommerceConfig
  link_tracking: LinkTrackingConfig
}
