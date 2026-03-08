import api from './api'
import type { DashboardStats } from '@/types/email'

export const dashboardService = {
  getStats: async (): Promise<{ data: DashboardStats }> => {
    const response = await api.get('/dashboard/stats')

    return response.data
  }
}

export default dashboardService
