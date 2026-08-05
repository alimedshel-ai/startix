// بنوك أسئلة تدقيق الأقسام. لكل قسم تدقيق أساسي و(للأقسام التي تدعمها)
// تدقيق Pro بأسئلة أعمق. كل سؤال موسوم بمحور — حوكمة، مالية، فريق، رقمي —
// مع تقييم Likert 0..3 لكل خيار. auditEngine يضبط النقاط الخام لسقف
// المحور (حوكمة/مالية 30، فريق/رقمي 20).

import type { EntitySize } from '@prisma/client';

export type AuditAxis = 'governance' | 'financial' | 'team' | 'digital';

// حجم الكيان — مشتقٌّ حرفيّاً من enum EntitySize في Prisma (schema.prisma)، لا
// اتّحادٌ يدويّ: إضافةُ حجمٍ خامس للـ enum تكسر الترجمة هنا فوراً بدل الانحراف
// الصامت. الفلترة بالحجم مستقلّة عن الاشتراك: البُعدان متعامدان (الحجم يقرّر
// أيّ أسئلة بنيويّة، الاشتراك يقرّر basic/pro).
export type CompanySize = EntitySize;
const SIZE_RANK: Record<CompanySize, number> = { MICRO: 0, SMALL: 1, MEDIUM: 2, LARGE: 3 };

export type DeptCode =
  | 'HR'
  | 'FINANCE'
  | 'SALES'
  | 'MARKETING'
  | 'OPERATIONS'
  | 'IT'
  | 'CUSTOMER_SERVICE'
  | 'SUPPORT'
  | 'LOGISTICS'
  | 'QUALITY'
  | 'PROJECTS'
  | 'GOVERNANCE'
  | 'COMPLIANCE';

export interface DeptQOption {
  value: string;
  label: string;
  score: 0 | 1 | 2 | 3;
}

export interface DeptQuestion {
  id: string;
  axis: AuditAxis;
  prompt: string;
  options: [DeptQOption, DeptQOption, DeptQOption, DeptQOption];
  // أدنى حجم يُظهر السؤال. غيابه = MICRO = يظهر للجميع (النواة العالميّة).
  minSize?: CompanySize;
}

export interface DeptBank {
  basic: DeptQuestion[];
  pro?: DeptQuestion[];
}

// مولّد مختصر لكي يبقى الملف قابلاً للقراءة. كل سؤال 4 خيارات Likert
// (none / partial / good / great → 0..3).
function q(
  id: string,
  axis: AuditAxis,
  prompt: string,
  labels: [string, string, string, string],
  minSize?: CompanySize
): DeptQuestion {
  return {
    id,
    axis,
    prompt,
    options: [
      { value: 'none', label: labels[0], score: 0 },
      { value: 'partial', label: labels[1], score: 1 },
      { value: 'good', label: labels[2], score: 2 },
      { value: 'great', label: labels[3], score: 3 },
    ],
    ...(minSize ? { minSize } : {}),
  };
}

const STANDARD_LIKERT: [string, string, string, string] = [
  'غير موجود',
  'جزئي / غير منتظم',
  'موجود وموثّق',
  'محسّن ومُقاس',
];

