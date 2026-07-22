// ─── مُصنّف العميل — العمود الفقريّ المتكيّف (نقيّ، منطق قبل غلاف) ─────
// ⚠️ لا يستورد أيّ سطح — دالّة صرفة قابلة للاختبار معزولةً (نمط getNextStep/
// getRescueNext). يوحّد التصنيفين المبعثرين: يشتقّ **المستوى** من الحالة
// (صحّة/تدقيق) ويربطه بمسار الرحلة، فيصير مصدر القيادة الواحد.
//
// المنهجيّة (الحلقة المتكيّفة): قِس → صنّف (هنا) → وجّه (useGuidedNext) →
// نفّذ → أعِد القياس → صنّف من جديد. فالمستوى يرتقي تلقائيّاً مع التحسّن.

import type { StrategyPath } from '@/types/user'

export type ClientLevel = 'assess' | 'emergency' | 'foundation' | 'growth' | 'excellence'

export interface ClassifyState {
  /** هل أُجري تدقيق إدارة (تتوفّر صحّة)؟ */
  hasAudit: boolean
  /** صحّة الإدارة ٪ من آخر تدقيق (null إن لا تدقيق). */
  healthPct: number | null
  /** منطقة الخطر إن توفّرت — RED تُجبر الطوارئ مهما كانت النسبة. */
  dangerZone?: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | null
}

export interface ClientClass {
  level: ClientLevel
  /** مسار الرحلة المُشتقّ الذي يقود المحرّك (null لـ assess — لا مسار قبل القياس). */
  journeyPath: StrategyPath | null
  icon: string
  labelAr: string
  /** لماذا هذا المستوى الآن + طابع التكيّف. */
  reasonAr: string
}

// عتبات موحّدة مع pickStrategicPath: <٤٠ طوارئ · ٤٠-٥٩ تأسيسي · ٦٠-٧٩ نموّ · ≥٨٠ تميّز.
// خريطة المستوى → مسار الرحلة (QUICK/MEDIUM/LONG):
//   الطوارئ + التأسيسي → تشغيلي (QUICK) · النموّ → تكتيكي (MEDIUM) · التميّز → استراتيجي (LONG).
export function classifyClient(s: ClassifyState): ClientClass {
  // (assess) — لا تدقيق بعد: القياس أوّلاً، لا مسار قبله.
  if (!s.hasAudit || s.healthPct == null) {
    return {
      level: 'assess', journeyPath: null, icon: '🩺', labelAr: 'قِس أوّلاً',
      reasonAr: 'ابدأ بتدقيق الإدارة — كل شيء بعده يُشتقّ من نتيجته ويتكيّف معها.',
    }
  }

  const h = s.healthPct

  if (s.dangerZone === 'RED' || h < 40) {
    return {
      level: 'emergency', journeyPath: 'QUICK', icon: '🚨', labelAr: 'طوارئ',
      reasonAr: `الصحّة ${Math.round(h)}٪ — منطقة حمراء. أوقف النزيف بخطة الإنقاذ قبل أي تخطيط أطول. يرتقي المستوى بمجرّد تعافي الصحّة (≥٤٠٪).`,
    }
  }
  if (h < 60) {
    return {
      level: 'foundation', journeyPath: 'QUICK', icon: '🧱', labelAr: 'تأسيسي',
      reasonAr: `الصحّة ${Math.round(h)}٪ — ثبّت الأساسيّات (إجراءات + فريق + قياس مبدئي). أعِد التدقيق ليرتقي للنموّ عند ٦٠٪.`,
    }
  }
  if (h < 80) {
    return {
      level: 'growth', journeyPath: 'MEDIUM', icon: '🌱', labelAr: 'نموّ',
      reasonAr: `الصحّة ${Math.round(h)}٪ — الأساس متين. ابنِ للنموّ (توجّه + مبادرات + مؤشّرات). يرتقي للتميّز عند ٨٠٪.`,
    }
  }
  return {
    level: 'excellence', journeyPath: 'LONG', icon: '🏆', labelAr: 'تميّز',
    reasonAr: `الصحّة ${Math.round(h)}٪ — إدارة ناضجة. حسّن للتميّز (سيناريوهات + تحسين مستمرّ + قياس دوريّ).`,
  }
}
