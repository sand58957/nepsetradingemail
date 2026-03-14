import api from './api'
import type {
  CreditBalance,
  CreditTransaction,
  AdminCreditEntry,
  AdminAdjustRequest
} from '@/types/api'

export const creditService = {
  // User-facing
  getMyCredits: async (): Promise<{ data: CreditBalance[] }> => {
    const response = await api.get('/api-credits')
    return response.data
  },

  getMyTransactions: async (channel?: string, page?: number): Promise<{ data: CreditTransaction[]; total: number; page: number; per_page: number }> => {
    const params: Record<string, string | number> = {}
    if (channel) params.channel = channel
    if (page) params.page = page
    const response = await api.get('/api-credits/transactions', { params })
    return response.data
  },

  // Admin
  adminListCredits: async (): Promise<{ data: AdminCreditEntry[] }> => {
    const response = await api.get('/admin/api-credits')
    return response.data
  },

  adminGetAccountCredits: async (accountId: number): Promise<{ data: { account_id: number; account_name: string; credits: CreditBalance[] } }> => {
    const response = await api.get(`/admin/api-credits/${accountId}`)
    return response.data
  },

  adminAdjustCredits: async (accountId: number, data: AdminAdjustRequest): Promise<{ data: { account_id: number; channel: string; amount: number; new_balance: number } }> => {
    const response = await api.post(`/admin/api-credits/${accountId}/adjust`, data)
    return response.data
  },

  adminToggleAPI: async (accountId: number): Promise<{ data: { account_id: number; api_enabled: boolean } }> => {
    const response = await api.post(`/admin/api-credits/${accountId}/toggle-api`)
    return response.data
  },

  adminListTransactions: async (params?: { channel?: string; account_id?: number; page?: number }): Promise<{ data: CreditTransaction[]; total: number; page: number; per_page: number }> => {
    const response = await api.get('/admin/api-credits/transactions', { params })
    return response.data
  },

  adminListMessages: async (params?: { channel?: string; account_id?: number; page?: number }): Promise<{ data: any[]; total: number; page: number; per_page: number }> => {
    const response = await api.get('/admin/api-credits/messages', { params })
    return response.data
  }
}
