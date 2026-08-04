import { useEffect, useMemo, useRef, useState } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import {
  computeHrFinancialImpact,
  type HrIndicators,
} from '@/lib/hrFinancialImpact'
import {
  evalIndicator,
  FINANCIAL_INDICATOR_IDS,
  HR_LEVEL_META,
  HR_QUANT_INDICATORS,
  HR_QUANT_LEVELS,
  levelSummary,
  SAUDIZATION_KPI_ID,
  type QuantActuals,
  type QuantLevel,
} from '@/lib/hrQuantIndicators'
import {
  classifySaudization,
  computeSaudizationCost,
  saudizationAchievementPct,
  type CategoryInput,
  type SaudizationSolution,
} from '@/lib/saudization'
import { SAUDIZATION_LEGAL_NOTE } from '@/lib/saudizationCatalog'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

import { SaudizationSection } from './SaudizationSection'

// نسخة مخطّط قيَم HR_QUANT المحفوظة (قاعدة ٣: schemaVersion إجباريّ من v1).
const HR_QUANT_SCHEMA_VERSION = 1

// ─── التحليل الكمّي لإدارة الموارد البشرية — 31 مؤشراً / 3 مستويات ────────
// يُدخل المدير الأداء الفعليّ فيرى الفجوة + الحالة لكل مؤشّر، وملخّص كل مستوى،
// و§د (الأثر بالريال) كطبقة مشتقّة على المؤشرات الخمسة الماليّة. يُحفظ في
// artifact 'HR_QUANT'. يظهر داخل التحليل العميق (MaturityInApp) لتخصّص HR.

interface HrQuantArtifact {
  schemaVersion?: number
  actuals: QuantActuals
  saudization?: CategoryInput[]
  /** متوسّط راتب غير المحتسبين — أساس ① في محرّك تكلفة التوطين. */
  saudizationAvgLow?: number
  financial?: { headcount?: number; avgMonthlySalary?: number; annualRevenue?: number }
}

const SOLUTION_LABEL: Record<SaudizationSolution, string> = {
  raiseSalaries: 'رفع رواتب غير المحتسبين للحدّ',
  changeProfessions: 'تغيير مهن غير السعوديّين',
  hire: 'توظيف سعوديّين',
}

const sar = (n: number) => `${Math.round(n).toLocaleString('ar-SA')} ريال`

function num(v: string): number | undefined {
  const n = Number(v.replace(/[^\d.-]/g, ''))
  return v.trim() === '' || !isFinite(n) ? undefined : n
}

