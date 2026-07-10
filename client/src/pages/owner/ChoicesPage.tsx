import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
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

  return (
    <>
      {/* لوحة جاهزية البيانات — يحث المدير على تجهيز التحليلات قبل القرار */}
      <ReadinessBar readiness={readiness} />

      <Card>
        <CardHeader>
          <CardTitle>اختر اتجاهاً</CardTitle>
          <CardDescription>{directions.length} اتجاه — كل بطاقة تعرض الأدلّة الداعمة من تحليلاتك السابقة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {directions.map((d) => {
              const selected = choice.selectedDirectionId === d.id
              const ev = evidence(d, swot)
              const q = extractQuadrant(d.title)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setChoice((p) => ({ ...p, selectedDirectionId: d.id }))}
                  className={`rounded-xl border p-4 text-right transition ${
                    selected
                      ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/40'
                      : 'bg-card hover:-translate-y-0.5 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex-1 font-semibold">{d.title || '—'}</span>
                    <span className="rounded-md border bg-background px-2 py-0.5 text-xs tabular-nums" title="قابلية × أثر">
                      {d.feasibility * d.impact}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                    {d.description || '—'}
                  </p>
                  {/* دلائل */}
                  <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
                    {q && <QuadBadge q={q} />}
                    {ev.support > 0 && (
                      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                        ✓ {ev.support} داعم من SWOT
                      </span>
                    )}
                    {ev.risk > 0 && (
                      <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-rose-800">
                        ⚠️ {ev.risk} خطر مرتبط
                      </span>
                    )}
                    {ev.support === 0 && ev.risk === 0 && !q && (
                      <span className="rounded-full border border-dashed px-2 py-0.5 text-muted-foreground">
                        لا بيانات ربط — أكمل SWOT/TOWS
                      </span>
                    )}
                  </div>
                  {selected && <div className="mt-2 text-xs font-medium text-primary">✓ مختار</div>}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* معاينة خارطة التنفيذ قبل الحفظ (للاتجاه المختار) */}
      {choice.selectedDirectionId && (() => {
        const picked = directions.find((d) => d.id === choice.selectedDirectionId)
        if (!picked) return null
        const rm = buildRoadmap(picked, swot)
        return <RoadmapCard roadmap={rm} preview />
      })()}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>المبررات</CardTitle>
              <CardDescription>لماذا اخترت هذا الاتجاه دون غيره؟</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={generateRationale}
              disabled={!choice.selectedDirectionId}
              title={!choice.selectedDirectionId ? 'اختر اتجاهاً أولاً' : 'توليد مبرّر تلقائي'}
            >
              🧠 ولّد مبرّراً من التحليل
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={5}
            value={choice.rationale}
            onChange={(e) => setChoice((p) => ({ ...p, rationale: e.target.value }))}
            placeholder="مثال: هذا الاتجاه يستفيد من قوة الفريق ويعالج فجوة سوقية واضحة…"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={commit} disabled={saving}>{saving ? 'جاري الحفظ…' : '🔒 تثبيت القرار'}</Button>
      </div>
    </>
  )
}

// ─── مكوّنات مساعدة ──────────────────────────────────────────────

function ReadinessBar({ readiness }: { readiness: { pestel: boolean; swot: boolean; tows: boolean; directions: boolean } }) {
  const items = [
    { key: 'pestel', label: 'PESTEL', to: '/pestel' },
    { key: 'swot', label: 'SWOT', to: '/swot' },
    { key: 'tows', label: 'TOWS', to: '/tows' },
    { key: 'directions', label: 'الاتجاهات', to: '/directions' },
  ] as const
  const doneCount = items.filter((i) => readiness[i.key]).length
  const pct = Math.round((doneCount / items.length) * 100)
  const tone = pct === 100 ? 'border-emerald-300 bg-emerald-50/60' : pct >= 50 ? 'border-sky-300 bg-sky-50/60' : 'border-amber-300 bg-amber-50/60'
  return (
    <Card className={tone}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">جاهزية القرار: {doneCount}/{items.length}</span>
          {items.map((i) => (
            <Link
              key={i.key}
              to={i.to}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition ${
                readiness[i.key]
                  ? 'border-emerald-300 bg-card text-emerald-700'
                  : 'border-dashed text-muted-foreground hover:bg-card'
              }`}
            >
              <span>{readiness[i.key] ? '✓' : '○'}</span>
              <span>{i.label}</span>
            </Link>
          ))}
        </div>
        <span className="text-muted-foreground">
          {pct === 100 ? '🎯 كل الأدوات جاهزة — قرارك سيكون مبنياً على أدلّة.' : 'كلّما زادت التحليلات، زادت جودة الأدلّة المرافقة.'}
        </span>
      </CardContent>
    </Card>
  )
}

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
