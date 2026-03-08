import api from './api'

export interface User {
  id: number
  email: string
  name: string
  role: string
  is_active: boolean
  preferences: Record<string, any>
  created_at: string
  updated_at: string
}

export interface CreateUserPayload {
  email: string
  password: string
  name: string
  role: string
}

export interface UpdateUserPayload {
  name?: string
  email?: string
  is_active?: boolean
  password?: string
}

export interface UpdateRolePayload {
  role: string
}

export const userService = {
  list: async (params?: { role?: string; query?: string }): Promise<{ data: User[] }> => {
    const response = await api.get('/users', { params })

    return response.data
  },

  get: async (id: number): Promise<{ data: User }> => {
    const response = await api.get(`/users/${id}`)

    return response.data
  },

  create: async (data: CreateUserPayload): Promise<{ data: User }> => {
    const response = await api.post('/users', data)

    return response.data
  },

  update: async (id: number, data: UpdateUserPayload): Promise<{ data: User }> => {
    const response = await api.put(`/users/${id}`, data)

    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`)
  },

  updateRole: async (id: number, data: UpdateRolePayload): Promise<{ data: User }> => {
    const response = await api.put(`/users/${id}/role`, data)

    return response.data
  }
}
