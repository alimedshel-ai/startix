import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import {
  createTask, deleteProject, deleteTask, listInitiatives, listProjects, listTasks,
  updateProject, updateTask,
  type Initiative, type Project, type Task,
} from '@/lib/strategicApi'

// ─── صفحة تفصيل مشروع واحد ────────────────────────────────────────
// URL: /manager/projects/:projectId?client=<companyId>
// تعرض: عنوان + تواريخ + وصف + مبادرة مرتبطة + قائمة المهام + تقدّم
// أزرار: تعديل، تحديث الحالة، إضافة مهمّة، حذف

const STATUS_META: Record<string, { labelAr: string; icon: string; chipClass: string }> = {
  active:    { labelAr: 'نشط',    icon: '🚀', chipClass: 'border-sky-400 bg-sky-100 text-sky-800' },
  planning:  { labelAr: 'تخطيط',  icon: '📋', chipClass: 'border-amber-400 bg-amber-100 text-amber-800' },
  done:      { labelAr: 'مكتمل',  icon: '✅', chipClass: 'border-emerald-400 bg-emerald-100 text-emerald-800' },
  paused:    { labelAr: 'متوقف',  icon: '⏸️', chipClass: 'border-slate-400 bg-slate-100 text-slate-800' },
  cancelled: { labelAr: 'ملغى',   icon: '🚫', chipClass: 'border-rose-400 bg-rose-100 text-rose-800' },
}