// ─── الموارد البشرية ─────────────────────────────────────────────────────────
const HR: DeptBank = {
  basic: [
    q('hr_gov_1', 'governance', 'سياسات موارد بشرية مكتوبة (توظيف، إنهاء، إجازات)', STANDARD_LIKERT),
    q('hr_gov_2', 'governance', 'هيكل تنظيمي ومسؤوليات موثّقة', STANDARD_LIKERT),
    q('hr_gov_3', 'governance', 'دورة تقييم أداء', STANDARD_LIKERT),
    q('hr_fin_1', 'financial', 'عملية الرواتب ودقّتها', STANDARD_LIKERT),
    q('hr_fin_2', 'financial', 'مقارنة مرجعية للأجور', STANDARD_LIKERT),
    q('hr_fin_3', 'financial', 'تتبّع تكلفة الموارد البشرية لكل موظف', STANDARD_LIKERT),
    q('hr_team_1', 'team', 'برنامج تأهيل للموظفين الجدد', STANDARD_LIKERT),
    q('hr_team_2', 'team', 'خطة تدريب وتطوير', STANDARD_LIKERT),
    q('hr_team_3', 'team', 'استطلاعات اندماج / نبض الموظفين', STANDARD_LIKERT),
    q('hr_dig_1', 'digital', 'نظام معلومات الموارد البشرية (HRIS)', STANDARD_LIKERT),
    q('hr_dig_2', 'digital', 'تتبّع رقمي للإجازات والحضور', STANDARD_LIKERT),
    q('hr_dig_3', 'digital', 'بوّابة خدمة ذاتية للموظفين', STANDARD_LIKERT),
    // ── أسئلة بنيويّة موسومة بالحجم (§2، مستقلّة عن الاشتراك) ──
    // صيغت قياساً للقدرة لا افتراضاً للبنية: الكيان الواحد الموقع يجيب بصدق «تامّ»
    // (لا عقوبة على بنية)، ومتمايزة نصّاً عن أسئلة محورها في النواة الـ١٢.
    q('hr_gov_4', 'governance', 'تخطيط القوى العاملة المستقبليّة (أعداد وكفاءات) بأفق ١٢ شهراً', STANDARD_LIKERT, 'MEDIUM'),
    q('hr_gov_5', 'governance', 'نطاق الإشراف مُقاس ومضبوط (متوسّط عدد المرؤوسين لكل مدير)', STANDARD_LIKERT, 'MEDIUM'),
    q('hr_team_4', 'team', 'اتّساق ممارسات الموارد البشرية (سياسات وإجراءات) عبر كل وحدات الشركة', STANDARD_LIKERT, 'MEDIUM'),
    q('hr_fin_4', 'financial', 'تُخطَّط وتُوازَن تكلفة القوى العاملة مسبقاً لكل وحدة تشغيليّة', STANDARD_LIKERT, 'MEDIUM'),
    q('hr_dig_4', 'digital', 'أنظمة الموارد البشرية متكاملة ومتزامنة (HRIS ↔ الرواتب/ERP) دون إدخال مزدوج', STANDARD_LIKERT, 'LARGE'),
  ],
  pro: [
    q('hr_pro_gov_1', 'governance', 'خطة تعاقب للأدوار الرئيسية', STANDARD_LIKERT),
    q('hr_pro_gov_2', 'governance', 'ميثاق سلوك مهني وعملية تظلّمات', STANDARD_LIKERT),
    q('hr_pro_fin_1', 'financial', 'أجر متغيّر / حوافز مربوطة بمؤشرات الأداء', STANDARD_LIKERT),
    q('hr_pro_fin_2', 'financial', 'بيان مكافآت إجمالية يُصدر سنوياً', STANDARD_LIKERT),
    q('hr_pro_team_1', 'team', 'خط أنابيب تطوير قيادي', STANDARD_LIKERT),
    q('hr_pro_team_2', 'team', 'تتبّع أهداف التنوّع والشمول', STANDARD_LIKERT),
    q('hr_pro_dig_1', 'digital', 'لوحة تحليلات الموظفين', STANDARD_LIKERT),
    q('hr_pro_dig_2', 'digital', 'نظام إدارة التعلّم', STANDARD_LIKERT),
  ],
};

