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

// ─── الخريطة الكاملة ─────────────────────────────────────────────────────
// كل إدارة تُلحق بها في commit مستقل (الأمر ٢: FINANCE، الأمر ٣: SALES…).
// المستهلكون يجب أن يتعاملوا مع الإدارات غير المُنقولة بعد بتحقّق حرصي.
export const DEPT_QUESTIONS: Partial<Record<DeptCode, DeptQuestions>> = {
  HR,
}
