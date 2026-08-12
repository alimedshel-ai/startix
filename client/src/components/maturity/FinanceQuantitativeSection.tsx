import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { Cashflow13wSection } from '@/components/maturity/Cashflow13wSection'
import { CostCenterSection } from '@/components/maturity/CostCenterSection'
import { deriveArAging, sumLoans, toLatinDigits, type Loan } from '@/lib/finAgingDerive'
import { computeFinancialHealth, type FinancialKpis } from '@/lib/financialHealth'
import { UnitEconomicsSection } from '@/components/maturity/UnitEconomicsSection'
import { deriveAggregatesIntoFinq, monthlyOpex as costItemsMonthlyOpex, type CostItem } from '@/lib/finCostCenter'
import { type Product } from '@/lib/finUnitEconomics'
import { accountingGuards } from '@/lib/finAccountingGuards'
import { breakEven, deriveFinancialKpis, type BreakEven } from '@/lib/finQuantDerive'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

// نسخة مخطّط FIN_QUANT — ت٣أ٢ رقّاها ١←٢ (تغيير هيكليّ: شرائح أعمار + loans[]).
const FIN_QUANT_SCHEMA_VERSION = 2

// ─── التحليل الكمّي المالي (docs/FIN_QUANT_CROSSOVER.md §ت٣أ٢) ──────────────────
// «التفاصيل تُشتق منها الإجماليات»: الذمم بشرائح أعمار (٤×عدد/قيمة) → FINQ_AR + المتأخر،
// والقروض قائمةً (loans[]) → FINQ_DEBT + FINQ_INST. الاشتقاق يُحسب هنا؛ finQuantDerive
// والمحرّك والحارس لا تتغيّر (تقرأ الإجماليات كما هي). المصدر الواحد (§أ): مؤشّرا التداخل
// يُقرآن من HR. v1: عرض/تتبّع فقط — لا يدخل healthPct الحيّ. الرواتب خارج النطاق كليًّا.

interface FinQuantArtifact {
  schemaVersion?: number
  /** حقول FINQ_* (تشمل شرائح الأعمار FINQ_AR_Bx_N/V + الإجماليات المشتقّة المخزّنة). */
  finq: Record<string, number>
  /** ت٣أ٢ — القروض حقلٌ منفصل (متغيّر العدد؛ لا يُفلطح مفاتيحَ شبح). */
  loans?: Loan[]
  /** المخرج ٤ — بنود مركز التكاليف (قرار ٢: تسود على المجمّع عند وجودها). */
  costItems?: CostItem[]
  /** المخرج ٥ — اقتصاديات الوحدة (هامش كلّ منتج/خدمة؛ توافق خلفيّ: يأتي غائبًا في v1). */
  products?: Product[]
}

interface SharedFinancial {
  headcount?: number
  avgMonthlySalary?: number
  annualRevenue?: number
  workDays?: number
}
interface HrQuantArtifactShape {
  schemaVersion?: number
  financial?: SharedFinancial
  [k: string]: unknown
}

// شرائح أعمار الذمم الأربع.
const AR_BUCKET_META = [
  { b: 'B1', label: '0–30 يوم' },
  { b: 'B2', label: '31–60 يوم' },
  { b: 'B3', label: '61–90 يوم ⚠️' },
  { b: 'B4', label: '+90 يوم ⚠️' },
] as const

// الحقول المسطّحة المتبقّية (الذمم والديون صارتا تفصيليّتين أعلاه).
const FLAT_GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  { title: '💧 سيولة وتحصيل أخرى', items: [
    { key: 'FND_CASH', label: 'النقد المتاح الآن (بنك + صندوق)' },
    { key: 'FINQ_CURR_LIAB', label: 'الخصوم المتداولة' },
    { key: 'FINQ_CURR_ASSET', label: 'الأصول المتداولة' },
    { key: 'FINQ_AR_COLLECTED', label: 'المُحصَّل من الذمم (الفترة)' },
    { key: 'FINQ_AR_TARGET', label: 'هدف الذمم (قطاعي)' },
  ] },
  { title: '🏦 الملاءة والربحيّة', items: [
    { key: 'FINQ_EQUITY', label: 'حقوق الملكية' },
    { key: 'FINQ_TOTAL_ASSETS', label: 'إجمالي الأصول' },
    { key: 'FINQ_NET_PROFIT', label: 'صافي الربح (آخر 12 شهرًا)' },
    { key: 'FINQ_GROSS_PROFIT', label: 'مجمل الربح (آخر 12 شهرًا)' },
    { key: 'FND_MAT', label: 'تكلفة المواد/المشتريات الشهرية' },
  ] },
  { title: '⚖️ نقطة التعادل', items: [
    { key: 'FINQ_FIXED_COSTS', label: 'التكاليف الثابتة الشهرية' },
    { key: 'FINQ_VAR_COST_UNIT', label: 'التكلفة المتغيّرة للوحدة' },
    { key: 'FINQ_PRICE_UNIT', label: 'سعر بيع الوحدة' },
  ] },
  { title: '📌 تتبّع (بلا حكم — §د)', items: [
    { key: 'FINQ_MKT', label: 'الإنفاق التسويقي الشهري' },
    { key: 'FINQ_GOV', label: 'التزامات حكوميّة مستحقّة (زكاة وضريبة + تأمينات + رسوم وإقامات وبلدية)' },
    { key: 'FINQ_STOCK_V', label: 'قيمة المخزون الآن' },
    { key: 'FINQ_OWNER_DRAW', label: 'مسحوبات المالك (الفترة)' },
  ] },
]

