import { useEffect, useMemo, useState } from 'react'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listProjects, listTasks, type Project, type Task } from '@/lib/strategicApi'

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

function Chart({ companyId }: { companyId: string }) {
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
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          لا توجد مشاريع أو مهام بتواريخ بعد. أضف بعض المشاريع لرؤيتها على المخطط.
        </CardContent>
      </Card>
    )
  }

  const markers = monthMarkers(range)
  const todayPct = pctOffset(new Date().toISOString(), range)

  return (
    <>
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
