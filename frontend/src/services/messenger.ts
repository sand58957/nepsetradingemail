import api from './api'
import type {
  MessengerSettings,
  MessengerContact,
  MessengerCampaign,
  MessengerCampaignRecipient,
  MessengerContactListResponse,
  MessengerCampaignListResponse,
  MessengerOverviewStats,
  MessengerContactGroup,
  MessengerContactGroupWithCount
} from '@/types/messenger'

export interface PaginationParams {
  page?: number
  per_page?: number
  query?: string
  tag?: string
  opted_in?: string
  status?: string
}

export const messengerService = {
  // ==================== Settings ====================
  getSettings: async (): Promise<{ data: { configured: boolean; settings?: MessengerSettings; page_name?: string } }> => {
    const response = await api.get('/messenger/settings')
    return response.data
  },

  updateSettings: async (data: Partial<MessengerSettings>): Promise<void> => {
    await api.put('/messenger/settings', data)
  },

  testConnection: async (): Promise<{ data: { connected: boolean; page_name?: string; page_id?: string } }> => {
    const response = await api.post('/messenger/settings/test')
    return response.data
  },

  // ==================== Contacts ====================
  getContacts: async (params?: PaginationParams): Promise<MessengerContactListResponse> => {
    const response = await api.get('/messenger/contacts', { params })
    return response.data
  },

  createContact: async (data: Partial<MessengerContact> & { group_ids?: number[] }): Promise<{ data: MessengerContact }> => {
    const response = await api.post('/messenger/contacts', data)
    return response.data
  },

  updateContact: async (id: number, data: Partial<MessengerContact> & { group_ids?: number[] }): Promise<void> => {
    await api.put(`/messenger/contacts/${id}`, data)
  },

  deleteContact: async (id: number): Promise<void> => {
    await api.delete(`/messenger/contacts/${id}`)
  },

  importContacts: async (formData: FormData): Promise<{ data: { imported: number; skipped: number } }> => {
    const response = await api.post('/messenger/contacts/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  exportContacts: async (): Promise<Blob> => {
    const response = await api.get('/messenger/contacts/export', {
      responseType: 'blob'
    })
    return response.data
  },

  // ==================== Contact Tags & Stats ====================
  getContactTags: async (): Promise<{ data: { tag: string; count: number }[] }> => {
    const response = await api.get('/messenger/contacts/tags')
    return response.data
  },

  createContactTag: async (tag: string, contactIds: number[]): Promise<{ data: { tag: string; updated: number } }> => {
    const response = await api.post('/messenger/contacts/tags', { tag, contact_ids: contactIds })
    return response.data
  },

  deleteContactTag: async (tag: string): Promise<{ data: { tag: string; removed: number } }> => {
    const response = await api.delete(`/messenger/contacts/tags/${encodeURIComponent(tag)}`)
    return response.data
  },

  getContactStats: async (): Promise<{ data: {
    total_contacts: number
    opted_in: number
    opted_out: number
    tags: { tag: string; count: number }[]
    recent_30d: number
  } }> => {
    const response = await api.get('/messenger/contacts/stats')
    return response.data
  },

  // ==================== Campaigns ====================
  getCampaigns: async (params?: PaginationParams): Promise<MessengerCampaignListResponse> => {
    const response = await api.get('/messenger/campaigns', { params })
    return response.data
  },

  getCampaign: async (id: number): Promise<{ data: {
    campaign: MessengerCampaign
    status_breakdown: { status: string; count: number }[]
    recipients: MessengerCampaignRecipient[]
  } }> => {
    const response = await api.get(`/messenger/campaigns/${id}`)
    return response.data
  },

  createCampaign: async (data: {
    name: string
    message_text: string
    image_url?: string
    target_filter?: Record<string, any>
    scheduled_at?: string
  }): Promise<{ data: MessengerCampaign }> => {
    const response = await api.post('/messenger/campaigns', data)
    return response.data
  },

  updateCampaign: async (id: number, data: Partial<MessengerCampaign>): Promise<void> => {
    await api.put(`/messenger/campaigns/${id}`, data)
  },

  deleteCampaign: async (id: number): Promise<void> => {
    await api.delete(`/messenger/campaigns/${id}`)
  },

  sendCampaign: async (id: number): Promise<{ data: { status: string; total_targets: number } }> => {
    const response = await api.post(`/messenger/campaigns/${id}/send`)
    return response.data
  },

  testCampaign: async (id: number, psid: string): Promise<{ data: { message_id: string; status: string } }> => {
    const response = await api.post(`/messenger/campaigns/${id}/test`, { psid })
    return response.data
  },

  pauseCampaign: async (id: number): Promise<void> => {
    await api.post(`/messenger/campaigns/${id}/pause`)
  },

  resumeCampaign: async (id: number): Promise<void> => {
    await api.post(`/messenger/campaigns/${id}/resume`)
  },

  // ==================== Analytics ====================
  getOverview: async (): Promise<{ data: MessengerOverviewStats }> => {
    const response = await api.get('/messenger/analytics/overview')
    return response.data
  },

  getCampaignAnalytics: async (id: number): Promise<{
    data: {
      campaign: MessengerCampaign
      status_breakdown: { status: string; count: number }[]
      failed_messages: { psid: string; contact_name: string; error_reason: string; failed_at: string }[]
    }
  }> => {
    const response = await api.get(`/messenger/analytics/campaigns/${id}`)
    return response.data
  },

  getAudienceCount: async (filter: Record<string, any>): Promise<{ data: { count: number } }> => {
    const response = await api.post('/messenger/campaigns/audience-count', filter)
    return response.data
  },

  // ==================== Contact Groups ====================
  getGroups: async (): Promise<{ data: MessengerContactGroupWithCount[] }> => {
    const response = await api.get('/messenger/groups')
    return response.data
  },

  getGroup: async (id: number): Promise<{ data: { group: MessengerContactGroup; member_count: number } }> => {
    const response = await api.get(`/messenger/groups/${id}`)
    return response.data
  },

  createGroup: async (data: { name: string; description?: string; color?: string }): Promise<{ data: MessengerContactGroup }> => {
    const response = await api.post('/messenger/groups', data)
    return response.data
  },

  updateGroup: async (id: number, data: { name: string; description?: string; color?: string }): Promise<void> => {
    await api.put(`/messenger/groups/${id}`, data)
  },

  deleteGroup: async (id: number): Promise<void> => {
    await api.delete(`/messenger/groups/${id}`)
  },

  getGroupMembers: async (id: number, params?: { page?: number; per_page?: number; query?: string }): Promise<{
    data: { results: MessengerContact[]; total: number; page: number; per_page: number }
  }> => {
    const response = await api.get(`/messenger/groups/${id}/members`, { params })
    return response.data
  },

  addGroupMembers: async (id: number, contactIds: number[]): Promise<{ data: { added: number } }> => {
    const response = await api.post(`/messenger/groups/${id}/members`, { contact_ids: contactIds })
    return response.data
  },

  removeGroupMembers: async (id: number, contactIds: number[]): Promise<{ data: { removed: number } }> => {
    const response = await api.delete(`/messenger/groups/${id}/members`, { data: { contact_ids: contactIds } })
    return response.data
  }
}

export default messengerService
