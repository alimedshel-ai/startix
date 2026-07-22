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

// ─── مصالحة الآليّ ↔ اليدويّ + كشف التقادم (جوهر التكيّف) ─────────────
// المشتقّ من الصحّة (auto) قد يفارق اختيار المستخدم اليدويّ (user.strategyPath).
// حين يفارقه: is_stale = صحيح، والاتّجاه يكشف «تحسّنت → ترقَّ» أو «تراجعت → تنبيه».
// هذا ما كان غائباً: إشارة «مستواك اليدويّ لم يعد يطابق بياناتك».

export type StaleDirection = 'upgrade' | 'downgrade' | null

const PATH_WEIGHT: Record<StrategyPath, number> = { QUICK: 1, MEDIUM: 2, LONG: 3 }
const PATH_LABEL: Record<StrategyPath, string> = { QUICK: 'تشغيلي (قصير)', MEDIUM: 'تكتيكي (متوسّط)', LONG: 'استراتيجي (طويل)' }

export interface LevelResolution {
  /** التصنيف الآليّ المشتقّ من الصحّة. */
  auto: ClientClass
  /** المسار الذي يقود فعلاً: اليدويّ إن وُجد، وإلّا المشتقّ. */
  activePath: StrategyPath
  /** هل اليدويّ فارق المشتقّ؟ */
  isStale: boolean
  /** upgrade = بياناتك تحسّنت فوق مسارك · downgrade = تراجعت تحته. */
  direction: StaleDirection
  why: string
}

export function reconcileLevel(auto: ClientClass, manualPath: StrategyPath | null): LevelResolution {
  const autoPath = auto.journeyPath // null حين assess (لا تدقيق بعد)

  // لا يدويّ أو لا آليّ (قبل القياس) → لا تقادم؛ المشتقّ (أو اليدويّ) يقود.
  if (!manualPath || !autoPath) {
    return { auto, activePath: manualPath ?? autoPath ?? 'LONG', isStale: false, direction: null, why: auto.reasonAr }
  }
  if (autoPath === manualPath) {
    return { auto, activePath: manualPath, isStale: false, direction: null, why: 'مسارك اليدويّ يطابق وضع الإدارة الحاليّ.' }
  }
  const direction: StaleDirection = PATH_WEIGHT[autoPath] > PATH_WEIGHT[manualPath] ? 'upgrade' : 'downgrade'
  const why = direction === 'upgrade'
    ? `تحسّنت بيانات إدارتك — يسمح وضعك بالترقّي من «${PATH_LABEL[manualPath]}» إلى «${PATH_LABEL[autoPath]}».`
    : `تنبيه: بياناتك تشير إلى وضع أدنى («${PATH_LABEL[autoPath]}») من مسارك اليدويّ «${PATH_LABEL[manualPath]}» — راجِع.`
  // اليدويّ يبقى «الفعّال» (لا نغيّره تلقائيّاً) — نعرض الإشارة ليقرّر المستخدم.
  return { auto, activePath: manualPath, isStale: true, direction, why }
}
