import type { DeptCode } from './deptApi'
import type { StrategyPath } from '@/types/user'

// ─── بنك مؤشرات الأداء (KPIs) لكل إدارة — بأسباب واضحة ───────────
// كل مؤشر يحمل:
//   • name/unit/defaultTarget/frequency  → إنشاء KPI جاهز
//   • category  → تصنيف (people/financial/growth/…)
//   • importance → critical/important/nice
//   • why   → لماذا هذا المؤشر مهم للمدير؟ (سطر واحد قابل للفهم)
//   • pathFit → أي مسار استراتيجي يناسب (QUICK/MEDIUM/LONG)

export type KPICategory =
  | 'people'      // موارد بشرية
  | 'financial'   // مالي
  | 'growth'      // نمو
  | 'quality'     // جودة
  | 'efficiency'  // كفاءة
  | 'customer'    // عميل
  | 'digital'     // رقمنة
  | 'compliance'  // امتثال

export type KPIImportance = 'critical' | 'important' | 'nice'

export const KPI_CATEGORY_META: Record<KPICategory, { icon: string; labelAr: string; color: string }> = {
  people:     { icon: '👥', labelAr: 'الفريق',   color: 'border-amber-300 bg-amber-50 text-amber-800' },
  financial:  { icon: '💰', labelAr: 'مالي',    color: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  growth:     { icon: '📈', labelAr: 'نمو',     color: 'border-sky-300 bg-sky-50 text-sky-800' },
  quality:    { icon: '✅', labelAr: 'جودة',    color: 'border-teal-300 bg-teal-50 text-teal-800' },
  efficiency: { icon: '⚡', labelAr: 'كفاءة',   color: 'border-violet-300 bg-violet-50 text-violet-800' },
  customer:   { icon: '❤️', labelAr: 'عميل',    color: 'border-pink-300 bg-pink-50 text-pink-800' },
  digital:    { icon: '💻', labelAr: 'رقمنة',   color: 'border-indigo-300 bg-indigo-50 text-indigo-800' },
  compliance: { icon: '⚖️', labelAr: 'امتثال',   color: 'border-blue-300 bg-blue-50 text-blue-800' },
}

export const IMPORTANCE_META: Record<KPIImportance, { labelAr: string; color: string; badge: string }> = {
  critical:  { labelAr: 'حرج',     color: 'border-rose-400 bg-rose-100 text-rose-800',      badge: '🔴' },
  important: { labelAr: 'مهم',     color: 'border-amber-400 bg-amber-100 text-amber-800',   badge: '🟡' },
  nice:      { labelAr: 'مفيد',    color: 'border-slate-300 bg-slate-100 text-slate-700',   badge: '⚪' },
}

// ─── مساعد الحساب — يوضّح للمستخدم كيف يحسب المؤشّر ─────────────
export interface KPICalcHelp {
  /** الصيغة الحسابيّة بلغة بسيطة. مثال: «النقد المتاح ÷ متوسّط المصروفات الشهريّة» */
  formula: string
  /** مثال حسابي واقعي. مثال: «٥٠٠,٠٠٠ ريال ÷ ٦٠,٠٠٠ = ٨.٣ شهر» */
  example: string
  /** مستويات مرجعية للقيمة. */
  benchmarks: { level: 'ممتاز' | 'جيد' | 'تحذير' | 'حرج'; range: string }[]
  /** ماذا يفعل المستخدم لتحسينه؟ ٢-٤ إجراءات مقترحة. */
  improveActions?: string[]
}

export interface KPISuggestion {
  name: string
  unit: string
  defaultTarget: number
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
  category: KPICategory
  importance: KPIImportance
  why: string          // لماذا هذا المؤشر؟
  pathFit: StrategyPath[]
  howToCalculate?: KPICalcHelp  // اختياريّ — للمؤشّرات المعقّدة
}

// ⚠️ الأسماء يجب أن تكون فريدة داخل كل إدارة (نستعملها كـ lookup key).
export const DEPT_KPI_BANK: Record<DeptCode, KPISuggestion[]> = {
  HR: [
    { name: 'معدل دوران الموظفين',      unit: '%',       defaultTarget: 10, frequency: 'quarterly', category: 'people',     importance: 'critical', why: 'قياس صحّة بيئة العمل — الارتفاع يعني فقدان معرفة وتكلفة استبدال.',        pathFit: ['MEDIUM', 'LONG'],
      howToCalculate: {
        formula: '(عدد الموظفين الذين تركوا خلال السنة ÷ متوسّط عدد الموظفين) × ١٠٠',
        example: '(٥ موظفين تركوا ÷ ٥٠ موظف) × ١٠٠ = ١٠٪',
        benchmarks: [
          { level: 'ممتاز', range: '< ٥٪' },
          { level: 'جيد',   range: '٥-١٠٪' },
          { level: 'تحذير', range: '١١-٢٠٪' },
          { level: 'حرج',   range: '> ٢٠٪' },
        ],
        improveActions: ['راجع حزم الرواتب مقارنة بالسوق', 'استثمر في التطوير المهني ومسارات الترقّي', 'حسّن بيئة العمل والقيادة المباشرة', 'أجرِ مقابلات خروج وعالج الأسباب الجذرية'],
      } },
    { name: 'زمن ملء الشواغر',           unit: 'يوم',     defaultTarget: 30, frequency: 'monthly',   category: 'efficiency', importance: 'important', why: 'يقيس سرعة الاستقطاب — تأخّره يعطّل تنفيذ الخطط.',                        pathFit: ['QUICK', 'MEDIUM'],
      howToCalculate: {
        formula: 'متوسّط (تاريخ قبول العرض − تاريخ فتح الشاغر) لكل الشواغر المملوءة خلال الفترة، بالأيّام',
        example: '(٢٥ + ٣٠ + ٣٥ يوم لـ٣ شواغر) ÷ ٣ = ٣٠ يوماً',
        benchmarks: [
          { level: 'ممتاز', range: '< ٢٠ يوم' },
          { level: 'جيد',   range: '٢٠-٣٥ يوم' },
          { level: 'تحذير', range: '٣٦-٦٠ يوم' },
          { level: 'حرج',   range: '> ٦٠ يوم' },
        ],
        improveActions: ['ابنِ بنك مرشّحين جاهزاً مسبقاً', 'أتمِت الفرز الأوّلي للسير الذاتيّة', 'اختصر حلقات المقابلة وسرّع القرار', 'اكتب وصفاً وظيفيّاً واضحاً يقلّل غير المؤهّلين'],
      } },
    { name: 'نسبة رضا الموظفين eNPS',    unit: 'نقطة',    defaultTarget: 40, frequency: 'quarterly', category: 'people',     importance: 'important', why: 'مؤشر مسبق للاحتفاظ والإنتاجية — يسبق قرار الاستقالة عادةً بشهور.',       pathFit: ['MEDIUM', 'LONG'],
      howToCalculate: {
        formula: 'من سؤال «كم تنصح بالعمل هنا؟ ٠-١٠»: ٪ المروّجين (٩-١٠) − ٪ المنتقدين (٠-٦)',
        example: '٦٠٪ مروّجون − ٢٠٪ منتقدون = +٤٠ نقطة',
        benchmarks: [
          { level: 'ممتاز', range: '≥ +٥٠' },
          { level: 'جيد',   range: '+١٠ إلى +٤٩' },
          { level: 'تحذير', range: '٠ إلى +٩' },
          { level: 'حرج',   range: 'سالب (< ٠)' },
        ],
        improveActions: ['استبيان ربعيّ قصير مجهول', 'تصرّف على أهمّ ٣ شكاوى وأعلِن النتائج', 'اجتماع مدير-مباشر شهريّ', 'اعترف بالإنجازات علناً'],
      } },
    { name: 'ساعات تدريب لكل موظف',      unit: 'ساعة',    defaultTarget: 20, frequency: 'annual',    category: 'people',     importance: 'nice',      why: 'استثمار في المهارات = قدرة أعلى على التنفيذ الاستراتيجي.',                pathFit: ['LONG'],
      howToCalculate: {
        formula: 'إجمالي ساعات التدريب المُقدَّمة خلال السنة ÷ عدد الموظفين',
        example: '(١٬٠٠٠ ساعة ÷ ٥٠ موظف) = ٢٠ ساعة لكل موظف',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ٤٠ ساعة' },
          { level: 'جيد',   range: '٢٠-٣٩ ساعة' },
          { level: 'تحذير', range: '١٠-١٩ ساعة' },
          { level: 'حرج',   range: '< ١٠ ساعات' },
        ],
        improveActions: ['ضع خطة تدريب سنويّة لكل دور', 'وفّر منصّة تعلّم رقميّة', 'اربط التدريب بالترقية والحوافز', 'قِس أثر التدريب على الأداء'],
      } },
    { name: 'نسبة التوطين',              unit: '%',       defaultTarget: 40, frequency: 'quarterly', category: 'compliance', importance: 'critical', why: 'التزام بنطاقات — الغرامات المحتملة وحرمان من دعم حكومي.',                 pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: '(عدد السعوديين ÷ إجمالي الموظفين المسجّلين في التأمينات) × ١٠٠',
        example: '(٢٠ سعودي ÷ ٥٠ موظف) × ١٠٠ = ٤٠٪ — نطاق أخضر',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ٦٠٪ (بلاتيني)' },
          { level: 'جيد',   range: '٤٠-٥٩٪ (أخضر)' },
          { level: 'تحذير', range: '٢٥-٣٩٪ (منخفض)' },
          { level: 'حرج',   range: '< ٢٥٪ (أحمر — عقوبات)' },
        ],
        improveActions: ['فعّل شراكة مع طاقات وهدف لاستقطاب مؤهّلين', 'ادعم برامج تأهيل داخلية للسعوديين', 'راجع الوصف الوظيفي للسماح بتوظيف أوسع', 'استفد من دعم صندوق تنمية الموارد البشرية'],
      } },
    { name: 'الغياب غير المخطّط',        unit: '%',       defaultTarget: 3,  frequency: 'monthly',   category: 'people',     importance: 'nice',      why: 'مؤشّر بيئة عمل — الارتفاع علامة على إرهاق أو مشكلات إشراف.',              pathFit: ['QUICK'],
      howToCalculate: {
        formula: '(أيّام الغياب غير المخطّط ÷ إجمالي أيّام العمل المتاحة) × ١٠٠',
        example: '(٣٠ يوم غياب ÷ ١٬٠٠٠ يوم عمل) × ١٠٠ = ٣٪',
        benchmarks: [
          { level: 'ممتاز', range: '< ٢٪' },
          { level: 'جيد',   range: '٢-٣٪' },
          { level: 'تحذير', range: '٤-٦٪' },
          { level: 'حرج',   range: '> ٦٪' },
        ],
        improveActions: ['حلّل أنماط الغياب (أيّام/أقسام)', 'ثبّت سياسة حضور واضحة ومعلَنة', 'عالِج الإرهاق وأعباء العمل الزائدة', 'وفّر دعماً لصحّة الموظّف'],
      } },
  ],
  FINANCE: [
    { name: 'هامش الربح الإجمالي',       unit: '%',       defaultTarget: 30, frequency: 'monthly',   category: 'financial',  importance: 'critical', why: 'يعكس كفاءة التسعير والتكلفة معاً — أهمّ مؤشر للاستدامة.',                pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: '(الإيراد − تكلفة البضاعة المباعة) ÷ الإيراد × ١٠٠',
        example: '(٥٠٠,٠٠٠ − ٣٥٠,٠٠٠) ÷ ٥٠٠,٠٠٠ × ١٠٠ = ٣٠٪',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ٤٠٪' },
          { level: 'جيد',   range: '٢٥-٣٩٪' },
          { level: 'تحذير', range: '١٠-٢٤٪' },
          { level: 'حرج',   range: '< ١٠٪' },
        ],
        improveActions: ['ارفع السعر ٥-١٠٪ للمنتجات الأقوى', 'تفاوض على تكلفة الموردين', 'ألغِ المنتجات ذات الهامش السلبي'],
      } },
    { name: 'نقد جاهز (Cash Runway)',    unit: 'شهر',     defaultTarget: 12, frequency: 'monthly',   category: 'financial',  importance: 'critical', why: 'كم شهراً تستمرّ الشركة إن توقّف الدخل؟ يجب أن يكون ٦+ دائماً.',           pathFit: ['QUICK', 'MEDIUM'],
      howToCalculate: {
        formula: 'النقد المتاح في البنك ÷ متوسّط المصروفات الشهريّة',
        example: '٥٠٠,٠٠٠ ريال ÷ ٦٠,٠٠٠ ريال شهرياً = ٨.٣ شهر',
        benchmarks: [
          { level: 'ممتاز', range: '١٢+ شهر' },
          { level: 'جيد',   range: '٦-١١ شهر' },
          { level: 'تحذير', range: '٣-٥ شهور' },
          { level: 'حرج',   range: '< ٣ شهور — إجراء عاجل' },
        ],
        improveActions: ['قلّل المصروفات غير الضروريّة', 'سرّع تحصيل الذمم', 'تفاوض على شروط دفع أطول مع الموردين', 'زد الإيراد قصير الأجل'],
      } },
    { name: 'أيام تحصيل المدينين (DSO)', unit: 'يوم',     defaultTarget: 45, frequency: 'monthly',   category: 'efficiency', importance: 'important', why: 'زمن تحصيل الفواتير — التأخّر يعطّل السيولة حتى لو الأرباح جيدة.',         pathFit: ['QUICK', 'MEDIUM'],
      howToCalculate: {
        formula: '(الذمم المدينة ÷ إجمالي المبيعات الآجلة) × عدد أيام الفترة',
        example: '(٣٠٠,٠٠٠ ÷ ٦٠٠,٠٠٠) × ٩٠ يوم = ٤٥ يوم',
        benchmarks: [
          { level: 'ممتاز', range: '≤ ٣٠ يوم' },
          { level: 'جيد',   range: '٣١-٤٥ يوم' },
          { level: 'تحذير', range: '٤٦-٦٠ يوم' },
          { level: 'حرج',   range: '> ٦٠ يوم' },
        ],
        improveActions: ['اطلب دفعة مقدّمة ٣٠٪', 'اعرض خصم ٢٪ للدفع خلال ١٠ أيام', 'تابع الفواتير المتأخّرة أسبوعياً', 'أوقف الائتمان للعملاء المتأخّرين'],
      } },
    { name: 'الإيراد الشهري المتكرّر',   unit: 'ريال',    defaultTarget: 500000, frequency: 'monthly', category: 'growth',  importance: 'critical', why: 'قاعدة إيراد ثابتة — تنبّؤ أفضل للمستقبل واستثمار أسلم.',                 pathFit: ['MEDIUM', 'LONG'],
      howToCalculate: {
        formula: 'مجموع قيم الاشتراكات النشطة الشهريّة (بعد تحويل السنويّة ÷ ١٢)',
        example: '(١٠٠ عميل × ٥,٠٠٠ ريال) = ٥٠٠,٠٠٠ ريال شهرياً',
        benchmarks: [
          { level: 'ممتاز', range: 'نموّ ≥ ١٥٪ شهرياً' },
          { level: 'جيد',   range: 'نموّ ٥-١٤٪ شهرياً' },
          { level: 'تحذير', range: 'نموّ ٠-٤٪ (ركود)' },
          { level: 'حرج',   range: 'انخفاض (Churn > Growth)' },
        ],
        improveActions: ['قلّل معدل الانسحاب (Churn) بتحسين تجربة العميل', 'ارفع متوسّط قيمة الاشتراك بترقية الباقات', 'أطلق باقات سنويّة بخصم لتثبيت الإيراد', 'ركّز على قنوات اكتساب ذات LTV/CAC ≥ ٣'],
      } },
    { name: 'نسبة الإنفاق مقابل الميزانية', unit: '%',    defaultTarget: 100, frequency: 'monthly',  category: 'financial',  importance: 'important', why: 'انضباط تنفيذ الميزانية — التجاوز يعني حاجة لمراجعة أولويات.',            pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'العائد على الاستثمار (ROI)', unit: '%',      defaultTarget: 15, frequency: 'annual',    category: 'financial',  importance: 'important', why: 'كم يعود كل ريال مُستثمَر؟ يوجّه قرارات التخصيص المستقبلية.',            pathFit: ['MEDIUM', 'LONG'] },
  ],
  SALES: [
    { name: 'إيراد المبيعات الشهري',     unit: 'ريال',    defaultTarget: 300000, frequency: 'monthly', category: 'growth', importance: 'critical', why: 'المؤشر الأمّ للمبيعات — يجب أن ينمو باتساق أو يستقرّ عند المستهدف.',    pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: 'مجموع قيم الفواتير المُصدَرة (أو المُحصَّلة) خلال الشهر',
        example: '١٥ صفقة × ٢٠,٠٠٠ ريال متوسّط = ٣٠٠,٠٠٠ ريال',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ١١٠٪ من المستهدف' },
          { level: 'جيد',   range: '٩٠-١٠٩٪ من المستهدف' },
          { level: 'تحذير', range: '٧٠-٨٩٪' },
          { level: 'حرج',   range: '< ٧٠٪ من المستهدف' },
        ],
        improveActions: ['زد نشاط الفريق (مكالمات/اجتماعات أسبوعيّة)', 'ركّز على العملاء عاليي القيمة (ABM)', 'أطلق حملات upsell على قاعدة العملاء الحاليّة', 'راجع خطّ الأنابيب (Pipeline) وأغلق الفرص العالقة'],
      } },
    { name: 'معدل التحويل',              unit: '%',       defaultTarget: 20, frequency: 'monthly',   category: 'efficiency', importance: 'important', why: 'كم نسبة العملاء المحتملين الذين يشترون فعلاً؟ يقيس كفاءة الفريق.',       pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'متوسط قيمة الصفقة',         unit: 'ريال',    defaultTarget: 20000, frequency: 'monthly', category: 'growth', importance: 'important', why: 'اتجاه هذا الرقم صعوداً = ترقية العملاء لخيارات أعلى قيمة.',              pathFit: ['MEDIUM', 'LONG'] },
    { name: 'دورة البيع (طول)',           unit: 'يوم',     defaultTarget: 30, frequency: 'monthly',   category: 'efficiency', importance: 'nice',    why: 'دورة أقصر = كفاءة أعلى + سيولة أسرع.',                                    pathFit: ['QUICK'] },
    { name: 'نسبة الاحتفاظ بالعملاء',     unit: '%',      defaultTarget: 90, frequency: 'quarterly', category: 'customer', importance: 'critical', why: 'استبدال عميل أغلى ٥× من الاحتفاظ به — انخفاض هنا نزيف.',                  pathFit: ['MEDIUM', 'LONG'],
      howToCalculate: {
        formula: '((عدد العملاء آخر الفترة − عدد العملاء الجدد) ÷ عدد العملاء أوّل الفترة) × ١٠٠',
        example: '((٩٥ − ٥) ÷ ١٠٠) × ١٠٠ = ٩٠٪',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ٩٥٪' },
          { level: 'جيد',   range: '٨٥-٩٤٪' },
          { level: 'تحذير', range: '٧٠-٨٤٪' },
          { level: 'حرج',   range: '< ٧٠٪' },
        ],
        improveActions: ['أطلق برنامج ولاء ومكافآت للعملاء الدائمين', 'فعّل تواصل استباقي (Customer Success)', 'حسّن جودة المنتج/الخدمة بناءً على شكاوى', 'اكتشف مبكّراً إشارات الانسحاب وتدخّل'],
      } },
    { name: 'عدد العملاء الجدد',          unit: 'عميل',    defaultTarget: 10, frequency: 'monthly',   category: 'growth',  importance: 'important', why: 'قياس فعالية اكتساب العملاء الجدد + مؤشر مسبق للنمو.',                     pathFit: ['QUICK', 'MEDIUM'] },
  ],
  MARKETING: [
    { name: 'تكلفة اكتساب العميل (CAC)', unit: 'ريال',    defaultTarget: 200, frequency: 'monthly',  category: 'financial',  importance: 'critical', why: 'كم نُنفق لجذب كل عميل؟ يجب أن يكون أقل من قيمته لمدى حياته.',            pathFit: ['MEDIUM', 'LONG'],
      howToCalculate: {
        formula: 'إجمالي إنفاق التسويق والمبيعات ÷ عدد العملاء الجدد المكتَسَبين',
        example: '٢٠,٠٠٠ ريال ÷ ١٠٠ عميل جديد = ٢٠٠ ريال / عميل',
        benchmarks: [
          { level: 'ممتاز', range: 'CAC ≤ LTV ÷ ٥' },
          { level: 'جيد',   range: 'CAC ≈ LTV ÷ ٣' },
          { level: 'تحذير', range: 'CAC ≈ LTV ÷ ٢' },
          { level: 'حرج',   range: 'CAC ≥ LTV (خسارة)' },
        ],
        improveActions: ['ركّز الإنفاق على القنوات ذات أعلى تحويل', 'حسّن معدل تحويل الموقع/الحملة', 'فعّل التسويق العضوي (SEO/محتوى)', 'اعتمد الإحالة (Referral) لخفض تكلفة الاكتساب'],
      } },
    { name: 'قيمة العميل مدى الحياة (LTV)', unit: 'ريال', defaultTarget: 5000, frequency: 'quarterly', category: 'growth',  importance: 'critical', why: 'نسبة LTV/CAC ≥ ٣ صحّي — أقل يعني نموذج غير مستدام.',                     pathFit: ['MEDIUM', 'LONG'],
      howToCalculate: {
        formula: 'متوسّط قيمة الشراء × عدد مرّات الشراء سنوياً × متوسّط عدد سنوات العميل',
        example: '٥٠٠ ريال × ٢ مرّة/سنة × ٥ سنوات = ٥,٠٠٠ ريال',
        benchmarks: [
          { level: 'ممتاز', range: 'LTV/CAC ≥ ٥' },
          { level: 'جيد',   range: 'LTV/CAC ٣-٤' },
          { level: 'تحذير', range: 'LTV/CAC ١.٥-٢.٩' },
          { level: 'حرج',   range: 'LTV/CAC < ١.٥' },
        ],
        improveActions: ['ارفع متوسّط قيمة الشراء بحزم أعلى', 'زد تكرار الشراء عبر تسويق دوريّ', 'مدّد العلاقة بخدمات إضافيّة (Upsell/Cross-sell)', 'قلّل الانسحاب لتزيد سنوات العميل'],
      } },
    { name: 'الوصول العضوي الشهري',      unit: 'زيارة',   defaultTarget: 50000, frequency: 'monthly',  category: 'growth', importance: 'important', why: 'قناة نمو غير مدفوعة — استثمار طويل الأمد يقلّل الاعتماد على الإعلانات.', pathFit: ['LONG'] },
    { name: 'نسبة النقر (CTR)',           unit: '%',       defaultTarget: 3,  frequency: 'weekly',    category: 'efficiency', importance: 'nice',   why: 'كفاءة رسائل الحملات — انخفاضه يستدعي مراجعة الرسالة أو الجمهور.',       pathFit: ['QUICK'] },
    { name: 'حصّة العلامة في الذكر (SoV)', unit: '%',     defaultTarget: 25, frequency: 'quarterly', category: 'growth',   importance: 'nice',      why: 'حضور علامتك مقارنة بمنافسيك على المنصّات — مؤشر طويل الأمد.',            pathFit: ['LONG'] },
    { name: 'معدل التفاعل الاجتماعي',    unit: '%',       defaultTarget: 5,  frequency: 'weekly',    category: 'customer',   importance: 'nice',      why: 'صحة المحتوى وقربه من الجمهور — يسبق نمو المتابعين والوصول.',              pathFit: ['QUICK', 'MEDIUM'] },
  ],
  OPERATIONS: [
    { name: 'كفاءة الإنتاج (OEE)',        unit: '%',       defaultTarget: 85, frequency: 'monthly',   category: 'efficiency', importance: 'critical', why: 'مقياس عالمي لكفاءة العمليات — يجمع التوافر والأداء والجودة معاً.',       pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: 'التوافر × الأداء × الجودة (كلٌّ كنسبة مئويّة)',
        example: '٩٥٪ × ٩٥٪ × ٩٤٪ = ٨٥٪',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ٨٥٪ (Class-World)' },
          { level: 'جيد',   range: '٧٠-٨٤٪' },
          { level: 'تحذير', range: '٥٠-٦٩٪' },
          { level: 'حرج',   range: '< ٥٠٪' },
        ],
        improveActions: ['قلّل توقّفات المعدّات بصيانة وقائيّة', 'حسّن سرعة التشغيل بتدريب المشغّلين', 'خفّض معدل العيوب في الخطّ', 'حلّل الفواقد الستّ الكبرى (Six Big Losses)'],
      } },
    { name: 'دقّة التسليم في الموعد',    unit: '%',       defaultTarget: 95, frequency: 'monthly',   category: 'quality',    importance: 'critical', why: 'صحّة الوعد للعميل — الأثر المباشر على الرضا والاحتفاظ.',                 pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: '(عدد الطلبات المسلّمة في الموعد ÷ إجمالي الطلبات) × ١٠٠',
        example: '(٩٥ طلب في الموعد ÷ ١٠٠ طلب) × ١٠٠ = ٩٥٪',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ٩٨٪' },
          { level: 'جيد',   range: '٩٥-٩٧٪' },
          { level: 'تحذير', range: '٩٠-٩٤٪' },
          { level: 'حرج',   range: '< ٩٠٪' },
        ],
        improveActions: ['حدّث تخطيط الإنتاج (S&OP) شهرياً', 'راجع مصادر التأخير الأكثر تكراراً', 'فعّل نظام تنبيهات لتأخّر الطلبات', 'ابنِ مخزوناً أمنياً للمواد الحرجة'],
      } },
    { name: 'نسبة الفاقد (Waste)',        unit: '%',       defaultTarget: 5,  frequency: 'monthly',   category: 'efficiency', importance: 'important', why: 'الفاقد تكلفة مباشرة — كل انخفاض ينعكس على الهامش.',                       pathFit: ['QUICK'] },
    { name: 'زمن دورة الإنتاج',           unit: 'ساعة',   defaultTarget: 8,  frequency: 'weekly',    category: 'efficiency', importance: 'important', why: 'دورة أقصر = طاقة أعلى وتكلفة أقل بلا استثمار جديد.',                     pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'دوران المخزون',              unit: 'مرة/سنة', defaultTarget: 8, frequency: 'quarterly', category: 'efficiency', importance: 'nice',      why: 'يقيس كفاءة إدارة المخزون — انخفاضه = رأس مال معطّل.',                     pathFit: ['MEDIUM'] },
    { name: 'حوادث السلامة',              unit: 'حادثة',   defaultTarget: 0,  frequency: 'monthly',   category: 'compliance', importance: 'critical', why: 'صفر حوادث = التزام قانوني + حماية للفريق + سمعة الشركة.',                 pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: 'إجمالي عدد الحوادث المسجَّلة (ضياع وقت / إصابات / أضرار) خلال الشهر',
        example: 'شهر بلا حوادث = ٠ — الهدف المطلوب دائماً',
        benchmarks: [
          { level: 'ممتاز', range: '٠ حادثة' },
          { level: 'جيد',   range: '١ حادثة بسيطة' },
          { level: 'تحذير', range: '٢-٣ حوادث' },
          { level: 'حرج',   range: '≥ ٤ حوادث أو حادثة كبرى' },
        ],
        improveActions: ['طبّق نظام SMS للسلامة والصحّة المهنيّة', 'درّب الفريق دورياً على الإجراءات الآمنة', 'راجع الحوادث الوشيكة (Near-miss) وحلّلها', 'وفّر معدّات الحماية الشخصيّة (PPE) وتحقّق من الالتزام'],
      } },
  ],
  IT: [
    { name: 'زمن التشغيل (Uptime)',       unit: '%',       defaultTarget: 99.9, frequency: 'monthly', category: 'quality',    importance: 'critical', why: 'كل ٠٫١٪ نزول = ~٤٥ دقيقة انقطاع شهرياً — يضرب مصداقية الأنظمة.',           pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: '((إجمالي الدقائق − دقائق الانقطاع) ÷ إجمالي الدقائق) × ١٠٠',
        example: '((٤٣٬٢٠٠ − ٤٣) ÷ ٤٣٬٢٠٠) × ١٠٠ = ٩٩.٩٪',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ٩٩.٩٩٪ (Four-9s)' },
          { level: 'جيد',   range: '٩٩.٩٪ (Three-9s)' },
          { level: 'تحذير', range: '٩٩-٩٩.٨٪' },
          { level: 'حرج',   range: '< ٩٩٪' },
        ],
        improveActions: ['فعّل الاسترداد التلقائي والـ Failover', 'راقب الأنظمة ٢٤/٧ بأدوات observability', 'اختبر خطط استمرارية الأعمال (BCP) دورياً', 'حدّد SLA واضحاً مع مزوّدي البنية التحتية'],
      } },
    { name: 'متوسط زمن حل التذاكر (MTTR)', unit: 'ساعة',   defaultTarget: 4, frequency: 'weekly',    category: 'efficiency', importance: 'important', why: 'يقيس فعالية الاستجابة — سرعة الحل تحمي إنتاجية بقية الفريق.',            pathFit: ['QUICK'] },
    { name: 'حوادث الأمن السيبراني',      unit: 'حادثة',   defaultTarget: 0, frequency: 'monthly',   category: 'compliance', importance: 'critical', why: 'كل حادث ممكن يعني فقد بيانات، غرامات PDPL، وضرر سمعة كبير.',              pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: 'إجمالي الحوادث الأمنيّة المكتشَفة (اختراق/تسريب/فدية/تصيّد ناجح) خلال الشهر',
        example: 'شهر بدون اختراق أو حادثة معتبَرة = ٠',
        benchmarks: [
          { level: 'ممتاز', range: '٠ حادثة' },
          { level: 'جيد',   range: 'محاولات مكتشَفة بلا ضرر' },
          { level: 'تحذير', range: '١ حادثة محدودة' },
          { level: 'حرج',   range: '≥ ١ حادثة اختراق/تسريب' },
        ],
        improveActions: ['طبّق ضوابط الهيئة الوطنية للأمن السيبراني (ECC-1)', 'فعّل MFA على جميع الأنظمة الحسّاسة', 'درّب الفريق على التصيّد الإلكتروني ربع سنوي', 'أجرِ اختبار اختراق سنوي وسدّ الثغرات'],
      } },
    { name: 'نسبة الاعتماد على السحابة',  unit: '%',       defaultTarget: 80, frequency: 'quarterly', category: 'digital',   importance: 'important', why: 'تحوّل رقمي = مرونة أعلى + خفض تكلفة on-prem تدريجياً.',                    pathFit: ['MEDIUM', 'LONG'] },
    { name: 'تكلفة تقنية المعلومات لكل موظف', unit: 'ريال', defaultTarget: 5000, frequency: 'annual', category: 'financial', importance: 'nice',      why: 'مقارنة مع الصناعة — الارتفاع يستدعي مراجعة الفعّالية.',                  pathFit: ['MEDIUM'] },
    { name: 'إنجاز المشاريع التقنية في الموعد', unit: '%', defaultTarget: 90, frequency: 'quarterly', category: 'efficiency', importance: 'important', why: 'كثرة التأخير = عرقلة استراتيجيات أخرى تعتمد على مخرجات IT.',              pathFit: ['MEDIUM', 'LONG'] },
  ],
  CUSTOMER_SERVICE: [
    { name: 'رضا العملاء (CSAT)',        unit: '%',       defaultTarget: 90, frequency: 'monthly',   category: 'customer',   importance: 'critical', why: 'يقيس تجربة العميل بعد كل تفاعل — الانخفاض يسبق فقد العملاء.',            pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: '(عدد الردود الإيجابيّة ٤-٥ ÷ إجمالي الردود) × ١٠٠',
        example: '(٩٠ عميل راضٍ ÷ ١٠٠ ردّ) × ١٠٠ = ٩٠٪',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ٩٥٪' },
          { level: 'جيد',   range: '٨٥-٩٤٪' },
          { level: 'تحذير', range: '٧٠-٨٤٪' },
          { level: 'حرج',   range: '< ٧٠٪' },
        ],
        improveActions: ['حلّل أسباب عدم الرضا شهرياً (Root-cause)', 'اختصر زمن الاستجابة والحلّ', 'مكّن فريق الدعم بصلاحيّات أوسع', 'تابع العملاء غير الراضين بشكل شخصي'],
      } },
    { name: 'صافي المروّجين (NPS)',      unit: 'نقطة',    defaultTarget: 50, frequency: 'quarterly', category: 'customer',   importance: 'critical', why: 'مؤشر ولاء ومدى استعداد العميل للتوصية — مضاعف نمو مجاني.',                pathFit: ['MEDIUM', 'LONG'],
      howToCalculate: {
        formula: '(٪ المروّجين ٩-١٠) − (٪ المنتقدين ٠-٦)',
        example: '٦٠٪ مروّجين − ١٠٪ منتقدين = ٥٠ نقطة',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ٧٠ (World-Class)' },
          { level: 'جيد',   range: '٣٠-٦٩' },
          { level: 'تحذير', range: '٠-٢٩' },
          { level: 'حرج',   range: '< ٠ (منتقدون أكثر)' },
        ],
        improveActions: ['فعّل حلقة تغذية راجعة (Close-the-loop)', 'أطلق برنامج إحالة للمروّجين', 'حلّل ملاحظات المنتقدين ومعالجة أسبابها', 'حسّن نقاط الاحتكاك في رحلة العميل'],
      } },
    { name: 'زمن الاستجابة الأول',        unit: 'دقيقة',   defaultTarget: 15, frequency: 'weekly',    category: 'efficiency', importance: 'important', why: 'الردّ السريع نصف الحل — يرفع الرضا حتى قبل حلّ المشكلة.',                pathFit: ['QUICK'] },
    { name: 'معدل حلّ من أول مرّة (FCR)', unit: '%',      defaultTarget: 75, frequency: 'monthly',   category: 'quality',    importance: 'important', why: 'حلّ التذكرة من أوّل مرة = رضا أعلى + تكلفة أقل + فريق أقل إنهاكاً.',      pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'نسبة الاسترجاع',             unit: '%',       defaultTarget: 3,  frequency: 'monthly',   category: 'customer',   importance: 'nice',      why: 'الارتفاع علامة على مشكلة في المنتج/الوعد — لا في الدعم فقط.',              pathFit: ['MEDIUM'] },
  ],
  SUPPORT: [
    { name: 'زمن الحلّ (MTTR)',           unit: 'ساعة',   defaultTarget: 8,  frequency: 'weekly',    category: 'efficiency', importance: 'critical', why: 'كل ساعة تأخير حل = عميل غير راضٍ + مشكلة تكبر.',                          pathFit: ['QUICK', 'MEDIUM'],
      howToCalculate: {
        formula: 'مجموع أزمنة حل التذاكر ÷ عدد التذاكر المحلولة',
        example: '(٢٤٠ ساعة إجمالي ÷ ٣٠ تذكرة) = ٨ ساعات / تذكرة',
        benchmarks: [
          { level: 'ممتاز', range: '≤ ٤ ساعات' },
          { level: 'جيد',   range: '٥-٨ ساعات' },
          { level: 'تحذير', range: '٩-٢٤ ساعة' },
          { level: 'حرج',   range: '> ٢٤ ساعة' },
        ],
        improveActions: ['ابنِ قاعدة معرفة (KB) للحلول المتكرّرة', 'أتمِت الردود الأولى بواسطة الذكاء الاصطناعي', 'حدّد أولويّة التذاكر حسب الأثر', 'راجع تصعيد التذاكر لتفادي التنقّل غير الضروري'],
      } },
    { name: 'صافي المروّجين (NPS)',       unit: 'نقطة',    defaultTarget: 50, frequency: 'quarterly', category: 'customer',   importance: 'critical', why: 'مؤشر تجربة الدعم — النقاط السالبة تعني أنّ الدعم مصدر خسارة عملاء.',    pathFit: ['MEDIUM', 'LONG'] },
    { name: 'نسبة تصعيد التذاكر',         unit: '%',       defaultTarget: 5,  frequency: 'monthly',   category: 'quality',    importance: 'important', why: 'ارتفاعها = فريق L1 يحتاج تدريباً أو أدواتٍ أفضل.',                       pathFit: ['MEDIUM'] },
    { name: 'إنتاجية الوكيل',              unit: 'تذكرة/يوم', defaultTarget: 20, frequency: 'weekly', category: 'efficiency', importance: 'nice',   why: 'يقيس فعالية الفرد — الانخفاض بلا سبب واضح = مشكلة تنظيم أو أدوات.',    pathFit: ['QUICK'] },
  ],
  LOGISTICS: [
    { name: 'دقّة التسليم في الوقت',      unit: '%',       defaultTarget: 95, frequency: 'monthly',   category: 'quality',    importance: 'critical', why: 'الوعد الأساسي للعميل — أي انخفاض يهزّ الثقة بسرعة.',                       pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: '(عدد الشحنات المسلَّمة في الموعد ÷ إجمالي الشحنات) × ١٠٠',
        example: '(٩٥٠ شحنة ÷ ١٬٠٠٠ شحنة) × ١٠٠ = ٩٥٪',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ٩٨٪' },
          { level: 'جيد',   range: '٩٥-٩٧٪' },
          { level: 'تحذير', range: '٩٠-٩٤٪' },
          { level: 'حرج',   range: '< ٩٠٪' },
        ],
        improveActions: ['حسّن تخطيط المسارات (Route Optimization)', 'ضاعف موزّعي "الميل الأخير" في المدن الرئيسيّة', 'تتبّع الشحنات لحظياً وأبلغ العميل استباقياً', 'راجع أسباب التأخّر الأكثر تكراراً شهرياً'],
      } },
    { name: 'تكلفة الشحن لكل طلب',        unit: 'ريال',    defaultTarget: 25, frequency: 'monthly',   category: 'financial',  importance: 'important', why: 'انخفاضها يرفع الهامش مباشرة — كثيراً ما يكون فيها فجوات كفاءة.',        pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'نسبة الطلبات الكاملة',        unit: '%',       defaultTarget: 98, frequency: 'monthly',   category: 'quality',    importance: 'important', why: 'وصول الطلب كاملاً بلا تلف = عميل راضٍ + لا استرجاعات.',                    pathFit: ['QUICK'] },
    { name: 'زمن دورة المخزون',           unit: 'يوم',     defaultTarget: 45, frequency: 'quarterly', category: 'efficiency', importance: 'nice',      why: 'مخزون طويل = رأس مال معطّل + تكلفة تخزين + مخاطر تلف.',                    pathFit: ['MEDIUM'] },
    { name: 'حوادث نقل',                   unit: 'حادثة',   defaultTarget: 0,  frequency: 'monthly',   category: 'compliance', importance: 'critical', why: 'صفر حوادث = حماية للسائقين + التزام + سمعة الأسطول.',                     pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: 'إجمالي حوادث المركبات المسجّلة (تصادم/انقلاب/إصابات) خلال الشهر',
        example: 'شهر بلا حوادث للأسطول = ٠',
        benchmarks: [
          { level: 'ممتاز', range: '٠ حادثة' },
          { level: 'جيد',   range: '١ حادثة بسيطة بلا إصابات' },
          { level: 'تحذير', range: '٢-٣ حوادث' },
          { level: 'حرج',   range: '≥ ٤ حوادث أو حادثة بإصابة' },
        ],
        improveActions: ['ركّب أجهزة تتبّع سلوك القيادة (Telematics)', 'درّب السائقين على القيادة الآمنة والدفاعيّة', 'راقب ساعات القيادة لتفادي الإرهاق', 'أجرِ صيانة دورية للأسطول بلا تأخير'],
      } },
  ],
  QUALITY: [
    { name: 'معدل العيوب (Defect Rate)',   unit: 'ppm',    defaultTarget: 100, frequency: 'monthly',  category: 'quality',    importance: 'critical', why: 'مقياس الجودة الفعلي — الاتّجاه الأهم من الرقم المطلق.',                    pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: '(عدد الوحدات المعيبة ÷ إجمالي الوحدات المُنتَجة) × ١٬٠٠٠٬٠٠٠',
        example: '(١ وحدة معيبة ÷ ١٠٬٠٠٠ وحدة) × ١٬٠٠٠٬٠٠٠ = ١٠٠ ppm',
        benchmarks: [
          { level: 'ممتاز', range: '≤ ٣.٤ ppm (Six-Sigma)' },
          { level: 'جيد',   range: '٤-١٠٠ ppm' },
          { level: 'تحذير', range: '١٠١-١٬٠٠٠ ppm' },
          { level: 'حرج',   range: '> ١٬٠٠٠ ppm (٠.١٪+)' },
        ],
        improveActions: ['طبّق منهجيّة Six-Sigma/Lean لتحليل الأسباب', 'فعّل ضبط الجودة الإحصائي (SPC) على الخطوط الرئيسيّة', 'راجع مواصفات المورّدين وضبط جودة المدخلات', 'درّب المشغّلين على معايير الجودة'],
      } },
    { name: 'كلفة الجودة الرديئة (COPQ)',  unit: 'ريال',   defaultTarget: 50000, frequency: 'quarterly', category: 'financial', importance: 'important', why: 'الجودة الرديئة تكلفة خفيّة كبيرة — إعادة عمل، شكاوى، فقد عملاء.',       pathFit: ['MEDIUM', 'LONG'] },
    { name: 'دقّة تدقيقات الجودة',         unit: '%',       defaultTarget: 95, frequency: 'monthly',   category: 'quality',    importance: 'important', why: 'ضمان أنّ التدقيق يكشف المشكلات فعلاً وليس إجراءً شكلياً.',                 pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'شهادات الجودة السارية',       unit: 'شهادة',  defaultTarget: 3,  frequency: 'annual',    category: 'compliance', importance: 'nice',      why: 'الشهادات (ISO) مطلوبة في المناقصات الكبرى — مصدر فرص جديدة.',              pathFit: ['LONG'] },
    { name: 'زمن كشف العيوب',              unit: 'ساعة',    defaultTarget: 2,  frequency: 'weekly',    category: 'efficiency', importance: 'important', why: 'الكشف المتأخّر = عيوب أكثر تنتشر — الاكتشاف المبكّر يوقف الضرر.',        pathFit: ['QUICK'] },
  ],
  PROJECTS: [
    { name: 'إنجاز المشاريع في الموعد',   unit: '%',       defaultTarget: 90, frequency: 'quarterly', category: 'efficiency', importance: 'critical', why: 'التأخير يعطّل استراتيجيات مرتبطة + يهزّ الثقة الداخلية.',                 pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: '(عدد المشاريع المُنجَزة في الموعد ÷ إجمالي المشاريع المكتمَلة) × ١٠٠',
        example: '(٩ مشاريع في الموعد ÷ ١٠ مشاريع) × ١٠٠ = ٩٠٪',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ٩٥٪' },
          { level: 'جيد',   range: '٨٥-٩٤٪' },
          { level: 'تحذير', range: '٧٠-٨٤٪' },
          { level: 'حرج',   range: '< ٧٠٪' },
        ],
        improveActions: ['اعتمد منهجيّة Agile/PRINCE2 وفق المشروع', 'راجع الجداول أسبوعياً وحلّ التبعيّات مبكّراً', 'وفّر موارد كافية قبل بدء المشروع', 'حدّد نطاقاً واضحاً وقلّل تغييراته (Scope Creep)'],
      } },
    { name: 'الالتزام بالميزانية',        unit: '%',       defaultTarget: 100, frequency: 'quarterly', category: 'financial',  importance: 'critical', why: 'التجاوز = ضغط سيولة + تعديل أولويات مستقبلية.',                          pathFit: ['QUICK', 'MEDIUM'],
      howToCalculate: {
        formula: '(الإنفاق الفعلي ÷ الميزانية المُعتمَدة) × ١٠٠',
        example: '(١٠٠٬٠٠٠ ريال منفَق ÷ ١٠٠٬٠٠٠ ريال ميزانية) × ١٠٠ = ١٠٠٪',
        benchmarks: [
          { level: 'ممتاز', range: '٩٥-١٠٠٪ (بلا تجاوز)' },
          { level: 'جيد',   range: '١٠١-١٠٥٪' },
          { level: 'تحذير', range: '١٠٦-١١٥٪' },
          { level: 'حرج',   range: '> ١١٥٪ (تجاوز كبير)' },
        ],
        improveActions: ['راقب الإنفاق شهرياً مقابل الميزانية', 'حدّد احتياطي طوارئ ٥-١٠٪ في التخطيط', 'راجع طلبات التغيير قبل الاعتماد', 'حلّل تجاوزات المشاريع السابقة لتفاديها'],
      } },
    { name: 'رضا صاحب المصلحة',           unit: 'نقطة',    defaultTarget: 8,  frequency: 'quarterly', category: 'customer',   importance: 'important', why: 'المشروع الناجح فنياً قد يفشل عند الاستلام — يقيس الصورة الكاملة.',      pathFit: ['MEDIUM', 'LONG'] },
    { name: 'مؤشر أداء التكلفة (CPI)',    unit: 'نسبة',    defaultTarget: 1,  frequency: 'monthly',   category: 'efficiency', importance: 'nice',      why: 'CPI < 1 = الإنفاق أسرع من الإنجاز — إشارة مبكّرة لتجاوز.',                 pathFit: ['MEDIUM'] },
  ],
  COMPLIANCE: [
    { name: 'ملاحظات الجهات الرقابية',    unit: 'ملاحظة',  defaultTarget: 0,  frequency: 'quarterly', category: 'compliance', importance: 'critical', why: 'كل ملاحظة = غرامة محتملة + سمعة تنظيمية — الصفر هدف حرج.',              pathFit: ['QUICK', 'MEDIUM', 'LONG'],
      howToCalculate: {
        formula: 'إجمالي الملاحظات الرسميّة من الجهات الرقابيّة (زكاة/عمل/بيئة/…) خلال الربع',
        example: 'ربع بدون أي ملاحظة زاتكا أو موارد بشريّة = ٠',
        benchmarks: [
          { level: 'ممتاز', range: '٠ ملاحظة' },
          { level: 'جيد',   range: '١ ملاحظة بسيطة مغلَقة' },
          { level: 'تحذير', range: '٢-٣ ملاحظات' },
          { level: 'حرج',   range: '≥ ٤ ملاحظات أو غرامات' },
        ],
        improveActions: ['أنشئ سجلّ التزام (Compliance Register) وحدّثه دورياً', 'أجرِ تدقيقاً داخلياً قبل التدقيق الخارجي', 'عيّن مسؤول التزام مخصّص لكل نوع لوائح', 'تابع تغيّرات الأنظمة في الجريدة الرسمية'],
      } },
    { name: 'دورات التوعية للفريق',        unit: 'دورة',    defaultTarget: 4,  frequency: 'annual',    category: 'people',     importance: 'important', why: 'وعي الفريق خطّ الدفاع الأوّل — يوقف الخطأ قبل حدوثه.',                     pathFit: ['MEDIUM', 'LONG'] },
    { name: 'نسبة تنفيذ السياسات',        unit: '%',       defaultTarget: 100, frequency: 'quarterly', category: 'compliance', importance: 'important', why: 'السياسة مكتوبة لا تعني منفّذة — القياس يضمن التطبيق الفعلي.',            pathFit: ['MEDIUM'] },
    { name: 'زمن حلّ حالات الامتثال',      unit: 'يوم',     defaultTarget: 7,  frequency: 'monthly',   category: 'efficiency', importance: 'nice',      why: 'التأخير في المعالجة يفاقم المخاطر التنظيمية.',                            pathFit: ['QUICK'] },
  ],
  GOVERNANCE: [
    { name: 'نسبة حضور اجتماعات المجلس',  unit: '%',       defaultTarget: 90, frequency: 'quarterly', category: 'compliance', importance: 'critical', why: 'حوكمة فعّالة تتطلّب حضوراً — الغياب المتكرّر يعطّل القرارات.',            pathFit: ['MEDIUM', 'LONG'],
      howToCalculate: {
        formula: '(مجموع الحضور الفعلي ÷ (عدد الأعضاء × عدد الاجتماعات)) × ١٠٠',
        example: '(٢٧ حضور ÷ (٥ أعضاء × ٦ اجتماعات = ٣٠)) × ١٠٠ = ٩٠٪',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ٩٥٪' },
          { level: 'جيد',   range: '٨٥-٩٤٪' },
          { level: 'تحذير', range: '٧٠-٨٤٪' },
          { level: 'حرج',   range: '< ٧٠٪' },
        ],
        improveActions: ['حدّد جدول الاجتماعات سنوياً مسبقاً', 'فعّل الحضور عن بُعد للأعضاء المسافرين', 'راجع الأعضاء ذوي الغياب المتكرّر', 'ابنِ أجندة موجزة تركّز على القرارات الجوهريّة'],
      } },
    { name: 'تنفيذ قرارات المجلس',         unit: '%',       defaultTarget: 95, frequency: 'quarterly', category: 'compliance', importance: 'critical', why: 'قرارات بلا تنفيذ = حوكمة شكلية — القياس يضمن المتابعة.',                 pathFit: ['MEDIUM', 'LONG'],
      howToCalculate: {
        formula: '(عدد القرارات المنفَّذة ÷ إجمالي القرارات المُتَّخذة) × ١٠٠',
        example: '(١٩ قرار منفَّذ ÷ ٢٠ قرار) × ١٠٠ = ٩٥٪',
        benchmarks: [
          { level: 'ممتاز', range: '≥ ٩٨٪' },
          { level: 'جيد',   range: '٩٠-٩٧٪' },
          { level: 'تحذير', range: '٧٥-٨٩٪' },
          { level: 'حرج',   range: '< ٧٥٪' },
        ],
        improveActions: ['أنشئ سجلّ قرارات مع مالك ومهلة لكل قرار', 'راجع حالة التنفيذ في بداية كل اجتماع', 'أعطِ صلاحيّات كافية لمالكي التنفيذ', 'أرسل تقرير حالة شهري للمجلس'],
      } },
    { name: 'تقييم فعالية المجلس',        unit: 'نقطة',    defaultTarget: 8,  frequency: 'annual',    category: 'quality',    importance: 'important', why: 'تقييم دوري يكشف نقاط القوة والفجوات في أعمال المجلس.',                    pathFit: ['LONG'] },
    { name: 'عدد النزاعات الحوكميّة',      unit: 'نزاع',    defaultTarget: 0,  frequency: 'annual',    category: 'compliance', importance: 'nice',      why: 'النزاعات إشارة إلى ضعف حوكمة/شفافية — الصفر هدف مثالي.',                    pathFit: ['MEDIUM', 'LONG'] },
  ],
}