const KPI_LABEL: Record<keyof FinancialKpis, string> = {
  instantLiquidity: 'السيولة الفوريّة', quickRatio: 'السيولة السريعة',
  collectionRate: 'نسبة التحصيل', receivables: 'الذمم المدينة', receivablesTarget: 'هدف الذمم',
  debtToEquity: 'الدين/حقوق الملكية', workingCapital: 'رأس المال العامل',
  payrollToRevenue: 'تكلفة العمالة/إيراد (من الأساس المشترك)', materialsToRevenue: 'المواد/إيراد',
  revenuePerDirectEmployee: 'الإيراد/موظّف (من الأساس المشترك)', netMargin: 'الهامش الصافي',
  grossMargin: 'الهامش الإجماليّ', roe: 'العائد على حقوق الملكية',
}

const sar = (n: number) => `${Math.round(n).toLocaleString('ar-SA')} ريال`

function num(v: string): number | undefined {
  // ت٣أ٢ — تحويل الأرقام العربية-الهندية قبل التفسير (\d في JS لاتينيّ فقط)،
  // وتطبيع الفاصلة العشريّة العربيّة ٫ (U+066B) نقطةً قبل التجريد — وإلّا أسقطها
  // regex التجريد فالتصق «١٢٫٥» رقمًا صحيحًا ١٢٥ (خلل بيانات صامت).
  const n = Number(toLatinDigits(v).replace(/٫/g, '.').replace(/[^\d.-]/g, ''))
  return v.trim() === '' || !isFinite(n) ? undefined : n
}

