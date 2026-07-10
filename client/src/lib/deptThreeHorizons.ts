// ─── نموذج McKinsey للآفاق الثلاثة — تكيّف حسب الإدارة ────────────
// المصدر: McKinsey Three Horizons of Growth.
//   H1 (٠-١٢ شهر):  حافظ على الجوهر — تحسين ما نفعله اليوم.
//   H2 (١٢-٣٦ شهر): اصنع النمو — قدرات ناشئة تصير جوهراً قريباً.
//   H3 (٣٦+ شهر):   استثمر في المستقبل — رهانات استكشافية.
//
// كل تخصّص عنده مجموعة مقترحات جاهزة لكل أفق مبنيّة على سياق السوق
// السعودي (رؤية 2030 + التحوّل الرقمي + التوطين + الاستدامة).

import type { DeptCode } from './deptApi'

export type Horizon = 'h1' | 'h2' | 'h3'

export interface HorizonSuggestion {
  title: string
  horizon: Horizon
}

export const DEPT_THREE_HORIZONS: Partial<Record<DeptCode, HorizonSuggestion[]>> = {
  HR: [
    // H1 — تحسين ما نفعله اليوم
    { title: 'خفض معدل الدوران السنوي إلى ١٢٪',                    horizon: 'h1' },
    { title: 'تطبيق برنامج تأهيل ٩٠ يوم للموظفين الجدد',            horizon: 'h1' },
    { title: 'رفع نسبة السعودة إلى النطاق البلاتيني',              horizon: 'h1' },
    { title: 'تدقيق سلم الرواتب مقابل السوق',                       horizon: 'h1' },
    // H2 — قدرات ناشئة
    { title: 'HRIS متكامل مع التقييم والرواتب والأداء',            horizon: 'h2' },
    { title: 'إطار مسارات مهنية داخلية (Career Mobility)',          horizon: 'h2' },
    { title: 'برامج قيادة داخلية + تخطيط تعاقب',                    horizon: 'h2' },
    { title: 'ذكاء اصطناعي في فرز السير الذاتية',                   horizon: 'h2' },
    // H3 — رهانات مستقبلية
    { title: 'Talent Marketplace داخلي عابر للأقسام',              horizon: 'h3' },
    { title: 'ثقافة عمل هجينة/عن بُعد بلا حدود جغرافية',            horizon: 'h3' },
    { title: 'Well-being 360 (صحّة نفسية + جسدية + مالية)',        horizon: 'h3' },
    { title: 'شراكة مع منصّات Web3 لمكافآت غير تقليدية',            horizon: 'h3' },
  ],

  FINANCE: [
    { title: 'خفض دورة إغلاق الشهر إلى ٥ أيام',                    horizon: 'h1' },
    { title: 'خفض DSO بـ١٠ أيام',                                    horizon: 'h1' },
    { title: 'تشديد ضوابط الرقابة الداخلية (SoD)',                  horizon: 'h1' },
    { title: 'التزام ZATCA + IFRS كامل',                            horizon: 'h1' },
    { title: 'Rolling Forecast ربعي',                                horizon: 'h2' },
    { title: 'لوحات BI مباشرة للقيادة',                              horizon: 'h2' },
    { title: 'أتمتة الفواتير والمدفوعات (AP Automation)',            horizon: 'h2' },
    { title: 'Driver-based budgeting بدل ميزانية جامدة',             horizon: 'h2' },
    { title: 'AI CFO Copilot لتحليل الأسئلة',                       horizon: 'h3' },
    { title: 'إغلاق مالي مستمر (Continuous Close)',                 horizon: 'h3' },
    { title: 'دمج ESG في التقارير المالية',                          horizon: 'h3' },
    { title: 'استخدام Blockchain للتدقيق الفوري',                   horizon: 'h3' },
  ],

  SALES: [
    { title: 'تحقيق مستهدف الإيرادات السنوي',                       horizon: 'h1' },
    { title: 'رفع معدل التحويل إلى ٢٥٪',                            horizon: 'h1' },
    { title: 'خفض دورة البيع بـ٣٠٪',                                 horizon: 'h1' },
    { title: 'اعتماد CRM كامل على مستوى الفريق',                   horizon: 'h1' },
    { title: 'إطلاق برنامج الحسابات الرئيسية (KAM)',                horizon: 'h2' },
    { title: 'قنوات بيع رقمية (E-commerce/Marketplace)',            horizon: 'h2' },
    { title: 'Sales Enablement + Playbooks',                          horizon: 'h2' },
    { title: 'التوسّع في الشراكات الإقليمية',                        horizon: 'h2' },
    { title: 'مبيعات مدفوعة بالذكاء الاصطناعي (AI Deal Scoring)',   horizon: 'h3' },
    { title: 'Product-Led Growth بدل تركيز على البيع المباشر',      horizon: 'h3' },
    { title: 'Community-Based Sales (المجتمعات كقنوات)',             horizon: 'h3' },
    { title: 'الاستفادة من MetaVerse للعروض التفاعلية',              horizon: 'h3' },
  ],

  MARKETING: [
    { title: 'رفع ROAS الحملات المدفوعة',                            horizon: 'h1' },
    { title: 'تحسين معدل تحويل MQL إلى SQL',                        horizon: 'h1' },
    { title: 'توحيد دليل هوية العلامة',                              horizon: 'h1' },
    { title: 'خفض CAC بـ٢٠٪',                                        horizon: 'h1' },
    { title: 'MarTech Stack متكامل (CDP + Automation)',              horizon: 'h2' },
    { title: 'شخصنة على نطاق واسع (Personalization at Scale)',      horizon: 'h2' },
    { title: 'مصنع محتوى (Content Factory) داخلي',                   horizon: 'h2' },
    { title: 'برامج المؤثّرين (KOL) المنتظمة',                        horizon: 'h2' },
    { title: 'محتوى مولَّد بالذكاء الاصطناعي (AI Creative)',         horizon: 'h3' },
    { title: 'تجارب علامة غامرة (VR/AR Brand)',                     horizon: 'h3' },
    { title: 'Zero-party data ecosystem',                            horizon: 'h3' },
    { title: 'Metaverse + Web3 marketing',                            horizon: 'h3' },
  ],

  OPERATIONS: [
    { title: 'رفع OEE إلى ٨٥٪',                                      horizon: 'h1' },
    { title: 'خفض معدل العيوب إلى تحت ٢٪',                          horizon: 'h1' },
    { title: 'تطبيق Lean في خطوط الإنتاج الرئيسية',                horizon: 'h1' },
    { title: 'الالتزام بمواعيد التسليم (OTIF) ≥ ٩٥٪',              horizon: 'h1' },
    { title: 'أتمتة RPA للعمليات الإدارية',                          horizon: 'h2' },
    { title: 'IoT للصيانة التنبّؤية',                                 horizon: 'h2' },
    { title: 'S&OP متكامل مع البيع والمالية',                       horizon: 'h2' },
    { title: 'إدارة سلسلة إمداد نهاية-إلى-نهاية',                    horizon: 'h2' },
    { title: 'مصنع ذاتي التشغيل (Autonomous Factory)',              horizon: 'h3' },
    { title: 'Digital Twin للمنشأة الكاملة',                          horizon: 'h3' },
    { title: 'تصنيع دائري (Circular Manufacturing) صديق للبيئة',     horizon: 'h3' },
    { title: 'الإنتاج بالطلب (On-Demand Manufacturing)',              horizon: 'h3' },
  ],

  IT: [
    { title: 'Uptime ≥ ٩٩.٩٪ للأنظمة الحرجة',                       horizon: 'h1' },
    { title: 'تعزيز الأمن السيبراني (Zero Trust)',                  horizon: 'h1' },
    { title: 'التزام SLA + خفض MTTR',                               horizon: 'h1' },
    { title: 'ترشيد اشتراكات SaaS',                                 horizon: 'h1' },
    { title: 'ترحيل كامل للسحابة (Cloud Migration)',                horizon: 'h2' },
    { title: 'CI/CD متكامل + DevSecOps',                             horizon: 'h2' },
    { title: 'منصّة بيانات موحّدة (Data Platform)',                 horizon: 'h2' },
    { title: 'Low-code/No-code للأقسام الأخرى',                     horizon: 'h2' },
    { title: 'AI في كل نظام (AI-first)',                            horizon: 'h3' },
    { title: 'الحوسبة الكمية للتشفير المستقبلي',                    horizon: 'h3' },
    { title: 'Web3 identity + wallets للمستخدمين',                   horizon: 'h3' },
    { title: 'Edge Computing لتطبيقات IoT',                          horizon: 'h3' },
  ],

  CUSTOMER_SERVICE: [
    { title: 'رفع FCR إلى ≥ ٧٠٪',                                    horizon: 'h1' },
    { title: 'تحسين CSAT إلى ≥ ٨٥٪',                                horizon: 'h1' },
    { title: 'خفض زمن الاستجابة الأول إلى < ١٥ دقيقة',              horizon: 'h1' },
    { title: 'تدريب الوكلاء على التعاطف والحلول',                    horizon: 'h1' },
    { title: 'منصّة Omnichannel موحّدة',                             horizon: 'h2' },
    { title: 'شات‑بوت ذكي بالعربية',                                 horizon: 'h2' },
    { title: 'بوابة Self-service للعملاء',                           horizon: 'h2' },
    { title: 'قاعدة معرفة رقمية + AI Search',                       horizon: 'h2' },
    { title: 'Emotion AI لتحليل نبرة العميل',                       horizon: 'h3' },
    { title: 'دعم استباقي مدفوع بالتنبّؤ',                           horizon: 'h3' },
    { title: 'مجتمع عملاء (Community-Driven Support)',              horizon: 'h3' },
    { title: 'مساعدون افتراضيون بأصوات مخصّصة',                    horizon: 'h3' },
  ],

  SUPPORT: [
    { title: 'تطبيق e-Procurement على كل الأقسام',                   horizon: 'h1' },
    { title: 'توفير سنوي ٥-١٠٪ من ميزانية المشتريات',              horizon: 'h1' },
    { title: 'تقييم دوري للموردين (Supplier Scorecard)',            horizon: 'h1' },
    { title: 'تشديد التزام SLA للطلبات الداخلية',                   horizon: 'h1' },
    { title: 'إدارة تصنيفات (Category Management)',                  horizon: 'h2' },
    { title: 'تحليلات الإنفاق (Spend Analytics)',                    horizon: 'h2' },
    { title: 'مشتريات مستدامة (Sustainable Procurement)',            horizon: 'h2' },
    { title: 'CLM ذكي + AI في العقود',                             horizon: 'h2' },
    { title: 'مشتريات ذاتية (Autonomous Procurement)',              horizon: 'h3' },
    { title: 'Blockchain للتوريد وسلاسل الإمداد',                    horizon: 'h3' },
    { title: 'اقتصاد دائري (Circular Supply Chain)',                 horizon: 'h3' },
    { title: 'شراكات استراتيجية طويلة الأمد',                       horizon: 'h3' },
  ],

  LOGISTICS: [
    { title: 'رفع OTIF إلى ≥ ٩٥٪',                                  horizon: 'h1' },
    { title: 'خفض تكلفة الشحن للطلب بـ١٥٪',                        horizon: 'h1' },
    { title: 'تحسين دقة المخزون إلى ٩٨٪+',                          horizon: 'h1' },
    { title: 'تنويع الناقلين لخفض المخاطر',                          horizon: 'h1' },
    { title: 'WMS + TMS متكاملان',                                    horizon: 'h2' },
    { title: 'تحسين مسارات بالذكاء الاصطناعي',                     horizon: 'h2' },
    { title: 'تسليم في اليوم نفسه في المدن الرئيسية',                horizon: 'h2' },
    { title: 'مستودعات آلية (Automated Warehouses)',                horizon: 'h2' },
    { title: 'تسليم بالطائرات المسيّرة (Drones)',                     horizon: 'h3' },
    { title: 'مركبات ذاتية القيادة للنقل',                           horizon: 'h3' },
    { title: 'مستودعات مصغّرة (Micro-Fulfillment)',                  horizon: 'h3' },
    { title: 'شبكة توزيع كاربونية صفرية',                            horizon: 'h3' },
  ],

  QUALITY: [
    { title: 'خفض معدل العيوب (DPMO) إلى ٦ سيغما',                  horizon: 'h1' },
    { title: 'تسريع إغلاق CAPA إلى < ٣٠ يوم',                       horizon: 'h1' },
    { title: 'تجديد شهادات ISO 9001',                                horizon: 'h1' },
    { title: 'تدريب كل الموظفين على أساسيات الجودة',                 horizon: 'h1' },
    { title: 'SPC رقمي حي (Real-time SPC)',                          horizon: 'h2' },
    { title: 'منصّة QMS متكاملة',                                    horizon: 'h2' },
    { title: 'برنامج جودة الموردين',                                 horizon: 'h2' },
    { title: 'حصول Green/Black Belts للفريق',                       horizon: 'h2' },
    { title: 'صفر عيوب بالذكاء الاصطناعي (AI Vision)',              horizon: 'h3' },
    { title: 'Quality-as-a-Service للأقسام الأخرى',                  horizon: 'h3' },
    { title: 'مقاييس استدامة مدموجة (ESG Quality)',                  horizon: 'h3' },
    { title: 'اختبارات محاكاة رقمية (Digital Twin Testing)',        horizon: 'h3' },
  ],

  PROJECTS: [
    { title: 'رفع نسبة التسليم في الموعد إلى ٩٠٪',                   horizon: 'h1' },
    { title: 'خفض انحراف الميزانية إلى < ٥٪',                        horizon: 'h1' },
    { title: 'اعتماد منهجية موحّدة (PMBOK/Agile)',                  horizon: 'h1' },
    { title: 'تسجيل شهادات PMP للفريق',                              horizon: 'h1' },
    { title: 'Agile Hybrid + SAFe للمشاريع الكبرى',                horizon: 'h2' },
    { title: 'أدوات PM سحابية متكاملة',                              horizon: 'h2' },
    { title: 'تخصيص موارد ذكي (Resource Optimization)',             horizon: 'h2' },
    { title: 'تحليلات المحفظة (Portfolio Analytics)',                horizon: 'h2' },
    { title: 'إدارة مشاريع بالذكاء الاصطناعي',                     horizon: 'h3' },
    { title: 'تنبّؤ المخاطر (Monte Carlo + AI)',                    horizon: 'h3' },
    { title: 'فرق ديناميكية عالمية عن بُعد',                          horizon: 'h3' },
    { title: 'إدارة مشاريع تعاونية (No-code Collaborative PM)',      horizon: 'h3' },
  ],

  COMPLIANCE: [
    { title: 'التزام ZATCA ١٠٠٪ + الفاتورة الإلكترونية',            horizon: 'h1' },
    { title: 'استعداد كامل لـPDPL',                                  horizon: 'h1' },
    { title: 'تدريب الموظفين ١٠٠٪ على الالتزام',                   horizon: 'h1' },
    { title: 'مراجعة السياسات وتحديثها',                             horizon: 'h1' },
    { title: 'اعتماد منصّة GRC متكاملة',                              horizon: 'h2' },
    { title: 'أتمتة الرصد التنظيمي (RegTech)',                       horizon: 'h2' },
    { title: 'إطار ESG داخل الشركة',                                 horizon: 'h2' },
    { title: 'برامج نزاهة وأخلاقيات موسّعة',                          horizon: 'h2' },
    { title: 'التزام تنبّؤي (Predictive Compliance)',                horizon: 'h3' },
    { title: 'رقابة ذاتية بالذكاء الاصطناعي 24/7',                  horizon: 'h3' },
    { title: 'إفصاح آني (Real-time Disclosure)',                    horizon: 'h3' },
    { title: 'Blockchain للتتبّع والإثبات',                          horizon: 'h3' },
  ],

  GOVERNANCE: [
    { title: 'رفع حضور المجلس إلى ≥ ٩٠٪',                            horizon: 'h1' },
    { title: 'إفصاحات دورية بلا تأخّر',                              horizon: 'h1' },
    { title: 'استقلالية اللجان + مواثيق محدَّثة',                    horizon: 'h1' },
    { title: 'تدقيق داخلي مستقل',                                    horizon: 'h1' },
    { title: 'Board Portal رقمي بالكامل',                             horizon: 'h2' },
    { title: 'إطار ESG مربوط بمكافآت التنفيذيين',                    horizon: 'h2' },
    { title: 'برامج تفاعل أصحاب المصلحة (Stakeholder Engagement)', horizon: 'h2' },
    { title: 'مؤشّرات الحوكمة (KPIs) للمجلس',                        horizon: 'h2' },
    { title: 'مساعد ذكاء اصطناعي للمجلس',                            horizon: 'h3' },
    { title: 'حوكمة بـBlockchain (قرارات + تصويت)',                  horizon: 'h3' },
    { title: 'تصنيف حوكمة عالمي (Global Governance Rating)',        horizon: 'h3' },
    { title: 'دمج معايير OECD + UN Compact',                        horizon: 'h3' },
  ],
}