const TASK_STATUS_META: Record<string, { labelAr: string; icon: string; chipClass: string }> = {
  todo:        { labelAr: 'للقيام',      icon: '○', chipClass: 'border-slate-300 bg-slate-50 text-slate-700' },
  in_progress: { labelAr: 'قيد التنفيذ', icon: '◐', chipClass: 'border-sky-400 bg-sky-50 text-sky-800' },
  done:        { labelAr: 'منجزة',       icon: '●', chipClass: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
  blocked:     { labelAr: 'متعطلة',      icon: '⛔', chipClass: 'border-rose-400 bg-rose-50 text-rose-800' },
}

// ─── بنك أفكار مهام تنفيذ خطّة — خطوات قياسيّة لأي مشروع ──────────
// نقرة تُضيف المهمّة؛ تُخفى إن أُضيفت سلفاً. تُوزَّع بعدها على الجهات.
const PROJECT_TASK_IDEAS: string[] = [
  'تحديد المسؤول والفريق المنفّذ',
  'اجتماع انطلاق وتحديد النطاق والمخرجات',
  'تحديد المعايير ومؤشّرات النجاح',
  'جدولة زمنيّة بمعالم (milestones)',
  'حصر المخاطر والاعتماديّات',
  'تأمين الموارد/الميزانية المطلوبة',
  'مراجعة منتصف المدّة والتقدّم',
  'تقرير الإنجاز والإغلاق والدروس المستفادة',
]

// ─── تفريعات المهمّة (sub-steps) — مخزَّنة في description كـ JSON ────
// نحفظ { note?, steps: [{t, done}] }. النصّ الحرّ القديم يُحفَظ كـ note.
interface SubStep { t: string; done: boolean }
interface TaskBody { note?: string; steps: SubStep[] }

function parseBody(desc?: string | null): TaskBody {
  if (!desc) return { steps: [] }
  try {
    const o = JSON.parse(desc) as { note?: unknown; steps?: unknown }
    if (o && Array.isArray(o.steps)) {
      return {
        note: typeof o.note === 'string' ? o.note : undefined,
        steps: o.steps.filter((s): s is SubStep => !!s && typeof (s as SubStep).t === 'string')
          .map((s) => ({ t: s.t, done: !!s.done })),
      }
    }
  } catch { /* نصّ حرّ قديم */ }
  return { note: desc, steps: [] }
}
const serializeBody = (b: TaskBody): string => JSON.stringify({ note: b.note, steps: b.steps })

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function daysBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000)
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [params] = useSearchParams()
  const companyId = params.get('client')
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [initiative, setInitiative] = useState<Initiative | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)

  // نسخة قابلة للتحرير من المشروع.
  const [draft, setDraft] = useState<Partial<Project>>({})

  useEffect(() => {
    if (!projectId || !companyId) {
      setError('مسار غير صالح — تحتاج projectId + client في الرابط.')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const [allProjects, allTasks, allInitiatives] = await Promise.all([
          listProjects(companyId),
          listTasks(companyId),
          listInitiatives(companyId).catch(() => [] as Initiative[]),
        ])
        if (!alive) return
        const found = allProjects.find((p) => p.id === projectId)
        if (!found) {
          setError('خطة التنفيذ غير موجودة — قد تكون مُحذَفة أو تغيّر العميل.')
          return
        }
        setProject(found)
        setDraft(found)
        setTasks(allTasks.filter((t) => t.projectId === projectId))
        setInitiative(allInitiatives.find((i) => i.id === found.initiativeId) ?? null)
      } catch (err) {
        if (!alive) return
        setError(apiErrorMessage(err, 'تعذّر تحميل خطة التنفيذ'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [projectId, companyId])

  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((t) => t.status === 'done').length
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length
    const blocked = tasks.filter((t) => t.status === 'blocked').length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, done, inProgress, blocked, pct }
  }, [tasks])

  const daysRemaining = project ? daysUntil(project.endDate) : null
  const isOverdue = daysRemaining !== null && daysRemaining < 0 && project?.status !== 'done' && project?.status !== 'cancelled'
  const duration = project ? daysBetween(project.startDate, project.endDate) : null

  async function saveDraft() {
    if (!project) return
    setSaving(true)
    try {
      const updated = await updateProject(project.id, {
        title: draft.title,
        description: draft.description,
        status: draft.status,
        startDate: draft.startDate,
        endDate: draft.endDate,
      })
      setProject(updated)
      setEditing(false)
      toast.success('تم حفظ التعديلات')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(status: string) {
    if (!project) return
    try {
      const updated = await updateProject(project.id, { status })
      setProject(updated)
      setDraft(updated)
      toast.success(`الحالة → ${STATUS_META[status]?.labelAr ?? status}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحديث'))
    }
  }

  async function createTaskWithTitle(title: string): Promise<boolean> {
    if (!project || !companyId) return false
    const t = title.trim()
    if (!t) return false
    if (tasks.some((x) => x.title.trim() === t)) { toast.message('المهمّة موجودة سلفاً.'); return false }
    const created = await createTask({ companyId, projectId: project.id, title: t, status: 'todo', priority: 'medium' })
    setTasks((p) => [...p, created])
    return true
  }

  async function addTask() {
    setCreatingTask(true)
    try {
      if (await createTaskWithTitle(newTaskTitle)) { setNewTaskTitle(''); toast.success('أُضيفت المهمّة') }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإضافة'))
    } finally {
      setCreatingTask(false)
    }
  }

  // توزيع: تعيين الجهة المنفّذة لمهمّة (نصّ حرّ + قائمة الجهات السابقة).
  async function changeTaskOwner(taskId: string, owner: string) {
    try {
      const updated = await updateTask(taskId, { owner: owner || null })
      setTasks((p) => p.map((t) => (t.id === taskId ? updated : t)))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر تعيين الجهة'))
    }
  }

  // التفريعات: تُخزَّن في description كـ JSON — نحفظ التغيير ونحدّث محلياً.
  async function changeTaskBody(taskId: string, description: string) {
    setTasks((p) => p.map((t) => (t.id === taskId ? { ...t, description } : t))) // تفاؤليّ
    try {
      await updateTask(taskId, { description })
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر حفظ التفريعات'))
    }
  }

  async function changeTaskStatus(taskId: string, status: string) {
    try {
      const updated = await updateTask(taskId, { status })
      setTasks((p) => p.map((t) => (t.id === taskId ? updated : t)))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحديث'))
    }
  }

  async function removeTask(taskId: string) {
    if (!confirm('حذف هذه المهمّة؟')) return
    try {
      await deleteTask(taskId)
      setTasks((p) => p.filter((t) => t.id !== taskId))
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  async function removeProject() {
    if (!project) return
    if (!confirm(`حذف خطوة تنفيذ "${project.title}" وكل مهامها؟\n\nهذا الإجراء لا رجعة فيه.`)) return
    try {
      await deleteProject(project.id)
      toast.success('تم حذف خطة التنفيذ')
      navigate('/manager/clients')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="تفاصيل خطة التنفيذ" />
        <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="تفاصيل خطة التنفيذ" />
        <Card className="border-rose-300 bg-rose-50/60">
          <CardHeader>
            <CardTitle className="text-rose-900">⚠️ {error ?? 'خطة التنفيذ غير موجودة'}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              to="/manager/clients"
              className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted"
            >
              ← عملائي
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sm = STATUS_META[project.status] ?? STATUS_META.planning

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={project.title}
        description="تفاصيل خطة التنفيذ + المهام + المبادرة المرتبطة"
        breadcrumbs={[
          { label: 'عملائي', to: '/manager/clients' },
          { label: project.title },
        ]}
      />

      {/* رأس البطاقة — الحالة + التقدّم */}
      <Card className={isOverdue ? 'border-2 border-rose-400 bg-rose-50/40' : 'border-2 border-primary/30 bg-primary/5'}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${sm.chipClass}`}>
                  {sm.icon} {sm.labelAr}
                </span>
                {isOverdue && (
                  <span className="rounded-full border border-rose-500 bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                    ⏰ متأخّر {Math.abs(daysRemaining ?? 0)} يوم
                  </span>
                )}
                {initiative && (
                  <span className="rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800">
                    💡 من مبادرة: {initiative.title}
                  </span>
                )}
              </div>
              {project.description && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {project.description}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">التقدّم</span>
              <div className="text-4xl font-bold tabular-nums">{stats.pct}٪</div>
            </div>
          </div>
          <Progress value={stats.pct} className="mt-3 h-2" />
        </CardHeader>
      </Card>

      {/* بطاقات الإحصاء */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="إجمالي المهام" value={stats.total} icon="📋" accent="border-slate-200 bg-slate-50/60 text-slate-800" />
        <StatCard title="منجزة" value={stats.done} icon="✅" accent="border-emerald-200 bg-emerald-50/60 text-emerald-800" />
        <StatCard title="قيد التنفيذ" value={stats.inProgress} icon="◐" accent="border-sky-200 bg-sky-50/60 text-sky-800" />
        <StatCard title="متعطلة" value={stats.blocked} icon="⛔" accent="border-rose-200 bg-rose-50/60 text-rose-800" />
      </div>

      {/* التواريخ + التحرير */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">تفاصيل خطة التنفيذ</CardTitle>
            <CardDescription>عنوان + وصف + تواريخ + حالة</CardDescription>
          </div>
          <div className="flex gap-2">
            {!editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  ✏️ تعديل
                </Button>
                <Button variant="outline" size="sm" onClick={removeProject} className="text-rose-700 hover:bg-rose-50">
                  🗑️ حذف الخطة
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => { setDraft(project); setEditing(false) }}>
                  إلغاء
                </Button>
                <Button size="sm" onClick={saveDraft} disabled={saving}>
                  {saving ? 'جاري…' : '💾 حفظ'}
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!editing ? (
            <div className="grid gap-3 sm:grid-cols-4">
              <ReadOnlyField label="تاريخ البداية" value={fmtDate(project.startDate)} />
              <ReadOnlyField label="تاريخ الانتهاء" value={fmtDate(project.endDate)} />
              <ReadOnlyField
                label="المدّة"
                value={duration != null ? `${duration} يوم` : '—'}
              />
              <ReadOnlyField
                label={daysRemaining === null ? 'التبقّي' : daysRemaining < 0 ? 'التأخّر' : 'المتبقّي'}
                value={daysRemaining === null ? '—' : daysRemaining < 0 ? `${Math.abs(daysRemaining)} يوم` : `${daysRemaining} يوم`}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="edit-title">العنوان</Label>
                <Input
                  id="edit-title"
                  value={draft.title ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="edit-desc">الوصف</Label>
                <Textarea
                  id="edit-desc"
                  rows={3}
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-start">تاريخ البداية</Label>
                <Input
                  id="edit-start"
                  type="date"
                  value={draft.startDate?.slice(0, 10) ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-end">تاريخ الانتهاء</Label>
                <Input
                  id="edit-end"
                  type="date"
                  value={draft.endDate?.slice(0, 10) ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, endDate: e.target.value }))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* تغيير الحالة السريع */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">🎯 تغيير الحالة السريع</CardTitle>
          <CardDescription>اضغط زرّاً لتحديث الحالة فوراً.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(STATUS_META).map(([status, m]) => {
            const active = project.status === status
            return (
              <Button
                key={status}
                variant={active ? 'default' : 'outline'}
                size="sm"
                onClick={() => changeStatus(status)}
                disabled={active}
                className="gap-1"
              >
                <span>{m.icon}</span>
                {m.labelAr}
                {active && <span className="mr-1 text-[9px] opacity-70">✓ حاليّة</span>}
              </Button>
            )
          })}
        </CardContent>
      </Card>

      {/* المهام */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📋 المهام — {tasks.length}</CardTitle>
          <CardDescription>حرّك كل مهمّة عبر ٤ حالات: للقيام → قيد التنفيذ → منجزة (أو متعطلة).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* إضافة مهمّة سريعة */}
          <form
            onSubmit={(e) => { e.preventDefault(); addTask() }}
            className="flex gap-2 rounded-lg border bg-muted/30 p-2"
          >
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="عنوان مهمّة جديدة…"
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={creatingTask || !newTaskTitle.trim()}>
              {creatingTask ? 'جاري…' : '＋ إضافة'}
            </Button>
          </form>

          {/* 💡 أفكار مهام جاهزة — نقرة تُضيف، والباقي بعد الإضافة يُوزَّع على الجهات */}
          {(() => {
            const available = PROJECT_TASK_IDEAS.filter((idea) => !tasks.some((t) => t.title.trim() === idea))
            if (available.length === 0) return null
            return (
              <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-3">
                <div className="mb-2 text-xs font-bold">💡 أفكار مهام لهذه الخطة — نقرة تُضيفها:</div>
                <div className="flex flex-wrap gap-1.5">
                  {available.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => createTaskWithTitle(idea)}
                      className="rounded-md border bg-card px-2.5 py-1 text-xs transition hover:-translate-y-0.5 hover:border-primary hover:shadow-sm"
                    >
                      ＋ {idea}
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* قائمة الجهات المنفّذة السابقة — لتسريع التوزيع */}
          <datalist id="project-task-owners">
            {Array.from(new Set(tasks.map((t) => t.owner?.trim()).filter(Boolean) as string[])).map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>

          {tasks.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              لا مهام بعد — أضِف أوّل مهمّة أعلاه.
            </p>
          ) : (
            <div className="space-y-2">
              {(['todo', 'in_progress', 'done', 'blocked'] as const).map((groupStatus) => {
                const groupTasks = tasks.filter((t) => t.status === groupStatus)
                if (groupTasks.length === 0) return null
                const gm = TASK_STATUS_META[groupStatus]
                return (
                  <div key={groupStatus}>
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span>{gm.icon}</span>
                      <span>{gm.labelAr}</span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{groupTasks.length}</span>
                    </div>
                    <ul className="space-y-1">
                      {groupTasks.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          onStatusChange={(s) => changeTaskStatus(t.id, s)}
                          onOwnerChange={(o) => changeTaskOwner(t.id, o)}
                          onBodyChange={(d) => changeTaskBody(t.id, d)}
                          onRemove={() => removeTask(t.id)}
                        />
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* الروابط ذات الصلة */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">🔗 روابط ذات صلة</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            to="/manager/clients"
            className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            🤝 عملائي ←
          </Link>
          {companyId && (
            <>
              <Link
                to={`/execute?tab=gantt&client=${companyId}`}
                className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted"
              >
                📅 مخطّط جانت ←
              </Link>
              <Link
                to={`/priority?tab=initiatives&client=${companyId}`}
                className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted"
              >
                💡 المبادرات ←
              </Link>
              <Link
                to={`/manager/clients/${companyId}`}
                className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted"
              >
                🤝 لوحة العميل ←
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ title, value, icon, accent }: { title: string; value: number; icon: string; accent: string }) {
  return (
    <Card className={accent}>
      <CardHeader>
        <CardDescription className="flex items-center gap-1">
          <span>{icon}</span>
          {title}
        </CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium tabular-nums">{value}</div>
    </div>
  )
}

function TaskRow({
  task, onStatusChange, onOwnerChange, onBodyChange, onRemove,
}: {
  task: Task
  onStatusChange: (s: string) => void
  onOwnerChange: (o: string) => void
  onBodyChange: (description: string) => void
  onRemove: () => void
}) {
  const sm = TASK_STATUS_META[task.status] ?? TASK_STATUS_META.todo
  const body = parseBody(task.description)
  const [open, setOpen] = useState(body.steps.length > 0)
  const [draft, setDraft] = useState('')
  const doneCount = body.steps.filter((s) => s.done).length

  const save = (next: TaskBody) => onBodyChange(serializeBody(next))
  const addStep = () => { const t = draft.trim(); if (!t) return; save({ ...body, steps: [...body.steps, { t, done: false }] }); setDraft('') }
  const toggle = (i: number) => save({ ...body, steps: body.steps.map((s, j) => (j === i ? { ...s, done: !s.done } : s)) })
  const removeStep = (i: number) => save({ ...body, steps: body.steps.filter((_, j) => j !== i) })

  return (
    <li className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <span className={`inline-flex size-6 items-center justify-center rounded-full border text-xs ${sm.chipClass}`}>
          {sm.icon}
        </span>
        <div className="min-w-[120px] flex-1">
          <div className="text-sm">{task.title}</div>
          {body.note && <div className="text-[10px] leading-relaxed text-muted-foreground">{body.note}</div>}
        </div>
        {/* تفريعات — كسر المهمّة إلى خطوات مباشرة */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`rounded-md border px-2 py-1 text-[11px] transition hover:bg-accent ${body.steps.length > 0 ? 'border-primary/30 bg-primary/5 text-primary' : 'text-muted-foreground'}`}
          title="تفريعات المهمّة"
        >
          {open ? '▾' : '▸'} تفريعات{body.steps.length > 0 ? ` ${doneCount}/${body.steps.length}` : ''}
        </button>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          👤
          <input
            className="w-28 rounded border bg-background px-1.5 py-0.5 text-[11px]"
            placeholder="الجهة المنفّذة"
            defaultValue={task.owner ?? ''}
            list="project-task-owners"
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v !== (task.owner?.trim() ?? '')) onOwnerChange(v)
            }}
          />
        </span>
        <select
          value={task.status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-7 rounded border bg-background px-2 text-[11px]"
        >
          <option value="todo">للقيام</option>
          <option value="in_progress">قيد التنفيذ</option>
          <option value="done">منجزة</option>
          <option value="blocked">متعطلة</option>
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-xs text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
          title="حذف"
        >
          🗑️
        </button>
      </div>

      {open && (
        <div className="space-y-1.5 border-t bg-muted/20 p-2.5">
          {body.steps.length > 0 && (
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-emerald-400 transition-all" style={{ width: `${Math.round((doneCount / body.steps.length) * 100)}%` }} />
            </div>
          )}
          <ul className="space-y-1">
            {body.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={s.done} onChange={() => toggle(i)} className="size-3.5" />
                <span className={`flex-1 ${s.done ? 'text-muted-foreground line-through' : ''}`}>{s.t}</span>
                <button type="button" onClick={() => removeStep(i)} className="text-muted-foreground hover:text-destructive">×</button>
              </li>
            ))}
            {body.steps.length === 0 && (
              <li className="text-[11px] text-muted-foreground">اكسر المهمّة إلى خطوات مباشرة أدناه.</li>
            )}
          </ul>
          <div className="flex gap-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStep())}
              placeholder="خطوة مباشرة…"
              className="flex-1 rounded border bg-background px-2 py-1 text-xs"
            />
            <button type="button" onClick={addStep} disabled={!draft.trim()} className="rounded border bg-background px-2.5 text-xs hover:bg-accent disabled:opacity-50">＋</button>
          </div>
        </div>
      )}
    </li>
  )
}
