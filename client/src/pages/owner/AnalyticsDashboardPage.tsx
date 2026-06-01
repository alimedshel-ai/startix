import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { aiPredictions, type PredictionSeries } from '@/lib/aiApi'
import { getArtifact, listAlerts, type Alert } from '@/lib/strategicApi'

interface Risk {
  id: string
  name: string
  probability: 1 | 2 | 3 | 4 | 5
  impact: 1 | 2 | 3 | 4 | 5
  mitigation: string
}

interface RiskData { risks: Risk[] }

function cellTint(score: number): { bg: string; text: string } {
  if (score >= 16) return { bg: 'bg-red-500/80',    text: 'text-white' }
  if (score >= 10) return { bg: 'bg-orange-500/80', text: 'text-white' }
  if (score >= 5)  return { bg: 'bg-amber-400/80',  text: 'text-amber-900' }
  return { bg: 'bg-emerald-400/70', text: 'text-emerald-900' }
}

function trendIcon(slope: number): { icon: string; color: string } {
  if (slope > 0.01)  return { icon: '↑', color: 'text-emerald-700' }
  if (slope < -0.01) return { icon: '↓', color: 'text-rose-700' }
  return { icon: '→', color: 'text-slate-500' }
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
}

function alertTint(s: Alert['severity']): { tint: string; chip: string } {
  if (s === 'high')   return { tint: 'border-rose-300 bg-rose-50/60',   chip: 'bg-rose-500 text-white' }
  if (s === 'medium') return { tint: 'border-amber-300 bg-amber-50/60', chip: 'bg-amber-500 text-white' }
  return { tint: 'border-sky-300 bg-sky-50/60', chip: 'bg-sky-500 text-white' }
}

const KIND_LABEL: Record<Alert['kind'], string> = {
  kpi_at_risk:        'مؤشر في خطر',
  overdue_task:       'مهمة متأخرة',
  overdue_correction: 'إجراء متأخر',
  no_review:          'مراجعة دورية',
}

export function AnalyticsDashboardPage() {
  return (
    <StrategicShell
      title="التحليلات والتوقعات"
      description="خريطة المخاطر، توقعات ٩٠ يوم لكل مؤشر، اتجاهات الأداء، والتنبيهات التلقائية."
    >
      {(companyId) => <Dashboard companyId={companyId} />}
    </StrategicShell>
  )
}