// ─── المالية ─────────────────────────────────────────────────────────────────
const FINANCE: DeptBank = {
  basic: [
    q('fin_gov_1', 'governance', 'مصفوفة اعتماد للإنفاق', STANDARD_LIKERT),
    q('fin_gov_2', 'governance', 'الفصل بين المهام (موردين / عملاء / خزينة)', STANDARD_LIKERT),
    q('fin_gov_3', 'governance', 'تدقيق خارجي منجز', STANDARD_LIKERT),
    q('fin_fin_1', 'financial', 'دورة الإقفال الشهري في موعدها', STANDARD_LIKERT),
    q('fin_fin_2', 'financial', 'تنبؤ تدفّق نقدي متجدد لـ 13 أسبوعاً', STANDARD_LIKERT),
    q('fin_fin_3', 'financial', 'تتبّع فروقات الموازنة مقابل الفعلي', STANDARD_LIKERT),
    q('fin_team_1', 'team', 'موظفو مالية مؤهلون (CPA/CMA)', STANDARD_LIKERT),
    q('fin_team_2', 'team', 'تدريب متبادل داخل فريق المالية', STANDARD_LIKERT),
    q('fin_team_3', 'team', 'تعليم مستمر / ساعات CPE', STANDARD_LIKERT),
    q('fin_dig_1', 'digital', 'برنامج محاسبة (ERP / سحابي)', STANDARD_LIKERT),
    q('fin_dig_2', 'digital', 'مطابقة بنكية آلية', STANDARD_LIKERT),
    q('fin_dig_3', 'digital', 'لوحة ذكاء أعمال لمؤشرات المالية', STANDARD_LIKERT),
    // ── أسئلة بنيويّة موسومة بالحجم (§2). قوبلت بالنواة قبل الاعتماد (قاعدة ٨.١)،
    // وصيغت قياساً للقدرة لا افتراضاً للبنية (قاعدة ٨.٢). FINANCE بلا بنك pro.
    q('fin_gov_4', 'governance', 'وظيفة خزينة: إدارة العلاقات البنكيّة والفائض والتسهيلات', STANDARD_LIKERT, 'MEDIUM'),
    q('fin_gov_5', 'governance', 'القوائم الماليّة موحَّدة عبر كل الكيانات التي تملكها الشركة', STANDARD_LIKERT, 'LARGE'),
    q('fin_fin_4', 'financial', 'محاسبة تكاليف عبر مراكز تكلفة/أنشطة (توزيع التكلفة على الوحدات)', STANDARD_LIKERT, 'MEDIUM'),
    q('fin_fin_5', 'financial', 'تخطيط ماليّ استشرافيّ ونمذجة سيناريوهات (ماذا-لو) للقرارات', STANDARD_LIKERT, 'LARGE'),
    q('fin_dig_4', 'digital', 'تكامل نظام المحاسبة مع أنظمة المصدر (مبيعات/مشتريات/مخزون) دون إدخال يدويّ', STANDARD_LIKERT, 'MEDIUM'),
    q('fin_team_4', 'team', 'فصل أدوار دورة المعاملة: أشخاص مستقلّون للإدخال والاعتماد والمطابقة', STANDARD_LIKERT, 'MEDIUM'),
  ],
};

