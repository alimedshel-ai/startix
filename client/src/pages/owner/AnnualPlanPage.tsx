import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  listInitiatives, listKPIs, listObjectives, listProjects,
  type Initiative, type KPI, type Objective, type Project,
} from '@/lib/strategicApi'

interface YearData {
  objectives: Objective[]
  initiatives: Initiative[]
  projects: Project[]
  kpis: KPI[]
}

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

function projectMonthSpan(p: Project, year: number): { start: number; end: number } | null {
  if (!p.startDate || !p.endDate) return null
  const s = new Date(p.startDate)
  const e = new Date(p.endDate)
  // Clip to the given year
  const startM = s.getFullYear() < year ? 0 : s.getFullYear() > year ? -1 : s.getMonth()
  const endM   = e.getFullYear() < year ? -1 : e.getFullYear() > year ? 11 : e.getMonth()
  if (startM < 0 || endM < 0 || startM > 11 || endM < startM) return null
  return { start: startM, end: endM }
}

function objectiveProgress(o: Objective): number {
  if (!o.okrs?.length) return 0
  const totals = o.okrs.map((k) => (k.targetValue === 0 ? 0 : Math.min(100, (k.currentValue / k.targetValue) * 100)))
  return Math.round(totals.reduce((s, v) => s + v, 0) / totals.length)
}

export function AnnualPlanPage() {
  return (
    <StrategicShell
      title="الخطة السنوية"
      description="نظرة سنوية: أهداف، مبادرات، مشاريع، ومؤشرات أداء."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<YearData>({ objectives: [], initiatives: [], projects: [], kpis: [] })
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    Promise.all([
      listObjectives(companyId),
      listInitiatives(companyId),
      listProjects(companyId),
      listKPIs(companyId),
    ])
      .then(([objectives, initiatives, projects, kpis]) => setData({ objectives, initiatives, projects, kpis }))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>

  const objAvg = data.objectives.length === 0
    ? 0
    : Math.round(data.objectives.reduce((s, o) => s + objectiveProgress(o), 0) / data.objectives.length)
  const activeInit = data.initiatives.filter((i) => i.status === 'in_progress' || i.status === 'planned').length
  const activeProj = data.projects.filter((p) => p.status === 'active').length
  const kpisOnTrack = data.kpis.filter((k) => k.targetValue && (k.currentValue / k.targetValue) >= 0.7).length

  const inYear = data.projects.filter((p) => projectMonthSpan(p, year))

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-primary/10 to-violet-500/5">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-amber-500 to-rose-500" />
        <CardHeader className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>السنة {year}</CardTitle>
            <CardDescription>نظرة شاملة على عناصر الخطة في هذه السنة.</CardDescription>
          </div>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm tabular-nums"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[year - 1, year, year + 1, year + 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardHeader>
            <CardDescription>الأهداف</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-emerald-700">{data.objectives.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={objAvg} className="h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">متوسط التقدم {objAvg}%</p>
          </CardContent>
        </Card>
        <Card className="border-sky-200 bg-sky-50/60">
          <CardHeader>
            <CardDescription>المبادرات النشطة</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-sky-700">{activeInit}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">من إجمالي {data.initiatives.length}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardDescription>المشاريع النشطة</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-amber-700">{activeProj}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">من إجمالي {data.projects.length}</p>
          </CardContent>
        </Card>
        <Card className="border-violet-200 bg-violet-50/60">
          <CardHeader>
            <CardDescription>مؤشرات في المسار</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-violet-700">{kpisOnTrack}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">من إجمالي {data.kpis.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>خط زمن المشاريع</CardTitle>
          <CardDescription>{inYear.length} مشروع نشط في {year}. <Link to="/gantt-chart" className="text-primary underline">عرض جانت كامل ←</Link></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[180px_repeat(12,minmax(0,1fr))] gap-1 text-xs">
                <div />
                {MONTHS.map((m) => (
                  <div key={m} className="text-center font-medium text-muted-foreground">{m}</div>
                ))}
                {inYear.map((p) => {
                  const span = projectMonthSpan(p, year)
                  if (!span) return null
                  return (
                    <PrjRow key={p.id} project={p} startM={span.start} endM={span.end} />
                  )
                })}
                {inYear.length === 0 && (
                  <div className="col-span-13 py-4 text-center text-xs text-muted-foreground">لا توجد مشاريع في هذه السنة.</div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الأهداف وتقدمها</CardTitle>
          <CardDescription>التقدم محسوب من النتائج الرئيسية المرتبطة.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {data.objectives.map((o) => {
              const p = objectiveProgress(o)
              return (
                <li key={o.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{o.title}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">{p}%</span>
                  </div>
                  <Progress value={p} className="mt-1 h-1.5" />
                </li>
              )
            })}
            {data.objectives.length === 0 && (
              <li className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                لا توجد أهداف. <Link to="/objectives" className={buttonVariants({ variant: 'link' })}>أضف هدفك الأول</Link>
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}

function PrjRow({ project, startM, endM }: { project: Project; startM: number; endM: number }) {
  // Compose grid placement
  const cells = []
  for (let i = 0; i < 12; i += 1) {
    const inBar = i >= startM && i <= endM
    cells.push(
      <div key={i} className={`h-7 rounded ${inBar ? 'bg-primary/60' : 'border bg-muted/30'}`}>
        {inBar && (i === startM) && (
          <span className="block px-1 text-[10px] font-medium text-primary-foreground">
            {project.title.slice(0, 24)}
          </span>
        )}
      </div>,
    )
  }
  return (
    <>
      <div className="flex items-center pr-2 text-xs font-medium">{project.title}</div>
      {cells}
    </>
  )
}
