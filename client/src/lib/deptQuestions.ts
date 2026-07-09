// ═══════════════════════════════════════════════════════════════════════════
// بنك أسئلة التشخيص العميق للإدارات الـ13 — نُقل حرفياً من stratix legacy
// (المصدر: /Users/ali/startix featires/src/js/dept-deep.js).
// ═══════════════════════════════════════════════════════════════════════════
//
// هذا الملف يخدم مسار «تشخيص المدير العميق قبل التسجيل»
// (TryManagerDeepDiagnosticPage — الأمر ٢٣ في الخطة). المدير المستقل يختار
// إدارة تخصّصه ثم يجيب على بنك أسئلة تلك الإدارة كاملاً. النتيجة تحسب على
// السيرفر عبر /api/diagnostic/preview/manager-deep (الأمر ١٧).
//
// النقل يجري إدارة/commit — HR أوّل الأوامر (الأمر ١)، وباقي الإدارات
// تُلحق في الأوامر ٢..١٣. الأمر ١٤ يدمج طبقة DEPT_LOGIC + free-diagnostic
// من dept-config.js.
//
// ─── انحرافات موثّقة عن schema الخطة الأصلية ────────────────────────────────
// (تحسينات على البنية بلا كسر عكسي — كل انحراف يحفظ الأمانة الحرفية للمصدر):
//
// ١. **types أوسع** — الخطة ذكرت `type: 'radio'` فقط. المصدر يستعمل ثلاثة:
//    - `'radio'` (اختيار واحد من عدّة خيارات) — الأكثر شيوعاً.
//    - `'checkbox'` (اختيار متعدّد) — للحقول التي تعدد عناصر مثل المزايا
//      أو قنوات التوظيف. نحفظها كما هي لأن تحويلها لـ radio يفقد المعنى.
//    - `'textarea'` (نص حرّ) — أسئلة مفتوحة مثل «من الشخص المفتاحي؟».
//      لا تدخل في حساب healthPct لكنّها تُخزَّن في الإجابات للمراجعة.
//
// ٢. **sectionIds خاصّة بالإدارة** — الخطة اقترحت ٦ فتحات عامّة (status/
//    diagnosis/sw/outputs/challenges/goals). لكن المصدر عنده أقسام مختلفة
//    لكل إدارة (HR: هيكل تنظيمي/شؤون موظفين/توظيف/أداء/مواهب/ثقافة).
//    إجبارها على ٦ عامّة يُفقد الوضوح، فاعتمدنا مفاتيح خاصّة بكل إدارة
//    (`hr_structure`, `hr_records`, إلخ) وأبقينا التزام الأقسام الست.
//
// ٣. **icon على القسم** — المصدر يخزّن أيقونة emoji لكل قسم (🏗️/📁/🎯…).
//    نحفظها كحقل اختياري لأن الواجهة الأصلية تستخدمها في العناوين.
// ═══════════════════════════════════════════════════════════════════════════

export type DeptCode =
  | 'HR' | 'FINANCE' | 'SALES' | 'MARKETING' | 'OPERATIONS' | 'IT'
  | 'CUSTOMER_SERVICE' | 'SUPPORT' | 'LOGISTICS' | 'QUALITY'
  | 'PROJECTS' | 'GOVERNANCE' | 'COMPLIANCE'

export type QuestionPriority = 'حرج' | 'مهم' | 'عادي'
export type QuestionType = 'radio' | 'checkbox' | 'textarea'

export interface SectionEntry {
  id: string
  icon?: string
  title: string
  priority?: QuestionPriority
  desc?: string
}

interface QuestionBase {
  id: string
  sectionId: string
  label: string
  weight?: number
}

export interface RadioQuestion extends QuestionBase {
  type: 'radio'
  opts: string[]
}

export interface CheckboxQuestion extends QuestionBase {
  type: 'checkbox'
  opts: string[]
}

export interface TextareaQuestion extends QuestionBase {
  type: 'textarea'
  placeholder?: string
}

export type QuestionEntry = RadioQuestion | CheckboxQuestion | TextareaQuestion

export interface DeptQuestions {
  sections: SectionEntry[]
  questions: QuestionEntry[]
}

// ─── HR — الموارد البشرية ─────────────────────────────────────────────────
// المصدر: dept-deep.js:670-915 (٦ أقسام، ٥٠ سؤال).

