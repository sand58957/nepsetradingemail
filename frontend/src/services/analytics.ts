import api from './api'

// Types matching Go backend AnalyticsOverview struct (analytics.go)
export interface SubscriberAnalytics {
  total: number
  active: number
  blocklisted: number
  unsubscribed: number
}

export interface CampaignAnalytics {
  total: number
  sent: number
  running: number
  draft: number
  details?: any[]
}

export interface ListAnalytics {
  total: number
  details?: Array<{
    id: number
    name: string
    type: string
    optin: string
    subscriber_count: number
    created_at: string
    updated_at: string
  }>
}

export interface PerformanceAnalytics {
  total_sent: number
  total_opens: number
  total_clicks: number
  avg_open_rate: number
  avg_click_rate: number
  bounce_rate: number
}

export interface AnalyticsOverview {
  subscribers: SubscriberAnalytics
  campaigns: CampaignAnalytics
  lists: ListAnalytics
  performance: PerformanceAnalytics
}

export const analyticsService = {
  getOverview: async (): Promise<{ success: boolean; data: AnalyticsOverview }> => {
    const response = await api.get('/analytics/overview')

    return response.data
  },

  getListAnalytics: async (): Promise<any> => {
    const response = await api.get('/analytics/lists')

    return response.data
  },

  getCampaignAnalytics: async (id: number): Promise<any> => {
    const response = await api.get(`/analytics/campaigns/${id}`)

    return response.data
  }
}

export default analyticsService
