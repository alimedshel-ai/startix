import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  DEPT_ICON,
  DEPT_LABEL,
  dangerZoneColor,
  getMyFirstCompany,
  listDepartments,
  type Department,
} from '@/lib/deptApi'

const ZONE_LABEL: Record<string, string> = {
  GREEN:  'آمنة',
  YELLOW: 'تحذير',
  ORANGE: 'خطر',
  RED:    'حرجة',
}

export function DeptDashboardPage() {
  const [departments, setDepartments] = useState<Department[]>([])
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
        const list = await listDepartments(company.id)
        if (cancel) return
        setDepartments(list)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر تحميل الإدارات'
        toast.error(msg)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [])

  const average = departments.length === 0
    ? 0
    : Math.round(departments.reduce((s, d) => s + (d.auditScore ?? 0), 0) / departments.length)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="لوحة الإدارة"
        description="الإدارات المدققة في الشركة — الصحة، مناطق الخطر، والروابط السريعة."
        actions={
          <Link to="/manager/select-dept" className={buttonVariants({ variant: 'outline' })}>
            إضافة / تدقيق إدارة
          </Link>
        }
      />

      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <CardHeader>
          <CardTitle>الصحة العامة</CardTitle>
          <CardDescription>{departments.length} إدارة مدققة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-3xl font-bold tabular-nums text-emerald-700">{average}%</div>
          <Progress value={average} className="h-2" />
        </CardContent>
      </Card>

      {loading && <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>}

      {!loading && departments.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>لا توجد إدارات بعد</CardTitle>
            <CardDescription>اختر إدارة وابدأ تدقيقها.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/manager/select-dept" className={buttonVariants()}>اختر إدارة</Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => {
          const zone = d.auditData?.dangerZone ?? 'GREEN'
          const score = d.auditData?.healthPct ?? d.auditScore ?? 0
          return (
            <Card key={d.id} className="transition hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span aria-hidden>{DEPT_ICON[d.type]}</span>
                  {DEPT_LABEL[d.type]}
                </CardTitle>
                <CardDescription>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${dangerZoneColor(zone)}`}>
                    {ZONE_LABEL[zone] ?? zone}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold tabular-nums">{Math.round(score)}%</div>
                <Progress value={score} className="h-2" />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