const HR: DeptQuestions = {
  sections: [
    { id: 'hr_structure',   icon: '🏗️', title: 'الهيكل التنظيمي وتخطيط الموارد',        priority: 'حرج', desc: 'الهيكل التنظيمي هو الأساس — بدونه لا يمكن توزيع المسؤوليات أو قياس الأداء' },
    { id: 'hr_records',     icon: '📁', title: 'شؤون الموظفين والعقود والحضور',          priority: 'حرج', desc: 'ملفات الموظفين والعقود والرواتب — أخطاء هنا تعني غرامات أو قضايا عمالية' },
    { id: 'hr_recruitment', icon: '🎯', title: 'التوظيف والاستقطاب',                     priority: 'مهم', desc: 'جودة التوظيف تحدد جودة الإدارة — 46% من التعيينات الجديدة تفشل خلال 18 شهر' },
    { id: 'hr_performance', icon: '📈', title: 'إدارة الأداء والتدريب والتطوير',         priority: 'حرج', desc: 'الشركات التي تقيّم الأداء بانتظام تنمو 3x أسرع — والتدريب يرفع إنتاجية الموظف 22%' },
    { id: 'hr_talent',      icon: '💎', title: 'إدارة المواهب والتعويضات',               priority: 'مهم', desc: 'تكلفة فقدان موظف محترف = 1.5x إلى 2x من راتبه السنوي — الاستبقاء أرخص من التوظيف' },
    { id: 'hr_culture',     icon: '🏛️', title: 'الثقافة والبيئة والأنظمة التقنية',      priority: 'مهم', desc: 'ثقافة الشركة تحدد من يبقى ومن يرحل — والأنظمة التقنية تحدد السرعة والدقة' },
  ],
  questions: [
    // ─── 1. الهيكل التنظيمي وتخطيط الموارد ──────────────────────────────
    { type: 'radio', sectionId: 'hr_structure', id: 'org_chart',              label: '📊 هل لديك مخطط تنظيمي واضح ومحدّث؟',                                opts: ['نعم — محدّث ومعتمد', 'موجود لكن قديم', 'لا يوجد'] },
    { type: 'radio', sectionId: 'hr_structure', id: 'span_control',           label: 'كم موظف يتبع للمشرف الواحد في المتوسط؟',                             opts: ['3-7 (مثالي)', '8-12', 'أكثر من 12', 'غير واضح'] },
    { type: 'radio', sectionId: 'hr_structure', id: 'structure_flexibility',  label: 'هل الهيكل التنظيمي مرن وقابل للتعديل حسب المتغيرات؟',                opts: ['نعم — معدّل دورياً', 'ثابت لكن يمكن تعديله', 'جامد ومعقد'] },
    { type: 'radio', sectionId: 'hr_structure', id: 'hr_planning',            label: '📋 هل لديك خطة موارد بشرية مرتبطة باستراتيجية الشركة؟',              opts: ['نعم — خطة سنوية', 'تخطيط جزئي', 'لا — نوظف حسب الحاجة'] },
    { type: 'radio', sectionId: 'hr_structure', id: 'succession_plan',        label: 'هل لديك خطة تعاقب وظيفي للمناصب الحرجة؟',                            opts: ['نعم — موثقة', 'في أذهاننا', 'لا'] },
    { type: 'radio', sectionId: 'hr_structure', id: 'workforce_forecast',     label: 'هل تتوقع احتياجاتك من الموظفين للسنة القادمة؟',                       opts: ['نعم — بدقة', 'تقديرات عامة', 'لا'] },

    // ─── 2. شؤون الموظفين والعقود والحضور ──────────────────────────────
    { type: 'radio',    sectionId: 'hr_records', id: 'employee_files',       label: '📁 ما حالة ملفات الموظفين لديك؟',                                        opts: ['مكتملة ورقمية ومؤمّنة', 'موجودة لكن غير مكتملة', 'فوضوية أو ورقية فقط'] },
    { type: 'radio',    sectionId: 'hr_records', id: 'payroll_accuracy',     label: 'ما نسبة دقة صرف الرواتب والبدلات؟',                                      opts: ['99%+ بلا أخطاء', 'أخطاء نادرة', 'أخطاء متكررة'] },
    { type: 'radio',    sectionId: 'hr_records', id: 'leave_mgmt',           label: 'كيف تدير الإجازات (تسجيل، اعتماد، رصيد)؟',                              opts: ['نظام إلكتروني متكامل', 'جداول Excel', 'يدوي بالكامل'] },
    { type: 'radio',    sectionId: 'hr_records', id: 'exit_process',         label: 'هل لديك إجراء واضح لإنهاء الخدمات ومقابلات الخروج؟',                    opts: ['نعم — موثّق', 'جزئي', 'لا'] },
    { type: 'checkbox', sectionId: 'hr_records', id: 'benefits_package',     label: 'ما المزايا الإضافية المقدمة للموظفين؟',                                  opts: ['تأمين طبي', 'بدل سكن', 'بدل مواصلات', 'وجبات', 'تأمين على الحياة', 'لا مزايا إضافية'] },
    { type: 'checkbox', sectionId: 'hr_records', id: 'contract_types',       label: '📝 ما أنواع العقود المستخدمة في شركتك؟',                                 opts: ['دائم (غير محدد)', 'محدد المدة', 'موسمي', 'تدريب/تأهيل', 'استشاري/حر', 'عمل جزئي'] },
    { type: 'radio',    sectionId: 'hr_records', id: 'contract_compliance',  label: 'هل عقودك متوافقة مع نظام العمل وتشمل بنود السرية وعدم المنافسة؟',        opts: ['نعم — مراجعة قانونية', 'متوافقة جزئياً', 'غير متأكد'] },
    { type: 'radio',    sectionId: 'hr_records', id: 'contract_renewal',     label: 'هل لديك آلية واضحة لتجديد العقود وإشعار الموظفين؟',                     opts: ['نعم — تلقائية', 'يدوية لكن منتظمة', 'لا — نتأخر أحياناً'] },
    { type: 'radio',    sectionId: 'hr_records', id: 'attendance_system',    label: '⏰ ما نظام تسجيل الحضور والانصراف؟',                                     opts: ['بصمة/تطبيق إلكتروني', 'كارت حضور', 'تسجيل يدوي', 'لا يوجد نظام'] },
    { type: 'radio',    sectionId: 'hr_records', id: 'absence_rate',         label: 'ما معدل الغياب الشهري؟',                                                 opts: ['أقل من 2%', '2-5%', 'أكثر من 5%', 'لا أعرف'] },
    { type: 'radio',    sectionId: 'hr_records', id: 'flexible_work',        label: 'هل تطبق نظام دوام مرن أو عمل عن بُعد؟',                                  opts: ['نعم — سياسة واضحة', 'أحياناً', 'لا'] },

    // ─── 3. التوظيف والاستقطاب ─────────────────────────────────────────
    { type: 'radio',    sectionId: 'hr_recruitment', id: 'hiring_cycle',          label: '🎯 كم يستغرق ملء الوظيفة الشاغرة في المتوسط؟',                       opts: ['أقل من 30 يوم', '30-60 يوم', '60-90 يوم', 'أكثر من 90 يوم'] },
    { type: 'checkbox', sectionId: 'hr_recruitment', id: 'recruitment_channels',  label: 'ما قنوات التوظيف التي تستخدمها؟',                                    opts: ['LinkedIn', 'منصات توظيف سعودية', 'شركات توظيف', 'توصيات داخلية', 'معارض توظيف', 'السوشيال ميديا'] },
    { type: 'radio',    sectionId: 'hr_recruitment', id: 'onboarding_program',    label: 'هل لديك برنامج تهيئة (Onboarding) للموظفين الجدد؟',                  opts: ['نعم — برنامج متكامل', 'توجيه بسيط', 'لا — يتعلم بنفسه'] },
    { type: 'radio',    sectionId: 'hr_recruitment', id: 'employer_brand',        label: 'كيف تقيّم جاذبية شركتك كصاحب عمل في السوق؟',                         opts: ['علامة تجارية قوية للتوظيف', 'معروفة في مجالنا', 'غير معروفة'] },
    { type: 'radio',    sectionId: 'hr_recruitment', id: 'probation_pass',        label: 'ما نسبة اجتياز فترة التجربة؟',                                        opts: ['أكثر من 90%', '70-90%', 'أقل من 70%'] },

    // ─── 4. إدارة الأداء والتدريب والتطوير ─────────────────────────────
    { type: 'radio', sectionId: 'hr_performance', id: 'performance_eval',    label: '📈 هل لديك نظام تقييم أداء؟',                                            opts: ['نعم — دوري ومنهجي', 'أحياناً', 'لا'] },
    { type: 'radio', sectionId: 'hr_performance', id: 'perf_goals_linked',   label: 'هل أهداف أداء الموظفين مرتبطة بأهداف الشركة؟',                          opts: ['نعم — بشكل واضح', 'جزئياً', 'لا'] },
    { type: 'radio', sectionId: 'hr_performance', id: 'feedback_culture',    label: 'هل يحصل الموظفون على تغذية راجعة منتظمة؟',                              opts: ['نعم — شهرياً', 'ربع سنوياً', 'سنوياً فقط', 'لا'] },
    { type: 'radio', sectionId: 'hr_performance', id: 'perf_reward_link',    label: 'هل التقييم مرتبط بالحوافز والترقيات؟',                                  opts: ['نعم — نظام واضح', 'أحياناً', 'لا'] },
    { type: 'radio', sectionId: 'hr_performance', id: 'training_plan',       label: '🎓 هل لديك خطة تدريب سنوية مبنية على احتياجات فعلية؟',                  opts: ['نعم — شاملة', 'خطة بسيطة', 'لا يوجد'] },
    { type: 'radio', sectionId: 'hr_performance', id: 'training_budget',     label: 'كم تستثمر في التدريب سنوياً؟',                                          opts: ['أكثر من 2% من الرواتب', '1-2%', 'أقل من 1%', 'لا ميزانية مخصصة'] },
    { type: 'radio', sectionId: 'hr_performance', id: 'training_impact',     label: 'هل تقيس أثر التدريب على أداء الموظفين؟',                                opts: ['نعم — ROI محسوب', 'تقييم رضا فقط', 'لا'] },
    { type: 'radio', sectionId: 'hr_performance', id: 'career_paths',        label: 'هل لديك مسارات وظيفية واضحة وترقيات داخلية؟',                           opts: ['نعم — موثقة', 'غير رسمية', 'لا'] },

    // ─── 5. إدارة المواهب والتعويضات ──────────────────────────────────
    { type: 'radio', sectionId: 'hr_talent', id: 'talent_identified',        label: '💎 هل حدّدت المواهب والكفاءات الرئيسية في شركتك؟',                       opts: ['نعم — قائمة محدّثة', 'نعرفهم لكن بدون توثيق', 'لا'] },
    { type: 'radio', sectionId: 'hr_talent', id: 'retention_strategy',       label: 'هل لديك استراتيجية واضحة لاستبقاء المواهب؟',                            opts: ['نعم — برامج تحفيز وتطوير', 'إجراءات عامة', 'لا'] },
    { type: 'radio', sectionId: 'hr_talent', id: 'skills_gap',               label: 'هل أجريت تحليل فجوات المهارات (Skills Gap)؟',                           opts: ['نعم — مؤخراً', 'قديم', 'لا'] },
    { type: 'radio', sectionId: 'hr_talent', id: 'mentoring',                label: 'هل لديك برنامج إرشاد وتوجيه (Mentoring/Coaching)؟',                     opts: ['نعم — رسمي', 'غير رسمي', 'لا'] },
    { type: 'radio', sectionId: 'hr_talent', id: 'job_desc_coverage',        label: '📋 ما نسبة تغطية التوصيفات الوظيفية؟',                                  opts: ['100%', '50-99%', 'أقل من 50%', 'لا يوجد'] },
    { type: 'radio', sectionId: 'hr_talent', id: 'job_desc_updated',         label: 'متى آخر مرة حُدّثت التوصيفات الوظيفية؟',                                opts: ['هذا العام', 'العام الماضي', 'أكثر من سنتين', 'لم تُحدّث أبداً'] },
    { type: 'radio', sectionId: 'hr_talent', id: 'salary_structure',         label: '💰 هل لديك هيكل رواتب واضح ومقارن بالسوق؟',                             opts: ['نعم موثق ومراجع', 'جزئي', 'لا'] },
    { type: 'radio', sectionId: 'hr_talent', id: 'incentive_system',         label: 'هل الحوافز والمكافآت مرتبطة بالأداء بمعايير واضحة؟',                    opts: ['نعم — نظام شفاف', 'أحياناً', 'لا — تقديرية'] },
    { type: 'radio', sectionId: 'hr_talent', id: 'medical_insurance',        label: 'ما مستوى التأمين الطبي ورضا الموظفين عنه؟',                             opts: ['شامل — رضا عالي', 'أساسي — مقبول', 'ضعيف أو غير موجود'] },

    // ─── 6. الثقافة والبيئة والأنظمة التقنية ──────────────────────────
    { type: 'radio',    sectionId: 'hr_culture', id: 'employee_handbook',    label: '📖 هل لديك دليل موظف (Employee Handbook) محدّث؟',                        opts: ['نعم — موزّع ومفهوم', 'موجود لكن غير محدّث', 'لا يوجد'] },
    { type: 'radio',    sectionId: 'hr_culture', id: 'internal_policy',      label: 'هل لائحة العمل الداخلية معتمدة رسمياً ومتوافقة مع النظام؟',              opts: ['نعم — معتمدة', 'قيد التحديث', 'لا'] },
    { type: 'checkbox', sectionId: 'hr_culture', id: 'hr_policies',          label: 'ما السياسات الخاصة المطبّقة لديك؟',                                     opts: ['سياسة نزاهة وهدايا', 'سياسة استخدام الإنترنت', 'سياسة السلامة المهنية', 'سياسة اللباس', 'سياسة المكافآت والعقوبات', 'لا سياسات مكتوبة'] },
    { type: 'radio',    sectionId: 'hr_culture', id: 'labor_disputes',       label: '⚖️ هل لديك نزاعات عمالية أو قضايا في مكتب العمل؟',                       opts: ['لا — سجل نظيف', 'حالات نادرة', 'نعم — قضايا قائمة'] },
    { type: 'radio',    sectionId: 'hr_culture', id: 'grievance_system',     label: 'هل لديك آلية واضحة لاستقبال الشكاوى ومعالجتها؟',                        opts: ['نعم — نظام رسمي', 'غير رسمي', 'لا'] },
    { type: 'radio',    sectionId: 'hr_culture', id: 'employee_satisfaction',label: 'هل تجري استبيانات رضا الموظفين بشكل دوري؟',                              opts: ['نعم — سنوياً أو أكثر', 'أحياناً', 'لا'] },
    { type: 'radio',    sectionId: 'hr_culture', id: 'work_environment',     label: 'كيف تقيّم بيئة العمل العامة؟',                                            opts: ['إيجابية ومحفزة', 'مقبولة', 'سلبية — تحتاج تحسين'] },
    { type: 'radio',    sectionId: 'hr_culture', id: 'values_clarity',       label: '🏛️ هل قيم الشركة واضحة ومُطبّقة في الممارسات اليومية؟',                 opts: ['نعم — مجسّدة في كل شيء', 'معلنة لكن غير مطبّقة', 'غير محددة'] },
    { type: 'radio',    sectionId: 'hr_culture', id: 'employee_loyalty',     label: 'كيف تقيّم مستوى انتماء وولاء الموظفين؟',                                 opts: ['عالي — فخورون بالشركة', 'متوسط', 'منخفض — دوران مرتفع'] },
    { type: 'radio',    sectionId: 'hr_culture', id: 'diversity_inclusion',  label: 'هل لديك سياسات تنوع وشمولية (Diversity & Inclusion)؟',                  opts: ['نعم — مطبّقة', 'في طور الإعداد', 'لا'] },
    { type: 'radio',    sectionId: 'hr_culture', id: 'safety_policy',        label: '🛡️ هل لديك سياسة سلامة مهنية وبرامج توعية؟',                             opts: ['نعم — شاملة مع تدريبات', 'سياسة أساسية', 'لا'] },
    { type: 'radio',    sectionId: 'hr_culture', id: 'incidents_record',     label: 'كم حادث عمل وقع في آخر سنة؟',                                            opts: ['صفر', '1-3 حوادث بسيطة', 'أكثر من 3 أو حوادث جسيمة'] },
    { type: 'checkbox', sectionId: 'hr_culture', id: 'hris_system',          label: '💻 ما الأنظمة التقنية المستخدمة في HR؟',                                 opts: ['نظام HRIS متكامل', 'نظام رواتب', 'نظام حضور إلكتروني', 'نظام تقييم أداء', 'منصة توظيف', 'Excel فقط', 'لا أنظمة'] },
    { type: 'radio',    sectionId: 'hr_culture', id: 'hr_automation',        label: 'ما مستوى الأتمتة في إجراءات HR؟',                                        opts: ['معظمها مؤتمتة', 'جزئية', 'يدوية بالكامل'] },
    { type: 'radio',    sectionId: 'hr_culture', id: 'hr_analytics',         label: 'هل تستخدم التحليلات والتقارير في اتخاذ قرارات HR؟',                     opts: ['نعم — تقارير دورية', 'أحياناً', 'لا'] },
    { type: 'radio',    sectionId: 'hr_culture', id: 'turnover_rate',        label: '📊 ما معدل الدوران الوظيفي السنوي؟',                                    opts: ['أقل من 10%', '10-20%', '20-30%', 'أكثر من 30%', 'لا أعرف'] },
    { type: 'checkbox', sectionId: 'hr_culture', id: 'hr_challenges',        label: 'ما أكبر التحديات التي تواجهها في HR حالياً؟',                            opts: ['إيجاد كفاءات', 'الاحتفاظ بالموظفين', 'تحفيز الفريق', 'التوطين/السعودة', 'التدريب والتأهيل', 'ضعف الإنتاجية', 'غياب الأنظمة'] },
    { type: 'textarea', sectionId: 'hr_culture', id: 'key_person',           label: 'من هو "الشخص المفتاحي" الذي إذا رحل سيؤثر بشكل كبير؟',                    placeholder: 'اكتب اسم الدور (مثال: مدير المبيعات، المبرمج الرئيسي...)' },
    { type: 'textarea', sectionId: 'hr_culture', id: 'hr_free',              label: 'ما أكبر خطأ في إدارة HR ترتكبه الآن؟',                                   placeholder: 'تصريح صادق يساعدك على التحسين...' },
  ],
}

