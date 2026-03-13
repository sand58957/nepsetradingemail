import api from './api'
import type {
  Subscriber,
  SubscriberListResponse,
  CreateSubscriberPayload,
  UpdateSubscriberPayload,
  PaginationParams
} from '@/types/email'

export const subscriberService = {
  getAll: async (params?: PaginationParams): Promise<SubscriberListResponse> => {
    const response = await api.get('/subscribers', { params })

    return response.data
  },

  getById: async (id: number): Promise<{ data: Subscriber }> => {
    const response = await api.get(`/subscribers/${id}`)

    return response.data
  },

  create: async (data: CreateSubscriberPayload): Promise<{ data: Subscriber }> => {
    const response = await api.post('/subscribers', data)

    return response.data
  },

  update: async (id: number, data: UpdateSubscriberPayload): Promise<{ data: Subscriber }> => {
    const response = await api.put(`/subscribers/${id}`, data)

    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/subscribers/${id}`)
  },

  deleteMany: async (ids: number[]): Promise<void> => {
    await api.delete('/subscribers', { data: { ids } })
  },

  deleteAll: async (): Promise<{ data: { message: string; deleted: number } }> => {
    const response = await api.delete('/subscribers')

    return response.data
  },

  manageListsByQuery: async (params: {
    action: 'add' | 'remove' | 'unsubscribe'
    target_list_ids: number[]
    query: string
  }): Promise<void> => {
    await api.put('/subscribers/lists', params)
  },

  blocklistByQuery: async (query: string): Promise<void> => {
    await api.put('/subscribers/blocklist', { query })
  },

  export: async (params?: { list_id?: number }): Promise<Blob> => {
    const response = await api.get('/subscribers/export', {
      params,
      responseType: 'blob'
    })

    return response.data
  }
}

export default subscriberService
