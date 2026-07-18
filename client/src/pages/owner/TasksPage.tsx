import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiErrorMessage } from '@/lib/api'
import { createTask, deleteTask, getArtifact, listProjects, listTasks, updateTask, type Project, type Task } from '@/lib/strategicApi'

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
  const [params] = useSearchParams()
  const client = params.get('client')
  const q = client ? `&client=${client}` : ''
  return <Navigate to={`/execute?tab=tasks${q}`} replace />
}

export function TasksView({ companyId }: { companyId: string }) {
  return <Editor companyId={companyId} />
}

function Editor({ companyId }: { companyId: string }) {
  const [searchParams] = useSearchParams()
  const isRescueMode = searchParams.get('from') === 'emergency'
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState<{ status: string; projectId: string; owner: string }>({ status: 'all', projectId: 'all', owner: 'all' })
  // تاريخ استحقاق افتراضي بعد أسبوع. نغلّف Date.now في دالّة تُستدعى من مُهيّئ
  // useState الكسول ومن معالج الإرسال — لا من جسم الرسم (تفادياً للنجاسة أثناء الرسم).
  const weekFromNowISO = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10)
  const [form, setForm] = useState(() => ({
    title: '',
    projectId: '',
    owner: '',
    priority: 'medium',
    dueDate: weekFromNowISO(),
  }))

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
        owner: form.owner.trim() || undefined,
        priority: form.priority,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      })
      setTasks((p) => [t, ...p])
      // نُبقي المشروع والجهة (إسناد متتابع لنفس الجهة أسرع).
      setForm({ title: '', projectId: form.projectId, owner: form.owner, priority: form.priority, dueDate: weekFromNowISO() })
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

  // 🚨 توليد مهام إنقاذ من أيزنهاور — يقرأ «افعل الآن» + «جدولها»
  //    ويحوّلها إلى Tasks بأولويات وتواريخ استحقاق ذكيّة.
  async function generateRescueTasks() {
    setGenerating(true)
    try {
      const artifact = await getArtifact<{ tasks?: Array<{ id: string; title: string; quadrant: string }> }>(companyId, 'EISENHOWER')
      const eTasks = (artifact?.data?.tasks ?? []).filter((t) => (t.quadrant === 'do' || t.quadrant === 'schedule') && t.title?.trim())
      if (eTasks.length === 0) {
        toast.error('لا مهام في «افعل الآن» أو «جدولها» بأيزنهاور — ولّدها من المخاطر أوّلاً.')
        return
      }
      const existing = new Set(tasks.map((t) => t.title.trim()))
      const rescueProject = projects.find((p) => p.title.startsWith('[إنقاذ')) // نربطها بمشروع الإنقاذ إن وُجد
      const now = new Date()
      const created: Task[] = []
      for (const [i, et] of eTasks.slice(0, 10).entries()) {
        if (existing.has(et.title.trim())) continue
        const due = new Date(now)
        // «افعل الآن» → استحقاق أسبوع؛ «جدولها» → استحقاق ٣ أسابيع
        due.setDate(now.getDate() + (et.quadrant === 'do' ? 7 : 21) + i)
        const priority = et.quadrant === 'do' ? 'critical' : 'high'
        try {
          const t = await createTask({
            companyId,
            title: `[إنقاذ] ${et.title.slice(0, 80)}${et.title.length > 80 ? '…' : ''}`,
            projectId: rescueProject?.id,
            priority,
            dueDate: due.toISOString(),
          })
          created.push(t)
        } catch { /* skip */ }
      }
      if (created.length === 0) {
        toast.message('كل المهام مضافة سلفاً — لا شيء جديد.')
        return
      }
      setTasks((prev) => [...created, ...prev])
      const linkedMsg = rescueProject ? ` مرتبطة بـ«${rescueProject.title}»` : ''
      toast.success(`🚨 أُضيفت ${created.length} مهمّة إنقاذ${linkedMsg}. ابدأ بأعلى أولويّة.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
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
      if (filter.owner !== 'all' && (t.owner?.trim() || '—') !== filter.owner) return false
      return true
    })
  }, [tasks, filter])

  const counts = STATUS.reduce<Record<string, number>>((acc, [k]) => {
    acc[k] = tasks.filter((t) => t.status === k).length
    return acc
  }, {})
  const overdueCount = tasks.filter(isOverdue).length
  const donePct = tasks.length ? Math.round(((counts.done ?? 0) / tasks.length) * 100) : 0

  // ─── متابعة بحسب الجهة المنفّذة — للمدير المشرف ───────────────────
  const owners = useMemo(() => Array.from(new Set(tasks.map((t) => t.owner?.trim()).filter(Boolean) as string[])), [tasks])
  const byOwner = useMemo(() => owners.map((o) => {
    const list = tasks.filter((t) => (t.owner?.trim() || '') === o)
    const done = list.filter((t) => t.status === 'done').length
    return { owner: o, done, total: list.length }
  }), [owners, tasks])

  return (
    <>
      {/* 🚨 في وضع الطوارئ + قائمة فارغة: زرّ توليد مهام الإنقاذ */}
      {isRescueMode && !loading && tasks.length === 0 && (
        <Card className="overflow-hidden border-2 border-rose-500 bg-gradient-to-l from-rose-50 via-rose-50/50 to-transparent shadow-md">
          <div className="h-1.5 bg-gradient-to-l from-rose-600 via-rose-500 to-rose-400" />
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start gap-4">
              <div className="text-5xl">🚨</div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-rose-400 bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-900">
                    وضع الإنقاذ · لا مهام بعد
                  </span>
                </div>
                <h2 className="text-lg font-bold text-rose-900">ولّد مهام الإنقاذ فوراً من أيزنهاور</h2>
                <p className="mt-1 text-xs leading-relaxed text-rose-800/80">
                  بدل إنشاء كل مهمّة يدوياً، اضغط الزرّ لتوليد <b>مهام الإنقاذ العاجلة</b> من مصفوفة أيزنهاور:
                  «افعل الآن» → أولويّة حرجة + استحقاق ٧ أيّام · «جدولها» → أولويّة عالية + استحقاق ٣ أسابيع.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button
                    onClick={generateRescueTasks}
                    disabled={generating}
                    size="lg"
                    className="bg-rose-600 hover:bg-rose-700"
                  >
                    {generating ? 'جاري التوليد…' : '🚨 ولّد مهام الإنقاذ الآن'}
                  </Button>
                  <span className="text-xs text-rose-700">
                    أو أنشئ مهمّة يدوياً في النموذج أدناه ←
                  </span>
                </div>
                <div className="mt-3 rounded-lg border border-rose-300 bg-rose-100/60 p-2 text-[11px] text-rose-900">
                  <b>💡 كيف يعمل؟</b> يقرأ artifact `EISENHOWER` → يستورد أوّل ١٠ مهام «افعل الآن»+«جدولها» →
                  ينشئ لكل واحدة Task بأولويّة + استحقاق ذكي، ويربطها بمشروع الإنقاذ (إن وُجد على جانت).
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* متابعة المدير المشرف — نسبة الإنجاز الكليّة + توزيع بحسب الجهة المنفّذة */}
      {tasks.length > 0 && (
        <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">متابعة الإنجاز</span>
              <span className="text-lg font-bold tabular-nums text-primary">{donePct}٪</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-gradient-to-l from-emerald-500 to-primary transition-all" style={{ width: `${donePct}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">{counts.done ?? 0}/{tasks.length} مهمة منجَزة</div>
            {byOwner.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">بحسب الجهة المنفّذة:</span>
                {byOwner.map((b) => (
                  <button
                    key={b.owner}
                    type="button"
                    onClick={() => setFilter((p) => ({ ...p, owner: p.owner === b.owner ? 'all' : b.owner }))}
                    className={`rounded-full border px-2 py-0.5 text-[10px] tabular-nums transition ${
                      filter.owner === b.owner ? 'border-primary bg-primary/10 font-medium text-primary' : 'bg-card hover:bg-muted'
                    }`}
                    title="اضغط للتصفية بهذه الجهة"
                  >
                    👤 {b.owner} — {b.done}/{b.total}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden bg-gradient-to-bl from-sky-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-sky-500 via-cyan-500 to-emerald-500" />
        <CardHeader>
          <CardTitle>مهمة جديدة</CardTitle>
          <CardDescription>اربط المهمة بمشروع لظهورها في مخطط جانت.</CardDescription>
        </CardHeader>
        <form onSubmit={create}>
          <CardContent className="grid gap-3 md:grid-cols-6">
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
              <Label htmlFor="owner">الجهة المنفّذة</Label>
              <Input
                id="owner"
                value={form.owner}
                onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))}
                placeholder="شركة / إدارة / شخص"
                list="task-owners"
              />
              <datalist id="task-owners">
                {owners.map((o) => <option key={o} value={o} />)}
              </datalist>
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
            <div className="md:col-span-6 flex justify-end">
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
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={filter.owner}
                onChange={(e) => setFilter((p) => ({ ...p, owner: e.target.value }))}
              >
                <option value="all">كل الجهات</option>
                {owners.map((o) => <option key={o} value={o}>{o}</option>)}
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
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      {t.projectId && <span>📁 {projects.find((p) => p.id === t.projectId)?.title ?? '—'}</span>}
                      <span className="tabular-nums">📅 {fmtDate(t.dueDate)}</span>
                      <span className="inline-flex items-center gap-1">
                        👤
                        <input
                          className="w-28 rounded border bg-background px-1.5 py-0.5 text-[11px]"
                          placeholder="الجهة المنفّذة"
                          defaultValue={t.owner ?? ''}
                          list="task-owners"
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            if (v !== (t.owner?.trim() ?? '')) update(t, { owner: v || null })
                          }}
                        />
                      </span>
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
