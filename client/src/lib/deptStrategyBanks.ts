// ─── بنوك اقتراحات للأدوات الثلاث (Benchmarking / OrgDNA / Stakeholders) ─
// كل بنك مخصّص لتخصّص إدارة (١٣ إدارة). الأداة تُفتح بمقاييس/قيم/أصحاب
// مصلحة مقترحين — يقبل المدير ما يناسبه ويعدّل الباقي.

import type { DeptCode } from './deptApi'

// ─── Benchmarking — مقاييس مرجعية للسوق السعودي ─────────────────

export interface BenchmarkMetric {
  name: string
  unit: string
  saudiBenchmark: string  // القيمة المرجعية في السوق السعودي (نص)
  source: string           // من أين نأتي بالمرجع
}

export const DEPT_BENCHMARK: Partial<Record<DeptCode, BenchmarkMetric[]>> = {
  HR: [
    { name: 'معدل الدوران السنوي', unit: '%',   saudiBenchmark: '12-15',  source: 'HRSD / تقارير القطاع' },
    { name: 'نسبة السعودة',        unit: '%',   saudiBenchmark: 'حسب نطاقات', source: 'قوى / HRSD' },
    { name: 'زمن التوظيف',          unit: 'يوم', saudiBenchmark: '30-60',  source: 'LinkedIn Talent Report' },
    { name: 'تكلفة توظيف/موظف',    unit: 'ر.س', saudiBenchmark: '5,000-15,000', source: 'PwC ME HR Trends' },
    { name: 'رضا الموظفين (eNPS)',  unit: 'رقم', saudiBenchmark: '30+ جيد',  source: 'Gallup ME' },
    { name: 'ساعات تدريب/موظف',    unit: 'ساعة', saudiBenchmark: '20-40',  source: 'ATD Benchmarks' },
  ],
  FINANCE: [
    { name: 'هامش صافي',            unit: '%',   saudiBenchmark: '10-20', source: 'Tadawul قطاعي' },
    { name: 'DSO (فترة التحصيل)',   unit: 'يوم', saudiBenchmark: '45-60', source: 'PwC Working Capital' },
    { name: 'DPO (فترة الدفع)',     unit: 'يوم', saudiBenchmark: '45-90', source: 'PwC Working Capital' },
    { name: 'نسبة السيولة الجارية', unit: 'ضعف', saudiBenchmark: '1.5-2.5', source: 'S&P Regional' },
    { name: 'أيام إغلاق الشهر',    unit: 'يوم', saudiBenchmark: '5-10',   source: 'APQC Benchmarks' },
    { name: 'كلفة قسم المالية/إيراد', unit: '%',   saudiBenchmark: '0.5-1', source: 'APQC Benchmarks' },
  ],
  SALES: [
    { name: 'معدل التحويل',         unit: '%',   saudiBenchmark: '20-30', source: 'HubSpot Sales Report' },
    { name: 'دورة البيع',            unit: 'يوم', saudiBenchmark: '30-90', source: 'HubSpot Sales Report' },
    { name: 'LTV/CAC',              unit: 'ضعف', saudiBenchmark: '3+',    source: 'SaaS Metrics' },
    { name: 'قيمة الأنبوب المفتوح', unit: 'ر.س', saudiBenchmark: '3× المستهدف', source: 'أفضل الممارسات' },
    { name: 'حصة الحصص المحقّقة',   unit: '%',   saudiBenchmark: '70+',   source: 'Xactly Insights' },
    { name: 'الفريق الأعلى ٢٠٪/كل الفريق', unit: '%', saudiBenchmark: '60+', source: 'قاعدة 20/80' },
  ],
  MARKETING: [
    { name: 'ROAS',                 unit: 'ضعف', saudiBenchmark: '3-5',   source: 'Google Ads MEA' },
    { name: 'CAC',                  unit: 'ر.س', saudiBenchmark: '200-500', source: 'HubSpot' },
    { name: 'CTR (Google)',         unit: '%',   saudiBenchmark: '2-5',   source: 'WordStream' },
    { name: 'Engagement Rate (Insta)', unit: '%', saudiBenchmark: '1-3',  source: 'Hootsuite ME' },
    { name: 'MQL→SQL',              unit: '%',   saudiBenchmark: '15-25', source: 'HubSpot' },
    { name: 'Website Bounce Rate',  unit: '%',   saudiBenchmark: '40-60', source: 'Google Analytics' },
  ],
  OPERATIONS: [
    { name: 'OEE',                  unit: '%',   saudiBenchmark: '70-85', source: 'ISO 22400' },
    { name: 'زمن دورة الإنتاج',    unit: 'دقيقة', saudiBenchmark: 'حسب المنتج', source: 'قياسات داخلية' },
    { name: 'معدل العيوب',          unit: '%',   saudiBenchmark: '<2',    source: 'Six Sigma' },
    { name: 'استخدام السعة',        unit: '%',   saudiBenchmark: '75-85', source: 'McKinsey Ops' },
    { name: 'ساعات التوقف',         unit: '%',   saudiBenchmark: '<5',    source: 'Lean Manufacturing' },
    { name: 'كلفة العملية/وحدة',    unit: 'ر.س', saudiBenchmark: 'حسب القطاع', source: 'قياسات داخلية' },
  ],
  IT: [
    { name: 'Uptime',                unit: '%',   saudiBenchmark: '99.9+', source: 'AWS SLA / Azure' },
    { name: 'MTTR',                  unit: 'ساعة', saudiBenchmark: '4-8',   source: 'ITIL Benchmarks' },
    { name: 'التزام SLA',            unit: '%',   saudiBenchmark: '95+',    source: 'ITIL Benchmarks' },
    { name: 'حوادث أمن سيبراني',    unit: 'عدد/سنة', saudiBenchmark: '<5',  source: 'NCA' },
    { name: 'كلفة IT/إيراد',         unit: '%',   saudiBenchmark: '3-6',    source: 'Gartner IT Key Metrics' },
    { name: 'وقت النشر (Lead Time)', unit: 'يوم', saudiBenchmark: '<1',    source: 'DORA Metrics' },
  ],
  CUSTOMER_SERVICE: [
    { name: 'FCR',                   unit: '%',   saudiBenchmark: '70+',   source: 'SQM Group' },
    { name: 'CSAT',                  unit: '%',   saudiBenchmark: '85+',   source: 'Zendesk Benchmark' },
    { name: 'NPS',                   unit: 'رقم', saudiBenchmark: '30+ جيد', source: 'Bain NPS' },
    { name: 'زمن الاستجابة الأول',   unit: 'دقيقة', saudiBenchmark: '<15',   source: 'Zendesk' },
    { name: 'AHT (زمن التعامل)',     unit: 'دقيقة', saudiBenchmark: '5-8',   source: 'ContactBabel' },
    { name: 'الاستنزاف الشهري',      unit: '%',   saudiBenchmark: '2-5',    source: 'Bain Benchmarks' },
  ],
  SUPPORT: [
    { name: 'دورة الشراء (P2P)',    unit: 'يوم', saudiBenchmark: '14-30', source: 'CIPS' },
    { name: 'التزام SLA للدعم',     unit: '%',   saudiBenchmark: '95+',   source: 'ITIL' },
    { name: 'توفير من المشتريات',   unit: '%',   saudiBenchmark: '5-10',  source: 'CIPS Benchmarks' },
    { name: 'رضا الأقسام الداخلية', unit: 'CSAT %', saudiBenchmark: '80+', source: 'داخلي' },
    { name: 'التزام الميزانية',      unit: '%',   saudiBenchmark: '95+',   source: 'داخلي' },
    { name: 'موردون مسجّلون',        unit: 'عدد', saudiBenchmark: '50+ نشط', source: 'ممارسات القطاع' },
  ],
  LOGISTICS: [
    { name: 'OTIF',                  unit: '%',   saudiBenchmark: '95+',   source: 'Gartner Supply Chain' },
    { name: 'كلفة الشحن/طلب',        unit: 'ر.س', saudiBenchmark: '15-40', source: 'Aramex / SPL' },
    { name: 'دقة المخزون',           unit: '%',   saudiBenchmark: '98+',   source: 'ISCEA' },
    { name: 'دوران المخزون',         unit: 'مرة/سنة', saudiBenchmark: '8-12', source: 'ISCEA' },
    { name: 'زمن الاستلام للتخزين',  unit: 'ساعة', saudiBenchmark: '<24',  source: 'WERC Benchmarks' },
    { name: 'دقة التحضير',           unit: '%',   saudiBenchmark: '99+',   source: 'WERC Benchmarks' },
  ],
  QUALITY: [
    { name: 'معدل العيوب (DPMO)',    unit: 'DPMO', saudiBenchmark: '<3,400', source: 'Six Sigma' },
    { name: 'نسبة إعادة العمل',      unit: '%',   saudiBenchmark: '<3',    source: 'Lean Manufacturing' },
    { name: 'كلفة الجودة (COQ)',     unit: '% إيراد', saudiBenchmark: '<10', source: 'Juran' },
    { name: 'زمن إغلاق CAPA',        unit: 'يوم', saudiBenchmark: '<30',   source: 'FDA / ISO' },
    { name: 'شكاوى الجودة',          unit: '/شهر', saudiBenchmark: 'حسب الحجم', source: 'داخلي' },
    { name: 'التزام معايير ISO',     unit: '%',   saudiBenchmark: '100',   source: 'ISO Audits' },
  ],
  PROJECTS: [
    { name: 'التسليم في الموعد',     unit: '%',   saudiBenchmark: '85+',   source: 'PMI Pulse' },
    { name: 'الالتزام بالميزانية',   unit: '%',   saudiBenchmark: '90+',   source: 'PMI Pulse' },
    { name: 'انزلاق النطاق',         unit: '%',   saudiBenchmark: '<10',   source: 'Standish Group' },
    { name: 'رضا أصحاب المصلحة',    unit: 'CSAT %', saudiBenchmark: '80+', source: 'PMI' },
    { name: 'نجاح المشاريع',         unit: '%',   saudiBenchmark: '65+',   source: 'Standish CHAOS' },
    { name: 'نضج PMO',               unit: 'مستوى OPM3', saudiBenchmark: '3+', source: 'PMI OPM3' },
  ],
  COMPLIANCE: [
    { name: 'درجة تدقيق داخلي',      unit: '%',   saudiBenchmark: '90+',   source: 'IIA Standards' },
    { name: 'الغرامات المتجنّبة',    unit: 'ر.س/سنة', saudiBenchmark: 'صفر مثالي', source: 'داخلي' },
    { name: 'وقت إغلاق مخالفة',      unit: 'يوم', saudiBenchmark: '<30',   source: 'GRC Benchmarks' },
    { name: 'تغطية تدريب الامتثال',  unit: '%',   saudiBenchmark: '100',   source: 'ECI Benchmarks' },
    { name: 'التزام ZATCA',           unit: '%',   saudiBenchmark: '100',   source: 'ZATCA' },
    { name: 'دورة تحديث السياسات',   unit: 'شهر', saudiBenchmark: '<12',   source: 'ECI' },
  ],
  GOVERNANCE: [
    { name: 'حضور المجلس',           unit: '%',   saudiBenchmark: '90+',   source: 'CMA Guidelines' },
    { name: 'استقلالية الأعضاء',     unit: '%',   saudiBenchmark: '≥ 30',  source: 'حوكمة CMA' },
    { name: 'مخاطر مُخفَّفة',        unit: '%',   saudiBenchmark: '80+',   source: 'COSO ERM' },
    { name: 'تصنيف حوكمة',            unit: 'S&P', saudiBenchmark: '≥ 60',  source: 'S&P Governance' },
    { name: 'تنويع المجلس (نساء)',   unit: '%',   saudiBenchmark: '15+ متزايد', source: 'رؤية 2030' },
    { name: 'شفافية الإفصاح',        unit: 'ESG %', saudiBenchmark: '70+', source: 'MSCI ESG' },
  ],
}

