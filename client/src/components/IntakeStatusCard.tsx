import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { scoreGovernance, type Ypn } from '@/lib/finGovernanceBank'
import { getArtifact } from '@/lib/strategicApi'
import { intakeProtocol } from '@/journey/intakeProtocol'
import type { ClientLevel } from '@/journey/classify'

// ─── ③ بطاقة الاستلام (المدير) — «أنت في حالة X · ابدأ بـY · المدّة Z» ────────
// تقرأ المحور التنظيميّ (GOV_QUANT) وتترجم عبر intakeProtocol النقيّ. المستوى الماليّ
// يأتي محسوبًا من القمرة (classifyClient) فلا اشتقاق ثانٍ هنا.

export function IntakeStatusCard({ companyId, level, size }: { companyId: string; level: ClientLevel; size?: string | null }) {
  const [gov, setGov] = useState<Record<string, Ypn> | null>(null)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const art = await getArtifact<{ answers?: Record<string, Ypn> }>(companyId, 'GOV_QUANT')
        if (!cancel) setGov(art?.data?.answers ?? {})
      } catch { if (!cancel) setGov({}) }
    })()
    return () => { cancel = true }
  }, [companyId])

  // null = لم يُقيَّم (لا إجابات)؛ وإلّا نسبة الحوكمة الكلّيّة.
  const govPct = useMemo(() => {
    if (gov == null || Object.keys(gov).length === 0) return null
    const s = scoreGovernance(gov, { isSmall: size === 'MICRO' || size === 'SMALL' })
    return s.answered > 0 ? s.overallPct : null
  }, [gov, size])

  const p = intakeProtocol(level, govPct)
  const clientQuery = `?client=${companyId}`

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4" dir="rtl">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xl">{p.statusIcon}</span>
        <span className="text-sm font-bold text-primary">بروتوكول الاستلام — أنت في حالة «{p.statusLabel}»</span>
        <span className="ms-auto rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{p.duration}</span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">🎯 المخرج المتوقَّع: <b className="text-foreground">{p.expectedOutput}</b></p>

      <div className="mb-1 text-[11px] font-bold text-muted-foreground">مسار المنتجات المقترح:</div>
      <ol className="mb-3 flex flex-col gap-1">
        {p.productPath.map((step, i) => {
          const clickable = step.available && !!step.path
          return (
            <li key={step.label} className="flex items-center gap-2 text-xs">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {['١', '٢', '٣', '٤', '٥'][i] ?? String(i + 1)}
              </span>
              {/* المتاح المبنيّ = رابط قابل للنقر (الأوّل زرّ «ابدأ هنا»)؛ القادم يبقى نصًّا. */}
              {clickable ? (
                <Link to={`${step.path}${clientQuery}`} className={`hover:underline ${i === 0 ? 'font-bold text-primary' : 'text-foreground'}`}>
                  {step.label}
                </Link>
              ) : (
                <span className={i === 0 ? 'font-bold' : ''}>{step.label}</span>
              )}
              <span className={`text-[10px] ${step.available ? 'text-emerald-600' : 'text-amber-600'}`}>
                {step.available ? '✅ متاح' : '🔜 قادم'}
              </span>
              {i === 0 && clickable && (
                <Link to={`${step.path}${clientQuery}`} className="ms-auto rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm transition hover:opacity-90">
                  ابدأ هنا ←
                </Link>
              )}
            </li>
          )
        })}
      </ol>

      <p className="mb-1 rounded bg-background/60 px-2 py-1 text-[11px] text-muted-foreground">🏛️ {p.orgNote}</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground/80">{p.reason}</p>
    </div>
  )
}
