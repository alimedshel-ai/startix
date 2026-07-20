// ─── إعداد تقييم نضج الموارد البشريّة (config على الإطار المعمّم) ─────
// ١٠ أقسام × ١٠ أسئلة مُنقّطة (٠-١٠). يُستهلك عبر maturityEngine.
// منقول من ملف المستخدم (محرّك نضج HR).
import type { MaturityConfig, MaturityOption, MaturityQuestion, MaturitySection } from '@/lib/maturityEngine'

// ─── مجموعات خيارات شائعة ─────────────────────────────────────────
const YPN: MaturityOption[] = [{ label: 'نعم', points: 10 }, { label: 'جزئياً', points: 5 }, { label: 'لا', points: 0 }]
const YN: MaturityOption[]  = [{ label: 'نعم', points: 10 }, { label: 'لا', points: 0 }]
/** المرتفع جيّد. */
const HIGH_GOOD: MaturityOption[] = [{ label: 'مرتفع', points: 10 }, { label: 'متوسط', points: 5 }, { label: 'منخفض', points: 0 }]
/** المنخفض جيّد. */
const LOW_GOOD: MaturityOption[]  = [{ label: 'منخفض', points: 10 }, { label: 'متوسط', points: 5 }, { label: 'مرتفع', points: 0 }]

const q = (id: string, text: string, options: MaturityOption[] = YPN): MaturityQuestion => ({ id, text, options })

