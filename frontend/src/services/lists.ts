import api from './api'
import type { List, ListResponse, CreateListPayload } from '@/types/email'

export const listService = {
  getAll: async (params?: {
    page?: number
    per_page?: number
    query?: string
    order_by?: string
    order?: 'asc' | 'desc'
    minimal?: boolean
  }): Promise<ListResponse> => {
    const response = await api.get('/lists', { params })

    return response.data
  },

  getById: async (id: number): Promise<{ data: List }> => {
    const response = await api.get(`/lists/${id}`)

    return response.data
  },

  create: async (data: CreateListPayload): Promise<{ data: List }> => {
    const response = await api.post('/lists', data)

    return response.data
  },

  update: async (id: number, data: Partial<CreateListPayload>): Promise<{ data: List }> => {
    const response = await api.put(`/lists/${id}`, data)

    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/lists/${id}`)
  }
}

export default listService
