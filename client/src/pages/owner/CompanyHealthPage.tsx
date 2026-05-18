import { useEffect, useState } from 'react'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RadarChart } from '@/components/charts/RadarChart'
import { listDepartments, type Department, dangerZoneColor } from '@/lib/deptApi'

export function CompanyHealthPage() {
  return (
    <StrategicShell title="Company health" description="Aggregate snapshot from the diagnostic and per-department audits.">
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
    return { axis: axis.charAt(0).toUpperCase() + axis.slice(1), value: Math.round(avg) }
  })

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Overall health</CardTitle>
          <CardDescription>{audited.length} audited department{audited.length === 1 ? '' : 's'}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-3xl font-semibold">{overall}%</div>
          <Progress value={overall} />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Axis maturity</CardTitle>
            <CardDescription>Averaged across audited departments.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadarChart data={radar} height={320} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per department</CardTitle>
            <CardDescription>Only audited departments shown.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {audited.map((d) => (
                <li key={d.id} className="flex items-center justify-between border-b pb-2">
                  <span className="font-medium">{d.type}</span>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${dangerZoneColor(d.auditData?.dangerZone ?? 'GREEN')}`}>{d.auditData?.dangerZone ?? '—'}</span>
                    <span>{Math.round(d.auditScore ?? 0)}%</span>
                  </div>
                </li>
              ))}
              {audited.length === 0 && <li className="text-sm text-muted-foreground">No audited departments yet.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
