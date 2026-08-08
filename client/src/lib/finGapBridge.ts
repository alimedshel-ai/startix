// ─── ح٧: جسر الفجوة ← الخطة (ورقة ٩) — محرّك نقيّ يقرؤه محرّك الاقتراح ④ ─────────
// يترجم كل فجوة (ماليّة أو تنظيميّة) إلى «شدّة + أفق خطة». جدولٌ لا طبقة، ولا يمسّ
// المحرّك ولا الدرجة الحيّة (ق٧/ق٩). العتبات معتمدة من المالك 2026-08-09.
//
// معيار الشدّة (معلن، لا حكم صامت):
//  • extreme (قصوى) = مشتقّة من فيتو محرّك له سقف ملزم (٣٠/٤٥) — 90day.
//  • high (عالية) = خطر مباشر على النقد أو رقابة مفقودة — رأي مصمّم معتمد.
//  • medium (متوسطة) = فجوة بنيويّة لا تهدّد النقد فورًا — رأي مصمّم معتمد.

import type { FinancialKpis } from './financialHealth'
import { GOVERNANCE_BANK, type Ypn } from './finGovernanceBank'

export type Severity = 'extreme' | 'high' | 'medium'
export type Horizon = '90day' | 'quarterly' | 'annual'
export interface Gap { source: string; severity: Severity; horizon: Horizon; basis: string }

const n = (v: unknown): v is number => typeof v === 'number' && isFinite(v)

// الفجوات التنظيميّة المفصّلة (ورقة ٩/ج) — الباقي بقاعدة جماعيّة أدناه.
const GOV_EXPLICIT: Record<string, { severity: Severity; horizon: Horizon; basis: string }> = {
  t5_2: { severity: 'high', horizon: '90day', basis: 'تسوية بنكيّة من منفّذ العمليّات — خطر اختلاس مباشر' },
  t5_3: { severity: 'high', horizon: '90day', basis: 'لا جهة مستقلّة تراجع المدير المالي — رقابة القائد مفقودة' },
  t5_1: { severity: 'high', horizon: 'quarterly', basis: 'لا جرد مفاجئ على الصندوق/المال' },
  t2_1: { severity: 'medium', horizon: 'quarterly', basis: 'لا مصفوفة صلاحيّات موثّقة — مفتاح بقيّة الضوابط' },
  t5_5: { severity: 'medium', horizon: 'quarterly', basis: 'قرارات المالك الاستثنائيّة غير موثّقة' },
}
const GOV_IDS = new Set(GOVERNANCE_BANK.flatMap((g) => g.questions.map((q) => q.id)))

/**
 * يبني قائمة الفجوات ← الشدّة ← الأفق من إشارات الطبقة ١/٢ + إجابات الحوكمة.
 * لا شيء هنا يدخل الدرجة الحيّة (ق٩) — مُدخَل لمحرّك الاقتراح ④ يؤكّده المستخدم.
 */
export function buildGapBridge(input: {
  kpis?: Partial<FinancialKpis>
  vetoes?: string[]
  monthlyInstallments?: number
  monthlyNetProfit?: number
  overdueRatio?: number // (B3+B4) ÷ مجموع الشرائح
  governance?: Record<string, Ypn>
}): Gap[] {
  const gaps: Gap[] = []
  const k = input.kpis ?? {}
  const v = input.vetoes ?? []

  // ── الفجوات الماليّة (ورقة ٩/ب) ──
  if ((n(k.instantLiquidity) && k.instantLiquidity < 0.5) || v.includes('INSTANT_LIQUIDITY'))
    gaps.push({ source: 'فيتو السيولة', severity: 'extreme', horizon: '90day', basis: 'سقف ٣٠ ملزم — موقف نقديّ طارئ' })
  if ((n(k.collectionRate) && k.collectionRate < 0.70) || v.includes('COLLECTION_RATE'))
    gaps.push({ source: 'فيتو التحصيل', severity: 'extreme', horizon: '90day', basis: 'سقف ٤٥ ملزم — نزيف تحصيل نشط' })
  if (v.includes('RECEIVABLES'))
    gaps.push({ source: 'ضغط الذمم', severity: 'high', horizon: 'quarterly', basis: 'سقف ٥٠ ملزم — تراكم مزمن لا طارئ يوميّ' })
  if (n(k.debtToEquity) && k.debtToEquity > 1.0)
    gaps.push({ source: 'الملاءة', severity: 'high', horizon: 'quarterly', basis: 'دين/ملكية > ١ — إعادة هيكلة لا إطفاء حريق' })
  // عبء خدمة الدين — عتبة ٥٠٪ معتمدة (تحذيريّة، تُستبدل بـDSCR عند ط٤).
  if (n(input.monthlyInstallments) && n(input.monthlyNetProfit) && input.monthlyNetProfit > 0 &&
      input.monthlyInstallments / input.monthlyNetProfit > 0.5)
    gaps.push({ source: 'عبء خدمة الدين', severity: 'high', horizon: '90day', basis: 'الأقساط > ٥٠٪ من صافي الربح الشهريّ (عتبة تحذيريّة معتمدة)' })
  // المتأخر — عتبة ٣٥٪ معتمدة (B3+B4، فوق ٦٠ يومًا).
  if (n(input.overdueRatio) && input.overdueRatio > 0.35)
    gaps.push({ source: 'المتأخر فوق ٦٠ يومًا', severity: 'high', horizon: 'quarterly', basis: '(B3+B4) > ٣٥٪ من الذمم (عتبة معتمدة)' })

  // ── الفجوات التنظيميّة (ورقة ٩/ج) — «لا» فجوة، «جزئياً» استكمال سنويّ ──
  const gov = input.governance ?? {}
  for (const id of Object.keys(gov)) {
    if (!GOV_IDS.has(id)) continue
    const a = gov[id]
    if (a === 'no') {
      const ex = GOV_EXPLICIT[id]
      gaps.push(ex ? { source: id, ...ex } : { source: id, severity: 'medium', horizon: 'quarterly', basis: 'فجوة تنظيميّة بنيويّة (قاعدة جماعيّة)' })
    } else if (a === 'partial') {
      gaps.push({ source: id, severity: 'medium', horizon: 'annual', basis: 'استكمال لا إنشاء (قاعدة جماعيّة: جزئياً ← سنويّ)' })
    }
  }

  return gaps
}
