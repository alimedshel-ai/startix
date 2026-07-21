import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { NextActionCard } from '@/components/manager/NextActionCard'
import { OutsideRescueBanner } from '@/components/manager/OutsideRescueBanner'
import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, getTaggedSWOT, putTaggedSWOT, seedSwotFromDiagnostic, type TaggedSWOT } from '@/lib/strategicApi'
import {
  createTaggedItem,
  mergePreservingUserEdits,
  summarizeMerge,
  type MergeResult,
  type Origin,
  type TaggedItem,
} from '@/lib/taggedItem'
import { DEPT_QUESTIONS } from '@/lib/deptQuestions'
import { useAuthStore } from '@/store/authStore'

// ─── ربط شارة المصدر بصفحة المنشأ ─────────────────────────────
// عند النقر على 📍 مصدر → ينتقل المستخدم إلى الصفحة الأصليّة ليرى
// السياق الكامل (السؤال/الفجوة/محور PESTEL) الذي وُلّد منه البند.
function sourceToUrl(source: string, companyId: string): string | null {
  const q = `?client=${companyId}`
  if (source.startsWith('PESTEL')) return `/manager/dept-pestel${q}`
  if (source.includes('التحليل العميق')) return `/manager/deep-analysis${q}`
  if (source.includes('الفجوة'))          return `/manager/dept-gap${q}`
  if (source.includes('التشخيص'))         return `/manager/diagnostic`
  return null
}

type Quadrant = 'strengths' | 'weaknesses' | 'opportunities' | 'threats'
const QUADRANT_KEYS: Quadrant[] = ['strengths', 'weaknesses', 'opportunities', 'threats']

// كل ربع صار قائمة TaggedItem (نصّ نظيف + أصل + مصدر + سبب) بدل string[].
// الشارة 🤖 تُشتقّ من origin وقت العرض — لا تُدفَن في النصّ.
type Data = Record<Quadrant, TaggedItem[]>

// شكل الوارد من مُولّد: نصّ + سبب اختياري (المصدر يُختم في الدمج).
type Incoming = Partial<Record<Quadrant, { text: string; reason?: string }[]>>

const QUADRANTS: { key: Quadrant; title: string; icon: string; tint: string; helper: string }[] = [
  { key: 'strengths',     title: 'نقاط القوة',     icon: '💪', tint: 'border-emerald-200 bg-emerald-50/40', helper: 'مزايا داخلية تميّزك.' },
  { key: 'weaknesses',    title: 'نقاط الضعف',     icon: '🔻', tint: 'border-rose-200 bg-rose-50/40',       helper: 'نقاط ضعف داخلية تحتاج معالجة.' },
  { key: 'opportunities', title: 'الفرص',          icon: '🌱', tint: 'border-sky-200 bg-sky-50/40',         helper: 'فرص خارجية يمكن اقتناصها.' },
  { key: 'threats',       title: 'التهديدات',      icon: '⚠️', tint: 'border-amber-200 bg-amber-50/40',     helper: 'تهديدات خارجية قد تضرّك.' },
]

const EMPTY: Data = { strengths: [], weaknesses: [], opportunities: [], threats: [] }

