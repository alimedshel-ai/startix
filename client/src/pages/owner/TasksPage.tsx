import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { aiInitiativeBreakdown } from '@/lib/aiApi'
import { apiErrorMessage } from '@/lib/api'
import { createTask, deleteTask, getArtifact, listInitiatives, listProjects, listTasks, updateTask, type Initiative, type Project, type Task } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'
import { riskSuggestion, riskNameFromTaskTitle } from './riskTemplates'

// عمليّات المهام الفرعية المُمرَّرة لكل صفّ (إضافة يدويّة · اقتراح · تحديث · حذف).
type SubOps = {
  add: (parent: Task, title: string) => Promise<void>
  suggest: (parent: Task) => Promise<void>
  update: (parent: Task, sub: Task, patch: Partial<Task>) => void
  remove: (parent: Task, sub: Task) => void
}

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

// رتبة الأولويّة للترتيب (تشمل قيم المبادرات: critical/urgent) — الأعلى أوّلاً.
const PRIORITY_RANK: Record<string, number> = { critical: 5, urgent: 4, high: 3, medium: 2, low: 1 }
function prank(p: string): number {
  return PRIORITY_RANK[p] ?? 0
}
function dueAsc(a: Task, b: Task): number {
  const ta = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
  const tb = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
  return ta - tb
}

