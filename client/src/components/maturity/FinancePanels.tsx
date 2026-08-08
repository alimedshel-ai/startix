import { useEffect, useMemo, useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { financeContradictions } from '@/lib/finContradictions'
import { financeAutoAnswers, type AutoAnsweredRow } from '@/lib/finMaturityLayering'
import { type Loan } from '@/lib/finAgingDerive'
import { getArtifact } from '@/lib/strategicApi'

// ─── ح٥: لوحتا FINANCE فوق تقييم النضج — «مُجاب آليًّا» + تحذيرات التناقض ──────
// تُعرَضان فوق MaturityAssessment المُعاد استخدامه (لا عرض موازٍ). تقرآن FIN_QUANT +
// HR_QUANT.financial. لا تمسّان المحرّك ولا الدرجة الحيّة (ق٧/ق٩).

const YPN_AR = { yes: 'نعم', no: 'لا' } as const

export function FinancePanels({ companyId }: { companyId: string }) {
  const [finq, setFinq] = useState<Record<string, number>>({})
  const [loans, setLoans] = useState<Loan[]>([])
  const [annualRevenue, setAnnualRevenue] = useState<number | undefined>()

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const [fin, hr] = await Promise.all([
          getArtifact<{ finq?: Record<string, number>; loans?: Loan[] }>(companyId, 'FIN_QUANT'),
          getArtifact<{ financial?: { annualRevenue?: number } }>(companyId, 'HR_QUANT'),
        ])
        if (cancel) return
        setFinq(fin?.data?.finq ?? {})
        setLoans(fin?.data?.loans ?? [])
        setAnnualRevenue(hr?.data?.financial?.annualRevenue)
      } catch { /* بلا بيانات — لوحتان فارغتان */ }
    })()
    return () => { cancel = true }
  }, [companyId])

  const auto = useMemo<AutoAnsweredRow[]>(() => financeAutoAnswers(finq, loans), [finq, loans])
  const warnings = useMemo(() => financeContradictions(finq, { annualRevenue }), [finq, annualRevenue])

  if (auto.length === 0 && warnings.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {warnings.length > 0 && (
        <Card className="border-2 border-rose-300 bg-rose-50/60" dir="rtl">
          <CardContent className="flex flex-col gap-1 p-3 text-sm text-rose-900">
            <div className="font-bold">🚩 تحذيرات تناقض في الأرقام المُدخَلة (لا تمنع الحفظ)</div>
            {warnings.map((w, i) => <p key={i} className="text-xs">{w}</p>)}
          </CardContent>
        </Card>
      )}
      {auto.length > 0 && (
        <Card className="border-2 border-sky-300 bg-sky-50/50" dir="rtl">
          <CardContent className="flex flex-col gap-1.5 p-3 text-sm">
            <div className="font-bold text-sky-900">🤖 مُجاب آليًّا من أرقامك — لا يُسأل (صحّح إن لزم)</div>
            {auto.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="min-w-0 flex-1">{a.label}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${a.value === 'yes' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {YPN_AR[a.value]} · مُجاب آليًّا
                </span>
                <span className="w-full pr-1 text-[11px] text-muted-foreground">{a.basis}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
