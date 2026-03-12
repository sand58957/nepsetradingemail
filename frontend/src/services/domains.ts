import api from './api'

import type { DomainRecord, DnsRecordsResponse, DomainVerificationResult } from '@/types/email'

export const domainService = {
  /** List all domains for the current account */
  list: async (): Promise<{ data: DomainRecord[] }> => {
    const response = await api.get('/domains')

    return response.data
  },

  /** Add a new sending or site domain (auto-generates DKIM keys + SendGrid auth) */
  create: async (
    domain: string,
    type: 'sending' | 'site' = 'sending',
    fromEmail?: string,
    fromName?: string
  ): Promise<{ data: DomainRecord }> => {
    const response = await api.post('/domains', { domain, type, from_email: fromEmail, from_name: fromName })

    return response.data
  },

  /** Delete a domain by ID */
  delete: async (id: number): Promise<any> => {
    const response = await api.delete(`/domains/${id}`)

    return response.data
  },

  /** Get the DNS records a user needs to add for a domain */
  getDnsRecords: async (id: number): Promise<{ data: DnsRecordsResponse }> => {
    const response = await api.get(`/domains/${id}/dns-records`)

    return response.data
  },

  /** Verify DNS records for a domain */
  verify: async (id: number): Promise<{ data: DomainVerificationResult }> => {
    const response = await api.post(`/domains/${id}/verify`)

    return response.data
  },

  /** Update sender email/name for a domain */
  updateSender: async (id: number, fromEmail: string, fromName: string): Promise<any> => {
    const response = await api.put(`/domains/${id}/sender`, { from_email: fromEmail, from_name: fromName })

    return response.data
  }
}

export default domainService
