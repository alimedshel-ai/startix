// ─── المحرّك المعزول: اشتقاق «الفعليّ» من الأعداد (جدول العبور) ──────────────
// مطابقٌ لوثيقة docs/HR_QUANT_CROSSOVER.md v3.2 (§٣–§٥، موقَّعة 2026-08-04).
// القاعدة المُقفلة: «الأرقام تُدخَل والنِّسَب تُشتقّ — لا كتابة نِسَب تخميناً».
// نقيّ تماماً: يأخذ أعداداً (HRQ_*) ومقامات (FND_*) ويُرجع الفعليّ المشتقّ — لا يمسّ
// الواجهة ولا scoreQuant القائم (يبقيان كما هما حتى ترحيل الواجهة بعد الظلّ).

import { HR_QUANT_INDICATORS } from './hrQuantIndicators'

// أنواع الإدخال الثلاثة + خام + كتالوج (§١).
export type QuantInputKind = 'count' | 'derived' | 'manual' | 'raw' | 'catalog'

export interface CrossoverSpec {
  inputKind: QuantInputKind
  /** مفتاح البسط (HRQ_* أو FND_*) — للـ count/derived. */
  numerator?: string
  /** مفتاح المقام (FND_* أو HRQ_*). */
  denominator?: string
  /** مقامٌ ثانٍ يُضرب في الأوّل (مثل FND_WORK_DAYS). */
  denominatorFactor?: string
}

// جدول العبور — صفّاً بصفّ من §٣–§٥. count=عدد(ب) · derived=مشتقّ(أ) ·
// manual=يدويّ(ج) · raw=خام · catalog=يشتقّه محرّك السعودة (SaudizationSection).
export const QUANT_CROSSOVER: Record<string, CrossoverSpec> = {
  // 🎯 استراتيجي
  KPI_STR_01: { inputKind: 'count',   numerator: 'HRQ_HR_COST_YEAR',   denominator: 'FND_ANNUAL_REVENUE' },
  KPI_STR_02: { inputKind: 'count',   numerator: 'HRQ_LEAVERS_12M',    denominator: 'FND_HEADCOUNT' },
  KPI_STR_03: { inputKind: 'count',   numerator: 'HRQ_TOTAL_EXP_YEARS', denominator: 'FND_HEADCOUNT' },
  KPI_STR_04: { inputKind: 'catalog' }, // محرّك السعودة يشتقّها ويقفلها
  KPI_STR_05: { inputKind: 'derived' }, // الامتثال — تجميع خاصّ (أدناه)
  KPI_STR_06: { inputKind: 'derived', numerator: 'FND_ANNUAL_REVENUE', denominator: 'FND_HEADCOUNT' },
  KPI_STR_07: { inputKind: 'count',   numerator: 'HRQ_TRAINING_RETURN', denominator: 'HRQ_TRAINING_COST' }, // ROI التدريب — اقتراح قابل للتجاوز (ت٥/حزمة v2)
  KPI_STR_08: { inputKind: 'manual' },
  KPI_STR_09: { inputKind: 'count',   numerator: 'HRQ_RISKS_OPEN',     denominator: 'HRQ_RISKS_TOTAL' },
  // ⚔️ تكتيكي
  KPI_TAC_01: { inputKind: 'count', numerator: 'HRQ_HIRE_DAYS_SUM',    denominator: 'HRQ_HIRES_COUNT' },
  KPI_TAC_02: { inputKind: 'count', numerator: 'HRQ_VACANT',           denominator: 'HRQ_APPROVED_HEADCOUNT' },
  KPI_TAC_03: { inputKind: 'count', numerator: 'HRQ_HIRING_SPENT',     denominator: 'HRQ_HIRING_BUDGET' },
  KPI_TAC_04: { inputKind: 'count', numerator: 'HRQ_APPRAISED_Q',      denominator: 'FND_HEADCOUNT' },
  KPI_TAC_05: { inputKind: 'count', numerator: 'HRQ_KPI_MET',          denominator: 'HRQ_APPRAISED_Q' },
  KPI_TAC_06: { inputKind: 'count', numerator: 'HRQ_TRAINING_HOURS_M', denominator: 'FND_HEADCOUNT' },
  KPI_TAC_07: { inputKind: 'count', numerator: 'HRQ_PLANS_DONE',       denominator: 'HRQ_PLANS_TOTAL' },
  KPI_TAC_08: { inputKind: 'count', numerator: 'HRQ_PAYROLL_ONTIME',   denominator: 'HRQ_PAYROLL_TOTAL' },
  KPI_TAC_09: { inputKind: 'manual' },
  KPI_TAC_10: { inputKind: 'count', numerator: 'HRQ_ABSENCE_DAYS_M',   denominator: 'FND_HEADCOUNT', denominatorFactor: 'FND_WORK_DAYS' },
  KPI_TAC_11: { inputKind: 'count', numerator: 'HRQ_LATE_CASES_M',     denominator: 'FND_HEADCOUNT', denominatorFactor: 'FND_WORK_DAYS' },
  // 🧭 تشغيلي — OPR_01 عدد؛ الباقي خام
  KPI_OPR_01: { inputKind: 'count', numerator: 'HRQ_PRESENT_TODAY',    denominator: 'FND_HEADCOUNT' },
  KPI_OPR_02: { inputKind: 'raw' }, KPI_OPR_03: { inputKind: 'raw' }, KPI_OPR_04: { inputKind: 'raw' },
  KPI_OPR_05: { inputKind: 'raw' }, KPI_OPR_06: { inputKind: 'raw' }, KPI_OPR_07: { inputKind: 'raw' },
  KPI_OPR_08: { inputKind: 'raw' }, KPI_OPR_09: { inputKind: 'raw' }, KPI_OPR_10: { inputKind: 'raw' },
  KPI_OPR_11: { inputKind: 'raw' },
}

