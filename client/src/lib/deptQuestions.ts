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
    { id: 'mkt_leadgen',     icon: '🧲', title: 'توليد العملاء والتحويل',          priority: 'حرج', desc: 'التسويق بلا قمع تحويل واضح ينفق دون أن يبيع' },
    { id: 'mkt_performance', icon: '📊', title: 'الميزانية والأداء',                priority: 'حرج', desc: 'التسويق بدون قياس العائد هو هدر مالي' },
    { id: 'mkt_team',        icon: '🧑‍💻', title: 'الفريق والأدوات',                 priority: 'مهم', desc: 'التخصص والأدوات المناسبة تضاعف إنتاجية التسويق' },
    { id: 'mkt_freetext',    icon: '✍️', title: 'التحقق والإغلاق',                 priority: 'عادي', desc: 'سؤال مفتوح لتسجيل أي تحديات تسويقية أخرى' },
  ],
  questions: [
    { type: 'radio', sectionId: 'mkt_strategy', id: 'mkt_strategy',       label: 'هل لديك استراتيجية تسويق مكتوبة ومحددة الأهداف؟',                        opts: ['نعم — سنوية ومفصلة', 'عامة / غير مكتوبة', 'لا'] },
    { type: 'radio', sectionId: 'mkt_strategy', id: 'brand_guidelines',   label: 'هل لديك دليل هوية بصرية ولفظية (Brand Guidelines)؟',                    opts: ['نعم — مطبق بصرامة', 'موجود لكن لا نلتزم به دائماً', 'لا'] },
    { type: 'radio', sectionId: 'mkt_strategy', id: 'target_persona',     label: 'هل شخصية العميل (Buyer Persona) محددة بدقة؟',                            opts: ['نعم — مبنية على بيانات', 'تخمينية', 'نستهدف الجميع'] },
    { type: 'radio', sectionId: 'mkt_strategy', id: 'mkt_positioning',    label: 'هل ميزتك التنافسية (Positioning) واضحة للعملاء؟',                        opts: ['نعم — ورسائلنا تعكسها', 'نحاول توضيحها', 'غير واضحة'] },
    { type: 'radio', sectionId: 'mkt_strategy', id: 'mkt_value_prop',     label: 'هل رسالة القيمة (Value Proposition) مختبَرة مع عملاء حقيقيين؟',          opts: ['نعم — واختبرناها', 'صيغناها بلا اختبار', 'لا توجد رسالة واضحة'] },
    { type: 'radio', sectionId: 'mkt_strategy', id: 'mkt_competitor',     label: 'هل تحلّل رسائل وأسعار منافسيك دورياً؟',                                  opts: ['نعم — متابعة منتظمة', 'أحياناً', 'لا'] },

    { type: 'radio',    sectionId: 'mkt_digital', id: 'content_calendar', label: 'هل تعتمد على خطة نشر مجدولة (Content Calendar)؟',                        opts: ['نعم — مسبقة ومجدولة', 'ننشر بشكل عشوائي', 'لا ننشر محتوى'] },
    { type: 'radio',    sectionId: 'mkt_digital', id: 'seo_status',       label: 'ما مدى اهتمامك بتهيئة محركات البحث (SEO)؟',                              opts: ['أساسي في استراتيجيتنا', 'اهتمام جزئي', 'لا نهتم به'] },
    { type: 'radio',    sectionId: 'mkt_digital', id: 'social_engagement',label: 'كيف تقيّم تفاعل الجمهور مع قنواتك؟',                                    opts: ['عالي جداً', 'متوسط', 'ضعيف'] },
    { type: 'checkbox', sectionId: 'mkt_digital', id: 'mkt_channels',     label: 'ما القنوات التسويقية النشطة لديك حالياً؟',                                opts: ['Google Ads', 'Meta (Instagram/Facebook)', 'TikTok', 'LinkedIn', 'X (تويتر)', 'يوتيوب', 'SEO / محتوى', 'البريد الإلكتروني', 'WhatsApp / رسائل', 'سناب شات'] },
    { type: 'checkbox', sectionId: 'mkt_digital', id: 'mkt_content_types',label: 'ما أنواع المحتوى الذي تنتجه؟',                                            opts: ['مقالات مدوّنة', 'فيديو قصير (Reels)', 'انفوجرافيك', 'دراسات حالة', 'بودكاست', 'ندوات (Webinars)', 'محتوى من صنع المستخدم (UGC)'] },

    { type: 'radio', sectionId: 'mkt_leadgen', id: 'mkt_lead_source',     label: 'من أين يأتي أغلب عملائك المحتملين؟',                                    opts: ['قنوات رقمية مقيسة', 'إحالات وعلاقات شخصية', 'لا نعرف بدقة'] },
    { type: 'radio', sectionId: 'mkt_leadgen', id: 'mkt_funnel',         label: 'هل لديك قمع تسويقي (Funnel) بمراحل محددة؟',                              opts: ['نعم — مراحل ومعدلات واضحة', 'مفهوم عام بلا قياس', 'لا يوجد'] },
    { type: 'radio', sectionId: 'mkt_leadgen', id: 'mkt_landing',        label: 'هل تستخدم صفحات هبوط (Landing Pages) مخصّصة للحملات؟',                    opts: ['نعم — ونختبرها (A/B)', 'صفحات عامة', 'نوجّه للموقع الرئيسي فقط'] },
    { type: 'radio', sectionId: 'mkt_leadgen', id: 'mkt_conversion',     label: 'هل تعرف معدل التحويل من زائر إلى عميل محتمل؟',                            opts: ['نعم — بدقة لكل قناة', 'رقم إجمالي تقريبي', 'لا نقيسه'] },
    { type: 'radio', sectionId: 'mkt_leadgen', id: 'mkt_nurturing',      label: 'هل ترعى العملاء المحتملين (Lead Nurturing) قبل تسليمهم للمبيعات؟',        opts: ['نعم — تسلسل مؤتمت', 'متابعة يدوية أحياناً', 'لا'] },

    { type: 'radio', sectionId: 'mkt_performance', id: 'mkt_budget',     label: 'كيف تحدد ميزانية التسويق؟',                                              opts: ['نسبة ثابتة من الإيرادات المتوقعة', 'حسب توفر الكاش', 'لا توجد ميزانية محددة'] },
    { type: 'radio', sectionId: 'mkt_performance', id: 'mkt_roi',        label: 'هل تقيس عائد الاستثمار التسويقي (ROI) لكل حملة؟',                        opts: ['نعم — بدقة', 'تقريبياً', 'لا'] },
    { type: 'radio', sectionId: 'mkt_performance', id: 'cac_tracking',   label: 'هل تعرف تكلفة اكتساب العميل (CAC) من كل قناة؟',                          opts: ['نعم', 'نعرف التكلفة الإجمالية فقط', 'لا'] },
    { type: 'radio', sectionId: 'mkt_performance', id: 'mkt_ltv_cac',    label: 'هل تقارن قيمة العميل (LTV) بتكلفة اكتسابه (CAC)؟',                        opts: ['نعم — ونستهدف LTV/CAC ≥ ٣', 'نعرف أحدهما فقط', 'لا'] },
    { type: 'radio', sectionId: 'mkt_performance', id: 'mkt_analytics',  label: 'ما الأدوات المستخدمة لتحليل البيانات التسويقية؟',                        opts: ['أدوات متقدمة وDashboards', 'تقارير المنصات الأساسية', 'لا نستخدم أدوات تحليل'] },

    { type: 'radio',    sectionId: 'mkt_team', id: 'mkt_team_structure', label: 'كيف يُدار التسويق لديك؟',                                                opts: ['فريق داخلي متخصص', 'وكالة خارجية', 'شخص واحد متعدد المهام', 'المالك بنفسه'] },
    { type: 'checkbox', sectionId: 'mkt_team', id: 'mkt_martech',        label: 'ما أدوات التسويق (MarTech) المستخدمة؟',                                  opts: ['CRM', 'أتمتة تسويق', 'تحليلات (GA/GTM)', 'أدوات تصميم', 'جدولة سوشال', 'أدوات SEO', 'بريد جماعي', 'لا نستخدم أدوات'] },
    { type: 'radio',    sectionId: 'mkt_team', id: 'mkt_reporting',      label: 'هل تُصدر تقرير أداء تسويقي دوري للإدارة؟',                                opts: ['نعم — شهري مع تحليل', 'عند الطلب', 'لا'] },

    { type: 'textarea', sectionId: 'mkt_freetext', id: 'marketing_free', label: 'ما التحدي الأكبر الذي يعيق نمو التسويق؟',                                placeholder: 'مثال: ضعف الميزانية، المنافسة الشرسة، غياب فريق متخصص...' },
  ],
}

// ─── OPERATIONS — العمليات ──────────────────────────────────────────────
// المصدر: dept-deep.js:977-1034 (٥ أقسام، ١٣ سؤالاً).