// ─── FINANCE — المالية ────────────────────────────────────────────────────
// المصدر: dept-deep.js:242-463 (٦ أقسام، ٤٢ سؤالاً).

const FINANCE: DeptQuestions = {
  sections: [
    { id: 'fin_structure',  icon: '🏗️', title: 'الهيكل التنظيمي والسياسات المالية', priority: 'حرج', desc: 'بدون هيكل مالي واضح وسياسات معتمدة — القرارات المالية تصبح عشوائية والمخاطر تتضاعف' },
    { id: 'fin_statements', icon: '📑', title: 'القوائم المالية والمؤشرات',           priority: 'حرج', desc: 'القوائم المالية هي مرآة الشركة — 72% من القرارات الاستثمارية تعتمد على جودة التقارير المالية' },
    { id: 'fin_capital',    icon: '💰', title: 'رأس المال والتدفقات النقدية',          priority: 'حرج', desc: '82% من الشركات التي تفشل سببها مشاكل في التدفقات النقدية — حتى لو كانت تحقق أرباحاً' },
    { id: 'fin_budget',     icon: '📋', title: 'الميزانيات ومحاسبة التكاليف ورأس المال العامل', priority: 'مهم', desc: 'التخطيط المالي يحول الأرقام لقرارات — والشركات بدون ميزانية تنفق 23% أكثر من اللازم' },
    { id: 'fin_audit',      icon: '🔎', title: 'التدقيق والالتزامات الضريبية والذمم',  priority: 'حرج', desc: 'التدقيق يكشف المخاطر قبل فوات الأوان — والالتزام الضريبي يمنع غرامات تصل لـ 25% من الضريبة' },
    { id: 'fin_systems',    icon: '💻', title: 'الأنظمة التقنية والتقارير والإيرادات',  priority: 'مهم', desc: 'الشركات التي تستخدم أنظمة محاسبة متكاملة تغلق دفاترها 60% أسرع وتقلل الأخطاء 85%' },
  ],
  questions: [
    // ─── 1. الهيكل التنظيمي والسياسات المالية ──────────────────────────
    { type: 'radio', sectionId: 'fin_structure', id: 'fin_org_chart',      label: '📊 هل لديك هيكل تنظيمي واضح للإدارة المالية؟',                              opts: ['نعم — محدّث ومعتمد', 'موجود لكن قديم', 'لا يوجد'] },
    { type: 'radio', sectionId: 'fin_structure', id: 'accountant',         label: 'هل لديك محاسب متخصص؟',                                                       opts: ['داخلي — متفرغ', 'خارجي — مكتب محاسبة', 'لا'] },
    { type: 'radio', sectionId: 'fin_structure', id: 'fin_team_certs',     label: 'هل يحمل فريقك المالي شهادات مهنية (CPA, CMA, SOCPA)؟',                       opts: ['نعم — أغلبهم', 'بعضهم', 'لا'] },
    { type: 'radio', sectionId: 'fin_structure', id: 'fin_segregation',    label: 'هل المراجعة الداخلية مستقلة عن المحاسبة؟',                                   opts: ['نعم — منفصلة تماماً', 'جزئياً', 'لا — نفس الشخص'] },
    { type: 'radio', sectionId: 'fin_structure', id: 'fin_policies',       label: '📋 هل لديك دليل سياسات وإجراءات مالية معتمد؟',                              opts: ['نعم — محدّث ومعتمد', 'موجود لكن قديم', 'لا يوجد'] },
    { type: 'radio', sectionId: 'fin_structure', id: 'fin_authority',      label: 'هل حدود الصلاحيات المالية واضحة لكل مستوى إداري؟',                          opts: ['نعم — موثقة ومعتمدة', 'شفهية', 'لا'] },
    { type: 'radio', sectionId: 'fin_structure', id: 'petty_cash',         label: 'هل لديك سياسة واضحة للمصروفات النثرية والسلف؟',                             opts: ['نعم — مع ضوابط', 'جزئية', 'لا'] },

    // ─── 2. القوائم المالية والمؤشرات ──────────────────────────────────
    { type: 'checkbox', sectionId: 'fin_statements', id: 'fin_statements',    label: '📑 ما القوائم المالية التي تعدّها بانتظام؟',                              opts: ['ميزانية عمومية', 'قائمة دخل', 'تدفقات نقدية', 'تغيرات حقوق الملكية', 'إيضاحات متممة', 'لا أعدّ قوائم'] },
    { type: 'radio',    sectionId: 'fin_statements', id: 'report_frequency',  label: 'كم مرة تصدر تقارير مالية؟',                                                opts: ['شهرياً', 'ربع سنوياً', 'سنوياً فقط', 'عند الطلب'] },
    { type: 'radio',    sectionId: 'fin_statements', id: 'report_speed',      label: 'كم يستغرق إصدار التقرير المالي بعد نهاية الشهر؟',                          opts: ['أقل من 5 أيام', '5-15 يوم', '15-30 يوم', 'أكثر من شهر'] },
    { type: 'radio',    sectionId: 'fin_statements', id: 'profit_margin',     label: '💹 هل تعرف هامش ربحك الصافي بدقة؟',                                        opts: ['نعم بدقة', 'تقريباً', 'لا'] },
    { type: 'radio',    sectionId: 'fin_statements', id: 'liquidity_ratio',   label: 'كيف تقيّم سيولة شركتك (النسبة الجارية)؟',                                    opts: ['ممتازة (أكثر من 2)', 'جيدة (1-2)', 'ضعيفة (أقل من 1)', 'لا أعرف'] },
    { type: 'radio',    sectionId: 'fin_statements', id: 'roa_roe',           label: 'هل تحسب العائد على الأصول (ROA) والعائد على حقوق الملكية (ROE)؟',            opts: ['نعم — بانتظام', 'أحياناً', 'لا'] },
    { type: 'radio',    sectionId: 'fin_statements', id: 'breakeven',         label: 'هل تعرف نقطة التعادل لمنتجاتك/خدماتك؟',                                     opts: ['نعم — محسوبة', 'تقديرية', 'لا'] },

    // ─── 3. رأس المال والتدفقات النقدية ────────────────────────────────
    { type: 'checkbox', sectionId: 'fin_capital', id: 'capital_structure', label: '🏗️ ما هيكل رأس المال (مصادر التمويل)؟',                                     opts: ['رأس مال ملكية', 'قروض بنكية طويلة', 'تسهيلات قصيرة الأجل', 'تمويل جماعي', 'مستثمرين', 'ذاتي بالكامل'] },
    { type: 'radio',    sectionId: 'fin_capital', id: 'debt_status',       label: 'هل لديك ديون أو التزامات معلقة؟',                                            opts: ['لا', 'نعم — تحت السيطرة', 'نعم — تقلقني'] },
    { type: 'radio',    sectionId: 'fin_capital', id: 'wacc_known',        label: 'هل تعرف تكلفة رأس المال المرجحة (WACC)؟',                                    opts: ['نعم', 'تقريباً', 'لا'] },
    { type: 'radio',    sectionId: 'fin_capital', id: 'cashflow_status',   label: '💰 كيف تقيّم تدفقاتك النقدية التشغيلية؟',                                     opts: ['إيجابية ومستقرة', 'متذبذبة', 'سلبية'] },
    { type: 'radio',    sectionId: 'fin_capital', id: 'cashflow_forecast', label: 'هل تتنبأ بالتدفقات النقدية مسبقاً؟',                                          opts: ['نعم — أسبوعياً/شهرياً', 'أحياناً', 'لا'] },
    { type: 'radio',    sectionId: 'fin_capital', id: 'cash_reserve',      label: 'كم شهر يمكنك البقاء بدون إيرادات جديدة؟',                                    opts: ['أكثر من 6 أشهر', '3-6 أشهر', '1-3 أشهر', 'أقل من شهر'] },
    { type: 'radio',    sectionId: 'fin_capital', id: 'surplus_mgmt',      label: 'كيف تدير الفائض النقدي؟',                                                     opts: ['استثمارات قصيرة الأجل', 'ودائع بنكية', 'يبقى في الحساب', 'لا يوجد فائض'] },

    // ─── 4. الميزانيات ومحاسبة التكاليف ────────────────────────────────
    { type: 'radio', sectionId: 'fin_budget', id: 'collection_period',   label: '📊 ما متوسط فترة تحصيل الذمم المدينة؟',                                        opts: ['أقل من 30 يوم', '30-60 يوم', '60-90 يوم', 'أكثر من 90 يوم', 'لا أعرف'] },
    { type: 'radio', sectionId: 'fin_budget', id: 'payment_period',      label: 'ما متوسط فترة سداد الذمم الدائنة؟',                                            opts: ['أقل من 30 يوم', '30-60 يوم', '60-90 يوم', 'نتأخر أحياناً'] },
    { type: 'radio', sectionId: 'fin_budget', id: 'inventory_mgmt',      label: 'كيف تدير المخزون (إن وجد)؟',                                                    opts: ['نظام إلكتروني + جرد دوري', 'Excel', 'يدوي', 'لا يوجد مخزون'] },
    { type: 'radio', sectionId: 'fin_budget', id: 'budget_exists',       label: '📋 هل تعدّ ميزانية تشغيلية سنوية؟',                                            opts: ['نعم — شاملة', 'جزئية', 'لا'] },
    { type: 'radio', sectionId: 'fin_budget', id: 'budget_accuracy',     label: 'ما مدى دقة ميزانياتك (الفعلي مقابل المخطط)؟',                                  opts: ['انحراف أقل من 10%', 'انحراف 10-25%', 'انحراف أكثر من 25%', 'لا أقارن'] },
    { type: 'radio', sectionId: 'fin_budget', id: 'capex_budget',        label: 'هل لديك ميزانية رأسمالية (نفقات استثمارية)؟',                                  opts: ['نعم — مخططة', 'حسب الحاجة', 'لا'] },
    { type: 'radio', sectionId: 'fin_budget', id: 'budget_participation',label: 'هل تشارك الإدارات الأخرى في إعداد الميزانية؟',                                  opts: ['نعم — بشكل منهجي', 'أحياناً', 'لا — المالية فقط'] },
    { type: 'radio', sectionId: 'fin_budget', id: 'cost_system',         label: '🔍 هل لديك نظام محاسبة تكاليف؟',                                              opts: ['نعم — آلي ودقيق', 'يدوي/جزئي', 'لا'] },
    { type: 'radio', sectionId: 'fin_budget', id: 'cost_analysis',       label: 'هل تحلل التكاليف حسب المنتجات/الخدمات/المشاريع؟',                             opts: ['نعم — بشكل منتظم', 'أحياناً', 'لا'] },
    { type: 'radio', sectionId: 'fin_budget', id: 'cost_control',        label: 'هل لديك ضوابط رقابة على التكاليف (حدود إنفاق، موافقات)؟',                     opts: ['نعم — صارمة', 'جزئية', 'لا'] },

    // ─── 5. التدقيق والالتزامات الضريبية ──────────────────────────────
    { type: 'radio', sectionId: 'fin_audit', id: 'receivables_aging', label: '📊 هل تعدّ تحليل أعمار الذمم المدينة؟',                                            opts: ['نعم — شهرياً', 'أحياناً', 'لا'] },
    { type: 'radio', sectionId: 'fin_audit', id: 'bad_debts',         label: 'ما نسبة الديون المشكوك في تحصيلها؟',                                              opts: ['أقل من 5%', '5-15%', 'أكثر من 15%', 'لا أعرف'] },
    { type: 'radio', sectionId: 'fin_audit', id: 'provisions',        label: 'هل لديك مخصصات كافية (ديون معدومة، التزامات طارئة)؟',                             opts: ['نعم — كافية', 'جزئية', 'لا'] },
    { type: 'radio', sectionId: 'fin_audit', id: 'internal_audit',    label: '🔎 هل لديك إدارة تدقيق داخلي مستقلة؟',                                            opts: ['نعم — مع خطة سنوية', 'تدقيق جزئي', 'لا'] },
    { type: 'radio', sectionId: 'fin_audit', id: 'external_audit',    label: 'متى آخر مراجعة خارجية (مدقق حسابات)؟',                                            opts: ['هذا العام', 'العام الماضي', 'أكثر من سنتين', 'لم تتم أبداً'] },
    { type: 'radio', sectionId: 'fin_audit', id: 'dual_signature',    label: 'هل تطبق التوقيع المزدوج والفصل بين الوظائف؟',                                     opts: ['نعم — دائماً', 'أحياناً', 'لا'] },
    { type: 'radio', sectionId: 'fin_audit', id: 'tax_compliance',    label: '🏛️ هل إقراراتك الضريبية/الزكوية محدّثة ومرفوعة في موعدها؟',                       opts: ['نعم — دائماً', 'تأخير أحياناً', 'متأخرة أو لم تُرفع'] },
    { type: 'radio', sectionId: 'fin_audit', id: 'vat_management',    label: 'كيف تدير ضريبة القيمة المضافة (VAT)؟',                                             opts: ['نظام آلي + إقرارات منتظمة', 'يدوي لكن منتظم', 'غير منتظم', 'غير مسجل'] },
    { type: 'radio', sectionId: 'fin_audit', id: 'tax_audit',         label: 'هل سبق أن خضعت لفحص ضريبي من ZATCA؟',                                             opts: ['نعم — بلا مطلوبات', 'نعم — مع مطلوبات', 'لا'] },

    // ─── 6. الأنظمة التقنية والتقارير والإيرادات ──────────────────────
    { type: 'radio',    sectionId: 'fin_systems', id: 'accounting_system',       label: '💻 ما النظام المحاسبي المستخدم؟',                                       opts: ['ERP متكامل (SAP/Oracle)', 'برنامج محاسبة متخصص', 'Excel', 'يدوي'] },
    { type: 'radio',    sectionId: 'fin_systems', id: 'fin_system_integration', label: 'هل النظام المالي متكامل مع أنظمة المبيعات والمشتريات والمخازن؟',        opts: ['نعم — تكامل كامل', 'جزئي', 'لا — منفصلة'] },
    { type: 'radio',    sectionId: 'fin_systems', id: 'fin_backup',             label: 'هل لديك نسخ احتياطي وأمان للبيانات المالية؟',                            opts: ['نعم — تلقائي يومي', 'يدوي دوري', 'لا'] },
    { type: 'radio',    sectionId: 'fin_systems', id: 'exec_reports',           label: '📈 هل تقدم تقارير مالية منتظمة لمجلس الإدارة/المالك؟',                  opts: ['نعم — شهرياً مع تحليل', 'ربع سنوياً', 'عند الطلب', 'لا'] },
    { type: 'radio',    sectionId: 'fin_systems', id: 'fin_dashboards',         label: 'هل لديك لوحة مؤشرات مالية (Dashboard)؟',                                opts: ['نعم — حية وتفاعلية', 'تقارير ثابتة', 'لا'] },
    { type: 'radio',    sectionId: 'fin_systems', id: 'fin_decision_support',   label: 'هل تُستخدم البيانات المالية فعلاً في اتخاذ القرارات؟',                   opts: ['نعم — أساس كل قرار', 'أحياناً', 'نادراً'] },
    { type: 'radio',    sectionId: 'fin_systems', id: 'revenue_pattern',        label: '💵 هل إيراداتك منتظمة أم موسمية؟',                                       opts: ['منتظمة ومتنامية', 'منتظمة', 'موسمية', 'غير منتظمة'] },
    { type: 'radio',    sectionId: 'fin_systems', id: 'client_concentration',   label: 'ما نسبة إيرادك من أكبر عميل؟',                                            opts: ['أقل 20%', '20-50%', 'أكثر 50% (خطر)'] },
    { type: 'radio',    sectionId: 'fin_systems', id: 'revenue_streams',        label: 'كم عدد مصادر الإيراد المختلفة؟',                                          opts: ['4+ مصادر (متنوع)', '2-3 مصادر', 'مصدر واحد'] },
    { type: 'checkbox', sectionId: 'fin_systems', id: 'fin_kpis_tracked',       label: '📊 ما المؤشرات المالية التي تتابعها؟',                                    opts: ['هامش الربح', 'السيولة', 'ROA/ROE', 'التدفق النقدي الحر', 'فترة التحصيل', 'دوران المخزون', 'نسبة المديونية', 'لا أتابع مؤشرات'] },
    { type: 'radio',    sectionId: 'fin_systems', id: 'book_close_speed',       label: 'كم يستغرق إغلاق الدفاتر الشهرية؟',                                        opts: ['أقل من 3 أيام', '3-7 أيام', '7-15 يوم', 'أكثر من 15 يوم'] },
    { type: 'textarea', sectionId: 'fin_systems', id: 'finance_free',           label: 'ما أكبر تحدٍ مالي تواجهه الآن؟',                                          placeholder: 'مثال: ضعف السيولة، هوامش منخفضة، ديون متراكمة...' },
  ],
}