// ─── المبيعات ────────────────────────────────────────────────────────────────
const SALES: DeptBank = {
  basic: [
    q('sales_gov_1', 'governance', 'عملية مبيعات / دليل لعب موثّق', STANDARD_LIKERT),
    q('sales_gov_2', 'governance', 'سير عمل اعتماد الأسعار', STANDARD_LIKERT),
    q('sales_gov_3', 'governance', 'عملية مراجعة العقود', STANDARD_LIKERT),
    q('sales_fin_1', 'financial', 'تحديد الحصص / المستهدفات لكل مندوب', STANDARD_LIKERT),
    q('sales_fin_2', 'financial', 'خطة عمولات موثّقة ومدفوعة في موعدها', STANDARD_LIKERT),
    q('sales_fin_3', 'financial', 'تتبّع قيمة الفرص مقابل الحصة', STANDARD_LIKERT),
    q('sales_team_1', 'team', 'برنامج تأهيل لمندوبي المبيعات الجدد', STANDARD_LIKERT),
    q('sales_team_2', 'team', 'تدريب مبيعات منتظم', STANDARD_LIKERT),
    q('sales_team_3', 'team', 'مراجعات الفوز / الخسارة', STANDARD_LIKERT),
    q('sales_dig_1', 'digital', 'نظام CRM مستخدم فعلياً', STANDARD_LIKERT),
    q('sales_dig_2', 'digital', 'تحليلات مبيعات / دقة التنبؤ', STANDARD_LIKERT),
    q('sales_dig_3', 'digital', 'أتمتة من العميل المحتمل إلى السداد', STANDARD_LIKERT),
  ],
  pro: [
    q('sales_pro_gov_1', 'governance', 'استراتيجية تقسيم الحسابات', STANDARD_LIKERT),
    q('sales_pro_fin_1', 'financial', 'تتبّع الهامش لكل صفقة', STANDARD_LIKERT),
    q('sales_pro_team_1', 'team', 'وظيفة تمكين مبيعات مأهولة', STANDARD_LIKERT),
    q('sales_pro_dig_1', 'digital', 'تقييم تنبؤي للعملاء المحتملين', STANDARD_LIKERT),
  ],
};

// ─── التسويق ─────────────────────────────────────────────────────────────────
const MARKETING: DeptBank = {
  basic: [
    q('mkt_gov_1', 'governance', 'إرشادات هوية موثّقة', STANDARD_LIKERT),
    q('mkt_gov_2', 'governance', 'استراتيجية تسويق متوافقة مع أهداف الأعمال', STANDARD_LIKERT),
    q('mkt_gov_3', 'governance', 'سير اعتماد الحملات', STANDARD_LIKERT),
    q('mkt_fin_1', 'financial', 'موازنة تسويق سنوية محدّدة', STANDARD_LIKERT),
    q('mkt_fin_2', 'financial', 'تتبّع العائد على الاستثمار / تكلفة الاستحواذ لكل قناة', STANDARD_LIKERT),
    q('mkt_fin_3', 'financial', 'أداة إسناد / مصدر حقيقة', STANDARD_LIKERT),
    q('mkt_team_1', 'team', 'أدوار تسويق محدّدة ومأهولة', STANDARD_LIKERT),
    q('mkt_team_2', 'team', 'إدارة علاقات مع الوكالات', STANDARD_LIKERT),
    q('mkt_team_3', 'team', 'تدريب على القنوات الحديثة', STANDARD_LIKERT),
    q('mkt_dig_1', 'digital', 'موقع إلكتروني + خط أساس SEO', STANDARD_LIKERT),
    q('mkt_dig_2', 'digital', 'أداة أتمتة تسويق', STANDARD_LIKERT),
    q('mkt_dig_3', 'digital', 'حضور وتحليلات على وسائل التواصل', STANDARD_LIKERT),
  ],
  pro: [
    q('mkt_pro_gov_1', 'governance', 'دليل لعب تسويق المنتج والتموضع', STANDARD_LIKERT),
    q('mkt_pro_fin_1', 'financial', 'قياس تحويل MQL → SQL', STANDARD_LIKERT),
    q('mkt_pro_team_1', 'team', 'فريق محتوى أو تقويم محتوى', STANDARD_LIKERT),
    q('mkt_pro_dig_1', 'digital', 'منصة بيانات عملاء موحّدة (CDP)', STANDARD_LIKERT),
  ],
};