const OPERATIONS: DeptQuestions = {
  sections: [
    { id: 'ops_capacity',      icon: '⚙️', title: 'تخطيط العمليات والطاقة الاستيعابية', priority: 'حرج', desc: 'التخطيط السليم يمنع الاختناقات ويضمن التسليم في الوقت المحدد' },
    { id: 'ops_sops',          icon: '📐', title: 'توثيق الإجراءات والأتمتة',            priority: 'مهم', desc: 'العمليات غير الموثقة تموت بخروج الموظف' },
    { id: 'ops_quality',       icon: '✅', title: 'الجودة والتحسين المستمر',              priority: 'حرج', desc: 'الجودة ليست صدفة بل يجب أن تكون نظاماً مستداماً' },
    { id: 'ops_suppliers',     icon: '📦', title: 'إدارة الموردين وسلسلة الإمداد',       priority: 'مهم', desc: 'المورد السيء يعطل عملياتك مهما كانت كفاءتك' },
    { id: 'ops_delivery',      icon: '🚚', title: 'التسليم والكلفة التشغيلية',           priority: 'حرج', desc: 'الكفاءة تُقاس بالتسليم في الوقت وبأقل كلفة وهدر' },
    { id: 'ops_freetext',      icon: '✍️', title: 'التحقق والإغلاق',                    priority: 'عادي', desc: 'سؤال مفتوح لتوثيق الهدر التشغيلي' },
  ],
  questions: [
    { type: 'radio', sectionId: 'ops_capacity', id: 'ops_capacity',      label: 'ما نسبة استغلال طاقتكم التشغيلية القصوى؟',                                opts: ['70-85% (مثالي)', 'أقل من 50% (هدر)', 'أكثر من 95% (ضغط شديد)'] },
    { type: 'radio', sectionId: 'ops_capacity', id: 'ops_bottlenecks',   label: 'هل تعرف أين توجد الاختناقات (Bottlenecks) في عملياتك؟',                    opts: ['نعم — محددة ونعمل على حلها', 'نعرفها تقريباً', 'لا نعلم / تتغير دائماً'] },
    { type: 'radio', sectionId: 'ops_capacity', id: 'ops_forecasting',   label: 'هل تتنبأ بحجم الطلب لتخطيط العمليات؟',                                     opts: ['نعم — ببيانات تاريخية وأدوات', 'تخمين يعتمد على الخبرة', 'لا — نعمل بردود فعل'] },
    { type: 'radio', sectionId: 'ops_capacity', id: 'ops_scalability',   label: 'هل يمكنك رفع الطاقة بسرعة عند قفزة الطلب؟',                                opts: ['نعم — خطة توسّع جاهزة', 'بصعوبة وتأخير', 'لا — نعجز عن التلبية'] },

    { type: 'radio',    sectionId: 'ops_sops', id: 'ops_sops_status',    label: 'هل إجراءات العمل القياسية (SOPs) موثقة ومحدثة؟',                          opts: ['نعم — 100% موثقة', 'بعضها موثق', 'في عقول الموظفين فقط'] },
    { type: 'radio',    sectionId: 'ops_sops', id: 'ops_automation',     label: 'ما مستوى أتمتة العمليات الأساسية؟',                                        opts: ['عالي — أغلب العمليات مؤتمتة', 'متوسط', 'منخفض — عمل يدوي مكثف'] },
    { type: 'radio',    sectionId: 'ops_sops', id: 'ops_erp',            label: 'هل تستخدم نظام تخطيط الموارد (ERP) لإدارة العمليات؟',                     opts: ['نعم — نظام متكامل', 'أنظمة منفصلة / Excel', 'لا نستخدم أنظمة'] },
    { type: 'checkbox', sectionId: 'ops_sops', id: 'ops_automated_areas',label: 'ما العمليات المؤتمتة فعلاً لديك؟',                                        opts: ['استقبال الطلبات', 'إدارة المخزون', 'الفوترة', 'الجدولة والتوزيع', 'التقارير', 'التواصل مع العملاء', 'الموافقات', 'لا شيء مؤتمت'] },

    { type: 'radio', sectionId: 'ops_quality', id: 'ops_qc',             label: 'كيف تتم مراقبة الجودة (QC) في عملياتكم؟',                                opts: ['فحص دوري ومعايير واضحة', 'تفتيش عشوائي', 'فقط عند وجود شكوى'] },
    { type: 'radio', sectionId: 'ops_quality', id: 'ops_defect_rate',    label: 'هل تقيس نسبة الأخطاء / التوالف / المرتجعات؟',                              opts: ['نعم ونعمل على تقليلها', 'تُقاس أحياناً', 'لا نقيسها'] },
    { type: 'radio', sectionId: 'ops_quality', id: 'ops_continuous_imp', label: 'هل تطبق منهجيات التحسين المستمر (مثل Lean/Kaizen)؟',                        opts: ['نعم — ثقافة مؤسسية', 'نحاول تطبيقها', 'لا'] },
    { type: 'radio', sectionId: 'ops_quality', id: 'ops_root_cause',     label: 'هل تحلّل الأسباب الجذرية للمشكلات المتكررة (RCA)؟',                        opts: ['نعم — منهجيّة موثّقة', 'أحياناً', 'نعالج الأعراض فقط'] },

    { type: 'radio',    sectionId: 'ops_suppliers', id: 'ops_suppliers', label: 'هل تعتمد على مورد رئيسي واحد لأي مادة حرجة؟',                              opts: ['لا — لدينا موردين بدلاء', 'نعم لبعض المواد', 'نعم — نعتمد كلياً على مورد واحد'] },
    { type: 'radio',    sectionId: 'ops_suppliers', id: 'ops_inventory', label: 'كيف تدير مستوى المخزون وتوفر الموارد؟',                                    opts: ['نظام آلي فعّال أو JIT', 'مراجعة دورية يدوية', 'نطلب عند النفاذ'] },
    { type: 'radio',    sectionId: 'ops_suppliers', id: 'ops_lead_time', label: 'هل تتبّع مهلة التوريد (Lead Time) لكل مورّد؟',                            opts: ['نعم — ونخطط عليها', 'تقريبياً', 'لا'] },
    { type: 'checkbox', sectionId: 'ops_suppliers', id: 'ops_supply_risks',label: 'ما أبرز مخاطر سلسلة الإمداد لديك؟',                                      opts: ['مورد وحيد', 'تقلّب الأسعار', 'تأخّر الشحن', 'جودة غير ثابتة', 'اعتماد على الاستيراد', 'نقص سيولة الشراء'] },

    { type: 'radio', sectionId: 'ops_delivery', id: 'ops_on_time',       label: 'ما نسبة الطلبات/الخدمات المسلّمة في الوقت المحدد؟',                        opts: ['أكثر من 90%', '70-90%', 'أقل من 70%', 'لا نقيس'] },
    { type: 'radio', sectionId: 'ops_delivery', id: 'ops_unit_cost',     label: 'هل تعرف تكلفة الوحدة/الخدمة الفعلية؟',                                    opts: ['نعم — بدقة', 'تقدير تقريبي', 'لا'] },
    { type: 'radio', sectionId: 'ops_delivery', id: 'ops_waste',         label: 'هل تقيس الهدر التشغيلي (وقت/مواد/إعادة عمل)؟',                            opts: ['نعم — ونخفّضه بأهداف', 'ملاحظات عامة', 'لا نقيسه'] },
    { type: 'radio', sectionId: 'ops_delivery', id: 'ops_maintenance',   label: 'هل لديك صيانة وقائية مجدولة للمعدات/الأنظمة؟',                            opts: ['نعم — جدول وقائي', 'صيانة عند العطل فقط', 'لا يوجد'] },

    { type: 'textarea', sectionId: 'ops_freetext', id: 'operations_free', label: 'ما هي أكثر عملية تستنزف وقت وتكلفة الإدارة؟',                              placeholder: 'مثال: الموافقات اليدوية، إدخال البيانات المكرر، صيانة المعدات...' },
  ],
}

// ─── IT — تقنية المعلومات ──────────────────────────────────────────────
// المصدر: dept-deep.js:1096-1127 (٦ أقسام، ٢٠ سؤالاً).

