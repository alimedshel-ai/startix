import axios, { AxiosError } from 'axios'

const FALLBACK_BASE = 'http://localhost:5001'
const baseURL = import.meta.env.VITE_API_URL || FALLBACK_BASE

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

if (import.meta.env.DEV) {
  console.info(`[startix] API base URL: ${baseURL}`)
}

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
  async (error: AxiosError) => {
    const original = error.config as ((typeof error)['config'] & { _retry?: boolean }) | undefined
    const status = error.response?.status
    const url: string = original?.url ?? ''
    const isAuthRoute = url.includes('/api/auth/refresh') || url.includes('/api/auth/login')

    if (status === 401 && original && !original._retry && !isAuthRoute) {
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

interface ApiErrorBody {
  error?: string
  issues?: { message: string }[]
  details?: {
    requiredPlan?: 'PROFESSIONAL' | 'ENTERPRISE'
    currentPlan?: 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'
    upgradeUrl?: string
  }
}

/**
 * Pull a user-friendly message off an axios error. Distinguishes network
 * failures (CORS / server down) from API-level errors so the UI can show
 * the real cause instead of a generic "failed" toast.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as AxiosError<ApiErrorBody>
  if (!e?.response && e?.message) {
    if (e.code === 'ERR_NETWORK') {
      return `تعذّر الاتصال بالخادم على ${baseURL}. تأكد أن السيرفر يعمل ثم أعد المحاولة.`
    }
    return `${fallback} (${e.message})`
  }
  const data = e?.response?.data
  if (data?.error) return data.error
  if (data?.issues?.length) return data.issues.map((i) => i.message).join('، ')
  return fallback
}

/**
 * Returns plan-upgrade details if the response is a 402 from the planGuard
 * middleware. Pages can use this to surface an "Upgrade" CTA instead of a
 * plain error toast.
 */
export function planUpgradeFromError(err: unknown): { requiredPlan: string; currentPlan: string; upgradeUrl: string } | null {
  const e = err as AxiosError<ApiErrorBody>
  if (e?.response?.status !== 402) return null
  const d = e.response.data?.details
  if (!d?.requiredPlan) return null
  return {
    requiredPlan: d.requiredPlan,
    currentPlan: d.currentPlan ?? 'BASIC',
    upgradeUrl: d.upgradeUrl ?? '/pricing',
  }
}