const HR_SECTIONS: MaturitySection[] = [
  {
    key: 'staff', labelAr: 'شؤون الموظفين', icon: '🗂️',
    recommendation: 'رقمنة العقود والإجازات + سياسة انضباط مكتوبة + تقليل الشكاوى العالقة.',
    questions: [
      q('staff_1', 'هل عقود الموظفين موثّقة ومسجّلة رقمياً؟'),
      q('staff_2', 'هل تنويع أنواع العقود (دائم/مؤقت/شهري) مُدار بوضوح؟'),
      q('staff_3', 'هل توجد سياسة واضحة لمدد العقود وتجديدها؟'),
      q('staff_4', 'مستوى الشكاوى العمّاليّة المفتوحة؟', LOW_GOOD),
      q('staff_5', 'هل الإنذارات موثّقة بإجراءات عادلة؟'),
      q('staff_6', 'معدّل الإجازات المرضيّة الشهري؟', LOW_GOOD),
      q('staff_7', 'مستوى الغياب غير المبرّر (ومتابعته)؟', LOW_GOOD),
      q('staff_8', 'هل يوجد نظام إجازات رقمي؟', YN),
      q('staff_9', 'سرعة الرد على طلبات الموظفين؟', HIGH_GOOD),
      q('staff_10', 'هل توجد سياسة انضباط مكتوبة ومطبّقة؟'),
    ],
  },
  {
    key: 'recruit', labelAr: 'التوظيف', icon: '🎯',
    recommendation: 'onboarding منظّم + خفض وقت شغل الوظيفة + قاعدة مرشّحين + علامة صاحب عمل.',
    questions: [
      q('recruit_1', 'هل الوظائف الشاغرة مُغطّاة بخطّة استقطاب؟'),
      q('recruit_2', 'متوسّط وقت شغل الوظيفة؟', LOW_GOOD),
      q('recruit_3', 'هل مصادر التوظيف متنوّعة؟'),
      q('recruit_4', 'هل تكلفة التوظيف للفرد مُقاسة ومضبوطة؟'),
      q('recruit_5', 'نسبة نجاح التعيينات خلال ٣ أشهر؟', HIGH_GOOD),
      q('recruit_6', 'هل يوجد onboarding منظّم؟'),
      q('recruit_7', 'هل مدّة onboarding محدّدة ومنهجيّة؟'),
      q('recruit_8', 'هل توجد قاعدة بيانات مرشّحين؟', YN),
      q('recruit_9', 'نسبة التوظيف الداخلي (ترقيات)؟', HIGH_GOOD),
      q('recruit_10', 'هل توجد علامة صاحب عمل (Employer Brand)؟'),
    ],
  },
  {
    key: 'training', labelAr: 'التدريب والتطوير', icon: '📚',
    recommendation: 'خطّة تدريب سنويّة مبنيّة على احتياج + قياس أثر التدريب + mentorship + ميزانيّة شهادات.',
    questions: [
      q('training_1', 'هل توجد ميزانيّة تدريب سنويّة كافية؟'),
      q('training_2', 'متوسّط ساعات التدريب لكل موظّف سنوياً؟', HIGH_GOOD),
      q('training_3', 'هل توجد خطّة تدريب سنويّة؟'),
      q('training_4', 'هل تُحدَّد احتياجات التدريب منهجياً (تحليل فجوات)؟'),
      q('training_5', 'هل يُغطّى التدريب الإلزامي بالكامل؟'),
      q('training_6', 'هل يوجد تدريب تقني كافٍ للأدوار؟'),
      q('training_7', 'هل يوجد تدريب إشرافي/قيادي؟'),
      q('training_8', 'هل يُقاس أثر التدريب على الأداء؟'),
      q('training_9', 'هل يوجد برنامج mentorship؟'),
      q('training_10', 'هل توجد ميزانيّة للشهادات المهنيّة؟'),
    ],
  },
  {
    key: 'comp', labelAr: 'الرواتب والمزايا', icon: '💰',
    recommendation: 'هيكل رواتب واضح مقارن بالسوق + حوافز أداء + ربط الراتب بالتقييم + مراجعة سنويّة.',
    questions: [
      q('comp_1', 'هل يوجد هيكل رواتب واضح ومعتمد؟'),
      q('comp_2', 'هل الفئات الراتبيّة محدّدة بوضوح؟'),
      q('comp_3', 'فجوة الرواتب مقارنةً بالسوق؟', LOW_GOOD),
      q('comp_4', 'هل توجد حوافز أداء؟'),
      q('comp_5', 'هل توجد حوافز/مكافآت سنويّة؟'),
      q('comp_6', 'هل توجد مزايا طويلة الأجل (أسهم/ادّخار)؟', YN),
      q('comp_7', 'هل نسبة الرواتب من التكلفة مضبوطة؟'),
      q('comp_8', 'هل الراتب مرتبط بنظام تقييم أداء؟'),
      q('comp_9', 'هل توجد مراجعة سنويّة للرواتب؟'),
      q('comp_10', 'هل تُطبَّق سريّة الرواتب؟', YN),
    ],
  },
  {
    key: 'compliance', labelAr: 'الامتثال والقانون', icon: '⚖️',
    recommendation: 'رفع السعودة + متابعة انتهاء الإقامات + إغلاق الشكاوى القانونيّة + سياسات مكافحة التحرّش والتنوّع.',
    questions: [
      q('compliance_1', 'مستوى السعودة الكلّي مقابل المستهدف؟', HIGH_GOOD),
      q('compliance_2', 'هل السعودة متوازنة عبر الأقسام؟'),
      q('compliance_3', 'حجم الإقامات المنتهية خلال ٦ أشهر؟', LOW_GOOD),
      q('compliance_4', 'هل كل العقود مسجّلة في التأمينات؟', YN),
      q('compliance_5', 'هل العقود المؤقّتة ضمن المدد النظاميّة؟'),
      q('compliance_6', 'حجم الشكاوى القانونيّة المفتوحة؟', LOW_GOOD),
      q('compliance_7', 'حجم التحقيقات الداخليّة العالقة؟', LOW_GOOD),
      q('compliance_8', 'هل ساعات العمل ضمن النظام؟'),
      q('compliance_9', 'هل توجد سياسة مكافحة تحرّش؟', YN),
      q('compliance_10', 'هل توجد سياسة تنوّع وشمول؟', YN),
    ],
  },
  {
    key: 'systems', labelAr: 'الأنظمة والتقنية', icon: '🖥️',
    recommendation: 'نظام HR رقمي متكامل + رواتب آليّة + self-service + dashboard إداري + تكامل مع البنك/التأمينات.',
    questions: [
      q('systems_1', 'هل يوجد نظام HR رقمي؟', YN),
      q('systems_2', 'هل يوجد نظام حضور/انصراف؟', YN),
      q('systems_3', 'هل يوجد نظام إجازات رقمي؟', YN),
      q('systems_4', 'هل يوجد نظام رواتب آلي؟', YN),
      q('systems_5', 'هل يوجد Self-Service للموظّف؟', YN),
      q('systems_6', 'هل تُنتَج تقارير HR تلقائياً؟'),
      q('systems_7', 'هل البيانات مركزيّة (لا متفرّقة)؟'),
      q('systems_8', 'هل توجد نُسَخ احتياطيّة دوريّة؟', YN),
      q('systems_9', 'هل يوجد تكامل مع البنك/التأمينات (API)؟', YN),
      q('systems_10', 'هل يوجد dashboard إداري للمؤشّرات؟', YN),
    ],
  },
  {
    key: 'safety', labelAr: 'الصحة والسلامة', icon: '⛑️',
    recommendation: 'خفض حوادث العمل + PPE للجميع + فحص طبي دوري + لجنة سلامة + تدريب إسعافات.',
    questions: [
      q('safety_1', 'عدد حوادث العمل سنوياً؟', LOW_GOOD),
      q('safety_2', 'أيّام العمل المفقودة بسبب الحوادث؟', LOW_GOOD),
      q('safety_3', 'نسبة شهادات السلامة السارية؟', HIGH_GOOD),
      q('safety_4', 'هل PPE متوفّر لكل العاملين؟'),
      q('safety_5', 'هل يوجد فحص طبي دوري؟'),
      q('safety_6', 'هل يوجد تأمين حوادث عمل؟', YN),
      q('safety_7', 'هل توجد لجنة سلامة؟', YN),
      q('safety_8', 'هل توجد تقارير حوادث شهريّة؟'),
      q('safety_9', 'هل يوجد تدريب إسعافات أوّليّة؟'),
      q('safety_10', 'هل توجد سياسة عمل آمن مكتوبة؟'),
    ],
  },
  {
    key: 'planning', labelAr: 'التخطيط والإحلال', icon: '📈',
    recommendation: 'خطّة قوى عاملة + خطّة إحلال (succession) للقيادات + تحليل فجوات المهارات + workforce analytics.',
    questions: [
      q('planning_1', 'هل توجد خطّة قوى عاملة (٣ سنوات)؟'),
      q('planning_2', 'هل توجد خطّة توطين واضحة؟'),
      q('planning_3', 'هل توجد خطّة إحلال (Succession)؟'),
      q('planning_4', 'حجم المناصب القياديّة بلا خليفة؟', LOW_GOOD),
      q('planning_5', 'هل يوجد تخطيط موسمي للقوى العاملة؟'),
      q('planning_6', 'هل يوجد تحليل عمر القوى العاملة؟'),
      q('planning_7', 'هل يوجد تحليل فجوات المهارات؟'),
      q('planning_8', 'هل توجد خطّة لإعادة الهيكلة عند الحاجة؟'),
      q('planning_9', 'هل يُحسب تحليل تكلفة الاستبدال؟'),
      q('planning_10', 'هل يوجد Workforce Analytics؟'),
    ],
  },
  {
    key: 'culture', labelAr: 'الثقافة والانخراط', icon: '🤝',
    recommendation: 'استبيان رضا دوري + برنامج تقدير (Recognition) + صحّة نفسيّة + exit interview منظّم.',
    questions: [
      q('culture_1', 'هل يوجد استبيان رضا سنوي؟'),
      q('culture_2', 'مستوى رضا الموظفين (eNPS)؟', HIGH_GOOD),
      q('culture_3', 'هل توجد فعاليّات موظفين؟'),
      q('culture_4', 'هل يوجد برنامج تقدير (Recognition)؟'),
      q('culture_5', 'هل يوجد برنامج صحّة نفسيّة؟', YN),
      q('culture_6', 'هل توجد قنوات تواصل داخليّة فعّالة؟'),
      q('culture_7', 'هل يوجد فريق/مبادرة تنوّع وشمول؟', YN),
      q('culture_8', 'هل يوجد برنامج مسؤوليّة اجتماعيّة للموظفين؟', YN),
      q('culture_9', 'هل تُوثَّق قصص نجاح الموظفين؟', YN),
      q('culture_10', 'هل يوجد Exit Interview منظّم؟'),
    ],
  },
  {
    key: 'performance', labelAr: 'الأداء والمواهب', icon: '🌟',
    recommendation: 'نظام تقييم مرتبط بالراتب + KPIs لكل موظّف + مسارات وظيفيّة + خطط تطوير فرديّة (IDP).',
    questions: [
      q('performance_1', 'هل يوجد نظام تقييم أداء؟', YN),
      q('performance_2', 'تكرار التقييم (سنوي/دوري)؟', HIGH_GOOD),
      q('performance_3', 'هل التقييم مرتبط بالراتب/الحوافز؟'),
      q('performance_4', 'هل توجد KPIs واضحة لكل موظّف؟'),
      q('performance_5', 'هل توجد مسارات وظيفيّة واضحة؟'),
      q('performance_6', 'هل يوجد 9-Box لتصنيف المواهب؟', YN),
      q('performance_7', 'هل توجد خطط تطوير فرديّة (IDP)؟'),
      q('performance_8', 'هل يوجد تقييم ٣٦٠ درجة؟', YN),
      q('performance_9', 'هل يوجد نظام Feedback مستمر؟'),
      q('performance_10', 'هل توجد حوافز للأداء المتميّز؟'),
    ],
  },
]

const HR_LEVELS = [
  { key: 'weak',       minPct: 0,  emoji: '🔴', labelAr: 'ضعيف',   cls: 'border-rose-300 bg-rose-50/60 text-rose-800' },
  { key: 'emerging',   minPct: 40, emoji: '🟠', labelAr: 'ناشئ',   cls: 'border-orange-300 bg-orange-50/60 text-orange-800' },
  { key: 'developing', minPct: 60, emoji: '🟡', labelAr: 'متوسّط', cls: 'border-amber-300 bg-amber-50/60 text-amber-800' },
  { key: 'advanced',   minPct: 75, emoji: '🟢', labelAr: 'متقدّم', cls: 'border-emerald-300 bg-emerald-50/60 text-emerald-800' },
]

export const HR_CONFIG: MaturityConfig = {
  specialty: 'HR',
  titleAr: 'تقييم نضج الموارد البشريّة',
  descAr: '١٠ أقسام × ١٠ أسئلة → نضج لكل قسم + توصيات الأولويّة.',
  draftKey: 'startix-hr-maturity',
  sections: HR_SECTIONS,
  levels: HR_LEVELS,
}
