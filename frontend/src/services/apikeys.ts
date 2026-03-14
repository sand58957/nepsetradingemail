import api from './api'
import type { APIKey, APIKeyCreateRequest, APIKeyCreateResponse, APIKeyUpdateRequest } from '@/types/api'

export const apiKeyService = {
  list: async (channel?: string): Promise<{ data: APIKey[] }> => {
    const params = channel ? { channel } : {}
    const response = await api.get('/api-keys', { params })
    return response.data
  },

  create: async (data: APIKeyCreateRequest): Promise<{ data: APIKeyCreateResponse }> => {
    const response = await api.post('/api-keys', data)
    return response.data
  },

  update: async (id: number, data: APIKeyUpdateRequest): Promise<void> => {
    await api.put(`/api-keys/${id}`, data)
  },

  toggle: async (id: number): Promise<void> => {
    await api.put(`/api-keys/${id}/toggle`)
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api-keys/${id}`)
  }
}
