// ─── حرّاس التناقض المحاسبيّ الثلاثة — منطق نقيّ بحت ───────────────────────────
// نمط حارس الراتب (53b0de2): تحذيرات إلزاميّة غير مانعة — تكشف إدخالًا متناقضًا
// محاسبيًّا دون منع الحساب. لا DB ولا واجهة. الحقول الغائبة ⇒ لا حكم (لا اختلاق).

export interface AccountingInputs {
  /** حقوق الملكية (FINQ_EQUITY). */
  equity?: number
  /** إجمالي الأصول (FINQ_TOTAL_ASSETS). */
  totalAssets?: number
  /** الذمم المدينة (FINQ_AR الفعّال). */
  receivables?: number
  /** الأصول المتداولة (FINQ_CURR_ASSET). */
  currentAssets?: number
  /** تكلفة المواد/المشتريات الشهريّة (FND_MAT). */
  materialsMonthly?: number
  /** الإيراد السنويّ (FND_ANNUAL_REVENUE من الأساس المشترك). */
  annualRevenue?: number
  /** مجمل الربح آخر ١٢ شهرًا (FINQ_GROSS_PROFIT). */
  grossProfit?: number
}

export type AccountingWarningKey = 'equity_gt_assets' | 'ar_gt_current' | 'materials_gt_revenue'

export interface AccountingWarning {
  key: AccountingWarningKey
  message: string
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/**
 * الحرّاس الثلاثة (كلٌّ يُفعَّل فقط بحضور طرفَيه — لا حكم على إدخالٍ ناقص):
 *   ١) حقوق الملكية > إجمالي الأصول (الأصول = خصوم + حقوق، فلا تتجاوزها الحقوق).
 *   ٢) الذمم المدينة > الأصول المتداولة (الذمم جزءٌ منها).
 *   ٣) تكلفة المواد السنويّة (الشهريّة×١٢) > الإيراد السنويّ **مع** مجمل ربحٍ موجب.
 */
export function accountingGuards(inp: AccountingInputs): AccountingWarning[] {
  const w: AccountingWarning[] = []
  const gt = (a?: number, b?: number): boolean => isNum(a) && isNum(b) && a > b

  if (gt(inp.equity, inp.totalAssets)) {
    w.push({
      key: 'equity_gt_assets',
      message: 'حقوق الملكية أكبر من إجمالي الأصول — راجِع القيمتين (الأصول = خصوم + حقوق).',
    })
  }
  if (gt(inp.receivables, inp.currentAssets)) {
    w.push({
      key: 'ar_gt_current',
      message: 'الذمم المدينة أكبر من الأصول المتداولة — والذمم جزءٌ منها، فراجِع الإدخال.',
    })
  }
  if (
    isNum(inp.materialsMonthly) && isNum(inp.annualRevenue) &&
    inp.materialsMonthly * 12 > inp.annualRevenue &&
    isNum(inp.grossProfit) && inp.grossProfit > 0
  ) {
    w.push({
      key: 'materials_gt_revenue',
      message: 'تكلفة المواد السنويّة أكبر من الإيراد السنويّ مع مجمل ربحٍ موجب — تناقض، راجِع المواد/الإيراد/المجمل.',
    })
  }
  return w
}
