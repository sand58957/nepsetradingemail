import api from './api'
import type {
  WASettings,
  WAContact,
  WATemplate,
  WACampaign,
  WACampaignRecipient,
  WAContactListResponse,
  WACampaignListResponse,
  WAOverviewStats
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
  getSettings: async (): Promise<{ data: { configured: boolean; settings?: WASettings } }> => {
    const response = await api.get('/whatsapp/settings')
    return response.data
  },

  updateSettings: async (data: Partial<WASettings>): Promise<void> => {
    await api.put('/whatsapp/settings', data)
  },

  testConnection: async (): Promise<{ data: { connected: boolean; balance: string } }> => {
    const response = await api.post('/whatsapp/settings/test')
    return response.data
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

  createContact: async (data: Partial<WAContact>): Promise<{ data: WAContact }> => {
    const response = await api.post('/whatsapp/contacts', data)
    return response.data
  },

  updateContact: async (id: number, data: Partial<WAContact>): Promise<void> => {
    await api.put(`/whatsapp/contacts/${id}`, data)
  },

  deleteContact: async (id: number): Promise<void> => {
    await api.delete(`/whatsapp/contacts/${id}`)
  },

  importContacts: async (formData: FormData): Promise<{ data: { imported: number; skipped: number } }> => {
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

  getCampaign: async (id: number): Promise<{ data: { campaign: WACampaign; status_breakdown: any[]; recipients: WACampaignRecipient[] } }> => {
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

  sendCampaign: async (id: number): Promise<{ data: { status: string; total_targets: number } }> => {
    const response = await api.post(`/whatsapp/campaigns/${id}/send`)
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

  getCampaignAnalytics: async (id: number): Promise<{
    data: {
      campaign: WACampaign
      status_breakdown: { status: string; count: number }[]
      failed_messages: { phone: string; error_reason: string; failed_at: string }[]
    }
  }> => {
    const response = await api.get(`/whatsapp/analytics/campaigns/${id}`)
    return response.data
  }
}

export default whatsappService
