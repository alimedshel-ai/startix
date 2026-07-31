import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { DashboardTabs } from '@/components/strategic/DashboardTabs'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RadarChart } from '@/components/charts/RadarChart'
import { PathBadge } from '@/components/PathBadge'
import { DEPT_ICON, DEPT_LABEL, dangerZoneColor, listDepartments, type Department } from '@/lib/deptApi'
import { api } from '@/lib/api'
import { listAlerts, listKPIs, listObjectives, type Alert, type KPI, type Objective } from '@/lib/strategicApi'
import type { OwnerDiagnosticResult, StrategicPath } from '@/lib/diagnosticQuestions'

function objProgress(o: Objective): number {
  if (!o.okrs?.length) return 0
  const totals = o.okrs.map((k) => (k.targetValue === 0 ? 0 : Math.min(100, (k.currentValue / k.targetValue) * 100)))
  return Math.round(totals.reduce((s, v) => s + v, 0) / totals.length)
}

function kpiPct(k: KPI): number {
  if (!k.targetValue) return 0
  return Math.min(150, Math.round((k.currentValue / k.targetValue) * 100))
}

const PATH_AR: Record<StrategicPath, string> = {
  EMERGENCY_RISK: 'إنقاذ / خطر',
  NASCENT_CAUTIOUS: 'نشأة / حذر',
  GROWING_CHAOTIC: 'نمو / فوضى',
  MATURE_COMPETITIVE: 'نضج / تنافسية',
  DEFAULT_STRATEGIC: 'مسار افتراضي',
}

const AXIS_AR: Record<string, string> = {
  Governance: 'الحوكمة',
  Financial: 'المالية',
  Team: 'الفريق',
  Digital: 'الرقمي',
}

export function CEODashboardPage() {
  return (
    <StrategicShell
      title="لوحة الرئيس التنفيذي"
      description="نظرة تنفيذية: الصحة العامة، نضج المسار، أداء الإدارات، تقدم الأهداف، أهم المؤشرات والمخاطر."
      tabs={<DashboardTabs />}
    >
      {(companyId) => <Inner companyId={companyId} />}
    </StrategicShell>
  )
}

