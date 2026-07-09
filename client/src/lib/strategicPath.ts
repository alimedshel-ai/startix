// ─── مسارات استراتيجية للمدير المستقل الخبير ────────────────────────────
// مُقتبَس من stratix legacy (diagnostic-engine.js: 5 strategic paths).
// المدير الخبير يستخدمها على مستوى إدارة عميله بدل شركة كاملة.
//
// المسار يُحدَّد تلقائياً بناءً على healthPct + dangerZone من آخر تدقيق للإدارة.
// كل مسار له: مدّة، أولويات، مبادرات، مخاطر، KPIs موصى بها.

import type { DangerZone, DeptCode } from './deptApi'

export type StrategicPathKey = 'EMERGENCY' | 'FOUNDATION' | 'GROWTH' | 'EXCELLENCE' | 'DEFAULT'

export interface StrategicPath {
  key: StrategicPathKey
  name: string
  shortName: string
  urgencyLabel: string
  duration: string
  durationDays: number
  icon: string
  accent: 'rose' | 'amber' | 'emerald' | 'primary' | 'sky'
  description: string
  priorities: string[]        // ٣-٥ أولويات
  initiatives: string[]       // ٣-٥ مبادرات ملموسة
  risks: string[]             // ٢-٣ مخاطر تنبيهية
  suggestedKPIs: string[]     // مقترحات KPIs (تعتمد على التخصّص أيضاً)
  cta: string
}

// ─── قواعد اختيار المسار ────────────────────────────────────────────

export function pickStrategicPath(args: {
  healthPct: number | null
  dangerZone: DangerZone | null
  hasAnyAudit: boolean
}): StrategicPath {
  const { healthPct, dangerZone, hasAnyAudit } = args

  // بلا تدقيق → مسار افتراضي (بدء التقييم)
  if (!hasAnyAudit || healthPct == null) {
    return PATHS.DEFAULT
  }

  // 🚨 حرج: صحة < 40 أو منطقة حمراء
  if (dangerZone === 'RED' || healthPct < 40) {
    return PATHS.EMERGENCY
  }

  // 🌱 تأسيس: 40-59 (إجراءات ضعيفة، حاجة لبناء)
  if (healthPct < 60) {
    return PATHS.FOUNDATION
  }

  // 🚀 نمو: 60-79 (وضع مستقر، فرصة توسّع)
  if (healthPct < 80) {
    return PATHS.GROWTH
  }

  // 🏆 تميز: 80+ (نضج عالٍ، ابتكار)
  return PATHS.EXCELLENCE
}

// ─── تعريفات المسارات ──────────────────────────────────────────────