// ─── Org DNA — أبعاد الحمض التنظيمي المخصّصة للإدارة ────────────

export interface DnaSuggestion {
  vision:  string[]   // ٣ مقترحات رؤية
  mission: string[]   // ٣ مقترحات رسالة
  values:  string[]   // ٥-٧ قيم مقترحة
}

export const DEPT_ORG_DNA: Partial<Record<DeptCode, DnaSuggestion>> = {
  HR: {
    vision: [
      'أن نكون الإدارة الرائدة في تمكين الكوادر السعودية وبناء بيئة عمل ملهمة.',
      'أن نبني قوة عاملة عالية الأداء تدعم رؤية 2030 وتحقّق التنافسية العالمية.',
      'أن نصبح خياراً أوّل للكفاءات في القطاع بفضل ثقافة عمل استثنائية.',
    ],
    mission: [
      'استقطاب وتطوير والاحتفاظ بأفضل الكفاءات، وبناء ثقافة أداء شفّافة تُحقّق أهداف الشركة.',
      'توفير برامج تطوير مهني وقيادي متكاملة، وترسيخ ممارسات موارد بشرية عالمية داعمة للسعودة.',
      'شراكة استراتيجية مع الأعمال لجعل الفريق أهم أصل تنافسي للشركة.',
    ],
    values: ['العدالة', 'التمكين', 'التطوير المستمر', 'الاحترام', 'الشفافية', 'الأداء', 'التنوّع والشمول'],
  },
  FINANCE: {
    vision: [
      'أن نكون الشريك المالي الاستراتيجي الذي يقود قرارات مستدامة ونمواً ربحيّاً.',
      'أن نُشكّل مرجعاً للحوكمة المالية والشفافية في القطاع.',
      'أن نُحوّل البيانات المالية إلى ميزة تنافسية عبر الرؤى والابتكار.',
    ],
    mission: [
      'ضمان الاستدامة المالية عبر تخطيط دقيق، رقابة صارمة، وتقارير في الوقت المناسب.',
      'تقديم رؤى مالية استراتيجية للقيادة، وتوفير رأس المال اللازم لتحقيق أهداف النمو.',
      'حماية أصول الشركة ومساءلة الأداء المالي مع الالتزام بأعلى معايير الحوكمة.',
    ],
    values: ['النزاهة', 'الدقة', 'الشفافية', 'الحوكمة', 'الاستدامة', 'الابتكار', 'المساءلة'],
  },
  SALES: {
    vision: [
      'أن نُصبح قائد السوق في تقديم قيمة استثنائية تُحقّق نموّاً مستداماً.',
      'أن نبني علاقات عملاء طويلة الأمد ترتكز على الثقة والقيمة المتبادلة.',
      'أن نكون فريق مبيعات مرجعاً في الاحترافية وتحقيق المستهدفات.',
    ],
    mission: [
      'تحقيق نمو مستدام عبر فهم عميق لاحتياجات العميل وتقديم حلول تُنشئ قيمة حقيقية.',
      'بناء أنبوب مبيعات صحّي ومحفظة عملاء متنوّعة تدعم أهداف الإيرادات.',
      'شراكة مع العملاء لحلّ تحدّياتهم وتحويلهم إلى سفراء للعلامة.',
    ],
    values: ['ثقة العميل', 'النتائج', 'الاحترافية', 'الشغف', 'التحدّي', 'التعاون', 'الابتكار'],
  },
  MARKETING: {
    vision: [
      'أن نبني علامة تجارية محبوبة تُحوّل العميل إلى سفير طبيعي.',
      'أن نكون قوة إبداعية تُلهم السوق وتُعيد تعريف تجربة العميل.',
      'أن نصبح مرجعاً في التسويق الرقمي المدفوع بالبيانات في المنطقة.',
    ],
    mission: [
      'بناء علامة قوية ومسؤولة تُحقّق ولاء العملاء عبر قصص واقعية وقنوات ذكيّة.',
      'قيادة نمو الشركة عبر توليد طلب مؤهَّل واستراتيجية محتوى تُبني على البيانات.',
      'إيصال قيمة الشركة للجمهور المستهدف بالطريقة والوقت والقناة الصحيحة.',
    ],
    values: ['الإبداع', 'الأصالة', 'المرونة', 'العميل أولاً', 'البيانات', 'الشجاعة', 'التعاون'],
  },
  OPERATIONS: {
    vision: [
      'أن نُقدّم أفضل عمليات في القطاع من حيث الكفاءة والجودة والاستدامة.',
      'أن نكون آلة تشغيل خالية من الهدر تدعم النمو دون تنازلات.',
      'أن نصبح مصنعاً/عمليات رائدة إقليمياً في تطبيق التحوّل الرقمي.',
    ],
    mission: [
      'تحويل المدخلات إلى مخرجات بأعلى جودة وأقل تكلفة، مع التزام بمواعيد التسليم.',
      'التحسين المستمر عبر Lean وSix Sigma لخفض الهدر ورفع الإنتاجية.',
      'ضمان استقرار وموثوقية العمليات مع مرونة عالية لتلبية تقلّبات الطلب.',
    ],
    values: ['التميّز', 'التحسين المستمر', 'السلامة', 'الانضباط', 'المسؤولية', 'الابتكار', 'التعاون'],
  },
  IT: {
    vision: [
      'أن نكون شريك التحوّل الرقمي الذي يُمكّن الشركة من قيادة السوق.',
      'أن نبني منظومة تقنية آمنة ومرنة تدعم كل قرارات الأعمال.',
      'أن نصبح مرجعاً في تطبيق AI والسحابة والأمن السيبراني في القطاع.',
    ],
    mission: [
      'توفير حلول تقنية موثوقة وآمنة، تُسرّع قرارات الأعمال وتحمي أصولها الرقمية.',
      'أتمتة العمليات، تكامل الأنظمة، وتوفير بيانات موحّدة لكل الأقسام.',
      'بناء قدرة تقنية داخلية تُحوّل التحدّيات إلى فرص للأعمال.',
    ],
    values: ['الأمان', 'الابتكار', 'الموثوقية', 'التعاون', 'الشفافية', 'التعلّم', 'السرعة'],
  },
  CUSTOMER_SERVICE: {
    vision: [
      'أن نُقدّم أفضل تجربة عميل في القطاع، تجعل العميل جزءاً من عائلة الشركة.',
      'أن نُحوّل كل تفاعل إلى فرصة لبناء ولاء طويل الأمد.',
      'أن نكون المرجع في تجربة عملاء استثنائية مدفوعة بالتعاطف والذكاء.',
    ],
    mission: [
      'الاستجابة السريعة وحلّ مشكلات العملاء من أول مرة، مع الحفاظ على تجربة إيجابية.',
      'الاستماع الفعّال للعميل وترجمة صوته إلى تحسينات في المنتج والخدمة.',
      'تمكين الوكلاء والفريق بالأدوات والمعرفة اللازمة للتفوّق.',
    ],
    values: ['العميل أولاً', 'التعاطف', 'السرعة', 'الحل من أول مرة', 'الاحترام', 'التمكين', 'التحسين المستمر'],
  },
  SUPPORT: {
    vision: [
      'أن نكون الشريك التمكيني الذي يُتيح للأقسام تحقيق تميّزها.',
      'أن نُصبح مرجعاً في المشتريات الذكية والحوكمة.',
      'أن نبني علاقات موردين استراتيجية تُنشئ قيمة متبادلة.',
    ],
    mission: [
      'تلبية احتياجات الأقسام من السلع والخدمات بأعلى جودة وأقل تكلفة وفي الموعد.',
      'إدارة سلسلة موردين موثوقة وحوكمة عقود ذكيّة تحمي مصالح الشركة.',
      'دعم الأقسام في تحقيق أهدافها التشغيلية عبر خدمات لوجستية مرنة.',
    ],
    values: ['الشفافية', 'الكفاءة', 'الشراكة', 'المسؤولية', 'الأخلاقيات', 'التعاون', 'التوفير الذكي'],
  },
  LOGISTICS: {
    vision: [
      'أن نُقدّم أفضل تجربة تسليم في القطاع من حيث السرعة والدقة والقيمة.',
      'أن نكون المرجع اللوجستي المبتكر في المنطقة.',
      'أن نبني شبكة توزيع تدعم رؤية 2030 كمركز لوجستي عالمي.',
    ],
    mission: [
      'ضمان تدفّق سلس للبضائع من المصدر إلى العميل النهائي بأقل تكلفة وأعلى دقة.',
      'إدارة الأسطول والمستودعات والناقلين لتوفير خدمة تسليم موثوقة ومرنة.',
      'استخدام التقنية والبيانات لتحسين المسارات والتنبؤ بالطلب.',
    ],
    values: ['الموثوقية', 'السرعة', 'الدقة', 'السلامة', 'الاستدامة', 'الشراكة', 'الابتكار'],
  },
  QUALITY: {
    vision: [
      'أن نُقدّم منتجاً/خدمة خالياً من العيوب مع تجربة عميل استثنائية.',
      'أن نكون مرجعاً في تطبيق معايير الجودة العالمية في القطاع.',
      'أن نبني ثقافة جودة يشارك فيها كل موظف.',
    ],
    mission: [
      'ضمان توافق كل مخرجاتنا مع أعلى معايير الجودة عبر رقابة استباقية وتحسين مستمر.',
      'تطبيق CAPA فعّال وتحليل جذور الأسباب لمنع تكرار المشكلات.',
      'شراكة مع كل الأقسام لدمج الجودة في كل قرار وعملية.',
    ],
    values: ['الجودة', 'الوقاية', 'التحسين المستمر', 'الأدلة', 'الشفافية', 'المسؤولية', 'التميّز'],
  },
  PROJECTS: {
    vision: [
      'أن نُسلّم كل مشروع في الموعد وضمن الميزانية وبأعلى جودة.',
      'أن نكون مرجعاً في إدارة المشاريع في القطاع.',
      'أن نبني PMO ناضج يدعم النمو والتحوّل الاستراتيجي.',
    ],
    mission: [
      'تحقيق الأهداف الاستراتيجية عبر إدارة محكمة للمشاريع من البدء حتى الإغلاق.',
      'ضمان استخدام أمثل للموارد وإدارة استباقية للمخاطر والتغييرات.',
      'بناء منظومة PMO تُحوّل الاستراتيجية إلى مبادرات ناجحة.',
    ],
    values: ['الالتزام', 'الشفافية', 'التخطيط', 'التعاون', 'المرونة', 'المسؤولية', 'التميّز'],
  },
  COMPLIANCE: {
    vision: [
      'أن نبني نموذج التزام متكامل يحمي الشركة ويدعم نموّها المستدام.',
      'أن نُصبح مرجعاً في الحوكمة والالتزام في القطاع.',
      'أن نُوظّف الالتزام كميزة تنافسية بدل عبء إداري.',
    ],
    mission: [
      'ضمان توافق كل أنشطة الشركة مع القوانين والأنظمة السعودية والدولية.',
      'بناء ثقافة التزام قوية عبر التدريب والتوعية والأدوات التقنية.',
      'إدارة استباقية للمخاطر التنظيمية وحماية سمعة الشركة.',
    ],
    values: ['النزاهة', 'الشفافية', 'الأخلاقيات', 'الاستقلالية', 'المسؤولية', 'الوقاية', 'التعلّم المستمر'],
  },
  GOVERNANCE: {
    vision: [
      'أن نُقدّم أعلى معايير الحوكمة لبناء ثقة المساهمين والسوق.',
      'أن نصبح مرجعاً في الشفافية والإفصاح في القطاع.',
      'أن نُشكّل نموذجاً للحوكمة المستدامة والشاملة.',
    ],
    mission: [
      'ضمان الإشراف الفعّال للمجلس على استراتيجية الشركة وأدائها ومخاطرها.',
      'بناء منظومة حوكمة تحمي حقوق المساهمين وتضمن استقلالية القرار.',
      'تعزيز الثقافة الأخلاقية وممارسات ESG في كل قرارات الشركة.',
    ],
    values: ['النزاهة', 'الشفافية', 'الاستقلالية', 'المساءلة', 'الاستدامة', 'العدالة', 'المسؤولية الاجتماعية'],
  },
}

