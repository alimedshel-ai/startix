import { useEffect, useMemo, useState } from 'react'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  listActivity, listKPIs, listObjectives, listTasks,
  type ActivityRow, type KPI, type Objective, type Task,
} from '@/lib/strategicApi'

const REFRESH_MS = 30_000

function kpiPct(k: KPI): number {
  if (!k.targetValue) return 0
  return Math.min(150, Math.round((k.currentValue / k.targetValue) * 100))
}

function objProgress(o: Objective): number {
  if (!o.okrs?.length) return 0
  const totals = o.okrs.map((k) => (k.targetValue === 0 ? 0 : Math.min(100, (k.currentValue / k.targetValue) * 100)))
  return Math.round(totals.reduce((s, v) => s + v, 0) / totals.length)
}

function tint(p: number): { ring: string; text: string } {
  if (p >= 95) return { ring: 'ring-emerald-500/30', text: 'text-emerald-700' }
  if (p >= 70) return { ring: 'ring-sky-500/30',     text: 'text-sky-700' }
  if (p >= 40) return { ring: 'ring-amber-500/30',   text: 'text-amber-700' }
  return { ring: 'ring-rose-500/30', text: 'text-rose-700' }
}

function fmtRelative(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `${mins}د`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}س`
  return `${Math.floor(h / 24)}ي`
}

export function LiveBoardPage() {
  return (
    <StrategicShell title="اللوحة الحية" description="تحديث آني كل 30 ثانية. مقاييس فورية، تقدم الأهداف، والأحداث الأخيرة.">
      {(companyId) => <Board companyId={companyId} />}
    </StrategicShell>
  )
}

function Board({ companyId }: { companyId: string }) {
  const [kpis, setKpis] = useState<KPI[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false

    async function refresh() {
      try {
        const [k, o, t, a] = await Promise.all([
          listKPIs(companyId),
          listObjectives(companyId),
          listTasks(companyId),
          listActivity(companyId),
        ])
        if (cancel) return
        setKpis(k); setObjectives(o); setTasks(t); setActivity(a)
        setLastRefresh(new Date())
      } catch {
        // keep last good state
      } finally {
        if (!cancel) setLoading(false)
      }
    }

    refresh()
    const id = setInterval(refresh, REFRESH_MS)
    return () => { cancel = true; clearInterval(id) }
  }, [companyId])

  const taskCounts = useMemo(() => {
    const today = new Date()
    const overdue = tasks.filter((t) => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < today).length
    const done = tasks.filter((t) => t.status === 'done').length
    return { total: tasks.length, done, overdue }
  }, [tasks])

  const objAvg = objectives.length === 0
    ? 0
    : Math.round(objectives.reduce((s, o) => s + objProgress(o), 0) / objectives.length)

  if (loading) return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-amber-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-amber-500 to-rose-500" />
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="inline-block size-2.5 animate-pulse rounded-full bg-emerald-500" />
              مباشر
            </CardTitle>
            <CardDescription>تحديث تلقائي كل {REFRESH_MS / 1000} ثانية.</CardDescription>
          </div>
          {lastRefresh && (
            <span className="text-xs text-muted-foreground tabular-nums">
              آخر تحديث: {lastRefresh.toLocaleTimeString('en-US')}
            </span>
          )}
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-transparent">
          <CardHeader>
            <CardDescription>متوسط تقدم الأهداف</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-emerald-700">{objAvg}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={objAvg} className="h-1.5" />
            <p className="mt-1 text-[10px] text-muted-foreground">{objectives.length} هدف</p>
          </CardContent>
        </Card>

        <Card className="border-sky-200 bg-gradient-to-br from-sky-500/10 to-transparent">
          <CardHeader>
            <CardDescription>المؤشرات</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-sky-700">{kpis.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">{kpis.filter((k) => kpiPct(k) >= 70).length} في المسار</p>
          </CardContent>
        </Card>

        <Card className="border-violet-200 bg-gradient-to-br from-violet-500/10 to-transparent">
          <CardHeader>
            <CardDescription>المهام المنجزة</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-violet-700">
              {taskCounts.done}<span className="text-base text-muted-foreground">/{taskCounts.total}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={taskCounts.total === 0 ? 0 : Math.round((taskCounts.done / taskCounts.total) * 100)} className="h-1.5" />
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-gradient-to-br from-rose-500/10 to-transparent">
          <CardHeader>
            <CardDescription>مهام متأخرة</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-rose-700">{taskCounts.overdue}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground">تحتاج معالجة فورية</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>مقاييس المؤشرات</CardTitle>
            <CardDescription>قياس النسبة المئوية من المستهدف لكل مؤشر.</CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">لا توجد مؤشرات.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {kpis.map((k) => {
                  const p = kpiPct(k)
                  const t = tint(p)
                  return (
                    <div key={k.id} className={`rounded-xl border bg-card p-3 ring-2 ${t.ring}`}>
                      <div className="text-xs font-medium">{k.name}</div>
                      <div className={`mt-1 text-2xl font-bold tabular-nums ${t.text}`}>{p}%</div>
                      <Progress value={Math.min(100, p)} className="mt-1 h-1.5" />
                      <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                        {k.currentValue.toLocaleString('en-US')} / {k.targetValue.toLocaleString('en-US')} {k.unit}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>آخر الأحداث</CardTitle>
            <CardDescription>{activity.length} حدث.</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">لا توجد أحداث.</p>
            ) : (
              <ul className="space-y-1.5">
                {activity.slice(0, 10).map((a) => (
                  <li key={`${a.type}-${a.id}`} className="flex items-center justify-between gap-2 rounded-md border bg-card px-2 py-1.5 text-xs">
                    <span className="truncate">{a.title}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{fmtRelative(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
