import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { createProject, getArtifact, listProjects, listTasks, type Project, type Task } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

interface DateRange {
  start: Date
  end: Date
  totalDays: number
}

function rangeOf(items: { startDate?: string | null; endDate?: string | null; dueDate?: string | null }[]): DateRange | null {
  const dates: number[] = []
  for (const i of items) {
    if (i.startDate) dates.push(new Date(i.startDate).getTime())
    if (i.endDate)   dates.push(new Date(i.endDate).getTime())
    if (i.dueDate)   dates.push(new Date(i.dueDate).getTime())
  }
  if (dates.length === 0) return null
  const start = new Date(Math.min(...dates))
  const end = new Date(Math.max(...dates))
  start.setDate(1)
  const e = new Date(end)
  e.setMonth(e.getMonth() + 1, 0)
  const totalDays = Math.max(1, Math.round((e.getTime() - start.getTime()) / 86400000))
  return { start, end: e, totalDays }
}

function pctOffset(date: string, r: DateRange): number {
  const d = new Date(date)
  return Math.max(0, Math.min(100, ((d.getTime() - r.start.getTime()) / 86400000 / r.totalDays) * 100))
}

function monthMarkers(r: DateRange): { label: string; left: number }[] {
  const out: { label: string; left: number }[] = []
  const cur = new Date(r.start)
  while (cur < r.end) {
    out.push({
      label: `${MONTHS_AR[cur.getMonth()]} ${cur.getFullYear()}`,
      left: ((cur.getTime() - r.start.getTime()) / 86400000 / r.totalDays) * 100,
    })
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}

const STATUS_COLOR: Record<string, string> = {
  active:      'bg-sky-500',
  planning:    'bg-amber-500',
  done:        'bg-emerald-500',
  paused:      'bg-slate-400',
  cancelled:   'bg-rose-500',
  todo:        'bg-slate-500',
  in_progress: 'bg-sky-500',
}

// تنسيق تاريخ قصير (يوم/شهر) — لقائمة خطوات الإنقاذ.
function fmtDay(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
}

export function GanttChartPage() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const from = params.get('from')
  const parts = ['tab=gantt']
  if (client) parts.push(`client=${client}`)
  if (from) parts.push(`from=${from}`)
  return <Navigate to={`/execute?${parts.join('&')}`} replace />
}

export function GanttChartView({ companyId }: { companyId: string }) {
  return <Chart companyId={companyId} />
}

