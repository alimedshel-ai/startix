import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { DashboardTabs } from '@/components/strategic/DashboardTabs'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { listDepartments, type Department } from '@/lib/deptApi'
import { getArtifact, listKPIs, listObjectives, type Alert, type KPI, type Objective, listAlerts } from '@/lib/strategicApi'
import { api } from '@/lib/api'
import type { OwnerDiagnosticResult } from '@/lib/diagnosticQuestions'

interface Risk { id: string; name: string; probability: number; impact: number }
interface RiskData { risks: Risk[] }

function cellTint(score: number): string {
  if (score >= 16) return 'bg-red-500/80 text-white'
  if (score >= 10) return 'bg-orange-500/80 text-white'
  if (score >= 5)  return 'bg-amber-400/80 text-amber-900'
  return 'bg-emerald-400/70 text-emerald-900'
}

function kpiPct(k: KPI): number {
  if (!k.targetValue) return 0
  return Math.min(150, Math.round((k.currentValue / k.targetValue) * 100))
}

function isFinancialKPI(k: KPI): boolean {
  const n = k.name.toLowerCase()
  return n.includes('إيراد') || n.includes('ربح') || n.includes('هامش') || n.includes('سيولة')
    || /revenue|profit|margin|ebitda|liquidity|cash|sar/i.test(n) || /sar/i.test(k.unit)
}

export function BoardDashboardPage() {
  return (
    <StrategicShell
      title="لوحة مجلس الإدارة"
      description="رؤية حوكمة عليا: الصحة الاستراتيجية، الامتثال، المؤشرات المالية، ملخص المخاطر."
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
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<{ result: OwnerDiagnosticResult | null }>('/api/diagnostic/me/latest').then((r) => r.data.result),
      listDepartments(companyId),
      listObjectives(companyId),
      listKPIs(companyId),
      listAlerts(companyId),
      getArtifact<RiskData>(companyId, 'RISK_REGISTER').then((row) => row?.data?.risks ?? []),
    ])
      .then(([r, d, o, k, a, rk]) => { setResult(r); setDepts(d); setObjectives(o); setKpis(k); setAlerts(a); setRisks(rk) })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>

  const compliance = depts.find((d) => d.type === 'COMPLIANCE')
  const financialKpis = kpis.filter(isFinancialKPI)
  const topRisks = [...risks].filter((r) => r.name.trim()).sort((a, b) => b.probability * b.impact - a.probability * a.impact).slice(0, 5)

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-amber-500/10 via-yellow-500/5 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-amber-500 via-yellow-500 to-emerald-500" />
        <CardHeader className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>الوضع الاستراتيجي</CardTitle>
            <CardDescription>
              ملخص للمجلس — قرارات وقياسات على المستوى الحوكمي.
            </CardDescription>
          </div>
          <div className="text-right">
            <CardDescription>درجة النضج</CardDescription>
            <div className="text-4xl font-bold tabular-nums text-amber-700">{result?.maturityScore ?? '—'}</div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="حالة الامتثال"
          value={compliance ? `${Math.round(compliance.auditScore ?? 0)}%` : '—'}
          accent="rose"
          sub={compliance ? (compliance.auditData?.dangerZone ?? '—') : 'لم يجرَ التدقيق'}
        />
        <Stat label="أهداف نشطة" value={String(objectives.filter((o) => o.status === 'active').length)} accent="emerald" />
        <Stat label="مؤشرات مالية" value={String(financialKpis.length)} accent="amber" />
        <Stat label="مخاطر حرجة" value={String(risks.filter((r) => r.probability * r.impact >= 16).length)} accent="rose" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>المؤشرات المالية</CardTitle>
              <Link to="/kpis" className={buttonVariants({ variant: 'outline', size: 'sm' })}>التفاصيل ←</Link>
            </div>
          </CardHeader>
          <CardContent>
            {financialKpis.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
                لا توجد مؤشرات مالية. عرّف مؤشرات تحتوي على "إيراد"، "ربح"، أو وحدة SAR.
              </p>
            ) : (
              <ul className="space-y-2">
                {financialKpis.slice(0, 6).map((k) => {
                  const p = kpiPct(k)
                  return (
                    <li key={k.id} className="rounded-lg border bg-card p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{k.name}</span>
                        <span className="tabular-nums">{k.currentValue.toLocaleString('ar-SA')} / {k.targetValue.toLocaleString('ar-SA')} {k.unit}</span>
                      </div>
                      <Progress value={Math.min(100, p)} className="mt-1 h-1.5" />
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>أهم المخاطر</CardTitle>
              <Link to="/risk-map" className={buttonVariants({ variant: 'outline', size: 'sm' })}>الخريطة ←</Link>
            </div>
          </CardHeader>
          <CardContent>
            {topRisks.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
                لا توجد مخاطر مسجلة. <Link to="/risk-map" className="text-primary underline">سجّل في خريطة المخاطر</Link>
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {topRisks.map((r) => {
                  const score = r.probability * r.impact
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2">
                      <span className="font-medium">{r.name}</span>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${cellTint(score)}`}>
                        {score} ({r.probability}×{r.impact})
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {alerts.filter((a) => a.severity === 'high').length > 0 && (
        <Card className="border-rose-200 bg-rose-50/60">
          <CardHeader>
            <CardTitle>تنبيهات تحتاج قراراً</CardTitle>
            <CardDescription>عناصر ذات شدّة عالية يلزم رفعها للمجلس.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {alerts.filter((a) => a.severity === 'high').slice(0, 5).map((a) => (
                <li key={a.id} className="rounded-lg border bg-card p-3">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.detail}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function Stat({ label, value, accent, sub }: { label: string; value: string; accent: 'emerald' | 'rose' | 'amber'; sub?: string }) {
  const palette: Record<typeof accent, string> = {
    emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-transparent text-emerald-700',
    rose:    'border-rose-200 bg-gradient-to-br from-rose-500/10 to-transparent text-rose-700',
    amber:   'border-amber-200 bg-gradient-to-br from-amber-500/10 to-transparent text-amber-700',
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