const IT: DeptQuestions = {
  sections: [
    { id: 'it_org',      icon: '🏗️', title: 'الهيكل التنظيمي وإدارة IT',                   priority: 'حرج', desc: 'وضوح المسؤوليات وحجم الفريق هو أساس التخطيط التقني' },
    { id: 'it_security', icon: '🛡️', title: 'الأمن السيبراني والبيانات',                  priority: 'حرج', desc: 'متوسط تكلفة اختراق البيانات في المنطقة 6.5 مليون دولار' },
    { id: 'it_systems',  icon: '⚙️', title: 'الأنظمة والبنية التحتية',                     priority: 'مهم', desc: 'الأنظمة القديمة تكلف 3x في الصيانة مقارنة بالحديثة' },
    { id: 'it_maturity', icon: '📊', title: 'مستوى النضج التقني والمؤشرات',                priority: 'مهم', desc: 'قياس الأداء التقني يحدد الأولويات الاستثمارية' },
    { id: 'it_service',  icon: '🤝', title: 'خدمة المستخدمين الداخليين',                    priority: 'عادي', desc: 'جودة دعم IT تؤثر على إنتاجية الشركة بأكملها' },
    { id: 'it_freetext', icon: '✍️', title: 'التحقق والإغلاق',                             priority: 'عادي', desc: 'سؤال مفتوح لتوثيق الأولوية التقنية الأكثر إلحاحاً' },
  ],
  questions: [
    { type: 'radio', sectionId: 'it_org', id: 'it_lead',         label: 'هل لديك مدير IT أو مسؤول تقني متخصص؟',                        opts: ['نعم — متفرغ داخلي', 'مشترك مع مهام أخرى', 'مستشار/شريك خارجي', 'لا يوجد'] },
    { type: 'radio', sectionId: 'it_org', id: 'it_team_size',    label: 'ما حجم فريق IT؟',                                              opts: ['أكثر من 5 موظفين', '2-5 موظفين', 'موظف واحد', 'لا يوجد فريق'] },
    { type: 'radio', sectionId: 'it_org', id: 'it_budget',       label: 'هل لديك ميزانية IT مستقلة ومحددة؟',                            opts: ['نعم — سنوية مخططة', 'جزئياً', 'لا — حسب الحاجة'] },
    { type: 'radio', sectionId: 'it_org', id: 'it_strategy',     label: 'هل لديك استراتيجية تقنية مرتبطة بأهداف الشركة؟',                opts: ['نعم — موثقة ومعتمدة', 'جزئياً', 'لا'] },

    { type: 'radio', sectionId: 'it_security', id: 'cybersec_policy',       label: 'هل لديك سياسة أمن سيبراني مكتوبة؟',                     opts: ['نعم — مُطبقة ومحدّثة', 'موجودة غير مفعّلة', 'لا'] },
    { type: 'radio', sectionId: 'it_security', id: 'backup_system',         label: 'هل لديك نظام نسخ احتياطي منتظم؟',                       opts: ['نعم — يومي آلي + خارجي', 'أسبوعي', 'يدوي وغير منتظم', 'لا'] },
    { type: 'radio', sectionId: 'it_security', id: 'access_control_it',     label: 'هل تطبق مبدأ الحد الأدنى من الصلاحيات؟',                opts: ['نعم — صلاحيات محددة لكل دور', 'جزئياً', 'لا — صلاحيات واسعة'] },
    { type: 'radio', sectionId: 'it_security', id: 'security_incidents',    label: 'هل تعرضت لحوادث أمنية (اختراق/فيروس/تسريب) خلال سنة؟',   opts: ['لا', 'نعم — مع استجابة فورية', 'نعم — دون استجابة كافية'] },

    { type: 'radio', sectionId: 'it_systems', id: 'erp_system',       label: 'هل لديك نظام ERP أو نظام مؤسسي متكامل؟',                        opts: ['نعم — ERP كامل ومتكامل', 'برامج متخصصة منفصلة', 'Excel وأدوات يدوية', 'لا يوجد'] },
    { type: 'radio', sectionId: 'it_systems', id: 'cloud_adoption',   label: 'ما مستوى استخدامك للحوسبة السحابية؟',                            opts: ['Cloud-first (90%+)', 'هجين (50-90%)', 'محلي بشكل رئيسي', 'لا سحابة'] },
    { type: 'radio', sectionId: 'it_systems', id: 'system_uptime',    label: 'ما معدل توفر الأنظمة الحيوية (Uptime)؟',                         opts: ['99.9%+ (أقل من ساعة توقف/سنة)', '99% (حوالي 4 أيام/سنة)', 'أقل من 99%', 'لا نقيس'] },
    { type: 'radio', sectionId: 'it_systems', id: 'it_doc',           label: 'هل الأنظمة والبنية التحتية موثقة؟',                              opts: ['نعم — موثقة بالكامل', 'جزئياً', 'لا'] },

    { type: 'radio', sectionId: 'it_maturity', id: 'it_kpis',            label: 'هل تتابع مؤشرات أداء IT (Uptime, MTTR, Tickets)?',              opts: ['نعم — Dashboard حي', 'تقارير دورية', 'لا نقيس'] },
    { type: 'radio', sectionId: 'it_maturity', id: 'tech_debt',          label: 'هل لديك دين تقني متراكم (أنظمة قديمة/ترقيات متأخرة)؟',           opts: ['لا — نظيف', 'متوسط — نخطط للمعالجة', 'مرتفع — مشكلة فعلية'] },
    { type: 'radio', sectionId: 'it_maturity', id: 'digital_transform',  label: 'هل تقود IT مبادرات التحول الرقمي في الشركة؟',                    opts: ['نعم — بقيادة IT', 'بالشراكة مع أقسام أخرى', 'لا — IT دعم فقط'] },

    { type: 'radio', sectionId: 'it_service', id: 'helpdesk_it',            label: 'هل لديك نظام Help Desk لطلبات الدعم؟',                        opts: ['نعم — نظام تذاكر رسمي', 'إيميل/واتساب', 'شفهياً', 'لا'] },
    { type: 'radio', sectionId: 'it_service', id: 'sla_it',                 label: 'هل لديك SLA محدد لوقت الاستجابة والحل؟',                       opts: ['نعم — موثق ومُتتبّع', 'غير رسمي', 'لا'] },
    { type: 'radio', sectionId: 'it_service', id: 'user_satisfaction_it',   label: 'ما مستوى رضا المستخدمين الداخليين عن IT؟',                     opts: ['ممتاز — نقيسه رسمياً', 'جيد بشكل عام', 'متذمرون', 'لا نقيس'] },

    { type: 'textarea', sectionId: 'it_freetext', id: 'it_free',            label: 'ما أكبر تحدٍّ تقني يعرقل نمو الشركة الآن؟',                     placeholder: 'مثال: غياب ERP، أمن ضعيف، بنية تحتية قديمة، كفاءات تقنية منخفضة...' },
  ],
}

// ─── الخريطة الكاملة ─────────────────────────────────────────────────────
// كل إدارة تُلحق بها في commit مستقل. المستهلكون يجب أن يتعاملوا مع
// الإدارات غير المُنقولة بعد بتحقّق حرصي.
// ─── CUSTOMER_SERVICE — خدمة العملاء ────────────────────────────────────
// المصدر: dept-deep.js:1132-1157 (٥ أقسام، ١٧ سؤالاً).

const CUSTOMER_SERVICE: DeptQuestions = {
  sections: [
    { id: 'cs_team',       icon: '🏗️', title: 'هيكل فريق خدمة العملاء', priority: 'حرج', desc: 'الفريق المناسب هو الفرق بين عميل يبقى وعميل يذهب للمنافس' },
    { id: 'cs_quality',    icon: '⭐', title: 'جودة الخدمة ورضا العملاء',  priority: 'حرج', desc: 'زيادة الاحتفاظ بالعميل 5% ترفع الأرباح 25-95%' },
    { id: 'cs_systems',    icon: '🔧', title: 'الأنظمة وإدارة التذاكر',    priority: 'مهم', desc: 'الشركات التي تستخدم CRM تحتفظ بـ 27% عملاء أكثر' },
    { id: 'cs_perf',       icon: '📈', title: 'تطوير الفريق وإدارة الأداء', priority: 'مهم', desc: 'موظف خدمة عملاء سعيد = عميل سعيد' },
    { id: 'cs_freetext',   icon: '✍️', title: 'التحقق والإغلاق',           priority: 'عادي', desc: 'ما الذي يُضعف تجربة العميل أكثر من أي شيء آخر؟' },
  ],
  questions: [
    { type: 'radio',    sectionId: 'cs_team', id: 'cs_team_size',         label: 'ما حجم فريق خدمة العملاء؟',                                    opts: ['أكثر من 10', '5-10', '2-4', 'موظف واحد', 'لا يوجد'] },
    { type: 'radio',    sectionId: 'cs_team', id: 'cs_manager',           label: 'هل لديك مدير أو مشرف خدمة عملاء مخصص؟',                         opts: ['نعم — متفرغ', 'جزئياً', 'لا'] },
    { type: 'checkbox', sectionId: 'cs_team', id: 'cs_channels',          label: 'ما قنوات التواصل المتاحة للعملاء؟',                             opts: ['هاتف', 'واتساب', 'إيميل', 'دردشة مباشرة', 'وسائل تواصل اجتماعي', 'بوابة إلكترونية'] },
    { type: 'radio',    sectionId: 'cs_team', id: 'cs_operating_hours',   label: 'ما ساعات عمل خدمة العملاء؟',                                    opts: ['24/7', '12 ساعة (8ص-8م)', 'دوام رسمي فقط', 'غير محددة'] },

    { type: 'radio', sectionId: 'cs_quality', id: 'csat_score',             label: 'هل تقيس رضا العملاء (CSAT/NPS)؟',                              opts: ['نعم — بانتظام مع تقارير', 'أحياناً', 'لا'] },
    { type: 'radio', sectionId: 'cs_quality', id: 'nps',                    label: 'ما مستوى NPS (احتمال التوصية) لديك؟',                          opts: ['أكثر من 50 (ممتاز)', '20-50 (جيد)', '0-20 (متوسط)', 'سلبي (أقل من 0)', 'لا نقيس'] },
    { type: 'radio', sectionId: 'cs_quality', id: 'complaint_resolution',   label: 'ما معدل حل الشكاوى من أول تواصل (FCR)?',                        opts: ['أكثر من 80%', '60-80%', 'أقل من 60%', 'لا نقيس'] },
    { type: 'radio', sectionId: 'cs_quality', id: 'avg_response_time',      label: 'ما متوسط وقت الاستجابة للعميل؟',                                 opts: ['أقل من ساعة', '1-4 ساعات', '4-24 ساعة', 'أكثر من يوم'] },

    { type: 'radio', sectionId: 'cs_systems', id: 'crm_cs',              label: 'هل تستخدمون CRM لإدارة العملاء؟',                                opts: ['نعم — متكامل وفاعل', 'جزئياً', 'Excel/يدوي', 'لا'] },
    { type: 'radio', sectionId: 'cs_systems', id: 'ticketing_system',    label: 'هل لديك نظام تذاكر (Ticketing) لتتبع الشكاوى؟',                    opts: ['نعم — رسمي', 'غير رسمي', 'لا'] },
    { type: 'radio', sectionId: 'cs_systems', id: 'cs_knowledge_base',   label: 'هل لديك قاعدة معرفة للإجابات الشائعة (FAQ)?',                       opts: ['نعم — محدّثة', 'جزئياً', 'لا'] },
    { type: 'radio', sectionId: 'cs_systems', id: 'chatbot_ai',          label: 'هل تستخدمون Chatbot أو AI لأتمتة الردود؟',                        opts: ['نعم — فاعل', 'قيد التطوير', 'لا'] },

    { type: 'radio', sectionId: 'cs_perf', id: 'cs_training',            label: 'هل يتلقى فريق CS تدريباً منتظماً؟',                              opts: ['نعم — برنامج ربع سنوي', 'عند التوظيف فقط', 'لا'] },
    { type: 'radio', sectionId: 'cs_perf', id: 'cs_kpis',                label: 'هل لدى الفريق أهداف ومؤشرات أداء واضحة؟',                         opts: ['نعم — يومية وأسبوعية', 'شهرية فقط', 'لا'] },
    { type: 'radio', sectionId: 'cs_perf', id: 'cs_turnover',            label: 'ما معدل دوران موظفي خدمة العملاء سنوياً؟',                        opts: ['أقل من 15%', '15-30%', 'أكثر من 30%', 'لا نتتبع'] },

    { type: 'textarea', sectionId: 'cs_freetext', id: 'cs_free',         label: 'ما أكبر شكوى متكررة تصلك من العملاء؟',                            placeholder: 'مثال: بطء الرد، عدم متابعة الشكاوى، صعوبة الإلغاء، جودة الخدمة...' },
  ],
}

