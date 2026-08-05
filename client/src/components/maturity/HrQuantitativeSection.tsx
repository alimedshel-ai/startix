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
  isVisibleForSize,
  levelSummary,
  SAUDIZATION_KPI_ID,
  type QuantActuals,
  type QuantLevel,
} from '@/lib/hrQuantIndicators'
import {
  computeSaudizationCost,
  saudizationActualRatio,
  type CategoryInput,
  type SaudizationSolution,
} from '@/lib/saudization'
import { deriveQuantActual, QUANT_CROSSOVER } from '@/lib/hrQuantDerive'
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
  /** المدخلات العدديّة (HRQ_*) — «الأرقام تُدخَل والنِّسَب تُشتقّ» (جدول العبور v3.3). */
  counts?: Record<string, number>
  saudization?: CategoryInput[]
  /** متوسّط راتب غير المحتسبين — أساس ① في محرّك تكلفة التوطين. */
  saudizationAvgLow?: number
  financial?: { headcount?: number; avgMonthlySalary?: number; annualRevenue?: number; workDays?: number }
}

// تسميات مختصرة للعدّادات المُدخَلة (HRQ_*) — تُعرَض على خانة العدد.
const HRQ_LABEL: Record<string, string> = {
  HRQ_HR_COST_YEAR: 'تكلفة الموارد/سنة (ريال)', HRQ_LEAVERS_12M: 'المغادرون (١٢ش)',
  HRQ_TOTAL_EXP_YEARS: 'مجموع سنوات الخبرة', HRQ_RISKS_OPEN: 'مخاطر مفتوحة', HRQ_RISKS_TOTAL: 'مخاطر إجماليّة',
  HRQ_HIRE_DAYS_SUM: 'مجموع أيام التعيين', HRQ_HIRES_COUNT: 'عدد التعيينات',
  HRQ_VACANT: 'وظائف شاغرة', HRQ_APPROVED_HEADCOUNT: 'وظائف معتمدة',
  HRQ_HIRING_SPENT: 'مصروف التوظيف', HRQ_HIRING_BUDGET: 'ميزانية التوظيف',
  HRQ_APPRAISED_Q: 'مُقيَّمون (ربع)', HRQ_KPI_MET: 'محقّقو الأهداف',
  HRQ_TRAINING_HOURS_M: 'ساعات تدريب/شهر', HRQ_PLANS_DONE: 'خطط مكتملة', HRQ_PLANS_TOTAL: 'خطط معتمدة',
  HRQ_PAYROLL_ONTIME: 'رواتب بموعدها', HRQ_PAYROLL_TOTAL: 'إجمالي المسيّرات',
  HRQ_ABSENCE_DAYS_M: 'أيام غياب/شهر', HRQ_LATE_CASES_M: 'حالات تأخّر/شهر', HRQ_PRESENT_TODAY: 'حاضرون اليوم',
  HRQ_TRAINING_COST: 'تكلفة التدريب (ريال)', HRQ_TRAINING_RETURN: 'عائد التدريب (ريال)',
}