// ─── العمليات ────────────────────────────────────────────────────────────────
const OPERATIONS: DeptBank = {
  basic: [
    q('ops_gov_1', 'governance', 'إجراءات تشغيل قياسية (SOP) للعمليات الجوهرية', STANDARD_LIKERT),
    q('ops_gov_2', 'governance', 'مراجعات تحسين مستمر / كايزن', STANDARD_LIKERT),
    q('ops_gov_3', 'governance', 'عملية إدارة الحوادث', STANDARD_LIKERT),
    q('ops_fin_1', 'financial', 'تتبّع تكلفة الوحدة / تكلفة المخرج', STANDARD_LIKERT),
    q('ops_fin_2', 'financial', 'تخطيط الطاقة مقابل الطلب', STANDARD_LIKERT),
    q('ops_fin_3', 'financial', 'موازنة تشغيل يمتلكها المدير', STANDARD_LIKERT),
    q('ops_team_1', 'team', 'تدريب متبادل عبر العمليات', STANDARD_LIKERT),
    q('ops_team_2', 'team', 'اجتماعات يومية / أسبوعية', STANDARD_LIKERT),
    q('ops_team_3', 'team', 'مصفوفة مهارات محدّثة', STANDARD_LIKERT),
    q('ops_dig_1', 'digital', 'أداة سير عمل / BPM', STANDARD_LIKERT),
    q('ops_dig_2', 'digital', 'لوحة تشغيل مباشرة', STANDARD_LIKERT),
    q('ops_dig_3', 'digital', 'أتمتة المهام المتكرّرة', STANDARD_LIKERT),
  ],
};

// ─── تقنية المعلومات ────────────────────────────────────────────────────────
const IT: DeptBank = {
  basic: [
    q('it_gov_1', 'governance', 'سياسة تقنية المعلومات وإدارة الوصول', STANDARD_LIKERT),
    q('it_gov_2', 'governance', 'سجل الموردين / SaaS محدّث', STANDARD_LIKERT),
    q('it_gov_3', 'governance', 'سياسة أمن المعلومات', STANDARD_LIKERT),
    q('it_fin_1', 'financial', 'تتبّع موازنة تقنية المعلومات', STANDARD_LIKERT),
    q('it_fin_2', 'financial', 'مراجعة تراخيص البرمجيات سنوياً', STANDARD_LIKERT),
    q('it_fin_3', 'financial', 'قياس تكلفة المستخدم / إجمالي ملكية', STANDARD_LIKERT),
    q('it_team_1', 'team', 'تغطية فريق تقنية المعلومات / استدعاء', STANDARD_LIKERT),
    q('it_team_2', 'team', 'تدريب توعوي على الأمن', STANDARD_LIKERT),
    q('it_team_3', 'team', 'شهادات / صيانة مهارات', STANDARD_LIKERT),
    q('it_dig_1', 'digital', 'نسخ احتياطية واستعادة مختبرة', STANDARD_LIKERT),
    q('it_dig_2', 'digital', 'حماية الأجهزة الطرفية + MFA', STANDARD_LIKERT),
    q('it_dig_3', 'digital', 'مراقبة السحابة / البنية التحتية', STANDARD_LIKERT),
  ],
};

// ─── خدمة العملاء ───────────────────────────────────────────────────────────
const CUSTOMER_SERVICE: DeptBank = {
  basic: [
    q('cs_gov_1', 'governance', 'اتفاقيات مستوى خدمة موثّقة', STANDARD_LIKERT),
    q('cs_gov_2', 'governance', 'مصفوفة تصعيد', STANDARD_LIKERT),
    q('cs_gov_3', 'governance', 'سياسة الشكاوى ومراجعة الأسباب الجذرية', STANDARD_LIKERT),
    q('cs_fin_1', 'financial', 'قياس تكلفة كل تذكرة', STANDARD_LIKERT),
    q('cs_fin_2', 'financial', 'تتبّع علاقة التكلفة برضا العميل', STANDARD_LIKERT),
    q('cs_fin_3', 'financial', 'مراجعة موازنة الخدمة فصلياً', STANDARD_LIKERT),
    q('cs_team_1', 'team', 'منهج تأهيل لممثلي الخدمة', STANDARD_LIKERT),
    q('cs_team_2', 'team', 'تدريب مبني على درجات الجودة', STANDARD_LIKERT),
    q('cs_team_3', 'team', 'تمكين الممثل من الحلّ بدون تصعيد', STANDARD_LIKERT),
    q('cs_dig_1', 'digital', 'نظام دعم / تذاكر', STANDARD_LIKERT),
    q('cs_dig_2', 'digital', 'قاعدة معرفة للموظفين والعملاء', STANDARD_LIKERT),
    q('cs_dig_3', 'digital', 'قنوات متعددة (صوت/دردشة/إيميل/تواصل)', STANDARD_LIKERT),
  ],
};

