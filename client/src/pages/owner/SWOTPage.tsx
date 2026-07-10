import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, getSWOT, putSWOT, seedSwotFromDiagnostic, type SWOT } from '@/lib/strategicApi'
import { DEPT_QUESTIONS } from '@/lib/deptQuestions'
import { useAuthStore } from '@/store/authStore'

type Quadrant = 'strengths' | 'weaknesses' | 'opportunities' | 'threats'

interface Data {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
}

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
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const [data, setData] = useState<Data>(EMPTY)
  const [drafts, setDrafts] = useState<Record<Quadrant, string>>({ strengths: '', weaknesses: '', opportunities: '', threats: '' })
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedingPestel, setSeedingPestel] = useState(false)
  const [seedingDeep, setSeedingDeep] = useState(false)
  const [seedingGap, setSeedingGap] = useState(false)

  useEffect(() => {
    getSWOT(companyId).then((s: SWOT) => {
      setData({
        strengths: s.strengths ?? [],
        weaknesses: s.weaknesses ?? [],
        opportunities: s.opportunities ?? [],
        threats: s.threats ?? [],
      })
    }).catch(() => undefined)
  }, [companyId])

  function add(q: Quadrant) {
    const v = drafts[q].trim()
    if (!v) return
    setData((p) => ({ ...p, [q]: [...p[q], v] }))
    setDrafts((p) => ({ ...p, [q]: '' }))
  }
  function remove(q: Quadrant, i: number) {
    setData((p) => ({ ...p, [q]: p[q].filter((_, idx) => idx !== i) }))
  }

  async function save() {
    setSaving(true)
    try {
      await putSWOT(companyId, data)
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
      const fresh = await getSWOT(companyId)
      setData({
        strengths: fresh.strengths ?? [],
        weaknesses: fresh.weaknesses ?? [],
        opportunities: fresh.opportunities ?? [],
        threats: fresh.threats ?? [],
      })
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

  async function seedFromPESTEL() {
    setSeedingPestel(true)
    try {
      const opps: string[] = []
      const thrs: string[] = []
      if (specialty) {
        const deptArt = await getArtifact<Record<string, string>>(companyId, `PESTEL_${specialty}`)
        if (deptArt?.data) {
          for (const axis of ['political', 'economic', 'social', 'technological', 'environmental', 'legal']) {
            const raw = deptArt.data[axis]
            if (typeof raw !== 'string') continue
            for (const line of raw.split('\n').map((s) => s.replace(/^[•\-·]\s*/, '').trim()).filter(Boolean)) {
              const target = classifyLine(axis, line)
              const tagged = `[${axis}] ${line}`
              if (target === 'threat') thrs.push(tagged)
              else opps.push(tagged)
            }
          }
        }
      }
      if (opps.length === 0 && thrs.length === 0) {
        // fallback على PESTEL على مستوى الشركة (owner shape).
        interface F { text: string; impact: number }
        const coArt = await getArtifact<Record<string, F[]>>(companyId, 'PESTEL')
        if (coArt?.data) {
          for (const axis of ['political', 'economic', 'social', 'technological', 'environmental', 'legal']) {
            const arr = coArt.data[axis]
            if (!Array.isArray(arr)) continue
            for (const f of arr) {
              if (!f?.text) continue
              const line = `[${axis}] ${f.text}`
              if (f.impact >= 4) thrs.push(line)
              else opps.push(line)
            }
          }
        }
      }
      if (opps.length === 0 && thrs.length === 0) {
        toast.error('لا PESTEL محفوظ بعد — افتح صفحة PESTEL وأدخل عوامل أوّلاً.')
        return
      }
      // نُدمج مع الموجود بدون تكرار.
      setData((prev) => ({
        ...prev,
        opportunities: uniq([...prev.opportunities, ...opps]),
        threats: uniq([...prev.threats, ...thrs]),
      }))
      toast.success(`أُضيف ${opps.length} فرصة و ${thrs.length} تهديد من PESTEL — راجعها ثم احفظ.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر القراءة من PESTEL'))
    } finally {
      setSeedingPestel(false)
    }
  }

  function uniq(arr: string[]): string[] {
    return Array.from(new Set(arr))
  }

  // ─── ترابط: DEPT_DEEP_FULL → SWOT (S/W) ─────────────────────────
  // يقرأ إجابات التحليل العميق (بنك ٣٣٠ سؤالاً) ويحوّلها إلى نقاط قوة/ضعف
  // بمنطق بسيط:
  //   • radio: الخيار الأول = قوة، الخيار الأخير = ضعف، الوسط = يُتجاهل
  //   • checkbox: فراغ أو "لا يوجد/لا مزايا" = ضعف، عكسه = قوة (تُدرج
  //     العناصر المُختارة كأدلّة).
  //   • textarea: يُتجاهل — نصوص حرّة يصعب تصنيفها.
  // تُدمج مع الموجود بلا تكرار.
  async function seedFromDeepAnalysis() {
    if (!specialty) {
      toast.error('لا تخصّص محدّد — يعمل هذا الزر للمدير المستقل فقط.')
      return
    }
    const bank = DEPT_QUESTIONS[specialty]
    if (!bank) {
      toast.error(`بنك أسئلة ${specialty} غير متوفّر.`)
      return
    }
    setSeedingDeep(true)
    try {
      interface Deep { deptCode: string; answers: Record<string, string | string[]> }
      const art = await getArtifact<Deep>(companyId, 'DEPT_DEEP_FULL')
      if (!art?.data?.answers) {
        toast.error('لا يوجد تحليل عميق محفوظ — افتح /manager/deep-analysis أوّلاً.')
        return
      }
      const answers = art.data.answers
      const strengths: string[] = []
      const weaknesses: string[] = []

      // نُنظّف label السؤال من رموز البداية (📊/📋/إلخ) وعلامة الاستفهام.
      const clean = (label: string) => label
        .replace(/^[^\p{L}]*/u, '').trim()   // احذف emoji وعلامات
        .replace(/؟$/, '').trim()             // احذف علامة استفهام نهائية
      // إشارات نصّية تكشف الجواب السلبي حتى لو أول بالفهرس.
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
          // إشارات نصّية أوّلاً (أدق من الاعتماد على الفهرس فقط).
          if (isNegativeAnswer(a)) {
            weaknesses.push(`${label} — ${a}`)
          } else if (isPositiveAnswer(a)) {
            strengths.push(`${label} — ${a}`)
          } else if (idx === 0 && q.opts.length >= 3) {
            // الافتراضي: أوّل خيار في بنك ٣+ خيارات = الأفضل عادةً.
            strengths.push(`${label} — ${a}`)
          } else if (idx === q.opts.length - 1 && q.opts.length >= 3) {
            weaknesses.push(`${label} — ${a}`)
          }
          // الوسط (idx=1 من 3) يُتجاهل — غير حاسم.
        } else if (q.type === 'checkbox' && Array.isArray(a)) {
          const label = clean(q.label)
          if (a.length === 0) {
            weaknesses.push(`${label} — بلا اختيار`)
            continue
          }
          const hasNegative = a.some(isNegativeAnswer)
          const positives = a.filter((x) => !isNegativeAnswer(x))
          if (hasNegative && positives.length === 0) {
            weaknesses.push(`${label} — ${a.join(' · ')}`)
          } else if (positives.length >= 3) {
            strengths.push(`${label} — ${positives.slice(0, 3).join(' · ')}${positives.length > 3 ? '…' : ''}`)
          }
          // 1-2 إجابات positive: غير حاسم، نُتجاهل لتقليل الضجيج.
        }
      }

      if (strengths.length === 0 && weaknesses.length === 0) {
        toast.error('التحليل موجود لكن لم نستخرج قوى/ضعف — تحقّق من ملء أسئلة radio/checkbox.')
        return
      }

      setData((prev) => ({
        ...prev,
        strengths: uniq([...prev.strengths, ...strengths]),
        weaknesses: uniq([...prev.weaknesses, ...weaknesses]),
      }))
      toast.success(`أُضيف ${strengths.length} قوة و ${weaknesses.length} ضعف من التحليل العميق — راجعها ثم احفظ.`)
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
  async function seedFromDeptGap() {
    if (!specialty) {
      toast.error('لا تخصّص محدّد — يعمل هذا الزر للمدير المستقل فقط.')
      return
    }
    setSeedingGap(true)
    try {
      interface GapItem { name: string; current: number; target: number; action: string }
      interface GapData { gaps: GapItem[] }
      const art = await getArtifact<GapData>(companyId, `GAP_ANALYSIS_${specialty}`)
      if (!art?.data?.gaps || art.data.gaps.length === 0) {
        toast.error('لا فجوات محفوظة — افتح /manager/dept-gap أوّلاً.')
        return
      }
      const strengths: string[] = []
      const weaknesses: string[] = []
      for (const g of art.data.gaps) {
        if (!g.name) continue
        const diff = g.target - g.current
        if (diff >= 30) weaknesses.push(`${g.name} (${g.current}٪ / مستهدف ${g.target}٪ — فجوة كبيرة)`)
        else if (diff >= 15) weaknesses.push(`${g.name} (${g.current}٪ / مستهدف ${g.target}٪ — فجوة متوسطة)`)
        else if (g.current >= g.target && g.target > 0) strengths.push(`${g.name} (${g.current}٪ — يفوق المستهدف)`)
      }
      if (strengths.length === 0 && weaknesses.length === 0) {
        toast.error('الفجوات مسجّلة لكن كلها صغيرة (< 15٪) — لا مخرج قابل للاستخدام.')
        return
      }
      setData((prev) => ({
        ...prev,
        strengths: uniq([...prev.strengths, ...strengths]),
        weaknesses: uniq([...prev.weaknesses, ...weaknesses]),
      }))
      toast.success(`أُضيف ${strengths.length} قوة و ${weaknesses.length} ضعف من تحليل الفجوة — راجعها ثم احفظ.`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر القراءة من تحليل الفجوة'))
    } finally {
      setSeedingGap(false)
    }
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {QUADRANTS.map((q) => (
          <Card key={q.key} className={q.tint}>
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
                {data[q.key].map((item, i) => (
                  <li key={`${item}-${i}`} className="flex items-start gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                    <span className="flex-1 leading-relaxed">{item}</span>
                    <button
                      type="button"
                      onClick={() => remove(q.key, i)}
                      className="text-xs text-muted-foreground transition hover:text-destructive"
                    >
                      حذف
                    </button>
                  </li>
                ))}
                {data[q.key].length === 0 && (
                  <li className="text-xs text-muted-foreground">لا توجد عناصر بعد.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={seedFromDeepAnalysis} disabled={seedingDeep || seedingPestel || seedingGap || seeding || saving}>
          {seedingDeep ? 'جاري القراءة…' : '🔬 استخرج S/W من التحليل العميق'}
        </Button>
        <Button variant="outline" onClick={seedFromDeptGap} disabled={seedingGap || seedingDeep || seedingPestel || seeding || saving}>
          {seedingGap ? 'جاري القراءة…' : '📐 استخرج S/W من تحليل الفجوة'}
        </Button>
        <Button variant="outline" onClick={seedFromPESTEL} disabled={seedingPestel || seedingDeep || seedingGap || seeding || saving}>
          {seedingPestel ? 'جاري القراءة…' : '🌐 استخرج O/T من PESTEL'}
        </Button>
        <Button variant="outline" onClick={seedFromDiagnostic} disabled={seeding || seedingPestel || seedingDeep || seedingGap || saving}>
          {seeding ? 'جاري البذر…' : 'ابنِ من تشخيصي'}
        </Button>
        <Button onClick={save} disabled={saving || seeding || seedingPestel || seedingDeep || seedingGap}>{saving ? 'جاري الحفظ…' : 'حفظ التحليل'}</Button>
      </div>
    </>
  )
}
