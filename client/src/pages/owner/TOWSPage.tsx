import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { OutsideRescueBanner } from '@/components/manager/OutsideRescueBanner'
import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { aiTowsSuggestions } from '@/lib/aiApi'
import { createInitiative, getSWOT, getTaggedTOWS, putTaggedTOWS, suggestTOWS, type TaggedTOWS } from '@/lib/strategicApi'
import {
  createTaggedItem,
  mergePreservingUserEdits,
  summarizeMerge,
  type MergeResult,
  type Origin,
  type TaggedItem,
} from '@/lib/taggedItem'
import { useGuidedManager } from '@/hooks/useGuidedManager'
import { useAuthStore } from '@/store/authStore'

// ─── TOWS — مصفوفة تحويل SWOT إلى استراتيجيّات ─────────────────────
// كل رُبع = استراتيجيّة تجمع بين طرفَي مصفوفة SWOT:
//   SO: استخدام القوى لاقتناص الفرص
//   WO: معالجة الضعف لاقتناص الفرص
//   ST: استخدام القوى لمواجهة التهديدات
//   WT: معالجة الضعف لتفادي التهديدات

type Quad = 'so' | 'wo' | 'st' | 'wt'
const QUAD_KEYS: Quad[] = ['so', 'wo', 'st', 'wt']
type ViewMode = 'grid' | 'compact' | 'detailed'
type QuadFilter = Quad | 'all'

// كل ربع صار TaggedItem[] (نصّ نظيف + أصل) بدل string[] بعلامات مدفونة.
type TOWSData = TaggedTOWS
type Incoming = Partial<Record<Quad, { text: string }[]>>

const EMPTY: TOWSData = { so: [], wo: [], st: [], wt: [] }

interface QuadMeta {
  key: Quad
  code: string       // SO1, WO2 ...
  title: string
  subtitle: string
  formula: string
  icon: string
  chipClass: string
  cardClass: string
  headerClass: string
}

const QUADS: QuadMeta[] = [
  {
    key: 'so',
    code: 'SO',
    title: 'استراتيجيّات SO — الهجوم',
    subtitle: 'استخدام القوى لاقتناص الفرص',
    formula: '💪 قوّة + 🌱 فرصة = 🚀 نموّ',
    icon: '🚀',
    chipClass: 'border-emerald-400 bg-emerald-100 text-emerald-800',
    cardClass: 'border-emerald-300 bg-emerald-50/40',
    headerClass: 'text-emerald-900',
  },
  {
    key: 'wo',
    code: 'WO',
    title: 'استراتيجيّات WO — التحويل',
    subtitle: 'معالجة الضعف لاقتناص الفرص',
    formula: '🔻 ضعف + 🌱 فرصة = 🔧 تحسين',
    icon: '🔧',
    chipClass: 'border-sky-400 bg-sky-100 text-sky-800',
    cardClass: 'border-sky-300 bg-sky-50/40',
    headerClass: 'text-sky-900',
  },
  {
    key: 'st',
    code: 'ST',
    title: 'استراتيجيّات ST — الدفاع',
    subtitle: 'استخدام القوى لمواجهة التهديدات',
    formula: '💪 قوّة + ⚠️ تهديد = 🛡️ حماية',
    icon: '🛡️',
    chipClass: 'border-violet-400 bg-violet-100 text-violet-800',
    cardClass: 'border-violet-300 bg-violet-50/40',
    headerClass: 'text-violet-900',
  },
  {
    key: 'wt',
    code: 'WT',
    title: 'استراتيجيّات WT — التقليص',
    subtitle: 'معالجة الضعف لتفادي التهديدات',
    formula: '🔻 ضعف + ⚠️ تهديد = ⚓ حماية عاجلة',
    icon: '⚓',
    chipClass: 'border-rose-400 bg-rose-100 text-rose-800',
    cardClass: 'border-rose-300 bg-rose-50/40',
    headerClass: 'text-rose-900',
  },
]

