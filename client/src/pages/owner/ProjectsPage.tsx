import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { CATEGORY_META, categorize } from '@/lib/directionCategory'
import {
  createProject, deleteProject,
  getArtifact,
  listInitiatives, listProjects, updateProject,
  type Initiative, type Project,
} from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'
import type { StrategyPath } from '@/types/user'

const STATUS = [
  ['active',    'نشط',     'border-sky-300 bg-sky-50/60'],
  ['planning',  'تخطيط',    'border-amber-300 bg-amber-50/60'],
  ['done',      'مكتمل',    'border-emerald-300 bg-emerald-50/60'],
  ['paused',    'متوقف',    'border-slate-200 bg-slate-50/60'],
  ['cancelled', 'ملغى',     'border-rose-300 bg-rose-50/60'],
] as const

// أولوية مأخوذة من المبادرة المرتبطة.
const PRIORITY_META: Record<string, { labelAr: string; badgeCls: string; rank: number }> = {
  critical: { labelAr: 'حرجة',    badgeCls: 'border-rose-400 bg-rose-100 text-rose-800',      rank: 3 },
  high:     { labelAr: 'مرتفعة',  badgeCls: 'border-orange-400 bg-orange-100 text-orange-800', rank: 2 },
  medium:   { labelAr: 'متوسطة',  badgeCls: 'border-amber-400 bg-amber-100 text-amber-800',   rank: 1 },
  low:      { labelAr: 'منخفضة',  badgeCls: 'border-emerald-400 bg-emerald-100 text-emerald-800', rank: 0 },
}

// درجة الخطورة — مُشتقّة من المدّة والأولوية والسياق.
const RISK_META: Record<'low' | 'medium' | 'high', { labelAr: string; icon: string; badgeCls: string }> = {
  low:    { labelAr: 'خطورة منخفضة', icon: '🟢', badgeCls: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  medium: { labelAr: 'خطورة متوسطة', icon: '🟡', badgeCls: 'border-amber-300 bg-amber-50 text-amber-800' },
  high:   { labelAr: 'خطورة عالية', icon: '🔴', badgeCls: 'border-rose-300 bg-rose-50 text-rose-800' },
}

// أعمدة شاشة التنفيذ (kanban) — تجميع بالحالة+الأولوية بدل قائمة مسطّحة تُرهِق
// حين تكثر الخطوات. الحالة المنتهية (done/cancelled) عمودٌ واحد؛ غير المنتهية
// تنقسم بالأولوية: حرج/مرتفع = «عاجل الآن»، وغيرها = «قادم». التقسيم شامل
// (يجمع كل الخطوات، لا يُسقِط شيئاً — المجموع = عدد الخطوات).
const isTerminal = (s: string) => s === 'done' || s === 'cancelled'
const EXEC_COLUMNS: { key: string; title: string; tint: string; match: (it: { project: { status: string }; priority: string }) => boolean }[] = [
  { key: 'urgent',   title: '🔴 عاجل الآن', tint: 'border-rose-200 bg-rose-50/40',      match: (it) => !isTerminal(it.project.status) && (it.priority === 'critical' || it.priority === 'high') },
  { key: 'upcoming', title: '🟡 قادم',       tint: 'border-amber-200 bg-amber-50/30',    match: (it) => !isTerminal(it.project.status) && it.priority !== 'critical' && it.priority !== 'high' },
  { key: 'done',     title: '✅ مكتمل',       tint: 'border-emerald-200 bg-emerald-50/40', match: (it) => isTerminal(it.project.status) },
]

function sTint(s: string): string {
  return STATUS.find((x) => x[0] === s)?.[2] ?? 'border-slate-200 bg-card'
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function daysBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000))
}

