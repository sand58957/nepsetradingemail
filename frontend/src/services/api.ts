import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor: attach JWT token
api.interceptors.request.use(
  config => {
    // Try to read token from localStorage first, then from cookie
    let token: string | null = null

    if (typeof window !== 'undefined') {
      token = localStorage.getItem('jwt_token')

      if (!token) {
        // Fallback: read from cookie
        const cookies = document.cookie.split(';')
        const tokenCookie = cookies.find(c => c.trim().startsWith('jwt_token='))

        if (tokenCookie) {
          token = tokenCookie.split('=')[1]
        }
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
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
        // Token expired or invalid — clear and redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('jwt_token')
          document.cookie = 'jwt_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
          window.location.href = '/login'
        }
      } else if (status === 403) {
        // Insufficient permissions — redirect to not authorized page
        if (typeof window !== 'undefined') {
          window.location.href = '/pages/misc/401-not-authorized'
        }
      }
    }

    return Promise.reject(error)
  }
)

export default api
