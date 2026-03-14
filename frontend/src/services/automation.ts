import api from './api'

export interface AutomationData {
  id: number
  name: string
  description: string
  trigger_type: string
  trigger_config: Record<string, any>
  is_active: boolean
  steps: AutomationStepData[]
  created_at: string
  updated_at: string
}

export interface AutomationStepData {
  id: number
  automation_id: number
  step_order: number
  step_type: string // 'send_email' | 'wait' | 'condition'
  config: Record<string, any>
  delay_minutes: number
  created_at: string
}

export interface AutomationLogData {
  id: number
  automation_id: number
  step_id: number | null
  subscriber_id: number | null
  status: string
  details: Record<string, any>
  created_at: string
}

export interface CreateAutomationPayload {
  name: string
  description?: string
  trigger_type: string
  trigger_config?: Record<string, any>
  steps?: {
    step_order: number
    step_type: string
    config?: Record<string, any>
    delay_minutes?: number
  }[]
}

export interface UpdateAutomationPayload extends CreateAutomationPayload {
  is_active?: boolean
}

const automationService = {
  getAll: async (params?: { page?: number; per_page?: number }) => {
    const response = await api.get('/automations', { params })
    return response.data
  },

  getById: async (id: number) => {
    const response = await api.get(`/automations/${id}`)
    return response.data
  },

  create: async (data: CreateAutomationPayload) => {
    const response = await api.post('/automations', data)
    return response.data
  },

  update: async (id: number, data: UpdateAutomationPayload) => {
    const response = await api.put(`/automations/${id}`, data)
    return response.data
  },

  delete: async (id: number) => {
    const response = await api.delete(`/automations/${id}`)
    return response.data
  },

  toggleStatus: async (id: number) => {
    const response = await api.put(`/automations/${id}/toggle`)
    return response.data
  },

  getLogs: async (id: number, params?: { page?: number; per_page?: number }) => {
    const response = await api.get(`/automations/${id}/logs`, { params })
    return response.data
  }
}

export default automationService
