import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  listKPIs, listObjectives, listProjects, listTasks,
  type KPI, type Objective, type Project, type Task,
} from '@/lib/strategicApi'

function objProgress(o: Objective): number {
  if (!o.okrs?.length) return 0
  const t = o.okrs.map((k) => (k.targetValue === 0 ? 0 : Math.min(100, (k.currentValue / k.targetValue) * 100)))
  return Math.round(t.reduce((s, v) => s + v, 0) / t.length)
}

function kpiPct(k: KPI): number {
  if (!k.targetValue) return 0
  return Math.min(150, Math.round((k.currentValue / k.targetValue) * 100))
}

const STATUS_LABEL: Record<string, string> = {
  active: 'نشط', planning: 'تخطيط', done: 'مكتمل', paused: 'متوقف', cancelled: 'ملغى',
  todo: 'للقيام', in_progress: 'قيد التنفيذ', blocked: 'متعطلة',
}

const STATUS_TINT: Record<string, string> = {
  active: 'bg-sky-500', planning: 'bg-amber-500', done: 'bg-emerald-500',
  paused: 'bg-slate-400', cancelled: 'bg-rose-500',
  todo: 'bg-slate-500', in_progress: 'bg-sky-500', blocked: 'bg-rose-500',
}

export function ExecDashboardPage() {
  return (
    <StrategicShell
      title="لوحة الفريق التنفيذي"
      description="الأهداف المسندة، مؤشرات الفريق، حالة المشاريع، والمهام التي تحتاج إجراءً."
    >
      {(companyId) => <Inner companyId={companyId} />}
    </StrategicShell>
  )
}

function Inner({ companyId }: { companyId: string }) {
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [kpis, setKpis] = useState<KPI[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      listObjectives(companyId),
      listKPIs(companyId),
      listProjects(companyId),
      listTasks(companyId),
    ])
      .then(([o, k, p, t]) => { setObjectives(o); setKpis(k); setProjects(p); setTasks(t) })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [companyId])

  const activeObj = useMemo(() => objectives.filter((o) => o.status === 'active'), [objectives])
  const projStats = useMemo(() => {
    const out: Record<string, number> = {}
    for (const p of projects) out[p.status] = (out[p.status] ?? 0) + 1
    return out
  }, [projects])

  const upcomingTasks = useMemo(() => {
    return [...tasks]
      .filter((t) => t.status !== 'done' && t.status !== 'cancelled' && t.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 8)
  }, [tasks])

  const pendingApprovals = useMemo(() => {
    return tasks.filter((t) => t.status === 'blocked').slice(0, 5)
  }, [tasks])

  if (loading) return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-sky-500/10 via-teal-500/5 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-sky-500 via-teal-500 to-emerald-500" />
        <CardHeader>
          <CardTitle>نظرة الفريق التنفيذي</CardTitle>
          <CardDescription>
            {activeObj.length} هدف نشط · {kpis.length} مؤشر · {projects.length} مشروع · {tasks.length} مهمة
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="أهداف نشطة" value={String(activeObj.length)} accent="emerald" />
        <Stat label="مؤشرات في المسار" value={String(kpis.filter((k) => kpiPct(k) >= 70).length)} accent="sky" />
        <Stat label="مشاريع نشطة" value={String(projects.filter((p) => p.status === 'active').length)} accent="violet" />
        <Stat label="بانتظار الموافقة" value={String(pendingApprovals.length)} accent="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active objectives */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>الأهداف النشطة</CardTitle>
              <Link to="/objectives" className={buttonVariants({ variant: 'outline', size: 'sm' })}>الكل ←</Link>
            </div>
          </CardHeader>
          <CardContent>
            {activeObj.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">لا توجد أهداف نشطة.</p>
            ) : (
              <ul className="space-y-2">
                {activeObj.slice(0, 6).map((o) => {
                  const p = objProgress(o)
                  return (
                    <li key={o.id} className="rounded-lg border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{o.title}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{p}% · {(o.okrs ?? []).length} OKR</span>
                      </div>
                      <Progress value={p} className="mt-1 h-1.5" />
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Project status breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>المشاريع</CardTitle>
            <CardDescription>التوزيع حسب الحالة.</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(projStats).length === 0 ? (
              <p className="text-xs text-muted-foreground">لا توجد مشاريع.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {Object.entries(projStats).map(([s, n]) => (
                  <li key={s} className="flex items-center gap-2">
                    <span className={`size-2.5 shrink-0 rounded-full ${STATUS_TINT[s] ?? 'bg-slate-500'}`} />
                    <span className="flex-1">{STATUS_LABEL[s] ?? s}</span>
                    <span className="tabular-nums font-semibold">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming tasks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>مهام قادمة</CardTitle>
            <Link to="/tasks" className={buttonVariants({ variant: 'outline', size: 'sm' })}>كل المهام ←</Link>
          </div>
          <CardDescription>أقرب 8 مهام حسب تاريخ الاستحقاق.</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingTasks.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">لا توجد مهام قادمة.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {upcomingTasks.map((t) => {
                const due = new Date(t.dueDate!)
                const overdue = due.getTime() < Date.now()
                return (
                  <li key={t.id} className={`flex items-center gap-2 rounded-lg border bg-card p-2 ${overdue ? 'border-rose-200' : ''}`}>
                    <span className={`size-2.5 shrink-0 rounded-full ${STATUS_TINT[t.status] ?? 'bg-slate-500'}`} />
                    <span className="flex-1">{t.title}</span>
                    <span className={`text-xs tabular-nums ${overdue ? 'text-rose-700 font-semibold' : 'text-muted-foreground'}`}>
                      {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {overdue && ' · متأخر'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {pendingApprovals.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle>بانتظار موافقات / محاور معطلة</CardTitle>
            <CardDescription>مهام في حالة "متعطلة" تحتاج تدخّل.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {pendingApprovals.map((t) => (
                <li key={t.id} className="rounded-lg border bg-card p-2">{t.title}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'sky' | 'violet' | 'amber' }) {
  const palette: Record<typeof accent, string> = {
    emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-transparent text-emerald-700',
    sky:     'border-sky-200 bg-gradient-to-br from-sky-500/10 to-transparent text-sky-700',
    violet:  'border-violet-200 bg-gradient-to-br from-violet-500/10 to-transparent text-violet-700',
    amber:   'border-amber-200 bg-gradient-to-br from-amber-500/10 to-transparent text-amber-700',
  }
  return (
    <Card className={palette[accent]}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}
