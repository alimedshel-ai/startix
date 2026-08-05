// ─── توصية المسار الاستراتيجيّ من الإشارات الماليّة (نقيّ، معزول) ──────────
// يربط التشخيص المبدئيّ بشريحة «المسار» في /onboarding: بدل اختيارٍ يدويّ أعمى،
// نشتقّ المسار الموصى به من إشارتين ماليّتين يجمعهما التشخيص فعلاً — السيولة
// والتتبّع الماليّ.
//
// المبدأ (نفس فلسفة computeFinancialHealth): **الأضعف يقيّد** — سيولةٌ حرجة تفرض
// المسار التشغيليّ مهما نضج التتبّع، وغيابُ التتبّع يمنع مساراً طويلاً مهما
// ارتفعت السيولة (لا تخطيط بعيد بلا رؤية ماليّة). نأخذ min الطبقتين، لا متوسّطاً.
//
// **دالّة صرفة:** لا DB، لا واجهة (نمط classify/financialHealth). توصيةٌ لا إلزام —
// المتّصل يُبرزها ويُحدّدها مسبقاً، ويبقى للمستخدم تغييرها.

import type { StrategyPath } from '@/types/user'

export type LiquiditySignal = 'critical' | 'low' | 'mid' | 'high'
export type FinancialTrackingSignal = 'none' | 'manual' | 'good' | 'perfect'

// طبقة كل إشارة ٠..٢ → المسار (٠ تشغيليّ · ١ تكتيكيّ · ٢ استراتيجيّ).
// السيولة: حرجة/منخفضة = ٠ (أقلّ من ٣ أشهر مدرجٌ حرج للتخطيط)، متوسّطة ١، مرتفعة ٢.
const LIQ_TIER: Record<LiquiditySignal, number> = { critical: 0, low: 0, mid: 1, high: 2 }
// التتبّع: لا تتبّع ٠، يدويّ ١، نظام محاسبيّ/لوحات ٢.
const TRACK_TIER: Record<FinancialTrackingSignal, number> = { none: 0, manual: 1, good: 2, perfect: 2 }
const PATH_BY_TIER: StrategyPath[] = ['QUICK', 'MEDIUM', 'LONG']

export interface PathRecommendation {
  path: StrategyPath
  /** الإشارة التي قيّدت الاختيار (الأضعف) — تُبرَز في «موصى به لأنّ…». */
  binding: 'liquidity' | 'tracking'
  reasonAr: string
}

/**
 * يوصي بمسارٍ من الإشارات الماليّة. يعمل بإشارةٍ واحدةٍ إن توفّرت فقط؛ يُرجِع null
 * حين لا إشارة (فلا توصية — يبقى الاختيار يدويّاً محضاً).
 */
export function recommendPathFromFinancials(sig: {
  liquidity?: LiquiditySignal | null
  financialTracking?: FinancialTrackingSignal | null
}): PathRecommendation | null {
  const liq = sig.liquidity != null ? LIQ_TIER[sig.liquidity] : null
  const track = sig.financialTracking != null ? TRACK_TIER[sig.financialTracking] : null
  if (liq == null && track == null) return null

  // الأضعف يقيّد؛ عند وجود إشارةٍ واحدةٍ فقط نعتمدها. التعادل → السيولة (الأولى بالأثر).
  const liqBinds = liq != null && (track == null || liq <= track)
  const tier = Math.min(liq ?? Infinity, track ?? Infinity)
  const path = PATH_BY_TIER[tier]
  const binding: 'liquidity' | 'tracking' = liqBinds ? 'liquidity' : 'tracking'

  const reasonAr = binding === 'liquidity'
    ? liqReason(sig.liquidity as LiquiditySignal)
    : trackReason(sig.financialTracking as FinancialTrackingSignal)

  return { path, binding, reasonAr }
}

function liqReason(l: LiquiditySignal): string {
  switch (l) {
    case 'critical': return 'سيولتك حرجة (أقلّ من شهر) — ابدأ تشغيليّاً: أوقِف نزيف السيولة قبل أيّ تخطيط أطول.'
    case 'low':      return 'سيولتك منخفضة (١–٣ أشهر) — مسارٌ تشغيليّ قصير حتى تستقرّ السيولة.'
    case 'mid':      return 'سيولتك متوسّطة (٣–٦ أشهر) — مسارٌ تكتيكيّ بقرارات ربعيّة يناسب وضعك.'
    case 'high':     return 'سيولتك مرتفعة (٦+ أشهر) — تحتمل مساراً استراتيجيّاً طويل الأمد.'
  }
}

function trackReason(t: FinancialTrackingSignal): string {
  switch (t) {
    case 'none':    return 'لا تتبّع ماليّ بعد — ابدأ تشغيليّاً وابنِ رؤية ماليّة قبل التخطيط الأبعد.'
    case 'manual':  return 'تتبّعك الماليّ يدويّ — مسارٌ تكتيكيّ متوسّط ريثما ينضج نظامك المحاسبيّ.'
    case 'good':    return 'تتبّعك الماليّ ناضج (إقفال شهريّ) — يسمح بمسارٍ استراتيجيّ أطول.'
    case 'perfect': return 'تتبّعك الماليّ لحظيّ ومدقَّق — بنيةٌ تحتمل التخطيط الاستراتيجيّ الطويل.'
  }
}
