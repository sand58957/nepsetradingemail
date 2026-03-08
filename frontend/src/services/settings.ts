import api from './api'
import type { AppSettings, SMTPSettings } from '@/types/email'

export const settingsService = {
  getAll: async (): Promise<{ data: AppSettings }> => {
    const response = await api.get('/settings')

    return response.data
  },

  update: async (settings: Partial<AppSettings>): Promise<{ data: AppSettings }> => {
    const response = await api.put('/settings', settings)

    return response.data
  },

  testSMTP: async (smtp: SMTPSettings): Promise<{ data: { success: boolean; message: string } }> => {
    const response = await api.post('/settings/smtp/test', smtp)

    return response.data
  },

  getServerInfo: async (): Promise<{
    data: {
      version: string
      go_version: string
      db: string
      message_count: number
    }
  }> => {
    const response = await api.get('/health')

    return response.data
  }
}

export default settingsService