const PATHS: Record<StrategicPathKey, StrategicPath> = {
  EMERGENCY: {
    key: 'EMERGENCY',
    name: 'خطة إنقاذ ٩٠ يوماً',
    shortName: 'خطة عاجلة',
    urgencyLabel: 'حرج — تدخّل فوري',
    duration: '٩٠ يوماً',
    durationDays: 90,
    icon: '🚨',
    accent: 'rose',
    description:
      'الإدارة في منطقة خطر يتطلّب تحرّكاً فورياً. الأولوية القصوى: إيقاف النزيف واستعادة الاستقرار الأساسي قبل أي شيء آخر.',
    priorities: [
      'إيقاف النزيف — تحديد المشاكل الحرجة وإيقافها فوراً',
      'استعادة الاستقرار الأساسي (إجراءات + فريق + نظام قياس مبدئي)',
      'تأمين الاستمرارية — منع الانهيار في الأشهر الثلاثة القادمة',
      'تواصل فوري وصريح مع الإدارة العليا وأصحاب المصلحة',
    ],
    initiatives: [
      '🔴 خطة إجراءات طوارئ خلال الأسبوع الأول (ما نوقف، ما نُبقي)',
      '🟠 خطة تحصيل/تسييل سريعة (إن كانت المشكلة مالية)',
      '🟡 توثيق فوري للإجراءات الحرجة (لا تعتمد على أشخاص)',
      '🔵 اجتماع أسبوعي مع القيادة لمتابعة الوضع',
      '⚪ خطة تعافي مبنية على أهم ٣ مشاكل',
    ],
    risks: [
      'خطر انهيار العمليات إذا لم تُتّخذ إجراءات خلال ٣٠ يوماً',
      'خطر فقدان الفريق (أفضل الكوادر تغادر أولاً)',
      'خطر تراكم غرامات/التزامات تنظيمية',
    ],
    suggestedKPIs: [
      'مؤشر استقرار العمليات (أسبوعي)',
      'عدد الأزمات المُدارة/الشهر',
      'نسبة الالتزام بخطة الطوارئ',
    ],
    cta: 'ابدأ خطة الإنقاذ فوراً',
  },

  FOUNDATION: {
    key: 'FOUNDATION',
    name: 'خطة تأسيس ٦ أشهر',
    shortName: 'خطة تأسيسية',
    urgencyLabel: 'مهم — بناء أساسات',
    duration: '٦ أشهر',
    durationDays: 180,
    icon: '🌱',
    accent: 'amber',
    description:
      'الإدارة تحتاج بناء إجراءات وأنظمة أساسية. الفرصة الآن لوضع الأسس التي ستدعم النمو المستقبلي.',
    priorities: [
      'بناء الإجراءات الأساسية (SOPs) وتوثيقها',
      'تحديد المسؤوليات وتوزيعها بوضوح',
      'إنشاء نظام قياس أداء أوّلي (KPIs)',
      'تدريب الفريق على الممارسات المعيارية',
      'مراجعة الهيكل التنظيمي إن لزم',
    ],
    initiatives: [
      '🟢 توثيق ٥ SOPs جوهرية للإدارة',
      '🟢 إنشاء وثيقة الأدوار والمسؤوليات',
      '🟢 بناء لوحة قياس أساسية بـ ٥-٧ KPIs',
      '🟢 برنامج تدريب ربع سنوي للفريق',
      '🟢 مراجعة شهرية للتقدّم',
    ],
    risks: [
      'مقاومة تغيير من الفريق (خاصةً إذا كانت الإجراءات جديدة)',
      'خطر الإفراط في التوثيق دون تنفيذ فعلي',
      'ضياع الزخم إذا لم تُخصَّص موارد كافية',
    ],
    suggestedKPIs: [
      'نسبة الإجراءات الموثّقة',
      'نسبة الفريق المدرَّب',
      'مؤشرات صحة الإدارة (٤ محاور)',
    ],
    cta: 'ابدأ خطة التأسيس',
  },

  GROWTH: {
    key: 'GROWTH',
    name: 'خطة نموّ ١٢ شهراً',
    shortName: 'خطة تطويرية',
    urgencyLabel: 'استراتيجي — نمو وتوسّع',
    duration: '١٢ شهراً',
    durationDays: 365,
    icon: '🚀',
    accent: 'emerald',
    description:
      'الإدارة في وضع مستقر مع فرص واضحة للتوسّع والتحسين. الأولوية: بناء قدرات جديدة وتوسيع الأثر.',
    priorities: [
      'تحسين الكفاءة والأتمتة',
      'توسّع مستهدف في نطاق العمل',
      'رفع مستوى نضج الفريق ومهاراته',
      'تعميق التكامل مع الإدارات الأخرى',
      'مؤشرات أداء متطوّرة وقياس أثر',
    ],
    initiatives: [
      '⚡ أتمتة ٣ عمليات يدوية مركزية',
      '⚡ بناء قدرات جديدة (تدريب/توظيف متخصّص)',
      '⚡ توسيع نطاق الخدمات المُقدّمة للعملاء الداخليين',
      '⚡ إطلاق ٢-٣ مبادرات ابتكار',
      '⚡ تعميق الشراكات الاستراتيجية الداخلية',
    ],
    risks: [
      'نمو غير متوازن (قدرات جديدة بدون بنية داعمة)',
      'تشتّت الأولويات مع تعدّد المبادرات',
      'إرهاق الفريق مع زيادة الطلب',
    ],
    suggestedKPIs: [
      'مؤشر النموّ التشغيلي',
      'نسبة الأتمتة',
      'مؤشر رضا العملاء الداخليين',
      'ROI للمبادرات الجديدة',
    ],
    cta: 'ابدأ خطة النموّ',
  },

  EXCELLENCE: {
    key: 'EXCELLENCE',
    name: 'خطة تميز ١٨ شهراً',
    shortName: 'خطة تميز',
    urgencyLabel: 'قيادة — ابتكار وتميز',
    duration: '١٨ شهراً',
    durationDays: 540,
    icon: '🏆',
    accent: 'primary',
    description:
      'الإدارة ناضجة وذات أداء مرتفع. الفرصة الآن لتصبح مرجعاً في مجالها وتقود التميّز داخل المنظمة.',
    priorities: [
      'ابتكار في نموذج العمل',
      'حصول على شهادات اعتماد قطاعية',
      'بناء علامة تجارية داخلية',
      'مشاركة أفضل الممارسات مع الآخرين',
      'قيادة تحوّل رقمي/ذكاء اصطناعي',
    ],
    initiatives: [
      '✨ برنامج ابتكار داخلي مع دوامات ربعية',
      '✨ الحصول على شهادة قطاعية (ISO/PMP/CIPD…)',
      '✨ إنشاء Center of Excellence للإدارة',
      '✨ نشر ٣-٥ حالات دراسية داخلية',
      '✨ اعتماد ذكاء اصطناعي في ٢-٣ عمليات',
    ],
    risks: [
      'الرضا عن الذات وتوقّف التحسين',
      'فقدان مواهب مفتاحية لغياب تحديات جديدة',
      'مقاومة الابتكار من الإدارات الأخرى',
    ],
    suggestedKPIs: [
      'عدد المبادرات المُبتكرة',
      'مؤشر النضج القطاعي',
      'عدد الشهادات المُعتمَدة',
      'مؤشر التميّز التنافسي',
    ],
    cta: 'ابدأ خطة التميّز',
  },

  DEFAULT: {
    key: 'DEFAULT',
    name: 'ابدأ بالتشخيص',
    shortName: 'بدء التقييم',
    urgencyLabel: 'أولوية — تقييم أوّلي',
    duration: 'أسبوع',
    durationDays: 7,
    icon: '🎯',
    accent: 'sky',
    description:
      'لم يتم إجراء تدقيق للإدارة بعد. الخطوة الأولى: تشخيص شامل لتحديد المسار الاستراتيجي المناسب.',
    priorities: [
      'إجراء تدقيق الإدارة الأساسي',
      'تحليل عميق للأسئلة التخصّصية',
      'تحديد المخاطر الفورية',
      'وضع خارطة طريق أوّلية',
    ],
    initiatives: [
      '📋 تدقيق أساسي بأربعة محاور (١٢ سؤالاً)',
      '📋 تحليل عميق (٦٠ سؤالاً موصى بها للتخصّص)',
      '📋 تحديد نقاط الضعف الحرجة',
      '📋 اجتماع تنسيق مع صاحب العميل',
    ],
    risks: [
      'قرارات غير مدروسة بلا بيانات',
      'استمرار المشاكل غير المكتشفة',
    ],
    suggestedKPIs: [
      'نسبة اكتمال التدقيق',
      'مؤشرات صحة الإدارة (بعد التدقيق)',
    ],
    cta: 'ابدأ التشخيص',
  },
}

