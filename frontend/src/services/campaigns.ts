import api from './api'
import type {
  Campaign,
  CampaignListResponse,
  CreateCampaignPayload,
  UpdateCampaignPayload,
  PaginationParams
} from '@/types/email'

export const campaignService = {
  getAll: async (params?: PaginationParams): Promise<CampaignListResponse> => {
    const response = await api.get('/campaigns', { params })

    return response.data
  },

  getById: async (id: number): Promise<{ data: Campaign }> => {
    const response = await api.get(`/campaigns/${id}`)

    return response.data
  },

  create: async (data: CreateCampaignPayload): Promise<{ data: Campaign }> => {
    const response = await api.post('/campaigns', data)

    return response.data
  },

  update: async (id: number, data: UpdateCampaignPayload): Promise<{ data: Campaign }> => {
    const response = await api.put(`/campaigns/${id}`, data)

    return response.data
  },

  updateStatus: async (id: number, status: string): Promise<{ data: Campaign }> => {
    const response = await api.put(`/campaigns/${id}/status`, { status })

    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/campaigns/${id}`)
  },

  preview: async (id: number): Promise<{ data: string }> => {
    const response = await api.get(`/campaigns/${id}/preview`)

    return response.data
  },

  getStats: async (id: number): Promise<{
    data: {
      campaign: Campaign
      views: number
      clicks: number
      bounces: number
      sent: number
    }
  }> => {
    const response = await api.get(`/campaigns/${id}/stats`)

    return response.data
  },

  test: async (id: number, emails: string[]): Promise<void> => {
    await api.post(`/campaigns/${id}/test`, { subscribers: emails })
  }
}

export default campaignService
