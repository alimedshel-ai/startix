import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  listInitiatives, listKPIs, listObjectives, listProjects,
  type Initiative, type KPI, type Objective, type Project,
} from '@/lib/strategicApi'

// ─── الخطة السنويّة — تجميع + شرح + توجيه ─────────────────────────
// هذه الصفحة لا تُنشئ بيانات — بل تُجمّع كل ما بُني في المراحل الأخرى
// (أهداف · مبادرات · مشاريع · مؤشّرات) في نظرة سنويّة موحّدة، وتقسّمها
// إلى أرباع (Q1-Q4) لتخطيط المراجعات الدوريّة.

interface YearData {
  objectives: Objective[]
  initiatives: Initiative[]
  projects: Project[]
  kpis: KPI[]
}

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

const QUARTERS = [
  { key: 'Q1', labelAr: 'الربع الأوّل', months: [0, 1, 2],   accent: 'border-emerald-300 bg-emerald-50/60' },
  { key: 'Q2', labelAr: 'الربع الثاني', months: [3, 4, 5],   accent: 'border-sky-300 bg-sky-50/60' },
  { key: 'Q3', labelAr: 'الربع الثالث', months: [6, 7, 8],   accent: 'border-amber-300 bg-amber-50/60' },
  { key: 'Q4', labelAr: 'الربع الرابع', months: [9, 10, 11], accent: 'border-rose-300 bg-rose-50/60' },
] as const

function projectMonthSpan(p: Project, year: number): { start: number; end: number } | null {
  if (!p.startDate || !p.endDate) return null
  const s = new Date(p.startDate)
  const e = new Date(p.endDate)
  const startM = s.getFullYear() < year ? 0 : s.getFullYear() > year ? -1 : s.getMonth()
  const endM   = e.getFullYear() < year ? -1 : e.getFullYear() > year ? 11 : e.getMonth()
  if (startM < 0 || endM < 0 || startM > 11 || endM < startM) return null
  return { start: startM, end: endM }
}

function projectQuarter(p: Project, year: number): string | null {
  const span = projectMonthSpan(p, year)
  if (!span) return null
  const q = QUARTERS.find((q) => (q.months as readonly number[]).includes(span.end))
  return q?.key ?? null
}

function objectiveProgress(o: Objective): number {
  if (!o.okrs?.length) return 0
  const totals = o.okrs.map((k) => (k.targetValue === 0 ? 0 : Math.min(100, (k.currentValue / k.targetValue) * 100)))
  return Math.round(totals.reduce((s, v) => s + v, 0) / totals.length)
}

export function AnnualPlanPage() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const q = client ? `&client=${client}` : ''
  return <Navigate to={`/measure?tab=annual${q}`} replace />
}

export function AnnualPlanView({ companyId }: { companyId: string }) {
  return <Editor companyId={companyId} />
}

