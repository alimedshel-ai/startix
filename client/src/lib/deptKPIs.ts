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

export interface KPISuggestion {
  name: string
  unit: string
  defaultTarget: number
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
  category: KPICategory
  importance: KPIImportance
  why: string          // لماذا هذا المؤشر؟
  pathFit: StrategyPath[]
}

// ⚠️ الأسماء يجب أن تكون فريدة داخل كل إدارة (نستعملها كـ lookup key).
export const DEPT_KPI_BANK: Record<DeptCode, KPISuggestion[]> = {
  HR: [
    { name: 'معدل دوران الموظفين',      unit: '%',       defaultTarget: 10, frequency: 'quarterly', category: 'people',     importance: 'critical', why: 'قياس صحّة بيئة العمل — الارتفاع يعني فقدان معرفة وتكلفة استبدال.',        pathFit: ['MEDIUM', 'LONG'] },
    { name: 'زمن ملء الشواغر',           unit: 'يوم',     defaultTarget: 30, frequency: 'monthly',   category: 'efficiency', importance: 'important', why: 'يقيس سرعة الاستقطاب — تأخّره يعطّل تنفيذ الخطط.',                        pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'نسبة رضا الموظفين eNPS',    unit: 'نقطة',    defaultTarget: 40, frequency: 'quarterly', category: 'people',     importance: 'important', why: 'مؤشر مسبق للاحتفاظ والإنتاجية — يسبق قرار الاستقالة عادةً بشهور.',       pathFit: ['MEDIUM', 'LONG'] },
    { name: 'ساعات تدريب لكل موظف',      unit: 'ساعة',    defaultTarget: 20, frequency: 'annual',    category: 'people',     importance: 'nice',      why: 'استثمار في المهارات = قدرة أعلى على التنفيذ الاستراتيجي.',                pathFit: ['LONG'] },
    { name: 'نسبة التوطين',              unit: '%',       defaultTarget: 40, frequency: 'quarterly', category: 'compliance', importance: 'critical', why: 'التزام بنطاقات — الغرامات المحتملة وحرمان من دعم حكومي.',                 pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'الغياب غير المخطّط',        unit: '%',       defaultTarget: 3,  frequency: 'monthly',   category: 'people',     importance: 'nice',      why: 'مؤشّر بيئة عمل — الارتفاع علامة على إرهاق أو مشكلات إشراف.',              pathFit: ['QUICK'] },
  ],
  FINANCE: [
    { name: 'هامش الربح الإجمالي',       unit: '%',       defaultTarget: 30, frequency: 'monthly',   category: 'financial',  importance: 'critical', why: 'يعكس كفاءة التسعير والتكلفة معاً — أهمّ مؤشر للاستدامة.',                pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'نقد جاهز (Cash Runway)',    unit: 'شهر',     defaultTarget: 12, frequency: 'monthly',   category: 'financial',  importance: 'critical', why: 'كم شهراً تستمرّ الشركة إن توقّف الدخل؟ يجب أن يكون ٦+ دائماً.',           pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'أيام تحصيل المدينين (DSO)', unit: 'يوم',     defaultTarget: 45, frequency: 'monthly',   category: 'efficiency', importance: 'important', why: 'زمن تحصيل الفواتير — التأخّر يعطّل السيولة حتى لو الأرباح جيدة.',         pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'الإيراد الشهري المتكرّر',   unit: 'ريال',    defaultTarget: 500000, frequency: 'monthly', category: 'growth',  importance: 'critical', why: 'قاعدة إيراد ثابتة — تنبّؤ أفضل للمستقبل واستثمار أسلم.',                 pathFit: ['MEDIUM', 'LONG'] },
    { name: 'نسبة الإنفاق مقابل الميزانية', unit: '%',    defaultTarget: 100, frequency: 'monthly',  category: 'financial',  importance: 'important', why: 'انضباط تنفيذ الميزانية — التجاوز يعني حاجة لمراجعة أولويات.',            pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'العائد على الاستثمار (ROI)', unit: '%',      defaultTarget: 15, frequency: 'annual',    category: 'financial',  importance: 'important', why: 'كم يعود كل ريال مُستثمَر؟ يوجّه قرارات التخصيص المستقبلية.',            pathFit: ['MEDIUM', 'LONG'] },
  ],
  SALES: [
    { name: 'إيراد المبيعات الشهري',     unit: 'ريال',    defaultTarget: 300000, frequency: 'monthly', category: 'growth', importance: 'critical', why: 'المؤشر الأمّ للمبيعات — يجب أن ينمو باتساق أو يستقرّ عند المستهدف.',    pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'معدل التحويل',              unit: '%',       defaultTarget: 20, frequency: 'monthly',   category: 'efficiency', importance: 'important', why: 'كم نسبة العملاء المحتملين الذين يشترون فعلاً؟ يقيس كفاءة الفريق.',       pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'متوسط قيمة الصفقة',         unit: 'ريال',    defaultTarget: 20000, frequency: 'monthly', category: 'growth', importance: 'important', why: 'اتجاه هذا الرقم صعوداً = ترقية العملاء لخيارات أعلى قيمة.',              pathFit: ['MEDIUM', 'LONG'] },
    { name: 'دورة البيع (طول)',           unit: 'يوم',     defaultTarget: 30, frequency: 'monthly',   category: 'efficiency', importance: 'nice',    why: 'دورة أقصر = كفاءة أعلى + سيولة أسرع.',                                    pathFit: ['QUICK'] },
    { name: 'نسبة الاحتفاظ بالعملاء',     unit: '%',      defaultTarget: 90, frequency: 'quarterly', category: 'customer', importance: 'critical', why: 'استبدال عميل أغلى ٥× من الاحتفاظ به — انخفاض هنا نزيف.',                  pathFit: ['MEDIUM', 'LONG'] },
    { name: 'عدد العملاء الجدد',          unit: 'عميل',    defaultTarget: 10, frequency: 'monthly',   category: 'growth',  importance: 'important', why: 'قياس فعالية اكتساب العملاء الجدد + مؤشر مسبق للنمو.',                     pathFit: ['QUICK', 'MEDIUM'] },
  ],
  MARKETING: [
    { name: 'تكلفة اكتساب العميل (CAC)', unit: 'ريال',    defaultTarget: 200, frequency: 'monthly',  category: 'financial',  importance: 'critical', why: 'كم نُنفق لجذب كل عميل؟ يجب أن يكون أقل من قيمته لمدى حياته.',            pathFit: ['MEDIUM', 'LONG'] },
    { name: 'قيمة العميل مدى الحياة (LTV)', unit: 'ريال', defaultTarget: 5000, frequency: 'quarterly', category: 'growth',  importance: 'critical', why: 'نسبة LTV/CAC ≥ ٣ صحّي — أقل يعني نموذج غير مستدام.',                     pathFit: ['MEDIUM', 'LONG'] },
    { name: 'الوصول العضوي الشهري',      unit: 'زيارة',   defaultTarget: 50000, frequency: 'monthly',  category: 'growth', importance: 'important', why: 'قناة نمو غير مدفوعة — استثمار طويل الأمد يقلّل الاعتماد على الإعلانات.', pathFit: ['LONG'] },
    { name: 'نسبة النقر (CTR)',           unit: '%',       defaultTarget: 3,  frequency: 'weekly',    category: 'efficiency', importance: 'nice',   why: 'كفاءة رسائل الحملات — انخفاضه يستدعي مراجعة الرسالة أو الجمهور.',       pathFit: ['QUICK'] },
    { name: 'حصّة العلامة في الذكر (SoV)', unit: '%',     defaultTarget: 25, frequency: 'quarterly', category: 'growth',   importance: 'nice',      why: 'حضور علامتك مقارنة بمنافسيك على المنصّات — مؤشر طويل الأمد.',            pathFit: ['LONG'] },
    { name: 'معدل التفاعل الاجتماعي',    unit: '%',       defaultTarget: 5,  frequency: 'weekly',    category: 'customer',   importance: 'nice',      why: 'صحة المحتوى وقربه من الجمهور — يسبق نمو المتابعين والوصول.',              pathFit: ['QUICK', 'MEDIUM'] },
  ],
  OPERATIONS: [
    { name: 'كفاءة الإنتاج (OEE)',        unit: '%',       defaultTarget: 85, frequency: 'monthly',   category: 'efficiency', importance: 'critical', why: 'مقياس عالمي لكفاءة العمليات — يجمع التوافر والأداء والجودة معاً.',       pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'دقّة التسليم في الموعد',    unit: '%',       defaultTarget: 95, frequency: 'monthly',   category: 'quality',    importance: 'critical', why: 'صحّة الوعد للعميل — الأثر المباشر على الرضا والاحتفاظ.',                 pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'نسبة الفاقد (Waste)',        unit: '%',       defaultTarget: 5,  frequency: 'monthly',   category: 'efficiency', importance: 'important', why: 'الفاقد تكلفة مباشرة — كل انخفاض ينعكس على الهامش.',                       pathFit: ['QUICK'] },
    { name: 'زمن دورة الإنتاج',           unit: 'ساعة',   defaultTarget: 8,  frequency: 'weekly',    category: 'efficiency', importance: 'important', why: 'دورة أقصر = طاقة أعلى وتكلفة أقل بلا استثمار جديد.',                     pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'دوران المخزون',              unit: 'مرة/سنة', defaultTarget: 8, frequency: 'quarterly', category: 'efficiency', importance: 'nice',      why: 'يقيس كفاءة إدارة المخزون — انخفاضه = رأس مال معطّل.',                     pathFit: ['MEDIUM'] },
    { name: 'حوادث السلامة',              unit: 'حادثة',   defaultTarget: 0,  frequency: 'monthly',   category: 'compliance', importance: 'critical', why: 'صفر حوادث = التزام قانوني + حماية للفريق + سمعة الشركة.',                 pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
  ],
  IT: [
    { name: 'زمن التشغيل (Uptime)',       unit: '%',       defaultTarget: 99.9, frequency: 'monthly', category: 'quality',    importance: 'critical', why: 'كل ٠٫١٪ نزول = ~٤٥ دقيقة انقطاع شهرياً — يضرب مصداقية الأنظمة.',           pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'متوسط زمن حل التذاكر (MTTR)', unit: 'ساعة',   defaultTarget: 4, frequency: 'weekly',    category: 'efficiency', importance: 'important', why: 'يقيس فعالية الاستجابة — سرعة الحل تحمي إنتاجية بقية الفريق.',            pathFit: ['QUICK'] },
    { name: 'حوادث الأمن السيبراني',      unit: 'حادثة',   defaultTarget: 0, frequency: 'monthly',   category: 'compliance', importance: 'critical', why: 'كل حادث ممكن يعني فقد بيانات، غرامات PDPL، وضرر سمعة كبير.',              pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'نسبة الاعتماد على السحابة',  unit: '%',       defaultTarget: 80, frequency: 'quarterly', category: 'digital',   importance: 'important', why: 'تحوّل رقمي = مرونة أعلى + خفض تكلفة on-prem تدريجياً.',                    pathFit: ['MEDIUM', 'LONG'] },
    { name: 'تكلفة تقنية المعلومات لكل موظف', unit: 'ريال', defaultTarget: 5000, frequency: 'annual', category: 'financial', importance: 'nice',      why: 'مقارنة مع الصناعة — الارتفاع يستدعي مراجعة الفعّالية.',                  pathFit: ['MEDIUM'] },
    { name: 'إنجاز المشاريع التقنية في الموعد', unit: '%', defaultTarget: 90, frequency: 'quarterly', category: 'efficiency', importance: 'important', why: 'كثرة التأخير = عرقلة استراتيجيات أخرى تعتمد على مخرجات IT.',              pathFit: ['MEDIUM', 'LONG'] },
  ],
  CUSTOMER_SERVICE: [
    { name: 'رضا العملاء (CSAT)',        unit: '%',       defaultTarget: 90, frequency: 'monthly',   category: 'customer',   importance: 'critical', why: 'يقيس تجربة العميل بعد كل تفاعل — الانخفاض يسبق فقد العملاء.',            pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'صافي المروّجين (NPS)',      unit: 'نقطة',    defaultTarget: 50, frequency: 'quarterly', category: 'customer',   importance: 'critical', why: 'مؤشر ولاء ومدى استعداد العميل للتوصية — مضاعف نمو مجاني.',                pathFit: ['MEDIUM', 'LONG'] },
    { name: 'زمن الاستجابة الأول',        unit: 'دقيقة',   defaultTarget: 15, frequency: 'weekly',    category: 'efficiency', importance: 'important', why: 'الردّ السريع نصف الحل — يرفع الرضا حتى قبل حلّ المشكلة.',                pathFit: ['QUICK'] },
    { name: 'معدل حلّ من أول مرّة (FCR)', unit: '%',      defaultTarget: 75, frequency: 'monthly',   category: 'quality',    importance: 'important', why: 'حلّ التذكرة من أوّل مرة = رضا أعلى + تكلفة أقل + فريق أقل إنهاكاً.',      pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'نسبة الاسترجاع',             unit: '%',       defaultTarget: 3,  frequency: 'monthly',   category: 'customer',   importance: 'nice',      why: 'الارتفاع علامة على مشكلة في المنتج/الوعد — لا في الدعم فقط.',              pathFit: ['MEDIUM'] },
  ],
  SUPPORT: [
    { name: 'زمن الحلّ (MTTR)',           unit: 'ساعة',   defaultTarget: 8,  frequency: 'weekly',    category: 'efficiency', importance: 'critical', why: 'كل ساعة تأخير حل = عميل غير راضٍ + مشكلة تكبر.',                          pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'صافي المروّجين (NPS)',       unit: 'نقطة',    defaultTarget: 50, frequency: 'quarterly', category: 'customer',   importance: 'critical', why: 'مؤشر تجربة الدعم — النقاط السالبة تعني أنّ الدعم مصدر خسارة عملاء.',    pathFit: ['MEDIUM', 'LONG'] },
    { name: 'نسبة تصعيد التذاكر',         unit: '%',       defaultTarget: 5,  frequency: 'monthly',   category: 'quality',    importance: 'important', why: 'ارتفاعها = فريق L1 يحتاج تدريباً أو أدواتٍ أفضل.',                       pathFit: ['MEDIUM'] },
    { name: 'إنتاجية الوكيل',              unit: 'تذكرة/يوم', defaultTarget: 20, frequency: 'weekly', category: 'efficiency', importance: 'nice',   why: 'يقيس فعالية الفرد — الانخفاض بلا سبب واضح = مشكلة تنظيم أو أدوات.',    pathFit: ['QUICK'] },
  ],
  LOGISTICS: [
    { name: 'دقّة التسليم في الوقت',      unit: '%',       defaultTarget: 95, frequency: 'monthly',   category: 'quality',    importance: 'critical', why: 'الوعد الأساسي للعميل — أي انخفاض يهزّ الثقة بسرعة.',                       pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'تكلفة الشحن لكل طلب',        unit: 'ريال',    defaultTarget: 25, frequency: 'monthly',   category: 'financial',  importance: 'important', why: 'انخفاضها يرفع الهامش مباشرة — كثيراً ما يكون فيها فجوات كفاءة.',        pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'نسبة الطلبات الكاملة',        unit: '%',       defaultTarget: 98, frequency: 'monthly',   category: 'quality',    importance: 'important', why: 'وصول الطلب كاملاً بلا تلف = عميل راضٍ + لا استرجاعات.',                    pathFit: ['QUICK'] },
    { name: 'زمن دورة المخزون',           unit: 'يوم',     defaultTarget: 45, frequency: 'quarterly', category: 'efficiency', importance: 'nice',      why: 'مخزون طويل = رأس مال معطّل + تكلفة تخزين + مخاطر تلف.',                    pathFit: ['MEDIUM'] },
    { name: 'حوادث نقل',                   unit: 'حادثة',   defaultTarget: 0,  frequency: 'monthly',   category: 'compliance', importance: 'critical', why: 'صفر حوادث = حماية للسائقين + التزام + سمعة الأسطول.',                     pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
  ],
  QUALITY: [
    { name: 'معدل العيوب (Defect Rate)',   unit: 'ppm',    defaultTarget: 100, frequency: 'monthly',  category: 'quality',    importance: 'critical', why: 'مقياس الجودة الفعلي — الاتّجاه الأهم من الرقم المطلق.',                    pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'كلفة الجودة الرديئة (COPQ)',  unit: 'ريال',   defaultTarget: 50000, frequency: 'quarterly', category: 'financial', importance: 'important', why: 'الجودة الرديئة تكلفة خفيّة كبيرة — إعادة عمل، شكاوى، فقد عملاء.',       pathFit: ['MEDIUM', 'LONG'] },
    { name: 'دقّة تدقيقات الجودة',         unit: '%',       defaultTarget: 95, frequency: 'monthly',   category: 'quality',    importance: 'important', why: 'ضمان أنّ التدقيق يكشف المشكلات فعلاً وليس إجراءً شكلياً.',                 pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'شهادات الجودة السارية',       unit: 'شهادة',  defaultTarget: 3,  frequency: 'annual',    category: 'compliance', importance: 'nice',      why: 'الشهادات (ISO) مطلوبة في المناقصات الكبرى — مصدر فرص جديدة.',              pathFit: ['LONG'] },
    { name: 'زمن كشف العيوب',              unit: 'ساعة',    defaultTarget: 2,  frequency: 'weekly',    category: 'efficiency', importance: 'important', why: 'الكشف المتأخّر = عيوب أكثر تنتشر — الاكتشاف المبكّر يوقف الضرر.',        pathFit: ['QUICK'] },
  ],
  PROJECTS: [
    { name: 'إنجاز المشاريع في الموعد',   unit: '%',       defaultTarget: 90, frequency: 'quarterly', category: 'efficiency', importance: 'critical', why: 'التأخير يعطّل استراتيجيات مرتبطة + يهزّ الثقة الداخلية.',                 pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'الالتزام بالميزانية',        unit: '%',       defaultTarget: 100, frequency: 'quarterly', category: 'financial',  importance: 'critical', why: 'التجاوز = ضغط سيولة + تعديل أولويات مستقبلية.',                          pathFit: ['QUICK', 'MEDIUM'] },
    { name: 'رضا صاحب المصلحة',           unit: 'نقطة',    defaultTarget: 8,  frequency: 'quarterly', category: 'customer',   importance: 'important', why: 'المشروع الناجح فنياً قد يفشل عند الاستلام — يقيس الصورة الكاملة.',      pathFit: ['MEDIUM', 'LONG'] },
    { name: 'مؤشر أداء التكلفة (CPI)',    unit: 'نسبة',    defaultTarget: 1,  frequency: 'monthly',   category: 'efficiency', importance: 'nice',      why: 'CPI < 1 = الإنفاق أسرع من الإنجاز — إشارة مبكّرة لتجاوز.',                 pathFit: ['MEDIUM'] },
  ],
  COMPLIANCE: [
    { name: 'ملاحظات الجهات الرقابية',    unit: 'ملاحظة',  defaultTarget: 0,  frequency: 'quarterly', category: 'compliance', importance: 'critical', why: 'كل ملاحظة = غرامة محتملة + سمعة تنظيمية — الصفر هدف حرج.',              pathFit: ['QUICK', 'MEDIUM', 'LONG'] },
    { name: 'دورات التوعية للفريق',        unit: 'دورة',    defaultTarget: 4,  frequency: 'annual',    category: 'people',     importance: 'important', why: 'وعي الفريق خطّ الدفاع الأوّل — يوقف الخطأ قبل حدوثه.',                     pathFit: ['MEDIUM', 'LONG'] },
    { name: 'نسبة تنفيذ السياسات',        unit: '%',       defaultTarget: 100, frequency: 'quarterly', category: 'compliance', importance: 'important', why: 'السياسة مكتوبة لا تعني منفّذة — القياس يضمن التطبيق الفعلي.',            pathFit: ['MEDIUM'] },
    { name: 'زمن حلّ حالات الامتثال',      unit: 'يوم',     defaultTarget: 7,  frequency: 'monthly',   category: 'efficiency', importance: 'nice',      why: 'التأخير في المعالجة يفاقم المخاطر التنظيمية.',                            pathFit: ['QUICK'] },
  ],
  GOVERNANCE: [
    { name: 'نسبة حضور اجتماعات المجلس',  unit: '%',       defaultTarget: 90, frequency: 'quarterly', category: 'compliance', importance: 'critical', why: 'حوكمة فعّالة تتطلّب حضوراً — الغياب المتكرّر يعطّل القرارات.',            pathFit: ['MEDIUM', 'LONG'] },
    { name: 'تنفيذ قرارات المجلس',         unit: '%',       defaultTarget: 95, frequency: 'quarterly', category: 'compliance', importance: 'critical', why: 'قرارات بلا تنفيذ = حوكمة شكلية — القياس يضمن المتابعة.',                 pathFit: ['MEDIUM', 'LONG'] },
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