// ─── أرباع أيزنهاور: مهمّ (الأولويّة) × عاجل (قرب الاستحقاق) ──────────
// عاجل = مستحقّة خلال ٧ أيّام أو متأخّرة. مهمّ = أولويّة عالية فأعلى.
function isImportant(t: Task): boolean {
  return prank(t.priority) >= 3 // high / urgent / critical
}
function isUrgent(t: Task): boolean {
  if (t.status === 'done' || !t.dueDate) return false
  const days = (new Date(t.dueDate).getTime() - Date.now()) / 86_400_000
  return days <= 7 // يشمل المتأخّرة (سالبة)
}
type QuadKey = 'do' | 'schedule' | 'delegate' | 'eliminate'
function eisenQuadrant(t: Task): QuadKey {
  const imp = isImportant(t)
  const urg = isUrgent(t)
  if (imp && urg) return 'do'
  if (imp && !urg) return 'schedule'
  if (!imp && urg) return 'delegate'
  return 'eliminate'
}
const QUADRANTS = [
  ['do',        '🔴 افعل الآن',      'مهمّ + عاجل — أنجِزها بنفسك فوراً.',        'border-rose-300 bg-rose-50/50'],
  ['schedule',  '🔵 خطّط لها',       'مهمّ + غير عاجل — احجز لها وقتاً.',          'border-sky-300 bg-sky-50/50'],
  ['delegate',  '🟡 فوّضها للفريق',  'غير مهمّ + عاجل — وزّعها على العضو المناسب.', 'border-amber-300 bg-amber-50/50'],
  ['eliminate', '⚪ قلّلها / أجّلها', 'غير مهمّ + غير عاجل — راجِع جدواها.',        'border-slate-300 bg-slate-50/60'],
] as const

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
  const specialty = useAuthStore((s) => s.user?.specialtyDeptType ?? null)
  const isRescueMode = searchParams.get('from') === 'emergency'
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState<{ status: string; projectId: string; owner: string }>({ status: 'all', projectId: 'all', owner: 'all' })
  // ترتيب القائمة — افتراضياً «حسب الأولويّة» (كما رتّبنا المبادرات).
  const [sortBy, setSortBy] = useState<'priority' | 'due' | 'created'>('priority')
  // عرض المهام: قائمة مسطّحة أو تقسيمها حسب أرباع أيزنهاور.
  const [view, setView] = useState<'list' | 'quadrants'>('list')
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
  // جاهزيّة أيزنهاور — لتوجيه بدل زرّ توليد يُخفق حين لا مهامّ «افعل الآن/جدولها».
  const [eisenReady, setEisenReady] = useState(true)

  useEffect(() => {
    Promise.all([listTasks(companyId), listProjects(companyId), listInitiatives(companyId).catch(() => [] as Initiative[])])
      .then(([t, p, i]) => { setTasks(t); setProjects(p); setInitiatives(i) })
      .catch(() => undefined)
      .finally(() => setLoading(false))
    getArtifact<{ tasks?: Array<{ quadrant: string; title?: string }> }>(companyId, 'EISENHOWER')
      .then((a) => setEisenReady((a?.data?.tasks ?? []).some((t) => (t.quadrant === 'do' || t.quadrant === 'schedule') && !!t.title?.trim())))
      .catch(() => setEisenReady(false))
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

  // ─── مهام فرعية ──────────────────────────────────────────────────
  // تُخزَّن مضمَّنةً في task.subtasks (من listTasks للآباء فقط). كل عمليّة
  // تُحدّث مصفوفة فروع الأب في الحالة.
  function patchSubs(parentId: string, subs: Task[]) {
    setTasks((p) => p.map((x) => (x.id === parentId ? { ...x, subtasks: subs } : x)))
  }
  const subOps: SubOps = {
    async add(parent, title) {
      const clean = title.trim()
      if (!clean) return
      try {
        const sub = await createTask({ companyId, title: clean, parentTaskId: parent.id, priority: parent.priority })
        patchSubs(parent.id, [...(parent.subtasks ?? []), sub])
      } catch (err) { toast.error(apiErrorMessage(err, 'فشل إضافة المهمة الفرعية')) }
    },
    // الاقتراح: مهامّ «معالجة: <خطر>» تُشتقّ من كتالوج التخفيف (إجراءات محدّدة لكلّ
    // خطر، بلا مفتاح) — لا مولّد المبادرات العامّ الذي يفترض مشروع شراء/تركيب فيكرّر
    // «حدّد المتطلّبات + عرّف مسؤول التشغيل» لأيّ خطر. غير ذلك: المولّد كما هو.
    async suggest(parent) {
      try {
        const riskName = riskNameFromTaskTitle(parent.title)
        const sug = riskName ? riskSuggestion(riskName, specialty) : undefined
        let titles: string[]
        let sourceLabel: string
        if (sug) {
          titles = sug.mitigations
          sourceLabel = '(من كتالوج المعالجة)'
        } else {
          const bd = await aiInitiativeBreakdown({ companyId, title: parent.title, description: parent.description ?? undefined })
          titles = bd.subTasks.slice(0, 8).map((s) => s.title)
          sourceLabel = bd.heuristic ? '(قالب تقديريّ)' : '(بالذكاء)'
        }
        const existing = new Set((parent.subtasks ?? []).map((s) => s.title.trim()))
        const created: Task[] = []
        for (const t of titles) {
          const clean = t.trim()
          if (!clean || existing.has(clean)) continue
          try {
            const sub = await createTask({ companyId, title: clean, parentTaskId: parent.id, priority: parent.priority })
            created.push(sub); existing.add(clean)
          } catch { /* skip واحدة */ }
        }
        if (created.length === 0) { toast.message('لا مهام فرعية جديدة تُقترَح.'); return }
        patchSubs(parent.id, [...(parent.subtasks ?? []), ...created])
        toast.success(`أُضيفت ${created.length} مهمة فرعية ${sourceLabel}.`)
      } catch (err) { toast.error(apiErrorMessage(err, 'تعذّر الاقتراح')) }
    },
    async update(parent, sub, patch) {
      try {
        const updated = await updateTask(sub.id, patch)
        patchSubs(parent.id, (parent.subtasks ?? []).map((s) => (s.id === sub.id ? { ...s, ...updated } : s)))
      } catch (err) { toast.error(apiErrorMessage(err, 'فشل تحديث المهمة الفرعية')) }
    },
    async remove(parent, sub) {
      try {
        await deleteTask(sub.id)
        patchSubs(parent.id, (parent.subtasks ?? []).filter((s) => s.id !== sub.id))
      } catch (err) { toast.error(apiErrorMessage(err, 'فشل الحذف')) }
    },
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

  // 📥 جلب المهام من المبادرات المرتّبة — كل مبادرة تُصبح مهمّة، بترتيب
  //    الأولويّة نفسه الذي رتّبناه (حرجة→منخفضة)، مرتبطةً بمشروعها إن وُجد،
  //    وباستحقاق متدرّج. الأعلى أولويّةً يُنشأ أوّلاً فيتصدّر القائمة — جاهز
  //    للتوزيع على الفريق عبر «الجهة المنفّذة».
  async function generateFromInitiatives() {
    setGenerating(true)
    try {
      const usable = initiatives.filter((i) => i.title.trim())
      if (usable.length === 0) {
        toast.error('لا مبادرات مرتّبة بعد — رتّبها في مرحلة «المبادرات» أوّلاً.')
        return
      }
      const ordered = [...usable].sort((a, b) => prank(b.priority) - prank(a.priority))
      const existing = new Set(tasks.map((t) => t.title.trim()))
      const now = new Date()
      const created: Task[] = []
      for (const [i, ini] of ordered.entries()) {
        const title = ini.title.trim()
        if (existing.has(title)) continue
        // اربطها بمشروع المبادرة إن وُجد (project.initiativeId === ini.id).
        const proj = projects.find((p) => p.initiativeId === ini.id)
        const due = new Date(now)
        due.setDate(now.getDate() + 7 + i * 3) // تدرّج حسب الترتيب
        try {
          const t = await createTask({
            companyId,
            title,
            projectId: proj?.id,
            priority: ini.priority || 'medium',
            level: ini.level ?? undefined,
            dueDate: due.toISOString(),
          })
          created.push(t)
          existing.add(title)
        } catch { /* skip */ }
      }
      if (created.length === 0) {
        toast.message('كل المبادرات محوّلة لمهام سلفاً — لا جديد.')
        return
      }
      setTasks((prev) => [...created, ...prev])
      toast.success(`📥 جُلبت ${created.length} مهمّة من المبادرات مرتّبةً حسب الأولويّة — وزّعها على الفريق.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الجلب من المبادرات'))
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
    const list = tasks.filter((t) => {
      if (filter.status !== 'all' && t.status !== filter.status) return false
      if (filter.projectId !== 'all' && (t.projectId ?? '') !== filter.projectId) return false
      if (filter.owner !== 'all' && (t.owner?.trim() || '—') !== filter.owner) return false
      return true
    })
    // «حسب الأولويّة» (كما رتّبنا) هو الافتراضي؛ أو الاستحقاق؛ أو ترتيب الإنشاء.
    if (sortBy === 'priority') return [...list].sort((a, b) => prank(b.priority) - prank(a.priority) || dueAsc(a, b))
    if (sortBy === 'due') return [...list].sort(dueAsc)
    return list
  }, [tasks, filter, sortBy])

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
                {eisenReady ? (
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
                ) : (
                  // أيزنهاور فارغ → التوليد التلقائيّ يُخفق؛ نوجّه للخطوة السابقة بدل زرّ يفشل.
                  <div className="mt-3 rounded-lg border-2 border-rose-300 bg-white/70 p-3">
                    <div className="text-xs font-bold text-rose-900">
                      التوليد التلقائيّ يقرأ مهامّ «افعل الآن» من أيزنهاور — وهي فارغة بعد. أكمل ما قبلها أوّلاً بالترتيب:
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link to={`/risk-map?client=${companyId}&from=emergency`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                        ① ⚠️ سجّل مخاطرك وقيّم خطورتها
                      </Link>
                      <Link to={`/eisenhower?client=${companyId}&from=emergency`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                        ② 🎯 افرزها في أيزنهاور
                      </Link>
                    </div>
                    <div className="mt-2 text-[11px] text-rose-800/80">
                      بعد أن تصير مهامّ «افعل الآن» بأيزنهاور، ارجع هنا فيجهز زرّ التوليد التلقائيّ — أو أنشئ مهمّة يدوياً أدناه.
                    </div>
                  </div>
                )}
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

      {/* 📥 جسر الأنبوب: المبادرات المرتّبة → مهام موزّعة حسب ما رتّبنا */}
      <Card className="overflow-hidden border-2 border-primary/30 bg-gradient-to-l from-primary/10 to-transparent">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="text-sm font-bold">📥 جلب المهام من المبادرات المرتّبة</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              حوّل مبادراتك — مرتّبةً بالأولويّة كما رتّبناها — إلى مهام جاهزة للتوزيع على الفريق.
              {initiatives.length > 0
                ? <> لديك <b className="text-foreground tabular-nums">{initiatives.length}</b> مبادرة.</>
                : ' لا مبادرات بعد — أنشئها في مرحلة «المبادرات».'}
            </p>
          </div>
          <Button onClick={generateFromInitiatives} disabled={generating || initiatives.length === 0} size="lg">
            {generating ? 'جاري الجلب…' : '📥 اجلب حسب الأولويّة'}
          </Button>
        </CardContent>
      </Card>

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
              {/* مبدّل العرض: قائمة ↔ أرباع أيزنهاور */}
              <div className="flex rounded-md border p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className={`rounded px-2 py-0.5 ${view === 'list' ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  ☰ قائمة
                </button>
                <button
                  type="button"
                  onClick={() => setView('quadrants')}
                  className={`rounded px-2 py-0.5 ${view === 'quadrants' ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  ▦ أرباع
                </button>
              </div>
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
              <select
                className="rounded-md border bg-background px-2 py-1 text-xs"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                title="ترتيب القائمة"
              >
                <option value="priority">ترتيب: الأولويّة</option>
                <option value="due">ترتيب: الاستحقاق</option>
                <option value="created">ترتيب: الأحدث</option>
              </select>
            </div>
          </div>
          <CardDescription>{filtered.length} مهمة معروضة من {tasks.length} إجمالي · مرتّبة حسب {sortBy === 'priority' ? 'الأولويّة' : sortBy === 'due' ? 'الاستحقاق' : 'الأحدث'}.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">جاري التحميل…</p>}

          {/* عرض «أرباع»: تقسيم المهام على مصفوفة أيزنهاور (مهمّ × عاجل) */}
          {view === 'quadrants' ? (
            <div className="grid gap-3 md:grid-cols-2">
              {QUADRANTS.map(([key, label, hint, tint]) => {
                const items = filtered.filter((t) => eisenQuadrant(t) === key)
                return (
                  <div key={key} className={`rounded-xl border p-3 ${tint}`}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-bold">{label}</span>
                      <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums">{items.length}</span>
                    </div>
                    <p className="mb-2 text-[11px] text-muted-foreground">{hint}</p>
                    <ul className="space-y-2">
                      {items.map((t) => (
                        <TaskRow key={t.id} t={t} projects={projects} onUpdate={update} onRemove={remove} subOps={subOps} />
                      ))}
                      {items.length === 0 && (
                        <li className="rounded-md border border-dashed bg-card/50 p-2 text-center text-[11px] text-muted-foreground">لا مهام هنا</li>
                      )}
                    </ul>
                  </div>
                )
              })}
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((t) => (
                <TaskRow key={t.id} t={t} projects={projects} onUpdate={update} onRemove={remove} subOps={subOps} />
              ))}
              {!loading && filtered.length === 0 && (
                <li className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  لا توجد مهام مطابقة.
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}

// ─── صفّ مهمّة واحد — مُشترَك بين عرضَي «القائمة» و«الأرباع» ──────────
function TaskRow({ t, projects, onUpdate, onRemove, subOps }: {
  t: Task
  projects: Project[]
  onUpdate: (t: Task, patch: Partial<Task>) => void
  onRemove: (t: Task) => void
  subOps: SubOps
}) {
  const meta = sMeta(t.status)
  const overdue = isOverdue(t)
  const subs = t.subtasks ?? []
  const doneCount = subs.filter((s) => s.status === 'done').length
  const [open, setOpen] = useState(subs.length > 0)
  const [newSub, setNewSub] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSuggest() {
    setBusy(true)
    try { await subOps.suggest(t) } finally { setBusy(false) }
    setOpen(true)
  }
  async function onAdd() {
    const v = newSub.trim()
    if (!v) return
    setNewSub('')
    await subOps.add(t, v)
    setOpen(true)
  }

  return (
    <li className={`flex flex-col gap-2 rounded-xl border p-3 ${meta[2]}`}>
      <div className="flex items-center gap-2">
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
                  if (v !== (t.owner?.trim() ?? '')) onUpdate(t, { owner: v || null })
                }}
              />
            </span>
          </div>
        </div>
        <select
          className="rounded-md border bg-background px-1.5 py-1 text-xs"
          value={t.status}
          onChange={(e) => onUpdate(t, { status: e.target.value })}
        >
          {STATUS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <button onClick={() => onRemove(t)} className="text-xs text-muted-foreground hover:text-destructive">×</button>
      </div>

      {/* شريط المهام الفرعية: طيّ + اقتراح */}
      <div className="flex flex-wrap items-center gap-2 pr-4 text-[11px]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded-md border bg-card/60 px-2 py-0.5 font-medium text-muted-foreground hover:text-foreground"
        >
          <span>{open ? '▾' : '▸'}</span>
          <span>مهام فرعية{subs.length > 0 ? ` (${doneCount}/${subs.length})` : ''}</span>
        </button>
        <button
          type="button"
          onClick={onSuggest}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          title="يقترح النظام مهاماً فرعية (قالب الآن · بالذكاء عند ضبط مفتاح Claude)"
        >
          {busy ? '…جارٍ الاقتراح' : '✨ اقتراح'}
        </button>
      </div>

      {open && (
        <div className="mr-4 space-y-1 border-r-2 border-dashed pr-3">
          {subs.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={s.status === 'done'}
                onChange={(e) => subOps.update(t, s, { status: e.target.checked ? 'done' : 'todo' })}
                className="size-3.5 accent-emerald-600"
              />
              <span className={`flex-1 ${s.status === 'done' ? 'text-muted-foreground line-through' : ''}`}>{s.title}</span>
              <button onClick={() => subOps.remove(t, s)} className="text-muted-foreground hover:text-destructive">×</button>
            </div>
          ))}
          {subs.length === 0 && <p className="text-[11px] text-muted-foreground">لا مهام فرعية — أضِف يدويّاً أو اضغط «✨ اقتراح».</p>}
          <div className="flex items-center gap-2 pt-1">
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void onAdd() } }}
              placeholder="＋ مهمة فرعية يدويّة…"
              className="flex-1 rounded border bg-background px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => void onAdd()}
              disabled={!newSub.trim()}
              className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              إضافة
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
