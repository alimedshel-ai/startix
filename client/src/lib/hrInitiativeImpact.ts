// ─── الرقعة F — جسر §د: إلحاق أثر الريال بهدف المبادرة المولّدة (مطابقة نصّيّة) ──
// دوالّ نقيّة بحتة: لا DB، لا واجهة، لا حالة. تأخذ نصّ مبادرة مولّدة + أساس §د
// المحفوظ (E/S/R من HR_QUANT.financial) + الأداء الفعليّ (HR_QUANT.actuals)،
// وتُعيد سطر هدفٍ بالريال حين يطابق النصّ أحد روافع §د الخمسة وله أثر موجب.
//
// سقف الصلاحية (ف٤ — قاعدة مغلقة): هذا الملفّ للعرض/الاشتقاق فقط. لا يُستورَد
// في classify/useRescue/البوابات — يقفله hrImpactGate.guard.test.ts.
// لا معرّفات DRV_* جديدة (ف٥): يعيد استعمال KPI_* عبر FINANCIAL_INDICATOR_IDS.

import {
  HR_QUANT_INDICATORS,
  FINANCIAL_INDICATOR_IDS,
  type QuantActuals,
} from './hrQuantIndicators'
import {
  computeHrFinancialImpact,
  type HrIndicators,
  type HrImpactResult,
} from './hrFinancialImpact'

/** أساس الأرقام المحفوظ في HR_QUANT.financial — يُقرأ، لا يُسأل من جديد (ف١). */
export interface HrFinancialBasis {
  headcount?: number
  avgMonthlySalary?: number
  annualRevenue?: number
}

/** روافع §د الخمسة — نفس مفاتيح FINANCIAL_INDICATOR_IDS ونتيجة الأثر. */
export type HrLever = keyof typeof FINANCIAL_INDICATOR_IDS

/** كلمات مفتاحيّة عربيّة لكل رافع — بعد التطبيع (بلا تشكيل، ا/ي/ه موحّدة). */
const LEVER_KEYWORDS: Record<HrLever, string[]> = {
  turnover: ['تسرب', 'دوران الموظف', 'دوران العمل', 'استقاله', 'استقالات', 'الاحتفاظ بالموظف', 'الاحتفاظ بالكفاء', 'ترك العمل', 'مغادره الموظف'],
  absence:  ['غياب', 'تغيب', 'غيابات', 'الحضور والانصراف', 'انضباط الحضور'],
  vacancy:  ['شغور', 'شواغر', 'وظائف شاغره', 'بطء التوظيف', 'تاخر التوظيف', 'ملء الوظائف'],
  enps:     ['رضا الموظف', 'رضا الموظفين', 'ولاء الموظف', 'معنويات', 'انتماء الموظف', 'enps', 'سعاده الموظف'],
  hrCost:   ['تكلفه الموارد البشريه', 'تكلفه الرواتب', 'كتله الاجور', 'تكلفه الموظفين', 'نفقات الموظفين', 'تكلفه hr'],
}

/** تطبيع خفيف للمطابقة — يزيل التشكيل ويوحّد أإآ→ا · ى→ي · ة→ه. */
function normalizeAr(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '') // تشكيل
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '') // تطويل
    .replace(/\s+/g, ' ')
    .trim()
}

/** يطابق نصّ مبادرة بأوّل رافع §د تظهر إحدى كلماته — أو null إن لم يطابق. */
export function matchLever(text: string | null | undefined): HrLever | null {
  if (!text) return null
  const t = normalizeAr(text)
  for (const lever of Object.keys(LEVER_KEYWORDS) as HrLever[]) {
    if (LEVER_KEYWORDS[lever].some((kw) => t.includes(normalizeAr(kw)))) return lever
  }
  return null
}

