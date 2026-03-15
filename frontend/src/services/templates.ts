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
  },

  // SendGrid Import
  listSendGrid: async (): Promise<{ data: any[] }> => {
    const response = await api.get('/templates/sendgrid')

    return response.data
  },

  importSendGrid: async (templateIds?: string[]): Promise<{
    data: { imported: number; skipped: number; errors: string[]; total: number }
  }> => {
    const response = await api.post('/templates/sendgrid/import', templateIds ? { template_ids: templateIds } : {})

    return response.data
  },

  // Upload a single image file to Listmonk media storage, returns hosted URL
  uploadMedia: async (file: File): Promise<{ data: { url: string; filename: string } }> => {
    const formData = new FormData()

    formData.append('file', file)

    const response = await api.post('/templates/upload-media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000
    })

    return response.data
  }
}

export default templateService
