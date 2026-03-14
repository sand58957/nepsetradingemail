import api from './api'
import type {
  SMSSettings,
  SMSContact,
  SMSCampaign,
  SMSCampaignRecipient,
  SMSContactListResponse,
  SMSCampaignListResponse,
  SMSOverviewStats,
  SMSNetworkBreakdown,
  SMSContactGroup,
  SMSContactGroupWithCount
} from '@/types/sms'

export interface PaginationParams {
  page?: number
  per_page?: number
  query?: string
  tag?: string
  opted_in?: string
  status?: string
}

export const smsService = {
  // ==================== Settings ====================
  getSettings: async (): Promise<{ data: { configured: boolean; settings?: SMSSettings } }> => {
    const response = await api.get('/sms/settings')
    return response.data
  },

  updateSettings: async (data: Partial<SMSSettings>): Promise<void> => {
    await api.put('/sms/settings', data)
  },

  testConnection: async (): Promise<{ data: { connected: boolean; balance: number; total_sent: number } }> => {
    const response = await api.post('/sms/settings/test')
    return response.data
  },

  // ==================== Contacts ====================
  getContacts: async (params?: PaginationParams): Promise<SMSContactListResponse> => {
    const response = await api.get('/sms/contacts', { params })
    return response.data
  },

  getContact: async (id: number): Promise<{ data: SMSContact }> => {
    const response = await api.get(`/sms/contacts/${id}`)
    return response.data
  },

  createContact: async (data: Partial<SMSContact>): Promise<{ data: SMSContact }> => {
    const response = await api.post('/sms/contacts', data)
    return response.data
  },

  updateContact: async (id: number, data: Partial<SMSContact>): Promise<void> => {
    await api.put(`/sms/contacts/${id}`, data)
  },

  deleteContact: async (id: number): Promise<void> => {
    await api.delete(`/sms/contacts/${id}`)
  },

  importContacts: async (formData: FormData): Promise<{ data: { imported: number; skipped: number } }> => {
    const response = await api.post('/sms/contacts/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  exportContacts: async (): Promise<Blob> => {
    const response = await api.get('/sms/contacts/export', {
      responseType: 'blob'
    })
    return response.data
  },

  // ==================== Contact Tags & Stats ====================
  getContactTags: async (): Promise<{ data: { tag: string; count: number }[] }> => {
    const response = await api.get('/sms/contacts/tags')
    return response.data
  },

  createContactTag: async (tag: string, contactIds: number[]): Promise<{ data: { tag: string; updated: number } }> => {
    const response = await api.post('/sms/contacts/tags', { tag, contact_ids: contactIds })
    return response.data
  },

  deleteContactTag: async (tag: string): Promise<{ data: { tag: string; removed: number } }> => {
    const response = await api.delete(`/sms/contacts/tags/${encodeURIComponent(tag)}`)
    return response.data
  },

  getContactStats: async (): Promise<{ data: {
    total_contacts: number
    opted_in: number
    opted_out: number
    tags: { tag: string; count: number }[]
    recent_30d: number
  } }> => {
    const response = await api.get('/sms/contacts/stats')
    return response.data
  },

  // ==================== Campaigns ====================
  getCampaigns: async (params?: PaginationParams): Promise<SMSCampaignListResponse> => {
    const response = await api.get('/sms/campaigns', { params })
    return response.data
  },

  getCampaign: async (id: number): Promise<{ data: {
    campaign: SMSCampaign
    status_breakdown: { status: string; count: number }[]
    network_breakdown: SMSNetworkBreakdown[]
    recipients: SMSCampaignRecipient[]
  } }> => {
    const response = await api.get(`/sms/campaigns/${id}`)
    return response.data
  },

  createCampaign: async (data: {
    name: string
    message_text: string
    target_filter?: Record<string, any>
    scheduled_at?: string
  }): Promise<{ data: SMSCampaign }> => {
    const response = await api.post('/sms/campaigns', data)
    return response.data
  },

  updateCampaign: async (id: number, data: Partial<SMSCampaign>): Promise<void> => {
    await api.put(`/sms/campaigns/${id}`, data)
  },

  deleteCampaign: async (id: number): Promise<void> => {
    await api.delete(`/sms/campaigns/${id}`)
  },

  sendCampaign: async (id: number): Promise<{ data: { status: string; total_targets: number } }> => {
    const response = await api.post(`/sms/campaigns/${id}/send`)
    return response.data
  },

  testCampaign: async (id: number, phone: string): Promise<{ data: { message_id: string; status: string; credits: number } }> => {
    const response = await api.post(`/sms/campaigns/${id}/test`, { phone })
    return response.data
  },

  pauseCampaign: async (id: number): Promise<void> => {
    await api.post(`/sms/campaigns/${id}/pause`)
  },

  resumeCampaign: async (id: number): Promise<void> => {
    await api.post(`/sms/campaigns/${id}/resume`)
  },

  // ==================== Analytics ====================
  getOverview: async (): Promise<{ data: SMSOverviewStats }> => {
    const response = await api.get('/sms/analytics/overview')
    return response.data
  },

  getCreditBalance: async (): Promise<{ data: { credit_balance: number } }> => {
    const response = await api.get('/sms/credits/balance')
    return response.data
  },

  getCampaignAnalytics: async (id: number): Promise<{
    data: {
      campaign: SMSCampaign
      status_breakdown: { status: string; count: number }[]
      network_breakdown: SMSNetworkBreakdown[]
      failed_messages: { phone: string; error_reason: string; failed_at: string }[]
    }
  }> => {
    const response = await api.get(`/sms/analytics/campaigns/${id}`)
    return response.data
  },

  getAudienceCount: async (filter: Record<string, any>): Promise<{ data: { count: number } }> => {
    const response = await api.post('/sms/campaigns/audience-count', filter)
    return response.data
  },

  // ==================== Contact Groups ====================
  getGroups: async (): Promise<{ data: SMSContactGroupWithCount[] }> => {
    const response = await api.get('/sms/groups')
    return response.data
  },

  getGroup: async (id: number): Promise<{ data: { group: SMSContactGroup; member_count: number } }> => {
    const response = await api.get(`/sms/groups/${id}`)
    return response.data
  },

  createGroup: async (data: { name: string; description?: string; color?: string }): Promise<{ data: SMSContactGroup }> => {
    const response = await api.post('/sms/groups', data)
    return response.data
  },

  updateGroup: async (id: number, data: { name: string; description?: string; color?: string }): Promise<void> => {
    await api.put(`/sms/groups/${id}`, data)
  },

  deleteGroup: async (id: number): Promise<void> => {
    await api.delete(`/sms/groups/${id}`)
  },

  getGroupMembers: async (id: number, params?: { page?: number; per_page?: number; query?: string }): Promise<{
    data: { results: SMSContact[]; total: number; page: number; per_page: number }
  }> => {
    const response = await api.get(`/sms/groups/${id}/members`, { params })
    return response.data
  },

  addGroupMembers: async (id: number, contactIds: number[]): Promise<{ data: { added: number } }> => {
    const response = await api.post(`/sms/groups/${id}/members`, { contact_ids: contactIds })
    return response.data
  },

  removeGroupMembers: async (id: number, contactIds: number[]): Promise<{ data: { removed: number } }> => {
    const response = await api.delete(`/sms/groups/${id}/members`, { data: { contact_ids: contactIds } })
    return response.data
  }
}

export default smsService
