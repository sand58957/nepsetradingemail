import api from './api'

export interface Account {
  id: number
  name: string
  logo_url: string
  plan: string
  domain: string
  created_at: string
  updated_at: string
  member_role?: string
}

export interface AccountResponse {
  access_token: string
  refresh_token: string
  user: any
  account: Account
}

const accountsService = {
  list: () => api.get<{ success: boolean; data: Account[] }>('/accounts'),

  create: (name: string) =>
    api.post<{ success: boolean; data: AccountResponse }>('/accounts', { name }),

  get: (id: number) => api.get<{ success: boolean; data: Account }>(`/accounts/${id}`),

  update: (id: number, data: { name?: string; logo_url?: string; domain?: string }) =>
    api.put<{ success: boolean; data: Account }>(`/accounts/${id}`, data),

  switch: (accountId: number) =>
    api.post<{ success: boolean; data: AccountResponse }>('/accounts/switch', { account_id: accountId }),

  delete: (id: number) =>
    api.delete<{ success: boolean; data: { message: string; next_account_id: number | null } }>(`/accounts/${id}`)
}

export default accountsService