// بنك عام (بلا تخصّص) — أشهر ٦ مؤشرات للـ OWNER لو ما فيه إدارة.
export const GENERAL_KPI_BANK: KPISuggestion[] = [
  { name: 'إيراد الشركة الشهري',   unit: 'ريال',   defaultTarget: 500000, frequency: 'monthly',   category: 'growth',     importance: 'critical', why: 'المؤشر الأمّ للشركة — نمو ثابت يعني نموذج عمل سليم.',                    pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
  { name: 'هامش الربح الإجمالي',   unit: '%',      defaultTarget: 30,     frequency: 'monthly',   category: 'financial',  importance: 'critical', why: 'كفاءة التسعير والتكلفة معاً — أهمّ مؤشر للاستدامة.',                     pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
  { name: 'رضا العملاء (CSAT)',    unit: '%',      defaultTarget: 90,     frequency: 'monthly',   category: 'customer',   importance: 'critical', why: 'يقيس تجربة العميل — الانخفاض يسبق فقد العملاء.',                        pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
  { name: 'معدل دوران الموظفين',   unit: '%',      defaultTarget: 10,     frequency: 'quarterly', category: 'people',     importance: 'important', why: 'صحّة بيئة العمل — الارتفاع يعني فقدان معرفة وتكلفة استبدال.',           pathFit: ['MEDIUM', 'LONG'] },
  { name: 'نسبة الأهداف المُحقّقة', unit: '%',      defaultTarget: 80,     frequency: 'quarterly', category: 'efficiency', importance: 'important', why: 'يقيس فعالية التخطيط + الالتزام + التنفيذ معاً.',                         pathFit: ['MEDIUM', 'LONG'] },
  { name: 'دورات نقد جاهزة',        unit: 'شهر',    defaultTarget: 12,     frequency: 'monthly',   category: 'financial',  importance: 'critical', why: 'كم شهراً تستمرّ الشركة إن توقّف الدخل؟ يجب أن يكون ٦+ دائماً.',           pathFit: ['QUICK', 'MEDIUM'] },
]

// إيجاد ميتاداتا مؤشر من البنك بمطابقة الاسم (للمؤشرات المُنشأة يدوياً بلا مصدر).
export function findKPIMeta(
  name: string,
  specialty: DeptCode | null,
): KPISuggestion | null {
  const bank = specialty ? DEPT_KPI_BANK[specialty] : GENERAL_KPI_BANK
  return bank.find((s) => s.name.trim() === name.trim()) ?? null
}

// فلترة البنك بحسب المسار: نُبرز المؤشرات المطابقة، بلا حذف الآخرين.
export function isKPIInPath(kpi: KPISuggestion, path: StrategyPath | null | undefined): boolean {
  if (!path) return true
  return kpi.pathFit.includes(path)
}
