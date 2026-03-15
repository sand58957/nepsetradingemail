import api from './api'
import type {
  TelegramSettings,
  TelegramContact,
  TelegramCampaign,
  TelegramCampaignRecipient,
  TelegramContactListResponse,
  TelegramCampaignListResponse,
  TelegramOverviewStats,
  TelegramContactGroup,
  TelegramContactGroupWithCount
} from '@/types/telegram'

export interface PaginationParams {
  page?: number
  per_page?: number
  query?: string
  tag?: string
  opted_in?: string
  status?: string
}

export const telegramService = {
  // ==================== Settings ====================
  getSettings: async (): Promise<{ data: { configured: boolean; settings?: TelegramSettings; bot_username?: string } }> => {
    const response = await api.get('/telegram/settings')
    return response.data
  },

  updateSettings: async (data: Partial<TelegramSettings>): Promise<void> => {
    await api.put('/telegram/settings', data)
  },

  testConnection: async (): Promise<{ data: { connected: boolean; bot_username?: string } }> => {
    const response = await api.post('/telegram/settings/test')
    return response.data
  },

  // ==================== Contacts ====================
  getContacts: async (params?: PaginationParams): Promise<TelegramContactListResponse> => {
    const response = await api.get('/telegram/contacts', { params })
    return response.data
  },

  getContact: async (id: number): Promise<{ data: TelegramContact }> => {
    const response = await api.get(`/telegram/contacts/${id}`)
    return response.data
  },

  createContact: async (data: Partial<TelegramContact> & { group_ids?: number[] }): Promise<{ data: TelegramContact }> => {
    const response = await api.post('/telegram/contacts', data)
    return response.data
  },

  updateContact: async (id: number, data: Partial<TelegramContact> & { group_ids?: number[] }): Promise<void> => {
    await api.put(`/telegram/contacts/${id}`, data)
  },

  getContactGroups: async (id: number): Promise<{ data: number[] }> => {
    const response = await api.get(`/telegram/contacts/${id}/groups`)
    return response.data
  },

  deleteContact: async (id: number): Promise<void> => {
    await api.delete(`/telegram/contacts/${id}`)
  },

  importContacts: async (formData: FormData): Promise<{ data: { imported: number; skipped: number } }> => {
    const response = await api.post('/telegram/contacts/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  },

  exportContacts: async (): Promise<Blob> => {
    const response = await api.get('/telegram/contacts/export', {
      responseType: 'blob'
    })
    return response.data
  },

  // ==================== Contact Tags & Stats ====================
  getContactTags: async (): Promise<{ data: { tag: string; count: number }[] }> => {
    const response = await api.get('/telegram/contacts/tags')
    return response.data
  },

  createContactTag: async (tag: string, contactIds: number[]): Promise<{ data: { tag: string; updated: number } }> => {
    const response = await api.post('/telegram/contacts/tags', { tag, contact_ids: contactIds })
    return response.data
  },

  deleteContactTag: async (tag: string): Promise<{ data: { tag: string; removed: number } }> => {
    const response = await api.delete(`/telegram/contacts/tags/${encodeURIComponent(tag)}`)
    return response.data
  },

  getContactStats: async (): Promise<{ data: {
    total_contacts: number
    opted_in: number
    opted_out: number
    tags: { tag: string; count: number }[]
    recent_30d: number
  } }> => {
    const response = await api.get('/telegram/contacts/stats')
    return response.data
  },

  // ==================== Campaigns ====================
  getCampaigns: async (params?: PaginationParams): Promise<TelegramCampaignListResponse> => {
    const response = await api.get('/telegram/campaigns', { params })
    return response.data
  },

  getCampaign: async (id: number): Promise<{ data: {
    campaign: TelegramCampaign
    status_breakdown: { status: string; count: number }[]
    recipients: TelegramCampaignRecipient[]
  } }> => {
    const response = await api.get(`/telegram/campaigns/${id}`)
    return response.data
  },

  createCampaign: async (data: {
    name: string
    message_text: string
    message_type?: string
    media_url?: string
    buttons?: { text: string; url: string }[]
    target_filter?: Record<string, any>
    scheduled_at?: string
  }): Promise<{ data: TelegramCampaign }> => {
    const response = await api.post('/telegram/campaigns', data)
    return response.data
  },

  updateCampaign: async (id: number, data: Partial<TelegramCampaign>): Promise<void> => {
    await api.put(`/telegram/campaigns/${id}`, data)
  },

  deleteCampaign: async (id: number): Promise<void> => {
    await api.delete(`/telegram/campaigns/${id}`)
  },

  sendCampaign: async (id: number): Promise<{ data: { status: string; total_targets: number } }> => {
    const response = await api.post(`/telegram/campaigns/${id}/send`)
    return response.data
  },

  testCampaign: async (id: number, chatId: number): Promise<{ data: { message_id: number; status: string } }> => {
    const response = await api.post(`/telegram/campaigns/${id}/test`, { chat_id: chatId })
    return response.data
  },

  pauseCampaign: async (id: number): Promise<void> => {
    await api.post(`/telegram/campaigns/${id}/pause`)
  },

  resumeCampaign: async (id: number): Promise<void> => {
    await api.post(`/telegram/campaigns/${id}/resume`)
  },

  // ==================== Analytics ====================
  getOverview: async (): Promise<{ data: TelegramOverviewStats }> => {
    const response = await api.get('/telegram/analytics/overview')
    return response.data
  },

  getCampaignAnalytics: async (id: number): Promise<{
    data: {
      campaign: TelegramCampaign
      status_breakdown: { status: string; count: number }[]
      failed_messages: { chat_id: number; username: string; error_reason: string; failed_at: string }[]
    }
  }> => {
    const response = await api.get(`/telegram/analytics/campaigns/${id}`)
    return response.data
  },

  getAudienceCount: async (filter: Record<string, any>): Promise<{ data: { count: number } }> => {
    const response = await api.post('/telegram/campaigns/audience-count', filter)
    return response.data
  },

  // ==================== Contact Groups ====================
  getGroups: async (): Promise<{ data: TelegramContactGroupWithCount[] }> => {
    const response = await api.get('/telegram/groups')
    return response.data
  },

  getGroup: async (id: number): Promise<{ data: { group: TelegramContactGroup; member_count: number } }> => {
    const response = await api.get(`/telegram/groups/${id}`)
    return response.data
  },

  createGroup: async (data: { name: string; description?: string; color?: string }): Promise<{ data: TelegramContactGroup }> => {
    const response = await api.post('/telegram/groups', data)
    return response.data
  },

  updateGroup: async (id: number, data: { name: string; description?: string; color?: string }): Promise<void> => {
    await api.put(`/telegram/groups/${id}`, data)
  },

  deleteGroup: async (id: number): Promise<void> => {
    await api.delete(`/telegram/groups/${id}`)
  },

  getGroupMembers: async (id: number, params?: { page?: number; per_page?: number; query?: string }): Promise<{
    data: { results: TelegramContact[]; total: number; page: number; per_page: number }
  }> => {
    const response = await api.get(`/telegram/groups/${id}/members`, { params })
    return response.data
  },

  addGroupMembers: async (id: number, contactIds: number[]): Promise<{ data: { added: number } }> => {
    const response = await api.post(`/telegram/groups/${id}/members`, { contact_ids: contactIds })
    return response.data
  },

  removeGroupMembers: async (id: number, contactIds: number[]): Promise<{ data: { removed: number } }> => {
    const response = await api.delete(`/telegram/groups/${id}/members`, { data: { contact_ids: contactIds } })
    return response.data
  }
}

export default telegramService
