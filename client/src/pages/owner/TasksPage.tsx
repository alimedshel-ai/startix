import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiErrorMessage } from '@/lib/api'
import { createTask, deleteTask, listProjects, listTasks, updateTask, type Project, type Task } from '@/lib/strategicApi'

const STATUS = [
  ['todo',        'للقيام',     'border-slate-300 bg-slate-50/60',     'bg-slate-500'],
  ['in_progress', 'قيد التنفيذ', 'border-sky-300 bg-sky-50/60',         'bg-sky-500'],
  ['done',        'منجزة',      'border-emerald-300 bg-emerald-50/60', 'bg-emerald-500'],
  ['blocked',     'متعطلة',     'border-rose-300 bg-rose-50/60',       'bg-rose-500'],
] as const

const PRIORITIES = [
  ['low',    'منخفضة'],
  ['medium', 'متوسطة'],
  ['high',   'عالية'],
  ['urgent', 'عاجلة'],
] as const

function sMeta(s: string) {
  return STATUS.find((x) => x[0] === s) ?? STATUS[0]
}
function pLabel(p: string) {
  return PRIORITIES.find((x) => x[0] === p)?.[1] ?? p
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
}

function isOverdue(t: Task): boolean {
  if (!t.dueDate || t.status === 'done') return false
  return new Date(t.dueDate).getTime() < Date.now()
}

export function TasksPage() {
  return (
    <StrategicShell
      title="المهام"
      description="لوحة المهام عبر كل مشاريعك. صفّ حسب الحالة أو المشروع."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<{ status: string; projectId: string }>({ status: 'all', projectId: 'all' })
  const today = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10)
  const [form, setForm] = useState({ title: '', projectId: '', priority: 'medium', dueDate: today })

  useEffect(() => {
    Promise.all([listTasks(companyId), listProjects(companyId)])
      .then(([t, p]) => { setTasks(t); setProjects(p) })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [companyId])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const t = await createTask({
        companyId,
        title: form.title,
        projectId: form.projectId || undefined,
        priority: form.priority,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      })
      setTasks((p) => [t, ...p])
      setForm({ title: '', projectId: form.projectId, priority: form.priority, dueDate: today })
      toast.success('تمت إضافة المهمة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإنشاء'))
    } finally {
      setCreating(false)
    }
  }

  async function update(t: Task, patch: Partial<Task>) {
    try {
      const updated = await updateTask(t.id, patch)
      setTasks((p) => p.map((x) => (x.id === t.id ? { ...x, ...updated } : x)))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحديث'))
    }
  }

  async function remove(t: Task) {
    if (!confirm(`حذف المهمة "${t.title}"؟`)) return
    try {
      await deleteTask(t.id)
      setTasks((p) => p.filter((x) => x.id !== t.id))
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter.status !== 'all' && t.status !== filter.status) return false
      if (filter.projectId !== 'all' && (t.projectId ?? '') !== filter.projectId) return false
      return true
    })
  }, [tasks, filter])

  const counts = STATUS.reduce<Record<string, number>>((acc, [k]) => {
    acc[k] = tasks.filter((t) => t.status === k).length
    return acc
  }, {})
  const overdueCount = tasks.filter(isOverdue).length

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STATUS.map(([k, label, tint]) => (
          <Card key={k} className={tint}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{counts[k] ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        ))}
        <Card className="border-rose-300 bg-rose-50/60">
          <CardHeader>
            <CardDescription>متأخرة</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-rose-700">{overdueCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="overflow-hidden bg-gradient-to-bl from-sky-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-sky-500 via-cyan-500 to-emerald-500" />
        <CardHeader>
          <CardTitle>مهمة جديدة</CardTitle>
          <CardDescription>اربط المهمة بمشروع لظهورها في مخطط جانت.</CardDescription>
        </CardHeader>
        <form onSubmit={create}>
          <CardContent className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="title">العنوان</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="مهمة جديدة…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="prj">المشروع</Label>
              <select
                id="prj"
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                value={form.projectId}
                onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))}
              >
                <option value="">بدون مشروع</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="prio">الأولوية</Label>
              <select
                id="prio"
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
              >
                {PRIORITIES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="due">الاستحقاق</Label>
              <Input id="due" type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
            <div className="md:col-span-5 flex justify-end">
              <Button type="submit" disabled={creating || !form.title.trim()}>{creating ? 'جاري الإنشاء…' : '+ إضافة'}</Button>
            </div>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>القائمة</CardTitle>
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={filter.status}
                onChange={(e) => setFilter((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="all">كل الحالات</option>
                {STATUS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={filter.projectId}
                onChange={(e) => setFilter((p) => ({ ...p, projectId: e.target.value }))}
              >
                <option value="all">كل المشاريع</option>
                <option value="">بدون مشروع</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>
          <CardDescription>{filtered.length} مهمة معروضة من {tasks.length} إجمالي.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">جاري التحميل…</p>}
          <ul className="space-y-2">
            {filtered.map((t) => {
              const meta = sMeta(t.status)
              const overdue = isOverdue(t)
              return (
                <li key={t.id} className={`flex items-center gap-2 rounded-xl border p-3 ${meta[2]}`}>
                  <span className={`inline-block size-2.5 shrink-0 rounded-full ${meta[3]}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span>{t.title}</span>
                      <span className="rounded-md border bg-card px-1.5 py-0.5 text-[10px]">{pLabel(t.priority)}</span>
                      {overdue && <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">متأخرة</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                      {t.projectId && <span>📁 {projects.find((p) => p.id === t.projectId)?.title ?? '—'}</span>}
                      <span className="tabular-nums">📅 {fmtDate(t.dueDate)}</span>
                    </div>
                  </div>
                  <select
                    className="rounded-md border bg-background px-1.5 py-1 text-xs"
                    value={t.status}
                    onChange={(e) => update(t, { status: e.target.value })}
                  >
                    {STATUS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                  <button onClick={() => remove(t)} className="text-xs text-muted-foreground hover:text-destructive">×</button>
                </li>
              )
            })}
            {!loading && filtered.length === 0 && (
              <li className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                لا توجد مهام مطابقة.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
