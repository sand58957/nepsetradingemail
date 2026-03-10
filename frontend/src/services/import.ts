import api from './api'

import type {
  ImportHistoryListResponse,
  ImportHistoryRecord,
  ListmonkImportStatus,
  ImportWebhook,
  ImportAnalytics,
  APIImportPayload,
  APIImportResult,
  SuppressionListResponse
} from '@/types/email'

export const importService = {
  // CSV Import
  importCSV: async (
    file: File,
    params: Record<string, any>
  ): Promise<any> => {
    const formData = new FormData()

    formData.append('file', file)
    formData.append('params', JSON.stringify(params))

    const response = await api.post('/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    return response.data
  },

  // Import Status (from Listmonk)
  getImportStatus: async (): Promise<ListmonkImportStatus> => {
    const response = await api.get('/import/status')

    return response.data
  },

  // Import Logs (from Listmonk)
  getImportLogs: async (): Promise<any> => {
    const response = await api.get('/import/logs')

    return response.data
  },

  // Cancel Import
  cancelImport: async (): Promise<void> => {
    await api.delete('/import/cancel')
  },

  // JSON/API Import
  importJSON: async (data: APIImportPayload): Promise<APIImportResult> => {
    const response = await api.post('/import/json', data)

    return response.data
  },

  // Import History
  getHistory: async (params?: {
    page?: number
    per_page?: number
    source?: string
    status?: string
  }): Promise<ImportHistoryListResponse> => {
    const response = await api.get('/import/history', { params })

    return response.data
  },

  getHistoryById: async (id: number): Promise<{ data: ImportHistoryRecord }> => {
    const response = await api.get(`/import/history/${id}`)

    return response.data
  },

  deleteHistory: async (id: number): Promise<void> => {
    await api.delete(`/import/history/${id}`)
  },

  updateHistory: async (data: {
    id: number
    status: string
    total: number
    successful: number
    failed: number
    skipped: number
  }): Promise<void> => {
    await api.put('/import/history', data)
  },

  // Analytics
  getAnalytics: async (): Promise<{ data: ImportAnalytics }> => {
    const response = await api.get('/import/analytics')

    return response.data
  },

  // Webhooks
  getWebhooks: async (): Promise<{ data: ImportWebhook[] }> => {
    const response = await api.get('/import/webhooks')

    return response.data
  },

  createWebhook: async (data: {
    name: string
    list_ids: number[]
  }): Promise<{ data: ImportWebhook }> => {
    const response = await api.post('/import/webhooks', data)

    return response.data
  },

  updateWebhook: async (
    id: number,
    data: { name?: string; list_ids?: number[]; is_active?: boolean }
  ): Promise<{ data: ImportWebhook }> => {
    const response = await api.put(`/import/webhooks/${id}`, data)

    return response.data
  },

  deleteWebhook: async (id: number): Promise<void> => {
    await api.delete(`/import/webhooks/${id}`)
  },

  // Suppression List
  getSuppressed: async (params?: {
    page?: number
    per_page?: number
  }): Promise<SuppressionListResponse> => {
    const response = await api.get('/import/suppression', { params })

    return response.data
  },

  addSuppressed: async (data: {
    emails: string[]
    reason?: string
  }): Promise<any> => {
    const response = await api.post('/import/suppression', data)

    return response.data
  },

  removeSuppressed: async (id: number): Promise<void> => {
    await api.delete(`/import/suppression/${id}`)
  }
}

export default importService