export function FinanceQuantitativeSection({
  companyId,
  prefill,
}: {
  companyId: string
  prefill?: { headcount?: number; avgMonthlySalary?: number }
}) {
  const [finq, setFinq] = useState<Record<string, number>>({})
  const [loans, setLoans] = useState<Loan[]>([])
  const [costItems, setCostItems] = useState<CostItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [shared, setShared] = useState<SharedFinancial>({})
  const [autosave, setAutosave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipFirst = useRef(true)
  const hrRest = useRef<HrQuantArtifactShape>({})
  const sharedTouched = useRef(false)

  useEffect(() => {
    let cancel = false
    skipFirst.current = true
    sharedTouched.current = false
    ;(async () => {
      try {
        const [finArt, hrArt] = await Promise.all([
          getArtifact<FinQuantArtifact>(companyId, 'FIN_QUANT'),
          getArtifact<HrQuantArtifactShape>(companyId, 'HR_QUANT'),
        ])
        if (cancel) return
        // إعادة تسليح skipFirst قبل الـsetters: الوصول الأوّل استهلك اللفّة على حالةٍ
        // فارغة (قبل وصول البيانات)، فبلا هذا السطر تُطلق setters البيانات المحمّلة
        // حفظًا وهميًّا بعد ١٠٠٠ms دون أيّ تعديل مستخدم (يزيّف «آخر تعديل»).
        skipFirst.current = true
        setFinq(finArt?.data?.finq ?? {})       // توافق خلفيّ: v1 يأتي بلا شرائح/loans
        setLoans(finArt?.data?.loans ?? [])
        setCostItems(finArt?.data?.costItems ?? [])
        setProducts(finArt?.data?.products ?? [])
        hrRest.current = hrArt?.data ?? {}
        const f = hrArt?.data?.financial ?? {}
        setShared({
          headcount: f.headcount ?? prefill?.headcount,
          avgMonthlySalary: f.avgMonthlySalary ?? prefill?.avgMonthlySalary,
          annualRevenue: f.annualRevenue,
          workDays: f.workDays,
        })
      } catch { /* بلا artifact سابق — نبدأ فارغاً */ }
    })()
    return () => { cancel = true }
  }, [companyId, prefill?.headcount, prefill?.avgMonthlySalary])

  // الاشتقاق (§ت٣أ٢): الشرائح → FINQ_AR + المتأخر؛ القروض → FINQ_DEBT + FINQ_INST.
  const arAging = useMemo(() => deriveArAging(finq), [finq])
  const loanSums = useMemo(() => sumLoans(loans), [loans])

  // الإجماليات الفعّالة: المشتقّة تعلو اليدويّة؛ downstream (finQuantDerive) يقرأ FINQ_* كما هي.
  const effectiveFinq = useMemo(() => {
    const e = { ...finq }
    if (arAging) { e.FINQ_AR = arAging.value; e.FINQ_AR_OVERDUE_V = arAging.overdueV; e.FINQ_AR_OVERDUE_N = arAging.overdueN }
    if (loanSums) { e.FINQ_DEBT = loanSums.debt; e.FINQ_INST = loanSums.inst }
    // قرار ٢: بنود مركز التكاليف تسود على الحقول المجمّعة القديمة عند وجودها.
    return deriveAggregatesIntoFinq(costItems, e).finq
  }, [finq, arAging, loanSums, costItems])

  // مدخلات نقدية ١٣ أسبوع (المخرج ٣): تُقرأ من الإجماليات الفعّالة + مركز التكاليف.
  const cashflowInput = useMemo(() => {
    const f = effectiveFinq
    const opex = costItems.length > 0
      ? costItemsMonthlyOpex(costItems)
      : (f.FINQ_FIXED_COSTS ?? 0) + (f.FND_MAT ?? 0) + (f.FINQ_MKT ?? 0)
    return {
      openingCash: f.FND_CASH ?? 0,
      buckets: { b1: f.FINQ_AR_B1_V ?? 0, b2: f.FINQ_AR_B2_V ?? 0, b3: f.FINQ_AR_B3_V ?? 0, b4: f.FINQ_AR_B4_V ?? 0 },
      monthlyOpex: opex,
      monthlyInstallments: f.FINQ_INST ?? 0,
    }
  }, [effectiveFinq, costItems])

  // حفظ مؤجّل: FIN_QUANT (finq الفعّال + loans + schemaVersion 2)؛ HR_QUANT.financial عند تعديل المشترك.
  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setAutosave('saving')
      try {
        await upsertArtifact<FinQuantArtifact>(companyId, 'FIN_QUANT', {
          schemaVersion: FIN_QUANT_SCHEMA_VERSION,
          finq: effectiveFinq,
          loans,
          costItems,
          products,
        })
        if (sharedTouched.current) {
          await upsertArtifact<HrQuantArtifactShape>(companyId, 'HR_QUANT', {
            ...hrRest.current,
            financial: { ...(hrRest.current.financial ?? {}), ...shared },
          })
        }
        setAutosave('saved')
      } catch (err) { setAutosave('error'); void apiErrorMessage(err, '') }
    }, 1000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [effectiveFinq, loans, costItems, products, shared, companyId])

  function setField(key: string, v: string) {
    setFinq((prev) => {
      const next = { ...prev }
      const n = num(v)
      if (n == null) delete next[key]
      else next[key] = n
      return next
    })
  }
  function setSharedField(key: keyof SharedFinancial, v: string) {
    sharedTouched.current = true
    setShared((prev) => ({ ...prev, [key]: num(v) }))
  }
  function setLoan(i: number, patch: Partial<Loan>) {
    setLoans((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function addLoan() { setLoans((prev) => [...prev, { lender: '', balance: 0, installment: 0 }]) }
  function removeLoan(i: number) { setLoans((prev) => prev.filter((_, idx) => idx !== i)) }

  const kpis = useMemo<Partial<FinancialKpis>>(() => {
    const inp: Record<string, number> = { ...effectiveFinq }
    if (shared.headcount != null) inp.FND_HEADCOUNT = shared.headcount
    if (shared.annualRevenue != null) inp.FND_ANNUAL_REVENUE = shared.annualRevenue
    return deriveFinancialKpis(inp)
  }, [effectiveFinq, shared.headcount, shared.annualRevenue])

  const preview = useMemo(() => {
    const NAN_BASE = Object.fromEntries(
      (Object.keys(KPI_LABEL) as (keyof FinancialKpis)[]).map((k) => [k, NaN]),
    ) as unknown as FinancialKpis
    if (Object.keys(kpis).length === 0) return null
    return computeFinancialHealth({ ...NAN_BASE, ...kpis })
  }, [kpis])

  const equityWarn = finq.FINQ_EQUITY != null && finq.FINQ_EQUITY <= 0

  // حرّاس التناقض المحاسبيّ الثلاثة (نمط حارس الراتب 53b0de2 — إلزاميّ غير مانع):
  // يقرأون الإجماليّات الفعّالة + الإيراد من الأساس المشترك. النقيّ يتولّى الأحكام.
  const acctWarnings = useMemo(
    () => accountingGuards({
      equity: effectiveFinq.FINQ_EQUITY,
      totalAssets: effectiveFinq.FINQ_TOTAL_ASSETS,
      receivables: effectiveFinq.FINQ_AR,
      currentAssets: effectiveFinq.FINQ_CURR_ASSET,
      materialsMonthly: effectiveFinq.FND_MAT,
      annualRevenue: shared.annualRevenue,
      grossProfit: effectiveFinq.FINQ_GROSS_PROFIT,
    }),
    [effectiveFinq, shared.annualRevenue],
  )

  // القطعة ٢ — نقطة التعادل الحيّة: تقرأ الثلاث من الإجماليّات الفعّالة (الثابتة تأتي
  // مشتقّة من بنود مركز التكاليف حين توجد — قرار ٢). النقيّ breakEven يتولّى السقوط.
  const be = useMemo(
    () => breakEven(effectiveFinq.FINQ_FIXED_COSTS, effectiveFinq.FINQ_VAR_COST_UNIT, effectiveFinq.FINQ_PRICE_UNIT),
    [effectiveFinq],
  )

  return (
    <Card className="border-2 border-emerald-300 bg-emerald-50/30" dir="rtl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-emerald-900">💰 التحليل الكمّي المالي — إدخال تفصيليّ</CardTitle>
          <span className="text-xs text-muted-foreground">
            {autosave === 'saving' ? '⏳ حفظ…' : autosave === 'saved' ? '✓ محفوظ' : autosave === 'error' ? '⚠️ فشل الحفظ' : ''}
          </span>
        </div>
        <CardDescription>
          أدخل التفاصيل فتُشتقّ الإجماليات تلقائيًّا (شرائح الذمم · القروض). <b>عرضٌ وتتبّع فقط (v1)</b> — لا يدخل درجة الصحّة الحيّة.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* حرّاس التناقض المحاسبيّ الثلاثة — تحذير إلزاميّ غير مانع (لا يمنع الإدخال) */}
        {acctWarnings.length > 0 && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 p-3">
            <div className="mb-1 text-sm font-bold text-rose-900">⚠️ تنبيهات اتّساق محاسبيّ — لا تمنع الإدخال</div>
            <ul className="list-disc space-y-1 pe-5 text-xs font-medium text-rose-800">
              {acctWarnings.map((w) => <li key={w.key}>{w.message}</li>)}
            </ul>
          </div>
        )}

        {/* الأساس المشترك — يُقرأ ويُكتب في HR_QUANT.financial (لا يُنسَخ). */}
        <div className="rounded-lg border border-sky-300 bg-sky-50/50 p-3">
          <div className="mb-2 text-sm font-bold text-sky-900">🔗 الأساس المشترك (مصدره التحليل الكمّي لـ HR — يُحدَّث في مكانه)</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <FinInput label="عدد الموظفين" value={shared.headcount} onChange={(v) => setSharedField('headcount', v)} />
            <FinInput label="متوسط الراتب الشهري (ريال)" value={shared.avgMonthlySalary} onChange={(v) => setSharedField('avgMonthlySalary', v)} />
            <FinInput label="الإيراد السنوي (ريال)" value={shared.annualRevenue} onChange={(v) => setSharedField('annualRevenue', v)} />
            <FinInput label="أيام العمل/شهر" value={shared.workDays} onChange={(v) => setSharedField('workDays', v)} />
          </div>
        </div>

        {/* ت٣أ٢ — الذمم بشرائح أعمارها → FINQ_AR + المتأخر (B3+B4) */}
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 text-sm font-bold">🧾 الذمم المدينة — بشرائح الأعمار (عدد + قيمة)</div>
          <div className="flex flex-col divide-y">
            {AR_BUCKET_META.map((m) => (
              <div key={m.b} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="w-24 shrink-0">{m.label}</span>
                <FinInput label="عدد" value={finq[`FINQ_AR_${m.b}_N`]} onChange={(v) => setField(`FINQ_AR_${m.b}_N`, v)} compact />
                <FinInput label="قيمة (ريال)" value={finq[`FINQ_AR_${m.b}_V`]} onChange={(v) => setField(`FINQ_AR_${m.b}_V`, v)} compact />
              </div>
            ))}
          </div>
          {arAging ? (
            <div className="mt-2 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
              📎 <b>مشتق من الشرائح:</b> إجمالي الذمم = <b>{sar(arAging.value)}</b> · المتأخر (فوق 60 يومًا = 61-90 و+90) = <b>{sar(arAging.overdueV)}</b> ({arAging.overdueN} ذمّة).
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <FinInput label="إجمالي الذمم (يدويّ) — عند تعذّر الشرائح" value={finq.FINQ_AR} onChange={(v) => setField('FINQ_AR', v)} />
              <span className="text-[11px] text-amber-700">✍️ إجمالي يدويّ</span>
            </div>
          )}
        </div>

        {/* ت٣أ٢ — القروض قائمةً → FINQ_DEBT + FINQ_INST */}
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold">🏦 القروض — صفّ لكل قرض</span>
            <Button type="button" size="sm" variant="outline" onClick={addLoan}>+ أضف قرضًا</Button>
          </div>
          {loans.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">لا قروض مُدخَلة — أضف صفًّا، أو أدخل الإجماليّين يدويًّا:</p>
              <div className="flex flex-wrap items-center gap-2">
                <FinInput label="إجمالي الديون (يدويّ)" value={finq.FINQ_DEBT} onChange={(v) => setField('FINQ_DEBT', v)} />
                <FinInput label="إجمالي الأقساط الشهريّة (يدويّ)" value={finq.FINQ_INST} onChange={(v) => setField('FINQ_INST', v)} />
                <span className="text-[11px] text-amber-700">✍️ إجمالي يدويّ</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {loans.map((l, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs text-emerald-900">الجهة
                    <Input className="h-8 w-40" value={l.lender} onChange={(e) => setLoan(i, { lender: e.target.value })} />
                  </label>
                  <FinInput label="الرصيد المتبقّي" value={l.balance} onChange={(v) => setLoan(i, { balance: num(v) ?? 0 })} compact />
                  <FinInput label="القسط الشهريّ" value={l.installment} onChange={(v) => setLoan(i, { installment: num(v) ?? 0 })} compact />
                  <FinInput label="الفائدة (٪ سنوي)" value={l.rate} onChange={(v) => setLoan(i, { rate: num(v) })} compact />
                  <Button type="button" size="sm" variant="ghost" className="text-rose-600" onClick={() => removeLoan(i)}>حذف</Button>
                </div>
              ))}
              {loanSums && (
                <div className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                  📎 <b>مشتق من القروض:</b> إجمالي الديون = <b>{sar(loanSums.debt)}</b> · الأقساط الشهريّة = <b>{sar(loanSums.inst)}</b>.
                </div>
              )}
            </div>
          )}
        </div>

        {/* المخرج ٤ — مركز التكاليف (قرار ٢: البنود تسود على المجمّع) */}
        <CostCenterSection items={costItems} onChange={setCostItems} />

        {/* المخرج ٣ — توقّع النقدية ١٣ أسبوعًا (يتغذّى من مركز التكاليف والشرائح) */}
        <Cashflow13wSection {...cashflowInput} />

        {/* المخرج ٥ — اقتصاديات الوحدة (يبني على التعادل: الثابتة من الإجماليّة الفعّالة) */}
        <UnitEconomicsSection products={products} onChange={setProducts} fixedMonthly={effectiveFinq.FINQ_FIXED_COSTS ?? 0} />

        {FLAT_GROUPS.map((g) => (
          <div key={g.title} className="rounded-lg border bg-card p-3">
            <div className="mb-2 text-sm font-bold">{g.title}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((it) => (
                <FinInput key={it.key} label={it.label} value={finq[it.key]} onChange={(v) => setField(it.key, v)} />
              ))}
            </div>
            {g.title.includes('الملاءة') && equityWarn && (
              <p className="mt-2 text-xs font-medium text-rose-700">⚠️ حقوق الملكية ≤ ٠ — الدين/حقوق والعائد لن يُحتسبا (لا يمنع الإدخال).</p>
            )}
            {g.title.includes('التعادل') && <BreakEvenReadout be={be} />}
          </div>
        ))}

        {/* المؤشّرات المشتقّة — عرض تتبّعيّ فقط */}
        <div className="rounded-lg border border-emerald-300 bg-emerald-50/50 p-4">
          <div className="mb-2 text-sm font-bold text-emerald-900">📈 المؤشّرات المشتقّة (عرض تتبّعيّ — لا يدخل الصحّة الحيّة)</div>
          {!preview ? (
            <p className="text-xs text-emerald-800/80">أدخل الأرقام المالية أعلاه لتُعرَض المؤشّرات المشتقّة.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm font-bold text-emerald-900">
                <span>درجة الصحّة المالية (معاينة)</span>
                <span className="tabular-nums">{preview.healthPct} / 100</span>
              </div>
              {preview.vetoes.length > 0 && (
                <p className="rounded bg-rose-100/70 px-2 py-1 text-xs font-medium text-rose-800">
                  ⚠️ فيتوات مُفعَّلة: {preview.vetoes.join(' · ')} — القراءة محدودة بالأدنى.
                </p>
              )}
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {(Object.keys(KPI_LABEL) as (keyof FinancialKpis)[])
                  .filter((k) => kpis[k] != null && k !== 'receivablesTarget')
                  .map((k) => (
                    <div key={k} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{KPI_LABEL[k]}</span>
                      <span className="tabular-nums">{fmtKpi(k, kpis[k] as number)}</span>
                    </div>
                  ))}
              </div>
              <p className="mt-1 text-[11px] text-emerald-800/60">مؤشّرا الكفاءة مصدرهما «من أساس الأرقام المشترك (يُدخَل مرّة واحدة) — لا يُعاد إدخاله ولا حسابه هنا» (مصدر واحد §أ).</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function fmtKpi(key: keyof FinancialKpis, v: number): string {
  // roe كسرٌ (NET_PROFIT÷EQUITY، الهدف ≥ ٠٫١٥) فيُعرَض نسبةً كبقيّة الهوامش، لا «٠٫١٢».
  const asPct: (keyof FinancialKpis)[] = ['collectionRate', 'payrollToRevenue', 'materialsToRevenue', 'netMargin', 'grossMargin', 'roe']
  const asSar: (keyof FinancialKpis)[] = ['receivables', 'workingCapital', 'revenuePerDirectEmployee']
  if (asPct.includes(key)) return `${Math.round(v * 100)}٪`
  if (asSar.includes(key)) return sar(v)
  return String(Math.round(v * 100) / 100)
}

// القطعة ٢ — عرض نقطة التعادل الحيّ (لا أرقام صفريّة وهميّة عند نقص المدخلات).
const sarSymbol = (n: number) => `${Math.round(n).toLocaleString('en-US')} ﷼`
function BreakEvenReadout({ be }: { be: BreakEven | null }) {
  if (be == null) {
    return <p className="mt-2 text-xs text-muted-foreground">⚖️ أدخل القيم الثلاث (الثابتة · المتغيّرة للوحدة · السعر) لتظهر النقطة.</p>
  }
  if (be.noBreakEven) {
    return (
      <p className="mt-2 rounded bg-rose-100/70 px-2 py-1 text-xs font-medium text-rose-800">
        ⚠️ السعر لا يغطّي التكلفة المتغيّرة (هامش المساهمة = {sarSymbol(be.contributionMargin)}) — لا نقطة تعادل.
      </p>
    )
  }
  return (
    <div className="mt-2 grid grid-cols-1 gap-1 rounded-lg border border-emerald-300 bg-emerald-50/50 p-2 text-xs sm:grid-cols-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">هامش المساهمة/وحدة</span>
        <span className="font-bold tabular-nums text-emerald-900">{sarSymbol(be.contributionMargin)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">وحدات التعادل/شهر</span>
        <span className="font-bold tabular-nums text-emerald-900">{be.units.toLocaleString('en-US')}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">مبيعات التعادل</span>
        <span className="font-bold tabular-nums text-emerald-900">{sarSymbol(be.revenue)}</span>
      </div>
    </div>
  )
}

function FinInput({ label, value, onChange, compact }: { label: string; value?: number; onChange: (v: string) => void; compact?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-emerald-900 ${compact ? '' : 'w-full'}`}>
      {label}
      <Input
        type="text"
        inputMode="decimal"
        className={compact ? 'h-8 w-28' : 'h-8'}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
