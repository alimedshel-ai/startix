import { useEffect, useMemo, useRef, useState } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api'
import { computeFinancialHealth, type FinancialKpis } from '@/lib/financialHealth'
import { deriveFinancialKpis } from '@/lib/finQuantDerive'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

// نسخة مخطّط قيَم FIN_QUANT المحفوظة (قاعدة ٣: schemaVersion إجباريّ من v1).
const FIN_QUANT_SCHEMA_VERSION = 1

// ─── التحليل الكمّي المالي — بنك الحقول المالية (docs/FIN_QUANT_CROSSOVER.md) ──
// يُدخل المدير الماليّ حقول FINQ_* المالية فيرى مؤشّرات FinancialKpis المشتقّة
// وعرض صحّةٍ **تتبّعيّ فقط** (v1: لا يدخل healthPct الحيّ ولا classifyClient).
// المصدر الواحد (§أ): مؤشّرا التداخل يُقرآن من طبقة HR عبر deriveFinancialKpis —
// لا يُعاد حسابهما هنا. الصلاحيّة (ورقة ٦): عرضٌ لعميلٍ واحد، بلا دمج بين العملاء
// (المكوّن يعمل على companyId واحد بطبيعته).

interface FinQuantArtifact {
  schemaVersion?: number
  /** حقول FINQ_* المالية + الأساس المالي-المحلّي (FND_CASH/FND_MAT). لا يُنسَخ الأساس المشترك. */
  finq: Record<string, number>
}

// الأساس المشترك (يُقرأ ويُكتب في HR_QUANT.financial — لا يُنسَخ داخل FIN_QUANT).
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

// حقول البنك المالي المعروضة — مجموعةً بمجموعة (§1-FIN). أساس مالي-محلّي: FND_CASH/FND_MAT.
const FIN_GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  { title: '💧 السيولة والتحصيل', items: [
    { key: 'FND_CASH', label: 'النقد المتاح الآن (بنك + صندوق)' },
    { key: 'FINQ_CURR_LIAB', label: 'الخصوم المتداولة' },
    { key: 'FINQ_CURR_ASSET', label: 'الأصول المتداولة' },
    { key: 'FINQ_AR', label: 'إجمالي الذمم المدينة (المستحق لك)' },
    { key: 'FINQ_AR_COLLECTED', label: 'المُحصَّل من الذمم (الفترة)' },
    { key: 'FINQ_AR_TARGET', label: 'هدف الذمم (قطاعي)' },
  ] },
  { title: '🏦 الملاءة والربحيّة', items: [
    { key: 'FINQ_DEBT', label: 'إجمالي الديون/القروض' },
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
    { key: 'FINQ_AR_OVERDUE_N', label: 'عدد الذمم المتأخرة' },
    { key: 'FINQ_AR_OVERDUE_V', label: 'قيمة الذمم المتأخرة' },
    { key: 'FINQ_INST', label: 'الأقساط الشهرية' },
    { key: 'FINQ_MKT', label: 'الإنفاق التسويقي الشهري' },
    { key: 'FINQ_GOV', label: 'التزامات حكوميّة (زكاة/ضريبة) مستحقّة' },
    { key: 'FINQ_STOCK_V', label: 'قيمة المخزون الآن' },
    { key: 'FINQ_OWNER_DRAW', label: 'مسحوبات المالك (الفترة)' },
  ] },
]

