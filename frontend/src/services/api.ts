import axios from 'axios'
import { getSession, signOut } from 'next-auth/react'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://nepalfillings.com/api',
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
        // Token expired — clear cache
        cachedToken = null
        tokenFetchedAt = 0

        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          // Use sessionStorage to prevent redirect loops across page reloads
          const lastRedirect = sessionStorage.getItem('auth_redirect_ts')
          const now = Date.now()

          // Only redirect if we haven't redirected in the last 10 seconds
          if (!lastRedirect || now - parseInt(lastRedirect) > 10000) {
            sessionStorage.setItem('auth_redirect_ts', String(now))

            // Sign out NextAuth session so login page shows the form
            // instead of redirecting back (which causes the loop)
            const pathParts = window.location.pathname.split('/')
            const locale = pathParts[1] && pathParts[1].length === 2 ? pathParts[1] : 'en'

            signOut({ callbackUrl: `/${locale}/login`, redirect: true })
          }
        }
      }

      // 403 — let individual components handle permission errors gracefully
      // (e.g. admin viewing subscriber-only portal endpoints)
    }

    return Promise.reject(error)
  }
)

export const clearTokenCache = () => {
  cachedToken = null
  tokenFetchedAt = 0
  sessionStorage.removeItem('auth_redirect_ts')
}

export default api
