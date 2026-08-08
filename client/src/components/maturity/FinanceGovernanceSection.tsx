import { useEffect, useMemo, useRef, useState } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { GOVERNANCE_BANK, scoreGovernance, type Ypn } from '@/lib/finGovernanceBank'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

const GOV_SCHEMA_VERSION = 1

// ─── ح٦: بنك الحوكمة التنظيميّة للإدارة المالية (٢٥ سؤالًا، ورقة ٨) ────────────
// يقيس «كيف الإدارة منظّمة» (تنظيم/حوكمة) لا «هل الممارسة تُمارَس» (الـ١٠٠). بنك
// مستقل — يكتب أرتيفاكت GOV_QUANT. لا يمسّ المحرّك الحيّ (ق٧/ق٩). ق١٠: أسئلة
// sizeML لا تظهر للشركة الصغيرة ولا تُنقص درجتها.

interface GovArtifact {
  schemaVersion?: number
  answers: Record<string, Ypn>
}

const YPN_LABEL: { v: Ypn; label: string }[] = [
  { v: 'yes', label: 'نعم' },
  { v: 'partial', label: 'جزئياً' },
  { v: 'no', label: 'لا' },
]

const badge = (pct: number) =>
  pct >= 80 ? '🟢' : pct >= 60 ? '🟡' : pct >= 40 ? '🟠' : pct > 0 ? '🔴' : '⚪'

export function FinanceGovernanceSection({ companyId, size }: { companyId: string; size?: string | null }) {
  const [answers, setAnswers] = useState<Record<string, Ypn>>({})
  const [autosave, setAutosave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipFirst = useRef(true)

  const isSmall = size === 'MICRO' || size === 'SMALL'

  useEffect(() => {
    let cancel = false
    skipFirst.current = true
    ;(async () => {
      try {
        const art = await getArtifact<GovArtifact>(companyId, 'GOV_QUANT')
        if (!cancel) setAnswers(art?.data?.answers ?? {})
      } catch { /* بلا artifact سابق */ }
    })()
    return () => { cancel = true }
  }, [companyId])

  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setAutosave('saving')
      try {
        await upsertArtifact<GovArtifact>(companyId, 'GOV_QUANT', { schemaVersion: GOV_SCHEMA_VERSION, answers })
        setAutosave('saved')
      } catch (err) { setAutosave('error'); void apiErrorMessage(err, '') }
    }, 1000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [answers, companyId])

  const score = useMemo(() => scoreGovernance(answers, { isSmall }), [answers, isSmall])

  function setAnswer(id: string, v: Ypn) {
    setAnswers((prev) => ({ ...prev, [id]: v }))
  }

  return (
    <Card className="border-2 border-violet-300 bg-violet-50/30" dir="rtl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-violet-900">🏛️ التنظيم الإداري والحوكمة المالية — {GOVERNANCE_BANK.length}×5</CardTitle>
          <span className="text-xs text-muted-foreground">
            {autosave === 'saving' ? '⏳ حفظ…' : autosave === 'saved' ? '✓ محفوظ' : autosave === 'error' ? '⚠️ فشل الحفظ' : ''}
          </span>
        </div>
        <CardDescription>
          يقيس <b>كيف الإدارة منظّمة</b> (من يقرّر · من يراجع · كيف تسير الإجراءات) — بنك مستقلّ عن تقييم النضج. {badge(score.overallPct)} {score.overallPct}٪ · أجبت {score.answered}/{score.applicable}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {GOVERNANCE_BANK.map((g) => {
          const qs = g.questions.filter((q) => !(isSmall && q.sizeML))
          return (
            <div key={g.key} className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold">{g.icon} {g.label}</span>
                <span className="text-xs text-muted-foreground">{badge(score.byGroup[g.key] ?? 0)} {score.byGroup[g.key] ?? 0}٪</span>
              </div>
              <div className="flex flex-col divide-y">
                {qs.map((q) => (
                  <div key={q.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                    <span className="min-w-0 flex-1">{q.text}{q.sizeML && <span className="mr-1 text-[10px] text-muted-foreground"> [م/ك]</span>}</span>
                    <div className="flex shrink-0 gap-1">
                      {YPN_LABEL.map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => setAnswer(q.id, o.v)}
                          className={`rounded-md border px-2 py-0.5 text-xs transition ${
                            answers[q.id] === o.v
                              ? 'border-violet-500 bg-violet-500 text-white'
                              : 'border-border bg-card text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