// ─── SALES — المبيعات ────────────────────────────────────────────────────
// المصدر: dept-deep.js:464-669 (٦ أقسام، ٤٩ سؤالاً).

const SALES: DeptQuestions = {
  sections: [
    { id: 'sales_structure',   icon: '📊', title: 'الهيكل التنظيمي واستراتيجية المبيعات', priority: 'حرج', desc: 'استراتيجية المبيعات هي محرك الإيرادات — بدونها الجهود تتبعثر والنتائج عشوائية' },
    { id: 'sales_kpis',        icon: '📈', title: 'المؤشرات والمستهدفات وقنوات البيع',    priority: 'حرج', desc: 'ما لا تقيسه لا تحسّنه — 67% من فرق المبيعات الناجحة تراجع مؤشراتها أسبوعياً' },
    { id: 'sales_customers',   icon: '💼', title: 'إدارة العملاء ودورة البيع',            priority: 'حرج', desc: 'اكتساب عميل جديد يكلّف 5x أكثر من الاحتفاظ بعميل حالي — CRM يرفع المبيعات 29%' },
    { id: 'sales_team',        icon: '👥', title: 'إدارة الفريق والمخاطر والتنبؤ',        priority: 'مهم', desc: 'فريق مدرّب يبيع 50% أكثر — ومخاطر التركز على عملاء قليلين تهدد استمرارية الإيرادات' },
    { id: 'sales_tools',       icon: '💲', title: 'السياسات والأدوات والتكاليف',           priority: 'مهم', desc: 'التسعير الذكي يرفع هوامش الربح 11% — والأتمتة توفر 5+ ساعات أسبوعياً لكل مندوب' },
    { id: 'sales_knowledge',   icon: '🔗', title: 'إدارة المعرفة والتكامل بين الإدارات',   priority: 'عادي', desc: 'فريق المبيعات الذي يوثق دروسه يحسّن أداءه 35% — والتكامل مع التسويق يضاعف النتائج' },
  ],
  questions: [
    // ─── 1. الهيكل والاستراتيجية ────────────────────────────────────────
    { type: 'radio', sectionId: 'sales_structure', id: 'sales_org',           label: '📊 هل لديك هيكل تنظيمي واضح لإدارة المبيعات؟',                       opts: ['نعم — محدّث ومعتمد', 'موجود لكن قديم', 'لا يوجد'] },
    { type: 'radio', sectionId: 'sales_structure', id: 'sales_team_size',     label: 'كم عدد فريق المبيعات؟',                                                 opts: ['10+', '5-10', '2-4', 'شخص واحد (المالك)'] },
    { type: 'radio', sectionId: 'sales_structure', id: 'sales_roles',         label: 'هل الأدوار واضحة (مدير مبيعات، مندوبين، دعم)؟',                        opts: ['نعم — مفصلة ومعتمدة', 'جزئية', 'لا — الكل يبيع بدون تخصص'] },
    { type: 'radio', sectionId: 'sales_structure', id: 'sales_strategy',      label: '🎯 هل لديك استراتيجية مبيعات واضحة ومكتوبة؟',                          opts: ['نعم — مكتوبة ومعتمدة', 'شفهية/عامة', 'لا'] },
    { type: 'radio', sectionId: 'sales_structure', id: 'value_proposition',   label: 'هل لديك عرض قيمة واضح (Value Proposition) لكل منتج/خدمة؟',            opts: ['نعم — مُوثق وموحد', 'شفهي', 'لا'] },
    { type: 'radio', sectionId: 'sales_structure', id: 'target_segments',     label: 'هل حددت شرائح العملاء المستهدفة بوضوح؟',                              opts: ['نعم — مع ملفات تعريفية', 'تقريباً', 'لا — نبيع للكل'] },

    // ─── 2. المؤشرات والمستهدفات والقنوات ────────────────────────────
    { type: 'checkbox', sectionId: 'sales_kpis', id: 'sales_kpis_list',    label: '📈 ما مؤشرات المبيعات التي تتابعها؟',                                    opts: ['إيراد شهري', 'معدل تحويل', 'متوسط قيمة الصفقة', 'دورة البيع', 'تكلفة اكتساب العميل', 'CLV', 'لا أتابع مؤشرات'] },
    { type: 'radio',    sectionId: 'sales_kpis', id: 'sales_reporting',    label: 'كم مرة تراجع أداء المبيعات؟',                                             opts: ['يومياً', 'أسبوعياً', 'شهرياً', 'نادراً'] },
    { type: 'radio',    sectionId: 'sales_kpis', id: 'sales_targets',      label: '🎯 هل لديك مستهدفات مبيعات واضحة؟',                                      opts: ['نعم — لكل مندوب/فريق/شهر', 'عامة للإدارة', 'لا'] },
    { type: 'radio',    sectionId: 'sales_kpis', id: 'target_achievement', label: 'ما نسبة تحقيق المستهدفات عادةً؟',                                          opts: ['أكثر من 90%', '70-90%', '50-70%', 'أقل من 50%', 'لا توجد مستهدفات'] },
    { type: 'checkbox', sectionId: 'sales_kpis', id: 'acquisition_channels',label: '📡 كيف يصلك العملاء الآن؟',                                              opts: ['إحالة شخصية', 'سوشيال ميديا', 'موقع إلكتروني', 'معارض', 'مناقصات', 'زبائن متكررون', 'شراكات/وكلاء'] },
    { type: 'radio',    sectionId: 'sales_kpis', id: 'channel_diversity',  label: 'كم قناة بيع فعالة لديك؟',                                                  opts: ['4+ قنوات (متنوع)', '2-3 قنوات', 'قناة واحدة'] },
    { type: 'radio',    sectionId: 'sales_kpis', id: 'territory_mgmt',     label: 'هل لديك توزيع مناطق بيع على المندوبين؟',                                  opts: ['نعم — مع أهداف لكل منطقة', 'توزيع عام', 'لا — عشوائي'] },

    // ─── 3. إدارة العملاء ودورة البيع ──────────────────────────────
    { type: 'radio', sectionId: 'sales_customers', id: 'crm',                     label: '💼 هل لديك CRM أو نظام متابعة عملاء؟',                            opts: ['نعم متكامل', 'Excel / جزئي', 'لا'] },
    { type: 'radio', sectionId: 'sales_customers', id: 'repeat_clients',          label: 'ما نسبة العملاء المتكررين؟',                                        opts: ['أكثر من 60%', '30-60%', 'أقل من 30%'] },
    { type: 'radio', sectionId: 'sales_customers', id: 'customer_segmentation',   label: 'هل تصنف عملاءك (VIP, A, B, C)؟',                                    opts: ['نعم — مع معايير واضحة', 'تقريباً', 'لا'] },
    { type: 'radio', sectionId: 'sales_customers', id: 'client_satisfaction',     label: 'هل تقيس رضا العملاء بانتظام؟',                                       opts: ['نعم — استبيان دوري + NPS', 'أحياناً', 'لا'] },
    { type: 'radio', sectionId: 'sales_customers', id: 'sales_cycle',             label: '🔄 ما دورة البيع المعتادة؟',                                        opts: ['أيام', 'أسابيع', '1-3 أشهر', 'أكثر من 3 أشهر'] },
    { type: 'radio', sectionId: 'sales_customers', id: 'sales_process',           label: 'هل لديك عملية بيع موحدة وموثقة (Sales Playbook)؟',                  opts: ['نعم — خطوات واضحة ومُتبعة', 'غير رسمي', 'لا'] },
    { type: 'radio', sectionId: 'sales_customers', id: 'deal_value',              label: 'ما متوسط قيمة الصفقة الواحدة؟',                                     opts: ['أقل من 10,000 ﷼', '10,000 – 50,000 ﷼', '50,000 – 200,000 ﷼', 'أكثر من 200,000 ﷼'] },
    { type: 'radio', sectionId: 'sales_customers', id: 'pipeline_mgmt',           label: 'هل تدير Pipeline المبيعات بمراحل واضحة؟',                            opts: ['نعم — مع CRM', 'يدوياً', 'لا'] },

    // ─── 4. إدارة الفريق والمخاطر والتنبؤ ──────────────────────────
    { type: 'radio', sectionId: 'sales_team', id: 'sales_training',              label: '🎓 هل تدرب فريق المبيعات بانتظام؟',                                 opts: ['نعم — برنامج تدريب دوري', 'أحياناً', 'لا'] },
    { type: 'radio', sectionId: 'sales_team', id: 'sales_compensation',          label: 'هل لديك نظام عمولات وحوافز واضح؟',                                    opts: ['نعم — مربوط بالأداء', 'عمولات بسيطة', 'راتب ثابت فقط'] },
    { type: 'radio', sectionId: 'sales_team', id: 'sales_turnover',              label: 'ما معدل دوران فريق المبيعات؟',                                        opts: ['منخفض (أقل من 15%)', 'متوسط (15-30%)', 'مرتفع (أكثر من 30%)'] },
    { type: 'radio', sectionId: 'sales_team', id: 'client_concentration_sales',  label: '⚠️ ما نسبة إيراداتك من أكبر 3 عملاء؟',                                opts: ['أقل من 30% (صحي)', '30-50%', '50-70%', 'أكثر من 70% (خطر)'] },
    { type: 'radio', sectionId: 'sales_team', id: 'demand_volatility',           label: 'كيف تتعامل مع تقلبات الطلب الموسمية؟',                                opts: ['خطة موسمية مع تنويع', 'نتأقلم', 'لا خطة'] },
    { type: 'radio', sectionId: 'sales_team', id: 'credit_risk',                 label: 'هل لديك سياسة ائتمانية واضحة للعملاء؟',                              opts: ['نعم — مع حدود ائتمان وتحصيل', 'جزئية', 'لا — نبيع بالآجل بدون ضوابط'] },
    { type: 'radio', sectionId: 'sales_team', id: 'sales_forecast',              label: '🔮 هل تتنبأ بالمبيعات المستقبلية؟',                                  opts: ['نعم — نموذج كمي + Pipeline', 'تقديرات تقريبية', 'لا'] },
    { type: 'radio', sectionId: 'sales_team', id: 'forecast_accuracy',           label: 'ما دقة التنبؤ مقارنة بالفعلي؟',                                       opts: ['انحراف أقل من 15%', 'انحراف 15-30%', 'أكثر من 30%', 'لا أقارن'] },

    // ─── 5. السياسات والأدوات والتكاليف ───────────────────────────
    { type: 'radio',    sectionId: 'sales_tools', id: 'pricing_strategy',    label: '💲 كيف تحدد أسعارك؟',                                                  opts: ['استراتيجية تسعير مدروسة', 'بناءً على المنافسين', 'تكلفة + هامش', 'عشوائي'] },
    { type: 'radio',    sectionId: 'sales_tools', id: 'discount_policy',     label: 'هل لديك سياسة خصومات واضحة؟',                                            opts: ['نعم — مع حدود وصلاحيات', 'مرنة جداً', 'لا سياسة'] },
    { type: 'checkbox', sectionId: 'sales_tools', id: 'sales_tools_list',    label: '💻 ما أدوات المبيعات المستخدمة؟',                                       opts: ['CRM متقدم', 'أتمتة مبيعات', 'عروض أسعار إلكترونية', 'توقيع رقمي', 'تحليلات AI', 'Excel فقط', 'لا أدوات'] },
    { type: 'radio',    sectionId: 'sales_tools', id: 'sales_automation',    label: 'ما مستوى أتمتة عمليات البيع؟',                                          opts: ['عالي — Pipeline آلي + إشعارات', 'متوسط', 'يدوي بالكامل'] },
    { type: 'radio',    sectionId: 'sales_tools', id: 'competitor_analysis', label: '🔍 هل تحلل المنافسين بانتظام؟',                                          opts: ['نعم — ملفات محدّثة لكل منافس', 'أحياناً', 'لا'] },
    { type: 'radio',    sectionId: 'sales_tools', id: 'market_share',        label: 'هل تعرف حصتك السوقية؟',                                                   opts: ['نعم — بدقة', 'تقديرية', 'لا'] },
    { type: 'radio',    sectionId: 'sales_tools', id: 'win_loss_analysis',   label: 'هل تحلل أسباب كسب وخسارة الصفقات؟',                                     opts: ['نعم — بشكل منهجي', 'أحياناً', 'لا'] },
    { type: 'radio',    sectionId: 'sales_tools', id: 'cac_known',           label: '💰 هل تعرف تكلفة اكتساب العميل (CAC)؟',                                 opts: ['نعم — محسوبة', 'تقديرية', 'لا'] },
    { type: 'radio',    sectionId: 'sales_tools', id: 'clv_known',           label: 'هل تحسب القيمة الدائمة للعميل (CLV/LTV)؟',                              opts: ['نعم', 'تقريباً', 'لا'] },
    { type: 'radio',    sectionId: 'sales_tools', id: 'sales_profitability', label: 'هل تعرف ربحية كل منتج/خدمة/عميل؟',                                       opts: ['نعم — بالتفصيل', 'إجمالي فقط', 'لا'] },
    { type: 'radio',    sectionId: 'sales_tools', id: 'conversion_rate',     label: '📊 ما معدل التحويل من عميل محتمل لصفقة؟',                              opts: ['أعلى من 25%', '15-25%', '5-15%', 'أقل من 5%', 'لا أعرف'] },
    { type: 'radio',    sectionId: 'sales_tools', id: 'upsell_crosssell',    label: 'هل تطبق البيع الإضافي والمتقاطع (Upsell/Cross-sell)؟',                  opts: ['نعم — استراتيجية واضحة', 'أحياناً', 'لا'] },

    // ─── 6. المعرفة والتكامل ───────────────────────────────────────
    { type: 'radio',    sectionId: 'sales_knowledge', id: 'knowledge_base',              label: '📚 هل لديك قاعدة معارف مبيعات (Playbook, اعتراضات, قصص نجاح)؟',       opts: ['نعم — موثقة ومحدّثة', 'جزئية', 'لا'] },
    { type: 'radio',    sectionId: 'sales_knowledge', id: 'sales_mentoring',             label: 'هل يوجد نظام mentoring للمندوبين الجدد؟',                              opts: ['نعم — برنامج رسمي', 'غير رسمي', 'لا'] },
    { type: 'radio',    sectionId: 'sales_knowledge', id: 'lessons_learned',             label: 'هل توثق الدروس المستفادة من الصفقات الفاشلة والناجحة؟',                opts: ['نعم — بانتظام', 'أحياناً', 'لا'] },
    { type: 'radio',    sectionId: 'sales_knowledge', id: 'sales_marketing_alignment',   label: '🔗 كيف تقيّم التكامل بين المبيعات والتسويق؟',                          opts: ['ممتاز — أهداف مشتركة واجتماعات دورية', 'متوسط', 'ضعيف — كل إدارة تعمل منفردة'] },
    { type: 'radio',    sectionId: 'sales_knowledge', id: 'sales_finance_coord',         label: 'هل تتنسق المبيعات مع المالية (ائتمان، تحصيل، ميزانيات)؟',              opts: ['نعم — تنسيق مستمر', 'عند الحاجة', 'لا'] },
    { type: 'radio',    sectionId: 'sales_knowledge', id: 'sales_ops_coord',             label: 'هل يتنسق فريق المبيعات مع العمليات/الإنتاج (توفر مخزون، مواعيد تسليم)؟', opts: ['نعم — تكامل كامل', 'جزئي', 'لا'] },
    { type: 'textarea', sectionId: 'sales_knowledge', id: 'sales_free',                  label: 'ما أكبر سبب لخسارة صفقة؟',                                            placeholder: 'مثال: السعر، تأخر في الرد، ضعف العرض، منافس أقوى...' },
  ],
}

