// ─── سلاسل قيمة مخصّصة لكل إدارة ─────────────────────────────────
// المدير المستقل يعمل على إدارة واحدة داخل شركة العميل. السلسلة الكلاسيكية
// (Porter) على مستوى شركة كاملة لا تُناسب مديراً واحداً — كل إدارة لها
// أنشطة قيمة داخلية مختلفة. هذا الملف يعرّف الأنشطة لكل من ١٣ إدارة، مع
// قوالب نضج (٣ مستويات: أساسي/متوسّط/متقدّم) تُضبط النص والدرجة بضغطة.
//
// الاستهلاك: ValueChainPage يقرأ user.specialtyDeptType؛ لو INDEPENDENT_PRO
// مع تخصّص → يستخدم DEPT_VALUE_CHAIN[specialty] ويحفظ كـ VALUE_CHAIN_<DEPT>.

import type { DeptCode } from './deptApi'

export interface ActivityDef {
  key: string
  labelAr: string
  icon: string
  desc: string
  templates: { text: string; rating: 1 | 2 | 3 | 4 | 5 }[]
}

export interface DeptValueChainConfig {
  core: ActivityDef[]      // أنشطة القيمة الأساسية للإدارة
  enablers: ActivityDef[]  // أنشطة داعمة/مُمكِّنة
}

