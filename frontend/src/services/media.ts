import api from './api'
import type { MediaItem, MediaListResponse } from '@/types/email'

export const mediaService = {
  getAll: async (): Promise<MediaListResponse> => {
    const response = await api.get('/media')

    return response.data
  },

  getById: async (id: number): Promise<{ data: MediaItem }> => {
    const response = await api.get(`/media/${id}`)

    return response.data
  },

  upload: async (file: File): Promise<{ data: MediaItem }> => {
    const formData = new FormData()

    formData.append('file', file)

    const response = await api.post('/media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/media/${id}`)
  }
}

export default mediaService
