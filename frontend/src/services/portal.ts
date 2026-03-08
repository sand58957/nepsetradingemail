import api from './api'

export const portalService = {
  // Subscriptions
  getSubscriptions: async () => {
    const response = await api.get('/subscriber/subscriptions')

    return response.data
  },

  updateSubscriptions: async (lists: number[]) => {
    const response = await api.put('/subscriber/subscriptions', { lists })

    return response.data
  },

  // Preferences
  getPreferences: async () => {
    const response = await api.get('/subscriber/preferences')

    return response.data
  },

  updatePreferences: async (preferences: Record<string, any>) => {
    const response = await api.put('/subscriber/preferences', preferences)

    return response.data
  },

  // Campaign Archive (public)
  getCampaignArchive: async (params?: { page?: number; per_page?: number }) => {
    const response = await api.get('/campaigns/archive', { params })

    return response.data
  },

  getCampaignArchiveDetail: async (id: number) => {
    const response = await api.get(`/campaigns/archive/${id}`)

    return response.data
  }
}
