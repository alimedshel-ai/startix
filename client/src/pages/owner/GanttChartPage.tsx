import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { listProjects, listTasks, type Project, type Task } from '@/lib/strategicApi'
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

export function GanttChartPage() {
  return (
    <StrategicShell
      title="مخطط جانت"
      description="عرض زمني تفاعلي للمشاريع والمهام. أشرطة ملوّنة حسب الحالة."
    >
      {(companyId) => <Chart companyId={companyId} />}
    </StrategicShell>
  )
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
              عرض زمني لكل مشاريعك ومهامك على خطّ الوقت — لتعرف <b className="text-foreground">من متى إلى متى</b> يجري كل شيء،
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
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listProjects(companyId), listTasks(companyId)])
      .then(([p, t]) => { setProjects(p); setTasks(t) })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [companyId])

  const range = useMemo(() => {
    const items = [
      ...projects.map((p) => ({ startDate: p.startDate, endDate: p.endDate })),
      ...tasks.map((t) => ({ dueDate: t.dueDate })),
    ]
    return rangeOf(items)
  }, [projects, tasks])

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
        <Card className="border-2 border-dashed border-amber-300 bg-amber-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <div className="text-3xl">🗓️</div>
              <div>
                <div className="text-sm font-bold text-amber-900">لا توجد مشاريع أو مهام بتواريخ بعد</div>
                <div className="mt-0.5 text-xs text-amber-800/80">
                  أنشئ مشروعاً بتاريخ بداية ونهاية من صفحة المشاريع لتراه على المخطّط.
                </div>
              </div>
            </div>
            <Link to="/projects" className={buttonVariants({ variant: 'default' })}>
              افتح المشاريع ←
            </Link>
          </CardContent>
        </Card>
      </>
    )
  }

  const markers = monthMarkers(range)
  const todayPct = pctOffset(new Date().toISOString(), range)

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
              مشاريعك ومهامك لهذا العميل — مخطّط جانت يعرضها كلها معاً على خطّ الوقت.
            </span>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden bg-gradient-to-bl from-primary/5 to-violet-500/5">
        <CardHeader>
          <CardTitle>الفترة الزمنية</CardTitle>
          <CardDescription>
            من {range.start.toLocaleDateString('ar-SA')} إلى {range.end.toLocaleDateString('ar-SA')} ·{' '}
            {projects.length} مشروع · {tasks.filter((t) => t.dueDate).length} مهمة بتاريخ.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المشاريع</CardTitle>
          <CardDescription>كل سطر يمثّل مشروعاً، عرض الشريط = مدة المشروع. الخط الأحمر = اليوم.</CardDescription>
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
                {projects.map((p) => (
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
                  لا توجد مشاريع.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🎯 الخطوة التالية — احسب أثر الجدول على المالية */}
      {projects.length > 0 && (
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
            <CardDescription>مهام بدون مشروع، مرتبة بتاريخ الاستحقاق.</CardDescription>
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
    </>
  )
}

function ProjectRow({
  project, tasks, range, todayPct,
}: {
  project: Project
  tasks: Task[]
  range: DateRange
  todayPct: number
}) {
  if (!project.startDate || !project.endDate) {
    return (
      <div className="my-2 grid grid-cols-[180px_1fr] items-center gap-2">
        <div className="text-xs font-medium">{project.title}</div>
        <div className="rounded-md border border-dashed bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">بدون تواريخ</div>
      </div>
    )
  }
  const startPct = pctOffset(project.startDate, range)
  const endPct   = pctOffset(project.endDate, range)
  const widthPct = Math.max(2, endPct - startPct)
  const color = STATUS_COLOR[project.status] ?? 'bg-primary'

  return (
    <div className="my-2 grid grid-cols-[180px_1fr] items-center gap-2">
      <div className="truncate text-xs font-medium" title={project.title}>{project.title}</div>
      <div className="relative h-8 rounded-md bg-muted/30">
        <div
          className="absolute top-0 h-full w-px bg-rose-500/70"
          style={{ insetInlineStart: `${todayPct}%` }}
        />
        <div
          className={`absolute top-1 h-6 rounded ${color} shadow-sm flex items-center px-1 text-[10px] font-medium text-white`}
          style={{ insetInlineStart: `${startPct}%`, width: `${widthPct}%` }}
        >
          {widthPct >= 20 && <span className="truncate">{project.title}</span>}
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
