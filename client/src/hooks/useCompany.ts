import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getMyFirstCompany, listMyCompanies } from '@/lib/deptApi'
import type { Company } from '@/lib/deptApi'

interface State {
  company: Company | null
  loading: boolean
  error: string | null
}

/**
 * Resolves the "active" company for any strategic-lifecycle page.
 *
 * Priority order:
 *   1. `?client=<companyId>` search param — used by the INDEPENDENT_PRO
 *      flow so a single tool can operate on any client company the pro is
 *      linked to. Validated against listMyCompanies() so a manipulated
 *      URL cannot expose a stranger's company.
 *   2. getMyFirstCompany() — the historical fallback, still correct for
 *      the OWNER (single company) and INTERNAL manager cases.
 *
 * Enabling `?client=` here is the single change that lets ~30 owner-only
 * tools serve the INDEPENDENT_PRO's active client without touching each
 * page. The OWNER path is unchanged because they never carry the param.
 */
export function useCompany(): State & { reload: () => void } {
  const [state, setState] = useState<State>({ company: null, loading: true, error: null })
  const [version, setVersion] = useState(0)
  const [params] = useSearchParams()
  const paramClient = params.get('client')

  useEffect(() => {
    let cancel = false
    setState((s) => ({ ...s, loading: true, error: null }))
    ;(async () => {
      try {
        if (paramClient) {
          const companies = await listMyCompanies()
          if (cancel) return
          const found = companies.find((c) => c.id === paramClient) ?? null
          if (found) {
            setState({ company: found, loading: false, error: null })
            return
          }
          setState({
            company: null,
            loading: false,
            error: 'العميل المطلوب غير موجود في قائمتك.',
          })
          return
        }
        const { company } = await getMyFirstCompany()
        if (cancel) return
        if (!company) {
          setState({
            company: null,
            loading: false,
            error: 'No company linked yet — complete the diagnostic first.',
          })
        } else {
          setState({ company, loading: false, error: null })
        }
      } catch (err) {
        if (cancel) return
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Could not load company'
        setState({ company: null, loading: false, error: msg })
      }
    })()
    return () => {
      cancel = true
    }
  }, [version, paramClient])

  return { ...state, reload: () => setVersion((v) => v + 1) }
}