function Inner({ companyId }: { companyId: string }) {
  const [result, setResult] = useState<OwnerDiagnosticResult | null>(null)
  const [depts, setDepts] = useState<Department[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [kpis, setKpis] = useState<KPI[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<{ result: OwnerDiagnosticResult | null }>('/api/diagnostic/me/latest').then((r) => r.data.result),
      listDepartments(companyId),
      listObjectives(companyId),
      listKPIs(companyId),
      listAlerts(companyId),
    ])
      .then(([r, d, o, k, a]) => { setResult(r); setDepts(d); setObjectives(o); setKpis(k); setAlerts(a) })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [companyId])

  const audited = depts.filter((d) => d.auditScore != null)
  const avgHealth = audited.length === 0 ? 0 : Math.round(audited.reduce((s, d) => s + (d.auditScore ?? 0), 0) / audited.length)
  const objAvg = objectives.length === 0 ? 0 : Math.round(objectives.reduce((s, o) => s + objProgress(o), 0) / objectives.length)
  const onTrackKpis = kpis.filter((k) => kpiPct(k) >= 70).length
  const highAlerts = alerts.filter((a) => a.severity === 'high').length

  const radar = result?.radarData ?? null

  if (loading) return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-primary/10 via-violet-500/5 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-primary via-violet-500 to-fuchsia-500" />
        <CardHeader className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardDescription>المسار الاستراتيجي</CardDescription>
            {result ? (
              <div className="mt-1 flex items-center gap-3">
                <PathBadge path={result.strategicPath} />
                <span className="text-sm text-muted-foreground">{PATH_AR[result.strategicPath]}</span>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                لم يجرَ تشخيص بعد. <Link to="/diagnostic/owner" className="text-primary underline">ابدأ الآن</Link>
              </p>
            )}
          </div>
          <div className="text-right">
            <CardDescription>درجة النضج</CardDescription>
            <div className="text-4xl font-bold tabular-nums text-primary">{result?.maturityScore ?? '—'}</div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="صحة الإدارات" value={`${avgHealth}%`} accent="emerald" sub={`${audited.length} مدققة`} />
        <Stat label="تقدم الأهداف" value={`${objAvg}%`} accent="sky" sub={`${objectives.length} هدف`} />
        <Stat label="مؤشرات في المسار" value={`${onTrackKpis}/${kpis.length}`} accent="violet" sub="≥ 70% من الهدف" />
        <Stat label="تنبيهات حرجة" value={String(highAlerts)} accent="rose" sub={`${alerts.length} تنبيه إجمالاً`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>رادار القدرات</CardTitle>
            <CardDescription>من نتيجة التشخيص الأخير.</CardDescription>
          </CardHeader>
          <CardContent>
            {radar && radar.length > 0 ? (
              <RadarChart data={radar.map((r) => ({ axis: AXIS_AR[r.axis] ?? r.axis, value: r.value }))} height={300} />
            ) : (
              <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                لا يوجد تشخيص بعد.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>أهم التنبيهات</CardTitle>
            <CardDescription>أعلى 5 حسب الشدة.</CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-xs text-muted-foreground">ممتاز — لا تنبيهات.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {alerts.slice(0, 5).map((a) => (
                  <li key={a.id} className={`rounded-lg border p-2 ${
                    a.severity === 'high' ? 'border-rose-200 bg-rose-50/60'
                      : a.severity === 'medium' ? 'border-amber-200 bg-amber-50/60'
                      : 'border-sky-200 bg-sky-50/60'
                  }`}>
                    <div className="text-xs font-medium">{a.title}</div>
                    <div className="text-[10px] text-muted-foreground line-clamp-1">{a.detail}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>أداء الإدارات</CardTitle>
            <Link to="/manager/dept-dashboard" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              تفاصيل ←
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {audited.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              لا توجد إدارات مدققة. <Link to="/manager/select-dept" className="text-primary underline">ابدأ التدقيق</Link>
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {audited.slice(0, 8).map((d) => {
                const score = d.auditData?.healthPct ?? d.auditScore ?? 0
                const zone = d.auditData?.dangerZone ?? 'GREEN'
                return (
                  <div key={d.id} className="rounded-xl border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{DEPT_ICON[d.type]} {DEPT_LABEL[d.type]}</span>
                      <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${dangerZoneColor(zone)}`}>{zone}</span>
                    </div>
                    <div className="mt-2 text-xl font-bold tabular-nums">{Math.round(score)}%</div>
                    <Progress value={score} className="mt-1 h-1.5" />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>تقدم الأهداف الاستراتيجية</CardTitle>
            <Link to="/objectives" className={buttonVariants({ variant: 'outline', size: 'sm' })}>كل الأهداف ←</Link>
          </div>
        </CardHeader>
        <CardContent>
          {objectives.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              لا توجد أهداف. <Link to="/objectives" className="text-primary underline">أنشئ أول هدف</Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {objectives.slice(0, 6).map((o) => {
                const p = objProgress(o)
                return (
                  <li key={o.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{o.title}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{p}%</span>
                    </div>
                    <Progress value={p} className="mt-1 h-1.5" />
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function Stat({ label, value, accent, sub }: { label: string; value: string; accent: 'emerald' | 'sky' | 'violet' | 'rose'; sub?: string }) {
  const palette: Record<typeof accent, string> = {
    emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-transparent text-emerald-700',
    sky:     'border-sky-200 bg-gradient-to-br from-sky-500/10 to-transparent text-sky-700',
    violet:  'border-violet-200 bg-gradient-to-br from-violet-500/10 to-transparent text-violet-700',
    rose:    'border-rose-200 bg-gradient-to-br from-rose-500/10 to-transparent text-rose-700',
  }
  return (
    <Card className={palette[accent]}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  )
}