// ─── QUALITY — الجودة ────────────────────────────────────────────────
// المصدر: dept-deep.js:1163-1187 (٥ أقسام، ١٥ سؤالاً).

const QUALITY: DeptQuestions = {
  sections: [
    { id: 'q_org',        icon: '🏗️', title: 'هيكل إدارة الجودة',      priority: 'حرج', desc: 'الجودة ليست قسماً — هي ثقافة. لكنها تبدأ بقيادة واضحة' },
    { id: 'q_control',    icon: '🔍', title: 'ضبط الجودة والفحص',      priority: 'حرج', desc: 'تكلفة الوقاية = 10% من تكلفة الإصلاح بعد التسليم' },
    { id: 'q_kpis',       icon: '📊', title: 'المؤشرات والتقارير',      priority: 'مهم', desc: 'لا يمكن إدارة ما لا يُقاس' },
    { id: 'q_improve',    icon: '🔄', title: 'التحسين المستمر',          priority: 'مهم', desc: 'Kaizen: تحسينات صغيرة يومية = نتائج كبيرة سنوية' },
    { id: 'q_freetext',   icon: '✍️', title: 'التحقق والإغلاق',         priority: 'عادي', desc: 'ما هو أكبر مشكلة جودة تواجهها الآن؟' },
  ],
  questions: [
    { type: 'radio',    sectionId: 'q_org', id: 'quality_manager',       label: 'هل لديك مدير جودة أو مسؤول جودة متخصص؟',                        opts: ['نعم — متفرغ', 'مشترك مع مهام', 'لا'] },
    { type: 'radio',    sectionId: 'q_org', id: 'quality_policy',        label: 'هل لديك سياسة جودة موثقة ومعتمدة؟',                              opts: ['نعم — محدّثة وموزعة', 'موجودة غير فاعلة', 'لا'] },
    { type: 'checkbox', sectionId: 'q_org', id: 'iso_certification',     label: 'هل حصلتم على شهادات جودة (ISO, etc.)?',                          opts: ['ISO 9001', 'ISO 14001', 'ISO 45001', 'IATF / شهادة قطاعية', 'لا يوجد'] },
    { type: 'radio',    sectionId: 'q_org', id: 'quality_budget',        label: 'هل لإدارة الجودة ميزانية مستقلة؟',                                opts: ['نعم', 'جزئياً', 'لا'] },

    { type: 'radio', sectionId: 'q_control', id: 'inspection_process',   label: 'ما مستوى عملية الفحص وضبط الجودة؟',                              opts: ['فحص آلي + يدوي في كل مرحلة', 'فحص نهائي فقط', 'فحص عشوائي', 'لا يوجد فحص رسمي'] },
    { type: 'radio', sectionId: 'q_control', id: 'defect_rate',          label: 'ما نسبة العيوب/الأخطاء في المنتجات/الخدمات؟',                     opts: ['أقل من 1%', '1-3%', 'أكثر من 3%', 'لا نقيس'] },
    { type: 'radio', sectionId: 'q_control', id: 'rework_cost',          label: 'هل تتتبع تكلفة إعادة العمل (Rework Cost)?',                       opts: ['نعم — مع هدف تخفيض', 'أحياناً', 'لا'] },
    { type: 'radio', sectionId: 'q_control', id: 'supplier_quality',     label: 'هل تقيّم جودة الموردين بشكل منتظم؟',                              opts: ['نعم — تقييم دوري + شهادات', 'أحياناً', 'لا'] },

    { type: 'radio', sectionId: 'q_kpis', id: 'quality_kpis',            label: 'هل تتابع مؤشرات الجودة بانتظام؟',                                opts: ['نعم — Dashboard يومي', 'تقارير أسبوعية', 'شهرية', 'لا'] },
    { type: 'radio', sectionId: 'q_kpis', id: 'customer_returns',        label: 'ما معدل مرتجعات العملاء/الشكاوى المتعلقة بالجودة؟',              opts: ['أقل من 2%', '2-5%', 'أكثر من 5%', 'لا نقيس'] },
    { type: 'radio', sectionId: 'q_kpis', id: 'root_cause',              label: 'هل تجري تحليل السبب الجذري للعيوب (RCA)?',                        opts: ['نعم — لكل عيب رئيسي', 'للحوادث الكبيرة فقط', 'لا'] },

    { type: 'radio', sectionId: 'q_improve', id: 'continuous_improvement',label: 'هل لديك منهجية تحسين مستمر (Lean/Six Sigma/Kaizen)?',            opts: ['نعم — مطبقة رسمياً', 'جزئياً', 'لا'] },
    { type: 'radio', sectionId: 'q_improve', id: 'audit_internal',       label: 'هل تجري مراجعات جودة داخلية دورية؟',                              opts: ['ربع سنوية', 'سنوية', 'عند الحاجة', 'لا'] },
    { type: 'radio', sectionId: 'q_improve', id: 'corrective_actions',   label: 'هل لديك نظام للإجراءات التصحيحية والوقائية (CAPA)?',              opts: ['نعم — رسمي ومتتبع', 'غير رسمي', 'لا'] },

    { type: 'textarea', sectionId: 'q_freetext', id: 'quality_free',     label: 'ما المشكلة التي تتكرر في الجودة وتصعب حلها؟',                    placeholder: 'مثال: أخطاء بشرية، موردون غير موثوقين، عدم اتباع الإجراءات...' },
  ],
}

// ─── SUPPORT — الإمداد والدعم / الخدمات المساندة ────────────────────────
// المصدر: dept-deep.js:1036-1090 (٥ أقسام، ١٢ سؤالاً).