// ─── المشتريات والدعم ───────────────────────────────────────────────────────
const SUPPORT: DeptBank = {
  basic: [
    q('sup_gov_1', 'governance', 'إطار تقييم الموردين', STANDARD_LIKERT),
    q('sup_gov_2', 'governance', 'قائمة موردين رئيسية محدّثة', STANDARD_LIKERT),
    q('sup_gov_3', 'governance', 'سياسة مشتريات وحدودها', STANDARD_LIKERT),
    q('sup_fin_1', 'financial', 'مقارنة أسعار / عروض متعددة', STANDARD_LIKERT),
    q('sup_fin_2', 'financial', 'شروط دفع متفاوض عليها', STANDARD_LIKERT),
    q('sup_fin_3', 'financial', 'تحليلات إنفاق حسب الفئة', STANDARD_LIKERT),
    q('sup_team_1', 'team', 'تدريب المشترين على التفاوض', STANDARD_LIKERT),
    q('sup_team_2', 'team', 'مدراء علاقات موردين معيّنون', STANDARD_LIKERT),
    q('sup_team_3', 'team', 'لجنة مشتريات متعددة الوظائف', STANDARD_LIKERT),
    q('sup_dig_1', 'digital', 'مشتريات إلكترونية / نظام أوامر شراء', STANDARD_LIKERT),
    q('sup_dig_2', 'digital', 'بوّابة موردين / EDI', STANDARD_LIKERT),
    q('sup_dig_3', 'digital', 'بطاقات أداء آلية', STANDARD_LIKERT),
  ],
};

// ─── اللوجستيات ─────────────────────────────────────────────────────────────
const LOGISTICS: DeptBank = {
  basic: [
    q('log_gov_1', 'governance', 'سياسة مخزون وجرد دوري', STANDARD_LIKERT),
    q('log_gov_2', 'governance', 'عقود ناقلين واتفاقيات مستوى', STANDARD_LIKERT),
    q('log_gov_3', 'governance', 'سياسة إرجاع / لوجستيات عكسية', STANDARD_LIKERT),
    q('log_fin_1', 'financial', 'تتبّع تكلفة الشحن لكل طلب', STANDARD_LIKERT),
    q('log_fin_2', 'financial', 'مراقبة تكلفة حمل المخزون', STANDARD_LIKERT),
    q('log_fin_3', 'financial', 'مؤشر التسليم في الموعد وبالكامل (OTIF)', STANDARD_LIKERT),
    q('log_team_1', 'team', 'تدريب سلامة المستودع', STANDARD_LIKERT),
    q('log_team_2', 'team', 'مراجعة أداء العاملين والسائقين', STANDARD_LIKERT),
    q('log_team_3', 'team', 'تسليم بين المناوبات', STANDARD_LIKERT),
    q('log_dig_1', 'digital', 'نظام إدارة مستودع / مخزون مستخدم', STANDARD_LIKERT),
    q('log_dig_2', 'digital', 'أداة تحسين مسارات', STANDARD_LIKERT),
    q('log_dig_3', 'digital', 'تتبّع شحنات لحظي', STANDARD_LIKERT),
  ],
};

