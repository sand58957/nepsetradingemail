import api from './api'
import type { Template, TemplateListResponse, CreateTemplatePayload, UpdateTemplatePayload } from '@/types/email'

export const templateService = {
  getAll: async (): Promise<TemplateListResponse> => {
    const response = await api.get('/templates')

    return response.data
  },

  getById: async (id: number): Promise<{ data: Template }> => {
    const response = await api.get(`/templates/${id}`)

    return response.data
  },

  create: async (data: CreateTemplatePayload): Promise<{ data: Template }> => {
    const response = await api.post('/templates', data)

    return response.data
  },

  update: async (id: number, data: UpdateTemplatePayload): Promise<{ data: Template }> => {
    const response = await api.put(`/templates/${id}`, data)

    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/templates/${id}`)
  },

  preview: async (id: number): Promise<{ data: string }> => {
    const response = await api.get(`/templates/${id}/preview`)

    return response.data
  },

  setDefault: async (id: number): Promise<void> => {
    await api.put(`/templates/${id}/default`)
  }
}

export default templateService
