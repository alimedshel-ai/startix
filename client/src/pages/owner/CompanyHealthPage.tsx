import { useEffect, useState } from 'react'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RadarChart } from '@/components/charts/RadarChart'
import { listDepartments, type Department, dangerZoneColor, DEPT_LABEL, DEPT_ICON } from '@/lib/deptApi'

const AXIS_LABEL: Record<string, string> = {
  Governance: 'الحوكمة',
  Financial: 'المالية',
  Team: 'الفريق',
  Digital: 'الرقمي',
}

export function CompanyHealthPage() {
  return (
    <StrategicShell title="صحة الشركة" description="لقطة مجمّعة من التشخيص ومن تدقيقات الإدارات.">
      {(companyId) => <Health companyId={companyId} />}
    </StrategicShell>
  )
}

function Health({ companyId }: { companyId: string }) {
  const [depts, setDepts] = useState<Department[]>([])

  useEffect(() => {
    listDepartments(companyId).then(setDepts).catch(() => undefined)
  }, [companyId])

  const audited = depts.filter((d) => d.auditScore != null)
  const overall = audited.length === 0 ? 0 : Math.round(audited.reduce((s, d) => s + (d.auditScore ?? 0), 0) / audited.length)

  const radar = (['governance', 'financial', 'team', 'digital'] as const).map((axis) => {
    const arr = audited.map((d) => d.auditData?.[axis] ?? 0).filter((v) => v > 0)
    const cap = axis === 'governance' || axis === 'financial' ? 30 : 20
    const avg = arr.length === 0 ? 0 : (arr.reduce((s, v) => s + v, 0) / arr.length) / cap * 100
    const label = axis === 'governance' ? 'Governance' : axis === 'financial' ? 'Financial' : axis === 'team' ? 'Team' : 'Digital'
    return { axis: AXIS_LABEL[label] ?? label, value: Math.round(avg) }
  })

  return (
    <>
      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <CardHeader>
          <CardTitle>الصحة العامة</CardTitle>
          <CardDescription>{audited.length} إدارة مدققة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline gap-2">
            <div className="text-4xl font-bold tabular-nums text-emerald-700">{overall}%</div>
            <div className="text-sm text-muted-foreground">متوسط النضج</div>
          </div>
          <Progress value={overall} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-violet-500/5 to-indigo-500/5">
          <CardHeader>
            <CardTitle>نضج المحاور</CardTitle>
            <CardDescription>متوسط عبر الإدارات المدققة.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadarChart data={radar} height={320} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>حسب الإدارة</CardTitle>
            <CardDescription>تظهر الإدارات المدققة فقط.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {audited.map((d) => (
                <li key={d.id} className="flex items-center justify-between border-b pb-2">
                  <span className="flex items-center gap-2 font-medium">
                    <span>{DEPT_ICON[d.type]}</span>
                    {DEPT_LABEL[d.type]}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${dangerZoneColor(d.auditData?.dangerZone ?? 'GREEN')}`}>
                      {d.auditData?.dangerZone ?? '—'}
                    </span>
                    <span className="tabular-nums">{Math.round(d.auditScore ?? 0)}%</span>
                  </div>
                </li>
              ))}
              {audited.length === 0 && <li className="text-sm text-muted-foreground">لا توجد إدارات مدققة بعد.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
