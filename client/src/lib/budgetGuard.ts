// ─── حارس الميزانيّة — Σ cost مقابل Company.opex.budget ─────────────
// تحذير لا حظر: تجاوز الميزانيّة يُبرِز تنبيهاً أحمر، ولا يمنع الحفظ.
// نقيّة وقابلة للاختبار — لا تلمس شبكة ولا حالة.

export interface BudgetStatus {
  /** مجموع التكاليف (البنود بلا cost تُحسب صفراً). */
  spent: number
  /** الميزانيّة الفعّالة (null إن لم تُحدَّد أو ≤ 0). */
  budget: number | null
  /** المتبقّي = budget − spent (null بلا ميزانيّة). */
  remaining: number | null
  /** هل تجاوز الإنفاقُ الميزانيّة؟ (false دائماً بلا ميزانيّة — لا حظر). */
  overBudget: boolean
  /** نسبة الإنفاق ٪ (null بلا ميزانيّة). */
  pct: number | null
}

/**
 * يجمع تكاليف بنود (المبادرات/المهام) ويقارنها بالميزانيّة.
 * cost قد يعود عدداً أو نصّاً (Prisma Decimal) أو null — نُعامله بـNumber()||0،
 * فالبند القديم بلا cost يعمل (يُحسب صفراً) بلا كسر.
 */
export function budgetStatus(
  costs: Array<number | string | null | undefined>,
  budget: number | null | undefined,
): BudgetStatus {
  const spent = costs.reduce<number>((sum, c) => sum + (Number(c) || 0), 0)
  const b = budget != null && Number.isFinite(Number(budget)) && Number(budget) > 0 ? Number(budget) : null
  return {
    spent,
    budget: b,
    remaining: b != null ? b - spent : null,
    overBudget: b != null && spent > b,
    pct: b != null ? Math.round((spent / b) * 100) : null,
  }
}