const UNIT_BY_ID: Record<string, string> = Object.fromEntries(HR_QUANT_INDICATORS.map((i) => [i.id, i.unit]))

// KPI_STR_05 الامتثال: متوسط (١ − مخالفات البند ÷ الموظفون) عبر العدّادات الأربعة، ثمّ ٪.
export const COMPLIANCE_COUNTERS = ['KPI_OPR_04', 'KPI_OPR_05', 'KPI_OPR_06', 'KPI_OPR_11']

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * يشتقّ «الفعليّ» لمؤشرٍ من الأعداد المُدخلة (HRQ_* أو OPR خام) والمقامات (FND_*).
 * يُرجِع الرقم المشتقّ، أو **null** إن كان يدويّاً/خاماً/كتالوجيّاً، أو نقص مدخلٌ،
 * أو المقام صفر/غير صالح (فلا يُختلَق رقم — «قيمة معلومة النقص أصدق»).
 * وحدة ٪ ⇒ يُضرب ×١٠٠؛ غيرها (سنة/يوم/ساعة/ريال) يبقى كما هو.
 */
export function deriveQuantActual(id: string, inputs: Record<string, number>): number | null {
  const spec = QUANT_CROSSOVER[id]
  if (!spec || spec.inputKind === 'manual' || spec.inputKind === 'raw' || spec.inputKind === 'catalog') {
    return null
  }

  if (id === 'KPI_STR_05') {
    const headcount = inputs.FND_HEADCOUNT
    if (!isFinite(headcount) || headcount <= 0) return null
    const rates: number[] = []
    for (const cid of COMPLIANCE_COUNTERS) {
      const v = inputs[cid]
      if (!isFinite(v)) return null
      rates.push(1 - v / headcount)
    }
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length
    return round2(mean * 100)
  }

  const num = spec.numerator ? inputs[spec.numerator] : NaN
  let den = spec.denominator ? inputs[spec.denominator] : NaN
  if (spec.denominatorFactor) den *= inputs[spec.denominatorFactor]
  if (!isFinite(num) || !isFinite(den) || den === 0) return null
  const factor = UNIT_BY_ID[id] === '%' ? 100 : 1
  return round2((num / den) * factor)
}