// أسماء عربيّة لمؤشّرات FinancialKpis (للعرض التتبّعيّ).
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
  const n = Number(v.replace(/[^\d.-]/g, ''))
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
  const [shared, setShared] = useState<SharedFinancial>({})
  const [autosave, setAutosave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipFirst = useRef(true)
  // نحفظ بقيّة HR_QUANT كما هي حتى لا نطمسها عند إعادة كتابة financial المشترك.
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
        setFinq(finArt?.data?.finq ?? {})
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

  // حفظ مؤجّل: FIN_QUANT دائماً؛ HR_QUANT.financial فقط إن عدّل المستخدم الأساس المشترك.
  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setAutosave('saving')
      try {
        await upsertArtifact<FinQuantArtifact>(companyId, 'FIN_QUANT', {
          schemaVersion: FIN_QUANT_SCHEMA_VERSION,
          finq,
        })
        if (sharedTouched.current) {
          // نكتب الأساس المشترك في مكانه الوحيد (HR_QUANT.financial) مع صون بقيّة HR_QUANT.
          await upsertArtifact<HrQuantArtifactShape>(companyId, 'HR_QUANT', {
            ...hrRest.current,
            financial: { ...(hrRest.current.financial ?? {}), ...shared },
          })
        }
        setAutosave('saved')
      } catch (err) { setAutosave('error'); void apiErrorMessage(err, '') }
    }, 1000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [finq, shared, companyId])

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

  // مدخلات الاشتقاق: FINQ_* + الأساس المالي-المحلّي + الأساس المشترك (FND_HEADCOUNT/REVENUE).
  // HRQ_HR_COST_YEAR غائب هنا (مُدخَل HR) ⇒ payrollToRevenue يغيب لطيفاً (§أ-٢، غياب لطيف).
  const kpis = useMemo<Partial<FinancialKpis>>(() => {
    const inp: Record<string, number> = { ...finq }
    if (shared.headcount != null) inp.FND_HEADCOUNT = shared.headcount
    if (shared.annualRevenue != null) inp.FND_ANNUAL_REVENUE = shared.annualRevenue
    return deriveFinancialKpis(inp)
  }, [finq, shared.headcount, shared.annualRevenue])

  // عرض صحّةٍ تتبّعيّ فقط (v1) — لا يُمرَّر إلى classifyClient ولا healthPct الحيّ.
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
          <CardTitle className="text-emerald-900">💰 التحليل الكمّي المالي — حقول البنك المالي</CardTitle>
          <span className="text-xs text-muted-foreground">
            {autosave === 'saving' ? '⏳ حفظ…' : autosave === 'saved' ? '✓ محفوظ' : autosave === 'error' ? '⚠️ فشل الحفظ' : ''}
          </span>
        </div>
        <CardDescription>
          أدخل الأرقام المالية فتُشتقّ مؤشّرات الصحّة تلقائياً. <b>عرضٌ وتتبّع فقط (v1)</b> — لا يدخل درجة الصحّة الحيّة بعد.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* الأساس المشترك — يُقرأ من HR_QUANT.financial ويُكتب إليه (لا يُنسَخ هنا). */}
        <div className="rounded-lg border border-sky-300 bg-sky-50/50 p-3">
          <div className="mb-2 text-sm font-bold text-sky-900">🔗 الأساس المشترك (مصدره التحليل الكمّي لـ HR — يُحدَّث في مكانه)</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <FinInput label="عدد الموظفين" value={shared.headcount} onChange={(v) => setSharedField('headcount', v)} />
            <FinInput label="متوسط الراتب الشهري (ريال)" value={shared.avgMonthlySalary} onChange={(v) => setSharedField('avgMonthlySalary', v)} />
            <FinInput label="الإيراد السنوي (ريال)" value={shared.annualRevenue} onChange={(v) => setSharedField('annualRevenue', v)} />
            <FinInput label="أيام العمل/شهر" value={shared.workDays} onChange={(v) => setSharedField('workDays', v)} />
          </div>
          <p className="mt-1 text-[11px] text-sky-800/70">تعديلها هنا يحدّث المصدر المشترك نفسه (HR_QUANT) — لا نسخة منفصلة.</p>
        </div>

        {FIN_GROUPS.map((g) => (
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

        {/* عرض تتبّعيّ: مؤشّرات الصحّة المشتقّة + معاينة درجة (لا تدخل الحيّ) */}
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

// تنسيق عرض المؤشّر بحسب طبيعته (نسبة/عملة/عدد).
function fmtKpi(key: keyof FinancialKpis, v: number): string {
  const asPct: (keyof FinancialKpis)[] = ['collectionRate', 'payrollToRevenue', 'materialsToRevenue', 'netMargin', 'grossMargin']
  const asSar: (keyof FinancialKpis)[] = ['receivables', 'workingCapital', 'revenuePerDirectEmployee']
  if (asPct.includes(key)) return `${Math.round(v * 100)}٪`
  if (asSar.includes(key)) return sar(v)
  return String(Math.round(v * 100) / 100)
}

function FinInput({ label, value, onChange }: { label: string; value?: number; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-emerald-900">
      {label}
      <Input
        type="number"
        inputMode="decimal"
        className="h-8"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
