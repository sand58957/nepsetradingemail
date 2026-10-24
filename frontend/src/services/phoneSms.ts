import api from './api'
import type {
  PhoneSMSSettingsResponse,
  PhoneSMSSettingsUpdate,
  PhoneSMSConnectionResult,
  PhoneSMSDevice,
  PhoneSMSInboxItem,
  PhoneSMSContact,
  PhoneSMSCampaign,
  PhoneSMSCampaignRecipient,
  PhoneSMSContactListResponse,
  PhoneSMSCampaignListResponse,
  PhoneSMSOverviewStats,
  PhoneSMSNetworkBreakdown,
  PhoneSMSContactGroup,
  PhoneSMSContactGroupWithCount
} from '@/types/phoneSms'

export interface PaginationParams {
  page?: number
  per_page?: number
  query?: string
  tag?: string
  opted_in?: string
  status?: string
}

export const phoneSmsService = {
  // ==================== Settings ====================
  getSettings: async (): Promise<{ data: PhoneSMSSettingsResponse }> => {
    const response = await api.get('/phone-sms/settings')

    return response.data
  },

  updateSettings: async (data: PhoneSMSSettingsUpdate): Promise<void> => {
    await api.put('/phone-sms/settings', data)
  },

  testConnection: async (): Promise<{ data: PhoneSMSConnectionResult }> => {
    const response = await api.post('/phone-sms/settings/test')

    return response.data
  },

  getDevices: async (): Promise<{ data: PhoneSMSDevice[] }> => {
    const response = await api.get('/phone-sms/devices')

    return response.data
  },

  // ==================== Inbox ====================
  getInbox: async (params?: {
    page?: number
    per_page?: number
    query?: string
  }): Promise<{ data: { results: PhoneSMSInboxItem[]; total: number; page: number; per_page: number } }> => {
    const response = await api.get('/phone-sms/inbox', { params })

    return response.data
  },

  // ==================== Contacts ====================
  getContacts: async (params?: PaginationParams): Promise<PhoneSMSContactListResponse> => {
    const response = await api.get('/phone-sms/contacts', { params })

    return response.data
  },

  getContact: async (id: number): Promise<{ data: PhoneSMSContact }> => {
    const response = await api.get(`/phone-sms/contacts/${id}`)

    return response.data
  },

  createContact: async (data: Partial<PhoneSMSContact> & { group_ids?: number[] }): Promise<{ data: PhoneSMSContact }> => {
    const response = await api.post('/phone-sms/contacts', data)

    return response.data
  },

  updateContact: async (id: number, data: Partial<PhoneSMSContact>): Promise<void> => {
    await api.put(`/phone-sms/contacts/${id}`, data)
  },

  deleteContact: async (id: number): Promise<void> => {
    await api.delete(`/phone-sms/contacts/${id}`)
  },

  importContacts: async (formData: FormData): Promise<{ data: { imported: number; skipped: number } }> => {
    const response = await api.post('/phone-sms/contacts/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    return response.data
  },

  exportContacts: async (): Promise<Blob> => {
    const response = await api.get('/phone-sms/contacts/export', {
      responseType: 'blob'
    })

    return response.data
  },

  // ==================== Contact Tags & Stats ====================
  getContactTags: async (): Promise<{ data: { tag: string; count: number }[] }> => {
    const response = await api.get('/phone-sms/contacts/tags')

    return response.data
  },

  createContactTag: async (tag: string, contactIds: number[]): Promise<{ data: { tag: string; updated: number } }> => {
    const response = await api.post('/phone-sms/contacts/tags', { tag, contact_ids: contactIds })

    return response.data
  },

  deleteContactTag: async (tag: string): Promise<{ data: { tag: string; removed: number } }> => {
    const response = await api.delete(`/phone-sms/contacts/tags/${encodeURIComponent(tag)}`)

    return response.data
  },

  getContactStats: async (): Promise<{
    data: {
      total_contacts: number
      opted_in: number
      opted_out: number
      tags: { tag: string; count: number }[]
      recent_30d: number
    }
  }> => {
    const response = await api.get('/phone-sms/contacts/stats')

    return response.data
  },

  // ==================== Campaigns ====================
  getCampaigns: async (params?: PaginationParams): Promise<PhoneSMSCampaignListResponse> => {
    const response = await api.get('/phone-sms/campaigns', { params })

    return response.data
  },

  getCampaign: async (
    id: number
  ): Promise<{
    data: {
      campaign: PhoneSMSCampaign
      status_breakdown: { status: string; count: number }[]
      network_breakdown: PhoneSMSNetworkBreakdown[]
      recipients: PhoneSMSCampaignRecipient[]
    }
  }> => {
    const response = await api.get(`/phone-sms/campaigns/${id}`)

    return response.data
  },

  createCampaign: async (data: {
    name: string
    message_text: string
    target_filter?: Record<string, any>
    scheduled_at?: string
  }): Promise<{ data: PhoneSMSCampaign }> => {
    const response = await api.post('/phone-sms/campaigns', data)

    return response.data
  },

  updateCampaign: async (id: number, data: Partial<PhoneSMSCampaign>): Promise<void> => {
    await api.put(`/phone-sms/campaigns/${id}`, data)
  },

  deleteCampaign: async (id: number): Promise<void> => {
    await api.delete(`/phone-sms/campaigns/${id}`)
  },

  sendCampaign: async (id: number): Promise<{ data: { status: string; total_targets: number } }> => {
    const response = await api.post(`/phone-sms/campaigns/${id}/send`)

    return response.data
  },

  testCampaign: async (
    id: number,
    phone: string
  ): Promise<{ data: { message_id: string; status: string; credits: number } }> => {
    const response = await api.post(`/phone-sms/campaigns/${id}/test`, { phone })

    return response.data
  },

  pauseCampaign: async (id: number): Promise<void> => {
    await api.post(`/phone-sms/campaigns/${id}/pause`)
  },

  resumeCampaign: async (id: number): Promise<void> => {
    await api.post(`/phone-sms/campaigns/${id}/resume`)
  },

  // ==================== Analytics ====================
  getOverview: async (): Promise<{ data: PhoneSMSOverviewStats }> => {
    const response = await api.get('/phone-sms/analytics/overview')

    return response.data
  },


  getCampaignAnalytics: async (
    id: number
  ): Promise<{
    data: {
      campaign: PhoneSMSCampaign
      status_breakdown: { status: string; count: number }[]
      network_breakdown: PhoneSMSNetworkBreakdown[]
      failed_messages: { phone: string; error_reason: string; failed_at: string }[]
    }
  }> => {
    const response = await api.get(`/phone-sms/analytics/campaigns/${id}`)

    return response.data
  },

  getAudienceCount: async (filter: Record<string, any>): Promise<{ data: { count: number } }> => {
    const response = await api.post('/phone-sms/campaigns/audience-count', filter)

    return response.data
  },

  // ==================== Contact Groups ====================
  getGroups: async (): Promise<{ data: PhoneSMSContactGroupWithCount[] }> => {
    const response = await api.get('/phone-sms/groups')

    return response.data
  },

  getGroup: async (id: number): Promise<{ data: { group: PhoneSMSContactGroup; member_count: number } }> => {
    const response = await api.get(`/phone-sms/groups/${id}`)

    return response.data
  },

  createGroup: async (data: {
    name: string
    description?: string
    color?: string
  }): Promise<{ data: PhoneSMSContactGroup }> => {
    const response = await api.post('/phone-sms/groups', data)

    return response.data
  },

  updateGroup: async (id: number, data: { name: string; description?: string; color?: string }): Promise<void> => {
    await api.put(`/phone-sms/groups/${id}`, data)
  },

  deleteGroup: async (id: number): Promise<void> => {
    await api.delete(`/phone-sms/groups/${id}`)
  },

  getGroupMembers: async (
    id: number,
    params?: { page?: number; per_page?: number; query?: string }
  ): Promise<{
    data: { results: PhoneSMSContact[]; total: number; page: number; per_page: number }
  }> => {
    const response = await api.get(`/phone-sms/groups/${id}/members`, { params })

    return response.data
  },

  addGroupMembers: async (id: number, contactIds: number[]): Promise<{ data: { added: number } }> => {
    const response = await api.post(`/phone-sms/groups/${id}/members`, { contact_ids: contactIds })

    return response.data
  },

  removeGroupMembers: async (id: number, contactIds: number[]): Promise<{ data: { removed: number } }> => {
    const response = await api.delete(`/phone-sms/groups/${id}/members`, { data: { contact_ids: contactIds } })

    return response.data
  }
}

export default phoneSmsService