// ─── معلومات وصفية عن كل أفق (نفس لكل تخصّص) ───────────────────
export const HORIZON_META: Record<Horizon, {
  labelAr: string
  descAr: string
  timeline: string
  icon: string
  colorClass: string
}> = {
  h1: {
    labelAr:     'الأفق ١ — الجوهر الحالي',
    descAr:      'حافظ على الجوهر — العمليات المُولّدة للدخل اليوم.',
    timeline:    '٠-١٢ شهر',
    icon:        '🏗️',
    colorClass:  'border-emerald-300 bg-gradient-to-br from-emerald-500/15 to-transparent',
  },
  h2: {
    labelAr:     'الأفق ٢ — النامي',
    descAr:      'اصنع النمو — قدرات ناشئة تُصبح جوهراً قريباً.',
    timeline:    '١٢-٣٦ شهر',
    icon:        '🌱',
    colorClass:  'border-sky-300 bg-gradient-to-br from-sky-500/15 to-transparent',
  },
  h3: {
    labelAr:     'الأفق ٣ — التجريبي',
    descAr:      'استثمر في المستقبل — رهانات استكشافية بعيدة.',
    timeline:    '٣٦+ شهر',
    icon:        '🔭',
    colorClass:  'border-violet-300 bg-gradient-to-br from-violet-500/15 to-transparent',
  },
}
