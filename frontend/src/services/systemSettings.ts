import api from './api'

export interface SendGridStatus {
  masked_key: string
  has_key: boolean
  source: 'database' | 'env' | 'unset'
  updated_by: string
  updated_at: string
}

export const systemSettingsService = {
  getSendGrid: async (): Promise<SendGridStatus> => {
    const res = await api.get('/system/sendgrid')

    return res.data.data
  },

  testSendGrid: async (apiKey: string): Promise<{ valid: boolean; message: string }> => {
    const res = await api.post('/system/sendgrid/test', { api_key: apiKey })

    return res.data.data
  },

  updateSendGrid: async (apiKey: string, skipValidation = false): Promise<SendGridStatus> => {
    const res = await api.put('/system/sendgrid', { api_key: apiKey, skip_validation: skipValidation })

    return res.data.data
  }
}

export default systemSettingsService