const SUPPORT: DeptQuestions = {
  sections: [
    { id: 'sup_infra',      icon: '💻', title: 'البنية التحتية التقنية (IT)',            priority: 'حرج', desc: 'الأساس التقني هو العمود الفقري لعمليات الشركة في العصر الحديث' },
    { id: 'sup_security',   icon: '🔒', title: 'الأمن السيبراني والنسخ الاحتياطي',        priority: 'حرج', desc: 'فقدان البيانات أو اختراقها قد يعني نهاية الشركة' },
    { id: 'sup_helpdesk',   icon: '🛠️', title: 'الدعم الفني والصيانة',                    priority: 'مهم', desc: 'سرعة الاستجابة تقلل أوقات التوقف (Downtime) وترفع الإنتاجية' },
    { id: 'sup_procurement',icon: '🛒', title: 'المشتريات والعقود الإدارية',             priority: 'مهم', desc: 'إدارة المشتريات بشكل جيد توفر مبالغ ضخمة وتزيد الشفافية' },
    { id: 'sup_continuity', icon: '🛡️', title: 'الاستمرارية والتراخيص',                  priority: 'حرج', desc: 'خطة التعافي والتراخيص القانونية تحمي من توقف كارثي' },
    { id: 'sup_freetext',   icon: '✍️', title: 'التحقق والإغلاق',                        priority: 'عادي', desc: 'سؤال مفتوح لتوثيق المخاطر التقنية' },
  ],
  questions: [
    { type: 'radio',    sectionId: 'sup_infra', id: 'sup_infrastructure',label: 'كيف تصف البنية التحتية التقنية للمنظمة؟',                                    opts: ['سحابية بالكامل وحديثة', 'مزيج (خوادم محلية وسحابة)', 'قديمة وتحتاج تحديث'] },
    { type: 'radio',    sectionId: 'sup_infra', id: 'sup_integration',   label: 'هل أنظمة الشركة متكاملة معاً بسلاسة؟',                                       opts: ['تكامل آلي بالكامل (APIs)', 'تكامل جزئي', 'جزر منعزلة (إدخال يدوي مكرر)'] },
    { type: 'radio',    sectionId: 'sup_infra', id: 'sup_uptime',        label: 'هل تواجهون انقطاعات متكررة في الأنظمة الأساسية؟',                            opts: ['نادراً — استقرار 99%+', 'أحياناً', 'كثيراً مما يعطل العمل'] },
    { type: 'checkbox', sectionId: 'sup_infra', id: 'sup_systems',       label: 'ما الأنظمة الأساسية المستخدمة لديك؟',                                        opts: ['ERP', 'CRM', 'بريد مؤسسي', 'تخزين سحابي', 'أدوات تعاون (Teams/Slack)', 'نظام محاسبي', 'أنظمة مخصّصة', 'Excel فقط'] },

    { type: 'radio',    sectionId: 'sup_security', id: 'sup_backup',        label: 'ما هي سياسة النسخ الاحتياطي للبيانات (Backups)؟',                        opts: ['تلقائي، ومفحوص دورياً', 'تلقائي لكن غير مفحوص', 'يدوي أو غير منتظم'] },
    { type: 'radio',    sectionId: 'sup_security', id: 'sup_cybersecurity', label: 'هل تطبقون ضوابط أمن سيبراني صارمة؟',                                    opts: ['نعم — سياسات وتدريب مستمر', 'برامج حماية أساسية', 'لا يوجد اهتمام كافٍ'] },
    { type: 'radio',    sectionId: 'sup_security', id: 'sup_access_control',label: 'هل صلاحيات الوصول للأنظمة تدار بشكل صارم؟',                              opts: ['نعم — حسب الدور الوظيفي فقط', 'صلاحيات واسعة لأغلب الموظفين', 'لا توجد سياسة واضحة'] },
    { type: 'radio',    sectionId: 'sup_security', id: 'sup_incident_plan', label: 'هل لديك خطة استجابة للحوادث الأمنية؟',                                  opts: ['نعم — موثّقة ومختبَرة', 'غير رسمية', 'لا يوجد'] },
    { type: 'checkbox', sectionId: 'sup_security', id: 'sup_sec_controls', label: 'ما ضوابط الحماية المطبّقة فعلاً؟',                                        opts: ['جدار حماية', 'مكافح فيروسات', 'تشفير البيانات', 'مصادقة ثنائية (2FA)', 'تدريب توعية', 'اختبار اختراق دوري', 'سياسة كلمات مرور'] },

    { type: 'radio', sectionId: 'sup_helpdesk', id: 'sup_helpdesk',      label: 'كيف تدار طلبات الدعم الفني والإداري الداخلي؟',                            opts: ['نظام تذاكر (Ticketing System)', 'إيميل / واتساب', 'شفهياً'] },
    { type: 'radio', sectionId: 'sup_helpdesk', id: 'sup_sla',           label: 'هل يوجد وقت استجابة محدد (SLA) لحل المشاكل؟',                             opts: ['نعم ومُقاس بدقة', 'غير رسمي', 'لا يوجد'] },
    { type: 'radio', sectionId: 'sup_helpdesk', id: 'sup_first_response',label: 'ما متوسط زمن الاستجابة الأولى لطلبات الدعم؟',                              opts: ['أقل من ساعة', 'خلال يوم العمل', 'أكثر من يوم / متغيّر'] },
    { type: 'radio', sectionId: 'sup_helpdesk', id: 'sup_knowledge_base',label: 'هل لديك قاعدة معرفة/أدلة حلول متاحة للموظفين؟',                            opts: ['نعم — محدّثة', 'محدودة', 'لا'] },

    { type: 'radio', sectionId: 'sup_procurement', id: 'sup_procurement',label: 'هل يوجد سياسة مشتريات واضحة بحدود اعتماد؟',                              opts: ['نعم — سياسة مؤتمتة', 'موجودة لكن ورقية', 'لا — الشراء يتم عشوائياً'] },
    { type: 'radio', sectionId: 'sup_procurement', id: 'sup_vendor_mgmt',label: 'هل يتم تقييم عقود الموردين التقنيين والخدميين دورياً؟',                    opts: ['نعم — تقييم دوري منهجي', 'عند التجديد فقط', 'لا'] },
    { type: 'radio', sectionId: 'sup_procurement', id: 'sup_asset_register',label: 'هل لديك سجل أصول تقنية محدّث (أجهزة/تراخيص)؟',                          opts: ['نعم — محدّث', 'ناقص أو قديم', 'لا يوجد'] },

    { type: 'radio', sectionId: 'sup_continuity', id: 'sup_dr_plan',     label: 'هل لديك خطة تعافٍ من الكوارث (Disaster Recovery)؟',                       opts: ['نعم — مختبَرة دورياً', 'موجودة بلا اختبار', 'لا يوجد'] },
    { type: 'radio', sectionId: 'sup_continuity', id: 'sup_license',     label: 'هل تراخيص برامجك قانونية ومحدّثة؟',                                       opts: ['نعم — كلها مرخّصة', 'بعضها منتهٍ/غير مرخّص', 'لا نتابع'] },

    { type: 'textarea', sectionId: 'sup_freetext', id: 'support_free',   label: 'ما هو أكبر خطر تقني أو إداري يواجه المنظمة اليوم؟',                        placeholder: 'مثال: خوادم متهالكة، غياب النسخ الاحتياطي، نقص التراخيص...' },
  ],
}

// ─── PROJECTS — إدارة المشاريع ────────────────────────────────────────
// المصدر: dept-deep.js:1193-1217 (٥ أقسام، ١٤ سؤالاً).

const PROJECTS: DeptQuestions = {
  sections: [
    { id: 'proj_pmo',       icon: '🏗️', title: 'هيكل إدارة المشاريع والـ PMO',    priority: 'حرج', desc: '70% من المشاريع تفشل بسبب غياب منهجية إدارة واضحة' },
    { id: 'proj_planning',  icon: '📅', title: 'تخطيط وتنفيذ المشاريع',           priority: 'حرج', desc: 'المشاريع التي تبدأ بمتطلبات واضحة تنجح بنسبة 2.5x أكبر' },
    { id: 'proj_tools',     icon: '🔧', title: 'الأدوات والأنظمة',                priority: 'مهم', desc: 'الأدوات الصحيحة ترفع إنتاجية فريق المشاريع 30%' },
    { id: 'proj_resources', icon: '👥', title: 'إدارة الموارد وأصحاب المصلحة',   priority: 'مهم', desc: 'المشاريع تفشل بسبب الناس أكثر من التقنية' },
    { id: 'proj_freetext',  icon: '✍️', title: 'التحقق والإغلاق',                priority: 'عادي', desc: 'ما التحدي الأكبر الذي يعرقل إنجاز مشاريعك؟' },
  ],
  questions: [
    { type: 'radio', sectionId: 'proj_pmo', id: 'pmo_exists',        label: 'هل لديك مكتب إدارة مشاريع (PMO) رسمي؟',                            opts: ['نعم — PMO كامل', 'جزئياً — بعض الوظائف', 'لا'] },
    { type: 'radio', sectionId: 'proj_pmo', id: 'pm_methodology',    label: 'ما المنهجية المستخدمة في إدارة المشاريع؟',                          opts: ['Agile/Scrum', 'Waterfall/PMBOK', 'هجين', 'لا منهجية محددة'] },
    { type: 'radio', sectionId: 'proj_pmo', id: 'pm_certified',      label: 'هل مدراء المشاريع حاصلون على شهادات مهنية (PMP/Prince2)?',            opts: ['نعم — أغلبهم', 'بعضهم', 'لا'] },
    { type: 'radio', sectionId: 'proj_pmo', id: 'project_portfolio', label: 'هل تدير محفظة مشاريع (Portfolio) بشكل رسمي؟',                       opts: ['نعم — مع أولويات واضحة', 'جزئياً', 'لا'] },

    { type: 'radio', sectionId: 'proj_planning', id: 'project_charter',   label: 'هل تُعد وثيقة مشروع (Project Charter) لكل مشروع؟',              opts: ['نعم — دائماً', 'للمشاريع الكبيرة فقط', 'لا'] },
    { type: 'radio', sectionId: 'proj_planning', id: 'scope_management',  label: 'كيف تتعامل مع تغييرات النطاق (Scope Creep)?',                    opts: ['نظام تغيير رسمي (Change Control)', 'غير رسمي', 'لا يوجد آلية'] },
    { type: 'radio', sectionId: 'proj_planning', id: 'on_time_delivery',  label: 'ما نسبة المشاريع المسلّمة في الموعد؟',                          opts: ['80%+ في الموعد', '50-80%', 'أقل من 50%', 'لا نقيس'] },
    { type: 'radio', sectionId: 'proj_planning', id: 'on_budget',         label: 'ما نسبة المشاريع المنتهية ضمن الميزانية المحددة؟',              opts: ['80%+ ضمن الميزانية', '50-80%', 'أقل من 50%', 'لا نقيس'] },

    { type: 'checkbox', sectionId: 'proj_tools', id: 'pm_tools',           label: 'ما أدوات إدارة المشاريع المستخدمة؟',                              opts: ['Microsoft Project', 'Jira', 'Asana/Monday', 'Excel فقط', 'لا توجد أدوات'] },
    { type: 'radio',    sectionId: 'proj_tools', id: 'risk_register',      label: 'هل تحتفظ بسجل مخاطر (Risk Register) لكل مشروع؟',                  opts: ['نعم — محدّث بانتظام', 'للمشاريع الكبيرة', 'لا'] },
    { type: 'radio',    sectionId: 'proj_tools', id: 'lessons_learned_pm', label: 'هل توثق درس مستفادة (Lessons Learned) بعد كل مشروع؟',            opts: ['نعم — قاعدة معرفة', 'أحياناً', 'لا'] },

    { type: 'radio', sectionId: 'proj_resources', id: 'resource_planning',       label: 'هل تخطط الموارد البشرية للمشاريع مسبقاً؟',                opts: ['نعم — خطة موارد رسمية', 'جزئياً', 'لا — حسب الحاجة'] },
    { type: 'radio', sectionId: 'proj_resources', id: 'stakeholder_engagement',  label: 'كيف تدير توقعات وتواصل أصحاب المصلحة؟',                   opts: ['تقارير دورية + اجتماعات منتظمة', 'عند الطلب فقط', 'لا يوجد آلية'] },
    { type: 'radio', sectionId: 'proj_resources', id: 'project_status_reports',  label: 'هل تُصدر تقارير حالة مشروع منتظمة؟',                     opts: ['نعم — أسبوعية', 'شهرية', 'عند الطلب', 'لا'] },

    { type: 'textarea', sectionId: 'proj_freetext', id: 'projects_free',         label: 'ما أكبر سبب لتأخر أو فشل المشاريع لديكم؟',                placeholder: 'مثال: غياب نطاق واضح، موارد مشتركة، تغيير متطلبات متكرر، قرارات بطيئة...' },
  ],
}