// مدّة مشروع افتراضية بأيام — بحسب مسار المدير + أولوية المبادرة + أفق H١/H٢/H٣.
function suggestedDurationDays(
  path: StrategyPath | null,
  priority: string,
  horizon: 'h1' | 'h2' | 'h3' | null,
): number {
  let base = path === 'QUICK' ? 60 : path === 'MEDIUM' ? 90 : 180
  if (horizon === 'h1') base -= 30
  else if (horizon === 'h3') base += 60
  if (priority === 'critical') base -= 15
  else if (priority === 'low') base += 30
  return Math.max(30, base)
}

// تقييم خطورة المشروع — مبسّط بحسب المدّة والأولوية والفئة.
function assessRisk(
  durationDays: number,
  priority: string,
  category: string,
): 'low' | 'medium' | 'high' {
  const riskyCats = new Set(['innovation', 'exit', 'defense'])
  let score = 0
  if (durationDays > 120) score += 2
  else if (durationDays > 60) score += 1
  if (priority === 'critical') score += 1
  if (riskyCats.has(category)) score += 1
  if (score >= 3) return 'high'
  if (score >= 1) return 'medium'
  return 'low'
}

interface Sources {
  initiatives: { total: number; critical: number; high: number; medium: number; low: number }
  decidedChoice: string | null
  horizons: { has: boolean; count: number }
  risks: { has: boolean; count: number }
}

export function ProjectsPage() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const q = client ? `&client=${client}` : ''
  return <Navigate to={`/execute?tab=projects${q}`} replace />
}

export function ProjectsView({ companyId }: { companyId: string }) {
  return <Editor companyId={companyId} />
}

