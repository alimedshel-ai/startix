import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import { DEPT_LABEL } from '@/lib/deptApi'
import { getProOverview, type OverviewClient } from '@/lib/proApi'
import { useAuthStore } from '@/store/authStore'

// ─── PRO-4 — بريدكرمب سياق العميل النشط للمدير المستقل ────────────────────
// يقرأ `?client=<companyId>` من الـ URL أو `:companyId` من مسار
// `/manager/clients/:companyId` ويعرض شريطاً علوياً: "تعمل الآن على [الاسم]
// — [التخصّص]" + زر "تبديل عميل".
//
// يظهر فقط للـ INDEPENDENT_PRO مع سياق عميل موجود. يُدرَج في MainLayout فوق
// المحتوى مباشرة، ويختفي لبقيّة الأدوار والصفحات (يُخفي نفسه ذاتياً بدلاً
// من الاعتماد على شرط في MainLayout).

// نُبقي cache خفيف في مستوى الوحدة لعناوين الشركات لتجنّب استدعاءات
// listMyClients على كل تنقّل بين الصفحات (الحد الأدنى لتنفيذ PRO-4/30 معاً).
const nameCache = new Map<string, { name: string; specialty: string }>()

export function ClientContextBar() {
  const user = useAuthStore((s) => s.user)
  const [params] = useSearchParams()
  const location = useLocation()
  const [meta, setMeta] = useState<{ name: string; specialty: string } | null>(null)

  const isPro = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'

  // نستخرج companyId من ?client= أو من مسار /manager/clients/:companyId.
  const paramClient = params.get('client')
  const pathMatch = location.pathname.match(/^\/manager\/clients\/([^/]+)$/)
  const pathClient = pathMatch?.[1]
  const companyId = paramClient ?? pathClient ?? null

  useEffect(() => {
    if (!isPro || !companyId) {
      setMeta(null)
      return
    }
    const cached = nameCache.get(companyId)
    if (cached) {
      setMeta(cached)
      return
    }
    let alive = true
    getProOverview()
      .then((res) => {
        if (!alive) return
        for (const c of res.clients as OverviewClient[]) {
          nameCache.set(c.companyId, { name: c.companyName, specialty: DEPT_LABEL[c.specialty] })
        }
        const found = nameCache.get(companyId)
        if (found) setMeta(found)
      })
      .catch(() => {
        /* صامت — الشريط اختياري */
      })
    return () => { alive = false }
  }, [isPro, companyId])

  if (!isPro || !companyId || !meta) return null

  return (
    <div className="border-b bg-primary/5">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-xs text-muted-foreground">تعمل الآن على</span>
          <span className="font-semibold">🏢 {meta.name}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{meta.specialty}</span>
        </div>
        <Link
          to="/manager/clients"
          className="text-xs text-primary underline-offset-4 hover:underline"
        >
          تبديل عميل ←
        </Link>
      </div>
    </div>
  )
}