export function HrQuantitativeSection({
  companyId,
  prefill,
}: {
  companyId: string
  prefill?: { headcount?: number; avgMonthlySalary?: number }
}) {
  const [actuals, setActuals] = useState<QuantActuals>({})
  const [saud, setSaud] = useState<CategoryInput[]>([])
  const [saudLow, setSaudLow] = useState<number | undefined>(undefined)
  const [fin, setFin] = useState<{ headcount?: number; avgMonthlySalary?: number; annualRevenue?: number }>({})
  const [autosave, setAutosave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipFirst = useRef(true)

  // تحميل الأداء الفعليّ المحفوظ + prefill المدخلات الماليّة من opex.
  useEffect(() => {
    let cancel = false
    skipFirst.current = true
    ;(async () => {
      try {
        const art = await getArtifact<HrQuantArtifact>(companyId, 'HR_QUANT')
        if (cancel) return
        setActuals(art?.data?.actuals ?? {})
        setSaud(art?.data?.saudization ?? []) // ترحيل v0→v1: غياب الحقل = قائمة فارغة
        setSaudLow(art?.data?.saudizationAvgLow)
        setFin({
          headcount: art?.data?.financial?.headcount ?? prefill?.headcount,
          avgMonthlySalary: art?.data?.financial?.avgMonthlySalary ?? prefill?.avgMonthlySalary,
          annualRevenue: art?.data?.financial?.annualRevenue,
        })
      } catch { /* بلا artifact سابق — نبدأ فارغاً */ }
    })()
    return () => { cancel = true }
  }, [companyId, prefill?.headcount, prefill?.avgMonthlySalary])

  // حفظ مؤجّل.
  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setAutosave('saving')
      try {
        await upsertArtifact<HrQuantArtifact>(companyId, 'HR_QUANT', {
          schemaVersion: HR_QUANT_SCHEMA_VERSION,
          actuals,
          saudization: saud,
          saudizationAvgLow: saudLow,
          financial: fin,
        })
        setAutosave('saved')
      } catch (err) { setAutosave('error'); void apiErrorMessage(err, '') }
    }, 1000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [actuals, saud, saudLow, fin, companyId])

  function setActual(id: string, v: string) {
    setActuals((prev) => {
      const next = { ...prev }
      const n = num(v)
      if (n == null) delete next[id]
      else next[id] = n
      return next
    })
  }

  // ─── تغذية KPI_STR_04 من وحدة التوطين (لا DRV_* يوازيه — نحوّله محسوباً) ──
  // إن وُجدت فئات توطين منطبقة، تُشتقّ نسبة السعودة وتُقفَل خانة KPI_STR_04
  // (تُعرَض للقراءة). بلا مدخلات توطين، يبقى المؤشّر يدويّاً كسابق عهده.
  const derivedSaudization = useMemo(() => {
    if (saud.length === 0) return null
    return saudizationAchievementPct(classifySaudization(saud))
  }, [saud])

  const mergedActuals = useMemo<QuantActuals>(
    () => (derivedSaudization == null ? actuals : { ...actuals, [SAUDIZATION_KPI_ID]: derivedSaudization }),
    [actuals, derivedSaudization],
  )
  const lockedIds = useMemo(
    () => (derivedSaudization == null ? new Set<string>() : new Set([SAUDIZATION_KPI_ID])),
    [derivedSaudization],
  )

  // §د السادس: تكلفة الحلّ الأوفر للتوطين (محرّك التكلفة). يحتاج متوسّط راتب غير
  // المحتسبين (①). يظهر فقط حين توجد فئات توطين ذات فجوة وتكلفة موجبة.
  const saudCost = useMemo(
    () => (saud.length === 0 ? null : computeSaudizationCost(saud, saudLow ?? 0)),
    [saud, saudLow],
  )

  // ─── طبقة §د: الأثر بالريال من المؤشرات الخمسة الماليّة ──────────
  const impact = useMemo(() => {
    const targetOf = (id: string) => HR_QUANT_INDICATORS.find((i) => i.id === id)!.target
    const rate = (id: string): { current: number; target: number } | undefined => {
      const c = actuals[id]
      return c == null ? undefined : { current: c, target: targetOf(id) }
    }
    const ind: HrIndicators = {
      turnoverPct: rate(FINANCIAL_INDICATOR_IDS.turnover),
      absencePct: rate(FINANCIAL_INDICATOR_IDS.absence),
      vacancyPct: rate(FINANCIAL_INDICATOR_IDS.vacancy),
      enpsPoints: rate(FINANCIAL_INDICATOR_IDS.enps),
      hrCostPct: rate(FINANCIAL_INDICATOR_IDS.hrCost),
    }
    if (!fin.headcount || !fin.avgMonthlySalary || !fin.annualRevenue) return null
    return computeHrFinancialImpact(
      { headcount: fin.headcount, avgMonthlySalary: fin.avgMonthlySalary, annualRevenue: fin.annualRevenue },
      ind,
    )
  }, [actuals, fin])

  // ق٧ — توريث تحذير الراتب (ق٢) للمشتقّات: راتبٌ خارج النطاق يُنتج أثراً «صحيح
  // الحساب عبثيّ المعنى». المشتقّات المبنيّة عليه (التسرّب · eNPS) تحمل التنبيه معها.
  const salaryFlagged = fin.avgMonthlySalary != null &&
    (fin.avgMonthlySalary > 50000 || (fin.avgMonthlySalary > 0 && fin.avgMonthlySalary < 1000))

  return (
    <Card className="border-2 border-sky-300 bg-sky-50/30" dir="rtl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sky-900">📊 التحليل الكمّي — مؤشرات الإدارة (31 مؤشراً)</CardTitle>
          <span className="text-xs text-muted-foreground">
            {autosave === 'saving' ? '⏳ حفظ…' : autosave === 'saved' ? '✓ محفوظ' : autosave === 'error' ? '⚠️ فشل الحفظ' : ''}
          </span>
        </div>
        <CardDescription>
          أدخل الأداء الفعليّ لكل مؤشّر وشاهد الفجوة والحالة تلقائياً — بكل أنواع الأرقام (٪ · عدد · يوم · ساعة · درجة · ريال).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {HR_QUANT_LEVELS.map((level) => (
          <LevelGroup key={level} level={level} actuals={mergedActuals} lockedIds={lockedIds} onSet={setActual} />
        ))}

        {/* ─── وحدة التوطين — تُغذّي KPI_STR_04 أعلاه ─── */}
        <SaudizationSection inputs={saud} onChange={setSaud} />

        {/* ─── طبقة §د: الأثر المالي بالريال ─── */}
        <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-4">
          <div className="mb-2 text-sm font-bold text-amber-900">💰 الأثر المالي (§د) — من المؤشرات إلى الريال</div>
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <FinInput label="عدد الموظفين" value={fin.headcount} onChange={(n) => setFin((f) => ({ ...f, headcount: n }))} />
            <FinInput label="متوسط الراتب الشهري (ريال)" value={fin.avgMonthlySalary} onChange={(n) => setFin((f) => ({ ...f, avgMonthlySalary: n }))} />
            <FinInput label="الإيراد السنوي (ريال)" value={fin.annualRevenue} onChange={(n) => setFin((f) => ({ ...f, annualRevenue: n }))} />
          </div>
          {/* ق٢ — حارس نطاق الراتب ثنائي الاتجاه (تنبيه غير مانع): سنويّ حُفِظ
              كشهريّ (>٥٠٬٠٠٠ → §د منتفخة) أو خطأ وحدة (<١٬٠٠٠ → §د أقلّ بألف). */}
          {fin.avgMonthlySalary != null && fin.avgMonthlySalary > 50000 && (
            <p className="mb-2 text-xs font-medium text-rose-700">⚠️ متوسّط راتب شهريّ مرتفع جدّاً ({fin.avgMonthlySalary.toLocaleString('ar-SA')} ريال) — هل أدخلتَ السنويّ؟ اقسِمه على ١٢. (لا يمنع الحساب.)</p>
          )}
          {fin.avgMonthlySalary != null && fin.avgMonthlySalary > 0 && fin.avgMonthlySalary < 1000 && (
            <p className="mb-2 text-xs font-medium text-rose-700">⚠️ متوسّط راتب منخفض جدّاً ({fin.avgMonthlySalary}) — تحقّق من الوحدة (بالريال لا بالآلاف). (لا يمنع الحساب.)</p>
          )}
          {!impact ? (
            <p className="text-xs text-amber-800/80">أدخل عدد الموظفين + الراتب + الإيراد، وقيَم التسرب/الغياب/الشغور/eNPS/تكلفة HR أعلاه — ليُحسب الأثر بالريال.</p>
          ) : (
            <div className="flex flex-col gap-1 text-sm">
              {salaryFlagged && (
                <p className="mb-1 rounded bg-rose-100/70 px-2 py-1 text-xs font-medium text-rose-800">⚠️ المصدر (متوسّط الراتب) محلّ تنبيه أعلاه — المشتقّات المبنيّة عليه (التسرّب · eNPS) قد تكون منتفخة/منكمشة. صحّح الراتب ليصحّ الأثر.</p>
              )}
              <ImpactRow label={`توفير خفض التسرب للهدف${salaryFlagged ? ' ⚠️ مصدر محلّ تنبيه' : ''}`} v={impact.turnover.annualImpactSAR} />
              <ImpactRow label="توفير خفض الغياب للهدف" v={impact.absence.annualImpactSAR} />
              <ImpactRow label="توفير خفض الشغور للهدف" v={impact.vacancy.annualImpactSAR} />
              <ImpactRow label={`أثر رفع eNPS (مؤشّر مسبق — غير محسوب بالإجمالي)${salaryFlagged ? ' ⚠️' : ''}`} v={impact.enps.annualImpactSAR} muted />
              <ImpactRow label="توفير خفض تكلفة HR للهدف" v={impact.hrCost.annualImpactSAR} />
              <div className="mt-1 flex items-center justify-between border-t border-amber-300 pt-1 font-bold text-amber-900">
                <span>إجمالي التوفير المحتمل / سنة</span>
                <span>{sar(impact.totalSavingSAR)} · {impact.totalAsPctOfRevenue}٪ من الإيراد</span>
              </div>
            </div>
          )}

          {/* §د السادس — تكلفة الحلّ الأوفر للتوطين (محرّك التكلفة، لا يعتمد على المؤشرات الخمسة) */}
          {saud.length > 0 && (
            <div className="mt-3 border-t border-amber-300 pt-3">
              <div className="mb-2 max-w-xs">
                <FinInput label="متوسط راتب غير المحتسبين — أساس ① (ريال)" value={saudLow} onChange={setSaudLow} />
              </div>
              {saudCost && saudCost.bestCost > 0 ? (
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span>💡 تكلفة الحلّ الأوفر للتوطين — {SOLUTION_LABEL[saudCost.bestSolution]}</span>
                    <span className="tabular-nums">{sar(saudCost.bestCost)}</span>
                  </div>
                  <p className="text-xs text-amber-800/80">
                    البدائل/سنة: رفع الرواتب {sar(saudCost.raiseSalaries)} · تغيير المهن {sar(saudCost.changeProfessions)} · التوظيف {sar(saudCost.hire)}.
                  </p>
                  {saudCost.restrictedSequence && (
                    <p className="rounded bg-rose-100/70 px-2 py-1 text-xs font-medium text-rose-800">⚠️ فئة مقصورة ١٠٠٪ — التوظيف جزءٌ من تسلسل إلزاميّ (توظيف ثمّ تغيير مهنة) لا بديلٌ مستقلّ.</p>
                  )}
                  <p className="text-[11px] leading-relaxed text-amber-900/70">{SAUDIZATION_LEGAL_NOTE}</p>
                </div>
              ) : (
                <p className="text-xs text-amber-800/80">أدخل متوسط راتب غير المحتسبين لحساب تكلفة الحلّ الأوفر (①) وإظهار البدائل الثلاثة.</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function LevelGroup({ level, actuals, lockedIds, onSet }: { level: QuantLevel; actuals: QuantActuals; lockedIds: Set<string>; onSet: (id: string, v: string) => void }) {
  const meta = HR_LEVEL_META[level]
  const inds = HR_QUANT_INDICATORS.filter((i) => i.level === level)
  const s = levelSummary(level, actuals)
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold">{meta.icon} {meta.labelAr} <span className="text-xs font-normal text-muted-foreground">({meta.freqAr})</span></span>
        <span className="text-xs text-muted-foreground">
          {s.entered ? `${s.ok}/${s.entered} ضمن الهدف · تحقيق ${s.achievedPct}٪` : `${s.total} مؤشّر — لم يُدخَل بعد`}
        </span>
      </div>
      <div className="flex flex-col divide-y">
        {inds.map((ind) => {
          const e = evalIndicator(ind, actuals[ind.id])
          const badge = e.status === 'ok' ? '✅' : e.status === 'off' ? '🔴' : '⬜'
          const locked = lockedIds.has(ind.id)
          return (
            <div key={ind.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="w-5 shrink-0 text-center">{badge}</span>
              <span className="min-w-0 flex-1 truncate" title={ind.name}>
                {locked && <span title="محسوب من وحدة التوطين">🔗 </span>}{ind.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">الهدف {ind.target}{ind.unit === '%' ? '٪' : ` ${ind.unit}`}</span>
              <Input
                type="number"
                inputMode="decimal"
                className="h-8 w-20 shrink-0 text-center"
                placeholder="الفعليّ"
                value={actuals[ind.id] ?? ''}
                disabled={locked}
                title={locked ? 'محسوب تلقائياً من وحدة التوطين أدناه' : undefined}
                onChange={(ev) => onSet(ind.id, ev.target.value)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FinInput({ label, value, onChange }: { label: string; value?: number; onChange: (n: number | undefined) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-amber-900">
      {label}
      <Input
        type="number"
        inputMode="decimal"
        className="h-8"
        value={value ?? ''}
        onChange={(e) => { const n = num(e.target.value); onChange(n) }}
      />
    </label>
  )
}

function ImpactRow({ label, v, muted }: { label: string; v: number; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${muted ? 'text-muted-foreground' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{sar(v)}</span>
    </div>
  )
}
