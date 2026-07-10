import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { CATEGORY_META, categorize, type Category } from '@/lib/directionCategory'
import { getArtifact, getSWOT, upsertArtifact, type SWOT } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'
import type { StrategyPath } from '@/types/user'

interface DirectionLite {
  id: string
  title: string
  description: string
  feasibility: number
  impact: number
  pros?: string[]
  cons?: string[]
}

interface ChoiceData {
  selectedDirectionId: string | null
  rationale: string
  decidedAt: string | null
  decidedTitle: string | null
}

const EMPTY: ChoiceData = {
  selectedDirectionId: null,
  rationale: '',
  decidedAt: null,
  decidedTitle: null,
}

type Quad = 'SO' | 'ST' | 'WO' | 'WT'
interface Roadmap { short: string[]; mid: string[]; long: string[] }

export function ChoicesPage() {
  return (
    <StrategicShell
      title="القرار الاستراتيجي"
      description="اختر اتجاهاً واحداً، وسنساعدك بأدلّة من تحليلاتك السابقة + خارطة تنفيذ قريب/متوسط/بعيد."
      actions={
        <Link to="/directions" className={buttonVariants({ variant: 'outline' })}>
          ← العودة للاتجاهات
        </Link>
      }
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [directions, setDirections] = useState<DirectionLite[]>([])
  const [choice, setChoice] = useState<ChoiceData>(EMPTY)
  const [swot, setSwot] = useState<SWOT | null>(null)
  // لوحة الجاهزية: مؤشّر أيّ التحليلات السابقة موجودة (كخانات ✓/✗).
  const [readiness, setReadiness] = useState({ pestel: false, swot: false, tows: false, directions: false })
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // فلترة الاتجاهات بحسب الفئة الاستراتيجية (نمو/كفاءة/رقمنة/…).
  const [categoryFilter, setCategoryFilter] = useState<Category | null>(null)
  // فلترة بحسب ربع TOWS (SO/ST/WO/WT).
  const [quadFilter, setQuadFilter] = useState<Quad | null>(null)
  // لوحة الفلترة مخفيّة افتراضياً — أقل ضوضاء بصريّة.
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    Promise.all([
      getArtifact<{ directions: DirectionLite[] }>(companyId, 'DIRECTIONS'),
      getArtifact<ChoiceData>(companyId, 'CHOICES'),
      getArtifact(companyId, 'PESTEL').catch(() => null),
      getSWOT(companyId).catch(() => null),
    ]).then(([dirRow, choiceRow, pestelRow, swotRow]) => {
      const dirs = dirRow?.data?.directions ?? []
      setDirections(dirs)
      if (choiceRow?.data) setChoice({ ...EMPTY, ...choiceRow.data })
      setSwot(swotRow)
      const tows = swotRow?.tows ?? null
      const hasTows = !!tows && (
        (tows.so?.length ?? 0) + (tows.st?.length ?? 0) +
        (tows.wo?.length ?? 0) + (tows.wt?.length ?? 0) > 0
      )
      const hasSwot = !!swotRow && (
        (swotRow.strengths?.length ?? 0) + (swotRow.weaknesses?.length ?? 0) +
        (swotRow.opportunities?.length ?? 0) + (swotRow.threats?.length ?? 0) > 0
      )
      setReadiness({
        pestel: !!pestelRow,
        swot: hasSwot,
        tows: hasTows,
        directions: dirs.length > 0,
      })
    }).catch(() => undefined).finally(() => setLoaded(true))
  }, [companyId])

  async function commit() {
    if (!choice.selectedDirectionId) {
      toast.error('اختر اتجاهاً أولاً')
      return
    }
    if (!choice.rationale.trim()) {
      toast.error('اكتب مبرر القرار')
      return
    }
    const dir = directions.find((d) => d.id === choice.selectedDirectionId)
    if (!dir) {
      toast.error('الاتجاه المختار لم يعد موجوداً')
      return
    }
    setSaving(true)
    try {
      const payload: ChoiceData = {
        selectedDirectionId: dir.id,
        rationale: choice.rationale,
        decidedAt: new Date().toISOString(),
        decidedTitle: dir.title,
      }
      await upsertArtifact(companyId, 'CHOICES', payload)
      setChoice(payload)
      toast.success('تم تثبيت القرار')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل حفظ القرار'))
    } finally {
      setSaving(false)
    }
  }

  async function unlock() {
    if (!confirm('إعادة فتح القرار؟ سيمكنك اختيار اتجاه آخر.')) return
    try {
      await upsertArtifact(companyId, 'CHOICES', EMPTY)
      setChoice(EMPTY)
      toast.message('تم فتح القرار')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإلغاء'))
    }
  }

  // 🧠 توليد مبرّر تلقائي — يستند إلى ربع TOWS + قوّة/فرصة + قابلية/أثر.
  function generateRationale() {
    if (!choice.selectedDirectionId) {
      toast.error('اختر اتجاهاً أولاً')
      return
    }
    const dir = directions.find((d) => d.id === choice.selectedDirectionId)
    if (!dir) return
    const text = buildRationale(dir, swot)
    setChoice((p) => ({ ...p, rationale: text }))
    toast.success('🧠 صيغ مبرّر مقترح — راجعه وعدّله ثم ثبّت القرار.')
  }

  if (!loaded) {
    return (
      <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>
    )
  }

  const isLocked = Boolean(choice.decidedAt)

  if (directions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>لا توجد اتجاهات بعد</CardTitle>
          <CardDescription>أضف 3–5 اتجاهات في صفحة الاتجاهات الاستراتيجية قبل اختيار قرار.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/directions" className={buttonVariants()}>الانتقال للاتجاهات ←</Link>
        </CardContent>
      </Card>
    )
  }

  const decided = isLocked ? directions.find((d) => d.id === choice.selectedDirectionId) : null
  const roadmap = decided ? buildRoadmap(decided, swot) : null

  if (isLocked && decided) {
    return (
      <>
        <Card className="overflow-hidden border-emerald-300 bg-gradient-to-bl from-emerald-500/15 to-transparent">
          <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="text-3xl">✅</span>
              <div>
                <CardTitle>القرار مُثبَّت</CardTitle>
                <CardDescription>
                  مأخوذ في {new Date(choice.decidedAt!).toLocaleDateString('ar-SA')}.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs font-medium uppercase text-muted-foreground">الاتجاه المختار</div>
              <div className="mt-1 text-xl font-bold text-emerald-700">{choice.decidedTitle}</div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs font-medium uppercase text-muted-foreground">المبررات</div>
              <p className="mt-1 leading-relaxed">{choice.rationale}</p>
            </div>
          </CardContent>
        </Card>

        {/* خارطة تنفيذ مقترحة — قريب/متوسط/بعيد */}
        {roadmap && <RoadmapCard roadmap={roadmap} />}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={unlock}>إعادة فتح القرار</Button>
          <Link to="/three-horizons" className={buttonVariants({ variant: 'outline' })}>
            عرض على الآفاق الثلاثة ←
          </Link>
          <Link to="/objectives" className={buttonVariants()}>
            ابدأ ترجمته لأهداف ←
          </Link>
        </div>
      </>
    )
  }

  // إحصاءات الفئات + الأرباع لعرض رقائق الفلترة (تحت زر «فلترة» فقط).
  const categoryCounts = countBy(directions, (d) => categorize(d.title + ' ' + d.description))
  const quadCounts = countBy(directions, (d) => extractQuadrant(d.title) ?? 'none')
  const filteredDirections = directions.filter((d) => {
    const cat = categorize(d.title + ' ' + d.description)
    const q = extractQuadrant(d.title)
    if (categoryFilter && cat !== categoryFilter) return false
    if (quadFilter && q !== quadFilter) return false
    return true
  })
  // ترتيب تنازلي بحسب (قابلية × أثر) — الأعلى في الأعلى.
  const rankedDirections = [...filteredDirections].sort(
    (a, b) => b.feasibility * b.impact - a.feasibility * a.impact,
  )
  const picked = choice.selectedDirectionId
    ? directions.find((d) => d.id === choice.selectedDirectionId) ?? null
    : null
  const currentStep: 1 | 2 | 3 = picked ? (choice.rationale.trim() ? 3 : 2) : 1

  return (
    <>
      {/* شريط علوي مضغوط: خطوات + جاهزية + فلترة */}
      <StepStrip
        currentStep={currentStep}
        readiness={readiness}
        directionsCount={directions.length}
        swot={swot}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((v) => !v)}
        hasActiveFilter={!!(categoryFilter || quadFilter)}
        onClearFilters={() => { setCategoryFilter(null); setQuadFilter(null) }}
      />

      {/* لوحة فلترة مخفيّة افتراضياً — تظهر فقط عند الضغط على "فلترة" */}
      {showFilters && (
        <FilterPanel
          categoryCounts={categoryCounts}
          quadCounts={quadCounts}
          categoryFilter={categoryFilter}
          quadFilter={quadFilter}
          onCategoryToggle={(c) => setCategoryFilter(categoryFilter === c ? null : c)}
          onQuadToggle={(q) => setQuadFilter(quadFilter === q ? null : q)}
        />
      )}

      {/* الخطوة ١ — اختيار الاتجاه */}
      {!picked && (
        <>
          <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center">
            <div className="text-lg font-bold">
              👇 اضغط على أفضل اتجاه في نظرك
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              الاتجاهات مرتّبة تنازلياً بحسب (قابلية × أثر) — الأعلى ترتيباً هو الأكثر جاذبية للتنفيذ.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {rankedDirections.map((d, i) => {
              const ev = evidence(d, swot)
              const q = extractQuadrant(d.title)
              const cat = categorize(d.title + ' ' + d.description)
              const catMeta = CATEGORY_META[cat]
              const score = d.feasibility * d.impact
              const rankColor = i === 0 ? 'border-emerald-400 bg-emerald-50/40' : i === 1 ? 'border-sky-300 bg-sky-50/40' : 'bg-card'
              return (
                <div
                  key={d.id}
                  className={`flex flex-col gap-2 rounded-xl border-2 p-4 transition hover:-translate-y-0.5 hover:shadow-md ${rankColor}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex size-8 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                      i === 0 ? 'bg-emerald-500 text-white' : i === 1 ? 'bg-sky-500 text-white' : 'bg-muted text-foreground'
                    }`}>
                      #{i + 1}
                    </span>
                    <span className="text-2xl" title={catMeta.labelAr}>{catMeta.icon}</span>
                    <span className="flex-1 text-base font-bold">{d.title || '—'}</span>
                    <span className="rounded-lg border bg-background px-2 py-1 text-xs font-bold tabular-nums" title="قابلية × أثر">
                      {score}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                    {d.description || '—'}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 text-[10px]">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${catMeta.bgClass} ${catMeta.colorClass}`}>
                      <span>{catMeta.icon}</span>
                      <span>{catMeta.labelAr}</span>
                    </span>
                    {q && <QuadBadge q={q} />}
                    {ev.support > 0 && (
                      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                        ✓ {ev.support} داعم
                      </span>
                    )}
                    {ev.risk > 0 && (
                      <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-rose-800">
                        ⚠️ {ev.risk} خطر
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={() => {
                      const rationale = buildRationale(d, swot)
                      setChoice((p) => ({ ...p, selectedDirectionId: d.id, rationale: p.rationale || rationale }))
                      toast.success(`✓ اخترت «${d.title}» — راجع المبرّر والخطة أدناه.`)
                      setTimeout(() => {
                        document.getElementById('choice-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 100)
                    }}
                    className="mt-1 w-full"
                    size="lg"
                  >
                    ✓ اختر هذا الاتجاه
                  </Button>
                </div>
              )
            })}
          </div>
          {rankedDirections.length === 0 && directions.length > 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              لا اتجاهات مطابقة للفلترة — امسح الفلترات من الشريط العلوي.
            </p>
          )}
        </>
      )}

      {/* الخطوات ٢+٣ — بعد الاختيار: مراجعة + تثبيت */}
      {picked && (
        <ReviewAndCommit
          picked={picked}
          allDirections={rankedDirections}
          swot={swot}
          rationale={choice.rationale}
          onChangeRationale={(v) => setChoice((p) => ({ ...p, rationale: v }))}
          onRegenerate={generateRationale}
          onPickAnother={(id) => {
            const d = directions.find((x) => x.id === id)
            if (!d) return
            const rationale = buildRationale(d, swot)
            setChoice((p) => ({ ...p, selectedDirectionId: id, rationale }))
          }}
          onUnpick={() => setChoice(EMPTY)}
          onCommit={commit}
          saving={saving}
        />
      )}
    </>
  )
}

// ─── شريط الخطوات (خطوة ١-٢-٣ + جاهزية موجزة + فلترة) ─────────
function StepStrip({
  currentStep,
  readiness,
  directionsCount,
  swot,
  showFilters,
  onToggleFilters,
  hasActiveFilter,
  onClearFilters,
}: {
  currentStep: 1 | 2 | 3
  readiness: { pestel: boolean; swot: boolean; tows: boolean; directions: boolean }
  directionsCount: number
  swot: SWOT | null
  showFilters: boolean
  onToggleFilters: () => void
  hasActiveFilter: boolean
  onClearFilters: () => void
}) {
  const readyCount = [readiness.pestel, readiness.swot, readiness.tows, readiness.directions].filter(Boolean).length
  const swotCounts = swot
    ? (swot.strengths?.length ?? 0) + (swot.weaknesses?.length ?? 0) + (swot.opportunities?.length ?? 0) + (swot.threats?.length ?? 0)
    : 0
  const steps = [
    { n: 1, icon: '👆', labelAr: 'اختر' },
    { n: 2, icon: '📝', labelAr: 'راجع' },
    { n: 3, icon: '🔒', labelAr: 'ثبّت' },
  ] as const
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
        {/* خطوات ١-٢-٣ */}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => {
            const active = s.n === currentStep
            const done = s.n < currentStep
            return (
              <div key={s.n} className="flex items-center gap-1.5">
                <div
                  className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : done
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-muted-foreground/20 bg-card text-muted-foreground'
                  }`}
                >
                  <span>{done ? '✓' : s.icon}</span>
                  <span>{s.labelAr}</span>
                </div>
                {i < steps.length - 1 && (
                  <span className="text-muted-foreground/50" aria-hidden>◀</span>
                )}
              </div>
            )
          })}
        </div>

        {/* حالة مضغوطة: جاهزية + عدد الاتجاهات + عناصر SWOT */}
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span
            title="جاهزية القرار: PESTEL + SWOT + TOWS + Directions"
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
              readyCount === 4 ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}
          >
            <span>📊</span>
            <span>جاهزية {readyCount}/٤</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-muted-foreground">
            <span>🎯</span>
            <span>{directionsCount} اتجاه</span>
          </span>
          {swotCounts > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-muted-foreground">
              <span>🧭</span>
              <span>{swotCounts} بند SWOT</span>
            </span>
          )}
          <button
            type="button"
            onClick={onToggleFilters}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition ${
              showFilters || hasActiveFilter ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:bg-muted'
            }`}
          >
            <span>🎛️</span>
            <span>{hasActiveFilter ? 'فلترة نشطة' : 'فلترة'}</span>
          </button>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-muted-foreground hover:bg-card"
            >
              × مسح
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── لوحة فلترة قابلة للطي (مضغوطة، لا تظهر افتراضياً) ───────────
function FilterPanel({
  categoryCounts, quadCounts,
  categoryFilter, quadFilter,
  onCategoryToggle, onQuadToggle,
}: {
  categoryCounts: Partial<Record<Category, number>>
  quadCounts: Partial<Record<string, number>>
  categoryFilter: Category | null
  quadFilter: Quad | null
  onCategoryToggle: (c: Category) => void
  onQuadToggle: (q: Quad) => void
}) {
  const catKeys = Object.keys(categoryCounts) as Category[]
  const hasQuad = (['SO', 'ST', 'WO', 'WT'] as Quad[]).some((q) => (quadCounts[q] ?? 0) > 0)
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-2 p-3">
        {catKeys.length > 1 && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">حسب النوع:</div>
            <div className="flex flex-wrap gap-1.5">
              {catKeys.map((cat) => {
                const meta = CATEGORY_META[cat]
                const active = categoryFilter === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onCategoryToggle(cat)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                      active ? 'border-primary bg-primary/15 text-primary ring-2 ring-primary/30' : `${meta.bgClass} ${meta.colorClass}`
                    }`}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.labelAr}</span>
                    <span className="rounded-full bg-card/70 px-1 text-[10px] font-bold">{categoryCounts[cat]}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {hasQuad && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">حسب ربع TOWS:</div>
            <div className="flex flex-wrap gap-1.5">
              {(['SO', 'ST', 'WO', 'WT'] as Quad[]).map((q) => {
                const cnt = quadCounts[q] ?? 0
                if (cnt === 0) return null
                const active = quadFilter === q
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onQuadToggle(q)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition ${
                      active ? 'border-primary bg-primary/15 text-primary ring-2 ring-primary/30' : 'bg-card hover:bg-muted'
                    }`}
                  >
                    <QuadBadgeInline q={q} />
                    <span className="rounded-full bg-card/70 px-1 text-[9px] font-bold">{cnt}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── مراجعة + تثبيت — كل شيء في مكان واحد بعد الاختيار ─────────
function ReviewAndCommit({
  picked, allDirections, swot,
  rationale, onChangeRationale, onRegenerate,
  onPickAnother, onUnpick,
  onCommit, saving,
}: {
  picked: DirectionLite
  allDirections: DirectionLite[]
  swot: SWOT | null
  rationale: string
  onChangeRationale: (v: string) => void
  onRegenerate: () => void
  onPickAnother: (id: string) => void
  onUnpick: () => void
  onCommit: () => void
  saving: boolean
}) {
  const cat = categorize(picked.title + ' ' + picked.description)
  const catMeta = CATEGORY_META[cat]
  const rm = buildRoadmap(picked, swot)
  const ev = evidence(picked, swot)
  return (
    <>
      {/* شريط تبديل — الاتجاه المختار + بقية الاتجاهات مضغوطة للتبديل السريع */}
      <div id="choice-review" className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-primary bg-primary/5 p-3">
        <span className="text-xs font-medium text-muted-foreground">اخترت:</span>
        <span className="text-2xl">{catMeta.icon}</span>
        <span className="flex-1 text-base font-bold">{picked.title}</span>
        <span className="rounded-md border bg-background px-2 py-0.5 text-xs font-bold tabular-nums">
          {picked.feasibility * picked.impact}
        </span>
        {ev.support > 0 && (
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800">
            ✓ {ev.support} داعم
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={onUnpick}>
          ← غيّر اختياري
        </Button>
      </div>

      {/* تبديل سريع بين الاتجاهات — أزرار صغيرة */}
      {allDirections.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-card/40 p-2 text-[10px]">
          <span className="text-muted-foreground">تبديل سريع:</span>
          {allDirections.filter((d) => d.id !== picked.id).slice(0, 5).map((d) => {
            const c = CATEGORY_META[categorize(d.title + ' ' + d.description)]
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onPickAnother(d.id)}
                className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 hover:bg-primary hover:text-primary-foreground"
                title={d.title}
              >
                <span>{c.icon}</span>
                <span className="max-w-[10rem] truncate">{d.title}</span>
                <span className="rounded bg-muted px-1 tabular-nums">{d.feasibility * d.impact}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* المبرّر — مولّد تلقائياً، قابل للتعديل */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm">📝 المبرّر (مولّد تلقائياً — عدّله إن شئت)</CardTitle>
              <CardDescription className="text-xs">لماذا اخترت هذا الاتجاه دون غيره؟</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onRegenerate}>🧠 أعد التوليد</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            value={rationale}
            onChange={(e) => onChangeRationale(e.target.value)}
            placeholder="مثال: هذا الاتجاه يستفيد من قوة الفريق ويعالج فجوة سوقية واضحة…"
          />
        </CardContent>
      </Card>

      {/* خارطة تنفيذ مضغوطة (٣ أعمدة) */}
      <RoadmapCard roadmap={rm} preview />

      {/* زر التثبيت — كبير وواضح */}
      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={onCommit} disabled={saving} size="lg" className="shadow-lg">
          {saving ? 'جاري الحفظ…' : '🔒 ثبّت القرار'}
        </Button>
      </div>
    </>
  )
}

// ─── مكوّنات مساعدة ──────────────────────────────────────────────

function QuadBadge({ q }: { q: Quad }) {
  const meta: Record<Quad, { label: string; cls: string }> = {
    SO: { label: 'SO • هجومي (قوة×فرصة)', cls: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
    ST: { label: 'ST • دفاعي (قوة×تهديد)', cls: 'border-sky-400 bg-sky-50 text-sky-800' },
    WO: { label: 'WO • تحويلي (ضعف×فرصة)', cls: 'border-amber-400 bg-amber-50 text-amber-800' },
    WT: { label: 'WT • تقليصي (ضعف×تهديد)', cls: 'border-rose-400 bg-rose-50 text-rose-800' },
  }
  const m = meta[q]
  return <span className={`rounded-full border px-2 py-0.5 ${m.cls}`}>{m.label}</span>
}

// نسخة مصغّرة داخل رقيقة فلترة الأرباع.
function QuadBadgeInline({ q }: { q: Quad }) {
  const label: Record<Quad, string> = { SO: 'هجومي', ST: 'دفاعي', WO: 'تحويلي', WT: 'تقليصي' }
  return <span>{q} • {label[q]}</span>
}

// عدّ عام: يُرجع Record<K, number>.
function countBy<T, K extends string>(arr: T[], fn: (t: T) => K): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {}
  for (const item of arr) {
    const k = fn(item)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

function RoadmapCard({ roadmap, preview = false }: { roadmap: Roadmap; preview?: boolean }) {
  const strategyPath = useAuthStore((s) => s.user?.strategyPath ?? null)
  const cols = [
    { key: 'short' as const, icon: '🎯', title: 'قريب المدى', span: '٠–١٢ شهر', tone: 'border-emerald-300 bg-emerald-50/40' },
    { key: 'mid' as const, icon: '🌱', title: 'متوسط المدى', span: '١٢–٣٦ شهر', tone: 'border-sky-300 bg-sky-50/40' },
    { key: 'long' as const, icon: '🔭', title: 'بعيد المدى', span: '٣٦+ شهر', tone: 'border-purple-300 bg-purple-50/40' },
  ]
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          🗺️ خارطة تنفيذ مقترحة {preview && <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">معاينة</span>}
        </CardTitle>
        <CardDescription>مبنية على ربع TOWS + مواردك — عدّلها في «الآفاق الثلاثة» و«المبادرات».</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 lg:grid-cols-3">
          {cols.map((c) => {
            const emphasized = isRoadmapColInPath(c.key, strategyPath)
            return (
            <div
              key={c.key}
              className={`rounded-xl border p-3 ${c.tone} ${emphasized ? 'ring-2 ring-primary/40' : 'opacity-70'}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold">
                  <span className="text-lg">{c.icon}</span>
                  <span>{c.title}</span>
                  {emphasized && strategyPath && (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">مطابق لمسارك</span>
                  )}
                </div>
                <span className="rounded-md bg-card px-1.5 py-0.5 text-[10px] font-medium">{c.span}</span>
              </div>
              <ul className="space-y-1.5 text-xs leading-relaxed">
                {roadmap[c.key].map((item, i) => (
                  <li key={i} className="rounded-md border border-white bg-card/70 p-1.5">• {item}</li>
                ))}
                {roadmap[c.key].length === 0 && (
                  <li className="rounded-md border border-dashed p-2 text-center text-muted-foreground">—</li>
                )}
              </ul>
            </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// عمود الخارطة داخل مسار المدير؟ QUICK→short، MEDIUM→short+mid، LONG→الكل.
function isRoadmapColInPath(col: 'short' | 'mid' | 'long', path: StrategyPath | null): boolean {
  if (!path || path === 'LONG') return true
  if (path === 'QUICK') return col === 'short'
  if (path === 'MEDIUM') return col === 'short' || col === 'mid'
  return true
}

// ─── منطق مساعد ────────────────────────────────────────────────

function extractQuadrant(title: string): Quad | null {
  const m = title.match(/^\[(SO|ST|WO|WT)\]/)
  return m ? (m[1] as Quad) : null
}

function short60(s: string): string {
  return s.length > 60 ? s.slice(0, 60) + '…' : s
}

function evidence(direction: DirectionLite, swot: SWOT | null): { support: number; risk: number } {
  if (!swot) return { support: 0, risk: 0 }
  const q = extractQuadrant(direction.title)
  const s = swot.strengths?.length ?? 0
  const w = swot.weaknesses?.length ?? 0
  const o = swot.opportunities?.length ?? 0
  const t = swot.threats?.length ?? 0
  if (q === 'SO') return { support: s + o, risk: 0 }
  if (q === 'ST') return { support: s, risk: t }
  if (q === 'WO') return { support: o, risk: w }
  if (q === 'WT') return { support: 0, risk: w + t }
  // بلا ربع → تطابق نصّي بسيط بين وصف الاتجاه وبنود SWOT.
  const text = (direction.title + ' ' + direction.description).toLowerCase()
  const tokens = text.split(/\s+/).filter((x) => x.length > 3)
  const matches = (list?: string[]) =>
    (list ?? []).filter((str) => tokens.some((tok) => str.toLowerCase().includes(tok))).length
  return {
    support: matches(swot.strengths) + matches(swot.opportunities),
    risk: matches(swot.weaknesses) + matches(swot.threats),
  }
}

// خارطة تنفيذ — قوالب لكل ربع + طبقات من SWOT.
function buildRoadmap(direction: DirectionLite, swot: SWOT | null): Roadmap {
  const q = extractQuadrant(direction.title)
  const desc = direction.description.trim() || direction.title.replace(/^\[[A-Z]{2}\]\s*/, '')
  const short: string[] = []
  const mid: string[] = []
  const long: string[] = []

  if (q === 'SO') {
    short.push(`أطلق تجربة سريعة (pilot) — ${short60(desc)}`)
    short.push('حدّد ٣ مؤشرات نجاح لـ ٩٠ يوماً وفريق مسؤول')
    mid.push('وسّع النطاق بعد نجاح التجربة + استثمار في الأتمتة')
    mid.push('ابنِ فريقاً مخصّصاً وشراكات داعمة')
    long.push('اجعلها ميزة تنافسية مستدامة داخل استراتيجية النمو')
  } else if (q === 'ST') {
    short.push('حصّن نقاط القوّة قبل تصاعد التهديد')
    short.push(`أنشِئ خطة دفاع سريعة — ${short60(desc)}`)
    mid.push('حوّل التهديد إلى فرصة بالاستثمار في القدرات')
    mid.push('راجع النموذج التشغيلي لامتصاص الصدمات')
    long.push('اقلب الصورة — كن قائداً بدل مواكب للسوق')
  } else if (q === 'WO') {
    short.push(`سدّ الفجوة الرئيسية قبل اقتناص الفرصة — ${short60(desc)}`)
    short.push('حدّد القدرة المفقودة (مهارة/نظام/مورد) وابدأ سدّها')
    mid.push('اقتنص الفرصة تدريجياً بعد اكتمال بناء القدرة')
    mid.push('طوّر عمليات جديدة تدعم القدرة المضافة')
    long.push('حوّل القدرة الجديدة إلى ميزة متجدّدة في السوق')
  } else if (q === 'WT') {
    short.push(`أوقف نزيف الضعف قبل التوسّع — ${short60(desc)}`)
    short.push('اعزل المجال المتأثّر وقلّل الالتزامات المرتبطة')
    mid.push('راجع النموذج التشغيلي — إعادة هيكلة أو انسحاب مدروس')
    long.push('إن استمر الوضع — قرار خروج استراتيجي مدروس')
  } else {
    short.push(`ابدأ بمشروع تجريبي مركّز — ${short60(desc)} خلال ٩٠ يوماً`)
    short.push('حدّد المؤشرات الرئيسية والفريق المسؤول والميزانية')
    mid.push('وسّع النطاق ودمج الاتجاه مع العمليات الأساسية')
    mid.push('طوّر القدرات الداعمة (تقنية/كفاءات/شراكات)')
    long.push('اجعله جزءاً من هوية الشركة الاستراتيجية طويلة الأمد')
  }

  // طبقات إضافية من SWOT (بحد سؤال واحد لكل جانب)
  if (swot) {
    const opp = (swot.opportunities ?? [])[0]
    const wk = (swot.weaknesses ?? [])[0]
    const th = (swot.threats ?? [])[0]
    if (opp && q !== 'SO' && q !== 'WO') mid.push(`استفد من فرصة قائمة: ${short60(opp)}`)
    if (wk && (q === 'SO' || q === 'ST')) short.push(`عالج ضعفاً داعماً للقرار: ${short60(wk)}`)
    if (th && q !== 'ST' && q !== 'WT') long.push(`راقب تهديد ${short60(th)} وحدّث الخطة سنوياً`)
  }

  return { short: dedupe(short), mid: dedupe(mid), long: dedupe(long) }
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr))
}


function buildRationale(direction: DirectionLite, swot: SWOT | null): string {
  const parts: string[] = []
  const q = extractQuadrant(direction.title)
  const cleanTitle = direction.title.replace(/^\[[A-Z]{2}\]\s*/, '')
  parts.push(`اخترنا «${cleanTitle}» لأنه يوازن بين قابلية التنفيذ (${direction.feasibility}/5) والأثر المتوقع (${direction.impact}/5).`)
  if (q === 'SO' && swot) {
    if (swot.strengths?.length) parts.push(`يستفيد من نقاط قوّتنا: ${swot.strengths.slice(0, 2).map(short60).join('؛ ')}.`)
    if (swot.opportunities?.length) parts.push(`ويقتنص فرصة قائمة: ${short60(swot.opportunities[0])}.`)
  } else if (q === 'ST' && swot?.threats?.length) {
    parts.push(`يحصّن الشركة ضد تهديد "${short60(swot.threats[0])}" عبر توظيف قوّتنا الحالية.`)
  } else if (q === 'WO' && swot) {
    if (swot.weaknesses?.length) parts.push(`يعالج ضعفاً داخلياً: ${short60(swot.weaknesses[0])}`)
    if (swot.opportunities?.length) parts.push(`لفتح فرصة: ${short60(swot.opportunities[0])}.`)
  } else if (q === 'WT') {
    parts.push('يقلل المخاطر عبر انسحاب مدروس أو إعادة هيكلة لمنطقة الضعف قبل تفاقم التهديد.')
  } else {
    if (direction.description) parts.push(`رؤيتنا: ${direction.description}`)
  }
  if (direction.pros?.length) parts.push(`من إيجابياته: ${direction.pros.slice(0, 2).join('، ')}.`)
  if (direction.cons?.length) parts.push(`نحن واعون لتحدّياته (${direction.cons.slice(0, 1).join('، ')}) وسنعالجها في خطة التنفيذ.`)
  return parts.join(' ')
}