function Editor({ companyId }: { companyId: string }) {
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const strategyPath = user?.strategyPath ?? null

  const [items, setItems] = useState<Project[]>([])
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sources, setSources] = useState<Sources | null>(null)
  const navigate = useNavigate()
  const today = new Date().toISOString().slice(0, 10)
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString().slice(0, 10)
  const [form, setForm] = useState({ title: '', description: '', startDate: today, endDate: future })

  useEffect(() => {
    listProjects(companyId).then(setItems).catch(() => undefined).finally(() => setLoading(false))
    listInitiatives(companyId).then((all) => {
      setInitiatives(all)
      // احصائيات المبادرات (لكشف الأولوية على شارة السياق)
      const counts = { total: all.length, critical: 0, high: 0, medium: 0, low: 0 }
      for (const i of all) {
        if (i.priority === 'critical') counts.critical++
        else if (i.priority === 'high') counts.high++
        else if (i.priority === 'medium') counts.medium++
        else counts.low++
      }
      // فحص باقي المصادر بالتوازي
      ;(async () => {
        const [cho, h3, risk] = await Promise.all([
          getArtifact<{ decidedTitle: string | null }>(companyId, 'CHOICES').catch(() => null),
          getArtifact<{ initiatives?: { title: string; horizon: string }[] }>(
            companyId, specialty ? `THREE_HORIZONS_${specialty}` : 'THREE_HORIZONS',
          ).catch(() => null),
          getArtifact<{ risks?: unknown[] }>(companyId, 'RISK_REGISTER').catch(() => null),
        ])
        setSources({
          initiatives: counts,
          decidedChoice: cho?.data?.decidedTitle ?? null,
          horizons: { has: (h3?.data?.initiatives?.length ?? 0) > 0, count: h3?.data?.initiatives?.length ?? 0 },
          risks: { has: (risk?.data?.risks?.length ?? 0) > 0, count: risk?.data?.risks?.length ?? 0 },
        })
      })()
    }).catch(() => undefined)
  }, [companyId, specialty])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const p = await createProject({
        companyId,
        title: form.title,
        description: form.description,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      })
      setItems((prev) => [...prev, p])
      setForm({ title: '', description: '', startDate: today, endDate: future })
      toast.success('تم إنشاء خطوة التنفيذ')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإنشاء'))
    } finally {
      setCreating(false)
    }
  }

  async function update(p: Project, patch: Partial<Project>) {
    try {
      const updated = await updateProject(p.id, patch)
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...updated } : x)))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحديث'))
    }
  }

  async function remove(p: Project) {
    if (!confirm(`حذف خطوة التنفيذ "${p.title}"؟`)) return
    try {
      await deleteProject(p.id)
      setItems((prev) => prev.filter((x) => x.id !== p.id))
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  // 🧠 توليد ذكيّ — يحوّل المبادرات المخطّطة إلى خطوات تنفيذ بتواريخ وأولويات ذكيّة.
  async function generateFromInitiatives() {
    if (initiatives.length === 0) {
      toast.error('لا مبادرات مسجّلة — افتح /initiatives أوّلاً.')
      return
    }
    setGenerating(true)
    try {
      // اقرأ الآفاق الثلاثة لمعرفة أفق كل مبادرة.
      const h3 = await getArtifact<{ initiatives?: { title: string; horizon: 'h1' | 'h2' | 'h3' }[] }>(
        companyId, specialty ? `THREE_HORIZONS_${specialty}` : 'THREE_HORIZONS',
      ).catch(() => null)
      const horizonByTitle = new Map<string, 'h1' | 'h2' | 'h3'>()
      for (const h of (h3?.data?.initiatives ?? [])) {
        horizonByTitle.set(h.title.trim(), h.horizon)
      }

      const existingTitles = new Set(items.map((p) => p.title))
      const eligible = initiatives.filter((i) => i.status === 'planned' || i.status === 'in_progress')
      const rankedEligible = [...eligible].sort((a, b) => {
        const aRank = PRIORITY_META[a.priority]?.rank ?? 0
        const bRank = PRIORITY_META[b.priority]?.rank ?? 0
        return bRank - aRank
      })

      // لا مبادرات مؤهّلة (مخطّطة/جارية): ميّز السبب بدل رسالة «لها خطوات سلفاً»
      // المضلّلة. المولّد يبني الخطوات من المبادرات المعتمَدة فقط، لا المقترحة.
      if (eligible.length === 0) {
        toast.message(
          initiatives.length === 0
            ? 'لا مبادرات محفوظة بعد — أنشئ مبادرات في صفحة «المبادرات» أوّلاً.'
            : `لديك ${initiatives.length} مبادرة «مقترحة» لم تُعتمَد بعد — رقِّها إلى «مخطّطة» في صفحة المبادرات (تحتاج: ربط هدف + مستوى + تكلفة) ثمّ ولّد الخطوات هنا.`,
          {
            duration: 10000,
            action: { label: 'افتح المبادرات ←', onClick: () => navigate('/initiatives') },
          },
        )
        return
      }

      let added = 0
      const summary = { critical: 0, high: 0, medium: 0, low: 0 }
      const nowIso = today
      let cursorDays = 0

      for (const i of rankedEligible) {
        if (existingTitles.has(i.title)) continue
        const cleanTitle = i.title.replace(/^\[[A-Z]{2}\]\s*/, '').replace(/^⭐ \[قرار\] /, '⭐ ')
        const horizon = horizonByTitle.get(i.title.trim()) ?? horizonByTitle.get(cleanTitle) ?? null
        const durationDays = suggestedDurationDays(strategyPath, i.priority, horizon)
        // تسلسل المشاريع الحرجة أوّلاً بتواريخ متتابعة (بدء غداً).
        const start = new Date(nowIso)
        start.setDate(start.getDate() + cursorDays)
        const end = new Date(start)
        end.setDate(end.getDate() + durationDays)
        // المبادرات الحرجة تبدأ فوراً؛ العالية بعد ٧ أيام؛ إلخ.
        const gap = i.priority === 'critical' ? 0 : i.priority === 'high' ? 7 : 15
        cursorDays += gap

        try {
          const p = await createProject({
            companyId, initiativeId: i.id,
            title: cleanTitle,
            description: i.description ?? undefined,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          })
          setItems((prev) => [...prev, p])
          added++
          summary[i.priority as keyof typeof summary] = (summary[i.priority as keyof typeof summary] ?? 0) + 1
        } catch { /* skip */ }
      }
      if (added === 0) {
        toast.message('كل المبادرات المخطّطة/الجارية لديها خطوات تنفيذ سلفاً.')
        return
      }
      const parts: string[] = []
      if (summary.critical) parts.push(`${summary.critical} حرجة`)
      if (summary.high) parts.push(`${summary.high} مرتفعة`)
      if (summary.medium) parts.push(`${summary.medium} متوسطة`)
      if (summary.low) parts.push(`${summary.low} منخفضة`)
      toast.success(`🧠 أُنشئت ${added} خطوة تنفيذ: ${parts.join(' · ')} · مدد بحسب مسارك (${strategyPath ?? 'LONG'}).`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
    }
  }

  // ─── إثراء البطاقات بأولوية وخطورة وفئة ─────────────────────
  const initiativeById = useMemo(() => {
    const m = new Map<string, Initiative>()
    for (const i of initiatives) m.set(i.id, i)
    return m
  }, [initiatives])

  const enriched = useMemo(() => items.map((p) => {
    const linked = p.initiativeId ? initiativeById.get(p.initiativeId) : null
    const priority = linked?.priority ?? 'medium'
    const cat = categorize(p.title + ' ' + (p.description ?? ''))
    const duration = daysBetween(p.startDate, p.endDate) ?? 90
    const risk = assessRisk(duration, priority, cat)
    return { project: p, priority, category: cat, risk, duration }
  }), [items, initiativeById])

  const sorted = useMemo(() => [...enriched].sort((a, b) => {
    const aRank = PRIORITY_META[a.priority]?.rank ?? 0
    const bRank = PRIORITY_META[b.priority]?.rank ?? 0
    return bRank - aRank
  }), [enriched])

  return (
    <>
      {/* بطاقة تعريف */}
      <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="p-4 text-xs leading-relaxed">
          <div className="flex items-start gap-3">
            <div className="text-2xl leading-none">📁</div>
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">ما هي خطوة التنفيذ؟</div>
              <p className="mt-1 text-muted-foreground">
                المبادرة اتجاه استراتيجي عام، لكن التنفيذ يحصل عبر <b className="text-foreground">خطوات تنفيذ محدّدة</b>
                بتاريخ بداية ونهاية وفريق ومهام. خطوة التنفيذ = مبادرة + جدول زمني + مسؤول.
              </p>
              <p className="mt-1 text-muted-foreground">
                <b className="text-foreground">🧠 المولّد يحوّل مبادراتك تلقائياً</b> إلى خطوات تنفيذ بمدد ذكيّة
                (بحسب مسارك) وأولوية مرتَّبة (الحرجة أوّلاً) وتقييم خطورة (منخفضة/متوسطة/عالية).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* شارة السياق */}
      {(specialty || strategyPath) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
            {specialty && (
              <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
                🎯 السياق: إدارة {DEPT_LABEL[specialty as DeptCode]}
              </span>
            )}
            {strategyPath && (
              <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
                {strategyPath === 'QUICK' ? '⚡ تشغيلي (قصير) — مدد ~٦٠ يوم' : strategyPath === 'MEDIUM' ? '🎯 تكتيكي (متوسّط) — مدد ~٩٠ يوم' : '🔭 استراتيجي (طويل) — مدد ~١٨٠ يوم'}
              </span>
            )}
            <span className="text-muted-foreground">
              المدد الافتراضية تُشتقّ من مسارك + أفق المبادرة (H١/H٢/H٣) + أولويتها.
            </span>
          </CardContent>
        </Card>
      )}

      {/* لوحة مصادر التخطيط */}
      {sources && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🔗 مصادر التخطيط المتاحة</CardTitle>
            <CardDescription className="text-xs">
              كل مصدر يُغذّي المولّد بمعلومات مختلفة — الأصفر يعني اختياري ينفع لكنه مفقود.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-4">
            <SourceChip
              done={sources.initiatives.total > 0}
              icon="💡"
              labelAr="المبادرات"
              hint={sources.initiatives.total > 0
                ? `${sources.initiatives.total} إجمالاً · ${sources.initiatives.critical + sources.initiatives.high} أولوية مرتفعة`
                : 'لا مبادرات — المولّد لن يعمل'}
              to="/initiatives"
              essential
            />
            <SourceChip
              done={!!sources.decidedChoice}
              icon="⭐"
              labelAr="القرار الاستراتيجي"
              hint={sources.decidedChoice ? sources.decidedChoice : 'لا قرار مُثبَّت — اختياري'}
              to="/choices"
            />
            <SourceChip
              done={sources.horizons.has}
              icon="🔭"
              labelAr="الآفاق الثلاثة"
              hint={sources.horizons.has
                ? `${sources.horizons.count} مبادرة على أفق — يوجّه المدد (H١ أقصر، H٣ أطول)`
                : 'اختياري — يجعل المدد أدقّ'}
              to="/three-horizons"
            />
            <SourceChip
              done={sources.risks.has}
              icon="⚠️"
              labelAr="خريطة المخاطر"
              hint={sources.risks.has
                ? `${sources.risks.count} مخاطر مسجّلة — تنعكس على تقييم الخطورة`
                : 'اختياري — يحسّن تقدير الخطورة'}
              to="/risk-map"
            />
          </CardContent>
        </Card>
      )}

      {/* 🧠 مولّد خطوات التنفيذ */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد خطوات تنفيذ ذكيّ</div>
              <div className="text-xs text-muted-foreground">
                يحوّل مبادراتك المخطّطة/الجارية إلى خطوات تنفيذ — تواريخ متتابعة (الحرجة فوراً، العالية +٧ يوم…)،
                مدد بحسب مسارك، وتقييم خطورة تلقائي.
              </div>
            </div>
          </div>
          <Button
            onClick={generateFromInitiatives}
            disabled={generating || creating || initiatives.length === 0}
            size="lg"
          >
            {generating ? 'جاري…' : '✨ ولّد الآن'}
          </Button>
        </CardContent>
      </Card>

      {/* نموذج إنشاء يدوي */}
      <Card className="overflow-hidden bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
        <CardHeader>
          <CardTitle className="text-base">＋ إنشاء خطوة تنفيذ يدويّة</CardTitle>
          <CardDescription>تواريخ البدء والانتهاء تظهر في مخطط جانت.</CardDescription>
        </CardHeader>
        <form onSubmit={create}>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="title">العنوان</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="مثال: إطلاق التطبيق…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="start">تاريخ البدء</Label>
              <Input id="start" type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end">تاريخ الانتهاء</Label>
              <Input id="end" type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
            </div>
            <div className="md:col-span-4 space-y-1">
              <Label htmlFor="desc">الوصف</Label>
              <Textarea id="desc" rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <Button type="submit" disabled={creating || !form.title.trim()}>{creating ? 'جاري الإنشاء…' : '+ إنشاء خطوة التنفيذ'}</Button>
            </div>
          </CardContent>
        </form>
      </Card>

      {loading && <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>}

      {items.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between px-2 text-sm">
            <span className="font-semibold">📁 خطوات التنفيذ — {items.length} خطوة (مرتّبة بالأولوية)</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {EXEC_COLUMNS.map((col) => {
              const colItems = sorted.filter(col.match)
              return (
                <div key={col.key} className={`rounded-lg border ${col.tint} p-2`}>
                  <div className="mb-2 flex items-center justify-between px-1 text-xs font-bold">
                    <span>{col.title}</span>
                    <span className="rounded-full bg-card px-2 py-0.5 tabular-nums text-muted-foreground">{colItems.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colItems.length === 0 && (
                      <p className="px-1 py-6 text-center text-[11px] text-muted-foreground">— لا خطوات —</p>
                    )}
                    {colItems.map(({ project: p, priority, category, risk }) => {
                      const catMeta = CATEGORY_META[category]
                      const prMeta = PRIORITY_META[priority] ?? PRIORITY_META.medium
                      const rkMeta = RISK_META[risk]
                      return (
                        <Card key={p.id} className={sTint(p.status)}>
                          <div className="space-y-1.5 p-2">
                            <div className="flex items-start gap-1.5">
                              <span className="text-base leading-none" title={catMeta.labelAr}>{catMeta.icon}</span>
                              <span className="flex-1 text-xs font-medium leading-tight line-clamp-2">{p.title}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 text-[9px] text-muted-foreground">
                              <span className={`rounded-full border px-1.5 py-0.5 ${prMeta.badgeCls}`}>{prMeta.labelAr}</span>
                              <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 ${rkMeta.badgeCls}`} title={rkMeta.labelAr}>{rkMeta.icon}</span>
                              <span className="tabular-nums">{p.tasks?.length ?? 0} مهمة</span>
                              <span className="tabular-nums">· ⌛ {fmtDate(p.endDate)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <select
                                className="min-w-0 flex-1 rounded border bg-background px-1 py-0.5 text-[10px]"
                                value={p.status}
                                onChange={(e) => update(p, { status: e.target.value })}
                                title="غيّر الحالة (ينقل البطاقة بين الأعمدة)"
                              >
                                {STATUS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                              </select>
                              <Link
                                to={`/manager/projects/${p.id}?client=${p.companyId}`}
                                className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
                                title="تفاصيل هذه الخطوة"
                              >🔍</Link>
                              <button onClick={() => remove(p)} className="px-1 text-[10px] text-muted-foreground transition hover:text-rose-600" title="حذف الخطوة">✕</button>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            لا خطوات تنفيذ بعد — اضغط «✨ ولّد الآن» أعلاه لتحويل مبادراتك، أو أنشئ خطوة يدويّة.
          </CardContent>
        </Card>
      )}

      {/* 🎯 الخطوة التالية → جانت */}
      {items.length > 0 && (
        <Card className="border-emerald-300 bg-emerald-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex items-start gap-3">
              <div className="text-2xl">📅</div>
              <div>
                <div className="text-sm font-bold text-emerald-900">
                  الخطوة التالية: راجع جدولك في مخطّط جانت
                </div>
                <div className="text-xs text-emerald-800/80">
                  خطوات التنفيذ الآن على خطّ زمنيّ متسلسل — افتح جانت للتأكّد من عدم التداخل ومراقبة التنفيذ.
                </div>
              </div>
            </div>
            <Link to="/gantt-chart" className={buttonVariants({ variant: 'default' })}>
              افتح جانت ←
            </Link>
          </CardContent>
        </Card>
      )}
    </>
  )
}

// ─── سطر مصدر مضغوط ─────────────────────────────────────────────
function SourceChip({
  done, icon, labelAr, hint, to, essential,
}: {
  done: boolean
  icon: string
  labelAr: string
  hint: string
  to: string
  essential?: boolean
}) {
  return (
    <div className={`rounded-lg border p-2 ${
      done
        ? 'border-emerald-300 bg-emerald-50/40'
        : essential
          ? 'border-rose-300 bg-rose-50/40'
          : 'border-amber-300 bg-amber-50/40'
    }`}>
      <div className="flex items-center gap-1.5">
        <span className="text-lg">{icon}</span>
        <span className="flex-1 text-sm font-semibold">{labelAr}</span>
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
            done
              ? 'border-emerald-400 bg-emerald-100 text-emerald-800'
              : essential
                ? 'border-rose-400 bg-rose-100 text-rose-800'
                : 'border-amber-400 bg-amber-100 text-amber-800'
          }`}
        >
          {done ? '✓' : essential ? '✗ ضروري' : '○'}
        </span>
      </div>
      <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{hint}</div>
      {!done && (
        <Link to={to} className="mt-0.5 inline-block text-[10px] text-primary hover:underline">
          افتحه ←
        </Link>
      )}
    </div>
  )
}