export const DEPT_VALUE_CHAIN: Partial<Record<DeptCode, DeptValueChainConfig>> = {
  HR: {
    core: [
      { key: 'workforce_planning', labelAr: 'تخطيط القوى العاملة', icon: '📋', desc: 'توقّع الاحتياجات وربطها بالاستراتيجية.',
        templates: [
          { text: 'توظيف تفاعلي حسب الحاجة، بلا خطة.', rating: 1 },
          { text: 'خطة سنوية مرتبطة بالأقسام.', rating: 3 },
          { text: 'تخطيط ديناميكي مبني على السيناريوهات مع مؤشرات إنذار مبكر.', rating: 5 },
        ]},
      { key: 'talent_acquisition', labelAr: 'استقطاب المواهب', icon: '🎯', desc: 'المصادر، التقييم، والقرار.',
        templates: [
          { text: 'إعلانات وقنوات محدودة، مقابلات غير موحّدة.', rating: 1 },
          { text: 'قنوات متعدّدة + مقابلات مهيكلة + اختبار عملي.', rating: 3 },
          { text: 'استهداف مستمر + Assessment Center + تجربة مرشّح ممتازة.', rating: 5 },
        ]},
      { key: 'onboarding_dev',     labelAr: 'التهيئة والتطوير', icon: '📚', desc: 'من الالتحاق حتى التمكّن الوظيفي.',
        templates: [
          { text: 'تعريف يومي واحد ثم يتعلّم الموظف بنفسه.', rating: 1 },
          { text: 'برنامج ٣٠/٦٠/٩٠ يوم + خطة تدريب فردية.', rating: 3 },
          { text: 'مسارات مسبقة الإعداد + Mentoring + مؤشرات جاهزية.', rating: 5 },
        ]},
      { key: 'performance_mgmt',   labelAr: 'إدارة الأداء', icon: '📊', desc: 'وضع الأهداف، القياس، المكافأة.',
        templates: [
          { text: 'تقييم سنوي عام بلا أهداف محدّدة.', rating: 1 },
          { text: 'أهداف ربعية + تقييم دوري + خطة تحسين.', rating: 3 },
          { text: 'OKRs مستمرة + Feedback فوري + مكافآت ديناميكية.', rating: 5 },
        ]},
    ],
    enablers: [
      { key: 'hr_policies', labelAr: 'السياسات والامتثال', icon: '📜', desc: 'لوائح توظيف/إجازات/إنهاء + نظام العمل.',
        templates: [
          { text: 'سياسات شفهية أو ناقصة.', rating: 1 },
          { text: 'سياسات مكتوبة معتمدة + تحديث سنوي.', rating: 3 },
          { text: 'سياسات رقمية + توقيع إلكتروني + مراجعة قانونية دورية.', rating: 5 },
        ]},
      { key: 'hris', labelAr: 'نظام HR الرقمي', icon: '💻', desc: 'HRIS/HCM للتوظيف/الرواتب/الأداء.',
        templates: [
          { text: 'جداول Excel ومستندات ورقية.', rating: 1 },
          { text: 'نظام HRIS أساسي مع الرواتب والحضور.', rating: 3 },
          { text: 'HCM متكامل + تحليلات + Self-service للموظف.', rating: 5 },
        ]},
      { key: 'compensation', labelAr: 'التعويضات والمزايا', icon: '💵', desc: 'سلم رواتب، بدلات، مكافآت.',
        templates: [
          { text: 'رواتب متفاوتة بلا سلم واضح.', rating: 1 },
          { text: 'سلم رواتب معتمد + بدلات موثّقة.', rating: 3 },
          { text: 'Total Rewards + مقارنة مرجعية + مرونة اختيار.', rating: 5 },
        ]},
    ],
  },

  FINANCE: {
    core: [
      { key: 'transactions', labelAr: 'تسجيل المعاملات', icon: '📝', desc: 'قيود يومية، تسويات، حسابات ذمم.',
        templates: [
          { text: 'قيود يدوية على Excel، تأخير كبير.', rating: 1 },
          { text: 'نظام محاسبي أساسي + تسجيل شبه فوري.', rating: 3 },
          { text: 'قيود آلية + تكامل مع البنوك والفواتير + قواعد ذكية.', rating: 5 },
        ]},
      { key: 'reporting', labelAr: 'التقارير المالية', icon: '📊', desc: 'قوائم دخل، مركز، تدفقات، لوحات.',
        templates: [
          { text: 'قوائم سنوية فقط بلا تحليل.', rating: 1 },
          { text: 'قوائم شهرية + IFRS + إغلاق < 10 أيام.', rating: 3 },
          { text: 'إقفال < ٥ أيام + لوحات BI مباشرة + تنبيهات.', rating: 5 },
        ]},
      { key: 'budgeting', labelAr: 'الموازنة والتنبّؤ', icon: '🎯', desc: 'إعداد الميزانية، التنبؤ، تحليل الفروقات.',
        templates: [
          { text: 'ميزانية سنوية جامدة بلا مراجعة.', rating: 1 },
          { text: 'ميزانية سنوية + مراجعة ربعية + تحليل انحرافات.', rating: 3 },
          { text: 'Rolling Forecast + سيناريوهات + Driver-based.', rating: 5 },
        ]},
      { key: 'treasury', labelAr: 'الخزينة والسيولة', icon: '🏦', desc: 'إدارة النقد، البنوك، التحصيل والدفع.',
        templates: [
          { text: 'صرف يومي عشوائي، لا تنبؤ نقدي.', rating: 1 },
          { text: 'خطة نقد شهرية + مراقبة يومية.', rating: 3 },
          { text: 'Cash pooling + تنبؤ ١٣ أسبوع + Hedging.', rating: 5 },
        ]},
    ],
    enablers: [
      { key: 'controls', labelAr: 'الرقابة الداخلية', icon: '🛡️', desc: 'مصفوفة صلاحيات، فصل الواجبات، تدقيق.',
        templates: [
          { text: 'شخص واحد يتحكّم بكل شيء.', rating: 1 },
          { text: 'مصفوفة صلاحيات + فصل واجبات + تدقيق داخلي.', rating: 3 },
          { text: 'SOX-like framework + رقابة آلية + تدقيق مستقل.', rating: 5 },
        ]},
      { key: 'fin_systems', labelAr: 'الأنظمة المالية', icon: '💻', desc: 'ERP، أنظمة الدفع، تكامل.',
        templates: [
          { text: 'أدوات منفصلة بلا تكامل.', rating: 1 },
          { text: 'ERP جاهز + تكامل مع البنك.', rating: 3 },
          { text: 'ERP سحابي + API مع كل المنظومة + BI مباشر.', rating: 5 },
        ]},
      { key: 'tax_compliance', labelAr: 'الضرائب والامتثال', icon: '⚖️', desc: 'ZATCA، الزكاة، المعايير، الإفصاح.',
        templates: [
          { text: 'التزام رد الفعل، تأخير في الإقرارات.', rating: 1 },
          { text: 'التزام في الموعد + مراجعة قانونية دورية.', rating: 3 },
          { text: 'تحديث استباقي + استشارة متخصّصة + أتمتة الإقرارات.', rating: 5 },
        ]},
    ],
  },

  SALES: {
    core: [
      { key: 'lead_gen', labelAr: 'توليد العملاء المحتملين', icon: '🎯', desc: 'المصادر، القنوات، الحملات.',
        templates: [
          { text: 'اعتماد على العلاقات الشخصية فقط.', rating: 1 },
          { text: 'قنوات رقمية + شبكة موزّعين + معارض.', rating: 3 },
          { text: 'توليد آلي متعدّد القنوات + AI targeting.', rating: 5 },
        ]},
      { key: 'qualification', labelAr: 'تأهيل الفرص', icon: '🔍', desc: 'BANT/MEDDIC، فحص الملاءمة.',
        templates: [
          { text: 'كل عميل محتمل يدخل الأنبوب بلا فحص.', rating: 1 },
          { text: 'معايير BANT + مراجعة أسبوعية.', rating: 3 },
          { text: 'AI-scoring + MEDDIC + احتمال إغلاق دقيق.', rating: 5 },
        ]},
      { key: 'sales_exec', labelAr: 'تنفيذ البيع', icon: '💼', desc: 'العروض، المفاوضة، الإغلاق.',
        templates: [
          { text: 'كل مندوب يعمل بأسلوبه.', rating: 1 },
          { text: 'قصص نجاح + Playbook + مراحل موحّدة.', rating: 3 },
          { text: 'مبيعات استشارية + Value Selling + سيناريوهات محاكاة.', rating: 5 },
        ]},
      { key: 'account_mgmt', labelAr: 'إدارة الحسابات', icon: '🤝', desc: 'المحافظة والنمو داخل العميل.',
        templates: [
          { text: 'بعد البيع تنقطع العلاقة.', rating: 1 },
          { text: 'مقابلات دورية + خطة حساب سنوية.', rating: 3 },
          { text: 'Customer Success + خطط نمو + تحليل صحّة العميل.', rating: 5 },
        ]},
    ],
    enablers: [
      { key: 'crm', labelAr: 'CRM والأدوات', icon: '💻', desc: 'إدارة العلاقة، الأنبوب، التقارير.',
        templates: [
          { text: 'جداول Excel أو ملاحظات ورقية.', rating: 1 },
          { text: 'CRM جاهز مع لوحات وتقارير.', rating: 3 },
          { text: 'CRM متكامل + أتمتة + AI insights.', rating: 5 },
        ]},
      { key: 'enablement', labelAr: 'تمكين المبيعات', icon: '📚', desc: 'محتوى، تدريب، Coaching.',
        templates: [
          { text: 'بلا مواد بيع أو تدريب رسمي.', rating: 1 },
          { text: 'مكتبة محتوى + تدريب دوري.', rating: 3 },
          { text: 'Sales Academy + Coaching فردي + سيناريوهات محاكاة.', rating: 5 },
        ]},
      { key: 'rev_ops', labelAr: 'عمليات الإيراد', icon: '📊', desc: 'التنبّؤ، التحليلات، المكافآت.',
        templates: [
          { text: 'تنبؤ حدسي، عمولات غير واضحة.', rating: 1 },
          { text: 'تنبؤ شهري + سياسة عمولات موثّقة.', rating: 3 },
          { text: 'RevOps متكاملة + تنبؤ AI + عمولات ديناميكية.', rating: 5 },
        ]},
    ],
  },

  MARKETING: {
    core: [
      { key: 'research', labelAr: 'أبحاث السوق', icon: '🔍', desc: 'العميل، المنافس، الاتجاهات.',
        templates: [
          { text: 'بلا أبحاث — كل شيء بالحدس.', rating: 1 },
          { text: 'استبيانات دورية + رصد منافس أساسي.', rating: 3 },
          { text: 'Social listening + Persona-Based + بيانات ضخمة.', rating: 5 },
        ]},
      { key: 'strategy', labelAr: 'الاستراتيجية والحملات', icon: '🎯', desc: 'التموضع، الرسالة، الخطة.',
        templates: [
          { text: 'حملات عشوائية بلا استراتيجية.', rating: 1 },
          { text: 'خطة سنوية + Positioning + جدول حملات.', rating: 3 },
          { text: 'استراتيجية Data-Driven + Test & Learn + قابلة للتحديث.', rating: 5 },
        ]},
      { key: 'content', labelAr: 'إنتاج المحتوى', icon: '🎨', desc: 'كتابة، تصميم، فيديو.',
        templates: [
          { text: 'محتوى غير منتظم بجودة متذبذبة.', rating: 1 },
          { text: 'خطة محتوى شهرية + دليل هوية.', rating: 3 },
          { text: 'Content Factory + AI-assisted + تحليل أداء لحظي.', rating: 5 },
        ]},
      { key: 'distribution', labelAr: 'التوزيع والقنوات', icon: '📣', desc: 'رقمي، تقليدي، شراكات.',
        templates: [
          { text: 'قناة واحدة أو قنوات مبعثرة.', rating: 1 },
          { text: 'قنوات مختارة + توقيت مدروس.', rating: 3 },
          { text: 'Omnichannel + تكامل + أتمتة توزيع.', rating: 5 },
        ]},
    ],
    enablers: [
      { key: 'brand', labelAr: 'العلامة والهوية', icon: '🏷️', desc: 'دليل الهوية، القيم، الأصول.',
        templates: [
          { text: 'شعار فقط بلا دليل هوية.', rating: 1 },
          { text: 'دليل هوية متكامل + قصة العلامة.', rating: 3 },
          { text: 'حوكمة علامة + قياس Brand Health دوري.', rating: 5 },
        ]},
      { key: 'martech', labelAr: 'التقنية التسويقية', icon: '💻', desc: 'أتمتة، تحليلات، CDP.',
        templates: [
          { text: 'أدوات مبعثرة أو Google Analytics فقط.', rating: 1 },
          { text: 'CRM + Email + Analytics + Ads Manager.', rating: 3 },
          { text: 'MarTech Stack كامل + CDP + AI attribution.', rating: 5 },
        ]},
      { key: 'analytics', labelAr: 'قياس الأداء', icon: '📊', desc: 'ROI، ROAS، Funnel.',
        templates: [
          { text: 'قياس ناقص أو غائب.', rating: 1 },
          { text: 'تقارير شهرية + ROI للحملات.', rating: 3 },
          { text: 'Attribution متعدّد اللمس + Dashboards حية.', rating: 5 },
        ]},
    ],
  },

  OPERATIONS: {
    core: [
      { key: 'planning', labelAr: 'تخطيط الإنتاج/التشغيل', icon: '📋', desc: 'الطلب، الطاقة، الجدولة.',
        templates: [
          { text: 'ردّ فعل يومي بلا تخطيط.', rating: 1 },
          { text: 'خطة أسبوعية/شهرية + توقّع طلب.', rating: 3 },
          { text: 'S&OP متكامل + تخطيط ديناميكي بالـAI.', rating: 5 },
        ]},
      { key: 'sourcing', labelAr: 'التوريد والمشتريات', icon: '📦', desc: 'الموردون، الاختيار، الطلب.',
        templates: [
          { text: 'شراء عشوائي مع مورد واحد.', rating: 1 },
          { text: 'قائمة موردين معتمدين + تقييم دوري.', rating: 3 },
          { text: 'إدارة سلسلة الإمداد + JIT + شراكات استراتيجية.', rating: 5 },
        ]},
      { key: 'execution', labelAr: 'التنفيذ التشغيلي', icon: '⚙️', desc: 'التشغيل، السلامة، الجودة.',
        templates: [
          { text: 'تشغيل يدوي بلا SOPs.', rating: 1 },
          { text: 'SOPs مطبّقة + مراقبة يومية.', rating: 3 },
          { text: 'Lean/Six Sigma + أتمتة + OEE مباشر.', rating: 5 },
        ]},
      { key: 'quality_ctrl', labelAr: 'ضبط الجودة', icon: '✅', desc: 'الفحص، التصحيح، التوثيق.',
        templates: [
          { text: 'فحص عشوائي عند شكوى.', rating: 1 },
          { text: 'خطة فحص + CAPA + سجل عدم مطابقة.', rating: 3 },
          { text: 'SPC حي + Zero-Defect Mindset + شهادات جودة.', rating: 5 },
        ]},
    ],
    enablers: [
      { key: 'sops', labelAr: 'SOPs والمعايير', icon: '📜', desc: 'الإجراءات المكتوبة، المراجعة.',
        templates: [
          { text: 'إجراءات شفهية أو ناقصة.', rating: 1 },
          { text: 'SOPs موثّقة + مراجعة سنوية.', rating: 3 },
          { text: 'مكتبة SOPs رقمية + إشعارات تحديث + تدقيق.', rating: 5 },
        ]},
      { key: 'maintenance', labelAr: 'الصيانة والأصول', icon: '🛠️', desc: 'الوقائية، الإصلاحية، الأصول.',
        templates: [
          { text: 'صيانة إصلاحية عند العطل فقط.', rating: 1 },
          { text: 'خطة صيانة وقائية دورية.', rating: 3 },
          { text: 'صيانة تنبؤية بالـIoT + إدارة أصول كاملة.', rating: 5 },
        ]},
      { key: 'safety', labelAr: 'السلامة والبيئة', icon: '🦺', desc: 'HSE، حوادث، تدريب.',
        templates: [
          { text: 'اجتهاد فردي بلا سياسة.', rating: 1 },
          { text: 'سياسة HSE + تدريب دوري + سجل حوادث.', rating: 3 },
          { text: 'ISO 45001 + استدامة + ثقافة صفر حادث.', rating: 5 },
        ]},
    ],
  },

  IT: {
    core: [
      { key: 'requirements', labelAr: 'تحليل المتطلبات', icon: '📋', desc: 'فهم الأعمال، الأولويات.',
        templates: [
          { text: 'طلبات شفهية بلا توثيق.', rating: 1 },
          { text: 'وثائق متطلبات + مصفوفة أولويات.', rating: 3 },
          { text: 'Product Management + Discovery + PoC مستمر.', rating: 5 },
        ]},
      { key: 'design_dev', labelAr: 'التصميم والتطوير', icon: '💻', desc: 'الهندسة المعمارية، البرمجة.',
        templates: [
          { text: 'كل مشروع بأدوات مختلفة، بلا مراجعة.', rating: 1 },
          { text: 'معايير كود + Code Review + CI.', rating: 3 },
          { text: 'DevOps ناضج + Microservices + IaC + AI-assisted.', rating: 5 },
        ]},
      { key: 'deployment', labelAr: 'النشر والإطلاق', icon: '🚀', desc: 'الإصدارات، التكامل.',
        templates: [
          { text: 'نشر يدوي مع فترات توقّف.', rating: 1 },
          { text: 'CI/CD + Blue-Green Deployment.', rating: 3 },
          { text: 'Zero-Downtime + Canary + Feature Flags.', rating: 5 },
        ]},
      { key: 'ops_support', labelAr: 'التشغيل والدعم', icon: '🛠️', desc: 'المراقبة، الحوادث، الدعم.',
        templates: [
          { text: 'ردّ فعل عند تعطّل الخدمة.', rating: 1 },
          { text: 'مراقبة + SLA + Runbooks.', rating: 3 },
          { text: 'SRE ناضج + مراقبة تنبؤية + Chaos Engineering.', rating: 5 },
        ]},
    ],
    enablers: [
      { key: 'security', labelAr: 'الأمن السيبراني', icon: '🛡️', desc: 'الحماية، الاستجابة، الامتثال.',
        templates: [
          { text: 'حماية أساسية (كلمة سر + جدار ناري).', rating: 1 },
          { text: 'أمن متعدّد الطبقات + سياسات + تدريب.', rating: 3 },
          { text: 'Zero Trust + SOC 24/7 + امتثال ISO 27001.', rating: 5 },
        ]},
      { key: 'infrastructure', labelAr: 'البنية التحتية', icon: '☁️', desc: 'الخوادم، الشبكات، السحابة.',
        templates: [
          { text: 'خوادم محلية بحملة يدوية.', rating: 1 },
          { text: 'Hybrid Cloud + مراقبة + Backup.', rating: 3 },
          { text: 'Cloud-Native + Auto-Scaling + Multi-Region.', rating: 5 },
        ]},
      { key: 'it_gov', labelAr: 'حوكمة IT', icon: '⚖️', desc: 'ITIL، سياسات، تخطيط.',
        templates: [
          { text: 'قرارات فردية بلا حوكمة.', rating: 1 },
          { text: 'ITIL + Change Management + KPIs.', rating: 3 },
          { text: 'COBIT + Portfolio Management + استشارة استراتيجية.', rating: 5 },
        ]},
    ],
  },

  CUSTOMER_SERVICE: {
    core: [
      { key: 'contact', labelAr: 'استقبال الاتصال', icon: '📞', desc: 'أوّل نقطة تواصل، القنوات.',
        templates: [
          { text: 'قناة واحدة + انتظار طويل.', rating: 1 },
          { text: 'قنوات متعدّدة + نظام تذاكر.', rating: 3 },
          { text: 'Omnichannel + Chat-bot + توجيه ذكي.', rating: 5 },
        ]},
      { key: 'resolution', labelAr: 'حل المشكلة', icon: '🔧', desc: 'التشخيص، التنفيذ، الإغلاق.',
        templates: [
          { text: 'تصعيد متكرّر بلا حل من أول مرة.', rating: 1 },
          { text: 'FCR ≥ 60% + قاعدة معرفة داخلية.', rating: 3 },
          { text: 'FCR ≥ 80% + Self-service + AI suggestions.', rating: 5 },
        ]},
      { key: 'followup', labelAr: 'المتابعة', icon: '🔁', desc: 'التأكد من الرضا وإغلاق الحلقة.',
        templates: [
          { text: 'لا متابعة بعد الحل.', rating: 1 },
          { text: 'مكالمة/بريد متابعة بعد ٤٨ ساعة.', rating: 3 },
          { text: 'أتمتة متابعة + قياس رضا لحظي.', rating: 5 },
        ]},
      { key: 'feedback', labelAr: 'التقاط الملاحظات', icon: '📝', desc: 'الاستبيانات، القياس، الاستفادة.',
        templates: [
          { text: 'ملاحظات عابرة بلا تحليل.', rating: 1 },
          { text: 'CSAT بعد كل تفاعل + مراجعة شهرية.', rating: 3 },
          { text: 'NPS + Voice of Customer + Actionable insights.', rating: 5 },
        ]},
    ],
    enablers: [
      { key: 'kb', labelAr: 'قاعدة المعرفة', icon: '📚', desc: 'مقالات، أدلة، سيناريوهات.',
        templates: [
          { text: 'معرفة في رؤوس الوكلاء فقط.', rating: 1 },
          { text: 'قاعدة معرفة داخلية محدّثة.', rating: 3 },
          { text: 'KB متكامل + Self-service خارجي + AI search.', rating: 5 },
        ]},
      { key: 'agent_training', labelAr: 'تدريب الوكلاء', icon: '🎓', desc: 'مهارات التواصل والتقنية.',
        templates: [
          { text: 'تدريب أوّلي بلا استمرارية.', rating: 1 },
          { text: 'برنامج تأهيل + تدريب ربعي.', rating: 3 },
          { text: 'Coaching فردي + Simulation + مسار مهني.', rating: 5 },
        ]},
      { key: 'qa', labelAr: 'ضمان الجودة', icon: '✅', desc: 'مراجعة، معايير، تحسين.',
        templates: [
          { text: 'بلا مراجعة أو معايير جودة.', rating: 1 },
          { text: 'عيّنة أسبوعية + معايير موثّقة.', rating: 3 },
          { text: 'مراجعة آلية 100% + AI QA + تحسين مستمر.', rating: 5 },
        ]},
    ],
  },

  SUPPORT: {
    core: [
      { key: 'request_handling', labelAr: 'استقبال الطلبات', icon: '📋', desc: 'الشراء، الخدمات، الطوارئ.',
        templates: [
          { text: 'طلبات شفهية بلا نظام.', rating: 1 },
          { text: 'نظام طلبات + مصفوفة اعتماد.', rating: 3 },
          { text: 'بوابة رقمية + سير عمل + SLA لكل نوع.', rating: 5 },
        ]},
      { key: 'supplier_selection', labelAr: 'اختيار الموردين', icon: '🔍', desc: 'قائمة معتمدة، تقييم، تفاوض.',
        templates: [
          { text: 'مورد واحد أو اختيار عشوائي.', rating: 1 },
          { text: 'قائمة معتمدة + تقييم سنوي + عروض.', rating: 3 },
          { text: 'إدارة موردين استراتيجية + شراكات + Scorecards.', rating: 5 },
        ]},
      { key: 'procurement_exec', labelAr: 'تنفيذ الشراء', icon: '🛒', desc: 'الطلب، التسليم، الاستلام.',
        templates: [
          { text: 'يدوي مع تأخيرات وأخطاء.', rating: 1 },
          { text: 'e-Procurement + تكامل مالي.', rating: 3 },
          { text: 'أتمتة كاملة + Catalog + P2P + BI.', rating: 5 },
        ]},
      { key: 'delivery', labelAr: 'التسليم والفواتير', icon: '📦', desc: 'الاستلام، التطابق، الدفع.',
        templates: [
          { text: 'إشكاليات مطابقة متكررة.', rating: 1 },
          { text: 'مطابقة ثلاثية (3-way match) + حل نزاعات.', rating: 3 },
          { text: 'مطابقة آلية + دفع فوري + تحليل تكاليف.', rating: 5 },
        ]},
    ],
    enablers: [
      { key: 'supplier_db', labelAr: 'قاعدة الموردين', icon: '📇', desc: 'بيانات، أداء، أهلية.',
        templates: [
          { text: 'ملفات مبعثرة أو بلا قاعدة.', rating: 1 },
          { text: 'قاعدة موحّدة + تحديث دوري.', rating: 3 },
          { text: 'SRM متكامل + تقييم لحظي + مخاطر.', rating: 5 },
        ]},
      { key: 'contracts', labelAr: 'إدارة العقود', icon: '📜', desc: 'الصياغة، التجديد، المتابعة.',
        templates: [
          { text: 'عقود ورقية بلا متابعة.', rating: 1 },
          { text: 'CLM أساسي + مراجعة سنوية.', rating: 3 },
          { text: 'CLM ذكي + AI مراجعة + تنبيهات تجديد.', rating: 5 },
        ]},
      { key: 'budget_tracking', labelAr: 'تتبّع الميزانية', icon: '💰', desc: 'الالتزامات، الصرف، التنبؤ.',
        templates: [
          { text: 'صرف بلا رقابة + تجاوزات.', rating: 1 },
          { text: 'ميزانية معتمدة + تقارير شهرية.', rating: 3 },
          { text: 'تحكّم لحظي + تنبؤ + توفير مقاس.', rating: 5 },
        ]},
    ],
  },

  LOGISTICS: {
    core: [
      { key: 'inbound', labelAr: 'الاستلام والفحص', icon: '📥', desc: 'الاستلام، الفحص، التخزين.',
        templates: [
          { text: 'استلام بلا تدقيق كافٍ.', rating: 1 },
          { text: 'إجراء استلام + Barcode + سجل.', rating: 3 },
          { text: 'RFID + فحص آلي + تكامل مع المورد.', rating: 5 },
        ]},
      { key: 'warehousing', labelAr: 'إدارة المستودعات', icon: '🏪', desc: 'التخزين، الجرد، التنظيم.',
        templates: [
          { text: 'مخزون على الحس + جرد سنوي.', rating: 1 },
          { text: 'WMS أساسي + جرد ربعي.', rating: 3 },
          { text: 'WMS ذكي + Cycle Counting + Slotting AI.', rating: 5 },
        ]},
      { key: 'outbound', labelAr: 'الشحن والتوزيع', icon: '📦', desc: 'التجهيز، التحميل، التسليم.',
        templates: [
          { text: 'شحن يدوي مع تأخيرات.', rating: 1 },
          { text: 'تخطيط مسارات + تتبع + OTIF ≥ 90%.', rating: 3 },
          { text: 'أتمتة كاملة + OTIF ≥ 98% + Same-day.', rating: 5 },
        ]},
      { key: 'returns', labelAr: 'المرتجعات', icon: '🔁', desc: 'الاستلام، المعالجة، إعادة التدوير.',
        templates: [
          { text: 'مرتجعات بلا إجراء واضح.', rating: 1 },
          { text: 'سياسة مرتجعات + معالجة أسبوعية.', rating: 3 },
          { text: 'Reverse Logistics متكاملة + استرداد قيمة.', rating: 5 },
        ]},
    ],
    enablers: [
      { key: 'fleet', labelAr: 'إدارة الأسطول', icon: '🚚', desc: 'المركبات، الوقود، السائقون.',
        templates: [
          { text: 'مركبات بلا صيانة منتظمة.', rating: 1 },
          { text: 'صيانة دورية + تتبع GPS.', rating: 3 },
          { text: 'Fleet Management ذكي + Telematics + توفير وقود.', rating: 5 },
        ]},
      { key: 'wms', labelAr: 'التقنية اللوجستية', icon: '💻', desc: 'WMS، TMS، تتبع.',
        templates: [
          { text: 'جداول Excel وأوراق.', rating: 1 },
          { text: 'WMS + TMS + تكامل مع ERP.', rating: 3 },
          { text: 'منصة سحابية متكاملة + Real-time visibility.', rating: 5 },
        ]},
      { key: 'safety_env', labelAr: 'السلامة والاستدامة', icon: '🦺', desc: 'HSE، انبعاثات، تدريب.',
        templates: [
          { text: 'سلامة رد فعل بلا سياسة.', rating: 1 },
          { text: 'سياسة HSE + تدريب + سجل حوادث.', rating: 3 },
          { text: 'ISO 45001 + بصمة كربونية + توفير طاقة.', rating: 5 },
        ]},
    ],
  },

  QUALITY: {
    core: [
      { key: 'inspection_plan', labelAr: 'تخطيط الفحص', icon: '📋', desc: 'خطة، معايير، عيّنات.',
        templates: [
          { text: 'فحص عشوائي بلا خطة.', rating: 1 },
          { text: 'خطة فحص + AQL + سجل عيّنات.', rating: 3 },
          { text: 'RBI (Risk-Based Inspection) + AI planning.', rating: 5 },
        ]},
      { key: 'inprocess', labelAr: 'الرقابة أثناء الإنتاج', icon: '⚙️', desc: 'SPC، متابعة لحظية.',
        templates: [
          { text: 'رقابة بعد اكتمال الإنتاج فقط.', rating: 1 },
          { text: 'SPC يدوي + مراجعة يومية.', rating: 3 },
          { text: 'SPC مباشر + IoT + تنبيهات لحظية.', rating: 5 },
        ]},
      { key: 'final_inspection', labelAr: 'الفحص النهائي', icon: '✅', desc: 'الاعتماد قبل الشحن.',
        templates: [
          { text: 'فحص بصري سريع.', rating: 1 },
          { text: 'خطة فحص + معدات معايرة + توثيق.', rating: 3 },
          { text: 'فحص آلي + شهادات جودة + zero-defect.', rating: 5 },
        ]},
      { key: 'capa', labelAr: 'الإجراءات التصحيحية', icon: '🔧', desc: 'التحليل، التصحيح، الوقاية.',
        templates: [
          { text: 'حل عيوب فردية بلا سبب جذري.', rating: 1 },
          { text: 'CAPA + 5-Why + متابعة إغلاق.', rating: 3 },
          { text: 'Ishikawa + FMEA + منع تكرار مقاس.', rating: 5 },
        ]},
    ],
    enablers: [
      { key: 'metrology', labelAr: 'المعايرة والقياس', icon: '📏', desc: 'المعدات، الوحدات، السجل.',
        templates: [
          { text: 'أجهزة غير معايرة أو قديمة.', rating: 1 },
          { text: 'برنامج معايرة سنوي + سجل.', rating: 3 },
          { text: 'معدات معايرة تلقائياً + شهادات معتمَدة.', rating: 5 },
        ]},
      { key: 'standards', labelAr: 'المعايير والشهادات', icon: '🏆', desc: 'ISO، قطاعية، امتثال.',
        templates: [
          { text: 'بلا شهادات أو معايير.', rating: 1 },
          { text: 'ISO 9001 + معايير قطاعية.', rating: 3 },
          { text: 'ISO 9001+ + شهادات دولية + IATF/ASME.', rating: 5 },
        ]},
      { key: 'quality_training', labelAr: 'ثقافة الجودة', icon: '🎓', desc: 'التدريب، المشاركة، الاعتراف.',
        templates: [
          { text: 'الجودة مسؤولية قسم واحد.', rating: 1 },
          { text: 'برنامج تدريب + مشاركة الأقسام.', rating: 3 },
          { text: 'Green/Black Belts + كل موظف مسؤول جودة.', rating: 5 },
        ]},
    ],
  },

  PROJECTS: {
    core: [
      { key: 'initiation', labelAr: 'البدء والتصوّر', icon: '🎯', desc: 'ميثاق، أهداف، أصحاب مصلحة.',
        templates: [
          { text: 'مشاريع تبدأ بلا ميثاق أو أهداف.', rating: 1 },
          { text: 'ميثاق + أهداف SMART + تحليل أصحاب مصلحة.', rating: 3 },
          { text: 'Business Case + ROI + Discovery متعمّق.', rating: 5 },
        ]},
      { key: 'planning', labelAr: 'التخطيط', icon: '📋', desc: 'النطاق، الجدول، الميزانية.',
        templates: [
          { text: 'خطة سطحية أو غائبة.', rating: 1 },
          { text: 'WBS + Gantt + ميزانية موثّقة.', rating: 3 },
          { text: 'Rolling Wave + Portfolio Planning + سيناريوهات.', rating: 5 },
        ]},
      { key: 'execution', labelAr: 'التنفيذ والمتابعة', icon: '⚙️', desc: 'التقدّم، الأداء، التواصل.',
        templates: [
          { text: 'تنفيذ حدسي بلا متابعة.', rating: 1 },
          { text: 'اجتماعات دورية + تقارير حالة + EVM.', rating: 3 },
          { text: 'Agile hybrid + Dashboards + مؤشرات لحظية.', rating: 5 },
        ]},
      { key: 'closure', labelAr: 'الإغلاق والدروس', icon: '📚', desc: 'التسليم، التقييم، الأرشفة.',
        templates: [
          { text: 'إغلاق غير رسمي، بلا دروس مستفادة.', rating: 1 },
          { text: 'قائمة إغلاق + Lessons Learned موثّقة.', rating: 3 },
          { text: 'Post-Mortem منظّم + Knowledge Repository.', rating: 5 },
        ]},
    ],
    enablers: [
      { key: 'pmo', labelAr: 'حوكمة PMO', icon: '🏛️', desc: 'ميثاق، منهجية، معايير.',
        templates: [
          { text: 'كل مدير مشروع بأسلوبه.', rating: 1 },
          { text: 'PMO + منهجية موحّدة + قوالب.', rating: 3 },
          { text: 'PMO ناضج + Portfolio + Strategic Alignment.', rating: 5 },
        ]},
      { key: 'resources', labelAr: 'إدارة الموارد', icon: '👥', desc: 'التخصيص، السعة، الأولوية.',
        templates: [
          { text: 'موارد مشتركة بلا تخطيط.', rating: 1 },
          { text: 'خطة تخصيص + مصفوفة مهارات.', rating: 3 },
          { text: 'Resource Optimization + Capacity Planning.', rating: 5 },
        ]},
      { key: 'risk_mgmt', labelAr: 'إدارة المخاطر', icon: '⚠️', desc: 'التحديد، التقييم، الاستجابة.',
        templates: [
          { text: 'ردّ فعل عند حدوث المشكلة.', rating: 1 },
          { text: 'سجل مخاطر + خطة استجابة.', rating: 3 },
          { text: 'Monte Carlo + Quantitative + مراجعة لحظية.', rating: 5 },
        ]},
    ],
  },

  COMPLIANCE: {
    core: [
      { key: 'regulatory_scan', labelAr: 'مسح الأنظمة', icon: '🔍', desc: 'قوانين، لوائح، تحديثات.',
        templates: [
          { text: 'اطلاع عرضي على الأنظمة.', rating: 1 },
          { text: 'مسح دوري + تحديثات موثّقة.', rating: 3 },
          { text: 'أتمتة رصد + استشارة قانونية + تنبيهات.', rating: 5 },
        ]},
      { key: 'gap_assess', labelAr: 'تقييم الفجوات', icon: '📊', desc: 'المطلوب vs الموجود.',
        templates: [
          { text: 'تقييم عند الحاجة فقط.', rating: 1 },
          { text: 'تقييم سنوي + ماتريكس مخاطر.', rating: 3 },
          { text: 'تقييم مستمر + GRC platform + Heatmap لحظي.', rating: 5 },
        ]},
      { key: 'policy_impl', labelAr: 'تطبيق السياسات', icon: '📜', desc: 'الصياغة، الاعتماد، التطبيق.',
        templates: [
          { text: 'سياسات ورقية بلا تطبيق.', rating: 1 },
          { text: 'سياسات معتمدة + توقيع + تدريب.', rating: 3 },
          { text: 'سياسات رقمية + ضوابط تقنية + تنفيذ آلي.', rating: 5 },
        ]},
      { key: 'monitoring', labelAr: 'المتابعة والتدقيق', icon: '🔎', desc: 'تدقيق داخلي، تقارير.',
        templates: [
          { text: 'بلا تدقيق داخلي.', rating: 1 },
          { text: 'خطة تدقيق سنوية + تقارير + متابعة.', rating: 3 },
          { text: 'Continuous Assurance + Analytics + AI red flags.', rating: 5 },
        ]},
    ],
    enablers: [
      { key: 'training', labelAr: 'التدريب والوعي', icon: '🎓', desc: 'برامج، حضور، تقييم.',
        templates: [
          { text: 'بلا تدريب امتثال.', rating: 1 },
          { text: 'برنامج تدريب سنوي إلزامي.', rating: 3 },
          { text: 'مسارات مخصّصة + Micro-learning + تقييم أثر.', rating: 5 },
        ]},
      { key: 'evidence', labelAr: 'إدارة الأدلة', icon: '📁', desc: 'التوثيق، الأرشفة، الاسترجاع.',
        templates: [
          { text: 'ملفات مبعثرة بلا نظام.', rating: 1 },
          { text: 'أرشيف مركزي + سياسة احتفاظ.', rating: 3 },
          { text: 'DMS ذكي + Immutable audit trail.', rating: 5 },
        ]},
      { key: 'reporting_c', labelAr: 'التقارير التنظيمية', icon: '📊', desc: 'مجلس، جهات، إفصاح.',
        templates: [
          { text: 'تقارير عند الطلب فقط.', rating: 1 },
          { text: 'تقارير ربعية + Dashboards.', rating: 3 },
          { text: 'تقارير آلية + Real-time + KRIs.', rating: 5 },
        ]},
    ],
  },

  GOVERNANCE: {
    core: [
      { key: 'board_oversight', labelAr: 'إشراف المجلس', icon: '🏛️', desc: 'الاجتماعات، القرارات، المساءلة.',
        templates: [
          { text: 'اجتماعات غير منتظمة بلا محاضر.', rating: 1 },
          { text: 'اجتماعات ربعية + محاضر + متابعة.', rating: 3 },
          { text: 'Board Portal + KRIs + مصفوفة مساءلة.', rating: 5 },
        ]},
      { key: 'policy_setting', labelAr: 'وضع السياسات', icon: '📜', desc: 'استراتيجية، قيم، لوائح.',
        templates: [
          { text: 'قرارات ارتجالية بلا سياسة.', rating: 1 },
          { text: 'مكتبة سياسات + مراجعة دورية.', rating: 3 },
          { text: 'حوكمة متطوّرة + خطط استراتيجية + تقييم أثر.', rating: 5 },
        ]},
      { key: 'disclosure', labelAr: 'الإفصاح والشفافية', icon: '📢', desc: 'المساهمين، الجمهور، الجهات.',
        templates: [
          { text: 'إفصاح ضعيف أو تأخّر.', rating: 1 },
          { text: 'إفصاح دوري + تقرير سنوي.', rating: 3 },
          { text: 'إفصاح استباقي + ESG + Integrated Reporting.', rating: 5 },
        ]},
      { key: 'review', labelAr: 'المراجعة والتقييم', icon: '🔍', desc: 'أداء المجلس، اللجان.',
        templates: [
          { text: 'بلا تقييم للمجلس.', rating: 1 },
          { text: 'تقييم ذاتي سنوي.', rating: 3 },
          { text: 'تقييم مستقل + Peer Review + مؤشرات فعالية.', rating: 5 },
        ]},
    ],
    enablers: [
      { key: 'committees', labelAr: 'لجان المجلس', icon: '👥', desc: 'التدقيق، المخاطر، المكافآت.',
        templates: [
          { text: 'بلا لجان أو لجان اسمية.', rating: 1 },
          { text: 'لجان أساسية + مواثيق + محاضر.', rating: 3 },
          { text: 'لجان مستقلة + خبراء + تقارير للمجلس.', rating: 5 },
        ]},
      { key: 'secretariat', labelAr: 'أمانة المجلس', icon: '📝', desc: 'التنسيق، الأرشيف، الامتثال.',
        templates: [
          { text: 'بلا أمين مجلس متفرّغ.', rating: 1 },
          { text: 'أمين مجلس + مكتبة قرارات + تقاويم.', rating: 3 },
          { text: 'Governance Office + Board Portal + امتثال شامل.', rating: 5 },
        ]},
      { key: 'advisors', labelAr: 'الاستشارة الخارجية', icon: '🎓', desc: 'قانوني، مالي، حوكمة.',
        templates: [
          { text: 'بلا مستشارين خارجيين.', rating: 1 },
          { text: 'استشارة عند الحاجة + مراجعة دورية.', rating: 3 },
          { text: 'شراكة مع مكاتب متخصّصة + تقييم أداء المجلس.', rating: 5 },
        ]},
    ],
  },
}