// شريط تنقّل ↔ يربط الخطة السنويّة بمصادرها وبأدوات المتابعة الدوريّة.
function CrossNavBar({ clientQuery }: { clientQuery: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2 text-xs">
      <span className="text-muted-foreground">
        💡 الخطة السنويّة = تجميع سنوي لكل ما بنيته — لا تُنشئ بيانات جديدة.
      </span>
      <div className="flex flex-wrap gap-2">
        <Link to={`/measure?tab=entries${clientQuery}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
          ✍️ إدخالات KPIs ←
        </Link>
        <Link to={`/priority?tab=initiatives${clientQuery}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
          💡 المبادرات ←
        </Link>
        <Link to={`/execute?tab=gantt${clientQuery}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-primary transition hover:bg-primary hover:text-primary-foreground">
          📅 مخطّط جانت ←
        </Link>
      </div>
    </div>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [params] = useSearchParams()
  const client = params.get('client')
  const clientQuery = client ? `&client=${client}` : ''

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

  const objAvg = data.objectives.length === 0
    ? 0
    : Math.round(data.objectives.reduce((s, o) => s + objectiveProgress(o), 0) / data.objectives.length)
  const activeInit = data.initiatives.filter((i) => i.status === 'in_progress' || i.status === 'planned').length
  const activeProj = data.projects.filter((p) => p.status === 'active').length
  const kpisOnTrack = data.kpis.filter((k) => k.targetValue && (k.currentValue / k.targetValue) >= 0.7).length

  const inYear = data.projects.filter((p) => projectMonthSpan(p, year))

  // ─── تجميع الأرباع (Q1-Q4) — توليد تلقائي من تواريخ المشاريع ─
  const projectsByQuarter = useMemo(() => {
    const map: Record<string, Project[]> = { Q1: [], Q2: [], Q3: [], Q4: [] }
    for (const p of inYear) {
      const q = projectQuarter(p, year)
      if (q) map[q].push(p)
    }
    return map
  }, [inYear, year])

  const totalDataPoints = data.objectives.length + data.initiatives.length + data.projects.length + data.kpis.length
  const hasNoData = totalDataPoints === 0

  if (loading) return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>

  return (
    <>
      <CrossNavBar clientQuery={clientQuery} />
      <IntroCard totalDataPoints={totalDataPoints} />

      {/* رأس السنة + مبدّل السنة */}
      <Card className="overflow-hidden bg-gradient-to-bl from-primary/10 to-violet-500/5">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-amber-500 to-rose-500" />
        <CardHeader className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              🗓️ الخطة السنويّة — {year}
            </CardTitle>
            <CardDescription>
              تجميع كل عناصر الخطة الاستراتيجيّة في نظرة موحّدة، مُقسّمة إلى ٤ أرباع.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">السنة:</label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm tabular-nums"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[year - 1, year, year + 1, year + 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              title="اطبع الصفحة كـPDF"
            >
              🖨️ طباعة
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* حالة بلا بيانات */}
      {hasNoData && (
        <Card className="border-2 border-amber-300 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="text-base text-amber-900">⚠️ لا بيانات لعرضها بعد</CardTitle>
            <CardDescription>
              الخطة السنويّة تعرض ما بنيته في الأدوات الأخرى. ابدأ ببناء أهداف ومؤشّرات ومبادرات وخطوات تنفيذ.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link to={`/measure?tab=objectives${clientQuery}`} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
              🎯 ابدأ بالأهداف →
            </Link>
            <Link to={`/measure?tab=kpis${clientQuery}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted">
              📊 KPIs →
            </Link>
            <Link to={`/priority?tab=initiatives${clientQuery}`} className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted">
              💡 المبادرات →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* بطاقات إحصاء إجماليّة — مع روابط للمصادر */}
      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard
          title="الأهداف"
          value={data.objectives.length}
          accent="border-emerald-200 bg-emerald-50/60 text-emerald-700"
          progress={objAvg}
          hint={`متوسّط التقدّم ${objAvg}٪`}
          linkTo={`/measure?tab=objectives${clientQuery}`}
        />
        <SummaryCard
          title="المبادرات النشطة"
          value={activeInit}
          accent="border-sky-200 bg-sky-50/60 text-sky-700"
          hint={`من إجمالي ${data.initiatives.length}`}
          linkTo={`/priority?tab=initiatives${clientQuery}`}
        />
        <SummaryCard
          title="خطوات التنفيذ النشطة"
          value={activeProj}
          accent="border-amber-200 bg-amber-50/60 text-amber-700"
          hint={`من إجمالي ${data.projects.length}`}
          linkTo={`/execute?tab=projects${clientQuery}`}
        />
        <SummaryCard
          title="مؤشّرات في المسار"
          value={kpisOnTrack}
          accent="border-violet-200 bg-violet-50/60 text-violet-700"
          hint={`من إجمالي ${data.kpis.length}`}
          linkTo={`/measure?tab=kpis${clientQuery}`}
        />
      </div>

      {/* 🗓️ التجميع الرباعي — توليد تلقائي من تواريخ خطوات التنفيذ */}
      {inYear.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🗓️ التقسيم الرباعي (Q1 → Q4)</CardTitle>
            <CardDescription>
              مُولَّد تلقائياً من تواريخ انتهاء خطوات التنفيذ. استخدمه لتخطيط المراجعات الربعيّة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {QUARTERS.map((q) => {
                const list = projectsByQuarter[q.key] ?? []
                return (
                  <div key={q.key} className={`rounded-xl border-2 p-3 ${q.accent}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{q.labelAr}</span>
                      <span className="rounded-full border bg-white px-2 py-0.5 text-xs font-medium tabular-nums">
                        {list.length} خطوة
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {MONTHS[q.months[0]]} → {MONTHS[q.months[2]]}
                    </div>
                    <ul className="mt-2 space-y-1 text-xs">
                      {list.length === 0 && (
                        <li className="rounded-md border border-dashed bg-white/40 p-1.5 text-center text-muted-foreground">
                          بلا خطوات تنفيذ
                        </li>
                      )}
                      {list.slice(0, 4).map((p) => (
                        <li key={p.id} className="truncate rounded-md border bg-white/70 p-1.5">
                          {p.title}
                        </li>
                      ))}
                      {list.length > 4 && (
                        <li className="text-center text-[10px] text-muted-foreground">
                          + {list.length - 4} خطوة أخرى
                        </li>
                      )}
                    </ul>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* خطّ زمني بصري (Gantt-lite) لخطوات التنفيذ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📅 خطّ زمن خطوات التنفيذ</CardTitle>
          <CardDescription>
            {inYear.length} خطوة تنفيذ نشطة في {year}.{' '}
            <Link to={`/execute?tab=gantt${clientQuery}`} className="text-primary underline">
              عرض جانت الكامل ←
            </Link>
          </CardDescription>
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
                  <div className="col-span-full py-4 text-center text-xs text-muted-foreground">
                    لا توجد خطوات تنفيذ في هذه السنة.
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* الأهداف وتقدّمها */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🎯 الأهداف الاستراتيجيّة وتقدّمها</CardTitle>
          <CardDescription>التقدّم محسوب من النتائج الرئيسيّة المرتبطة (OKRs).</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {data.objectives.map((o) => {
              const p = objectiveProgress(o)
              const krCount = o.okrs?.length ?? 0
              return (
                <li key={o.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{o.title}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded border bg-muted/30 px-1.5 py-0.5 text-muted-foreground">
                        {krCount} KR
                      </span>
                      <span className="tabular-nums text-muted-foreground">{p}%</span>
                    </div>
                  </div>
                  <Progress value={p} className="mt-1 h-1.5" />
                </li>
              )
            })}
            {data.objectives.length === 0 && (
              <li className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                لا توجد أهداف.{' '}
                <Link to={`/measure?tab=objectives${clientQuery}`} className={buttonVariants({ variant: 'link' })}>
                  أضف هدفك الأوّل ←
                </Link>
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      {/* NextStepCTA — مسار المراجعة الدوريّة */}
      {!hasNoData && (
        <NextStepCTA
          hasKpiEntries={data.kpis.length > 0}
          clientQuery={clientQuery}
        />
      )}
    </>
  )
}

function SummaryCard({
  title, value, accent, progress, hint, linkTo,
}: { title: string; value: number; accent: string; progress?: number; hint: string; linkTo: string }) {
  return (
    <Link
      to={linkTo}
      className={`rounded-lg border-2 p-3 transition hover:-translate-y-0.5 hover:shadow ${accent}`}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      {progress !== undefined && <Progress value={progress} className="mt-2 h-1.5" />}
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">{hint}</p>
      <div className="mt-2 text-[10px] text-primary">افتح ←</div>
    </Link>
  )
}

function PrjRow({ project, startM, endM }: { project: Project; startM: number; endM: number }) {
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

function IntroCard({ totalDataPoints }: { totalDataPoints: number }) {
  return (
    <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
      <CardContent className="p-4 text-xs leading-relaxed">
        <div className="flex items-start gap-3">
          <div className="text-3xl leading-none">🗓️</div>
          <div className="flex-1 space-y-2">
            <div>
              <div className="text-sm font-bold text-foreground">ما هي الخطة السنويّة؟</div>
              <p className="mt-1 text-muted-foreground">
                <b className="text-foreground">تجميع</b> لا إنشاء. تعرض كل ما بنيته في الأدوات الأخرى (أهداف · مبادرات · خطوات تنفيذ · KPIs)
                على مقياس سنة كاملة، وتقسّمه إلى ٤ أرباع للمتابعة الدوريّة.
              </p>
            </div>
            <div className="grid gap-1.5 md:grid-cols-2">
              <div className="rounded-md border border-dashed bg-white/70 p-2">
                <b className="text-foreground">← يأتي من:</b>{' '}
                <span className="text-muted-foreground">الأهداف · OKRs · KPIs · المبادرات · خطوات التنفيذ</span>
              </div>
              <div className="rounded-md border border-dashed bg-white/70 p-2">
                <b className="text-foreground">→ يذهب إلى:</b>{' '}
                <span className="text-muted-foreground">المراجعات الدوريّة · التقارير التنفيذيّة · جانت</span>
              </div>
            </div>
            {totalDataPoints > 0 && (
              <div className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-800">
                <b>💡 الاستخدام الأمثل:</b> افتحها في نهاية كل ربع لمراجعة ما اكتمل، وما تأخّر، وما يحتاج تعديل.
                استخدم زرّ «🖨️ طباعة» لتوليد PDF جاهز للمشاركة.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function NextStepCTA({
  hasKpiEntries, clientQuery,
}: { hasKpiEntries: boolean; clientQuery: string }) {
  return (
    <Card className="border-2 border-primary/40 bg-gradient-to-l from-primary/10 to-transparent">
      <CardHeader>
        <CardTitle className="text-base">🎯 خيارات الخطوة التاليّة</CardTitle>
        <CardDescription>
          الخطة السنويّة نقطة توقّف — منها تتفرّع ٣ مسارات حسب هدفك.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          {/* المتابعة الدوريّة */}
          <Link
            to={`/measure?tab=entries${clientQuery}`}
            className="rounded-lg border-2 border-emerald-300 bg-emerald-50/40 p-3 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
              <span className="text-lg">✍️</span>
              <span>تحديث دوري</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              سجّل قيم KPIs الأسبوعيّة/الشهريّة لتُغذّي هذه الخطة بأرقامٍ حيّة.
            </p>
            {hasKpiEntries ? (
              <span className="mt-2 inline-block text-[10px] text-emerald-700">→ إدخالات KPIs</span>
            ) : (
              <span className="mt-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-800">
                ⚠️ ابدأ التسجيل — لا إدخالات بعد
              </span>
            )}
          </Link>

          {/* التنفيذ التشغيلي */}
          <Link
            to={`/execute?tab=gantt${clientQuery}`}
            className="rounded-lg border-2 border-sky-300 bg-sky-50/40 p-3 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-sky-900">
              <span className="text-lg">📅</span>
              <span>مخطّط جانت</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              اطّلع على التوزيع الزمني الكامل لخطوات التنفيذ مع تبعياتها.
            </p>
            <span className="mt-2 inline-block text-[10px] text-sky-700">→ /execute?tab=gantt</span>
          </Link>

          {/* المراجعة الاستراتيجيّة */}
          <Link
            to={`/priority?tab=risk${clientQuery}`}
            className="rounded-lg border-2 border-amber-300 bg-amber-50/40 p-3 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <span className="text-lg">⚠️</span>
              <span>مراجعة المخاطر</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              راجع مخاطر تنفيذ الخطة — ما هي عوائق الأرباع القادمة؟
            </p>
            <span className="mt-2 inline-block text-[10px] text-amber-700">→ /priority?tab=risk</span>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
