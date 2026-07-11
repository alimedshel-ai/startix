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
  // ⬇ حفظ ما كان مثبَّتاً قبل «عدّل القرار» — يساعدنا في:
  //   • عرض بانر «أنت تُعدّل قرار [X] — يمكنك استعادته كما هو»
  //   • زر «استعِد كما كان» يُعيد التثبيت بلا تغيير.
  previousDecidedTitle?: string | null
  previousDecidedAt?: string | null
}

const EMPTY: ChoiceData = {
  selectedDirectionId: null,
  rationale: '',
  decidedAt: null,
  decidedTitle: null,
  previousDecidedTitle: null,
  previousDecidedAt: null,
}

type Quad = 'SO' | 'ST' | 'WO' | 'WT'
interface Roadmap { short: string[]; mid: string[]; long: string[] }

// نتيجة تسجيل ذكيّة لاتجاه — تُستخدم في التوصية والترتيب وشرح «لماذا؟».
interface ScoredDirection {
  direction: DirectionLite
  category: Category
  quadrant: Quad | null
  score: number       // 0..100
  breakdown: {
    base: number       // من قابلية × أثر (٠..٤٠)
    support: number    // من عدد داعمي SWOT (٠..٢٠)
    riskPenalty: number // -٠..-١٥
    quadrant: number   // ٠..١٠
    pathMatch: number  // ٠..١٥
  }
  supportingSwot: string[]  // نصوص SWOT المطابقة (لعرض «لماذا؟»)
  riskSwot: string[]
  reasons: string[]   // مبرّرات مختصرة قابلة للعرض في «لماذا؟»
}

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
  // نُخفي الاتجاهات ما بعد الأعلى ٣ افتراضياً — تُوسَّع بالضغط.
  const [showAll, setShowAll] = useState(false)
  // معرّف الاتجاه الذي فُتح شرح «لماذا؟» له (واحد في المرّة الواحدة).
  const [expandedReasonId, setExpandedReasonId] = useState<string | null>(null)
  const strategyPath = useAuthStore((s) => s.user?.strategyPath ?? null)

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

  // 🔄 عدّل القرار — بلا نافذة تأكيد، بلا فقدان بيانات.
  // نُبقي الاتجاه المُختار والمبرّر كما هو، ونُلغي فقط تاريخ التثبيت.
  // نحفظ العنوان السابق في previousDecidedTitle لبانر إعلامي + زر «استعِد».
  async function unlockForEdit() {
    const nextChoice: ChoiceData = {
      selectedDirectionId: choice.selectedDirectionId,
      rationale: choice.rationale,
      decidedAt: null,
      decidedTitle: null,
      previousDecidedTitle: choice.decidedTitle,
      previousDecidedAt: choice.decidedAt,
    }
    try {
      await upsertArtifact(companyId, 'CHOICES', nextChoice)
      setChoice(nextChoice)
      toast.message('يمكنك الآن تعديل قرارك — اختيارك السابق محفوظ.')
      setTimeout(() => {
        document.getElementById('choice-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر فتح القرار للتعديل'))
    }
  }

  // 🔙 استعِد القرار السابق كما كان — يُعيد تثبيته مباشرة بلا مراجعة يدوية.
  async function revertToPrevious() {
    if (!choice.previousDecidedTitle) return
    const originalDir = directions.find((d) => d.id === choice.selectedDirectionId)
    if (!originalDir) {
      toast.error('الاتجاه السابق لم يعد موجوداً في قائمة الاتجاهات.')
      return
    }
    const nextChoice: ChoiceData = {
      selectedDirectionId: choice.selectedDirectionId,
      rationale: choice.rationale,
      decidedAt: choice.previousDecidedAt ?? new Date().toISOString(),
      decidedTitle: choice.previousDecidedTitle,
      previousDecidedTitle: null,
      previousDecidedAt: null,
    }
    try {
      await upsertArtifact(companyId, 'CHOICES', nextChoice)
      setChoice(nextChoice)
      toast.success('استُعيد القرار السابق كما كان.')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الاستعادة'))
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">✅</span>
                <div>
                  <CardTitle>القرار مُثبَّت</CardTitle>
                  <CardDescription>
                    مأخوذ في {new Date(choice.decidedAt!).toLocaleDateString('ar-SA')}.
                  </CardDescription>
                </div>
              </div>
              {/* 🔄 عدّل القرار — بارز ومباشر، بلا نافذة تأكيد */}
              <Button variant="outline" onClick={unlockForEdit} size="sm">
                🔄 عدّل القرار
              </Button>
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
  // ترتيب ذكي متعدّد المعايير — القابلية × الأثر + دعم SWOT + مطابقة المسار
  // + بونص TOWS — ثم نُرشّح الأعلى.
  const scored: ScoredDirection[] = filteredDirections
    .map((d) => scoreDirection(d, swot, strategyPath))
    .sort((a, b) => b.score - a.score)
  const bestPick = scored[0] ?? null
  // تصنيف ثلاثيّ يساعد المدير على فهم عدد الاتجاهات المهمّة:
  //   ⭐ توصية        = الأعلى (bestPick)
  //   🎯 مرشّحون     = نقاطهم ≥ ٦٠ (ما عدا التوصية) — أساسيّون للمراجعة
  //   📋 بدائل ضعيفة = نقاطهم < ٦٠ — يمكن تجاهلها بأمان
  const essentials = scored.slice(1).filter((s) => s.score >= 60)
  const weakAlts = scored.slice(1).filter((s) => s.score < 60)
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

      {/* 🔄 بانر التعديل — يظهر عندما فتحنا قراراً مثبَّتاً للتعديل */}
      {choice.previousDecidedTitle && (
        <Card className="border-2 border-amber-400 bg-amber-50/70">
          <CardContent className="flex flex-wrap items-start justify-between gap-3 p-3">
            <div className="flex items-start gap-2">
              <span className="text-2xl">🔄</span>
              <div>
                <div className="text-sm font-bold text-amber-900">
                  أنت تُعدّل قرارك السابق
                </div>
                <div className="mt-0.5 text-xs text-amber-800">
                  القرار المُثبَّت السابق: <b>{choice.previousDecidedTitle}</b>
                  {choice.previousDecidedAt && ` · مأخوذ في ${new Date(choice.previousDecidedAt).toLocaleDateString('ar-SA')}`}
                </div>
                <div className="mt-1 text-[10px] text-amber-700">
                  يمكنك اختيار اتجاه آخر من الأسفل، أو تعديل المبرّر، ثم اضغط «🔒 ثبّت القرار». أو استعِد قرارك السابق كما كان.
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={revertToPrevious} className="border-amber-500 bg-card">
              ↩️ استعِد كما كان
            </Button>
          </CardContent>
        </Card>
      )}

      {/* الخطوة ١ — اختيار الاتجاه */}
      {!picked && (
        <>
          {/* 📊 مركز اتّخاذ القرار — يشرح ما يراه المدير وكم اتجاه لديه */}
          <GuidancePanel
            totalCount={directions.length}
            visibleCount={scored.length}
            essentialCount={essentials.length}
            weakCount={weakAlts.length}
            hasRecommendation={!!bestPick}
            recommendationScore={bestPick ? Math.round(bestPick.score) : 0}
          />

          {/* 🏆 توصية المنصّة — الاتجاه الأعلى تسجيلاً بشرح تفصيلي */}
          {bestPick && (
            <RecommendationCard
              pick={bestPick}
              onAccept={() => {
                const rationale = buildRationale(bestPick.direction, swot)
                setChoice((p) => ({ ...p, selectedDirectionId: bestPick.direction.id, rationale: p.rationale || rationale }))
                toast.success(`✓ اخترت «${bestPick.direction.title}» — راجع المبرّر أدناه.`)
                setTimeout(() => {
                  document.getElementById('choice-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 100)
              }}
            />
          )}

          {/* 🎯 مرشّحون أساسيّون — نقاطهم ≥ ٦٠ (بديل جدّي للتوصية) */}
          {essentials.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <div>
                    <div className="text-sm font-bold text-sky-900">
                      {essentials.length} مرشّح أساسي — بديل جدّي للتوصية
                    </div>
                    <div className="text-[10px] text-sky-800/80">
                      نقاطهم ≥ ٦٠ — يستحقّون المراجعة قبل أن ترفض توصية المنصّة.
                    </div>
                  </div>
                </div>
                <span className="rounded-full border border-sky-300 bg-card px-2 py-0.5 text-[10px] font-medium text-sky-800">
                  اضغط «❔ لماذا؟» على كل بطاقة
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {essentials.map((s, i) => (
                  <RankedCard
                    key={s.direction.id}
                    scored={s}
                    rank={i + 1}
                    isBest={false}
                    expanded={expandedReasonId === s.direction.id}
                    onToggleReason={() => setExpandedReasonId(expandedReasonId === s.direction.id ? null : s.direction.id)}
                    onPick={() => {
                      const rationale = buildRationale(s.direction, swot)
                      setChoice((p) => ({ ...p, selectedDirectionId: s.direction.id, rationale: p.rationale || rationale }))
                      toast.success(`✓ اخترت «${s.direction.title}» — راجع المبرّر أدناه.`)
                      setTimeout(() => {
                        document.getElementById('choice-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 100)
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {/* 📋 بدائل ضعيفة — مطويّة افتراضياً، «يمكن تجاهلها بأمان» */}
          {weakAlts.length > 0 && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mx-auto rounded-full border-2 border-dashed border-muted-foreground/40 bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
            >
              ▼ عرض {weakAlts.length} بديل ضعيف (نقاط أقل من ٦٠ — يمكن تجاهلها)
            </button>
          )}
          {weakAlts.length > 0 && showAll && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <div>
                    <div className="text-sm font-bold text-slate-700">
                      {weakAlts.length} بديل ضعيف
                    </div>
                    <div className="text-[10px] text-slate-600">
                      نقاطهم أقل من ٦٠ — عادةً لا تُغيّر القرار.
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {weakAlts.map((s, i) => (
                  <RankedCard
                    key={s.direction.id}
                    scored={s}
                    rank={essentials.length + i + 1}
                    isBest={false}
                    expanded={expandedReasonId === s.direction.id}
                    onToggleReason={() => setExpandedReasonId(expandedReasonId === s.direction.id ? null : s.direction.id)}
                    onPick={() => {
                      const rationale = buildRationale(s.direction, swot)
                      setChoice((p) => ({ ...p, selectedDirectionId: s.direction.id, rationale: p.rationale || rationale }))
                      toast.success(`✓ اخترت «${s.direction.title}»`)
                      setTimeout(() => {
                        document.getElementById('choice-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 100)
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="mx-auto text-xs text-muted-foreground hover:underline"
              >
                ▲ إخفاء البدائل الضعيفة
              </button>
            </>
          )}

          {scored.length === 0 && directions.length > 0 && (
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
          allDirections={scored.map((s) => s.direction)}
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

// ─── 📊 مركز القرار — يشرح للمدير كيف يعمل التصنيف وكم اتجاه لديه ─
function GuidancePanel({
  totalCount, visibleCount,
  essentialCount, weakCount,
  hasRecommendation, recommendationScore,
}: {
  totalCount: number
  visibleCount: number
  essentialCount: number
  weakCount: number
  hasRecommendation: boolean
  recommendationScore: number
}) {
  const [howOpen, setHowOpen] = useState(false)
  const filtered = totalCount - visibleCount
  const buckets = [
    hasRecommendation && {
      icon: '⭐',
      cls: 'border-emerald-300 bg-emerald-50 text-emerald-900',
      title: `توصية المنصّة (${recommendationScore}/١٠٠)`,
      hint: 'الأعلى نقاطاً — ابدأ منها.',
    },
    essentialCount > 0 && {
      icon: '🎯',
      cls: 'border-sky-300 bg-sky-50 text-sky-900',
      title: `${essentialCount} مرشّح أساسي`,
      hint: 'نقاطهم ≥ ٦٠ — قارنهم قبل الرفض.',
    },
    weakCount > 0 && {
      icon: '📋',
      cls: 'border-slate-300 bg-slate-50 text-slate-800',
      title: `${weakCount} بديل ضعيف`,
      hint: 'نقاطهم < ٦٠ — عادةً لا تُغيّر القرار.',
    },
  ].filter(Boolean) as { icon: string; cls: string; title: string; hint: string }[]

  return (
    <Card className="border-primary/30 bg-gradient-to-l from-primary/10 to-transparent">
      <CardContent className="space-y-3 p-3">
        {/* السطر العلوي: عدد الاتجاهات + زر «كيف تختار؟» */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <div>
              <div className="text-sm font-bold">مركز اتّخاذ القرار</div>
              <div className="text-[10px] text-muted-foreground">
                لديك <b className="text-foreground tabular-nums">{totalCount}</b> اتجاه إجمالاً
                {filtered > 0 && ` · ${visibleCount} بعد الفلترة`}
                {' · '}صنّفناها بحسب النقاط الذكيّة (٠-١٠٠).
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link
              to="/directions"
              className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
            >
              ＋ أضِف/راجع الاتجاهات
            </Link>
            <button
              type="button"
              onClick={() => setHowOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
            >
              ❓ كيف تختار قراراً سليماً؟ {howOpen ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* تصنيف الاتجاهات ٣ مجموعات */}
        {buckets.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-3">
            {buckets.map((b) => (
              <div key={b.title} className={`rounded-lg border p-2 ${b.cls}`}>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-lg">{b.icon}</span>
                  <span className="text-xs">{b.title}</span>
                </div>
                <div className="mt-0.5 text-[10px] leading-relaxed">{b.hint}</div>
              </div>
            ))}
          </div>
        )}

        {/* شرح تفصيلي (يفتح بالضغط) */}
        {howOpen && (
          <div className="rounded-lg border-2 border-dashed border-primary/30 bg-card p-3 text-xs leading-relaxed space-y-2">
            <div className="font-bold text-foreground">🔎 كيف نُصنّف الاتجاهات؟</div>
            <p className="text-muted-foreground">
              نجمع ٥ إشارات في نقاط ذكيّة من ٠ إلى ١٠٠: قابلية × أثر (٤٠) + دعم SWOT (٢٠)
              − خصم مخاطر (١٥) + بونص ربع TOWS (١٠) + مطابقة مسارك (١٥).
            </p>
            <div className="mt-2 font-bold text-foreground">📌 خطوات القرار السليم:</div>
            <ol className="mr-3 list-decimal space-y-1 text-muted-foreground marker:text-primary">
              <li>اقرأ <b className="text-foreground">توصية المنصّة</b> أعلاه أوّلاً — إن أعجبتك اضغط «اختر».</li>
              <li>لست مقتنعاً؟ راجع الـ <b className="text-foreground">مرشّحين الأساسيّين</b> ({essentialCount}) — نقاطهم قريبة من التوصية.</li>
              <li>لكل بطاقة زر <b className="text-foreground">«❔ لماذا؟»</b> يشرح تفكيك النقاط والأدلّة الداعمة.</li>
              <li>البدائل الضعيفة (نقاط &lt; ٦٠) لا تحتاج مراجعة — يمكن تجاهلها بأمان.</li>
              <li>لإضافة/حذف اتجاهات ارجع إلى <b className="text-foreground">/directions</b>.</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── 🏆 توصية المنصّة — الاتجاه الأعلى تسجيلاً مع سبب مفصّل ─────
function RecommendationCard({ pick, onAccept }: { pick: ScoredDirection; onAccept: () => void }) {
  const cat = CATEGORY_META[pick.category]
  return (
    <Card className="overflow-hidden border-2 border-emerald-400 bg-gradient-to-bl from-emerald-500/10 to-primary/5 shadow-md">
      <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="text-4xl leading-none">🏆</div>
          <div className="flex-1">
            <CardDescription className="text-xs font-semibold text-emerald-800">
              توصية المنصّة — الأعلى ترتيباً بناءً على تحليلاتك
            </CardDescription>
            <CardTitle className="mt-1 flex items-center gap-2 text-xl">
              <span className="text-2xl">{cat.icon}</span>
              <span>{pick.direction.title}</span>
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
              <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${cat.bgClass} ${cat.colorClass}`}>
                <span>{cat.icon}</span>
                <span>{cat.labelAr}</span>
              </span>
              {pick.quadrant && <QuadBadge q={pick.quadrant} />}
              <span className="rounded-full border border-emerald-400 bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                نقاط ذكيّة: {Math.round(pick.score)}/١٠٠
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {pick.direction.description || '—'}
        </p>

        {/* لماذا رشّحنا هذا؟ — قائمة مبرّرات محدَّدة */}
        <div className="rounded-lg border-2 border-dashed border-emerald-300 bg-card p-3">
          <div className="mb-2 flex items-center gap-1 text-xs font-bold text-emerald-800">
            <span>🎯</span>
            <span>لماذا هذا الاتجاه بالتحديد؟</span>
          </div>
          <ul className="space-y-1.5 text-xs">
            {pick.reasons.map((r, i) => (
              <li key={i} className="flex gap-2 leading-relaxed">
                <span className="text-emerald-600">✓</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          {pick.supportingSwot.length > 0 && (
            <div className="mt-2 border-t pt-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                مدعوم بـ {pick.supportingSwot.length} بند من SWOT:
              </div>
              <div className="flex flex-wrap gap-1">
                {pick.supportingSwot.slice(0, 4).map((s, i) => (
                  <span key={i} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800">
                    ✓ {s.length > 40 ? s.slice(0, 40) + '…' : s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {pick.riskSwot.length > 0 && (
            <div className="mt-2 border-t pt-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                ⚠️ تحدّيات معروفة — سنعالجها في التنفيذ:
              </div>
              <div className="flex flex-wrap gap-1">
                {pick.riskSwot.slice(0, 2).map((s, i) => (
                  <span key={i} className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-800">
                    {s.length > 40 ? s.slice(0, 40) + '…' : s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button onClick={onAccept} size="lg" className="w-full">
          ✓ اختر هذا الاتجاه (توصية المنصّة)
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── بطاقة اتجاه في الترتيب — مع «لماذا؟» قابل للفتح ────────────
function RankedCard({
  scored, rank, isBest, expanded, onToggleReason, onPick,
}: {
  scored: ScoredDirection
  rank: number
  isBest: boolean
  expanded: boolean
  onToggleReason: () => void
  onPick: () => void
}) {
  const { direction: d, category, quadrant: q, score, breakdown, supportingSwot, riskSwot, reasons } = scored
  const catMeta = CATEGORY_META[category]
  const rankColor = rank === 0 ? 'border-emerald-400 bg-emerald-50/40' : rank === 1 ? 'border-sky-300 bg-sky-50/40' : 'bg-card'
  return (
    <div className={`flex flex-col gap-2 rounded-xl border-2 p-3 transition hover:-translate-y-0.5 hover:shadow-md ${rankColor}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex size-8 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
          rank === 0 ? 'bg-emerald-500 text-white' : rank === 1 ? 'bg-sky-500 text-white' : 'bg-muted text-foreground'
        }`}>
          #{rank + 1}
        </span>
        <span className="text-xl" title={catMeta.labelAr}>{catMeta.icon}</span>
        <span className="flex-1 truncate text-sm font-bold">{d.title || '—'}</span>
        <span
          className="rounded-md border bg-background px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
          title="نقاط ذكية 0-100"
        >
          {Math.round(score)}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
        {d.description || '—'}
      </p>
      <div className="flex flex-wrap items-center gap-1 text-[9px]">
        {q && <QuadBadge q={q} />}
        {supportingSwot.length > 0 && (
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-emerald-800">
            ✓ {supportingSwot.length} داعم
          </span>
        )}
        {riskSwot.length > 0 && (
          <span className="rounded-full border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-rose-800">
            ⚠️ {riskSwot.length} خطر
          </span>
        )}
      </div>

      {/* زرّان: لماذا + اختر */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onToggleReason}
          className="flex-1 rounded-md border bg-card px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted"
        >
          {expanded ? '▲ إخفاء' : '❔ لماذا؟'}
        </button>
        <Button size="sm" onClick={onPick} className="flex-1">
          ✓ {isBest ? 'رشّحه' : 'اختر'}
        </Button>
      </div>

      {/* شرح «لماذا؟» — يفتح عند الضغط، يُظهر التقسيم والأدلّة */}
      {expanded && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-2 text-[11px] space-y-2">
          {/* تفكيك نقاط التقييم */}
          <div className="space-y-1">
            <div className="mb-0.5 font-semibold text-foreground">من أين النقاط ({Math.round(score)}/١٠٠)؟</div>
            <ScoreBar label={`قابلية × أثر (${d.feasibility}×${d.impact})`} value={breakdown.base} max={40} color="bg-emerald-400" />
            {breakdown.support > 0 && <ScoreBar label={`أدلّة داعمة (${supportingSwot.length})`} value={breakdown.support} max={20} color="bg-sky-400" />}
            {breakdown.riskPenalty < 0 && <ScoreBar label={`خصم مخاطر (${riskSwot.length})`} value={Math.abs(breakdown.riskPenalty)} max={15} color="bg-rose-400" negative />}
            {breakdown.quadrant > 0 && <ScoreBar label={`ربع TOWS (${q})`} value={breakdown.quadrant} max={10} color="bg-amber-400" />}
            {breakdown.pathMatch > 0 && <ScoreBar label="مطابقة مسارك الاستراتيجي" value={breakdown.pathMatch} max={15} color="bg-violet-400" />}
          </div>

          {/* مبرّرات نصّية */}
          {reasons.length > 0 && (
            <div className="border-t pt-1.5">
              <div className="mb-0.5 font-semibold text-foreground">ملاحظات:</div>
              <ul className="space-y-0.5">
                {reasons.map((r, i) => (
                  <li key={i} className="flex gap-1.5 leading-relaxed">
                    <span className="text-primary">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScoreBar({ label, value, max, color, negative = false }: { label: string; value: number; max: number; color: string; negative?: boolean }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={`tabular-nums font-medium ${negative ? 'text-rose-700' : 'text-foreground'}`}>
          {negative ? '−' : '+'}{Math.round(value)}
        </span>
      </div>
      <div className="h-1 rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── التسجيل الذكي — يدمج ٥ مؤشرات ──────────────────────────────
// النتيجة ٠..١٠٠. المؤشرات:
//   • base (٠..٤٠): قابلية × أثر منسوباً إلى ٢٥ (الأقصى).
//   • support (٠..٢٠): ٤ نقاط لكل بند SWOT داعم (بحد ٥).
//   • riskPenalty (−٠..−١٥): ٣ نقاط سالبة لكل خطر (بحد ٥).
//   • quadrant (٠..١٠): SO=١٠، WO=٧، ST=٦، WT=٣، بلا=٠.
//   • pathMatch (٠..١٥): فئة الاتجاه تطابق مسار المدير (QUICK/MEDIUM/LONG).
function scoreDirection(
  d: DirectionLite,
  swot: SWOT | null,
  path: 'QUICK' | 'MEDIUM' | 'LONG' | null,
): ScoredDirection {
  const category = categorize(d.title + ' ' + d.description)
  const quadrant = extractQuadrant(d.title)

  const base = (d.feasibility * d.impact / 25) * 40

  // أدلّة SWOT — نُطابق نصّياً حتى نعرض النصوص الفعلية للمدير.
  const supportingSwot: string[] = []
  const riskSwot: string[] = []
  if (swot) {
    const text = (d.title + ' ' + d.description).toLowerCase()
    const tokens = text.split(/\s+/).filter((w) => w.length > 3)
    const match = (s: string) => tokens.some((t) => s.toLowerCase().includes(t))
    if (quadrant === 'SO') {
      supportingSwot.push(...(swot.strengths ?? []).filter(match))
      supportingSwot.push(...(swot.opportunities ?? []).filter(match))
    } else if (quadrant === 'ST') {
      supportingSwot.push(...(swot.strengths ?? []).filter(match))
      riskSwot.push(...(swot.threats ?? []).filter(match))
    } else if (quadrant === 'WO') {
      supportingSwot.push(...(swot.opportunities ?? []).filter(match))
      riskSwot.push(...(swot.weaknesses ?? []).filter(match))
    } else if (quadrant === 'WT') {
      riskSwot.push(...(swot.weaknesses ?? []).filter(match))
      riskSwot.push(...(swot.threats ?? []).filter(match))
    } else {
      supportingSwot.push(...(swot.strengths ?? []).filter(match))
      supportingSwot.push(...(swot.opportunities ?? []).filter(match))
      riskSwot.push(...(swot.weaknesses ?? []).filter(match))
      riskSwot.push(...(swot.threats ?? []).filter(match))
    }
  }
  const supportCount = Math.min(5, supportingSwot.length)
  const riskCount = Math.min(5, riskSwot.length)
  const support = supportCount * 4
  const riskPenalty = -(riskCount * 3)

  const quadScore: Record<Quad, number> = { SO: 10, WO: 7, ST: 6, WT: 3 }
  const quadrantPts = quadrant ? quadScore[quadrant] : 0

  const pathPreference: Record<'QUICK' | 'MEDIUM' | 'LONG', Category[]> = {
    QUICK:  ['efficiency', 'defense', 'customer', 'quality'],
    MEDIUM: ['growth', 'partnership', 'digital', 'people'],
    LONG:   ['innovation', 'growth', 'digital'],
  }
  const pathMatch = path && pathPreference[path].includes(category) ? 15 : 0

  const score = Math.min(100, Math.max(0, base + support + riskPenalty + quadrantPts + pathMatch))

  // مبرّرات نصّية للعرض في «لماذا؟».
  const reasons: string[] = []
  if (d.feasibility >= 4 && d.impact >= 4) reasons.push('قابلية تنفيذ وأثر عاليان معاً — الأثمر والأقل مخاطرة.')
  else if (d.feasibility >= 4) reasons.push('قابلية تنفيذ عالية — يمكن البدء بسرعة.')
  else if (d.impact >= 4) reasons.push('أثر متوقّع كبير — مضاعف نتائج.')
  if (supportCount >= 3) reasons.push(`مدعوم بـ ${supportCount} بند SWOT — قرار مبنيّ على أدلّة.`)
  if (quadrant === 'SO') reasons.push('في الربع الهجومي — يستفيد من قوّتك ويلاحق فرصة.')
  else if (quadrant === 'WO') reasons.push('في الربع التحويلي — يعالج ضعفاً ويفتح فرصة.')
  else if (quadrant === 'ST') reasons.push('في الربع الدفاعي — يوظّف القوّة ضدّ تهديد.')
  else if (quadrant === 'WT') reasons.push('في الربع التقليصي — قرار حماية عند مواجهة تهديد وضعف معاً.')
  if (path && pathPreference[path].includes(category)) {
    reasons.push(`فئته «${CATEGORY_META[category].labelAr}» تناسب مسارك ${path === 'QUICK' ? 'السريع (٠-٣ شهر)' : path === 'MEDIUM' ? 'المتوسط (٣-١٢ شهر)' : 'الطويل (١٢-٣٦+ شهر)'}.`)
  }
  if (riskCount > supportCount) reasons.push(`⚠️ عدد المخاطر (${riskCount}) أكبر من الدعم — يحتاج خطة تنفيذ حذرة.`)
  if (reasons.length === 0) reasons.push('تقييم متوسط — مراجعة يدوية مستحسنة.')

  return {
    direction: d,
    category,
    quadrant,
    score,
    breakdown: { base, support, riskPenalty, quadrant: quadrantPts, pathMatch },
    supportingSwot,
    riskSwot,
    reasons,
  }
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
