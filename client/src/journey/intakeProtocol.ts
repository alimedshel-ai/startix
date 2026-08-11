// ─── ③ بروتوكول الاستلام (المخرج ١) — مُترجِمٌ نقيّ، لا محرّك جديد ─────────────
// يترجم حالة العميل إلى: «أنت في حالة X — ابدأ بمنتج Y — المدّة المتوقّعة Z».
// المحوران (لا اشتقاق ثالث): المستوى الماليّ/الإداريّ من classifyClient (المحور الأوّل،
// يقود المسار)، و GOV overallPct من scoreGovernance (المحور التنظيميّ، يُنقّح لا يقلب).
// نمط classify/getNextStep: دالّة صرفة معزولة قابلة للاختبار — لا سطح، لا artifact.

import type { ClientLevel } from './classify'

/** خطوة منتج في المسار — available: مبنيّ اليوم (✅) مقابل قادم (🔜). صدقٌ لا منتج وهميّ. */
export interface ProductStep { label: string; available: boolean }

export interface IntakeProtocol {
  statusIcon: string
  statusLabel: string
  /** المخرج المتوقَّع (Z في «ابدأ بمنتج Y — المخرج Z»). */
  expectedOutput: string
  duration: string
  /** ترتيب المنتجات — الأوّل هو نقطة البدء الموصى بها. */
  productPath: ProductStep[]
  reason: string
  /** تنقيح المحور التنظيميّ (GOV overallPct) — لا يقلب المستوى. */
  orgNote: string
}

const P = (label: string, available = false): ProductStep => ({ label, available })

// المبنيّ اليوم (✅) — يُطابق ما شُحن فعلًا؛ الباقي 🔜 (لم يُبنَ بعد، انظر تقرير الفجوات).
const MATURITY = P('تدقيق النضج', true)
const COST = P('مركز التكاليف', true)
const CASH = P('توقّع النقدية ١٣ أسبوعًا', true)
const RESCUE = P('خطة الإنقاذ (RCM)', true)
const OWNER = P('تقرير المالك الشهريّ')          // 🔜 المخرج ١٠
const UNIT = P('اقتصاديات الوحدة')                // 🔜 المخرج ٥
const NINETY = P('خطة ٩٠ يومًا')                  // 🔜 المخرج ٩
const BUDGET = P('الموازنة والانحرافات')           // 🔜 المخرج ٨+١١
const FEAS = P('الجدوى (NPV/IRR) والاستراتيجية')   // 🔜 المخرج ٧+١٧

// المستوى الماليّ → الحالة + المسار (يعكس journeyPath: طوارئ→إنقاذ، وهكذا).
const BASE: Record<ClientLevel, Omit<IntakeProtocol, 'orgNote'>> = {
  assess: {
    statusIcon: '🩺', statusLabel: 'قِس أوّلاً',
    expectedOutput: 'تدقيق إدارة يحدّد وجهتك — كلّ ما بعده يُشتقّ من نتيجته',
    duration: 'خطوة واحدة الآن',
    productPath: [MATURITY],
    reason: 'لا تدقيق بعد — ابدأ بالقياس قبل أيّ مسار.',
  },
  emergency: {
    statusIcon: '🚨', statusLabel: 'طوارئ — أوقِف النزيف',
    expectedOutput: 'إيقاف النزيف النقديّ خلال ٩٠ يومًا حرجة',
    duration: '٩٠ يومًا حرجة',
    productPath: [RESCUE, CASH, COST],
    reason: 'الصحّة في المنطقة الحمراء — الإنقاذ قبل أيّ تخطيط أطول.',
  },
  foundation: {
    statusIcon: '🧱', statusLabel: 'تأسيسيّ',
    expectedOutput: 'تثبيت الأساسيّات: تكاليف مضبوطة + رؤية نقديّة + تقرير شهريّ',
    duration: 'ربع سنة',
    productPath: [COST, CASH, OWNER],
    reason: 'الأساس يحتاج تثبيتًا — رتّب التكاليف والنقد ثمّ ارفع تقريرًا دوريًّا.',
  },
  growth: {
    statusIcon: '🌱', statusLabel: 'نموّ',
    expectedOutput: 'بناءٌ للنموّ: ربحيّة الوحدة + تقرير المالك + خطة تنفيذ',
    duration: '٦–١٢ شهرًا',
    productPath: [CASH, UNIT, OWNER, NINETY],
    reason: 'الأساس متين — ابنِ لاقتصاديات الوحدة وخطة نموّ مقيسة.',
  },
  excellence: {
    statusIcon: '🏆', statusLabel: 'تميّز',
    expectedOutput: 'تحسينٌ مستمرّ: موازنة وانحرافات + جدوى واستراتيجيّة',
    duration: 'دورة سنويّة متجدّدة',
    productPath: [OWNER, BUDGET, FEAS],
    reason: 'إدارة ناضجة — حسّن بالموازنة والجدوى والقياس الدوريّ.',
  },
}

// المحور التنظيميّ (GOV overallPct): null = لم يُقيَّم؛ وإلّا شدّة الرقابة.
function orgNote(govPct: number | null): string {
  if (govPct == null) return 'الحوكمة غير مقيَّمة بعد — أضِف تقييم الحوكمة لإكمال صورة الاستلام.'
  if (govPct < 40) return `رقابة/حوكمة ضعيفة (${govPct}٪) — قدِّم ضبط الحوكمة مبكّرًا ضمن المسار.`
  if (govPct < 70) return `رقابة/حوكمة متوسّطة (${govPct}٪) — استكمِل الضوابط الناقصة تدريجيًّا.`
  return `رقابة/حوكمة متينة (${govPct}٪) — ركّز على المخرجات الماليّة مباشرة.`
}

/** يبني بطاقة الاستلام من المحورين. govPct=null (افتراضيّ) حين لا تقييم حوكمة. */
export function intakeProtocol(level: ClientLevel, govPct: number | null = null): IntakeProtocol {
  return { ...BASE[level], orgNote: orgNote(govPct) }
}
