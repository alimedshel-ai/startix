// ─── مركز التكاليف (المخرج ٤، الموجة ١) — منطق نقيّ بحت ───────────────────
// يحوّل التكاليف المجمّعة إلى بنود تفصيلية (٨ أنواع)، ويشتقّ منها المجاميع الشهرية.
// **قرار ٢ (أسبقيّة صريحة):** حين توجد بنود لفئةٍ ما، مجموعها المشتقّ **يسود** على
// القيمة المجمّعة القديمة في finq (تُجمَّد الفئة)؛ وحين لا بنود، تبقى القيمة القديمة.
// لا مصدران نشطان لقيمة واحدة. لا DB ولا واجهة ولا حالة — مثل finQuantDerive.

/** الأنواع الثمانية المعتمدة. */
export type CostType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/** دورة التكرار — تُحوَّل إلى معادلٍ شهريّ. */
export type Recurrence = 'monthly' | 'quarterly' | 'annual' | 'oneoff'

export interface CostItem {
  id: string
  name: string
  type: CostType
  amount: number
  recurrence: Recurrence
}

/** تسميات الأنواع (عربيّة) — للعرض. */
export const COST_TYPE_LABEL: Record<CostType, string> = {
  1: 'ثابتة تشغيليّة',
  2: 'متغيّرة إنتاجيّة',
  3: 'تسويقيّة',
  4: 'حكوميّة وامتثال',
  5: 'تمويليّة',
  6: 'رأسماليّة (CapEx)',
  7: 'مسحوبات المالك',
  8: 'غير مباشرة/مشتركة',
}

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  monthly: 'شهريّ', quarterly: 'ربعيّ', annual: 'سنويّ', oneoff: 'مرّة واحدة',
}

/** أشهر كل دورة (oneoff = 0 ⇒ لا يدخل التشغيل الشهريّ المتكرّر). */
const MONTHS: Record<Recurrence, number> = { monthly: 1, quarterly: 3, annual: 12, oneoff: 0 }

/**
 * النوع → حقل finq المجمّع الذي يشتقّه (الأنواع القابلة للاشتقاق فقط).
 * ٥ تمويليّة تُدار عبر loans[] (لا اشتقاق هنا)؛ ٦ CapEx و٨ مشتركة لا حقلَ مجمّعًا لهما.
 */
export const TYPE_TO_FINQ: Partial<Record<CostType, string>> = {
  1: 'FINQ_FIXED_COSTS',
  2: 'FND_MAT',
  3: 'FINQ_MKT',
  4: 'FINQ_GOV',
  7: 'FINQ_OWNER_DRAW',
}

const isNum = (n: unknown): n is number => typeof n === 'number' && isFinite(n)

/** المعادل الشهريّ لبندٍ واحد (المبلغ ÷ أشهر الدورة؛ مرّة-واحدة = ٠). */
export function monthlyEquivalent(item: CostItem): number {
  if (!isNum(item.amount) || item.amount < 0) return 0
  const m = MONTHS[item.recurrence]
  return m > 0 ? item.amount / m : 0
}

/** مجموع المعادل الشهريّ لكل نوع (الأنواع بلا بنود تُحذَف). */
export function aggregatesByType(items: CostItem[]): Partial<Record<CostType, number>> {
  const out: Partial<Record<CostType, number>> = {}
  for (const it of items) out[it.type] = (out[it.type] ?? 0) + monthlyEquivalent(it)
  return out
}

/**
 * إجمالي التشغيل الشهريّ = Σ المعادلات، **ما عدا** ٦ CapEx و٧ مسحوبات المالك
 * (ليست مصروفًا تشغيليًّا). التمويليّة تبقى ضمنه إن أُدخلت (الأصل loans[]).
 */
export function monthlyOpex(items: CostItem[]): number {
  return items.reduce((s, it) => (it.type === 6 || it.type === 7 ? s : s + monthlyEquivalent(it)), 0)
}

/**
 * قرار ٢ — يشتقّ المجاميع من البنود إلى finq: كل فئةٍ فيها ≥١ بند تُكتَب قيمتها
 * المشتقّة (تسود)؛ الفئات بلا بنود تبقى كما هي. يُرجِع finq جديدًا + قائمة الحقول
 * المُجمَّدة (المشتقّة) كي تُظهرها الواجهة «مصدرها البنود».
 */
export function deriveAggregatesIntoFinq(
  items: CostItem[],
  finq: Record<string, number>,
): { finq: Record<string, number>; frozenFields: string[] } {
  const agg = aggregatesByType(items)
  const next = { ...finq }
  const frozenFields: string[] = []
  for (const [t, field] of Object.entries(TYPE_TO_FINQ) as [string, string][]) {
    const v = agg[Number(t) as CostType]
    if (v != null) { next[field] = Math.round(v); frozenFields.push(field) }
  }
  return { finq: next, frozenFields }
}

/** خريطة التكاليف: لكل نوعٍ له بنود — المجموع الشهريّ ونسبته من الإجماليّ. */
export function costMap(items: CostItem[]): { type: CostType; label: string; monthly: number; pct: number }[] {
  const agg = aggregatesByType(items)
  const total = Object.values(agg).reduce((s, v) => s + (v ?? 0), 0)
  return (Object.entries(agg) as [string, number][])
    .map(([t, monthly]) => {
      const type = Number(t) as CostType
      return { type, label: COST_TYPE_LABEL[type], monthly: Math.round(monthly), pct: total > 0 ? (monthly / total) * 100 : 0 }
    })
    .sort((a, b) => b.monthly - a.monthly)
}
