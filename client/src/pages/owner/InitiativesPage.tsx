import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { CATEGORY_META, categorize } from '@/lib/directionCategory'
import {
  createInitiative, deleteInitiative, getArtifact, getSWOT,
  listInitiatives, updateInitiative,
  type Initiative,
} from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'
import type { StrategyPath } from '@/types/user'

const PRIORITIES = [
  ['critical', 'حرجة',   'border-rose-300 bg-rose-50/60'],
  ['high',     'مرتفعة',  'border-orange-300 bg-orange-50/60'],
  ['medium',   'متوسطة',  'border-amber-300 bg-amber-50/60'],
  ['low',      'منخفضة',  'border-emerald-300 bg-emerald-50/60'],
] as const

const STATUS = [
  ['planned',     'مخططة'],
  ['in_progress', 'قيد التنفيذ'],
  ['done',        'مكتملة'],
  ['cancelled',   'ملغاة'],
] as const

function pTint(p: string): string {
  return PRIORITIES.find((x) => x[0] === p)?.[2] ?? 'border-slate-200 bg-card'
}
function pLabel(p: string): string {
  return PRIORITIES.find((x) => x[0] === p)?.[1] ?? p
}
function sLabel(s: string): string {
  return STATUS.find((x) => x[0] === s)?.[1] ?? s
}

// رفع أولوية المبادرات المطابقة لمسار المدير الاستراتيجي.
function boostForPath(base: 'critical' | 'high' | 'medium' | 'low', cat: string, path: StrategyPath | null): 'critical' | 'high' | 'medium' | 'low' {
  if (!path) return base
  const pathPreference: Record<StrategyPath, string[]> = {
    QUICK:  ['efficiency', 'defense', 'customer', 'quality'],
    MEDIUM: ['growth', 'partnership', 'digital', 'people'],
    LONG:   ['innovation', 'growth', 'digital'],
  }
  const matches = pathPreference[path].includes(cat)
  if (!matches) return base
  // رفع درجة واحدة (low→medium، medium→high، high→critical).
  if (base === 'low')    return 'medium'
  if (base === 'medium') return 'high'
  if (base === 'high')   return 'critical'
  return base
}