// ─── COMPLIANCE — الامتثال ───────────────────────────────────────────
// المصدر: dept-deep.js:32-240 (١٥ قسماً، ٤٢ سؤالاً). أكبر بنك تخصّصي — يغطي
// كل الجهات التنظيمية السعودية.

const COMPLIANCE: DeptQuestions = {
  sections: [
    { id: 'comp_gov',      icon: '🏛️', title: 'هيكل الحوكمة والامتثال',       priority: 'حرج', desc: 'الأساس الذي يُبنى عليه كل شيء — بدون هيكل = فوضى تنظيمية' },
    { id: 'comp_cr',       icon: '📋', title: 'السجل التجاري — وزارة التجارة', priority: 'حرج', desc: 'أساس الوجود القانوني — بدونه لا تستطيع ممارسة أي نشاط' },
    { id: 'comp_labor',    icon: '🟢', title: 'العمل والتوطين — نطاقات / قوى / مقيم', priority: 'حرج', desc: 'النطاق الأحمر = إيقاف تأشيرات + نقل كفالة + غرامات فورية' },
    { id: 'comp_zatca',    icon: '🏛️', title: 'الزكاة والضريبة — ZATCA',       priority: 'حرج', desc: 'الغرامات تتراكم تلقائياً — التأخير يوم واحد يكلّفك آلاف' },
    { id: 'comp_gosi',     icon: '🛡️', title: 'التأمينات الاجتماعية — GOSI',   priority: 'حرج', desc: 'عدم التسجيل أو الفروقات = غرامات بأثر رجعي + تحقيق' },
    { id: 'comp_municipal',icon: '🏬', title: 'البلدية والتراخيص المحلية',     priority: 'مهم', desc: 'التشغيل بدون رخصة = إغلاق فوري + غرامة حتى 100,000 ﷼' },
    { id: 'comp_sector',   icon: '📑', title: 'الجهات التنظيمية القطاعية',     priority: 'مهم', desc: 'كل قطاع له جهة مشرفة — تأكد أنك مسجل ومرخص' },
    { id: 'comp_pdpl',     icon: '🔒', title: 'حماية البيانات الشخصية — PDPL', priority: 'مهم', desc: 'نظام PDPL جديد — الغرامات تصل 5 مليون ﷼' },
    { id: 'comp_nca',      icon: '🔐', title: 'الأمن السيبراني — NCA',         priority: 'مهم', desc: 'الاختراق يكلّف الشركة المتوسطة 1.2 مليون ﷼ في المتوسط' },
    { id: 'comp_ohs',      icon: '⛑️', title: 'الصحة والسلامة المهنية',       priority: 'عادي', desc: 'نظام العمل يُلزم بتوفير بيئة آمنة — غرامات حتى 25,000 ﷼' },
    { id: 'comp_env',      icon: '🌿', title: 'الامتثال البيئي',                priority: 'عادي', desc: 'ينطبق على الصناعة والمقاولات والأنشطة ذات الأثر البيئي' },
    { id: 'comp_aml',      icon: '🏦', title: 'مكافحة غسل الأموال — AML',      priority: 'عادي', desc: 'يُطبق على القطاع المالي والعقاري والتجارة عالية القيمة' },
    { id: 'comp_policies', icon: '📚', title: 'السياسات والإجراءات الداخلية',  priority: 'مهم', desc: '68% من القضايا العمالية يكسبها الموظف بسبب غياب سياسات مكتوبة' },
    { id: 'comp_tracking', icon: '📊', title: 'أنظمة المتابعة والتحقق',        priority: 'مهم', desc: '43% من المخالفات سببها نسيان تجديد ترخيص أو موعد إقرار' },
    { id: 'comp_freetext', icon: '✍️', title: 'التحقق والإغلاق',              priority: 'عادي', desc: 'سؤال مفتوح لالتقاط ما لم تغطيه الأسئلة السابقة' },
  ],
  questions: [
    // ─── 1. هيكل الحوكمة والامتثال ─────────────────────────────────────
    { type: 'radio', sectionId: 'comp_gov', id: 'compliance_officer',    label: 'هل لديك مسؤول امتثال داخلي؟',                            opts: ['نعم — موظف متفرغ', 'جزئي — مشترك مع مهام أخرى', 'لا — أنا أتولى ذلك', 'مستشار خارجي'] },
    { type: 'radio', sectionId: 'comp_gov', id: 'governance_structure',  label: 'هل لديك لجنة حوكمة أو مجلس إدارة رسمي؟',                  opts: ['نعم — مع اجتماعات دورية', 'مجلس شكلي', 'لا يوجد'] },
    { type: 'radio', sectionId: 'comp_gov', id: 'compliance_policy',     label: 'هل لديك سياسة امتثال مكتوبة ومعتمدة؟',                    opts: ['نعم — محدّثة ومعتمدة', 'قديمة', 'لا يوجد'] },
    { type: 'radio', sectionId: 'comp_gov', id: 'compliance_awareness',  label: 'هل تُدرب الموظفين على أنظمة الامتثال بانتظام؟',            opts: ['نعم — برنامج سنوي', 'أحياناً', 'لا'] },

    // ─── 2. السجل التجاري ─────────────────────────────────────────
    { type: 'radio', sectionId: 'comp_cr', id: 'cr_status',      label: 'ما حالة سجلك التجاري؟',                                        opts: ['ساري ومحدّث', 'قارب على الانتهاء', 'منتهي', 'لا أعرف'] },
    { type: 'radio', sectionId: 'comp_cr', id: 'cr_activities',  label: 'هل أنشطة السجل التجاري تطابق ما تمارسه فعلاً؟',                  opts: ['نعم — تطابق تام', 'جزئياً', 'لا — أحتاج تعديل'] },
    { type: 'radio', sectionId: 'comp_cr', id: 'cr_branch',      label: 'هل لديك فروع تحتاج تسجيل إضافي؟',                              opts: ['لا فروع', 'نعم — كلها مسجلة', 'نعم — بعضها غير مسجل'] },

    // ─── 3. نطاقات / قوى / مقيم ─────────────────────────────────
    { type: 'radio', sectionId: 'comp_labor', id: 'nitaqat_status',     label: 'ما نطاقك في نظام نطاقات؟',                                  opts: ['بلاتيني', 'أخضر مرتفع', 'أخضر منخفض', 'أصفر', 'أحمر', 'لا أعرف'] },
    { type: 'radio', sectionId: 'comp_labor', id: 'saudization_rate',   label: 'ما نسبة التوطين الحالية؟',                                 opts: ['أعلى من المطلوب', 'عند الحد الأدنى', 'أقل من المطلوب', 'لا أعرف'] },
    { type: 'radio', sectionId: 'comp_labor', id: 'labor_contracts',    label: 'هل عقود العمل محدّثة ومسجلة في قوى؟',                       opts: ['نعم — 100%', 'أغلبها', 'بعضها', 'لا'] },
    { type: 'radio', sectionId: 'comp_labor', id: 'wps_compliance',     label: 'هل تلتزم بنظام حماية الأجور (WPS)؟',                       opts: ['نعم — كل شهر في موعده', 'تأخير أحياناً', 'غير مسجل'] },
    { type: 'radio', sectionId: 'comp_labor', id: 'work_permits',       label: 'هل تصاريح العمل والإقامات للوافدين محدّثة؟',                opts: ['نعم — كلها سارية', 'بعضها قارب على الانتهاء', 'منتهية'] },

    // ─── 4. ZATCA ────────────────────────────────────────────────
    { type: 'radio', sectionId: 'comp_zatca', id: 'zatca_registration', label: 'هل أنت مسجل في ZATCA (الزكاة والضريبة)؟',                   opts: ['نعم — مسجل ومُحدّث', 'مسجل لكن غير محدث', 'غير مسجل'] },
    { type: 'radio', sectionId: 'comp_zatca', id: 'vat_status',         label: 'ما حالة ضريبة القيمة المضافة (VAT)؟',                      opts: ['مسجل ومنتظم في الإقرارات', 'مسجل لكن متأخر', 'غير مسجل (معفي)', 'غير مسجل (مطلوب)'] },
    { type: 'radio', sectionId: 'comp_zatca', id: 'zakat_filing',       label: 'هل إقراراتك الزكوية/الضريبية مرفوعة في وقتها؟',              opts: ['نعم — دائماً', 'تأخير أحياناً', 'متأخرة', 'لم تُرفع'] },
    { type: 'radio', sectionId: 'comp_zatca', id: 'fatoora_einvoice',   label: 'هل تطبق الفوترة الإلكترونية (فاتورة)؟',                    opts: ['نعم — المرحلة الثانية (ربط)', 'المرحلة الأولى فقط', 'لا'] },
    { type: 'radio', sectionId: 'comp_zatca', id: 'transfer_pricing',   label: 'هل لديك معاملات مع أطراف ذات علاقة تحتاج تسعير محايد؟',      opts: ['لا توجد', 'نعم — مع سياسة تسعير', 'نعم — بدون سياسة'] },

    // ─── 5. GOSI ─────────────────────────────────────────────────
    { type: 'radio', sectionId: 'comp_gosi', id: 'gosi_registration', label: 'هل جميع الموظفين مسجلين في GOSI؟',                          opts: ['نعم — 100%', 'أغلبهم', 'بعضهم', 'لا'] },
    { type: 'radio', sectionId: 'comp_gosi', id: 'gosi_payment',      label: 'هل اشتراكات GOSI تُدفع في وقتها؟',                          opts: ['نعم — منتظم', 'تأخير أحياناً', 'متأخرة'] },
    { type: 'radio', sectionId: 'comp_gosi', id: 'gosi_salary_match', label: 'هل الرواتب المسجلة في GOSI تطابق الفعلية؟',                  opts: ['نعم — تطابق تام', 'فروقات بسيطة', 'فروقات كبيرة'] },

    // ─── 6. البلدية ─────────────────────────────────────────────
    { type: 'radio', sectionId: 'comp_municipal', id: 'municipal_license', label: 'ما حالة الرخصة البلدية (رخصة نشاط)؟',                     opts: ['سارية ومحدّثة', 'قاربت على الانتهاء', 'منتهية', 'لا يوجد'] },
    { type: 'radio', sectionId: 'comp_municipal', id: 'civil_defense',     label: 'هل شهادة الدفاع المدني (سلامة) سارية؟',                    opts: ['نعم', 'منتهية', 'لا يوجد', 'لا تنطبق'] },
    { type: 'radio', sectionId: 'comp_municipal', id: 'signage_permits',   label: 'هل لافتات المحل/المكتب مرخصة من البلدية؟',                  opts: ['نعم', 'لا', 'لا تنطبق'] },

    // ─── 7. القطاعية ─────────────────────────────────────────────
    { type: 'checkbox', sectionId: 'comp_sector', id: 'sector_regulator', label: 'ما الجهات التنظيمية الخاصة بقطاعك؟',                       opts: ['هيئة سوق المال (CMA)', 'هيئة الاتصالات (CST)', 'هيئة الغذاء والدواء (SFDA)', 'SAGIA/MISA', 'هيئة المقاولين', 'لا توجد جهة خاصة'] },
    { type: 'radio',    sectionId: 'comp_sector', id: 'sector_license',   label: 'هل تراخيصك القطاعية سارية ومحدّثة؟',                       opts: ['نعم — كلها سارية', 'بعضها قارب', 'منتهية', 'لا تنطبق'] },

    // ─── 8. PDPL ─────────────────────────────────────────────────
    { type: 'radio', sectionId: 'comp_pdpl', id: 'pdpl_awareness',  label: 'هل تعرف متطلبات نظام حماية البيانات الشخصية؟',                 opts: ['نعم — مُطبق بالكامل', 'نعرفه لكن لم نطبق', 'لا نعرفه'] },
    { type: 'radio', sectionId: 'comp_pdpl', id: 'data_consent',    label: 'هل تحصل على موافقة العملاء قبل جمع بياناتهم؟',                  opts: ['نعم — بسياسة واضحة', 'أحياناً', 'لا'] },
    { type: 'radio', sectionId: 'comp_pdpl', id: 'data_breach_plan',label: 'هل لديك خطة استجابة لحوادث تسرب البيانات؟',                     opts: ['نعم — موثقة ومُختبرة', 'موجودة غير مُختبرة', 'لا'] },

    // ─── 9. NCA ──────────────────────────────────────────────────
    { type: 'radio', sectionId: 'comp_nca', id: 'cybersecurity_controls', label: 'ما مستوى الأمن السيبراني لديك؟',                          opts: ['عالي — معايير NCA مُطبقة', 'متوسط — ضوابط أساسية', 'ضعيف', 'لا أعرف'] },
    { type: 'radio', sectionId: 'comp_nca', id: 'cybersecurity_audit',    label: 'هل أجريت تقييم أمن سيبراني؟',                            opts: ['نعم — خلال 12 شهر', 'أكثر من سنة', 'لم يتم أبداً'] },

    // ─── 10. الصحة والسلامة ─────────────────────────────────────
    { type: 'radio', sectionId: 'comp_ohs', id: 'ohs_policy',         label: 'هل لديك سياسة صحة وسلامة مهنية؟',                            opts: ['نعم — معتمدة ومُفعّلة', 'موجودة غير مُفعّلة', 'لا'] },
    { type: 'radio', sectionId: 'comp_ohs', id: 'safety_training',    label: 'هل تُدرب الموظفين على السلامة بانتظام؟',                     opts: ['نعم — برنامج سنوي', 'عند الحاجة', 'لا'] },
    { type: 'radio', sectionId: 'comp_ohs', id: 'incidents_tracking', label: 'هل تسجل وتحلل حوادث العمل؟',                                  opts: ['نعم — نظام تتبع', 'يدوياً', 'لا'] },

    // ─── 11. البيئي ─────────────────────────────────────────────
    { type: 'radio', sectionId: 'comp_env', id: 'env_compliance', label: 'هل تلتزم بالمتطلبات البيئية (إن وجدت)؟',                        opts: ['نعم — ترخيص بيئي ساري', 'جزئياً', 'لا', 'لا تنطبق'] },

    // ─── 12. AML ─────────────────────────────────────────────────
    { type: 'radio', sectionId: 'comp_aml', id: 'aml_policy',  label: 'هل لديك سياسة مكافحة غسل الأموال (إن انطبقت)؟',                    opts: ['نعم — مُطبقة', 'موجودة غير مُفعّلة', 'لا', 'لا تنطبق'] },
    { type: 'radio', sectionId: 'comp_aml', id: 'kyc_process', label: 'هل تطبق إجراءات اعرف عميلك (KYC)؟',                                 opts: ['نعم — لكل العملاء', 'للعملاء الكبار فقط', 'لا', 'لا تنطبق'] },

    // ─── 13. السياسات والإجراءات ──────────────────────────────
    { type: 'radio', sectionId: 'comp_policies', id: 'compliance_handbook', label: 'هل لديك دليل سياسات وإجراءات داخلية؟',                    opts: ['نعم — شامل ومحدّث', 'موجود لكن قديم', 'لا'] },
    { type: 'radio', sectionId: 'comp_policies', id: 'whistle_blowing',     label: 'هل لديك آلية إبلاغ عن المخالفات (Whistleblowing)؟',        opts: ['نعم — قنوات سرية', 'غير رسمية', 'لا'] },
    { type: 'radio', sectionId: 'comp_policies', id: 'conflict_interest',   label: 'هل لديك سياسة تعارض المصالح؟',                           opts: ['نعم — موثقة ومُفعّلة', 'شفهية', 'لا'] },

    // ─── 14. التتبع والمراقبة ──────────────────────────────────
    { type: 'radio', sectionId: 'comp_tracking', id: 'license_review',      label: 'ما آخر مرة راجعت تراخيصك؟',                                opts: ['هذا الشهر', 'هذه السنة', 'أكثر من سنة', 'لا أتذكر'] },
    { type: 'radio', sectionId: 'comp_tracking', id: 'compliance_tracking', label: 'كيف تتابع مواعيد التجديدات والمتطلبات؟',                   opts: ['نظام إلكتروني/تنبيهات', 'Excel + تذكير يدوي', 'حسب الذاكرة'] },
    { type: 'radio', sectionId: 'comp_tracking', id: 'violations',          label: 'هل سبق أن تلقيت مخالفة رسمية؟',                          opts: ['لا', 'نعم — تم حلها', 'نعم — لا تزال قائمة'] },
    { type: 'radio', sectionId: 'comp_tracking', id: 'compliance_budget',   label: 'هل لديك ميزانية مخصصة للامتثال؟',                        opts: ['نعم — سنوية', 'حسب الحاجة', 'لا'] },

    // ─── 15. التحقق ─────────────────────────────────────────────
    { type: 'textarea', sectionId: 'comp_freetext', id: 'compliance_free',  label: 'ما أكبر قلق امتثالي يشغل تفكيرك؟',                       placeholder: 'مثال: تسجيل ZATCA، نطاقات، حماية البيانات، تراخيص قطاعية...' },
  ],
}