/** يبني مؤشّرات §د الخمسة من الأداء الفعليّ (نفس منطق HrQuantitativeSection). */
export function buildHrIndicators(actuals: QuantActuals): HrIndicators {
  const targetOf = (id: string) => HR_QUANT_INDICATORS.find((i) => i.id === id)!.target
  const rate = (id: string) => {
    const c = actuals[id]
    return c == null ? undefined : { current: c, target: targetOf(id) }
  }
  return {
    turnoverPct: rate(FINANCIAL_INDICATOR_IDS.turnover),
    absencePct:  rate(FINANCIAL_INDICATOR_IDS.absence),
    vacancyPct:  rate(FINANCIAL_INDICATOR_IDS.vacancy),
    enpsPoints:  rate(FINANCIAL_INDICATOR_IDS.enps),
    hrCostPct:   rate(FINANCIAL_INDICATOR_IDS.hrCost),
  }
}

/**
 * يحسب أثر §د الكامل — أو null حين ينقص أساس الأرقام (ف٣: لا بيانات = لا رقم
 * مختلَق). حُرّاس الراتب (>٥٠٬٠٠٠ / <١٬٠٠٠) تنبيهٌ في الواجهة لا يمنع الحساب (ف٢)،
 * فالحساب هنا يمضي ما دام الأساس موجوداً.
 */
export function hrImpactResult(
  basis: HrFinancialBasis | null | undefined,
  actuals: QuantActuals,
): HrImpactResult | null {
  if (!basis?.headcount || !basis?.avgMonthlySalary || !basis?.annualRevenue) return null
  return computeHrFinancialImpact(
    { headcount: basis.headcount, avgMonthlySalary: basis.avgMonthlySalary, annualRevenue: basis.annualRevenue },
    buildHrIndicators(actuals),
  )
}

/** بيانات هدف رافعٍ مطابق — أرقام خام (لا نصّ) لثبات الاختبار. */
export interface HrLeverGoal {
  lever: HrLever
  indicatorName: string
  unit: string
  current: number
  target: number
  direction: 'higher' | 'lower'
  annualImpactSAR: number
}

/**
 * يُعيد بيانات هدف الرافع المطابق للنصّ — أو null إن: لم يطابق · لا أثر محسوب ·
 * لا قيمة حاليّة مُدخَلة · الأثر ≤٠ (بلغ الهدف = لا توفير). لا اختلاق رقم.
 */
export function hrLeverGoal(
  text: string | null | undefined,
  actuals: QuantActuals,
  impact: HrImpactResult | null,
): HrLeverGoal | null {
  if (!impact) return null
  const lever = matchLever(text)
  if (!lever) return null
  const id = FINANCIAL_INDICATOR_IDS[lever]
  const ind = HR_QUANT_INDICATORS.find((i) => i.id === id)
  const current = actuals[id]
  if (!ind || current == null) return null
  const annualImpactSAR = impact[lever].annualImpactSAR
  if (!(annualImpactSAR > 0)) return null
  return {
    lever,
    indicatorName: ind.name,
    unit: ind.unit,
    current,
    target: ind.target,
    direction: ind.direction,
    annualImpactSAR,
  }
}

/** يصوغ سطر الهدف بالريال بحسب قالب ف٣ (خفض/رفع … = أثر متوقّع … سنوياً). */
export function formatHrGoal(g: HrLeverGoal): string {
  const verb = g.direction === 'lower' ? 'خفض' : 'رفع'
  const sar = `${Math.round(g.annualImpactSAR).toLocaleString('ar-SA')} ريال`
  return `🎯 هدف §د — ${verb} ${g.indicatorName} من ${g.current}${g.unit === '%' ? '٪' : ` ${g.unit}`} إلى ${g.target}${g.unit === '%' ? '٪' : ''} = أثر متوقّع ${sar} سنوياً`
}

/**
 * الواجهة المريحة للمولّد: نصّ المبادرة + الأداء + الأثر ← سطر هدف §د أو null.
 * يجمع المطابقة + الصياغة في نداءٍ واحد.
 */
export function hrGoalLineForText(
  text: string | null | undefined,
  actuals: QuantActuals,
  impact: HrImpactResult | null,
): string | null {
  const g = hrLeverGoal(text, actuals, impact)
  return g ? formatHrGoal(g) : null
}
