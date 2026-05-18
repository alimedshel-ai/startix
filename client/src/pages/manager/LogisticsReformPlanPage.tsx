import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createDepartment,
  getLatestDeptAudit,
  getMyFirstCompany,
  type AuditScore,
} from '@/lib/deptApi'

interface ReformAction {
  week: number
  area: string
  action: string
  owner: string
}

const ACTIONS_BY_AREA: Record<string, string[]> = {
  governance: [
    'توثيق سياسة المخزون + جرد دوري',
    'تجديد عقود الناقلين واتفاقيات مستوى الخدمة',
    'تأسيس سياسة المرتجعات / اللوجستيات العكسية',
  ],
  financial: [
    'تتبّع تكلفة الشحن لكل طلب أسبوعياً',
    'مراقبة تكلفة الاحتفاظ بالمخزون',
    'نشر لوحة مؤشرات أداء OTIF',
  ],
  team: [
    'تنفيذ دورة تنشيطية لسلامة المستودع',
    'إطلاق مراجعات أداء المنتقي / السائق',
    'إقامة طقس تسليم بين المناوبات',
  ],
  digital: [
    'نشر أو إطلاق كامل لنظام إدارة المستودع WMS',
    'تطبيق تحسين المسارات',
    'تفعيل تتبّع الشحنات في الوقت الفعلي',
  ],
}

const AREA_LABEL: Record<string, string> = {
  governance: 'حوكمة',
  financial: 'مالي',
  team: 'الفريق',
  digital: 'رقمي',
}

export function LogisticsReformPlanPage() {
  const [score, setScore] = useState<AuditScore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const { company } = await getMyFirstCompany()
        if (!company) {
          toast.error('أكمل تشخيص المدير أولاً')
          setLoading(false)
          return
        }
        const dept = await createDepartment({ companyId: company.id, type: 'LOGISTICS' })
        const { audit } = await getLatestDeptAudit(dept.id)
        if (cancel) return
        if (audit) setScore(audit.scores)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر تحميل التدقيق'
        toast.error(msg)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const plan: ReformAction[] = (() => {
    if (!score) return []
    const ordered = [...score.byAxis].sort((a, b) => a.score / a.cap - b.score / b.cap)
    const out: ReformAction[] = []
    let week = 1
    for (const axis of ordered) {
      const actions = ACTIONS_BY_AREA[axis.axis] ?? []
      for (const action of actions) {
        if (week > 12) break
        out.push({ week, area: axis.axis, action, owner: 'مدير اللوجستيات' })
        week += 1
      }
      if (week > 12) break
    }
    return out
  })()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="خطة الإصلاح للوجستيات"
        description="خطة تصحيحية مدّتها 12 أسبوعاً تُولَّد من المحاور الأقل نقاطاً في تدقيق اللوجستيات."
        breadcrumbs={[
          { label: 'الأقسام', to: '/manager/select-dept' },
          { label: 'اللوجستيات', to: '/manager/logistics/audit' },
          { label: 'خطة الإصلاح' },
        ]}
      />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>جاري تحميل التدقيق…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {!loading && !score && (
        <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-orange-200">
          <CardHeader>
            <CardTitle>لم يتم العثور على تدقيق</CardTitle>
            <CardDescription>نفّذ تدقيق اللوجستيات أولاً لتوليد خطة الإصلاح.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {plan.length > 0 && (
        <Card className="overflow-hidden bg-gradient-to-br from-orange-500/10 to-transparent border-orange-200">
          <div className="h-1.5 bg-gradient-to-l from-orange-500 via-amber-500 to-rose-500" />
          <CardHeader>
            <CardTitle>الخطة الأسبوعية</CardTitle>
            <CardDescription>{plan.length} إجراء على مدى الـ 12 أسبوعاً القادمة.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {plan.map((p) => (
                <li key={`${p.week}-${p.action}`} className="grid grid-cols-[60px_120px_1fr] items-start gap-3 border-b pb-2 transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className="font-semibold tabular-nums">أسبوع {p.week}</span>
                  <span className="text-muted-foreground text-xs">{AREA_LABEL[p.area] ?? p.area}</span>
                  <span>
                    {p.action}
                    <span className="ml-2 text-xs text-muted-foreground">({p.owner})</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
