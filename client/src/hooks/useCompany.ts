import { useEffect, useState } from 'react'

import { getMyFirstCompany } from '@/lib/deptApi'
import type { Company } from '@/lib/deptApi'

interface State {
  company: Company | null
  loading: boolean
  error: string | null
}

/**
 * Resolves the authenticated user's first linked company. All Phase 5/6 pages
 * use this to avoid forcing the user to pick a company on every page.
 */
export function useCompany(): State & { reload: () => void } {
  const [state, setState] = useState<State>({ company: null, loading: true, error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancel = false
    setState((s) => ({ ...s, loading: true, error: null }))
    getMyFirstCompany()
      .then(({ company }) => {
        if (cancel) return
        if (!company) {
          setState({ company: null, loading: false, error: 'No company linked yet — complete the diagnostic first.' })
        } else {
          setState({ company, loading: false, error: null })
        }
      })
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not load company'
        if (!cancel) setState({ company: null, loading: false, error: msg })
      })
    return () => {
      cancel = true
    }
  }, [version])

  return { ...state, reload: () => setVersion((v) => v + 1) }
}