// ─── LOGISTICS — اللوجستيات (مُكيّفة من OPERATIONS) ──────────────────
// المصدر: نُقلت من dept-config.js DEPT_LOGIC.logistics + تكييف أسئلة OPERATIONS.
// نمط: نفس بنية OPERATIONS مع سؤالين إضافيين خاصّين بسلاسل الإمداد.

const LOGISTICS: DeptQuestions = {
  sections: [
    { id: 'log_capacity',   icon: '🚚', title: 'تخطيط سلاسل الإمداد والطاقة',       priority: 'حرج', desc: 'التخطيط السليم يمنع تأخّر التسليم ويقلّل تكلفة النقل' },
    { id: 'log_operations', icon: '📐', title: 'العمليات اللوجستية والأتمتة',         priority: 'مهم', desc: 'العمليات اليدوية في الشحن تكلّف 30% أكثر' },
    { id: 'log_quality',    icon: '✅', title: 'جودة التسليم والمرتجعات',              priority: 'حرج', desc: 'تأخّر التسليم يفقد العميل — إعادة الشحن تأكل الهوامش' },
    { id: 'log_suppliers',  icon: '📦', title: 'إدارة الموردين وسلسلة القيمة',        priority: 'مهم', desc: 'الاعتماد على مورد نقل واحد = مخاطرة استمرارية أعمال' },
    { id: 'log_freetext',   icon: '✍️', title: 'التحقق والإغلاق',                     priority: 'عادي', desc: 'سؤال مفتوح لتوثيق تحديات اللوجستيات' },
  ],
  questions: [
    { type: 'radio',    sectionId: 'log_capacity', id: 'log_capacity_util',   label: 'ما نسبة استغلال طاقتكم اللوجستية؟',                             opts: ['70-85% (مثالي)', 'أقل من 50% (هدر)', 'أكثر من 95% (ضغط)'] },
    { type: 'radio',    sectionId: 'log_capacity', id: 'log_bottlenecks',    label: 'هل تعرف أين توجد الاختناقات في سلاسل التوريد؟',                  opts: ['نعم — محددة ونعمل على حلها', 'نعرفها تقريباً', 'لا نعلم'] },
    { type: 'radio',    sectionId: 'log_capacity', id: 'log_forecasting',    label: 'هل تتنبأ بحجم الطلب لتخطيط اللوجستيات؟',                          opts: ['نعم — نموذج تنبؤ', 'تخمين', 'لا'] },

    { type: 'radio',    sectionId: 'log_operations', id: 'log_sops',        label: 'هل إجراءات الشحن والتخزين موثقة؟',                                opts: ['نعم — 100% موثقة', 'بعضها', 'شفهي'] },
    { type: 'radio',    sectionId: 'log_operations', id: 'log_automation',  label: 'ما مستوى أتمتة العمليات اللوجستية؟',                             opts: ['عالي — WMS + TMS متكامل', 'متوسط', 'يدوي مكثف'] },
    { type: 'radio',    sectionId: 'log_operations', id: 'log_tracking',    label: 'هل توفر تتبع مباشر للشحنات (Real-time Tracking)؟',                opts: ['نعم — كل شحنة', 'شحنات مختارة', 'لا'] },

    { type: 'radio',    sectionId: 'log_quality', id: 'otif',                label: 'ما معدل التسليم في الوقت وبالكامل (OTIF)?',                       opts: ['95%+', '85-95%', '70-85%', 'أقل من 70%', 'لا نقيس'] },
    { type: 'radio',    sectionId: 'log_quality', id: 'log_returns',         label: 'ما نسبة المرتجعات بسبب أخطاء لوجستية؟',                          opts: ['أقل من 2%', '2-5%', 'أكثر من 5%', 'لا نقيس'] },
    { type: 'radio',    sectionId: 'log_quality', id: 'log_damage',          label: 'ما نسبة الشحنات المتضررة أو المفقودة؟',                          opts: ['أقل من 1%', '1-3%', 'أكثر من 3%', 'لا نقيس'] },

    { type: 'radio',    sectionId: 'log_suppliers', id: 'log_carriers',      label: 'كم شركة نقل تتعامل معها؟',                                       opts: ['3+ (متنوع)', '2 (احتياطي)', '1 (خطر)'] },
    { type: 'radio',    sectionId: 'log_suppliers', id: 'log_inventory',     label: 'كيف تدير مستوى المخزون في المستودعات؟',                          opts: ['JIT + نظام آلي', 'مراجعة دورية', 'يدوي'] },
    { type: 'radio',    sectionId: 'log_suppliers', id: 'log_kpi_cost',      label: 'هل تعرف تكلفة النقل لكل طلبية؟',                                 opts: ['نعم — بدقة', 'تقريباً', 'لا'] },

    { type: 'textarea', sectionId: 'log_freetext', id: 'logistics_free',     label: 'ما أكبر تحدٍّ لوجستي يواجهك الآن؟',                              placeholder: 'مثال: تأخر الموردين، تكلفة الشحن، أخطاء المخزون، تلف الشحنات...' },
  ],
}

