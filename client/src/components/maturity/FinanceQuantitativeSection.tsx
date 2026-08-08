import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { deriveArAging, sumLoans, toLatinDigits, type Loan } from '@/lib/finAgingDerive'
import { computeFinancialHealth, type FinancialKpis } from '@/lib/financialHealth'
import { deriveFinancialKpis } from '@/lib/finQuantDerive'
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
    { key: 'FINQ_GOV', label: 'التزامات حكوميّة (زكاة/ضريبة) مستحقّة' },
    { key: 'FINQ_STOCK_V', label: 'قيمة المخزون الآن' },
    { key: 'FINQ_OWNER_DRAW', label: 'مسحوبات المالك (الفترة)' },
  ] },
]

const KPI_LABEL: Record<keyof FinancialKpis, string> = {
  instantLiquidity: 'السيولة الفوريّة', quickRatio: 'السيولة السريعة',
  collectionRate: 'نسبة التحصيل', receivables: 'الذمم المدينة', receivablesTarget: 'هدف الذمم',
  debtToEquity: 'الدين/حقوق الملكية', workingCapital: 'رأس المال العامل',
  payrollToRevenue: 'تكلفة العمالة/إيراد (من HR)', materialsToRevenue: 'المواد/إيراد',
  revenuePerDirectEmployee: 'الإيراد/موظّف (من HR)', netMargin: 'الهامش الصافي',
  grossMargin: 'الهامش الإجماليّ', roe: 'العائد على حقوق الملكية',
}

const sar = (n: number) => `${Math.round(n).toLocaleString('ar-SA')} ريال`

function num(v: string): number | undefined {
  // ت٣أ٢ — تحويل الأرقام العربية-الهندية قبل التفسير (\d في JS لاتينيّ فقط).
  const n = Number(toLatinDigits(v).replace(/[^\d.-]/g, ''))
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
        setFinq(finArt?.data?.finq ?? {})       // توافق خلفيّ: v1 يأتي بلا شرائح/loans
        setLoans(finArt?.data?.loans ?? [])
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
    return e
  }, [finq, arAging, loanSums])

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
  }, [effectiveFinq, loans, shared, companyId])

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
              <p className="mt-1 text-[11px] text-emerald-800/60">مؤشّرا «من HR» يُقرآن من التحليل الكمّي لـ HR (مصدر واحد §أ) — لا يُعاد حسابهما هنا.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function fmtKpi(key: keyof FinancialKpis, v: number): string {
  const asPct: (keyof FinancialKpis)[] = ['collectionRate', 'payrollToRevenue', 'materialsToRevenue', 'netMargin', 'grossMargin']
  const asSar: (keyof FinancialKpis)[] = ['receivables', 'workingCapital', 'revenuePerDirectEmployee']
  if (asPct.includes(key)) return `${Math.round(v * 100)}٪`
  if (asSar.includes(key)) return sar(v)
  return String(Math.round(v * 100) / 100)
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
