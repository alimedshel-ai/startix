import type { DeptCode } from './deptApi'

// ─── تصنيف الاتجاه/المنتج بأيقونة معبّرة ─────────────────────────
// دالة نقيّة تُصنّف نصّاً عربياً (عنوان اتجاه أو منتج) إلى فئة استراتيجية
// وتُرجع أيقونة + لون + وصف. تُستخدم في /choices و /bcg و /directions.
//
// المنطق: keyword-based بالعربية — يفحص النص للكلمات المفتاحية.
// إن لم يُطابق شيء → 🎯 «عام».

export type Category =
  | 'growth'      // نمو / توسّع / زيادة
  | 'efficiency'  // كفاءة / أتمتة / خفض تكلفة
  | 'digital'     // رقمنة / تقنية / بيانات
  | 'quality'     // جودة / تحسين / مراقبة
  | 'people'      // فريق / تدريب / موارد بشرية
  | 'partnership' // شراكة / تحالف / تعاون
  | 'defense'     // دفاع / حماية / مخاطر
  | 'innovation'  // ابتكار / منتج جديد
  | 'exit'        // خروج / تقليص / انسحاب
  | 'compliance'  // امتثال / حوكمة
  | 'customer'    // عميل / تجربة / خدمة
  | 'general'     // افتراضي

