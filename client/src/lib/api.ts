import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

let refreshPromise: Promise<void> | null = null

async function refreshAccessToken(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/api/auth/refresh', {})
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status = error.response?.status
    const url: string = original?.url ?? ''
    const isAuthRoute = url.includes('/api/auth/refresh') || url.includes('/api/auth/login')

    if (status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true
      try {
        await refreshAccessToken()
        return api(original)
      } catch {
        // fall through to reject
      }
    }
    return Promise.reject(error)
  }
)
