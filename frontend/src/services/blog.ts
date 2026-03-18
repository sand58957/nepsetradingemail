import api from './api'
import type {
  BlogPost,
  BlogCategory,
  BlogTag,
  BlogAuthor,
  BlogPostFAQ,
  BlogSettings,
  BlogDashboardStats,
  BlogPostDetail,
  CreatePostRequest
} from '@/types/blog'

export interface BlogPaginationParams {
  page?: number
  per_page?: number
  status?: string
  category_id?: number
  author_id?: number
  search?: string
}

export const blogService = {
  // ==================== Dashboard ====================
  getDashboardStats: async (): Promise<{ data: BlogDashboardStats }> => {
    const response = await api.get('/blog/stats')
    return response.data
  },

  // ==================== Posts ====================
  listPosts: async (params?: BlogPaginationParams): Promise<{ data: BlogPost[]; total: number; page: number; per_page: number }> => {
    const response = await api.get('/blog/posts', { params })
    return response.data
  },

  getPost: async (id: number): Promise<{ data: BlogPostDetail }> => {
    const response = await api.get(`/blog/posts/${id}`)
    return response.data
  },

  createPost: async (data: CreatePostRequest): Promise<{ data: BlogPost }> => {
    const response = await api.post('/blog/posts', data)
    return response.data
  },

  updatePost: async (id: number, data: CreatePostRequest): Promise<{ data: BlogPost }> => {
    const response = await api.put(`/blog/posts/${id}`, data)
    return response.data
  },

  deletePost: async (id: number): Promise<void> => {
    await api.delete(`/blog/posts/${id}`)
  },

  publishPost: async (id: number): Promise<{ data: BlogPost }> => {
    const response = await api.post(`/blog/posts/${id}/publish`)
    return response.data
  },

  unpublishPost: async (id: number): Promise<{ data: BlogPost }> => {
    const response = await api.post(`/blog/posts/${id}/unpublish`)
    return response.data
  },

  // ==================== FAQs ====================
  listPostFAQs: async (postId: number): Promise<{ data: BlogPostFAQ[] }> => {
    const response = await api.get(`/blog/posts/${postId}/faqs`)
    return response.data
  },

  createPostFAQ: async (postId: number, data: { question: string; answer: string; sort_order?: number }): Promise<{ data: BlogPostFAQ }> => {
    const response = await api.post(`/blog/posts/${postId}/faqs`, data)
    return response.data
  },

  updatePostFAQ: async (postId: number, faqId: number, data: { question: string; answer: string; sort_order?: number }): Promise<{ data: BlogPostFAQ }> => {
    const response = await api.put(`/blog/posts/${postId}/faqs/${faqId}`, data)
    return response.data
  },

  deletePostFAQ: async (postId: number, faqId: number): Promise<void> => {
    await api.delete(`/blog/posts/${postId}/faqs/${faqId}`)
  },

  // ==================== Categories ====================
  listCategories: async (): Promise<{ data: BlogCategory[] }> => {
    const response = await api.get('/blog/categories')
    return response.data
  },

  createCategory: async (data: { name: string; description?: string; parent_id?: number | null; sort_order?: number }): Promise<{ data: BlogCategory }> => {
    const response = await api.post('/blog/categories', data)
    return response.data
  },

  updateCategory: async (id: number, data: { name: string; description?: string; parent_id?: number | null; sort_order?: number }): Promise<{ data: BlogCategory }> => {
    const response = await api.put(`/blog/categories/${id}`, data)
    return response.data
  },

  deleteCategory: async (id: number): Promise<void> => {
    await api.delete(`/blog/categories/${id}`)
  },

  // ==================== Tags ====================
  listTags: async (): Promise<{ data: BlogTag[] }> => {
    const response = await api.get('/blog/tags')
    return response.data
  },

  createTag: async (name: string): Promise<{ data: BlogTag }> => {
    const response = await api.post('/blog/tags', { name })
    return response.data
  },

  deleteTag: async (id: number): Promise<void> => {
    await api.delete(`/blog/tags/${id}`)
  },

  // ==================== Authors ====================
  listAuthors: async (): Promise<{ data: BlogAuthor[] }> => {
    const response = await api.get('/blog/authors')
    return response.data
  },

  getAuthor: async (id: number): Promise<{ data: BlogAuthor }> => {
    const response = await api.get(`/blog/authors/${id}`)
    return response.data
  },

  createAuthor: async (data: Partial<BlogAuthor>): Promise<{ data: BlogAuthor }> => {
    const response = await api.post('/blog/authors', data)
    return response.data
  },

  updateAuthor: async (id: number, data: Partial<BlogAuthor>): Promise<{ data: BlogAuthor }> => {
    const response = await api.put(`/blog/authors/${id}`, data)
    return response.data
  },

  deleteAuthor: async (id: number): Promise<void> => {
    await api.delete(`/blog/authors/${id}`)
  },

  // ==================== Settings ====================
  getSettings: async (): Promise<{ data: BlogSettings }> => {
    const response = await api.get('/blog/settings')
    return response.data
  },

  updateSettings: async (data: Partial<BlogSettings>): Promise<{ data: BlogSettings }> => {
    const response = await api.put('/blog/settings', data)
    return response.data
  }
}
