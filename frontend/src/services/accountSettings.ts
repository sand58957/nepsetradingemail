import api from './api'

import type {
  AccountSettings,
  CompanyProfile,
  BrandDefaults,
  DomainsConfig,
  EcommerceConfig,
  LinkTrackingConfig
} from '@/types/email'

export const accountSettingsService = {
  getAll: async (): Promise<{ data: AccountSettings }> => {
    const response = await api.get('/account-settings')

    return response.data
  },

  getByKey: async (key: string): Promise<{ data: { value: any } }> => {
    const response = await api.get(`/account-settings/${key}`)

    return response.data
  },

  updateCompanyProfile: async (value: CompanyProfile): Promise<any> => {
    const response = await api.put('/account-settings/company_profile', { value })

    return response.data
  },

  updateBrandDefaults: async (value: BrandDefaults): Promise<any> => {
    const response = await api.put('/account-settings/brand_defaults', { value })

    return response.data
  },

  updateDomains: async (value: DomainsConfig): Promise<any> => {
    const response = await api.put('/account-settings/domains', { value })

    return response.data
  },

  updateEcommerce: async (value: EcommerceConfig): Promise<any> => {
    const response = await api.put('/account-settings/ecommerce', { value })

    return response.data
  },

  updateLinkTracking: async (value: LinkTrackingConfig): Promise<any> => {
    const response = await api.put('/account-settings/link_tracking', { value })

    return response.data
  },

  verifyDomain: async (domain: string): Promise<any> => {
    const response = await api.post('/account-settings/domains/verify', { domain })

    return response.data
  },

  uploadLogo: async (file: File): Promise<{ data: { url: string } }> => {
    const formData = new FormData()

    formData.append('file', file)

    const response = await api.post('/account-settings/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    return response.data
  }
}

export default accountSettingsService
