import axios from 'axios'
import { getSession } from 'next-auth/react'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Cache the session token to avoid calling getSession() on every request
let cachedToken: string | null = null
let tokenFetchedAt = 0
const TOKEN_CACHE_MS = 5 * 60 * 1000 // Cache token for 5 minutes

const getToken = async (): Promise<string | null> => {
  const now = Date.now()

  if (cachedToken && now - tokenFetchedAt < TOKEN_CACHE_MS) {
    return cachedToken
  }

  const session = await getSession()

  if (session?.accessToken) {
    cachedToken = session.accessToken as string
    tokenFetchedAt = now

    return cachedToken
  }

  cachedToken = null

  return null
}

// Request interceptor: attach JWT token from NextAuth session
api.interceptors.request.use(
  async config => {
    if (typeof window !== 'undefined') {
      const token = await getToken()

      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }

    return config
  },
  error => Promise.reject(error)
)

// Response interceptor: handle errors globally
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      const { status } = error.response

      if (status === 401) {
        // Token expired — clear cache and redirect to login
        cachedToken = null
        tokenFetchedAt = 0

        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      } else if (status === 403) {
        if (typeof window !== 'undefined') {
          window.location.href = '/pages/misc/401-not-authorized'
        }
      }
    }

    return Promise.reject(error)
  }
)

export default api
