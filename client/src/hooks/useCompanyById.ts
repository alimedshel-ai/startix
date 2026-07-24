import { useEffect, useState } from 'react'

import { listMyCompanies, type Company } from '@/lib/deptApi'

// ─── حلّ بيانات الشركة بالمعرّف المُمرَّر (لا من الـURL) ─────────────────
// الجذر الذي كان يكسر سلاسة المسار: useCompany/useClientScopedCompany يقرآن
// `?client=` من الـURL، فعلى صفحة العميل (`/manager/clients/:id` — باراميتر
// مسار بلا `?client=`) يسقطان إلى getMyFirstCompany (شركة «أولى» عشوائيّة)،
// فيحسب useGuidedNext تسلسل التحليل ① لشركة خاطئة. هذا الـhook يُنطّق على
// المعرّف المُمرَّر مباشرةً — فتُصبح «الخطوة التالية» متّسقة على كل الأسطح.
//
// نمط الجلب (كـuseRescue): لا setState متزامن داخل الرندر — يُشتقّ loading من
// مطابقة forId ↔ companyId، فيُزال خطأ set-state-in-effect من جذره.

interface Fetched {
  forId: string | null
  company: Company | null
}

export function useCompanyById(companyId: string | null): { company: Company | null; loading: boolean } {
  const [fetched, setFetched] = useState<Fetched>({ forId: null, company: null })

  useEffect(() => {
    if (!companyId) return
    let alive = true
    listMyCompanies()
      .then((list) => {
        if (!alive) return
        setFetched({ forId: companyId, company: list.find((c) => c.id === companyId) ?? null })
      })
      .catch(() => { if (alive) setFetched({ forId: companyId, company: null }) })
    return () => { alive = false }
  }, [companyId])

  if (!companyId) return { company: null, loading: false }
  if (fetched.forId !== companyId) return { company: null, loading: true }
  return { company: fetched.company, loading: false }
}
