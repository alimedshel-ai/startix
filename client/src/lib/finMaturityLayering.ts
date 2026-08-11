// ─── تقسيم طبقة نضج المالية (طبقة فوقيّة على FINANCE فقط) ─────────────────────
// لا يمسّ financeMaturity.ts (الأسئلة) ولا maturityEngine.ts (الحساب) — يُنتج تهيئةً
// مُقسَّمة تُمرَّر لـ MaturityAssessment المشترك نفسه (إعادة استخدام، لا عرض موازٍ).
//
// المصدر: ح٥ (بنك طبقات الجمع، حسم المالك 2026-08-09) + **توسعة v3 المعتمَدة 2026-08-11**
// (جدول أحكام تخفيف الـ٩٢). v3 تُوسّع نظام ح٥ الحيّ لا تستبدله: تقسيمٌ مُتحقَّق للمئة
// سؤال إلى فئةٍ واحدة لكلٍّ (تقاطع صفر · تغطية ١٠٠). العدّ الناتج (بعد شحن الأدوات):
//   صغيرة ٢٢ · متوسّطة ٦٢ · كبيرة ٨٢ — لا يُحذَف سؤال (إخفاء/وسم/دمج/ترحيل موثّق).

import type { MaturityConfig } from './maturityEngine'
import { deriveArAging, type Loan } from './finAgingDerive'
import { breakEven } from './finQuantDerive'

// (ح٥ بند٣ + v3) إخفاء تكرارات مؤكَّدة — تُبقى أصولها ظاهرة. gov_3 مضاف بـv3
// (تطابق نصّيّ شبه حرفيّ مع «حدود الاعتماد المتدرّجة» في بنك التنظيم).
export const HIDDEN_IDS = new Set(['fin_asset_9', 'fin_cost_6', 'fin_risk_7', 'fin_gov_3'])

// (ح٥ بند٢) أسئلة تُجاب آليًّا من الكمّي — تُخفى دائمًا وتُعرَض في لوحة «مُجاب آليًّا».
export const AUTO_IDS = ['fin_rep_8', 'fin_debt_2', 'fin_debt_3', 'fin_gov_10'] as const

// (v3) دمج: الطرف المؤرشَف من كل زوج (سؤالان لقياس واحد) — يُخفى من الكلّ، ويبقى
// الطرف المستوعِب. الخريطة توثّق مَن يستوعب مَن (المرجع الأعلى: المصنّف الموقَّع ورقة٦).
export const MERGED_IDS = new Set(['fin_rep_1', 'fin_rep_7', 'fin_cash_8', 'fin_cash_9', 'fin_tax_10', 'fin_cost_3'])
export const MERGE_SURVIVOR: Record<string, string> = {
  fin_rep_1: 'fin_sys_1',    // ERP محاسبيّ ← ERP ماليّ متكامل
  fin_rep_7: 'fin_plan_4',   // تكاليف مقابل ميزانية ← تحليل الانحراف
  fin_cash_8: 'fin_risk_4',  // مخاطر الصرف ← تحليل مخاطر السوق
  fin_cash_9: 'fin_risk_4',  // مخاطر الفائدة ← تحليل مخاطر السوق
  fin_tax_10: 'fin_risk_1',  // سياسة الحوكمة الماليّة ← سياسة إدارة المخاطر
  fin_cost_3: 'fin_cost_7',  // ربحيّة العميل (CAC+LTV) ← ربحيّة حسب العميل (customer P&L)
}

// (v3) ترحيل الطبقة ٤ (قرار٧): DSCR الحقيقيّ في ط٤؛ يُخفى من التقييم الحاليّ.
export const DEFERRED_IDS = new Set(['fin_debt_6'])

// (v3) آليّ مشروط: يُجاب من أداة المنصّة **عند اكتمال مدخلاتها فقط** (بمصدر ظاهر)؛
// دونها يبقى سؤالًا يدويًّا (خلاف الآليّ ح٥ الذي يُخفى دائمًا).
export const COND_AUTO_IDS = new Set(['fin_plan_7', 'fin_rep_4', 'fin_cash_1'])

// (v3) وسم الحجم بطبقتين:
//   [ك]   SIZE_K_IDS  — تظهر للكبيرة فقط (تُخفى للصغيرة والمتوسّطة).
//   [م/ك] SIZE_MK_IDS — تظهر للمتوسّطة والكبيرة (تُخفى للصغيرة فقط).
export const SIZE_K_IDS = new Set([
  'fin_plan_5', 'fin_plan_8',
  'fin_cash_6', 'fin_cash_7',
  'fin_debt_4', 'fin_debt_9',
  'fin_asset_4', 'fin_asset_5',
  'fin_tax_7', 'fin_tax_9',
  'fin_cost_5', 'fin_cost_9',
  'fin_sys_6', 'fin_sys_8',
  'fin_risk_2', 'fin_risk_4', 'fin_risk_8', 'fin_risk_9', 'fin_risk_10',
  'fin_gov_8',
])
export const SIZE_MK_IDS = new Set([
  'fin_plan_2', 'fin_plan_4', 'fin_plan_6', 'fin_plan_9',
  'fin_rep_5', 'fin_rep_9', 'fin_rep_10',
  'fin_cash_5',
  'fin_debt_5', 'fin_debt_7', 'fin_debt_8', 'fin_debt_10',
  'fin_asset_1', 'fin_asset_2', 'fin_asset_3', 'fin_asset_6', 'fin_asset_7',
  'fin_tax_2', 'fin_tax_4', 'fin_tax_6', 'fin_tax_8',
  'fin_cost_2', 'fin_cost_4', 'fin_cost_7', 'fin_cost_8', 'fin_cost_10',
  'fin_sys_2', 'fin_sys_4', 'fin_sys_5', 'fin_sys_7', 'fin_sys_9', 'fin_sys_10',
  'fin_risk_1', 'fin_risk_5', 'fin_risk_6',
  'fin_gov_1', 'fin_gov_5', 'fin_gov_6', 'fin_gov_7', 'fin_gov_9',
])