// ت٥ — مؤشّرات «إدخال خارجيّ» (يدويّة بمصدرٍ خارج النظام) — تُوسَم بمبرّرها الظاهر.
const EXTERNAL_MANUAL: Record<string, string> = {
  KPI_STR_08: 'استبيان eNPS خارجيّ',
  KPI_TAC_09: 'مقارنة رواتب السوق',
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
  size,
}: {
  companyId: string
  prefill?: { headcount?: number; avgMonthlySalary?: number }
  /** ت٣ — حجم المنشأة (company.size) لترشيح عرض البنك. غيابه = البنك الكامل. */
  size?: string | null
}) {
  const [actuals, setActuals] = useState<QuantActuals>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [saud, setSaud] = useState<CategoryInput[]>([])
  const [saudLow, setSaudLow] = useState<number | undefined>(undefined)
  const [fin, setFin] = useState<{ headcount?: number; avgMonthlySalary?: number; annualRevenue?: number; workDays?: number }>({})
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
        setCounts(art?.data?.counts ?? {}) // العدّادات HRQ_* — تُشتقّ منها النِّسَب
        setSaud(art?.data?.saudization ?? []) // ترحيل v0→v1: غياب الحقل = قائمة فارغة
        setSaudLow(art?.data?.saudizationAvgLow)
        setFin({
          headcount: art?.data?.financial?.headcount ?? prefill?.headcount,
          avgMonthlySalary: art?.data?.financial?.avgMonthlySalary ?? prefill?.avgMonthlySalary,
          annualRevenue: art?.data?.financial?.annualRevenue,
          workDays: art?.data?.financial?.workDays,
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
          counts,
          saudization: saud,
          saudizationAvgLow: saudLow,
          financial: fin,
        })
        setAutosave('saved')
      } catch (err) { setAutosave('error'); void apiErrorMessage(err, '') }
    }, 1000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [actuals, counts, saud, saudLow, fin, companyId])

  function setActual(id: string, v: string) {
    setActuals((prev) => {
      const next = { ...prev }
      const n = num(v)
      if (n == null) delete next[id]
      else next[id] = n
      return next
    })
  }

  function setCount(key: string, v: string) {
    setCounts((prev) => {
      const next = { ...prev }
      const n = num(v)
      if (n == null) delete next[key]
      else next[key] = n
      return next
    })
  }

  // ─── تغذية KPI_STR_04 من وحدة التوطين (لا DRV_* يوازيه — نحوّله محسوباً) ──
  // ت١ — النسبة الفعليّة (سعوديّون÷الإجمالي) تُقترَح لـKPI_STR_04 فوق خانةٍ مفتوحة.
  // بلا مدخلات توطين منطبقة، لا اقتراح (null) — ويبقى الإدخال اليدويّ.
  const derivedSaudization = useMemo(() => {
    if (saud.length === 0) return null
    return saudizationActualRatio(saud)
  }, [saud])

  // ─── الاشتقاق العدديّ (جدول العبور v3.3): «الأرقام تُدخَل والنِّسَب تُشتقّ» ──
  // العدّادات HRQ_* + الأرقام الأساسيّة FND_* تُغذّي deriveQuantActual لكل مؤشّرٍ
  // count/derived؛ الناتج نسبةٌ محسوبةٌ تُقفَل خانتها (كنمط السعودة). المؤشّرات
  // manual/raw تبقى بإدخال النسبة المباشر. actuals تُمرَّر أيضاً كوقودٍ خامّ
  // لـSTR_05 (الامتثال يُشتقّ من عدّادات OPR الخام).
  const inputs = useMemo<Record<string, number>>(() => {
    const base: Record<string, number> = { ...counts }
    if (fin.headcount != null) base.FND_HEADCOUNT = fin.headcount
    if (fin.annualRevenue != null) base.FND_ANNUAL_REVENUE = fin.annualRevenue
    if (fin.avgMonthlySalary != null) base.FND_AVG_SALARY = fin.avgMonthlySalary
    base.FND_WORK_DAYS = fin.workDays ?? 22
    // ت٢ — تقدير مبدئيّ لتكلفة الموارد السنويّة = عدد × راتب × ١٢، إن لم يُدخِلها
    // المستخدم عدّاً؛ فيُقترَح STR_01 تلقائياً، والعدّ اليدويّ يتجاوزه (قابل للتعديل).
    if (base.HRQ_HR_COST_YEAR == null && fin.headcount != null && fin.avgMonthlySalary != null) {
      base.HRQ_HR_COST_YEAR = fin.headcount * fin.avgMonthlySalary * 12
    }
    for (const [k, v] of Object.entries(actuals)) if (v != null) base[k] = v
    return base
  }, [counts, fin, actuals])

  // ت٢ — تلميح «مقدّر» يُعرَض placeholder على خانة عدّ تكلفة الموارد (قابل للتعديل لا مقفول).
  const countHints = useMemo<Record<string, number>>(() => {
    const h: Record<string, number> = {}
    if (fin.headcount != null && fin.avgMonthlySalary != null) {
      h.HRQ_HR_COST_YEAR = fin.headcount * fin.avgMonthlySalary * 12
    }
    return h
  }, [fin.headcount, fin.avgMonthlySalary])

  const derivedActuals = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const ind of HR_QUANT_INDICATORS) {
      const v = deriveQuantActual(ind.id, inputs) // null لـmanual/raw/catalog
      if (v != null) out[ind.id] = v
    }
    return out
  }, [inputs])

  // ت١ — الاقتراحات المحسوبة (count/derived + السعودة catalog). تُعرَض **فوق خانةٍ
  // مفتوحة**، لا تُقفِلها: «الأرقام تُدخَل، النِّسَب تُقترَح، والخبير يتجاوز».
  const suggestions = useMemo<Record<string, number>>(() => {
    const s: Record<string, number> = { ...derivedActuals }
    if (derivedSaudization != null) s[SAUDIZATION_KPI_ID] = derivedSaudization
    return s
  }, [derivedActuals, derivedSaudization])

  // القيمة الفعّالة للتقييم: اليدويّ **يتجاوز** الاقتراح (لا العكس) — فالتعديل يثبت.
  const mergedActuals = useMemo<QuantActuals>(
    () => ({ ...suggestions, ...actuals }),
    [suggestions, actuals],
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
          <LevelGroup key={level} level={level} effective={mergedActuals} manual={actuals} suggestions={suggestions} onSet={setActual} counts={counts} onSetCount={setCount} countHints={countHints} size={size} />
        ))}

        {/* ─── وحدة التوطين — تُغذّي KPI_STR_04 أعلاه ─── */}
        <SaudizationSection inputs={saud} onChange={setSaud} />

        {/* ─── طبقة §د: الأثر المالي بالريال ─── */}
        <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-4">
          <div className="mb-2 text-sm font-bold text-amber-900">💰 الأثر المالي (§د) — من المؤشرات إلى الريال</div>
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <FinInput label="عدد الموظفين" value={fin.headcount} onChange={(n) => setFin((f) => ({ ...f, headcount: n }))} />
            <FinInput label="متوسط الراتب الشهري (ريال)" value={fin.avgMonthlySalary} onChange={(n) => setFin((f) => ({ ...f, avgMonthlySalary: n }))} />
            <FinInput label="الإيراد السنوي (ريال)" value={fin.annualRevenue} onChange={(n) => setFin((f) => ({ ...f, annualRevenue: n }))} />
            <FinInput label="أيام العمل/شهر (افتراضي ٢٢)" value={fin.workDays} onChange={(n) => setFin((f) => ({ ...f, workDays: n }))} />
          </div>
          <p className="-mt-2 mb-3 text-[11px] text-amber-800/70">هذه الأرقام الأساسيّة تُغذّي النِّسَب المحسوبة (🔗) في المؤشرات أعلاه — عدد الموظفين مقامٌ لأغلبها.</p>
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