// ─── GOVERNANCE — الحوكمة (مُكيّفة من COMPLIANCE) ──────────────────────
// المصدر: تكييف مركّز على مجلس الإدارة والحوكمة المؤسسية (بدل الامتثال التنظيمي).

const GOVERNANCE: DeptQuestions = {
  sections: [
    { id: 'gov_board',      icon: '🏛️', title: 'مجلس الإدارة وتشكيلته',              priority: 'حرج', desc: 'مجلس فعّال = قرارات صحيحة. مجلس شكلي = مخاطر خفية' },
    { id: 'gov_policies',   icon: '📋', title: 'السياسات والميثاق',                   priority: 'حرج', desc: 'ميثاق الحوكمة يُحدّد قواعد اللعبة — بدونه تعارضات قرارات' },
    { id: 'gov_risk',       icon: '⚠️', title: 'إدارة المخاطر المؤسسية',              priority: 'حرج', desc: 'الشركات بلا سجل مخاطر تُفاجَأ بأزمات كان يمكن تجنّبها' },
    { id: 'gov_committees', icon: '👥', title: 'اللجان المتخصّصة',                     priority: 'مهم', desc: 'لجنة تدقيق ولجنة ترشيحات = رقابة داخلية فعّالة' },
    { id: 'gov_transparency', icon: '🔍', title: 'الشفافية والإفصاح',                 priority: 'مهم', desc: 'الشفافية تبني ثقة المستثمرين وأصحاب المصلحة' },
    { id: 'gov_freetext',    icon: '✍️', title: 'التحقق والإغلاق',                    priority: 'عادي', desc: 'ما التحدي الأكبر في حوكمة شركتك؟' },
  ],
  questions: [
    { type: 'radio',    sectionId: 'gov_board', id: 'board_exists',         label: 'هل لديك مجلس إدارة رسمي؟',                                       opts: ['نعم — مع أعضاء مستقلين', 'رسمي بلا مستقلين', 'شكلي فقط', 'لا يوجد'] },
    { type: 'radio',    sectionId: 'gov_board', id: 'board_meetings',       label: 'كم مرة يجتمع مجلس الإدارة؟',                                     opts: ['ربع سنوياً+', 'نصف سنوي', 'سنوياً', 'لا اجتماعات دورية'] },
    { type: 'radio',    sectionId: 'gov_board', id: 'board_independence',   label: 'ما نسبة الأعضاء المستقلين في المجلس؟',                             opts: ['أكثر من 50%', '25-50%', 'أقل من 25%', 'لا يوجد مستقلون'] },
    { type: 'radio',    sectionId: 'gov_board', id: 'ceo_chairman_split',   label: 'هل الفصل بين الرئيس التنفيذي ورئيس المجلس مطبّق؟',                  opts: ['نعم — منفصلان', 'أحياناً', 'لا — نفس الشخص'] },

    { type: 'radio',    sectionId: 'gov_policies', id: 'gov_charter',         label: 'هل لديك ميثاق حوكمة معتمد؟',                                    opts: ['نعم — محدّث ومعتمد', 'موجود قديم', 'لا'] },
    { type: 'radio',    sectionId: 'gov_policies', id: 'delegation_matrix',   label: 'هل مصفوفة الصلاحيات موثّقة؟',                                    opts: ['نعم — بحدود واضحة', 'شفهية', 'لا'] },
    { type: 'radio',    sectionId: 'gov_policies', id: 'gov_review_cycle',    label: 'كم مرة تُراجَع سياسات الحوكمة؟',                                 opts: ['سنوياً', 'كل سنتين', 'عند الحاجة', 'لم تُراجَع'] },

    { type: 'radio',    sectionId: 'gov_risk', id: 'risk_register_gov',     label: 'هل لديك سجل مخاطر مؤسسي (Enterprise Risk Register)؟',              opts: ['نعم — محدّث بانتظام', 'موجود قديم', 'لا'] },
    { type: 'radio',    sectionId: 'gov_risk', id: 'risk_committee',        label: 'هل لديك لجنة أو مسؤول مخاطر؟',                                     opts: ['نعم — لجنة رسمية', 'مسؤول جزئي', 'لا'] },
    { type: 'radio',    sectionId: 'gov_risk', id: 'risk_appetite',         label: 'هل حدّدتم "شهية المخاطر" (Risk Appetite) للمؤسسة؟',               opts: ['نعم — موثّقة', 'ضمنياً', 'لا'] },

    { type: 'checkbox', sectionId: 'gov_committees', id: 'committees_list', label: 'ما اللجان المنبثقة عن المجلس؟',                                    opts: ['لجنة التدقيق', 'لجنة الترشيحات والمكافآت', 'لجنة المخاطر', 'لجنة الاستثمار', 'لا لجان متخصصة'] },
    { type: 'radio',    sectionId: 'gov_committees', id: 'audit_committee', label: 'هل لجنة التدقيق مستقلة وفعّالة؟',                                 opts: ['نعم — أعضاء مستقلون', 'موجودة لكن غير مستقلة', 'لا'] },

    { type: 'radio',    sectionId: 'gov_transparency', id: 'annual_report',    label: 'هل تُصدر تقريراً سنوياً شفافاً؟',                              opts: ['نعم — منشور علناً', 'تقرير داخلي فقط', 'لا'] },
    { type: 'radio',    sectionId: 'gov_transparency', id: 'related_party',    label: 'كيف تدير معاملات الأطراف ذات العلاقة؟',                        opts: ['شفافية كاملة + إفصاح', 'إفصاح جزئي', 'غير موثّقة'] },
    { type: 'radio',    sectionId: 'gov_transparency', id: 'stakeholder_comm', label: 'هل تتواصل بانتظام مع أصحاب المصلحة؟',                          opts: ['نعم — قنوات رسمية', 'أحياناً', 'لا'] },

    { type: 'textarea', sectionId: 'gov_freetext', id: 'governance_free',      label: 'ما أكبر تحدٍّ في حوكمة الشركة الآن؟',                          placeholder: 'مثال: مجلس شكلي، تعارض مصالح، غياب لجان، ضعف الرقابة الداخلية...' },
  ],
}

export const DEPT_QUESTIONS: Partial<Record<DeptCode, DeptQuestions>> = {
  HR,
  FINANCE,
  SALES,
  MARKETING,
  OPERATIONS,
  IT,
  CUSTOMER_SERVICE,
  QUALITY,
  SUPPORT,
  PROJECTS,
  COMPLIANCE,
  LOGISTICS,
  GOVERNANCE,
}
