import api from './api'

import type {
  MediaItem,
  MediaListResponse,
  MediaFolder,
  MediaFolderListResponse,
  CreateMediaFolderRequest,
  ImportFromURLRequest
} from '@/types/email'

export const mediaService = {
  // Media CRUD
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
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/media/${id}`)
  },

  uploadFromURL: async (req: ImportFromURLRequest): Promise<{ data: MediaItem }> => {
    const response = await api.post('/media/upload-from-url', req)

    return response.data
  },

  // Folder operations
  listFolders: async (): Promise<MediaFolderListResponse> => {
    const response = await api.get('/media-folders')

    return response.data
  },

  createFolder: async (req: CreateMediaFolderRequest): Promise<{ data: MediaFolder }> => {
    const response = await api.post('/media-folders', req)

    return response.data
  },

  updateFolder: async (id: number, req: CreateMediaFolderRequest): Promise<{ data: MediaFolder }> => {
    const response = await api.put(`/media-folders/${id}`, req)

    return response.data
  },

  deleteFolder: async (id: number): Promise<void> => {
    await api.delete(`/media-folders/${id}`)
  },

  getFolderItems: async (id: number): Promise<{ success: boolean; data: number[] }> => {
    const response = await api.get(`/media-folders/${id}/items`)

    return response.data
  },

  addToFolder: async (folderId: number, mediaIds: number[]): Promise<void> => {
    await api.post(`/media-folders/${folderId}/items`, { media_ids: mediaIds })
  },

  removeFromFolder: async (folderId: number, mediaId: number): Promise<void> => {
    await api.delete(`/media-folders/${folderId}/items/${mediaId}`)
  }
}

export default mediaService
