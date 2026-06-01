import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getLatestCompliance,
  getMyFirstCompany,
} from '@/lib/deptApi'

interface PlanRow {
  week: number
  axis: string
  action: string
  owner: string
}

export function ComplianceReformPage() {
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<PlanRow[] | null>(null)
  const [penalty, setPenalty] = useState<number | null>(null)

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
        const { audit } = await getLatestCompliance(company.id)
        if (cancel) return
        if (!audit) {
          setLoading(false)
          return
        }
        // Pro audits store the reform plan; basic audits don't.
        const reform = (audit.reformPlan as PlanRow[] | null) ?? null
        setPlan(reform)
        setPenalty(audit.penaltyEstimate ?? null)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر تحميل خطة الإصلاح'
        toast.error(msg)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="خطة الإصلاح للامتثال"
        description="خطة عمل مدّتها 12 أسبوعاً تُولَّد تلقائياً من محاور الامتثال الأقل نقاطاً."
        breadcrumbs={[
          { label: 'الأقسام', to: '/manager/select-dept' },
          { label: 'الامتثال', to: '/manager/compliance/audit' },
          { label: 'الإصلاح' },
        ]}
        actions={
          <Link to="/manager/compliance/audit-pro" className={buttonVariants({ variant: 'outline' })}>
            إعادة التدقيق الاحترافي
          </Link>
        }
      />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>جاري تحميل خطة الإصلاح…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {!loading && !plan && (
        <Card className="bg-gradient-to-br from-rose-500/10 to-transparent border-rose-200">
          <CardHeader>
            <CardTitle>لا توجد خطة إصلاح متاحة</CardTitle>
            <CardDescription>نفّذ تدقيق الامتثال الاحترافي أولاً — تُولَّد خطة الإصلاح منه.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/manager/compliance/audit-pro" className={buttonVariants()}>
              تنفيذ التدقيق الاحترافي
            </Link>
          </CardContent>
        </Card>
      )}

      {plan && plan.length > 0 && (
        <>
          {penalty != null && (
            <Card className="overflow-hidden bg-gradient-to-br from-red-500/10 to-transparent border-red-200">
              <div className="h-1.5 bg-gradient-to-l from-rose-500 via-red-500 to-orange-500" />
              <CardHeader>
                <CardTitle>تعرّض الغرامات التقديري</CardTitle>
                <CardDescription>خطة الإصلاح أدناه تستهدف المحاور التي تقود هذا التعرّض.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-red-700 tabular-nums">
                  {new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(penalty)}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-gradient-to-br from-rose-500/10 to-transparent border-rose-200">
            <CardHeader>
              <CardTitle>جدول الـ 12 أسبوعاً</CardTitle>
              <CardDescription><span className="tabular-nums">{plan.length}</span> إجراءات. المسؤولون هم رؤساء الأقسام — عدّل بحسب فريقك.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {plan.map((row) => (
                  <li key={`${row.week}-${row.action}`} className="grid grid-cols-[70px_140px_1fr] items-start gap-3 border-b pb-2 transition hover:-translate-y-0.5 hover:shadow-md">
                    <span className="font-semibold tabular-nums">أسبوع {row.week}</span>
                    <span className="text-muted-foreground text-xs">{row.axis}</span>
                    <span>
                      {row.action}
                      <span className="ml-2 text-xs text-muted-foreground">({row.owner})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