export interface CategoryMeta {
  code: Category
  icon: string
  labelAr: string
  colorClass: string
  bgClass: string
  descAr: string
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  growth:      { code: 'growth',      icon: '📈', labelAr: 'نمو وتوسّع',  colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50 border-emerald-300', descAr: 'زيادة الحصة، دخول أسواق، توسيع المنتجات.' },
  efficiency:  { code: 'efficiency',  icon: '⚡', labelAr: 'كفاءة تشغيلية', colorClass: 'text-sky-700',    bgClass: 'bg-sky-50 border-sky-300',       descAr: 'أتمتة، خفض تكلفة، تحسين إنتاجية.' },
  digital:     { code: 'digital',     icon: '💻', labelAr: 'رقمنة وتقنية',  colorClass: 'text-violet-700', bgClass: 'bg-violet-50 border-violet-300', descAr: 'تحوّل رقمي، بيانات، ذكاء اصطناعي.' },
  quality:     { code: 'quality',     icon: '✅', labelAr: 'جودة وتميّز',   colorClass: 'text-teal-700',   bgClass: 'bg-teal-50 border-teal-300',     descAr: 'تحسين الجودة، ضبط عمليات، شهادات.' },
  people:      { code: 'people',      icon: '👥', labelAr: 'الفريق والكفاءات', colorClass: 'text-amber-700', bgClass: 'bg-amber-50 border-amber-300',   descAr: 'تدريب، استقطاب، ثقافة، احتفاظ.' },
  partnership: { code: 'partnership', icon: '🤝', labelAr: 'شراكات وتحالفات', colorClass: 'text-indigo-700', bgClass: 'bg-indigo-50 border-indigo-300', descAr: 'شراكات، تعاون، استعانة بمصادر.' },
  defense:     { code: 'defense',     icon: '🛡️', labelAr: 'حماية ودفاع',   colorClass: 'text-slate-700',  bgClass: 'bg-slate-50 border-slate-300',   descAr: 'مواجهة تهديد، حماية موقع، إدارة مخاطر.' },
  innovation:  { code: 'innovation',  icon: '💡', labelAr: 'ابتكار',       colorClass: 'text-rose-700',   bgClass: 'bg-rose-50 border-rose-300',     descAr: 'منتج جديد، خدمة مبتكرة، تجربة.' },
  exit:        { code: 'exit',        icon: '🚪', labelAr: 'تقليص/خروج',   colorClass: 'text-gray-700',   bgClass: 'bg-gray-50 border-gray-300',     descAr: 'انسحاب مدروس، تقليص، وقف نشاط.' },
  compliance:  { code: 'compliance',  icon: '⚖️', labelAr: 'حوكمة وامتثال', colorClass: 'text-blue-700',   bgClass: 'bg-blue-50 border-blue-300',     descAr: 'التزام تنظيمي، حوكمة، مخاطر قانونية.' },
  customer:    { code: 'customer',    icon: '❤️', labelAr: 'تجربة العميل',  colorClass: 'text-pink-700',   bgClass: 'bg-pink-50 border-pink-300',     descAr: 'تحسين تجربة، خدمة، رحلة عميل.' },
  general:     { code: 'general',     icon: '🎯', labelAr: 'عام',           colorClass: 'text-primary',    bgClass: 'bg-primary/5 border-primary/30', descAr: '—' },
}

// أنماط الكلمات لكل فئة — الترتيب مهم (أول تطابق يفوز).
const PATTERNS: [Category, RegExp][] = [
  ['digital',     /رقم|رقمن|تقني|تكنولوج|بيانات|ذكاء|AI|أتمت|أتمتة|منصّة|منصة|تطبيق|نظام/],
  ['innovation',  /ابتكار|جديد|ريادي|بدع|إطلاق|منتج جديد|R&D|بحث/],
  ['efficiency',  /كفاءة|خفض تكلفة|تكلفة|إنتاج|تحسين عملي|أتمت|توفير|تشغيل|تشغيلي/],
  ['quality',     /جودة|تميّز|تميز|معيار|شهاد|iso|ISO|مراقب/],
  ['people',      /فريق|تدريب|توظيف|استقطاب|كفاءات|موارد بشرية|ثقاف|احتفاظ/],
  ['partnership', /شراك|تحالف|تعاون|مورد|مصدر خارج|outsource/],
  ['defense',     /دفاع|حماية|مخاطر|تحصين|حصّن|أزم|أزمة|صمود/],
  ['exit',        /خروج|انسحاب|تقليص|إغلاق|توقّف|توقف|بيع نشاط/],
  ['compliance',  /امتثال|حوكم|تنظيمي|قانوني|لائح|ISO 37|شرع/],
  ['customer',    /عميل|تجربة|خدمة|رحلة|رضا|ولاء|CX|UX/],
  ['growth',      /نمو|توسع|توسّع|زياد|حصة|سوق|توسيع|مبيعات|إيراد|زبائن|فرع/],
]

export function categorize(text: string): Category {
  const t = text.toLowerCase()
  for (const [cat, re] of PATTERNS) {
    if (re.test(t)) return cat
  }
  return 'general'
}

// ─── بنك اقتراحات منتجات/خدمات BCG بحسب التخصّص ────────────────
// نُستخدم في /bcg كـ "أفكار جاهزة" عندما لا يوجد BMC أو Directions.
export const DEPT_BCG_SUGGESTIONS: Partial<Record<DeptCode, string[]>> = {
  HR: ['برامج تدريب داخلي', 'خدمات استقطاب متخصّصة', 'أدوات تقييم أداء', 'استشارات ثقافة مؤسسية', 'برامج قيادة'],
  FINANCE: ['نمذجة مالية', 'تحليل تكاليف تفصيلي', 'تقارير مجلس إدارة', 'أدوات موازنات ذكية', 'خدمات تدقيق داخلي'],
  SALES: ['فريق مبيعات ميداني', 'مبيعات رقمية', 'حسابات كبرى (KAM)', 'قناة الشركاء', 'المتاجر الإلكترونية'],
  MARKETING: ['التسويق الرقمي', 'محتوى تعليمي (content)', 'حملات وعي علامة', 'تسويق المؤثرين', 'أتمتة تسويقية'],
  OPERATIONS: ['أتمتة الإنتاج', 'إدارة سلسلة إمداد', 'صيانة تنبّؤية', 'تحسين lean', 'توسيع طاقة'],
  IT: ['بنية سحابية', 'تطوير برمجيات داخلية', 'أمن سيبراني', 'تحليل بيانات', 'ذكاء اصطناعي مطبّق'],
  CUSTOMER_SERVICE: ['دعم متعدّد القنوات', 'روبوت محادثة ذكي', 'إدارة تجربة العميل', 'برامج ولاء', 'استطلاعات نبض'],
  SUPPORT: ['نظام تذاكر متقدّم', 'قاعدة معرفة ذاتية', 'دعم فيديو', 'SLA مؤسسي', 'دعم استباقي'],
  LOGISTICS: ['شبكة توزيع محلي', 'مستودعات متعدّدة', 'تتبّع في الوقت الحقيقي', 'شحن عابر حدود', 'التخزين المُدار'],
  QUALITY: ['شهادات ISO', 'مختبرات فحص', 'مراقبة عملية آلية', 'برامج تحسين مستمر', 'تدقيقات جودة'],
  PROJECTS: ['مكتب إدارة المشاريع (PMO)', 'خدمات استشارية للمشاريع', 'تدريب إدارة مشاريع', 'أدوات إدارة محفظة', 'خدمات نقل معرفة'],
  COMPLIANCE: ['فحص التزام تلقائي', 'برامج تدريب امتثال', 'استشارات لوائح', 'أدوات إدارة سياسات', 'تقارير حوكمة'],
  GOVERNANCE: ['خدمات مجلس إدارة', 'تقارير حوكمة', 'إدارة مخاطر', 'سياسات مؤسسية', 'تدريب حوكمة'],
}