export function SWOTPage() {
  return (
    <StrategicShell
      title="تحليل SWOT"
      description="مصفوفة رباعية: نقاط القوة، الضعف، الفرص، والتهديدات."
      actions={
        <Link to="/tows" className={buttonVariants({ variant: 'outline' })}>
          توليد مصفوفة TOWS ←
        </Link>
      }
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [searchParams] = useSearchParams()
  const isRescueMode = searchParams.get('from') === 'emergency'
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const [data, setData] = useState<Data>(EMPTY)
  const [drafts, setDrafts] = useState<Record<Quadrant, string>>({ strengths: '', weaknesses: '', opportunities: '', threats: '' })
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedingPestel, setSeedingPestel] = useState(false)
  const [seedingDeep, setSeedingDeep] = useState(false)
  const [seedingGap, setSeedingGap] = useState(false)

  // أصل البند اليدوي يحمل معرّف المستخدم (بيئة تشاركيّة) — حجر حارس الهوية.
  const userOrigin: Origin = `user:${user?.id ?? 'me'}`

  // مرآة فوريّة للحالة — تُبقي الدمج المتسلسل (ولّد الكل) يقرأ أحدث نسخة
  // بلا انتظار إعادة الرندرة، فلا يطمس مصدرٌ لاحق نتائج سابقه.
  const dataRef = useRef<Data>(data)
  useEffect(() => { dataRef.current = data }, [data])

  useEffect(() => {
    getTaggedSWOT(companyId).then((s: TaggedSWOT) => {
      const next: Data = {
        strengths: s.strengths ?? [],
        weaknesses: s.weaknesses ?? [],
        opportunities: s.opportunities ?? [],
        threats: s.threats ?? [],
      }
      dataRef.current = next
      setData(next)
    }).catch(() => undefined)
  }, [companyId])

  function add(q: Quadrant) {
    const v = drafts[q].trim()
    if (!v) return
    // بند يدوي مقدّس — نصّه كما هو (حتى لو حوى ⟪)، أصله user:<id>.
    const item = createTaggedItem({ text: v, origin: userOrigin })
    const next: Data = { ...dataRef.current, [q]: [...dataRef.current[q], item] }
    dataRef.current = next
    setData(next)
    setDrafts((p) => ({ ...p, [q]: '' }))
  }
  function remove(q: Quadrant, i: number) {
    const next: Data = { ...dataRef.current, [q]: dataRef.current[q].filter((_, idx) => idx !== i) }
    dataRef.current = next
    setData(next)
  }

  // ─── المُطبّق المشترك للدمج — يحمي اليدوي، يستبدل نفس المصدر، يطبّع عربياً ──
  // silent=true في «ولّد الكل» لتجميع Toast واحد بدل ٣.
  function applyIncoming(source: string, inc: Incoming, silent = false): MergeResult {
    const cur = dataRef.current
    const next: Data = { ...cur }
    const agg: MergeResult = { merged: [], kept: 0, replaced: 0, added: 0, skipped_duplicates: 0 }
    for (const q of QUADRANT_KEYS) {
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
    if (!silent && (agg.added > 0 || agg.replaced > 0 || agg.skipped_duplicates > 0)) {
      toast.success(`${summarizeMerge(agg, source)} — راجعها ثم احفظ.`)
    }
    return agg
  }

  async function save() {
    setSaving(true)
    try {
      await putTaggedSWOT(companyId, data)
      toast.success('تم حفظ التحليل')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  async function seedFromDiagnostic() {
    setSeeding(true)
    try {
      await seedSwotFromDiagnostic(companyId)
      // نُعيد التحميل من القاعدة بدلاً من الاعتماد على استجابة seed مباشرة —
      // كي يتزامن الشكل الظاهر مع أي منطق دمج/دفاعي حصل على السيرفر.
      const fresh = await getTaggedSWOT(companyId)
      const next: Data = {
        strengths: fresh.strengths ?? [],
        weaknesses: fresh.weaknesses ?? [],
        opportunities: fresh.opportunities ?? [],
        threats: fresh.threats ?? [],
      }
      dataRef.current = next
      setData(next)
      toast.success('تم بذر التحليل من آخر تشخيص')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر البذر من التشخيص'))
    } finally {
      setSeeding(false)
    }
  }

  // ─── ترابط: PESTEL → SWOT (Opportunities + Threats) ────────────────
  // نستخدم منطق تصنيف مبنيّ على نوع المحور + مؤشّرات نصّية:
  //   • Political / Legal / Environmental → تُصنَّف تلقائياً كتهديدات
  //     (قوانين، لوائح، اشتراطات = ضغوط خارجية).
  //   • Economic / Social / Technological → تُصنَّف كفرص افتراضاً
  //     (اتجاهات نمو، تحوّلات، تقنيات جديدة).
  //   • إشارات نصّية تكسر القاعدة:
  //     - كلمات "تراجع/ارتفاع تكاليف/تشدّد/شح/تضخم/انخفاض/غرامة" → تهديد
  //     - كلمات "نمو/فرصة/رؤية 2030/دعم/تسهيل/توسّع/تحفيز" → فرصة
  //   • للـcompany-wide PESTEL: نستخدم impact rating.
  const AXIS_DEFAULT: Record<string, 'opportunity' | 'threat'> = {
    political: 'threat', legal: 'threat', environmental: 'threat',
    economic: 'opportunity', social: 'opportunity', technological: 'opportunity',
  }
  const THREAT_KEYWORDS = /تراجع|ارتفاع تكاليف|تشدّد|شحّ|تضخم|انخفاض|غرام|قيود|منع|حظر|صعوبة|أزمة|خطر|مخاطر|تحدّي/
  const OPP_KEYWORDS = /نمو|فرصة|رؤية 2030|دعم|تسهيل|توسّع|تحفيز|تشجيع|إعفاء|تخفيض|زيادة الطلب|طفرة/

  function classifyLine(axis: string, line: string): 'opportunity' | 'threat' {
    if (THREAT_KEYWORDS.test(line)) return 'threat'
    if (OPP_KEYWORDS.test(line)) return 'opportunity'
    return AXIS_DEFAULT[axis] ?? 'opportunity'
  }
  function axisLabelAr(axis: string): string {
    const map: Record<string, string> = {
      political: 'سياسي', economic: 'اقتصادي', social: 'اجتماعي',
      technological: 'تقني', environmental: 'بيئي', legal: 'قانوني',
    }
    return map[axis] ?? axis
  }

  // بانٍ نقيّ: يقرأ PESTEL ويُرجع الوارد (فرص/تهديدات) بلا لمس الحالة.
  async function buildPESTEL(): Promise<Incoming | null> {
    const opps: { text: string; reason?: string }[] = []
    const thrs: { text: string; reason?: string }[] = []
    if (specialty) {
      const deptArt = await getArtifact<Record<string, string>>(companyId, `PESTEL_${specialty}`)
      if (deptArt?.data) {
        for (const axis of ['political', 'economic', 'social', 'technological', 'environmental', 'legal']) {
          const raw = deptArt.data[axis]
          if (typeof raw !== 'string') continue
          for (const line of raw.split('\n').map((s) => s.replace(/^[•\-·]\s*/, '').trim()).filter(Boolean)) {
            const target = classifyLine(axis, line)
            const reason = target === 'threat'
              ? `عامل ${axisLabelAr(axis)} خارجي يشكّل ضغطاً`
              : `عامل ${axisLabelAr(axis)} خارجي يفتح إمكانيّة`
            ;(target === 'threat' ? thrs : opps).push({ text: line, reason })
          }
        }
      }
    }
    if (opps.length === 0 && thrs.length === 0) {
      interface F { text: string; impact: number }
      const coArt = await getArtifact<Record<string, F[]>>(companyId, 'PESTEL')
      if (coArt?.data) {
        for (const axis of ['political', 'economic', 'social', 'technological', 'environmental', 'legal']) {
          const arr = coArt.data[axis]
          if (!Array.isArray(arr)) continue
          for (const f of arr) {
            if (!f?.text) continue
            const reason = `عامل ${axisLabelAr(axis)} مع تأثير ${f.impact}/٥`
            ;(f.impact >= 4 ? thrs : opps).push({ text: f.text, reason })
          }
        }
      }
    }
    if (opps.length === 0 && thrs.length === 0) return null
    return { opportunities: opps, threats: thrs }
  }

  async function seedFromPESTEL() {
    setSeedingPestel(true)
    try {
      const inc = await buildPESTEL()
      if (!inc) {
        toast.error('لا PESTEL محفوظ بعد — افتح صفحة PESTEL وأدخل عوامل أوّلاً.')
        return
      }
      applyIncoming('PESTEL', inc)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر القراءة من PESTEL'))
    } finally {
      setSeedingPestel(false)
    }
  }

  // ─── ترابط: DEPT_DEEP_FULL → SWOT (S/W) ─────────────────────────
  // يقرأ إجابات التحليل العميق (بنك ٣٣٠ سؤالاً) ويحوّلها إلى نقاط قوة/ضعف
  // بمنطق بسيط:
  //   • radio: الخيار الأول = قوة، الخيار الأخير = ضعف، الوسط = يُتجاهل
  //   • checkbox: فراغ أو "لا يوجد/لا مزايا" = ضعف، عكسه = قوة (تُدرج
  //     العناصر المُختارة كأدلّة).
  //   • textarea: يُتجاهل — نصوص حرّة يصعب تصنيفها.
  // تُدمج مع الموجود بلا تكرار.
  //
  // ─── تحويل السؤال إلى جملة تقريريّة (Statement) ─────────────
  // البنك مصمّم كأسئلة («هل لديك محاسب جديد؟»). الوضع الأصلي كان يُدمج
  // السؤال + الإجابة كما هو، فيخرج «هل لديك محاسب جديد — نعم» كنقطة قوّة،
  // وهذا يُقرأ كسؤال لا كقوّة. `toStatement` يحوّلها إلى «لديك محاسب جديد».
  //
  // ─── المصدر والسبب ────────────────────────────────────────
  // لم تعد العلامة تُدفَن في النصّ (⟪⟫) — الآن TaggedItem يحمل origin/source/
  // reason في حقول مستقلّة، والشارة 🤖 تُشتقّ من origin وقت العرض.

  function toStatement(label: string, answer: string, kind: 'strength' | 'weakness'): string {
    let l = label.trim()
    const a = answer.trim()
    if (l.startsWith('هل ')) {
      l = l.slice(3).trim()
      if (/^نعم\b/i.test(a)) return kind === 'strength' ? `✓ ${l}` : l
      if (/^لا\b/i.test(a))  return kind === 'weakness' ? `✗ لا ${l}` : `لا ${l}`
      return `${l} — ${a}`
    }
    if (l.startsWith('كم ')) return `${l.slice(3).trim()}: ${a}`
    if (l.startsWith('ما ') || l.startsWith('ماذا ') || l.startsWith('كيف ')) {
      return `${l.replace(/^(ما|ماذا|كيف)\s+/, '').trim()}: ${a}`
    }
    if (l.startsWith('أي ') || l.startsWith('أيّ ')) {
      return `${l.replace(/^أيّ?\s+/, '').trim()}: ${a}`
    }
    return `${l}: ${a}`
  }

  // ─── مولّد أسباب ذكيّة لبنود التحليل العميق ─────────────────
  // يقرأ نصّ الإجابة + سياق السؤال ويُنشئ تفسيراً لماذا هذا قوّة/ضعف.
  function reasonForDeepItem(label: string, answer: string, kind: 'strength' | 'weakness'): string {
    const t = (label + ' ' + answer).toLowerCase()
    // قوّة تنظيميّة
    if (kind === 'strength') {
      if (/محاسب|مدقّق|قانوني/.test(t)) return 'قدرة تنظيميّة داخليّة نادرة في الشركات الصغيرة'
      if (/تكامل|متكامل|integrated/.test(t)) return 'نضج رقمي — يُقلّل الأخطاء ويوفّر الوقت'
      if (/نسخ احتياطي|backup|أمان/.test(t)) return 'حماية للأصول الرقميّة والاستمراريّة'
      if (/تلقائي|آلي|automated/.test(t)) return 'كفاءة تشغيليّة عبر الأتمتة'
      if (/متنوّع|متنوع|4\+|٤\+|٥\+|diversif/.test(t)) return 'تنوّع يخفض الاعتماد على مصدر واحد'
      if (/متخصّص|متخصص|specialized/.test(t)) return 'خبرة عميقة تُميّزك عن المنافس'
      if (/دائماً|منتظم|في موعد|on time/.test(t)) return 'انضباط تشغيلي مستدام'
      if (/فورًا|فوري|24\/7/.test(t)) return 'استجابة سريعة تُعزّز الثقة'
      if (/معتمَد|معتمد|certified|iso/.test(t)) return 'مصداقيّة موثّقة تُسهّل الشراكات'
      // افتراضي
      return 'مؤشّر إيجابي مقارنةً بالحدّ الأدنى للممارسة الجيّدة'
    }
    // ضعف
    if (/لا يوجد|بلا|غائب|منعدم/.test(t)) return 'غياب أساس ضروري — يُضعف القدرة التشغيليّة'
    if (/يدوي|manual/.test(t)) return 'اعتماد على المجهود اليدوي — يُبطئ ويرفع الأخطاء'
    if (/متأخّر|تأخير|late/.test(t)) return 'تأخّر يُهدر الفرص أو يُراكم الغرامات'
    if (/ضعيف|منخفض|بطيء/.test(t)) return 'أداء دون العتبة — يُقيّد النموّ'
    return 'يحتاج معالجة لتفادي تأثير سلبي'
  }

  async function buildDeep(): Promise<Incoming | null> {
    if (!specialty) return null
    const bank = DEPT_QUESTIONS[specialty]
    if (!bank) return null
    interface Deep { deptCode: string; answers: Record<string, string | string[]> }
    const art = await getArtifact<Deep>(companyId, 'DEPT_DEEP_FULL')
    if (!art?.data?.answers) return null
    const answers = art.data.answers
    const strengths: { text: string; reason?: string }[] = []
    const weaknesses: { text: string; reason?: string }[] = []

    // نُنظّف label السؤال من رموز البداية (📊/📋/إلخ) وعلامة الاستفهام.
    const clean = (label: string) => label
      .replace(/^[^\p{L}]*/u, '').trim()
      .replace(/؟$/, '').trim()
    const isNegativeAnswer = (v: string) =>
      /^لا\b|^لا يوجد|^غير|^بلا|^ضعيف|^منخفض|^سيّئ|^فوضوي|^عشوائي|^متدنّ|^أكثر من|^جامد|^غائب/i.test(v.trim())
    const isPositiveAnswer = (v: string) =>
      /^نعم\b|^ممتاز|^جيد جداً|^متكامل|^دقيق|^حديث|^رقمي|^كامل|^متطوّر|^عالي/i.test(v.trim())

    for (const q of bank.questions) {
      const a = answers[q.id]
      if (a == null) continue

      if (q.type === 'radio' && typeof a === 'string') {
        const idx = q.opts.indexOf(a)
        if (idx < 0) continue
        const label = clean(q.label)
        if (isNegativeAnswer(a)) {
          weaknesses.push({ text: toStatement(label, a, 'weakness'), reason: reasonForDeepItem(label, a, 'weakness') })
        } else if (isPositiveAnswer(a)) {
          strengths.push({ text: toStatement(label, a, 'strength'), reason: reasonForDeepItem(label, a, 'strength') })
        } else if (idx === 0 && q.opts.length >= 3) {
          strengths.push({ text: toStatement(label, a, 'strength'), reason: reasonForDeepItem(label, a, 'strength') })
        } else if (idx === q.opts.length - 1 && q.opts.length >= 3) {
          weaknesses.push({ text: toStatement(label, a, 'weakness'), reason: reasonForDeepItem(label, a, 'weakness') })
        }
      } else if (q.type === 'checkbox' && Array.isArray(a)) {
        const label = clean(q.label)
        if (a.length === 0) {
          weaknesses.push({ text: toStatement(label, 'بلا اختيار', 'weakness'), reason: reasonForDeepItem(label, 'لا يوجد', 'weakness') })
          continue
        }
        const hasNegative = a.some(isNegativeAnswer)
        const positives = a.filter((x) => !isNegativeAnswer(x))
        if (hasNegative && positives.length === 0) {
          weaknesses.push({ text: toStatement(label, a.join(' · '), 'weakness'), reason: reasonForDeepItem(label, a.join(' '), 'weakness') })
        } else if (positives.length >= 3) {
          const summary = positives.slice(0, 3).join(' · ') + (positives.length > 3 ? '…' : '')
          strengths.push({ text: toStatement(label, summary, 'strength'), reason: reasonForDeepItem(label, summary, 'strength') })
        }
      }
    }

    if (strengths.length === 0 && weaknesses.length === 0) return null
    return { strengths, weaknesses }
  }

  async function seedFromDeepAnalysis() {
    if (!specialty) {
      toast.error('لا تخصّص محدّد — يعمل هذا الزر للمدير المستقل فقط.')
      return
    }
    if (!DEPT_QUESTIONS[specialty]) {
      toast.error(`بنك أسئلة ${specialty} غير متوفّر.`)
      return
    }
    setSeedingDeep(true)
    try {
      const inc = await buildDeep()
      if (!inc) {
        toast.error('لا تحليل عميق قابل للاستخراج — افتح /manager/deep-analysis واملأ أسئلة radio/checkbox.')
        return
      }
      applyIncoming('التحليل العميق', inc)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر القراءة من التحليل العميق'))
    } finally {
      setSeedingDeep(false)
    }
  }

  // ─── ترابط: dept-gap → SWOT (Weaknesses + Strengths) ───────────
  // الفجوات ذات الفارق (target − current) عالٍ → ضعف صريح.
  // الفجوات المُقلَبَة (current ≥ target) → قوى.
  //   • فارق ≥ 30 → weakness ("فجوة كبيرة")
  //   • فارق 15-29 → weakness ("فجوة متوسطة")
  //   • فارق < 15 → يُتجاهل (فجوة صغيرة أو محقّقة)
  //   • current ≥ target ⇒ strength ("متفوّق على المستهدف")
  async function buildGap(): Promise<Incoming | null> {
    if (!specialty) return null
    interface GapItem { name: string; current: number; target: number; action: string }
    interface GapData { gaps: GapItem[] }
    const art = await getArtifact<GapData>(companyId, `GAP_ANALYSIS_${specialty}`)
    if (!art?.data?.gaps || art.data.gaps.length === 0) return null
    const strengths: { text: string; reason?: string }[] = []
    const weaknesses: { text: string; reason?: string }[] = []
    for (const g of art.data.gaps) {
      if (!g.name) continue
      const diff = g.target - g.current
      if (diff >= 30) {
        weaknesses.push({ text: `${g.name} (${g.current}٪ / مستهدف ${g.target}٪)`, reason: `فجوة كبيرة (${diff}٪) — تحتاج تدخّلاً` })
      } else if (diff >= 15) {
        weaknesses.push({ text: `${g.name} (${g.current}٪ / مستهدف ${g.target}٪)`, reason: `فجوة متوسّطة (${diff}٪) — قابلة للإغلاق` })
      } else if (g.current >= g.target && g.target > 0) {
        strengths.push({ text: `${g.name} (${g.current}٪)`, reason: `يفوق المستهدف بـ ${g.current - g.target}٪` })
      }
    }
    if (strengths.length === 0 && weaknesses.length === 0) return null
    return { strengths, weaknesses }
  }

  async function seedFromDeptGap() {
    if (!specialty) {
      toast.error('لا تخصّص محدّد — يعمل هذا الزر للمدير المستقل فقط.')
      return
    }
    setSeedingGap(true)
    try {
      const inc = await buildGap()
      if (!inc) {
        toast.error('لا فجوات قابلة للاستخدام — افتح /manager/dept-gap وسجّل فجوات ≥ ١٥٪.')
        return
      }
      applyIncoming('تحليل الفجوة', inc)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر القراءة من تحليل الفجوة'))
    } finally {
      setSeedingGap(false)
    }
  }

  const anyBusy = seedingDeep || seedingPestel || seedingGap || seeding || saving

  // ─── التوليد الموحّد — زرٌّ واحد يستدعي كل المصادر بالترتيب ────
  // بدل ٤ أزرار منفصلة، هذا يجمع كل الروافد في تشغيل واحد. المصادر:
  //   ١) التحليل العميق → قوى + ضعف
  //   ٢) تحليل الفجوة  → قوى + ضعف
  //   ٣) PESTEL         → فرص + تهديدات
  //   ٤) التشخيص العام  → دمج شامل من السيرفر
  const [generatingAll, setGeneratingAll] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  // عند محاولة التوليد بلا مصادر: نعرض بطاقة روابط بدل رسالة مسدودة.
  const [noSources, setNoSources] = useState(false)

  async function generateAll() {
    setGeneratingAll(true)
    try {
      // نبني كل المصادر بالتوازي (نقيّة، بلا لمس حالة) — الفشل في واحد لا يُوقف الآخرين.
      const [deep, gap, pestel] = await Promise.all([
        buildDeep().catch(() => null),
        buildGap().catch(() => null),
        buildPESTEL().catch(() => null),
      ])
      // نطبّق بالتسلسل (silent) — dataRef يبقي كل خطوة على أحدث نسخة فلا تُطمس السابقة.
      const total: MergeResult = { merged: [], kept: 0, replaced: 0, added: 0, skipped_duplicates: 0 }
      const sources: [string, Incoming | null][] = [
        ['التحليل العميق', deep], ['تحليل الفجوة', gap], ['PESTEL', pestel],
      ]
      let any = false
      for (const [src, inc] of sources) {
        if (!inc) continue
        any = true
        const r = applyIncoming(src, inc, true)
        total.kept = Math.max(total.kept, r.kept)
        total.replaced += r.replaced
        total.added += r.added
        total.skipped_duplicates += r.skipped_duplicates
      }
      if (!any) {
        setNoSources(true)
        toast.error('لا مصادر جاهزة بعد — افتح إحداها من البطاقة أعلى الصفحة.')
        return
      }
      setNoSources(false)
      toast.success(`✨ ${summarizeMerge(total, 'كل المصادر')} — راجعها ثم احفظ.`)
    } finally {
      setGeneratingAll(false)
    }
  }

  // ─── حساب حالة الاكتمال للتوجيه الذكي ────────────────────────
  const totalItems = data.strengths.length + data.weaknesses.length + data.opportunities.length + data.threats.length
  const emptyQuadrant = QUADRANTS.find((q) => data[q.key].length === 0)
  const isBalanced = QUADRANTS.every((q) => data[q.key].length >= 3)

  return (
    <>
      {/* 🧭 مصادر SWOT غير جاهزة — روابط مباشرة بدل طريق مسدود */}
      {noSources && (
        <Card className="border-2 border-amber-300 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="text-sm font-bold text-amber-900">لبناء SWOT تلقائياً، أكمِل أحد مصادر التحليل أوّلاً:</div>
            <p className="mt-1 text-xs leading-relaxed text-amber-800/80">
              SWOT يُوَلَّف من مخرجات مرحلة التحليل — افتح إحداها، أجب عليها، ثم ارجع هنا واضغط «ولّد».
              (أو أضِف البنود يدوياً في الأرباع الأربعة أدناه.)
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Link to={sourceToUrl('PESTEL', companyId) ?? '#'} className="inline-flex items-center gap-1 rounded-lg border-2 border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:-translate-y-0.5 hover:border-amber-500">🌐 PESTEL</Link>
              <Link to={sourceToUrl('التحليل العميق', companyId) ?? '#'} className="inline-flex items-center gap-1 rounded-lg border-2 border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:-translate-y-0.5 hover:border-amber-500">🔬 التحليل العميق</Link>
              <Link to={sourceToUrl('الفجوة', companyId) ?? '#'} className="inline-flex items-center gap-1 rounded-lg border-2 border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:-translate-y-0.5 hover:border-amber-500">📐 تحليل الفجوة</Link>
            </div>
          </CardContent>
        </Card>
      )}
      {/* 🚨 تحذير: خارج مسار الإنقاذ الرباعيّ (يظهر عند القدوم من الطوارئ) */}
      {isRescueMode && (
        <OutsideRescueBanner
          companyId={companyId}
          toolName="تحليل SWOT"
          whyOutside="التوليف الاستراتيجي طويل الأمد لا يُوقف النزيف المالي. أكمل الإنقاذ ثم ارجع لبناء استراتيجيّة كاملة."
        />
      )}
      {/* 🧭 «إلى أين أذهب الآن؟» — يظهر عند الحاجة فقط */}
      {totalItems > 0 && emptyQuadrant && (
        <NextActionCard
          icon="⚠️"
          title={`ربع «${emptyQuadrant.title}» فارغ`}
          reason="لا يمكن الانتقال لـ TOWS بربع فارغ. أضف ٢-٣ بنود أو ولّد تلقائياً من الزر أدناه."
          to="#"
          cta={`أضف ${emptyQuadrant.title}`}
          variant="amber"
          onClick={() => {
            const el = document.getElementById(`swot-quad-${emptyQuadrant.key}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }}
        />
      )}
      {totalItems > 0 && !emptyQuadrant && isBalanced && (
        <NextActionCard
          icon="✅"
          title="SWOT جاهز — انتقل إلى TOWS"
          reason={`٤ أرباع مكتملة (${totalItems} بند). TOWS يحوّل هذه التقاطعات إلى استراتيجيّات تنفيذيّة.`}
          to={`/tows?client=${companyId}`}
          cta="افتح TOWS"
          variant="emerald"
        />
      )}

      {/* ✨ زر التوليد الرئيسي — بارز، بديلٌ للأزرار الأربعة */}
      <Card className="border-2 border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl">✨</div>
            <div>
              <div className="text-sm font-bold">توليد تلقائي من ٤ مصادر</div>
              <p className="text-xs text-muted-foreground">
                يقرأ: التحليل العميق (S/W) · تحليل الفجوة (S/W) · PESTEL (O/T) → يملأ الأرباع الأربعة بجُمَل تقريريّة نظيفة.
                <b className="mr-1 text-foreground">كل بند يحمل شارة 📍 مصدره + شارة 💡 سبب تصنيفه</b>.
              </p>
            </div>
          </div>
          <Button onClick={generateAll} disabled={anyBusy || generatingAll} size="lg">
            {generatingAll ? 'جاري التوليد…' : '✨ ولّد الكل'}
          </Button>
        </CardContent>
      </Card>

      {/* دليل مصادر التوليد + شرح شارات كل بند */}
      <Card className="border-dashed">
        <CardContent className="p-3 text-xs leading-relaxed text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-foreground">📖 من أين جاءت البنود المُولَّدة؟</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-primary">
              📍 المصدر
            </span>
            <span className="text-[11px]">← الشارة الزرقاء تُخبرك من أين جاء البند (التحليل العميق · تحليل الفجوة · PESTEL).</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-800">
              💡 لماذا
            </span>
            <span className="text-[11px]">← الشارة الخضراء تُبرّر لماذا صُنِّف البند هنا (قوّة/ضعف/فرصة/تهديد).</span>
          </div>
          <div className="mt-1.5 text-[11px]">
            <b className="text-foreground">إن لم تظهر الشارات:</b> البند مُضاف يدوياً — لا مصدر آلي له. يمكنك حذفه وتوليد بديل من الزر أعلاه.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {QUADRANTS.map((q) => (
          <Card key={q.key} id={`swot-quad-${q.key}`} className={q.tint}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xl">{q.icon}</span>
                {q.title}
                <span className="mr-auto text-xs font-normal text-muted-foreground tabular-nums">({data[q.key].length})</span>
              </CardTitle>
              <CardDescription>{q.helper}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={drafts[q.key]}
                  onChange={(e) => setDrafts((p) => ({ ...p, [q.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add(q.key))}
                  placeholder="أضف عنصراً واضغط Enter…"
                />
                <Button variant="outline" size="sm" onClick={() => add(q.key)}>إضافة</Button>
              </div>
              <ul className="space-y-1.5">
                {data[q.key].map((item, i) => {
                  const isAuto = item.origin === 'auto'
                  return (
                    <li key={item.id} className="rounded-md border bg-card px-3 py-2 text-sm">
                      <div className="flex items-start gap-2">
                        {/* الشارة 🤖 تُشتقّ من origin وقت العرض — لا تُدفَن في النصّ */}
                        {isAuto && <span className="mt-0.5 shrink-0 text-xs" title="مُولَّد آلياً — عدّله ليصبح يدويّاً محميّاً">🤖</span>}
                        <span className="flex-1 leading-relaxed">{item.text}</span>
                        <button
                          type="button"
                          onClick={() => remove(q.key, i)}
                          className="text-xs text-muted-foreground transition hover:text-destructive"
                          title="حذف"
                        >
                          🗑️
                        </button>
                      </div>
                      {(item.source || item.reason) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                          {item.source && (() => {
                            const url = sourceToUrl(item.source, companyId)
                            const className = 'rounded-full border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-medium text-primary transition hover:bg-primary/10'
                            return url ? (
                              <Link
                                to={url}
                                className={className}
                                title={`اذهب إلى ${item.source} — مصدر هذا البند`}
                              >
                                📍 {item.source} ←
                              </Link>
                            ) : (
                              <span
                                className={className}
                                title="مصدر البند — من أين جاء"
                              >
                                📍 {item.source}
                              </span>
                            )
                          })()}
                          {item.reason && (
                            <span
                              className="rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-emerald-800"
                              title="لماذا هذا مصنّف هنا"
                            >
                              💡 {item.reason}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
                {data[q.key].length === 0 && (
                  <li className="text-xs text-muted-foreground">لا توجد عناصر بعد.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* توليد فردي (متقدّم — مطويّ افتراضياً) — لمن يريد التحكّم بمصدر واحد فقط */}
      <details className="rounded-lg border bg-muted/30 p-2 text-xs" open={showAdvanced}>
        <summary
          className="cursor-pointer font-medium text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.preventDefault(); setShowAdvanced((v) => !v) }}
        >
          ⚙️ خيارات متقدّمة — التوليد من مصدر واحد
        </summary>
        {showAdvanced && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={seedFromDeepAnalysis} disabled={anyBusy || generatingAll}>
              {seedingDeep ? 'جاري…' : '🔬 التحليل العميق فقط'}
            </Button>
            <Button variant="outline" size="sm" onClick={seedFromDeptGap} disabled={anyBusy || generatingAll}>
              {seedingGap ? 'جاري…' : '📐 تحليل الفجوة فقط'}
            </Button>
            <Button variant="outline" size="sm" onClick={seedFromPESTEL} disabled={anyBusy || generatingAll}>
              {seedingPestel ? 'جاري…' : '🌐 PESTEL فقط'}
            </Button>
            <Button variant="outline" size="sm" onClick={seedFromDiagnostic} disabled={anyBusy || generatingAll}>
              {seeding ? 'جاري…' : '🎯 التشخيص العام'}
            </Button>
          </div>
        )}
      </details>

      <div className="flex justify-end">
        <Button onClick={save} disabled={anyBusy || generatingAll} size="lg">
          {saving ? 'جاري الحفظ…' : '💾 حفظ التحليل'}
        </Button>
      </div>
    </>
  )
}