function LevelGroup({ level, effective, manual, suggestions, onSet, counts, onSetCount, countHints, size }: { level: QuantLevel; effective: QuantActuals; manual: QuantActuals; suggestions: Record<string, number>; onSet: (id: string, v: string) => void; counts: Record<string, number>; onSetCount: (key: string, v: string) => void; countHints: Record<string, number>; size?: string | null }) {
  const meta = HR_LEVEL_META[level]
  // ت٣ — البنك المُقدَّم للحجم (ترشيح عرض؛ الأساس والتوطين خارجه بطبيعتهما).
  const inds = HR_QUANT_INDICATORS.filter((i) => i.level === level && isVisibleForSize(i, size))
  const s = levelSummary(level, effective, size)
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
          const e = evalIndicator(ind, effective[ind.id])
          const badge = e.status === 'ok' ? '✅' : e.status === 'off' ? '🔴' : '⬜'
          const spec = QUANT_CROSSOVER[ind.id]
          // العدّادات التي يُدخلها المستخدم لهذا المؤشّر (HRQ_* في البسط/المقام).
          const countKeys = spec && spec.inputKind === 'count'
            ? [spec.numerator, spec.denominator].filter((k): k is string => !!k && k.startsWith('HRQ_'))
            : []
          // اقتراحٌ محسوب (إن اكتملت مصادره) — فوق خانةٍ مفتوحة، لا يُقفِلها.
          const suggestion = suggestions[ind.id]
          const hasSug = suggestion != null
          const overridden = hasSug && manual[ind.id] != null
          const unitSuffix = ind.unit === '%' ? '٪' : ` ${ind.unit}`
          const externalReason = spec && spec.inputKind === 'manual' ? EXTERNAL_MANUAL[ind.id] : undefined
          return (
            <div key={ind.id} className="flex flex-col gap-1 py-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center">{badge}</span>
                <span className="min-w-0 flex-1 truncate" title={ind.name}>
                  {hasSug && <span title="مقترَح محسوب — قابل للتعديل">💡 </span>}{ind.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">الهدف {ind.target}{unitSuffix}</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  className="h-8 w-20 shrink-0 text-center"
                  placeholder={hasSug ? `مقترَح ${suggestion}` : 'الفعليّ'}
                  value={manual[ind.id] ?? ''}
                  onChange={(ev) => onSet(ind.id, ev.target.value)}
                />
              </div>
              {hasSug && (
                <div className="pr-7 text-[11px] text-sky-700">
                  💡 مقترَح محسوب: <b>{suggestion}{unitSuffix}</b>
                  {overridden ? ' — تجاوزٌ يدويّ مُثبَت' : ' — اكتب رقماً لتتجاوزه'}
                </div>
              )}
              {externalReason && (
                <div className="pr-7 text-[11px] text-violet-700">📋 إدخال خارجيّ — {externalReason}</div>
              )}
              {countKeys.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pr-7">
                  {countKeys.map((key) => (
                    <label key={key} className="flex items-center gap-1 text-xs text-muted-foreground">
                      {HRQ_LABEL[key] ?? key}
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="h-7 w-28 text-center"
                        placeholder={countHints[key] != null ? `مقدّر ${countHints[key].toLocaleString('ar-SA')}` : 'عدد'}
                        value={counts[key] ?? ''}
                        onChange={(ev) => onSetCount(key, ev.target.value)}
                      />
                    </label>
                  ))}
                </div>
              )}
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
