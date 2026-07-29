// ─── محرّك الأثر المالي للموارد البشريّة (نسبة → ريال) ───────────────────
// تطبيق معادلات docs/HR_ASSESSMENT_TRANSFER_SPEC.md §د-١ + معاملات §هـ-٢،
// منقّاة من أخطاء ملف المصدر (أثر الغياب صُحّح ١٬٩٨٩٬٠٠٠ → R×Δ؛ ازدواج
// التسرّب/eNPS مُستبعَد من الإجمالي — حاشية §د ²).
//
// **دوالّ نقيّة بحتة:** لا DB، لا opex، لا واجهة. المتّصل (لاحقاً) يربط
// opex.team→E · opex.avgSalary→S · الإيراد→R. كل مُدخَل ناقص/≤٠ → أثر ٠
// (نمط IFERROR في الملف الأصليّ).

/** أيّام العمل السنويّة الافتراضيّة (٥٢ أسبوع × ٥). */
export const WORKING_DAYS_DEFAULT = 260

/** معاملات المجال (§هـ-٢) — تُشفّر خبرة السوق السعوديّ. لا تُغيَّر إلا بدراسة. */
export const HR_COEFFICIENTS = {
  /** تكلفة استبدال الموظّف ≈ ٣ رواتب شهريّة (توظيف + تدريب + إنتاجيّة ضائعة). */
  turnoverReplacementMonths: 3,
  /** كل ١٪ شغور ≈ ٠٫٨٥٪ خسارة إيراد. */
  vacancyRevenueFactor: 0.85,
  /** كل نقطة eNPS ↓ ≈ ٢٪ ↑ استقالات. */
  enpsPointToAttrition: 0.02,
} as const

/** المتغيّرات الأساسيّة للشركة (§د: E · S · R · D). */
export interface HrFinancialInputs {
  headcount: number          // E — عدد الموظّفين
  avgMonthlySalary: number   // S — متوسّط الراتب الشهريّ (ريال)
  annualRevenue: number      // R — الإيراد السنويّ (ريال)
  workingDaysPerYear?: number // D — افتراض ٢٦٠
}

/** مؤشّر «أقلّ أفضل» (تسرّب/غياب/شغور/تكلفة) بالنسبة المئويّة. */
export interface RateChange {
  current: number  // النسبة الحاليّة % (مثال ١٨)
  target: number   // النسبة المستهدفة % (مثال ١٠)
}

/** مؤشّر «أعلى أفضل» (eNPS) بالنقاط. */
export interface PointsChange {
  current: number  // النقاط الحاليّة (مثال ٢٥)
  target: number   // النقاط المستهدفة (مثال ٥٠)
}

export interface HrIndicators {
  turnoverPct?: RateChange   // معدّل التسرّب السنويّ
  absencePct?: RateChange    // معدّل الغياب
  vacancyPct?: RateChange    // معدّل الشغور
  enpsPoints?: PointsChange  // رضا الموظّفين eNPS
  hrCostPct?: RateChange     // تكلفة HR / الإيراد
}

export interface ImpactLine {
  /** الأثر المالي السنويّ المحتمل (ريال) — التوفير من بلوغ الهدف. */
  annualImpactSAR: number
  /** هل تحسب هذه القيمة ضمن الإجمالي؟ (eNPS مؤشّر مسبق، يُستبعَد — حاشية §د ²). */
  countedInTotal: boolean
}

export interface HrImpactResult {
  turnover: ImpactLine
  absence: ImpactLine
  vacancy: ImpactLine
  enps: ImpactLine
  hrCost: ImpactLine
  /** مجموع الأسطر المحسوبة فقط (يستبعد eNPS تفادياً لازدواج حساب التسرّب). */
  totalSavingSAR: number
  /** التوفير كنسبة من الإيراد — للعرض («١٨٪ من الإيراد» لا «٨٦٪» المبالَغة). */
  totalAsPctOfRevenue: number
}

// ─── أدوات داخليّة ──────────────────────────────────────────────────
const ok = (n: number | undefined): n is number => typeof n === 'number' && isFinite(n) && n > 0
/** فرق «أقلّ أفضل» كنسبة (حاليّ − هدف)، مصفّراً عند السالب (بلغ الهدف = لا توفير). */
const dropRate = (c: RateChange) => Math.max(0, (c.current - c.target) / 100)