function IntroCard() {
  return (
    <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
      <CardContent className="p-4 text-xs leading-relaxed">
        <div className="flex items-start gap-3">
          <div className="text-2xl leading-none">📅</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-foreground">ما هو مخطّط جانت؟</div>
            <p className="mt-1 text-muted-foreground">
              عرض زمني لكل خطوات تنفيذ مبادراتك ومهامها على خطّ الوقت — لتعرف <b className="text-foreground">من متى إلى متى</b> يجري كل شيء،
              أين تتداخل الجداول، وماذا يتخلّف عن الموعد.
            </p>
            <p className="mt-1 text-muted-foreground">
              <b className="text-foreground">استعمله عندما:</b> صنّفت المهام (أيزنهاور) وحدّدت المسؤوليات (RACI)،
              وتحتاج جدولاً زمنياً موحّداً.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Chart({ companyId }: { companyId: string }) {
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const [params] = useSearchParams()
  const isRescueMode = params.get('from') === 'emergency'
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  // جاهزيّة أيزنهاور: هل توجد مهام «افعل الآن»؟ (null = جارٍ التحقّق)
  const [eisenReady, setEisenReady] = useState<boolean | null>(null)

  useEffect(() => {
    Promise.all([listProjects(companyId), listTasks(companyId)])
      .then(([p, t]) => { setProjects(p); setTasks(t) })
      .catch(() => undefined)
      .finally(() => setLoading(false))
    // نتحقّق من جاهزيّة أيزنهاور لإرشاد المستخدم بدل رسالة خطأ عند التوليد.
    getArtifact<{ tasks?: Array<{ quadrant: string; title?: string }> }>(companyId, 'EISENHOWER')
      .then((a) => setEisenReady((a?.data?.tasks ?? []).some((t) => t.quadrant === 'do' && !!t.title?.trim())))
      .catch(() => setEisenReady(false))
  }, [companyId])

  // 🚨 توليد جدول إنقاذ ٩٠ يوم — من مهام «افعل الآن» في أيزنهاور
  //    ينشئ ٤-٦ خطوات تنفيذ متتابعة (كل ٢ أسبوع) لإطلاق التنفيذ فوراً.
  async function generateRescueTimeline() {
    setGenerating(true)
    try {
      const artifact = await getArtifact<{ tasks?: Array<{ id: string; title: string; quadrant: string }> }>(companyId, 'EISENHOWER')
      const doTasks = (artifact?.data?.tasks ?? []).filter((t) => t.quadrant === 'do' && t.title?.trim())
      if (doTasks.length === 0) {
        toast.error('لا مهام في «افعل الآن» بأيزنهاور — ولّدها من المخاطر أوّلاً.')
        return
      }
      const now = new Date()
      const created: Project[] = []
      // كل خطوة ٢ أسبوعان، متتابعة (١-٢، ٣-٤، ٥-٦، ...)
      for (let i = 0; i < Math.min(6, doTasks.length); i++) {
        const start = new Date(now)
        start.setDate(now.getDate() + i * 14)
        const end = new Date(start)
        end.setDate(start.getDate() + 14)
        try {
          const p = await createProject({
            companyId,
            title: `[إنقاذ ${i + 1}] ${doTasks[i].title.slice(0, 60)}${doTasks[i].title.length > 60 ? '…' : ''}`,
            description: `خطوة تنفيذ عاجلة (٢ أسابيع) — من مصفوفة أيزنهاور «افعل الآن».`,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          })
          created.push(p)
        } catch { /* skip */ }
      }
      if (created.length === 0) {
        toast.error('تعذّر إنشاء الخطوات.')
        return
      }
      setProjects((prev) => [...prev, ...created])
      toast.success(`🚨 أُنشئت ${created.length} خطوات إنقاذ متتابعة — ابدأ بالأولى الآن.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
    }
  }

  const range = useMemo(() => {
    const items = [
      ...projects.map((p) => ({ startDate: p.startDate, endDate: p.endDate })),
      ...tasks.map((t) => ({ dueDate: t.dueDate })),
    ]
    return rangeOf(items)
  }, [projects, tasks])

  // الجانت يجب أن يتدرّج زمنيًّا على المسار: ترتيب الصفوف بتاريخ البدء (بلا تاريخ → الأخير)
  // كي «تمشي» الأشرطة يسارًا→يمينًا بترتيب التنفيذ، لا بترتيب قائمة الـAPI (إنشاء/id).
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => {
      const at = a.startDate ? new Date(a.startDate).getTime() : Infinity
      const bt = b.startDate ? new Date(b.startDate).getTime() : Infinity
      return at - bt
    }),
    [projects],
  )

  if (loading) return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>

  if (!range) {
    return (
      <>
        <IntroCard />
        {specialty && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
              <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
                🎯 السياق: إدارة {DEPT_LABEL[specialty as DeptCode]}
              </span>
            </CardContent>
          </Card>
        )}
        {/* 🚨 في وضع الطوارئ: زرّ توليد جدول إنقاذ ٩٠ يوم فوريّ */}
        {isRescueMode ? (
          <Card className="overflow-hidden border-2 border-rose-500 bg-gradient-to-l from-rose-50 via-rose-50/50 to-transparent shadow-md">
            <div className="h-1.5 bg-gradient-to-l from-rose-600 via-rose-500 to-rose-400" />
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="text-5xl">🚨</div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-rose-400 bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-900">
                      الخطوة ٤ من ٤ · جدول إنقاذ ٩٠ يوم
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-rose-900">ولّد جدولاً زمنياً فورياً من مهام أيزنهاور</h2>
                  <p className="mt-1 text-xs leading-relaxed text-rose-800/80">
                    بدل إنشاء كل خطوة تنفيذ يدوياً، اضغط الزرّ لتوليد <b>٤-٦ خطوات إنقاذ متتابعة</b> (كلّ خطوة ٢ أسبوعان)
                    من مهام «افعل الآن» في أيزنهاور. النتيجة: جدول جاهز مع تواريخ سترى المخطّط فوراً.
                  </p>
                  {eisenReady === false ? (
                    // أيزنهاور غير جاهز → أرشِد للخطوات السابقة بدل زرّ يُخفق.
                    <div className="mt-3 rounded-lg border-2 border-rose-300 bg-white/70 p-3">
                      <div className="text-xs font-bold text-rose-900">
                        لا توجد مهام «افعل الآن» في أيزنهاور بعد — أكمل ما قبلها أوّلاً بالترتيب:
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          to={`/risk-map?client=${companyId}&from=emergency`}
                          className="inline-flex items-center gap-1 rounded-lg border-2 border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-900 transition hover:-translate-y-0.5 hover:border-rose-500"
                        >
                          ① ⚠️ سجّل مخاطرك <b>وقيّم خطورتها</b>
                        </Link>
                        <Link
                          to={`/eisenhower?client=${companyId}&from=emergency`}
                          className="inline-flex items-center gap-1 rounded-lg border-2 border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-900 transition hover:-translate-y-0.5 hover:border-rose-500"
                        >
                          ② 🎯 افرزها في أيزنهاور
                        </Link>
                      </div>
                      <div className="mt-2 text-[11px] text-rose-800/80">
                        ⚠️ المخاطر المستوردة من التدقيق تدخل <b>غير مُقيَّمة (١/١)</b> — <b>ارفع احتمالها وأثرها</b> في خريطة المخاطر أوّلاً، وإلّا لن تظهر في «افعل الآن» فيبقى الجدول فارغاً. بعد الفرز، ارجع هنا فيجهز زرّ توليد الجدول.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Button
                          onClick={generateRescueTimeline}
                          disabled={generating || eisenReady === null}
                          size="lg"
                          className="bg-rose-600 hover:bg-rose-700"
                        >
                          {generating ? 'جاري التوليد…' : eisenReady === null ? 'جارٍ التحقّق…' : '🚨 ولّد جدول الإنقاذ الآن'}
                        </Button>
                        <Link to="/execute?tab=projects&from=emergency" className="text-xs text-rose-700 underline-offset-4 hover:underline">
                          أو أنشئ خطوة يدوياً ←
                        </Link>
                      </div>
                      <div className="mt-3 rounded-lg border border-rose-300 bg-rose-100/60 p-2 text-[11px] text-rose-900">
                        <b>💡 كيف يعمل؟</b> يقرأ artifact `EISENHOWER` → يأخذ أوّل ٦ مهام «افعل الآن» → ينشئ لكل واحدة خطوة تنفيذ بمدّة ٢ أسبوعان،
                        مع تواريخ متتابعة (١-٢، ٣-٤، ٥-٦…). يمكنك تعديل التواريخ بعد التوليد.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-dashed border-amber-300 bg-amber-50/40">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-start gap-3">
                <div className="text-3xl">🗓️</div>
                <div>
                  <div className="text-sm font-bold text-amber-900">لا توجد خطوات تنفيذ بتواريخ بعد</div>
                  <div className="mt-0.5 text-xs text-amber-800/80">
                    أنشئ خطوة تنفيذ لمبادرة (تاريخ بداية + نهاية + مسؤول) من «متابعة المبادرات» لتظهر على المخطّط.
                  </div>
                </div>
              </div>
              <Link to="/execute?tab=projects" className={buttonVariants({ variant: 'default' })}>
                افتح متابعة المبادرات ←
              </Link>
            </CardContent>
          </Card>
        )}
      </>
    )
  }

  const markers = monthMarkers(range)
  const todayPct = pctOffset(new Date().toISOString(), range)
  // خطوات الإنقاذ مرتّبة بتاريخ البداية — لعرضها كقائمة مفهومة في وضع الطوارئ.
  const rescueSteps = isRescueMode
    ? [...projects].sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime())
    : []

  return (
    <>
      <IntroCard />

      {specialty && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
            <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
              🎯 السياق: إدارة {DEPT_LABEL[specialty as DeptCode]}
            </span>
            <span className="text-muted-foreground">
              خطوات تنفيذ مبادراتك ومهامها لهذا العميل — جانت يعرضها كلها معاً على خطّ الوقت.
            </span>
          </CardContent>
        </Card>
      )}

      {/* 🚨 خطة الإنقاذ ٩٠ يوم — قائمة مفهومة بالخطوات قبل المخطّط البصريّ */}
      {isRescueMode && rescueSteps.length > 0 && (
        <Card className="overflow-hidden border-2 border-rose-300 bg-rose-50/40">
          <div className="h-1 bg-gradient-to-l from-rose-500 to-rose-300" />
          <CardHeader>
            <CardTitle className="text-base text-rose-900">🚨 خطة الإنقاذ ٩٠ يوم — {rescueSteps.length} خطوات متتابعة</CardTitle>
            <CardDescription>
              نفّذها بالترتيب: خطوة كل أسبوعين. ابدأ بالأولى الآن — لا تقفز للأمام قبل إكمالها.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {rescueSteps.map((p, i) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-rose-600 text-xs font-bold text-white tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{p.title.replace(/^\[إنقاذ \d+\]\s*/, '')}</div>
                    <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                      📅 {fmtDay(p.startDate)} → {fmtDay(p.endDate)} · أسبوعان
                    </div>
                  </div>
                  <Link
                    to={`/execute?tab=tasks&client=${companyId}&from=emergency`}
                    className="shrink-0 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100"
                  >
                    مهامها ←
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-3 rounded-md border border-rose-200 bg-white/60 p-2 text-[11px] text-rose-900">
              💡 المخطّط الزمنيّ أدناه يعرض نفس الخطوات على خطّ الوقت. بعد إكمالها تخرج من وضع الإنقاذ إلى المتابعة الأسبوعيّة.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden bg-gradient-to-bl from-primary/5 to-violet-500/5">
        <CardHeader>
          <CardTitle>الفترة الزمنية</CardTitle>
          <CardDescription>
            من {range.start.toLocaleDateString('ar-SA')} إلى {range.end.toLocaleDateString('ar-SA')} ·{' '}
            {projects.length} خطوة تنفيذ · {tasks.filter((t) => t.dueDate).length} مهمة بتاريخ.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>خطوات تنفيذ المبادرات</CardTitle>
            <CardDescription>كل سطر يمثّل خطوة تنفيذ لمبادرة، عرض الشريط = مدّة الخطوة. الخطّ الأحمر = اليوم.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFullscreen(true)} className="shrink-0">
            ⛶ عرض كامل
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="relative h-6 border-b">
                {markers.map((m, i) => (
                  <div
                    key={i}
                    className="absolute top-0 text-xs text-muted-foreground"
                    style={{ insetInlineStart: `${m.left}%` }}
                  >
                    <span className="-translate-x-1/2 px-1">{m.label}</span>
                  </div>
                ))}
              </div>

              <div className="relative">
                {sortedProjects.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    tasks={tasks.filter((t) => t.projectId === p.id)}
                    range={range}
                    todayPct={todayPct}
                  />
                ))}
              </div>

              {projects.length === 0 && (
                <div className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  لا توجد خطوات تنفيذ.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🎯 الخطوة التالية — احسب أثر الجدول على المالية.
          مُخفاة في وضع الطوارئ: خطة الإنقاذ تنفيذيّة، لا مكان للتحليل المالي هنا. */}
      {!isRescueMode && projects.length > 0 && (
        <Card className="border-emerald-300 bg-emerald-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💰</div>
              <div>
                <div className="text-sm font-bold text-emerald-900">الخطوة التالية: احسب الأثر المالي</div>
                <div className="text-xs text-emerald-800/80">
                  الآن وعندك جدول زمني، احسب Dupont لعائد الاستثمار وMonte Carlo لسيناريوهات الربح.
                </div>
              </div>
            </div>
            <Link to="/financial-analysis" className={buttonVariants({ variant: 'default' })}>
              افتح التحليل المالي ←
            </Link>
          </CardContent>
        </Card>
      )}

      {tasks.filter((t) => t.dueDate && !t.projectId).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>مهام عامة</CardTitle>
            <CardDescription>مهام بدون خطوة تنفيذ، مرتّبة بتاريخ الاستحقاق.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {tasks.filter((t) => t.dueDate && !t.projectId).map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-md border bg-card p-2">
                  <span>{t.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{new Date(t.dueDate!).toLocaleDateString('ar-SA')}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ─── العرض الكامل — صفحة كاملة بتفاصيل أوضح (صفوف أكبر + تواريخ) ─── */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
            <div>
              <div className="text-base font-bold">📅 مخطّط جانت — العرض الكامل</div>
              <div className="text-xs text-muted-foreground tabular-nums">
                من {range.start.toLocaleDateString('ar-SA')} إلى {range.end.toLocaleDateString('ar-SA')} ·{' '}
                {projects.length} خطوة تنفيذ · {tasks.filter((t) => t.dueDate).length} مهمة بتاريخ
              </div>
            </div>
            <Button variant="outline" onClick={() => setFullscreen(false)} className="shrink-0">
              ✕ إغلاق العرض الكامل
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="min-w-[1200px]">
              <div className="relative mb-2 h-6 border-b">
                {markers.map((m, i) => (
                  <div
                    key={i}
                    className="absolute top-0 text-xs text-muted-foreground"
                    style={{ insetInlineStart: `${m.left}%` }}
                  >
                    <span className="-translate-x-1/2 px-1">{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="relative">
                {sortedProjects.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    tasks={tasks.filter((t) => t.projectId === p.id)}
                    range={range}
                    todayPct={todayPct}
                    detailed
                  />
                ))}
                {projects.length === 0 && (
                  <div className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                    لا توجد خطوات تنفيذ.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ProjectRow({
  project, tasks, range, todayPct, detailed = false,
}: {
  project: Project
  tasks: Task[]
  range: DateRange
  todayPct: number
  /** الوضع التفصيلي (العرض الكامل): صفوف أكبر + عرض تواريخ الخطوة. */
  detailed?: boolean
}) {
  const gridCols = detailed ? 'grid-cols-[240px_1fr]' : 'grid-cols-[180px_1fr]'
  if (!project.startDate || !project.endDate) {
    return (
      <div className={`my-2 grid ${gridCols} items-center gap-2`}>
        <div className="text-xs font-medium">{project.title}</div>
        <div className="rounded-md border border-dashed bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">بدون تواريخ</div>
      </div>
    )
  }
  const startPct = pctOffset(project.startDate, range)
  const endPct   = pctOffset(project.endDate, range)
  const widthPct = Math.max(2, endPct - startPct)
  const color = STATUS_COLOR[project.status] ?? 'bg-primary'
  const trackH = detailed ? 'h-12' : 'h-8'
  const barPos = detailed ? 'top-1.5 h-9' : 'top-1 h-6'

  return (
    <div className={`my-2 grid ${gridCols} items-center gap-2`}>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium" title={project.title}>{project.title}</div>
        {detailed && (
          <div className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
            {new Date(project.startDate).toLocaleDateString('ar-SA')} ← {new Date(project.endDate).toLocaleDateString('ar-SA')}
          </div>
        )}
      </div>
      <div className={`relative ${trackH} rounded-md bg-muted/30`}>
        <div
          className="absolute top-0 h-full w-px bg-rose-500/70"
          style={{ insetInlineStart: `${todayPct}%` }}
        />
        <div
          className={`absolute ${barPos} rounded ${color} shadow-sm flex items-center px-1 text-[10px] font-medium text-white`}
          style={{ insetInlineStart: `${startPct}%`, width: `${widthPct}%` }}
        >
          {widthPct >= (detailed ? 12 : 20) && <span className="truncate">{project.title}</span>}
        </div>
        {tasks.filter((t) => t.dueDate).map((t) => {
          const left = pctOffset(t.dueDate!, range)
          return (
            <div
              key={t.id}
              className="absolute top-0 h-full w-1 rounded bg-amber-500"
              style={{ insetInlineStart: `${left}%` }}
              title={`${t.title} — ${new Date(t.dueDate!).toLocaleDateString('ar-SA')}`}
            />
          )
        })}
      </div>
    </div>
  )
}