export function InitiativesPage() {
  return (
    <StrategicShell
      title="المبادرات الاستراتيجية"
      description="حوّل تحليلاتك (TOWS + الاتجاهات + Ansoff + الآفاق) إلى مبادرات مرتّبة بحسب مسارك — بترقيم وأيقونات فئة."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

// جاهزية المصادر لتوليد المبادرات.
interface Sources {
  tows: { has: boolean; count: number }
  directions: { has: boolean; count: number }
  ansoff: { has: boolean; count: number }
  choices: { has: boolean; title: string | null }
  horizons: { has: boolean; count: number }
}

function Editor({ companyId }: { companyId: string }) {
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const strategyPath = user?.strategyPath ?? null
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    specialty != null

  const [items, setItems] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sources, setSources] = useState<Sources | null>(null)
  const [form, setForm] = useState({ title: '', description: '', priority: 'high' })

  useEffect(() => {
    listInitiatives(companyId).then(setItems).catch(() => undefined).finally(() => setLoading(false))
    // فحص جاهزية كل مصدر بالتوازي — يُشرح للمدير ماذا سيُقرأ.
    ;(async () => {
      const [swot, dir, ans, cho, h3] = await Promise.all([
        getSWOT(companyId).catch(() => null),
        getArtifact<{ directions?: { title: string }[] }>(companyId, 'DIRECTIONS').catch(() => null),
        getArtifact<{ initiatives?: { title: string; quadrant: string }[] }>(
          companyId, specialty ? `ANSOFF_${specialty}` : 'ANSOFF',
        ).catch(() => null),
        getArtifact<{ selectedDirectionId: string | null; decidedTitle: string | null }>(companyId, 'CHOICES').catch(() => null),
        getArtifact<{ initiatives?: { title: string; horizon: string }[] }>(
          companyId, specialty ? `THREE_HORIZONS_${specialty}` : 'THREE_HORIZONS',
        ).catch(() => null),
      ])
      const towsList = swot?.tows
      const towsCount = (towsList?.so?.length ?? 0) + (towsList?.st?.length ?? 0) + (towsList?.wo?.length ?? 0) + (towsList?.wt?.length ?? 0)
      setSources({
        tows:       { has: towsCount > 0, count: towsCount },
        directions: { has: (dir?.data?.directions?.length ?? 0) > 0, count: dir?.data?.directions?.length ?? 0 },
        ansoff:     { has: (ans?.data?.initiatives?.length ?? 0) > 0, count: ans?.data?.initiatives?.length ?? 0 },
        choices:    { has: !!cho?.data?.decidedTitle, title: cho?.data?.decidedTitle ?? null },
        horizons:   { has: (h3?.data?.initiatives?.length ?? 0) > 0, count: h3?.data?.initiatives?.length ?? 0 },
      })
    })()
  }, [companyId, specialty])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const i = await createInitiative({ companyId, title: form.title, description: form.description, priority: form.priority })
      setItems((p) => [...p, i])
      setForm({ title: '', description: '', priority: form.priority })
      toast.success('تمت إضافة المبادرة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإنشاء'))
    } finally {
      setCreating(false)
    }
  }

  async function update(i: Initiative, patch: Partial<Initiative>) {
    try {
      const updated = await updateInitiative(i.id, patch)
      setItems((p) => p.map((x) => (x.id === i.id ? { ...x, ...updated } : x)))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحديث'))
    }
  }

  async function remove(i: Initiative) {
    if (!confirm(`حذف المبادرة "${i.title}"؟`)) return
    try {
      await deleteInitiative(i.id)
      setItems((p) => p.filter((x) => x.id !== i.id))
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  // 🧠 مولّد ذكيّ موحّد يقرأ كل المصادر مرّة واحدة ويُنشئ مبادرات
  // بترتيب واحد + أولوية مرفوعة للمطابق لمسارك + بلا تكرار.
  async function generateFromAll() {
    if (!sources) return
    setGenerating(true)
    try {
      const existing = new Set(items.map((x) => x.title.trim()))
      const toCreate: { title: string; description: string; priority: string; source: string }[] = []

      // ⭐ Choices — أعلى أولوية (القرار الاستراتيجي المُثبَّت)
      if (sources.choices.has && sources.choices.title) {
        const t = `⭐ [قرار] ${sources.choices.title}`
        if (!existing.has(t)) {
          toCreate.push({ title: t, description: 'المبادرة الأمّ من القرار الاستراتيجي المُثبَّت.', priority: 'critical', source: 'القرار' })
          existing.add(t)
        }
      }

      // TOWS
      try {
        const swot = await getSWOT(companyId)
        const tows = swot?.tows
        if (tows) {
          const pairs: [string, string[], 'critical' | 'high'][] = [
            ['SO', tows.so ?? [], 'high'],
            ['WO', tows.wo ?? [], 'high'],
            ['ST', tows.st ?? [], 'critical'],
            ['WT', tows.wt ?? [], 'critical'],
          ]
          for (const [quad, list, basePriority] of pairs) {
            for (const strat of list.slice(0, 2)) {
              const clean = strat.trim()
              if (!clean) continue
              const title = `[${quad}] ${clean.slice(0, 80)}${clean.length > 80 ? '…' : ''}`
              if (existing.has(title)) continue
              const cat = categorize(clean)
              const priority = boostForPath(basePriority, cat, strategyPath)
              toCreate.push({ title, description: clean, priority, source: 'TOWS' })
              existing.add(title)
            }
          }
        }
      } catch { /* skip */ }

      // Directions — التصنيف بحسب score
      try {
        const dirArt = await getArtifact<{ directions: { title: string; description: string; feasibility: number; impact: number }[] }>(companyId, 'DIRECTIONS')
        for (const d of (dirArt?.data?.directions ?? []).slice(0, 6)) {
          if (!d.title?.trim()) continue
          const clean = d.title.replace(/^\[[A-Z]{2}\]\s*/, '').trim()
          if (existing.has(clean)) continue
          const s = d.feasibility * d.impact
          const basePriority: 'high' | 'medium' | 'low' = s >= 16 ? 'high' : s >= 10 ? 'medium' : 'low'
          const cat = categorize(clean + ' ' + (d.description ?? ''))
          const priority = boostForPath(basePriority, cat, strategyPath)
          toCreate.push({ title: clean, description: d.description ?? '', priority, source: 'الاتجاهات' })
          existing.add(clean)
        }
      } catch { /* skip */ }

      // Ansoff — الأولوية بحسب الربع
      try {
        const ansArt = await getArtifact<{ initiatives: { title: string; quadrant: string }[] }>(
          companyId, specialty ? `ANSOFF_${specialty}` : 'ANSOFF',
        )
        const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
          marketPenetration:  'high',
          productDevelopment: 'medium',
          marketDevelopment:  'medium',
          diversification:    'low',
        }
        for (const i of (ansArt?.data?.initiatives ?? []).slice(0, 4)) {
          if (!i.title?.trim()) continue
          if (existing.has(i.title.trim())) continue
          const basePriority = priorityMap[i.quadrant] ?? 'medium'
          const cat = categorize(i.title)
          const priority = boostForPath(basePriority, cat, strategyPath)
          toCreate.push({ title: i.title.trim(), description: `من Ansoff / ${i.quadrant}`, priority, source: 'Ansoff' })
          existing.add(i.title.trim())
        }
      } catch { /* skip */ }

      // Three Horizons — الأولوية: H1=high، H2=medium، H3=low
      try {
        const h3Art = await getArtifact<{ initiatives: { title: string; horizon: string }[] }>(
          companyId, specialty ? `THREE_HORIZONS_${specialty}` : 'THREE_HORIZONS',
        )
        const hPri: Record<string, 'high' | 'medium' | 'low'> = { h1: 'high', h2: 'medium', h3: 'low' }
        for (const i of (h3Art?.data?.initiatives ?? []).slice(0, 4)) {
          if (!i.title?.trim()) continue
          if (existing.has(i.title.trim())) continue
          const basePriority = hPri[i.horizon] ?? 'medium'
          const cat = categorize(i.title)
          const priority = boostForPath(basePriority, cat, strategyPath)
          toCreate.push({ title: i.title.trim(), description: `من الآفاق الثلاثة / ${i.horizon.toUpperCase()}`, priority, source: 'الآفاق الثلاثة' })
          existing.add(i.title.trim())
        }
      } catch { /* skip */ }

      if (toCreate.length === 0) {
        toast.error('لا مبادرات جديدة للتوليد — الكلّ مضاف سلفاً أو المصادر فارغة.')
        return
      }
      // إنشاء المبادرات بالتوازي.
      const created = await Promise.all(toCreate.map((x) => createInitiative({
        companyId, title: x.title, description: x.description, priority: x.priority,
      }).catch(() => null)))
      const okCreated = created.filter((c): c is Initiative => c != null)
      setItems((p) => [...p, ...okCreated])
      const sourceSummary = summarizeSources(toCreate)
      toast.success(`🧠 أُضيف ${okCreated.length} مبادرة: ${sourceSummary}${strategyPath ? ` · أولوية مرفوعة للمطابق لمسارك ${strategyPath}` : ''}.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
    }
  }

  // إحصاءات
  const counts = useMemo(() => items.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1
    return acc
  }, {}), [items])
  const inProgress = counts.in_progress ?? 0
  const done = counts.done ?? 0
  const suggestedNextStep = useMemo(() => {
    if (items.length === 0) return null
    if (inProgress === 0 && done === 0) {
      return {
        icon: '📁',
        labelAr: 'حوّل مبادراتك إلى مشاريع',
        hint: 'أنشئ مشاريع تحت كل مبادرة لتصبح قابلة للتنفيذ.',
        to: '/projects',
        cta: 'انتقل للمشاريع ←',
      }
    }
    if (inProgress > 0) {
      return {
        icon: '📅',
        labelAr: 'خطّط تنفيذ المبادرات النشطة',
        hint: `${inProgress} مبادرة قيد التنفيذ — رتّبها زمنياً في مخطّط جانت.`,
        to: '/gantt-chart',
        cta: 'افتح مخطّط جانت ←',
      }
    }
    if (done > 0 && inProgress === 0) {
      return {
        icon: '🔁',
        labelAr: 'راجع المُنجَز واختر التالي',
        hint: `${done} مبادرة مُكتَملة — استخدم مصفوفة الأولوية لاختيار التالي.`,
        to: '/priority-matrix',
        cta: 'افتح مصفوفة الأولوية ←',
      }
    }
    return null
  }, [items.length, inProgress, done])

  return (
    <>
      {/* شارة السياق */}
      {(isDeptScoped || strategyPath) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
            {isDeptScoped && specialty && (
              <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
                🎯 السياق: إدارة {DEPT_LABEL[specialty as DeptCode]}
              </span>
            )}
            {strategyPath && (
              <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
                {strategyPath === 'QUICK' ? '⚡ مسارك: سريع' : strategyPath === 'MEDIUM' ? '🎯 مسارك: متوسط' : '🔭 مسارك: طويل'}
              </span>
            )}
            <span className="text-muted-foreground">
              المبادرات المطابقة لفئة مسارك تُرفَع أولويتها تلقائياً عند التوليد.
            </span>
          </CardContent>
        </Card>
      )}

      {/* لوحة جاهزية المصادر — يشرح ما سيقرأه المولّد */}
      {sources && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🔗 المصادر المتاحة للمولّد</CardTitle>
            <CardDescription className="text-xs">
              كل مصدر يقدّم مبادرات بأولوية مختلفة. اضغط الناقص لإكماله.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-5">
            <SourceChip done={sources.choices.has} icon="⭐" labelAr="القرار" hint={sources.choices.has ? sources.choices.title! : 'لا قرار مثبَّت'} to="/choices" priority="critical" />
            <SourceChip done={sources.tows.has} icon="🔄" labelAr="TOWS" hint={sources.tows.has ? `${sources.tows.count} استراتيجية` : 'أكمل SWOT ثم TOWS'} to="/tows" priority="critical/high" />
            <SourceChip done={sources.directions.has} icon="🎯" labelAr="الاتجاهات" hint={sources.directions.has ? `${sources.directions.count} اتجاه` : 'حدّد ٣-٥ اتجاهات'} to="/directions" priority="حسب الأثر" />
            <SourceChip done={sources.horizons.has} icon="🔭" labelAr="الآفاق ٣" hint={sources.horizons.has ? `${sources.horizons.count} عنصر` : 'وزّع على H1/H2/H3'} to="/three-horizons" priority="حسب الأفق" />
            <SourceChip done={sources.ansoff.has} icon="📐" labelAr="Ansoff" hint={sources.ansoff.has ? `${sources.ansoff.count} مبادرة نمو` : 'صنّف نمو الخدمة'} to="/ansoff" priority="حسب المخاطرة" />
          </CardContent>
        </Card>
      )}

      {/* 🧠 مولّد موحّد — يقرأ كل المصادر مرّة واحدة */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد مبادرات ذكيّ — من كل المصادر</div>
              <div className="text-xs text-muted-foreground">
                نجمع القرار ⭐ + TOWS + الاتجاهات + الآفاق الثلاثة + Ansoff — نصنّفها ونُرتّبها بحسب أولويتها ومسارك.
              </div>
            </div>
          </div>
          <Button onClick={generateFromAll} disabled={generating || creating || !sources} size="lg">
            {generating ? 'جاري…' : '✨ ولّد الآن'}
          </Button>
        </CardContent>
      </Card>

      {/* نموذج إنشاء مبادرة يدوي */}
      <Card className="overflow-hidden bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
        <CardHeader>
          <CardTitle className="text-base">＋ إنشاء مبادرة يدوية</CardTitle>
          <CardDescription>اربط مبادراتك بالاتجاه الاستراتيجي والأهداف.</CardDescription>
        </CardHeader>
        <form onSubmit={create}>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="title">العنوان</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="مثال: إطلاق برنامج ولاء…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="priority">الأولوية</Label>
              <select
                id="priority"
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
              >
                {PRIORITIES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="md:col-span-3 space-y-1">
              <Label htmlFor="desc">الوصف</Label>
              <Textarea id="desc" rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" disabled={creating || !form.title.trim()}>{creating ? 'جاري الإنشاء…' : '+ إنشاء المبادرة'}</Button>
            </div>
          </CardContent>
        </form>
      </Card>

      {loading && <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>}

      {/* قائمة المبادرات — بترقيم وأيقونات فئة */}
      {items.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between px-2">
            <div className="text-sm font-semibold">
              💡 مبادراتي — {items.length} مبادرة ({inProgress} قيد التنفيذ · {done} مكتَملة)
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {sortedForDisplay(items).map((i, idx) => {
              const cat = categorize(i.title + ' ' + (i.description ?? ''))
              const catMeta = CATEGORY_META[cat]
              return (
                <Card key={i.id} className={pTint(i.priority)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-0.5 inline-flex size-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold tabular-nums text-primary-foreground"
                        title="ترقيم المبادرة"
                      >
                        #{idx + 1}
                      </span>
                      <span className="mt-0.5 text-xl" title={catMeta.labelAr}>{catMeta.icon}</span>
                      <CardTitle className="flex-1 text-base leading-tight">{i.title}</CardTitle>
                      <span className="rounded-md border bg-card px-2 py-0.5 text-[10px]">{pLabel(i.priority)}</span>
                    </div>
                    {i.description && <CardDescription className="mt-1 leading-relaxed">{i.description}</CardDescription>}
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] w-fit bg-muted/40">
                      <span>{catMeta.icon}</span>
                      <span>{catMeta.labelAr}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center gap-2">
                    <select
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                      value={i.status}
                      onChange={(e) => update(i, { status: e.target.value })}
                    >
                      {STATUS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                    <span className="text-xs text-muted-foreground">{sLabel(i.status)}</span>
                    <Button variant="ghost" size="sm" className="mr-auto" onClick={() => remove(i)}>حذف</Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {!loading && items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            لا مبادرات بعد — اضغط «✨ ولّد الآن» أعلاه أو أنشئ يدوياً.
          </CardContent>
        </Card>
      )}

      {/* 🎯 اقتراح الخطوة التالية — سياقي بحسب حالة المبادرات */}
      {suggestedNextStep && (
        <Card className="border-emerald-300 bg-emerald-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex items-start gap-3">
              <div className="text-2xl">{suggestedNextStep.icon}</div>
              <div>
                <div className="text-sm font-bold text-emerald-900">
                  الخطوة التالية: {suggestedNextStep.labelAr}
                </div>
                <div className="text-xs text-emerald-800/80">{suggestedNextStep.hint}</div>
              </div>
            </div>
            <Link to={suggestedNextStep.to} className={buttonVariants({ variant: 'default' })}>
              {suggestedNextStep.cta}
            </Link>
          </CardContent>
        </Card>
      )}
    </>
  )
}

// ─── سطر مصدر مضغوط ─────────────────────────────────────────────
function SourceChip({
  done, icon, labelAr, hint, to, priority,
}: {
  done: boolean
  icon: string
  labelAr: string
  hint: string
  to: string
  priority: string
}) {
  return (
    <div className={`rounded-lg border p-2 ${done ? 'border-emerald-300 bg-emerald-50/40' : 'border-amber-300 bg-amber-50/40'}`}>
      <div className="flex items-center gap-1.5">
        <span className="text-lg">{icon}</span>
        <span className="flex-1 text-sm font-semibold">{labelAr}</span>
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
            done
              ? 'border-emerald-400 bg-emerald-100 text-emerald-800'
              : 'border-rose-300 bg-rose-50 text-rose-700'
          }`}
        >
          {done ? '✓' : '✗'}
        </span>
      </div>
      <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{hint}</div>
      <div className="mt-0.5 text-[9px] text-muted-foreground/70">أولوية: {priority}</div>
      {!done && (
        <Link to={to} className="mt-0.5 inline-block text-[10px] text-primary hover:underline">
          افتحه ←
        </Link>
      )}
    </div>
  )
}

// ─── منطق مساعد ────────────────────────────────────────────────

// ترتيب المبادرات: القرار ⭐ أوّلاً، ثم critical > high > medium > low.
function sortedForDisplay(items: Initiative[]): Initiative[] {
  const rank: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 }
  return [...items].sort((a, b) => {
    const aStar = a.title.startsWith('⭐') ? 1 : 0
    const bStar = b.title.startsWith('⭐') ? 1 : 0
    if (aStar !== bStar) return bStar - aStar
    return (rank[b.priority] ?? 0) - (rank[a.priority] ?? 0)
  })
}

function summarizeSources(items: { source: string }[]): string {
  const counts: Record<string, number> = {}
  for (const i of items) counts[i.source] = (counts[i.source] ?? 0) + 1
  return Object.entries(counts).map(([s, n]) => `${n} من ${s}`).join(' + ')
}
