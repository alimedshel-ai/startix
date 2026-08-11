// ─── توقّع النقدية ١٣ أسبوعًا (المخرج ٣، الموجة ٢→الموجة ١) — منطق نقيّ بحت ──
// (نقد داخل من شرائح الذمم) − (نقد خارج: تشغيل + أقساط) = رصيد متوقَّع لكل أسبوع.
// يجيب: «هل يكفي النقد؟ وأقرب خطر متى؟». لا DB ولا واجهة — يقرأ أرقامًا فقط.
//
// توزيع التحصيل حسب عمر الشريحة (الأحدث أسرع تحصيلًا):
//   B1 (٠-٣٠ي) أسابيع ١-٤ · B2 (٣١-٦٠) أسابيع ٣-٨ · B3 (٦١-٩٠) أسابيع ٧-١٣ ·
//   B4 (>٩٠، مشكوك) أسابيع ٧-١٣ × احتمال تحصيل (افتراضي ٠٫٤).
// الخارج: التشغيل الشهريّ ÷ ٤٫٣٣ لكل أسبوع + الأقساط الشهريّة تقع أسابيع ٤/٨/١٢.

export interface Cashflow13wInput {
  openingCash: number
  buckets: { b1: number; b2: number; b3: number; b4: number }
  monthlyOpex: number
  monthlyInstallments: number
  /** احتمال تحصيل ما فوق ٩٠ يومًا (٠..١) — افتراضي ٠٫٤. */
  b4CollectProb?: number
  /** حدّ الأمان للرصيد (تنبيه دون ما تحته) — افتراضي ٠. */
  safetyFloor?: number
}

export interface WeekRow { week: number; inflow: number; outflow: number; balance: number; belowFloor: boolean }

export interface Cashflow13wResult {
  weeks: WeekRow[]
  /** أوّل أسبوعٍ يهبط تحت حدّ الأمان (null = آمن طوال ١٣). */
  firstRiskWeek: number | null
  /** عدد الأسابيع الآمنة قبل أوّل خطر (١٣ إن لا خطر). */
  safeWeeks: number
  minBalance: number
}

const WEEKS = 13
const WEEKS_PER_MONTH = 4.33
const INSTALLMENT_WEEKS = new Set([4, 8, 12])

const n = (v: unknown): number => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0)

/** يوزّع مبلغًا بالتساوي على نطاق أسابيع [from..to] (ضمنيّ) → مصفوفة داخلٍ لكل أسبوع ١..١٣. */
function spread(amount: number, from: number, to: number): number[] {
  const out = new Array(WEEKS + 1).fill(0)
  const span = to - from + 1
  if (amount <= 0 || span <= 0) return out
  const per = amount / span
  for (let w = from; w <= to; w++) out[w] += per
  return out
}

export function computeCashflow13w(inp: Cashflow13wInput): Cashflow13wResult {
  const prob = inp.b4CollectProb ?? 0.4
  const floor = inp.safetyFloor ?? 0
  const { b1, b2, b3, b4 } = inp.buckets

  // الداخل: مجموع توزيعات الشرائح الأربع لكل أسبوع.
  const inB1 = spread(n(b1), 1, 4)
  const inB2 = spread(n(b2), 3, 8)
  const inB3 = spread(n(b3), 7, 13)
  const inB4 = spread(n(b4) * Math.max(0, Math.min(1, prob)), 7, 13)

  const opexWeekly = n(inp.monthlyOpex) / WEEKS_PER_MONTH
  const inst = n(inp.monthlyInstallments)

  const weeks: WeekRow[] = []
  let balance = inp.openingCash
  let firstRiskWeek: number | null = null
  let minBalance = balance
  for (let w = 1; w <= WEEKS; w++) {
    const inflow = inB1[w] + inB2[w] + inB3[w] + inB4[w]
    const outflow = opexWeekly + (INSTALLMENT_WEEKS.has(w) ? inst : 0)
    balance = balance + inflow - outflow
    const belowFloor = balance < floor
    if (belowFloor && firstRiskWeek == null) firstRiskWeek = w
    if (balance < minBalance) minBalance = balance
    weeks.push({ week: w, inflow: Math.round(inflow), outflow: Math.round(outflow), balance: Math.round(balance), belowFloor })
  }
  return { weeks, firstRiskWeek, safeWeeks: firstRiskWeek == null ? WEEKS : firstRiskWeek - 1, minBalance: Math.round(minBalance) }
}