// ─── الجودة ─────────────────────────────────────────────────────────────────
const QUALITY: DeptBank = {
  basic: [
    q('qa_gov_1', 'governance', 'نظام إدارة جودة (مثل ISO 9001)', STANDARD_LIKERT),
    q('qa_gov_2', 'governance', 'سياسة جودة موثّقة', STANDARD_LIKERT),
    q('qa_gov_3', 'governance', 'عملية عدم المطابقة / CAPA', STANDARD_LIKERT),
    q('qa_fin_1', 'financial', 'تتبّع تكلفة الجودة المنخفضة (CoPQ)', STANDARD_LIKERT),
    q('qa_fin_2', 'financial', 'موازنة جودة منفصلة عن العمليات', STANDARD_LIKERT),
    q('qa_fin_3', 'financial', 'مراقبة تكلفة الضمان / إعادة العمل', STANDARD_LIKERT),
    q('qa_team_1', 'team', 'أبطال جودة في كل وظيفة', STANDARD_LIKERT),
    q('qa_team_2', 'team', 'تدريب Six Sigma / Lean', STANDARD_LIKERT),
    q('qa_team_3', 'team', 'اجتماعات جودة يومية', STANDARD_LIKERT),
    q('qa_dig_1', 'digital', 'أداة ضبط إحصائي للعمليات', STANDARD_LIKERT),
    q('qa_dig_2', 'digital', 'نظام تتبّع العيوب', STANDARD_LIKERT),
    q('qa_dig_3', 'digital', 'حلقة تغذية راجعة من العملاء مرقمنة', STANDARD_LIKERT),
  ],
};

// ─── المشاريع ───────────────────────────────────────────────────────────────
const PROJECTS: DeptBank = {
  basic: [
    q('prj_gov_1', 'governance', 'منهجية مشاريع (Agile / PMBOK)', STANDARD_LIKERT),
    q('prj_gov_2', 'governance', 'إيقاع لجنة توجيه / راعي', STANDARD_LIKERT),
    q('prj_gov_3', 'governance', 'عملية بوابات / اعتمادات', STANDARD_LIKERT),
    q('prj_fin_1', 'financial', 'موازنة مقابل فعلي لكل مشروع', STANDARD_LIKERT),
    q('prj_fin_2', 'financial', 'تتبّع القيمة المكتسبة', STANDARD_LIKERT),
    q('prj_fin_3', 'financial', 'تتبّع استغلال الموارد', STANDARD_LIKERT),
    q('prj_team_1', 'team', 'مدراء مشاريع / Scrum Masters معتمدون', STANDARD_LIKERT),
    q('prj_team_2', 'team', 'فرق متعددة الوظائف', STANDARD_LIKERT),
    q('prj_team_3', 'team', 'استرجاعات بعد كل مشروع', STANDARD_LIKERT),
    q('prj_dig_1', 'digital', 'أداة مشاريع (Jira / MS Project / Asana)', STANDARD_LIKERT),
    q('prj_dig_2', 'digital', 'عرض Gantt / محفظة متاح', STANDARD_LIKERT),
    q('prj_dig_3', 'digital', 'تقارير حالة آلية', STANDARD_LIKERT),
  ],
};

// ─── الحوكمة ────────────────────────────────────────────────────────────────
const GOVERNANCE: DeptBank = {
  basic: [
    q('gov_gov_1', 'governance', 'مجلس / جهة استشارية فعّالة', STANDARD_LIKERT),
    q('gov_gov_2', 'governance', 'ميثاق ولوائح ولجان موثّقة', STANDARD_LIKERT),
    q('gov_gov_3', 'governance', 'سياسة تعارض مصالح', STANDARD_LIKERT),
    q('gov_fin_1', 'financial', 'وظيفة مراجعة داخلية أو ما يكافئها', STANDARD_LIKERT),
    q('gov_fin_2', 'financial', 'مراجعة الضوابط المالية سنوياً', STANDARD_LIKERT),
    q('gov_fin_3', 'financial', 'مدقّق خارجي معيّن', STANDARD_LIKERT),
    q('gov_team_1', 'team', 'أعضاء مجلس بمؤهلات مستقلة', STANDARD_LIKERT),
    q('gov_team_2', 'team', 'تقييم سنوي للمجلس', STANDARD_LIKERT),
    q('gov_team_3', 'team', 'تدريب للأعضاء', STANDARD_LIKERT),
    q('gov_dig_1', 'digital', 'بوّابة مجلس / مشاركة مستندات آمنة', STANDARD_LIKERT),
    q('gov_dig_2', 'digital', 'سجل امتثال / مخاطر رقمي', STANDARD_LIKERT),
    q('gov_dig_3', 'digital', 'لوحة مؤشرات للمجلس', STANDARD_LIKERT),
  ],
};

