// ─── مُصنّف العميل — العمود الفقريّ المتكيّف (نقيّ، منطق قبل غلاف) ─────
// ⚠️ لا يستورد أيّ سطح — دالّة صرفة قابلة للاختبار معزولةً (نمط getNextStep/
// getRescueNext). يوحّد التصنيفين المبعثرين: يشتقّ **المستوى** من الحالة
// (صحّة/تدقيق) ويربطه بمسار الرحلة، فيصير مصدر القيادة الواحد.
//
// المنهجيّة (الحلقة المتكيّفة): قِس → صنّف (هنا) → وجّه (useGuidedNext) →
// نفّذ → أعِد القياس → صنّف من جديد. فالمستوى يرتقي تلقائيّاً مع التحسّن.
//
// 🔗 حدود الملكيّة (لا اشتقاق ثالث): مسار الرحلة (QUICK/MEDIUM/LONG) + مستوى
// العميل + قفل الفروع يُشتقّون من classify فقط؛ عمق أدوات التحليل ① من
// analysisPlanFor فقط. النظامان يقرآن الصحّة ولا يتناقضان — لا تشتقّ مساراً
// من عمق الأدوات ولا عمقاً من المسار.

import type { StrategyPath } from '@/types/user'

export type ClientLevel = 'assess' | 'emergency' | 'foundation' | 'growth' | 'excellence'

export interface ClassifyState {
  /** هل أُجري تدقيق إدارة (تتوفّر صحّة)؟ */
  hasAudit: boolean
  /** صحّة الإدارة ٪ من آخر تدقيق (null إن لا تدقيق). */
  healthPct: number | null
  /** منطقة الخطر إن توفّرت — RED تُجبر الطوارئ مهما كانت النسبة. */
  dangerZone?: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | null
  /**
   * سطر الربط الماليّ (§٥ COMPUTE_FINANCIAL_HEALTH_SPEC): صحّة `computeFinancialHealth`
   * كأرضيّةٍ للصحّة الإداريّة — عمليّةٌ ممتازةٌ بسيولةٍ ٠٫١١ ليست بخير.
   * ⚠️ **معتمد غير موصول بمصدرٍ حيّ بعد** (نمط branchLock أدناه): طبقة البيانات
   * المعاملاتيّة (Employee/FinancialTransaction) غير مبنيّة، فلا KPIs حقيقيّة تُغذّيه.
   * `null/undefined` → لا أثر إطلاقاً (سلوكٌ مطابقٌ للسابق). حين تُبنى الطبقة يمرّر
   * المتّصل `computeFinancialHealth(kpis).healthPct` هنا — لا قيمة مُختلَقة قبلها.
   */
  financialHealthPct?: number | null
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

  // §٥: الأرضيّة الماليّة تحدّ الصحّة الإداريّة — min، لا متوسّط (لا يُخفي طارئ سيولة).
  // dormant حتى يمرّر المتّصل قيمةً حقيقيّة؛ null/undefined → h كما هي.
  const h = s.financialHealthPct != null ? Math.min(s.healthPct, s.financialHealthPct) : s.healthPct
  // حين تكون الأرضيّة الماليّة هي القيد (لا التدقيق) نُبيّن السبب — لا خفضٌ صامت.
  const financialBinds = s.financialHealthPct != null && s.financialHealthPct < s.healthPct
  const finNote = financialBinds
    ? ` القيد الآن ماليّ لا إداريّ (الصحّة الماليّة ${Math.round(s.financialHealthPct as number)}٪ دون الإداريّة ${Math.round(s.healthPct)}٪) — عالِج السيولة/التحصيل أوّلاً.`
    : ''

  if (s.dangerZone === 'RED' || h < 40) {
    return {
      level: 'emergency', journeyPath: 'QUICK', icon: '🚨', labelAr: 'طوارئ',
      reasonAr: `الصحّة ${Math.round(h)}٪ — منطقة حمراء. أوقف النزيف بخطة الإنقاذ قبل أي تخطيط أطول. يرتقي المستوى بمجرّد تعافي الصحّة (≥٤٠٪).${finNote}`,
    }
  }
  if (h < 60) {
    return {
      level: 'foundation', journeyPath: 'QUICK', icon: '🧱', labelAr: 'تأسيسي',
      reasonAr: `الصحّة ${Math.round(h)}٪ — ثبّت الأساسيّات (إجراءات + فريق + قياس مبدئي). أعِد التدقيق ليرتقي للنموّ عند ٦٠٪.${finNote}`,
    }
  }
  if (h < 80) {
    return {
      level: 'growth', journeyPath: 'MEDIUM', icon: '🌱', labelAr: 'نموّ',
      reasonAr: `الصحّة ${Math.round(h)}٪ — الأساس متين. ابنِ للنموّ (توجّه + مبادرات + مؤشّرات). يرتقي للتميّز عند ٨٠٪.${finNote}`,
    }
  }
  return {
    level: 'excellence', journeyPath: 'LONG', icon: '🏆', labelAr: 'تميّز',
    reasonAr: `الصحّة ${Math.round(h)}٪ — إدارة ناضجة. حسّن للتميّز (سيناريوهات + تحسين مستمرّ + قياس دوريّ).${finNote}`,
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

// ─── قفل الفروع في الطوارئ فقط (قرار #٣) — وفاء الواجهة للمحرّك ──────────
// القاعدة الواحدة: في الطوارئ يُقفَل كل فرع غير موصى (رماديّ + تفسير)، فلا
// تناقض «سطح ضد محرّك». في كل مستوى آخر: حرّية كاملة (التوصية إرشاد لا إلزام).
// المخرج في الطوارئ ليس تخطّي التوصية، بل تجاوز *المستوى* يدويّاً (الباب الصحيح).

export interface BranchLock {
  isLocked: boolean
  /** تفسير القفل (لا منع صامت) — null حين غير مقفل. */
  lockReason: string | null
}

// ⚠️ احتياطيّ معتمد غير موصول (كشف الفحص ١٤ + الرقعة F): branchLock قفلُ فروعٍ
// للعميل الطارئ (مستوى emergency غير موصى) — معرَّف ومختبَر لكن **لا يستهلكه أيّ
// سطح بعد**. قفل المراحل 🔒 الحاليّ مالكه journey/stageStatus لا هذا. يُوصَل في
// موجة لاحقة حين يوجد سطح يحتاج قفل الفرع الطارئ — لا كود ميّت بلا بيان، ولا وصل
// متسرّع بلا سطح.
export function branchLock(level: ClientLevel, isRecommended: boolean): BranchLock {
  if (level === 'emergency' && !isRecommended) {
    return { isLocked: true, lockReason: '🔒 متاح بعد استقرار الوضع الحرج — أو غيّر المستوى يدويّاً إن كان التصنيف خاطئاً.' }
  }
  return { isLocked: false, lockReason: null }
}