export function TOWSPage() {
  return (
    <StrategicShell
      title="مصفوفة TOWS"
      description="اشتقاق أربع استراتيجيات من تقاطع نقاط القوة والضعف مع الفرص والتهديدات."
      actions={
        <Link to="/swot" className={buttonVariants({ variant: 'outline' })}>
          ← العودة لتحليل SWOT
        </Link>
      }
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [params] = useSearchParams()
  const client = params.get('client')
  const clientQuery = client ? `&client=${client}` : ''
  const isRescueMode = params.get('from') === 'emergency'

  const user = useAuthStore((s) => s.user)
  const guided = useGuidedManager()
  const userOrigin: Origin = `user:${user?.id ?? 'me'}`

  const [data, setData] = useState<TOWSData>(EMPTY)
  // مرآة فوريّة — تُبقي الدمج يقرأ أحدث نسخة بلا انتظار الرندرة.
  const dataRef = useRef<TOWSData>(data)
  useEffect(() => { dataRef.current = data }, [data])
  const [drafts, setDrafts] = useState<Record<Quad, string>>({ so: '', wo: '', st: '', wt: '' })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})  // per-item expanded state
  const [suggesting, setSuggesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasSwot, setHasSwot] = useState(true)
  const [swotData, setSwotData] = useState<{ strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] } | null>(null)
  const [useAI, setUseAI] = useState(true)
  const [showSwotRef, setShowSwotRef] = useState(false)

  // ─── ضوابط عرض ────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [quadFilter, setQuadFilter] = useState<QuadFilter>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    // نصوص SWOT (للمرجع + تغذية AI) — string[] نظيفة من getSWOT.
    getSWOT(companyId).then((s) => {
      const empty = (s.strengths.length + s.weaknesses.length + s.opportunities.length + s.threats.length) === 0
      setHasSwot(!empty)
      setSwotData({
        strengths: s.strengths ?? [],
        weaknesses: s.weaknesses ?? [],
        opportunities: s.opportunities ?? [],
        threats: s.threats ?? [],
      })
    }).catch(() => undefined)
    // TOWS الغنيّة (TaggedItem) — تحمل الأصل/العلامة.
    getTaggedTOWS(companyId).then((t) => {
      dataRef.current = t
      setData(t)
    }).catch(() => undefined)
  }, [companyId])

  // المُطبّق المشترك — يحمي اليدوي، يستبدل نفس المصدر، يطبّع عربياً.
  function applyIncoming(source: string, inc: Incoming): MergeResult {
    const cur = dataRef.current
    const next: TOWSData = { ...cur }
    const agg: MergeResult = { merged: [], kept: 0, replaced: 0, added: 0, skipped_duplicates: 0 }
    for (const q of QUAD_KEYS) {
      const items = inc[q]
      if (!items || items.length === 0) continue
      const r = mergePreservingUserEdits(cur[q], items, source)
      next[q] = r.merged
      agg.kept = Math.max(agg.kept, r.kept)
      agg.replaced += r.replaced
      agg.added += r.added
      agg.skipped_duplicates += r.skipped_duplicates
    }
    dataRef.current = next
    setData(next)
    return agg
  }

  async function generate() {
    setSuggesting(true)
    try {
      const tows = useAI && swotData
        ? await aiTowsSuggestions({ companyId, swot: swotData })
        : await suggestTOWS(companyId)
      // نظّف أي رمز ⟪⟫ من نصّ آلي (لو أنتجه المولّد) — النصّ الآلي يجب أن يبقى
      // نظيفاً وإلا رفضه toStorage عند الحفظ (Article 1) فيفشل الحفظ بالكامل.
      const clean = (arr?: string[]) => (arr ?? []).map((text) => ({ text: text.replace(/[⟪⟫]/g, '').trim() }))
      const inc: Incoming = {
        so: clean(tows.so),
        wo: clean(tows.wo),
        st: clean(tows.st),
        wt: clean(tows.wt),
      }
      const agg = applyIncoming('اقتراح TOWS', inc)
      toast.success(`${useAI ? '✨ Claude' : '🔀'} ${summarizeMerge(agg, 'اقتراح TOWS')} — راجعها ثم احفظ.`)

      // شرح النواقص: كل ربع يبنى على فئتَي SWOT — إن كانت إحداهما فارغة يبقى الربع فارغاً.
      // (مثال هذه الشركة: لا نقاط قوة → لا SO هجوميّة ولا ST دفاعيّة بالقوى.)
      if (swotData) {
        const gaps: string[] = []
        if (swotData.strengths.length === 0)     gaps.push('نقاط القوة (تلزم SO الهجوميّة و ST الدفاعيّة)')
        if (swotData.weaknesses.length === 0)    gaps.push('نقاط الضعف (تلزم WO و WT)')
        if (swotData.opportunities.length === 0) gaps.push('الفرص (تلزم SO و WO)')
        if (swotData.threats.length === 0)       gaps.push('التهديدات (تلزم ST و WT)')
        if (gaps.length > 0) {
          toast('⚠️ بعض الأرباع بقيت فارغة لأن هذه الفئات ناقصة في SWOT:\n' +
            gaps.join('\n') + '\nأكملها في SWOT ثم أعد التوليد.', { duration: 10000 })
        }
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر توليد المقترحات'))
    } finally {
      setSuggesting(false)
    }
  }

  function add(q: Quad) {
    const v = drafts[q].trim()
    if (!v) return
    const item = createTaggedItem({ text: v, origin: userOrigin })
    const next: TOWSData = { ...dataRef.current, [q]: [...dataRef.current[q], item] }
    dataRef.current = next
    setData(next)
    setDrafts((p) => ({ ...p, [q]: '' }))
  }
  function remove(q: Quad, i: number) {
    const next: TOWSData = { ...dataRef.current, [q]: dataRef.current[q].filter((_, idx) => idx !== i) }
    dataRef.current = next
    setData(next)
  }

  async function convertToInitiative(q: Quad, text: string, idx: number) {
    const meta = QUADS.find((x) => x.key === q)!
    const clean = text.trim()
    const title = `${meta.code}${idx + 1}: ${clean.slice(0, 100)}`
    try {
      await createInitiative({
        companyId,
        title,
        description: `مصدر: TOWS/${meta.code} — ${meta.subtitle}\n\n${clean}`,
        priority: q === 'wt' ? 'critical' : q === 'so' ? 'high' : 'medium',
      })
      toast.success(`💡 أُنشئت مبادرة: «${title.slice(0, 60)}...»`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل تحويلها إلى مبادرة'))
    }
  }

  async function save() {
    setSaving(true)
    try {
      await putTaggedTOWS(companyId, data)
      toast.success('تم حفظ TOWS')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const total = data.so.length + data.wo.length + data.st.length + data.wt.length
  const visibleQuads = quadFilter === 'all' ? QUADS : QUADS.filter((q) => q.key === quadFilter)

  return (
    <>
      {/* 🚨 تحذير: خارج مسار الإنقاذ الرباعيّ */}
      {isRescueMode && (
        <OutsideRescueBanner
          companyId={companyId}
          toolName="مصفوفة TOWS"
          whyOutside="TOWS يحوّل SWOT إلى استراتيجيّات — تحتاج أوّلاً استعادة الاستقرار قبل التخطيط للنموّ."
        />
      )}
      {/* بطاقة الفلسفة والصيغة */}
      <IntroCard />

      {/* لوحة مراجع SWOT — قابلة للطيّ */}
      {swotData && (
        <SwotReferencePanel
          swot={swotData}
          expanded={showSwotRef}
          onToggle={() => setShowSwotRef((v) => !v)}
        />
      )}

      {/* بطاقة التوليد */}
      <Card className="overflow-hidden bg-gradient-to-bl from-violet-500/10 via-primary/5 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-violet-500 via-fuchsia-500 to-rose-500" />
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">{useAI ? '🤖' : '🔀'}</span>
              {useAI ? 'توليد بالذكاء الاصطناعي' : 'توليد آلي بسيط'}
            </CardTitle>
            <CardDescription>
              {useAI
                ? 'Claude يحلّل تقاطعات SWOT ويقترح ٨-١٢ استراتيجيّة تنفيذيّة.'
                : 'تقاطعات تلقائيّة حسابيّاً (بلا ذكاء اصطناعي).'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs">
              <input type="checkbox" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} />
              استخدم Claude
            </label>
            <Button onClick={generate} disabled={suggesting || !hasSwot} size="lg">
              {suggesting ? 'جاري…' : '✨ ولّد الآن'}
            </Button>
          </div>
        </CardHeader>
        {!hasSwot && (
          <CardContent className="text-sm">
            <p className="text-amber-700">
              لا يوجد تحليل SWOT بعد.{' '}
              <Link to={`/swot${clientQuery ? `?${clientQuery.slice(1)}` : ''}`} className="font-medium underline">
                ابدأ بتحليل SWOT
              </Link>
              {' '}قبل توليد TOWS.
            </p>
          </CardContent>
        )}
      </Card>

      {/* شريط الأدوات: بحث + فلترة + تبديل عرض */}
      {total > 0 && (
        <Card>
          <CardContent className="grid gap-2 p-3 md:grid-cols-3">
            {/* بحث */}
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                🔍 بحث في الاستراتيجيّات
              </label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="اكتب كلمة مفتاحيّة…"
              />
            </div>
            {/* فلترة رُبع */}
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                🎯 اعرض رُبعاً محدّداً
              </label>
              <div className="flex flex-wrap gap-1">
                <FilterChip active={quadFilter === 'all'} onClick={() => setQuadFilter('all')} label={`الكل (${total})`} />
                {QUADS.map((q) => (
                  <FilterChip
                    key={q.key}
                    active={quadFilter === q.key}
                    onClick={() => setQuadFilter(q.key)}
                    label={`${q.code} (${data[q.key].length})`}
                    className={q.chipClass}
                  />
                ))}
              </div>
            </div>
            {/* وضع العرض */}
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                📐 وضع العرض
              </label>
              <div className="flex gap-1">
                <ViewModeButton active={viewMode === 'grid'}     onClick={() => setViewMode('grid')}     icon="⊞" label="شبكة ٢×٢" />
                <ViewModeButton active={viewMode === 'compact'}  onClick={() => setViewMode('compact')}  icon="≡" label="مضغوط" />
                <ViewModeButton active={viewMode === 'detailed'} onClick={() => setViewMode('detailed')} icon="▤" label="تفصيلي" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* الأرباع الأربعة — حسب وضع العرض */}
      <div className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2' : 'flex flex-col gap-4'}>
        {visibleQuads.map((q) => (
          <QuadrantCard
            key={q.key}
            meta={q}
            items={filterItems(data[q.key], search)}
            allCount={data[q.key].length}
            draft={drafts[q.key]}
            onDraftChange={(v) => setDrafts((p) => ({ ...p, [q.key]: v }))}
            onAdd={() => add(q.key)}
            onRemove={(i) => remove(q.key, i)}
            onConvert={(text, i) => convertToInitiative(q.key, text, i)}
            expanded={expanded}
            onToggleExpand={(itemKey) => setExpanded((p) => ({ ...p, [itemKey]: !p[itemKey] }))}
            viewMode={viewMode}
          />
        ))}
      </div>

      {/* شريط الحفظ + الخطوة التاليّة */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-primary/40 bg-card p-3 shadow-lg">
        <div className="text-xs text-muted-foreground">
          <b className="text-foreground">{total}</b> استراتيجيّة موزّعة على ٤ أرباع
        </div>
        <div className="flex flex-wrap gap-2">
          {/* روابط «التالي» المكرّرة تُخفى للمدير المستقل — بطاقة الخطوة التالية
              أعلى الصفحة هي الإجراء الواحد (§٤). يبقى زر الحفظ فقط. */}
          {!guided && total > 0 && (
            <Link
              to={`/priority?tab=initiatives${clientQuery}`}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              💡 اذهب إلى المبادرات ←
            </Link>
          )}
          {!guided && (
            <Link
              to={`/directions${clientQuery ? `?${clientQuery.slice(1)}` : ''}`}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              🧭 التوجّه ←
            </Link>
          )}
          <Button onClick={save} disabled={saving} size="lg">
            {saving ? 'جاري الحفظ…' : '💾 حفظ TOWS'}
          </Button>
        </div>
      </div>
    </>
  )
}

// ─── مكوّنات مساعدة ──────────────────────────────────────────────

function IntroCard() {
  return (
    <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
      <CardContent className="p-4 text-xs leading-relaxed">
        <div className="flex items-start gap-3">
          <div className="text-3xl leading-none">🔄</div>
          <div className="flex-1 space-y-2">
            <div>
              <div className="text-sm font-bold text-foreground">ما هي TOWS؟</div>
              <p className="mt-0.5 text-muted-foreground">
                <b className="text-foreground">SWOT</b> يُحلّل («ما لدينا؟»)، <b className="text-foreground">TOWS</b> يُقرّر («ماذا نفعل؟»).
                يجمع طرفَي SWOT في ٤ استراتيجيّات عملانيّة.
              </p>
            </div>
            <div className="grid gap-1 md:grid-cols-2">
              <div className="rounded-md border border-dashed bg-emerald-50/70 p-1.5">
                <b className="text-emerald-800">🚀 SO (هجوم):</b> قوّة + فرصة = نموّ
              </div>
              <div className="rounded-md border border-dashed bg-sky-50/70 p-1.5">
                <b className="text-sky-800">🔧 WO (تحويل):</b> ضعف + فرصة = تحسين
              </div>
              <div className="rounded-md border border-dashed bg-violet-50/70 p-1.5">
                <b className="text-violet-800">🛡️ ST (دفاع):</b> قوّة + تهديد = حماية
              </div>
              <div className="rounded-md border border-dashed bg-rose-50/70 p-1.5">
                <b className="text-rose-800">⚓ WT (تقليص):</b> ضعف + تهديد = حماية عاجلة
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SwotReferencePanel({
  swot, expanded, onToggle,
}: {
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] }
  expanded: boolean
  onToggle: () => void
}) {
  const total = swot.strengths.length + swot.weaknesses.length + swot.opportunities.length + swot.threats.length
  return (
    <Card>
      <CardHeader
        className="cursor-pointer pb-2"
        onClick={onToggle}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">
            📖 مرجع SWOT — {total} عنصر
            <span className="mr-2 text-[10px] font-normal text-muted-foreground">
              💪 {swot.strengths.length} · 🔻 {swot.weaknesses.length} · 🌱 {swot.opportunities.length} · ⚠️ {swot.threats.length}
            </span>
          </CardTitle>
          <span className="text-xs text-muted-foreground">{expanded ? '▲ إخفاء' : '▼ عرض'}</span>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="grid gap-2 pt-0 md:grid-cols-2">
          <SwotColumn title="💪 القوى" items={swot.strengths} color="text-emerald-800" />
          <SwotColumn title="🔻 الضعف" items={swot.weaknesses} color="text-rose-800" />
          <SwotColumn title="🌱 الفرص" items={swot.opportunities} color="text-sky-800" />
          <SwotColumn title="⚠️ التهديدات" items={swot.threats} color="text-amber-800" />
        </CardContent>
      )}
    </Card>
  )
}

function SwotColumn({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className={`text-[11px] font-bold ${color}`}>{title} ({items.length})</div>
      <ol className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
        {items.slice(0, 5).map((it, i) => (
          <li key={i} className="line-clamp-1">
            {i + 1}. {it.slice(0, 60)}
          </li>
        ))}
        {items.length > 5 && (
          <li className="text-muted-foreground/70">+ {items.length - 5} عنصر آخر</li>
        )}
      </ol>
    </div>
  )
}

function QuadrantCard({
  meta, items, allCount, draft, onDraftChange, onAdd, onRemove, onConvert,
  expanded, onToggleExpand, viewMode,
}: {
  meta: QuadMeta
  items: TaggedItem[]
  allCount: number
  draft: string
  onDraftChange: (v: string) => void
  onAdd: () => void
  onRemove: (i: number) => void
  onConvert: (text: string, i: number) => void
  expanded: Record<string, boolean>
  onToggleExpand: (key: string) => void
  viewMode: ViewMode
}) {
  return (
    <Card className={meta.cardClass}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className={`flex flex-wrap items-center gap-2 text-base ${meta.headerClass}`}>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${meta.chipClass}`}>
                {meta.code}
              </span>
              <span className="text-xl">{meta.icon}</span>
              <span>{meta.title}</span>
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                ({allCount}{items.length !== allCount ? ` — ظاهر: ${items.length}` : ''})
              </span>
            </CardTitle>
            <CardDescription>{meta.subtitle}</CardDescription>
            <div className="mt-1 inline-block rounded-md border border-dashed bg-white/60 px-2 py-0.5 text-[10px] text-muted-foreground">
              {meta.formula}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* إضافة يدويّة */}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd())}
            placeholder="أضف استراتيجيّة يدويّة…"
            className="bg-background"
          />
          <Button variant="outline" size="sm" onClick={onAdd}>＋ إضافة</Button>
        </div>

        {/* قائمة الاستراتيجيّات */}
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
            {allCount === 0 ? 'لا استراتيجيّات — استعمل «✨ ولّد الآن» أعلاه.' : 'لا نتائج للبحث — امسح الفلتر.'}
          </div>
        ) : (
          <ol className="space-y-1.5">
            {items.map((item, i) => {
              const isAuto = item.origin === 'auto'
              const itemKey = item.id
              const isExpanded = expanded[itemKey] ?? false
              const isLong = item.text.length > 120
              const displayText = viewMode === 'compact' || (!isExpanded && isLong)
                ? item.text.slice(0, 120) + (isLong ? '…' : '')
                : item.text
              return (
                <li key={itemKey} className="rounded-lg border-2 border-white/60 bg-white p-2 shadow-sm">
                  <div className="flex items-start gap-2">
                    <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${meta.chipClass}`}>
                      {meta.code}{i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed">
                        {/* الشارة 🤖 تُشتقّ من origin وقت العرض — لا تُدفَن في النصّ */}
                        {isAuto && <span className="ml-1 text-xs" title="مُولَّد آلياً — عدّله ليصبح يدويّاً محميّاً">🤖</span>}
                        {displayText}
                      </p>
                      {/* Actions */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {isLong && viewMode !== 'compact' && (
                          <button
                            type="button"
                            onClick={() => onToggleExpand(itemKey)}
                            className="rounded px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/10"
                          >
                            {isExpanded ? '▲ اطوِ' : '▼ اقرأ الكامل'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onConvert(item.text, i)}
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                          title="حوّل هذه الاستراتيجيّة إلى مبادرة قابلة للتنفيذ"
                        >
                          💡 حوّل لمبادرة
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(i)}
                          className="mr-auto rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
                          title="حذف"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function FilterChip({ active, onClick, label, className }: { active: boolean; onClick: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
        active
          ? className ?? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-muted'
      }`}
    >
      {label}
    </button>
  )
}

function ViewModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs transition ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-muted'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

// فلترة نصّيّة (بحث)
function filterItems(items: TaggedItem[], search: string): TaggedItem[] {
  if (!search.trim()) return items
  const q = search.trim().toLowerCase()
  return items.filter((it) => it.text.toLowerCase().includes(q))
}