// ─── ألوان العرض ────────────────────────────────────────────────────

export const PATH_ACCENT_STYLES: Record<
  StrategicPath['accent'],
  { border: string; bg: string; text: string; chip: string; ring: string }
> = {
  rose: {
    border: 'border-rose-300', bg: 'bg-rose-50', text: 'text-rose-900',
    chip: 'bg-rose-600 text-white', ring: 'ring-rose-500',
  },
  amber: {
    border: 'border-amber-300', bg: 'bg-amber-50', text: 'text-amber-900',
    chip: 'bg-amber-500 text-white', ring: 'ring-amber-400',
  },
  emerald: {
    border: 'border-emerald-300', bg: 'bg-emerald-50', text: 'text-emerald-900',
    chip: 'bg-emerald-600 text-white', ring: 'ring-emerald-500',
  },
  primary: {
    border: 'border-primary/40', bg: 'bg-primary/5', text: 'text-foreground',
    chip: 'bg-primary text-primary-foreground', ring: 'ring-primary',
  },
  sky: {
    border: 'border-sky-300', bg: 'bg-sky-50', text: 'text-sky-900',
    chip: 'bg-sky-500 text-white', ring: 'ring-sky-500',
  },
}

// ─── KPIs مخصّصة حسب التخصّص (تُضاف على suggestedKPIs العامة) ────────

const DEPT_KPI_HINTS: Partial<Record<DeptCode, string[]>> = {
  HR:                ['معدل الدوران السنوي', 'تكلفة التوظيف/موظف', 'نسبة السعودة', 'مؤشر رضا الموظفين'],
  FINANCE:           ['هامش صافي', 'DSO (فترة التحصيل)', 'نسبة السيولة الجارية', 'دورة النقد'],
  SALES:             ['معدل التحويل', 'CAC', 'LTV', 'دورة البيع', 'تركّز العملاء'],
  MARKETING:         ['ROAS', 'CAC', 'MQL→SQL', 'engagement rate'],
  OPERATIONS:        ['OEE', 'cycle time', 'defect rate', 'utilization%'],
  IT:                ['Uptime', 'MTTR', 'ticket resolution', 'SLA compliance'],
  CUSTOMER_SERVICE:  ['FCR', 'CSAT', 'NPS', 'وقت الاستجابة'],
  SUPPORT:           ['وقت استجابة الدعم', 'SLA', 'دورة الشراء'],
  LOGISTICS:         ['OTIF', 'تكلفة الشحن/طلبية', 'دقة التسليم'],
  QUALITY:           ['معدل العيوب <1%', 'rework<5%', 'شكاوى الجودة'],
  PROJECTS:          ['التسليم في الموعد', 'انحراف الميزانية', 'scope creep'],
  COMPLIANCE:        ['درجة التدقيق', 'الغرامات المتجنّبة', 'نسبة الالتزام'],
  GOVERNANCE:        ['فعالية المجلس', 'تغطية سجل المخاطر', 'شفافية الإفصاح'],
}

export function specialtyKPIHints(deptCode: DeptCode | null | undefined): string[] {
  if (!deptCode) return []
  return DEPT_KPI_HINTS[deptCode] ?? []
}