// ─── الامتثال الأساسي (8 أسئلة حسب خطة §5.3) ────────────────────────────────
const COMPLIANCE_BASIC: DeptQuestion[] = [
  q('cmp_basic_1', 'governance', 'السجل التجاري ساري ومحدّث', STANDARD_LIKERT),
  q('cmp_basic_2', 'governance', 'تراخيص قطاعية (CST، SFDA…) مجدّدة', STANDARD_LIKERT),
  q('cmp_basic_3', 'governance', 'تتبّع وضع نطاقات للسعودة', STANDARD_LIKERT),
  q('cmp_basic_4', 'financial', 'إقرارات ضريبة القيمة المضافة / الزكاة في موعدها', STANDARD_LIKERT),
  q('cmp_basic_5', 'financial', 'سداد اشتراكات التأمينات', STANDARD_LIKERT),
  q('cmp_basic_6', 'team', 'عقود نظام عمل موجودة لكل موظف', STANDARD_LIKERT),
  q('cmp_basic_7', 'digital', 'برنامج حماية البيانات (PDPL)', STANDARD_LIKERT),
  q('cmp_basic_8', 'digital', 'ضوابط أمن سيبراني (ECC)', STANDARD_LIKERT),
];

const COMPLIANCE: DeptBank = {
  basic: COMPLIANCE_BASIC,
};

// ─── السجل ──────────────────────────────────────────────────────────────────
export const DEPT_BANKS: Record<DeptCode, DeptBank> = {
  HR,
  FINANCE,
  SALES,
  MARKETING,
  OPERATIONS,
  IT,
  CUSTOMER_SERVICE,
  SUPPORT,
  LOGISTICS,
  QUALITY,
  PROJECTS,
  GOVERNANCE,
  COMPLIANCE,
};

export function getDeptBank(code: DeptCode): DeptBank {
  return DEPT_BANKS[code];
}

/**
 * المصدر الواحد للحقيقة: أسئلة القسم بعد الفلترة بالحجم، ضمن ما يسمح به variant.
 *
 * قيد الصحّة الحاكم (auditEngine.scoreAudit يقسم على عدد أسئلة البنك لا الإجابات):
 * مجموعة الأسئلة المُقدَّمة للمستخدم = مجموعة الأسئلة المُقيَّمة، بالحرف. لذا يجب
 * أن يستدعي مسارُ التقديم (controllers) ومسارُ التقييم (auditEngine) هذه الدالّة
 * نفسها بالحجم نفسه — وإلّا يُعاقَب الكيان الصغير على أسئلة لم تُطرح عليه.
 *
 * الفلترة داخل base (وليست فوقه) → لا تتجاوز pro المدفوع: الحجم والاشتراك متعامدان.
 */
export function questionsForSizeAndVariant(
  code: DeptCode,
  variant: 'basic' | 'pro',
  size: CompanySize
): DeptQuestion[] {
  const bank = DEPT_BANKS[code];
  const base =
    variant === 'pro' && bank.pro ? [...bank.basic, ...bank.pro] : bank.basic;
  return base.filter((qq) => !qq.minSize || SIZE_RANK[qq.minSize] <= SIZE_RANK[size]);
}