// ─── §د-١: معادلات التحويل المالي ───────────────────────────────────

/** تكلفة التسرّب = E × Δ × S × ٣.  مثال: ٢٥×٠٫٠٨×٦٠٠٠×٣ = ٣٦٬٠٠٠. */
export function turnoverCost(i: HrFinancialInputs, c: RateChange): number {
  if (!ok(i.headcount) || !ok(i.avgMonthlySalary)) return 0
  return i.headcount * dropRate(c) * i.avgMonthlySalary * HR_COEFFICIENTS.turnoverReplacementMonths
}

/** أثر الغياب = R × Δ.  مثال مُصحَّح: ٣٬٠٠٠٬٠٠٠×٠٫٠٦ = ١٨٠٬٠٠٠ (لا ١٫٩٨٩M). */
export function absenceImpact(i: HrFinancialInputs, c: RateChange): number {
  if (!ok(i.annualRevenue)) return 0
  return i.annualRevenue * dropRate(c)
}

/** أثر الشغور = R × Δ × ٠٫٨٥.  مثال: ٣٬٠٠٠٬٠٠٠×٠٫٠٧×٠٫٨٥ = ١٧٨٬٥٠٠. */
export function vacancyImpact(i: HrFinancialInputs, c: RateChange): number {
  if (!ok(i.annualRevenue)) return 0
  return i.annualRevenue * dropRate(c) * HR_COEFFICIENTS.vacancyRevenueFactor
}

/** أثر eNPS = (Δنقاط × ٢٪) × E × S × ٣.  مثال: (٢٥×٠٫٠٢)×٢٥×٦٠٠٠×٣ = ٢٢٥٬٠٠٠.
 *  «أعلى أفضل» فالتحسّن = هدف − حاليّ. مؤشّر مسبق → لا يُجمَع (حاشية §د ²). */
export function enpsImpact(i: HrFinancialInputs, c: PointsChange): number {
  if (!ok(i.headcount) || !ok(i.avgMonthlySalary)) return 0
  const gain = Math.max(0, c.target - c.current)
  return gain * HR_COEFFICIENTS.enpsPointToAttrition * i.headcount * i.avgMonthlySalary * HR_COEFFICIENTS.turnoverReplacementMonths
}

/** أثر تكلفة HR = Δ × R.  مثال: ٠٫٠٥×٣٬٠٠٠٬٠٠٠ = ١٥٠٬٠٠٠. */
export function hrCostImpact(i: HrFinancialInputs, c: RateChange): number {
  if (!ok(i.annualRevenue)) return 0
  return i.annualRevenue * dropRate(c)
}

// ─── التجميع ────────────────────────────────────────────────────────

/** يحسب كل الأسطر + الإجمالي (يستبعد eNPS تفادياً لازدواج الحساب). */
export function computeHrFinancialImpact(i: HrFinancialInputs, ind: HrIndicators): HrImpactResult {
  const line = (v: number, counted: boolean): ImpactLine => ({ annualImpactSAR: Math.round(v), countedInTotal: counted })

  const turnover = line(ind.turnoverPct ? turnoverCost(i, ind.turnoverPct) : 0, true)
  const absence  = line(ind.absencePct  ? absenceImpact(i, ind.absencePct)  : 0, true)
  const vacancy  = line(ind.vacancyPct  ? vacancyImpact(i, ind.vacancyPct)  : 0, true)
  const enps     = line(ind.enpsPoints  ? enpsImpact(i, ind.enpsPoints)     : 0, false)
  const hrCost   = line(ind.hrCostPct   ? hrCostImpact(i, ind.hrCostPct)    : 0, true)

  const totalSavingSAR = [turnover, absence, vacancy, hrCost]
    .filter((l) => l.countedInTotal)
    .reduce((s, l) => s + l.annualImpactSAR, 0)

  const totalAsPctOfRevenue = ok(i.annualRevenue)
    ? Math.round((totalSavingSAR / i.annualRevenue) * 1000) / 10
    : 0

  return { turnover, absence, vacancy, enps, hrCost, totalSavingSAR, totalAsPctOfRevenue }
}
