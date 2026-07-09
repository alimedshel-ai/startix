import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getMyFirstCompany, listMyCompanies, type Company } from '@/lib/deptApi'

// ─── PRO-6 — hook حسم "على أي عميل نعمل الآن؟" ─────────────────────────────
// الصفحات المُقيَّدة بعميل تحتاج companyId. الأولوية:
//   ١. `?client=<id>` من الـ URL — للمدير المستقل الذي يفتح صفحة أداة
//      عبر ClientDetailPage. يُشترط أن يكون هذا العميل ضمن قائمته.
//   ٢. `getMyFirstCompany()` fallback — للمدير الداخلي بشركة واحدة، أو
//      للمستقل الذي أنشأ عميلاً أوّل عند التسجيل (PRO-1).
//
// النتيجة: كل صفحة `dept-*` تحصل على شركة صحيحة بلا تغيير في السيرفر.

export type ClientScope = {
  loading: boolean
  company: Company | null
  companyId: string | null
  error: string | null
}

export function useClientScopedCompany(): ClientScope {
  const [params] = useSearchParams()
  const paramId = params.get('client')
  const [state, setState] = useState<ClientScope>({
    loading: true,
    company: null,
    companyId: null,
    error: null,
  })

  useEffect(() => {
    let alive = true
    setState({ loading: true, company: null, companyId: null, error: null })
    ;(async () => {
      try {
        if (paramId) {
          // نتحقّق أنّ العميل ضمن قائمة المستخدم قبل استخدامه.
          const companies = await listMyCompanies()
          if (!alive) return
          const found = companies.find((c) => c.id === paramId) ?? null
          if (found) {
            setState({ loading: false, company: found, companyId: found.id, error: null })
            return
          }
          setState({
            loading: false,
            company: null,
            companyId: null,
            error: 'العميل المطلوب غير موجود في قائمتك.',
          })
          return
        }
        const { company } = await getMyFirstCompany()
        if (!alive) return
        if (!company) {
          setState({
            loading: false,
            company: null,
            companyId: null,
            error: 'لا توجد شركة مرتبطة بحسابك بعد.',
          })
          return
        }
        setState({ loading: false, company, companyId: company.id, error: null })
      } catch (err) {
        if (!alive) return
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'تعذّر تحميل بيانات الشركة'
        setState({ loading: false, company: null, companyId: null, error: msg })
      }
    })()
    return () => { alive = false }
  }, [paramId])

  return state
}