// الطبقات الثلاث — تُشتقّ من حجم الشركة (CompanySize). المجهول ⇒ «كبيرة» (لا نُخفي
// بالخطأ: أظهِر أكثر عند الشكّ، لا أقلّ).
export type FinSizeTier = 'small' | 'medium' | 'large'
export function financeTier(size: string | null | undefined): FinSizeTier {
  if (size === 'MICRO' || size === 'SMALL') return 'small'
  if (size === 'MEDIUM') return 'medium'
  return 'large'
}

/**
 * يبني تهيئةً مُقسَّمة حسب الطبقة (v3): يُخفي دائمًا التكرارات + المُجاب آليًّا (ح٥) +
 * المدموج + المُرحَّل ط٤؛ ويُخفي المُجاب آليًّا-مشروطًا **عند جاهزيّة أداته** (answeredIds)؛
 * ويُخفي أسئلة الحجم حسب الطبقة ([ك] للصغيرة+المتوسّطة، [م/ك] للصغيرة).
 */
export function layerFinanceConfig(
  config: MaturityConfig,
  opts: { tier: FinSizeTier; answeredIds?: ReadonlySet<string> },
): MaturityConfig {
  const { tier, answeredIds } = opts
  const drop = (id: string) =>
    HIDDEN_IDS.has(id) ||
    (AUTO_IDS as readonly string[]).includes(id) ||
    MERGED_IDS.has(id) ||
    DEFERRED_IDS.has(id) ||
    (COND_AUTO_IDS.has(id) && !!answeredIds?.has(id)) ||   // مشروط: يُخفى فقط حين يُجاب
    (tier !== 'large' && SIZE_K_IDS.has(id)) ||             // [ك]  — كبيرة فقط
    (tier === 'small' && SIZE_MK_IDS.has(id))               // [م/ك] — متوسّطة وكبيرة
  const sections = config.sections
    .map((s) => ({ ...s, questions: s.questions.filter((q) => !drop(q.id)) }))
    .filter((s) => s.questions.length > 0)
  return { ...config, sections }
}

export interface AutoAnsweredRow { id: string; label: string; value: 'yes' | 'no'; basis: string }

/**
 * الإجابات الآليّة — من finq/loans. لا اشتقاق من حقل فارغ.
 * • ح٥ (٤): rep_8/debt_2/debt_3/gov_10 — تُدفَع عند توفّر بياناتها (gov_10 دائمًا).
 * • v3 مشروط (٣): plan_7 (التعادل) عند اكتمال المدخلات الثلاثة · rep_4/cash_1 (نقدية
 *   ١٣ أسبوع) عند توفّر النقد الافتتاحيّ — بمصدر ظاهر بجانب كلٍّ.
 * fin_debt_2 يُجاب على عتبة السؤال المعروض نفسه (<٠٫٥) لتطابق النصّ (ح٥ بند٦).
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

  // ── v3 آليّ مشروط ──
  // plan_7 التعادل — يُجاب حين تكتمل المدخلات الثلاثة (تُحسب النقطة فعلًا).
  const be = breakEven(finq.FINQ_FIXED_COSTS, finq.FINQ_VAR_COST_UNIT, finq.FINQ_PRICE_UNIT)
  if (be) {
    out.push({ id: 'fin_plan_7', label: 'تحليل نقطة التعادل مُحدَّث؟',
      value: 'yes', basis: be.noBreakEven
        ? 'التعادل مُحتسَب — السعر لا يغطّي التكلفة المتغيّرة (لا نقطة)'
        : `التعادل مُحتسَب: ${be.units} وحدة/شهر` })
  }
  // rep_4/cash_1 نقدية ١٣ أسبوع — تُجاب حين يوجد نقد افتتاحيّ (الأداة تُنتج مدى السيولة).
  if (isNum(finq.FND_CASH)) {
    const basis = `توقّع النقدية ١٣ أسبوعًا مُشغَّل (نقد افتتاحيّ ${Math.round(finq.FND_CASH).toLocaleString('en-US')} ﷼)`
    out.push({ id: 'fin_cash_1', label: 'توقّع نقدي أسبوعي (cash forecast)؟', value: 'yes', basis })
    out.push({ id: 'fin_rep_4', label: 'تقرير تدفّق نقدي دوري؟', value: 'yes', basis })
  }

  return out
}
