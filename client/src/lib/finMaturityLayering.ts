// ─── ح٥: تقسيم طبقة نضج المالية (طبقة فوقيّة على FINANCE فقط) ─────────────────
// لا يمسّ financeMaturity.ts (الأسئلة) ولا maturityEngine.ts (الحساب) — يُنتج تهيئةً
// مُقسَّمة تُمرَّر لـ MaturityAssessment المشترك نفسه (إعادة استخدام، لا عرض موازٍ).
// المصدر: بنك طبقات الجمع (ورقة ٣) + حسم المالك 2026-08-09.

import type { MaturityConfig } from './maturityEngine'
import { deriveArAging, type Loan } from './finAgingDerive'

// (بند ٣) إخفاء ٣ تكرارات مؤكَّدة فقط — تُبقى أصولها ظاهرة.
export const HIDDEN_IDS = new Set(['fin_asset_9', 'fin_cost_6', 'fin_risk_7'])

// (بند ٢) أسئلة تُجاب آليًّا من الكمّي — تُخفى من المطروح وتُعرَض في لوحة «مُجاب آليًّا».
export const AUTO_IDS = ['fin_rep_8', 'fin_debt_2', 'fin_debt_3', 'fin_gov_10'] as const

// (بند ١ + بند ٥ سيناريو) أسئلة [حجم:م/ك]/[حجم:ك] — لا تظهر للشركة الصغيرة (ق١٠).
export const SIZE_ML_IDS = new Set([
  'fin_plan_5', 'fin_plan_8',
  'fin_cash_6',
  'fin_debt_4', 'fin_debt_5', 'fin_debt_7', 'fin_debt_8', 'fin_debt_9',
  'fin_asset_1', 'fin_asset_2',
  'fin_tax_2', 'fin_tax_7', 'fin_tax_8', 'fin_tax_9',
  'fin_cost_4', 'fin_cost_5', 'fin_cost_9',
  'fin_sys_8',
  'fin_risk_2', 'fin_risk_9', 'fin_risk_10',
  'fin_gov_1', 'fin_gov_7',
])

/** يبني تهيئةً مُقسَّمة: يُخفي التكرارات + المُجاب آليًّا + (للصغيرة) أسئلة الحجم. */
export function layerFinanceConfig(config: MaturityConfig, opts: { isSmall: boolean }): MaturityConfig {
  const drop = (id: string) =>
    HIDDEN_IDS.has(id) || (AUTO_IDS as readonly string[]).includes(id) || (opts.isSmall && SIZE_ML_IDS.has(id))
  const sections = config.sections
    .map((s) => ({ ...s, questions: s.questions.filter((q) => !drop(q.id)) }))
    .filter((s) => s.questions.length > 0)
  return { ...config, sections }
}

export interface AutoAnsweredRow { id: string; label: string; value: 'yes' | 'no'; basis: string }

/**
 * (بند ٢) الإجابات الآليّة للأسئلة الأربعة — من finq/loans. لا اشتقاق من حقل فارغ.
 * fin_debt_2 يُجاب على عتبة السؤال المعروض نفسه (<٠٫٥) لتطابق النصّ (بند ٦ من المالك) —
 * تعارض ٠٫٥ مع عتبة المحرّك ١٫٠ (ق٦) مسجَّل ملاحظةً، لا يُصلَح في هذه الحزمة.
 */
export function financeAutoAnswers(finq: Record<string, number>, loans: Loan[] | undefined): AutoAnsweredRow[] {
  const out: AutoAnsweredRow[] = []
  const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v)

  const aging = deriveArAging(finq)
  if (aging && aging.value > 0) {
    const b4 = isNum(finq.FINQ_AR_B4_V) ? finq.FINQ_AR_B4_V : 0
    const ratio = b4 / aging.value
    out.push({ id: 'fin_rep_8', label: 'تقرير أعمار المدينين (AR aging) يشمل >٩٠ يوم؟',
      value: ratio > 0.25 ? 'no' : 'yes', basis: `شريحة +90 = ${Math.round(ratio * 100)}٪ من الذمم` })
  }
  if (isNum(finq.FINQ_DEBT) && isNum(finq.FINQ_EQUITY) && finq.FINQ_EQUITY > 0) {
    const de = finq.FINQ_DEBT / finq.FINQ_EQUITY
    out.push({ id: 'fin_debt_2', label: 'نسبة الدين إلى حقوق الملكيّة < ٠٫٥؟',
      value: de < 0.5 ? 'yes' : 'no', basis: `الدين/الملكية = ${Math.round(de * 100) / 100} (على عتبة السؤال <٠٫٥)` })
  }
  if (loans && loans.length > 0) {
    out.push({ id: 'fin_debt_3', label: 'جدول سداد ديون واضح يشمل كل القروض؟',
      value: 'yes', basis: `قائمة قروض (${loans.length}) موجودة` })
  }
  // الحوكمة س١٠ — استخدام المنصّة = تقييم دوريّ (قرار المالك ٦/د-٣ معتمد).
  out.push({ id: 'fin_gov_10', label: 'تقييم دوري لكفاءة الإدارة الماليّة؟',
    value: 'yes', basis: 'استخدام المنصّة نفسه = تقييم دوريّ (معتمد ٢٠٢٦-٠٨-٠٩)' })

  return out
}
