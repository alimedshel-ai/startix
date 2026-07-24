// ─── ترتيب بطاقات تحليل ① في صفحة العميل (الرقعة A — ملحق الحارس) ─────
// الجزء التحليليّ من CORE_STEPS (ClientDetailPage) كمصدر واحد قابل للاختبار.
// بطاقات الصفحة غنيّة (وصف/healthMetric/warmup) فلا تُولَّد من analysisPlan،
// لكن **ترتيبها** يجب أن يبقى مطابقاً لـ BASE_ORDER. حارس analysisCardOrder.test
// يفشل عند أيّ انحراف (مثال: PESTEL قبل 7S) — بدل إعادة هيكلة كبيرة للبطاقات.
//
// '@audit' رمزٌ يُحلّ لمسار تدقيق التخصّص وقت التشغيل (الأساس — دائماً أوّلاً).

import { ANALYSIS_TOOLS } from '@/lib/analysisPlan'

export const AUDIT_PLACEHOLDER = '@audit'

export const ANALYSIS_CARD_ORDER: string[] = [
  AUDIT_PLACEHOLDER,
  ANALYSIS_TOOLS.s7.path,     // /internal-environment — البيئة الداخليّة (7S)
  ANALYSIS_TOOLS.pestel.path, // /manager/dept-pestel — المسح الخارجيّ (PESTEL)
]