function Dashboard({ companyId }: { companyId: string }) {
  const [risks, setRisks] = useState<Risk[]>([])
  const [predictions, setPredictions] = useState<PredictionSeries[]>([])
  const [narrative, setNarrative] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loadingP, setLoadingP] = useState(true)
  const [loadingA, setLoadingA] = useState(true)
  const [loadingR, setLoadingR] = useState(true)
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null)

  useEffect(() => {
    getArtifact<RiskData>(companyId, 'RISK_REGISTER')
      .then((row) => setRisks(row?.data?.risks ?? []))
      .catch(() => undefined)
      .finally(() => setLoadingR(false))
    aiPredictions(companyId)
      .then((r) => {
        setPredictions(r.series)
        setNarrative(r.narrative)
        if (r.series[0]) setSelectedKpi(r.series[0].kpiId)
      })
      .catch(() => undefined)
      .finally(() => setLoadingP(false))
    listAlerts(companyId)
      .then(setAlerts)
      .catch(() => undefined)
      .finally(() => setLoadingA(false))
  }, [companyId])

  const grid = useMemo(() => {
    const g: Risk[][][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => []))
    for (const r of risks) {
      if (r.name.trim()) g[r.impact - 1][r.probability - 1].push(r)
    }
    return g
  }, [risks])

  const selectedSeries = predictions.find((s) => s.kpiId === selectedKpi) ?? predictions[0] ?? null

  const chartData = useMemo(() => {
    if (!selectedSeries) return []
    const hist = selectedSeries.history.map((p) => ({
      date: shortDate(p.date),
      historical: p.value,
      forecast: undefined as number | undefined,
    }))
    const forecast = selectedSeries.forecast.map((p) => ({
      date: shortDate(p.date),
      historical: undefined as number | undefined,
      forecast: p.value,
    }))
    if (hist.length > 0 && forecast.length > 0) {
      forecast[0] = { date: forecast[0].date, historical: hist[hist.length - 1].historical, forecast: forecast[0].forecast }
    }
    return [...hist, ...forecast]
  }, [selectedSeries])

  const alertCounts = alerts.reduce<Record<Alert['severity'], number>>(
    (acc, a) => { acc[a.severity] = (acc[a.severity] ?? 0) + 1; return acc },
    { high: 0, medium: 0, low: 0 },
  )

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-rose-300 bg-rose-50/60">
          <CardHeader>
            <CardDescription>تنبيهات عالية</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-rose-700">{alertCounts.high}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-amber-300 bg-amber-50/60">
          <CardHeader>
            <CardDescription>تنبيهات متوسطة</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-amber-700">{alertCounts.medium}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-sky-300 bg-sky-50/60">
          <CardHeader>
            <CardDescription>تنبيهات منخفضة</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-sky-700">{alertCounts.low}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="h-1.5 bg-gradient-to-l from-sky-500 via-violet-500 to-fuchsia-500" />
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>توقعات ٩٠ يوم</CardTitle>
                <CardDescription>
                  {selectedSeries
                    ? `${selectedSeries.name} — هدف ${selectedSeries.target.toLocaleString('ar-SA')} ${selectedSeries.unit}`
                    : 'لا توجد مؤشرات بعد'}
                </CardDescription>
              </div>
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={selectedKpi ?? ''}
                onChange={(e) => setSelectedKpi(e.target.value)}
                disabled={predictions.length === 0}
              >
                {predictions.map((p) => <option key={p.kpiId} value={p.kpiId}>{p.name}</option>)}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {loadingP && <p className="py-12 text-center text-sm text-muted-foreground">جاري التحميل…</p>}
            {!loadingP && predictions.length === 0 && (
              <p className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                لا توجد توقعات. أنشئ مؤشرات وسجّل قيماً تاريخية في
                {' '}<Link to="/kpi-entries" className="text-primary underline">إدخالات المؤشرات</Link>.
              </p>
            )}
            {selectedSeries && chartData.length > 0 && (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <ReferenceLine y={selectedSeries.target} stroke="#10b981" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="historical" stroke="#0ea5e9" strokeWidth={2} dot />
                  <Area type="monotone" dataKey="forecast" stroke="#a855f7" strokeWidth={2} strokeDasharray="6 4" fill="#a855f7" fillOpacity={0.15} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
          {narrative && (
            <CardFooter className="border-t bg-violet-500/5">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-violet-700">🤖 تحليل Claude:</span> {narrative}
              </p>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>التنبيهات</CardTitle>
            <CardDescription>{alerts.length} تنبيه إجمالاً.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingA && <p className="text-sm text-muted-foreground">جاري التحميل…</p>}
            {!loadingA && alerts.length === 0 && (
              <p className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
                ممتاز! لا توجد تنبيهات حالياً.
              </p>
            )}
            <ul className="max-h-[360px] space-y-2 overflow-y-auto">
              {alerts.map((a) => {
                const t = alertTint(a.severity)
                return (
                  <li key={a.id} className={`rounded-xl border p-3 ${t.tint}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{a.title}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${t.chip}`}>
                        {KIND_LABEL[a.kind]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{a.detail}</p>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>اتجاهات المؤشرات</CardTitle>
          <CardDescription>{predictions.length} مؤشر — اتجاه التحسن أو التراجع.</CardDescription>
        </CardHeader>
        <CardContent>
          {predictions.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">لا توجد مؤشرات.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {predictions.map((s) => {
                const last = s.history[s.history.length - 1]?.value ?? 0
                const pct = s.target ? Math.min(150, Math.round((last / s.target) * 100)) : 0
                const t = trendIcon(s.slopePerDay)
                return (
                  <button
                    key={s.kpiId}
                    type="button"
                    onClick={() => setSelectedKpi(s.kpiId)}
                    className={`text-right rounded-xl border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-sm ${selectedKpi === s.kpiId ? 'ring-2 ring-primary' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-xs font-medium">{s.name}</span>
                      <span className={`text-xl font-bold tabular-nums ${t.color}`}>{t.icon}</span>
                    </div>
                    <div className="mt-1 text-lg font-bold tabular-nums">{last.toLocaleString('ar-SA')} <span className="text-xs text-muted-foreground">{s.unit}</span></div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>الهدف {s.target.toLocaleString('ar-SA')}</span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                    <Progress value={Math.min(100, pct)} className="mt-1 h-1" />
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>خريطة المخاطر</CardTitle>
          <CardDescription>الصفوف = الأثر · الأعمدة = الاحتمالية. كل خلية تعرض عدد المخاطر فيها.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingR && <p className="text-sm text-muted-foreground">جاري التحميل…</p>}
          {!loadingR && risks.length === 0 && (
            <p className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
              لا توجد مخاطر مسجلة.{' '}
              <Link to="/risk-map" className="text-primary underline">سجّل أولاً في خريطة المخاطر</Link>.
            </p>
          )}
          {risks.length > 0 && (
            <div className="grid grid-cols-[40px_repeat(5,minmax(0,1fr))] gap-1 text-xs">
              <div />
              {[5, 4, 3, 2, 1].map((p) => (
                <div key={p} className="text-center font-semibold text-muted-foreground tabular-nums">
                  احتمالية {p}
                </div>
              ))}
              {[5, 4, 3, 2, 1].map((impact) => (
                <HeatmapRow key={impact} impact={impact} row={grid[impact - 1]} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function HeatmapRow({ impact, row }: { impact: number; row: Risk[][] }) {
  return (
    <>
      <div className="flex items-center justify-center text-xs font-semibold text-muted-foreground tabular-nums">
        أثر {impact}
      </div>
      {[5, 4, 3, 2, 1].map((p) => {
        const cell = row[p - 1] ?? []
        const score = p * impact
        const tint = cellTint(score)
        return (
          <div
            key={p}
            className={`flex h-16 flex-col items-center justify-center rounded-md ${tint.bg} ${tint.text}`}
            title={cell.length > 0 ? cell.map((r) => r.name).join(', ') : `(${p}×${impact} = ${score})`}
          >
            <span className="text-[10px] opacity-80">{score}</span>
            {cell.length > 0 && <span className="text-lg font-bold tabular-nums">{cell.length}</span>}
          </div>
        )
      })}
    </>
  )
}
