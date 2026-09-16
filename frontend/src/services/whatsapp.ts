import api from './api'
import type {
  WASettings,
  WAContact,
  WATemplate,
  WACampaign,
  WACampaignRecipient,
  WAContactListResponse,
  WACampaignListResponse,
  WAOverviewStats,
  WAContactGroup,
  WAContactGroupWithCount,
  OpenWASession
} from '@/types/whatsapp'

export interface PaginationParams {
  page?: number
  per_page?: number
  query?: string
  tag?: string
  opted_in?: string
  status?: string
}

export const whatsappService = {
  // ==================== Settings ====================
  /** Account-scoped WhatsApp settings, including the live connection state.
   *
   *  `connection` is here rather than on the session endpoints because those are
   *  super-admin only — an ordinary member of an account can read this. */
  getSettings: async (): Promise<{
    data: {
      configured: boolean
      settings?: WASettings
      connection?: {
        connected: boolean
        status: string
        linked_phone: string
        detail?: string
      }
    }
  }> => {
    const response = await api.get('/whatsapp/settings')

    return response.data
  },

  updateSettings: async (data: Partial<WASettings>): Promise<void> => {
    await api.put('/whatsapp/settings', data)
  },

  testConnection: async (): Promise<{
    data: { connected: boolean; status: string; linked_phone: string; last_error: string }
  }> => {
    const response = await api.post('/whatsapp/settings/test')

    return response.data
  },

  // ==================== This account's own WhatsApp number ====================
  // Each account links and sends from its own number. None of these take a
  // session id: the server resolves it from the account making the request, so
  // one account cannot address another's session even by guessing an id.
  // Creating, linking and unlinking need to be an owner or admin of the account.

  /** This account's connection, or `linked: false` if it has never linked one. */
  mySession: async (): Promise<{ data: { linked: boolean; session: OpenWASession | null } }> => {
    const response = await api.get('/whatsapp/session')

    return response.data
  },

  /** Creates this account's session and starts it so a QR is produced. Safe to
   *  call again — an account that already has one gets it restarted, not a second. */
  createMySession: async (): Promise<{ data: OpenWASession }> => {
    const response = await api.post('/whatsapp/session')

    return response.data
  },

  startMySession: async (): Promise<{ data: OpenWASession }> => {
    const response = await api.post('/whatsapp/session/start')

    return response.data
  },

  myQR: async (): Promise<{ data: { qrCode: string; status: string } }> => {
    const response = await api.get('/whatsapp/session/qr')

    return response.data
  },

  logoutMySession: async (): Promise<void> => {
    await api.post('/whatsapp/session/logout')
  },

  deleteMySession: async (): Promise<void> => {
    await api.delete('/whatsapp/session')
  },

  testMySession: async (phone: string, message: string): Promise<void> => {
    await api.post('/whatsapp/session/test', { phone, message })
  },

  // ==================== Gateway sessions (super admin) ====================
  // A platform-wide view of every tenant's session, for support. Ordinary
  // accounts use the endpoints above.

  listSessions: async (): Promise<{ data: OpenWASession[] }> => {
    const response = await api.get('/system/whatsapp/sessions')

    return response.data
  },

  createSession: async (name: string): Promise<{ data: OpenWASession }> => {
    const response = await api.post('/system/whatsapp/sessions', { name })

    return response.data
  },

  startSession: async (id: string): Promise<{ data: OpenWASession }> => {
    const response = await api.post(`/system/whatsapp/sessions/${id}/start`)

    return response.data
  },

  getSession: async (id: string): Promise<{ data: OpenWASession }> => {
    const response = await api.get(`/system/whatsapp/sessions/${id}`)

    return response.data
  },

  getSessionQR: async (id: string): Promise<{ data: { qrCode: string; status: string } }> => {
    const response = await api.get(`/system/whatsapp/sessions/${id}/qr`)

    return response.data
  },

  logoutSession: async (id: string): Promise<void> => {
    await api.post(`/system/whatsapp/sessions/${id}/logout`)
  },

  deleteSession: async (id: string): Promise<void> => {
    await api.delete(`/system/whatsapp/sessions/${id}`)
  },

  sendSessionTest: async (id: string, phone: string, message: string): Promise<void> => {
    await api.post(`/system/whatsapp/sessions/${id}/test`, { phone, message })
  },

  // ==================== Contacts ====================
  getContacts: async (params?: PaginationParams): Promise<WAContactListResponse> => {
    const response = await api.get('/whatsapp/contacts', { params })

    return response.data
  },

  getContact: async (id: number): Promise<{ data: WAContact }> => {
    const response = await api.get(`/whatsapp/contacts/${id}`)

    return response.data
  },

  createContact: async (data: Partial<WAContact> & { group_ids?: number[] }): Promise<{ data: WAContact }> => {
    const response = await api.post('/whatsapp/contacts', data)

    return response.data
  },

  updateContact: async (id: number, data: Partial<WAContact>): Promise<void> => {
    await api.put(`/whatsapp/contacts/${id}`, data)
  },

  deleteContact: async (id: number): Promise<void> => {
    await api.delete(`/whatsapp/contacts/${id}`)
  },

  /** Imports a CSV. Contacts are opted in only when the form carries
   *  consent_confirmed=true or the file's opted_in column says yes for that row. */
  importContacts: async (
    formData: FormData
  ): Promise<{ data: { imported: number; skipped: number; opted_in?: number; not_opted_in?: number } }> => {
    const response = await api.post('/whatsapp/contacts/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    return response.data
  },

  exportContacts: async (): Promise<Blob> => {
    const response = await api.get('/whatsapp/contacts/export', {
      responseType: 'blob'
    })

    return response.data
  },

  // ==================== Contact Tags & Stats ====================
  getContactTags: async (): Promise<{ data: { tag: string; count: number }[] }> => {
    const response = await api.get('/whatsapp/contacts/tags')

    return response.data
  },

  createContactTag: async (tag: string, contactIds: number[]): Promise<{ data: { tag: string; updated: number } }> => {
    const response = await api.post('/whatsapp/contacts/tags', { tag, contact_ids: contactIds })

    return response.data
  },

  deleteContactTag: async (tag: string): Promise<{ data: { tag: string; removed: number } }> => {
    const response = await api.delete(`/whatsapp/contacts/tags/${encodeURIComponent(tag)}`)

    return response.data
  },

  getContactStats: async (): Promise<{
    data: {
      total_contacts: number
      opted_in: number
      opted_out: number
      tags: { tag: string; count: number }[]
      recent_30d: number
      with_attributes: number
    }
  }> => {
    const response = await api.get('/whatsapp/contacts/stats')

    return response.data
  },

  getContactFields: async (): Promise<{ data: { field: string; count: number }[] }> => {
    const response = await api.get('/whatsapp/contacts/fields')

    return response.data
  },

  getCleanupContacts: async (): Promise<{ data: { contacts: WAContact[]; total: number } }> => {
    const response = await api.get('/whatsapp/contacts/cleanup')

    return response.data
  },

  deleteOptedOutContacts: async (): Promise<{ data: { deleted: number } }> => {
    const response = await api.get('/whatsapp/contacts/cleanup?action=delete')

    return response.data
  },

  // ==================== Templates ====================
  getTemplates: async (): Promise<{ data: WATemplate[] }> => {
    const response = await api.get('/whatsapp/templates')

    return response.data
  },

  getTemplate: async (id: number): Promise<{ data: WATemplate }> => {
    const response = await api.get(`/whatsapp/templates/${id}`)

    return response.data
  },

  syncTemplates: async (): Promise<{ data: { synced: number; total: number } }> => {
    const response = await api.post('/whatsapp/templates/sync')

    return response.data
  },

  createTemplate: async (data: {
    name: string
    category: string
    language: string
    body: string
    example: string
  }): Promise<{ data: WATemplate }> => {
    const response = await api.post('/whatsapp/templates', data)

    return response.data
  },

  deleteTemplate: async (id: number): Promise<void> => {
    await api.delete(`/whatsapp/templates/${id}`)
  },

  // ==================== Campaigns ====================
  getCampaigns: async (params?: PaginationParams): Promise<WACampaignListResponse> => {
    const response = await api.get('/whatsapp/campaigns', { params })

    return response.data
  },

  getCampaign: async (
    id: number
  ): Promise<{
    data: {
      campaign: WACampaign
      status_breakdown: any[]
      recipients: WACampaignRecipient[]
      /** Opted-in contacts this campaign has still not reached. */
      remaining?: number
    }
  }> => {
    const response = await api.get(`/whatsapp/campaigns/${id}`)

    return response.data
  },

  createCampaign: async (data: {
    name: string
    template_id?: number
    target_filter?: Record<string, any>
    template_params?: any[]
    scheduled_at?: string
  }): Promise<{ data: WACampaign }> => {
    const response = await api.post('/whatsapp/campaigns', data)

    return response.data
  },

  updateCampaign: async (id: number, data: Partial<WACampaign>): Promise<void> => {
    await api.put(`/whatsapp/campaigns/${id}`, data)
  },

  deleteCampaign: async (id: number): Promise<void> => {
    await api.delete(`/whatsapp/campaigns/${id}`)
  },

  /** Starts a send. Contacts already reached by this campaign are skipped, so
   *  calling it again continues rather than starting over.
   *
   *  In phase mode it sends `batchSize` contacts and then parks the campaign. In
   *  continuous mode it works through everyone remaining, leaving `intervalSeconds`
   *  between messages, and keeps going across restarts until it finishes or is
   *  paused. */
  sendCampaign: async (
    id: number,
    batchSize?: number,
    options?: { continuous?: boolean; intervalSeconds?: number }
  ): Promise<{
    data: {
      status: string
      mode: 'batch' | 'continuous'
      sending_now: number
      remaining_after: number
      total_remaining: number
      interval_seconds?: number
      estimated_finish?: string
      message: string
    }
  }> => {
    const response = await api.post(`/whatsapp/campaigns/${id}/send`, {
      batch_size: batchSize,
      continuous: options?.continuous ?? false,
      interval_seconds: options?.intervalSeconds
    })

    return response.data
  },

  testCampaign: async (id: number, phone: string): Promise<{ data: { message_id: string; status: string } }> => {
    const response = await api.post(`/whatsapp/campaigns/${id}/test`, { phone })

    return response.data
  },

  pauseCampaign: async (id: number): Promise<void> => {
    await api.post(`/whatsapp/campaigns/${id}/pause`)
  },

  // ==================== Analytics ====================
  getOverview: async (): Promise<{ data: WAOverviewStats }> => {
    const response = await api.get('/whatsapp/analytics/overview')

    return response.data
  },

  getCampaignAnalytics: async (
    id: number
  ): Promise<{
    data: {
      campaign: WACampaign
      status_breakdown: { status: string; count: number }[]
      failed_messages: { phone: string; error_reason: string; failed_at: string }[]
    }
  }> => {
    const response = await api.get(`/whatsapp/analytics/campaigns/${id}`)

    return response.data
  },

  // ==================== Contact Groups ====================
  getGroups: async (): Promise<{ data: WAContactGroupWithCount[] }> => {
    const response = await api.get('/whatsapp/groups')

    return response.data
  },

  getGroup: async (id: number): Promise<{ data: { group: WAContactGroup; member_count: number } }> => {
    const response = await api.get(`/whatsapp/groups/${id}`)

    return response.data
  },

  createGroup: async (data: {
    name: string
    description?: string
    color?: string
  }): Promise<{ data: WAContactGroup }> => {
    const response = await api.post('/whatsapp/groups', data)

    return response.data
  },

  updateGroup: async (id: number, data: { name: string; description?: string; color?: string }): Promise<void> => {
    await api.put(`/whatsapp/groups/${id}`, data)
  },

  deleteGroup: async (id: number): Promise<void> => {
    await api.delete(`/whatsapp/groups/${id}`)
  },

  getGroupMembers: async (
    id: number,
    params?: { page?: number; per_page?: number; query?: string }
  ): Promise<{
    data: { results: WAContact[]; total: number; page: number; per_page: number }
  }> => {
    const response = await api.get(`/whatsapp/groups/${id}/members`, { params })

    return response.data
  },

  addGroupMembers: async (id: number, contactIds: number[]): Promise<{ data: { added: number } }> => {
    const response = await api.post(`/whatsapp/groups/${id}/members`, { contact_ids: contactIds })

    return response.data
  },

  removeGroupMembers: async (id: number, contactIds: number[]): Promise<{ data: { removed: number } }> => {
    const response = await api.delete(`/whatsapp/groups/${id}/members`, { data: { contact_ids: contactIds } })

    return response.data
  }
}

export default whatsappService