// ─── Stakeholders — أصحاب مصلحة نموذجيين حسب الإدارة ─────────────

export interface StakeholderSuggestion {
  name: string
  type: 'internal' | 'customer' | 'supplier' | 'regulator' | 'investor' | 'other'
  influence: 1 | 2 | 3 | 4 | 5
  interest: 1 | 2 | 3 | 4 | 5
}

export const DEPT_STAKEHOLDERS: Partial<Record<DeptCode, StakeholderSuggestion[]>> = {
  HR: [
    { name: 'الموظفون الحاليون',        type: 'internal',  influence: 4, interest: 5 },
    { name: 'الرؤساء التنفيذيون',       type: 'internal',  influence: 5, interest: 4 },
    { name: 'المديرون التنفيذيون',      type: 'internal',  influence: 4, interest: 4 },
    { name: 'وزارة الموارد البشرية (HRSD)', type: 'regulator', influence: 5, interest: 3 },
    { name: 'التأمينات (GOSI)',           type: 'regulator', influence: 4, interest: 3 },
    { name: 'المرشحون المحتملون',       type: 'customer',  influence: 2, interest: 4 },
    { name: 'شركات التوظيف',            type: 'supplier',  influence: 2, interest: 3 },
    { name: 'الجامعات ومراكز التدريب',   type: 'supplier',  influence: 2, interest: 3 },
  ],
  FINANCE: [
    { name: 'المساهمون',                 type: 'investor',  influence: 5, interest: 5 },
    { name: 'مجلس الإدارة/لجنة التدقيق', type: 'internal',  influence: 5, interest: 5 },
    { name: 'ZATCA (الضرائب)',           type: 'regulator', influence: 5, interest: 3 },
    { name: 'CMA (هيئة السوق المالية)',  type: 'regulator', influence: 4, interest: 4 },
    { name: 'SAMA (البنك المركزي)',      type: 'regulator', influence: 4, interest: 3 },
    { name: 'البنوك الممولة',             type: 'supplier',  influence: 4, interest: 4 },
    { name: 'المدققون الخارجيون',        type: 'supplier',  influence: 3, interest: 4 },
    { name: 'العملاء والموردون',          type: 'customer',  influence: 3, interest: 3 },
  ],
  SALES: [
    { name: 'العملاء الحاليون الرئيسيون', type: 'customer',  influence: 5, interest: 5 },
    { name: 'العملاء المحتملون',          type: 'customer',  influence: 3, interest: 4 },
    { name: 'الشركاء والموزّعون',         type: 'supplier',  influence: 4, interest: 4 },
    { name: 'المدير التنفيذي / CEO',     type: 'internal',  influence: 5, interest: 4 },
    { name: 'إدارة التسويق',              type: 'internal',  influence: 3, interest: 4 },
    { name: 'إدارة المنتج/الإنتاج',      type: 'internal',  influence: 3, interest: 3 },
    { name: 'إدارة المالية (فوترة)',     type: 'internal',  influence: 3, interest: 3 },
  ],
  MARKETING: [
    { name: 'الجمهور المستهدف',           type: 'customer',  influence: 4, interest: 5 },
    { name: 'العملاء الحاليون',           type: 'customer',  influence: 4, interest: 4 },
    { name: 'المؤثّرون (KOLs)',           type: 'other',     influence: 3, interest: 3 },
    { name: 'وكالات إبداعية/إعلانية',    type: 'supplier',  influence: 3, interest: 3 },
    { name: 'المنصّات الإعلانية (Meta/Google)', type: 'supplier', influence: 4, interest: 3 },
    { name: 'المدير التنفيذي / CEO',     type: 'internal',  influence: 5, interest: 4 },
    { name: 'إدارة المبيعات',             type: 'internal',  influence: 4, interest: 5 },
  ],
  OPERATIONS: [
    { name: 'الفريق التشغيلي',            type: 'internal',  influence: 3, interest: 5 },
    { name: 'الموردون الحرجون',           type: 'supplier',  influence: 5, interest: 4 },
    { name: 'إدارة الجودة',                type: 'internal',  influence: 4, interest: 5 },
    { name: 'الهيئة السعودية للمواصفات (SASO)', type: 'regulator', influence: 4, interest: 3 },
    { name: 'العملاء (طلبات)',             type: 'customer',  influence: 4, interest: 5 },
    { name: 'إدارة الصيانة',               type: 'internal',  influence: 3, interest: 4 },
    { name: 'إدارة الأمن والسلامة',       type: 'internal',  influence: 3, interest: 4 },
  ],
  IT: [
    { name: 'الأقسام الداخلية (كعميل)',   type: 'customer',  influence: 4, interest: 5 },
    { name: 'مزوّدو السحابة (AWS/Azure)', type: 'supplier',  influence: 4, interest: 3 },
    { name: 'الهيئة الوطنية للأمن السيبراني (NCA)', type: 'regulator', influence: 5, interest: 3 },
    { name: 'الهيئة السعودية للبيانات (SDAIA)', type: 'regulator', influence: 4, interest: 3 },
    { name: 'مزوّدو SaaS الرئيسيون',      type: 'supplier',  influence: 4, interest: 3 },
    { name: 'الفريق التقني الداخلي',      type: 'internal',  influence: 3, interest: 5 },
    { name: 'CEO/CFO',                    type: 'internal',  influence: 5, interest: 4 },
  ],
  CUSTOMER_SERVICE: [
    { name: 'العملاء (جميعهم)',           type: 'customer',  influence: 5, interest: 5 },
    { name: 'وكلاء الدعم',                type: 'internal',  influence: 3, interest: 5 },
    { name: 'إدارة المنتج',               type: 'internal',  influence: 3, interest: 4 },
    { name: 'إدارة المبيعات',             type: 'internal',  influence: 3, interest: 4 },
    { name: 'إدارة التسويق',              type: 'internal',  influence: 3, interest: 4 },
    { name: 'مزوّدو الأدوات (Zendesk/Intercom)', type: 'supplier', influence: 3, interest: 3 },
    { name: 'شركاء BPO',                  type: 'supplier',  influence: 3, interest: 3 },
  ],
  SUPPORT: [
    { name: 'الأقسام الداخلية',           type: 'customer',  influence: 4, interest: 5 },
    { name: 'الموردون الرئيسيون',         type: 'supplier',  influence: 5, interest: 4 },
    { name: 'CFO / إدارة المالية',        type: 'internal',  influence: 5, interest: 4 },
    { name: 'الإدارة القانونية',           type: 'internal',  influence: 4, interest: 3 },
    { name: 'مجلس الإدارة (عقود كبيرة)',  type: 'internal',  influence: 5, interest: 3 },
    { name: 'الهيئة العامة للجمارك',      type: 'regulator', influence: 3, interest: 3 },
  ],
  LOGISTICS: [
    { name: 'شركات الشحن',                type: 'supplier',  influence: 5, interest: 4 },
    { name: 'مزوّدو المستودعات',          type: 'supplier',  influence: 4, interest: 4 },
    { name: 'العملاء (نهائيون)',          type: 'customer',  influence: 4, interest: 5 },
    { name: 'إدارة المشتريات',             type: 'internal',  influence: 3, interest: 4 },
    { name: 'الهيئة العامة للنقل',        type: 'regulator', influence: 4, interest: 3 },
    { name: 'الجمارك',                     type: 'regulator', influence: 4, interest: 3 },
    { name: 'مزوّدو WMS/TMS',              type: 'supplier',  influence: 3, interest: 3 },
  ],
  QUALITY: [
    { name: 'العملاء الرئيسيون',           type: 'customer',  influence: 5, interest: 5 },
    { name: 'إدارة العمليات',              type: 'internal',  influence: 4, interest: 5 },
    { name: 'مختبرات الفحص',              type: 'supplier',  influence: 3, interest: 3 },
    { name: 'الهيئة السعودية للمواصفات',   type: 'regulator', influence: 5, interest: 3 },
    { name: 'الهيئة الغذاء والدواء (SFDA)', type: 'regulator', influence: 4, interest: 3 },
    { name: 'مقيّمو ISO',                  type: 'supplier',  influence: 4, interest: 3 },
    { name: 'الفريق الداخلي',             type: 'internal',  influence: 3, interest: 5 },
  ],
  PROJECTS: [
    { name: 'رعاة المشاريع (Sponsors)',    type: 'internal',  influence: 5, interest: 5 },
    { name: 'مالكو المنتج/الأعمال',       type: 'internal',  influence: 4, interest: 5 },
    { name: 'المقاولون والمستشارون',       type: 'supplier',  influence: 4, interest: 4 },
    { name: 'الفريق التنفيذي للمشروع',    type: 'internal',  influence: 3, interest: 5 },
    { name: 'المستخدمون النهائيون',       type: 'customer',  influence: 3, interest: 4 },
    { name: 'إدارة المالية (ميزانية)',     type: 'internal',  influence: 4, interest: 3 },
    { name: 'إدارة IT (تكامل)',            type: 'internal',  influence: 3, interest: 3 },
  ],
  COMPLIANCE: [
    { name: 'مجلس الإدارة/لجنة التدقيق',   type: 'internal',  influence: 5, interest: 5 },
    { name: 'CMA / SAMA / ZATCA',          type: 'regulator', influence: 5, interest: 3 },
    { name: 'المدقق الداخلي',              type: 'internal',  influence: 4, interest: 4 },
    { name: 'المدقق الخارجي',              type: 'supplier',  influence: 3, interest: 4 },
    { name: 'المستشارون القانونيون',        type: 'supplier',  influence: 3, interest: 4 },
    { name: 'الموظفون (كمنفّذين)',         type: 'internal',  influence: 3, interest: 3 },
    { name: 'المستفيدون من البيانات (PDPL)', type: 'customer',  influence: 3, interest: 4 },
  ],
  GOVERNANCE: [
    { name: 'المساهمون',                   type: 'investor',  influence: 5, interest: 5 },
    { name: 'مجلس الإدارة',                type: 'internal',  influence: 5, interest: 5 },
    { name: 'لجان المجلس (تدقيق/مخاطر)',   type: 'internal',  influence: 5, interest: 5 },
    { name: 'CMA (هيئة السوق المالية)',    type: 'regulator', influence: 5, interest: 4 },
    { name: 'أمانة المجلس',                type: 'internal',  influence: 3, interest: 5 },
    { name: 'المدقق الخارجي',              type: 'supplier',  influence: 3, interest: 4 },
    { name: 'مستشارو الحوكمة',              type: 'supplier',  influence: 3, interest: 3 },
    { name: 'وسائل الإعلام / السوق',       type: 'other',     influence: 3, interest: 3 },
  ],
}
