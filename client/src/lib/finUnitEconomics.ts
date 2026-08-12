// ─── اقتصاديات الوحدة (المخرج ٥، الموجة ٢) — منطق نقيّ بحت ────────────────
// لكلّ منتج/خدمة: هامش المساهمة · نسبته · السعر الأدنى المقبول · هل يربح؟
// يكشف «المنتج الخاسر المخفيّ» وراء ربحيّة الشركة الكلّيّة. لا DB ولا واجهة.
// يبني على breakEven (السعر الأدنى = يغطّي المتغيّرة)؛ لا يعيد اختراع الحساب.

export interface Product {
  id: string
  name: string
  varCostUnit: number
  priceUnit: number
  /** الوحدات المتوقّعة شهريًّا (اختياريّ — لحساب المساهمة الشهريّة). */
  monthlyUnits?: number
}

export interface ProductEconomics {
  id: string
  name: string
  /** هامش المساهمة للوحدة = السعر − المتغيّرة. */
  contributionMargin: number
  /** نسبة الهامش من السعر (٪). */
  contributionMarginPct: number
  /** السعر الأدنى المقبول = التكلفة المتغيّرة (دونه خسارةٌ لكلّ وحدة). */
  minPrice: number
  /** هل الوحدة رابحة (هامش > ٠)؟ */
  profitable: boolean
  /** مساهمة شهريّة = الهامش × الوحدات (null إن لم تُدخَل الوحدات). */
  monthlyContribution: number | null
}

const isNum = (n: unknown): n is number => typeof n === 'number' && isFinite(n)

/** اقتصاديات منتجٍ واحد — null إن نقص السعر أو المتغيّرة (لا اختلاق). */
export function productEconomics(p: Product): ProductEconomics | null {
  if (!isNum(p.priceUnit) || !isNum(p.varCostUnit) || p.priceUnit <= 0) return null
  const contributionMargin = p.priceUnit - p.varCostUnit
  const units = isNum(p.monthlyUnits) && p.monthlyUnits > 0 ? p.monthlyUnits : null
  return {
    id: p.id,
    name: p.name,
    contributionMargin,
    contributionMarginPct: (contributionMargin / p.priceUnit) * 100,
    minPrice: Math.max(0, p.varCostUnit),
    profitable: contributionMargin > 0,
    monthlyContribution: units != null ? contributionMargin * units : null,
  }
}

export interface UnitEconomicsResult {
  rows: ProductEconomics[]
  /** إجمالي المساهمة الشهريّة عبر المنتجات (يجمع ما له وحدات فقط). */
  totalMonthlyContribution: number
  /** هل تغطّي المساهمة الإجماليّة التكاليف الثابتة؟ null إن لا ثابتة/لا وحدات. */
  coversFixed: boolean | null
  /** المنتجات الخاسرة (هامش ≤ ٠) — «المنتج الخاسر المخفيّ». */
  lossMaking: ProductEconomics[]
  /** الأضعف هامشًا (٪) — أوّل مرشّح لمراجعة التسعير. */
  worst: ProductEconomics | null
}

export function unitEconomics(products: Product[], fixedMonthly?: number): UnitEconomicsResult {
  const rows = products.map(productEconomics).filter((r): r is ProductEconomics => r != null)
  const withUnits = rows.filter((r) => r.monthlyContribution != null)
  const totalMonthlyContribution = withUnits.reduce((s, r) => s + (r.monthlyContribution ?? 0), 0)
  const coversFixed = isNum(fixedMonthly) && fixedMonthly > 0 && withUnits.length > 0
    ? totalMonthlyContribution >= fixedMonthly
    : null
  const lossMaking = rows.filter((r) => !r.profitable)
  const worst = rows.length
    ? rows.reduce((w, r) => (r.contributionMarginPct < w.contributionMarginPct ? r : w))
    : null
  return { rows, totalMonthlyContribution, coversFixed, lossMaking, worst }
}
