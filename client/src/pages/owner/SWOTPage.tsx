import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, getSWOT, putSWOT, seedSwotFromDiagnostic, type SWOT } from '@/lib/strategicApi'
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
  // يقرأ عوامل PESTEL (dept-scoped أو company) ويوزّعها:
  //   • Factor بأثر ≤ 2  → opportunity (تأثير سلبي منخفض = فرصة اِستغلال)
  //   • Factor بأثر ≥ 4  → threat      (تأثير سلبي عالي)
  //   • Factor أثره 3    → opportunity افتراضاً (يمكن للمستخدم نقلها)
  //   • نصوص خام (dept-pestel) → opportunities افتراضاً — للمراجعة اليدوية.
  // الهدف: كسر عزلة الأدوات. المدير لا يعيد كتابة ما جمعه في PESTEL.
  async function seedFromPESTEL() {
    setSeedingPestel(true)
    try {
      // نُحاول أوّلاً dept-scoped (نصوص طويلة)، ثم company-wide (Factor arrays).
      const opps: string[] = []
      const thrs: string[] = []
      if (specialty) {
        const deptArt = await getArtifact<Record<string, string>>(companyId, `PESTEL_${specialty}`)
        if (deptArt?.data) {
          for (const axis of ['political', 'economic', 'social', 'technological', 'environmental', 'legal']) {
            const raw = deptArt.data[axis]
            if (typeof raw !== 'string') continue
            for (const line of raw.split('\n').map((s) => s.replace(/^[•\-·]\s*/, '').trim()).filter(Boolean)) {
              opps.push(`[${axis}] ${line}`)
            }
          }
        }
      }
      if (opps.length === 0) {
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
        <Button variant="outline" onClick={seedFromPESTEL} disabled={seedingPestel || seeding || saving}>
          {seedingPestel ? 'جاري القراءة…' : '🌐 استخرج من PESTEL'}
        </Button>
        <Button variant="outline" onClick={seedFromDiagnostic} disabled={seeding || seedingPestel || saving}>
          {seeding ? 'جاري البذر…' : 'ابنِ من تشخيصي'}
        </Button>
        <Button onClick={save} disabled={saving || seeding || seedingPestel}>{saving ? 'جاري الحفظ…' : 'حفظ التحليل'}</Button>
      </div>
    </>
  )
}