// ─── MARKETING — التسويق ─────────────────────────────────────────────────
// المصدر: dept-deep.js:916-975 (٤ أقسام، ١٣ سؤالاً).

const MARKETING: DeptQuestions = {
  sections: [
    { id: 'mkt_strategy',    icon: '🎯', title: 'الاستراتيجية والهوية المؤسسية', priority: 'حرج', desc: 'الهوية الواضحة تقلل تكلفة الاستحواذ وتزيد ولاء العملاء' },
    { id: 'mkt_digital',     icon: '📱', title: 'التسويق الرقمي والمحتوى',        priority: 'مهم', desc: 'المحتوى المستمر يبني الثقة ويقلل الاعتماد على الإعلانات المدفوعة' },
    { id: 'mkt_performance', icon: '📊', title: 'الميزانية والأداء',                priority: 'حرج', desc: 'التسويق بدون قياس العائد هو هدر مالي' },
    { id: 'mkt_freetext',    icon: '✍️', title: 'التحقق والإغلاق',                 priority: 'عادي', desc: 'سؤال مفتوح لتسجيل أي تحديات تسويقية أخرى' },
  ],
  questions: [
    { type: 'radio', sectionId: 'mkt_strategy', id: 'mkt_strategy',      label: 'هل لديك استراتيجية تسويق مكتوبة ومحددة الأهداف؟',                        opts: ['نعم — سنوية ومفصلة', 'عامة / غير مكتوبة', 'لا'] },
    { type: 'radio', sectionId: 'mkt_strategy', id: 'brand_guidelines',  label: 'هل لديك دليل هوية بصرية ولفظية (Brand Guidelines)؟',                    opts: ['نعم — مطبق بصرامة', 'موجود لكن لا نلتزم به دائماً', 'لا'] },
    { type: 'radio', sectionId: 'mkt_strategy', id: 'target_persona',    label: 'هل شخصية العميل (Buyer Persona) محددة بدقة؟',                            opts: ['نعم — مبنية على بيانات', 'تخمينية', 'نستهدف الجميع'] },
    { type: 'radio', sectionId: 'mkt_strategy', id: 'mkt_positioning',   label: 'هل ميزتك التنافسية (Positioning) واضحة للعملاء؟',                        opts: ['نعم — ورسائلنا تعكسها', 'نحاول توضيحها', 'غير واضحة'] },

    { type: 'radio', sectionId: 'mkt_digital', id: 'content_calendar',   label: 'هل تعتمد على خطة نشر مجدولة (Content Calendar)؟',                        opts: ['نعم — مسبقة ومجدولة', 'ننشر بشكل عشوائي', 'لا ننشر محتوى'] },
    { type: 'radio', sectionId: 'mkt_digital', id: 'seo_status',         label: 'ما مدى اهتمامك بتهيئة محركات البحث (SEO)؟',                              opts: ['أساسي في استراتيجيتنا', 'اهتمام جزئي', 'لا نهتم به'] },
    { type: 'radio', sectionId: 'mkt_digital', id: 'social_engagement',  label: 'كيف تقيّم تفاعل الجمهور مع قنواتك؟',                                    opts: ['عالي جداً', 'متوسط', 'ضعيف'] },
    { type: 'radio', sectionId: 'mkt_digital', id: 'email_marketing',    label: 'هل تستخدم التسويق عبر البريد الإلكتروني أو الرسائل المباشرة؟',            opts: ['نعم — حملات دورية ومؤتمتة', 'أحياناً', 'لا'] },

    { type: 'radio', sectionId: 'mkt_performance', id: 'mkt_budget',       label: 'كيف تحدد ميزانية التسويق؟',                                              opts: ['نسبة ثابتة من الإيرادات المتوقعة', 'حسب توفر الكاش', 'لا توجد ميزانية محددة'] },
    { type: 'radio', sectionId: 'mkt_performance', id: 'mkt_roi',          label: 'هل تقيس عائد الاستثمار التسويقي (ROI) لكل حملة؟',                        opts: ['نعم — بدقة', 'تقريبياً', 'لا'] },
    { type: 'radio', sectionId: 'mkt_performance', id: 'cac_tracking',     label: 'هل تعرف تكلفة اكتساب العميل (CAC) من كل قناة؟',                          opts: ['نعم', 'نعرف التكلفة الإجمالية فقط', 'لا'] },
    { type: 'radio', sectionId: 'mkt_performance', id: 'mkt_analytics',    label: 'ما الأدوات المستخدمة لتحليل البيانات التسويقية؟',                        opts: ['أدوات متقدمة وDashboards', 'تقارير المنصات الأساسية', 'لا نستخدم أدوات تحليل'] },

    { type: 'textarea', sectionId: 'mkt_freetext', id: 'marketing_free',    label: 'ما التحدي الأكبر الذي يعيق نمو التسويق؟',                                placeholder: 'مثال: ضعف الميزانية، المنافسة الشرسة، غياب فريق متخصص...' },
  ],
}

// ─── الخريطة الكاملة ─────────────────────────────────────────────────────
// كل إدارة تُلحق بها في commit مستقل. المستهلكون يجب أن يتعاملوا مع
// الإدارات غير المُنقولة بعد بتحقّق حرصي.
export const DEPT_QUESTIONS: Partial<Record<DeptCode, DeptQuestions>> = {
  HR,
  FINANCE,
  SALES,
  MARKETING,
}
