// ─── محلّل التحليل العميق → سلسلة القيمة ─────────────────────────
// المدير يجيب في /manager/dept-deep على ٤ أسئلة multi-choice + نصّ حرّ.
// كل إجابة تعكس ضعفاً أو قوّة في نشاطٍ من سلسلة القيمة. هذا الملف يحوّل
// الإجابات إلى ترجيحات ملموسة (نضج ١-٥ + سبب).
//
// المنطق:
//   Q1 «القيود»           → نشاطاتٌ ضعيفة (rating منخفض)
//   Q2 «الأنشطة الهشّة»    → نشاطاتٌ ضعيفة (rating أدنى)
//   Q3 «المهام للأتمتة»    → نشاطاتٌ متوسّطة (تحتاج تحسين)
//   Q4 «الممارسات الجيّدة» → نشاطاتٌ قويّة (rating مرتفع)

// شكل بيانات DEPT_DEEP_ANSWERS (Simplified):
export interface DeepAnswerRow {
  selected: string[]
  other: string
}

export interface DeepAnswers {
  answers: Record<string, DeepAnswerRow | string>
}

// شكل توصية VC — لكل نشاط: تقييم مقترح + سبب + مصادر.
export interface VCSuggestion {
  activityKey: string
  suggestedRating: 1 | 2 | 3 | 4 | 5
  suggestedText: string
  reason: string
  sourceAnswers: string[]  // أكواد الإجابات التي أدّت لهذا الترجيح
}

// خريطة كودات الإجابات → أنشطة سلسلة القيمة (VC).
// activity keys تطابق نموذج ValueChainPage: primary + support.
const CONSTRAINT_MAP: Record<string, { activity: string; delta: number; label: string }> = {
  // Q1 — القيود (تخفض rating)
  hr_shortage:  { activity: 'hrManagement',       delta: -2, label: 'نقص الموارد البشريّة' },
  budget:       { activity: 'firmInfrastructure', delta: -2, label: 'قيود ماليّة' },
  manual_ops:   { activity: 'operations',         delta: -2, label: 'عمليات غير مؤتمتة' },
  data_gap:     { activity: 'tech',               delta: -2, label: 'نقص البيانات' },
  collab:       { activity: 'firmInfrastructure', delta: -1, label: 'ضعف التعاون بين الإدارات' },
  time_pressure:{ activity: 'operations',         delta: -1, label: 'ضغط الوقت' },
  regulatory:   { activity: 'firmInfrastructure', delta: -1, label: 'قيود تنظيميّة' },

  // Q2 — الأنشطة الهشّة (تخفض rating أكثر)
  cashflow:         { activity: 'firmInfrastructure', delta: -2, label: 'هشاشة التدفّق النقدي' },
  hiring:           { activity: 'hrManagement',       delta: -2, label: 'هشاشة التوظيف' },
  supply_chain:     { activity: 'inboundLogistics',   delta: -2, label: 'هشاشة سلسلة التوريد' },
  systems:          { activity: 'tech',               delta: -2, label: 'هشاشة الأنظمة' },
  customer_service: { activity: 'service',            delta: -2, label: 'هشاشة خدمة العملاء' },
  sales_marketing:  { activity: 'marketingSales',     delta: -2, label: 'هشاشة المبيعات والتسويق' },
  cybersecurity:    { activity: 'tech',               delta: -2, label: 'هشاشة الأمن السيبراني' },
  compliance_docs:  { activity: 'firmInfrastructure', delta: -1, label: 'هشاشة الامتثال' },

  // Q3 — المهام للأتمتة (تحسّن ممكن — rating متوسّط بشرط الوعي)
  auto_reports:    { activity: 'firmInfrastructure', delta: -1, label: 'التقارير الروتينيّة تحتاج أتمتة' },
  auto_emails:     { activity: 'marketingSales',     delta: -1, label: 'الرسائل تحتاج أتمتة' },
  auto_data_entry: { activity: 'operations',         delta: -1, label: 'إدخال البيانات اليدوي' },
  auto_files:      { activity: 'firmInfrastructure', delta: -1, label: 'الأرشفة اليدويّة' },
  auto_approvals:  { activity: 'firmInfrastructure', delta: -1, label: 'الموافقات اليدويّة' },
  auto_scheduling: { activity: 'operations',         delta: -1, label: 'الجدولة اليدويّة' },
  auto_reviews:    { activity: 'firmInfrastructure', delta: -1, label: 'المراجعات الدوريّة اليدويّة' },
  auto_invoices:   { activity: 'procurement',        delta: -1, label: 'الفواتير اليدويّة' },

  // Q4 — الممارسات الجيّدة (ترفع rating)
  team_culture:    { activity: 'hrManagement',       delta: +2, label: 'ثقافة فريق قويّة' },
  data_driven:     { activity: 'tech',               delta: +2, label: 'قرارات مبنيّة على البيانات' },
  customer_focus:  { activity: 'service',            delta: +2, label: 'تركيز على العميل' },
  innovation:      { activity: 'tech',               delta: +1, label: 'ثقافة الابتكار' },
  execution_speed: { activity: 'operations',         delta: +2, label: 'سرعة التنفيذ' },
  risk_mgmt:       { activity: 'firmInfrastructure', delta: +1, label: 'إدارة استباقيّة للمخاطر' },
  learning:        { activity: 'hrManagement',       delta: +1, label: 'ثقافة التعلّم' },
  ownership:       { activity: 'hrManagement',       delta: +1, label: 'تملّك المسؤوليّة' },

  // ─── أكواد إدارة المشاريع (PROJECTS_PROMPTS) — نفس البنية الرباعيّة ───
  // Q1 قيود ↓
  proj_scope:             { activity: 'operations',         delta: -2, label: 'تغيّر النطاق المتكرّر' },
  proj_resource_conflict: { activity: 'hrManagement',       delta: -2, label: 'تعارض موارد المشاريع' },
  proj_estimation:        { activity: 'firmInfrastructure', delta: -2, label: 'سوء تقدير الوقت/الكلفة' },
  proj_slow_decisions:    { activity: 'firmInfrastructure', delta: -1, label: 'بطء القرارات' },
  proj_no_methodology:    { activity: 'operations',         delta: -2, label: 'غياب منهجيّة موحّدة' },
  proj_stakeholder_comm:  { activity: 'marketingSales',     delta: -1, label: 'ضعف تواصل أصحاب المصلحة' },
  // Q2 هشاشة ↓↓
  proj_critical_path: { activity: 'operations',         delta: -2, label: 'هشاشة المسار الحرج' },
  proj_budget_overrun:{ activity: 'firmInfrastructure', delta: -2, label: 'تجاوز الميزانية' },
  proj_key_person:    { activity: 'hrManagement',       delta: -2, label: 'الاعتماد على شخص محوري' },
  proj_quality:       { activity: 'operations',         delta: -2, label: 'تدهور الجودة تحت الضغط' },
  proj_vendor_dep:    { activity: 'procurement',        delta: -2, label: 'الاعتماد على مورّد' },
  proj_scope_risk:    { activity: 'operations',         delta: -1, label: 'غموض النطاق/المتطلّبات' },
  // Q3 أتمتة ~
  proj_auto_status:   { activity: 'firmInfrastructure', delta: -1, label: 'تقارير الحالة اليدويّة' },
  proj_auto_tracking: { activity: 'operations',         delta: -1, label: 'تتبّع المهام اليدوي' },
  proj_auto_resource: { activity: 'hrManagement',       delta: -1, label: 'تخصيص الموارد اليدوي' },
  proj_auto_docs:     { activity: 'firmInfrastructure', delta: -1, label: 'إدارة الوثائق اليدويّة' },
  proj_auto_approvals:{ activity: 'firmInfrastructure', delta: -1, label: 'الموافقات اليدويّة' },
  proj_auto_schedule: { activity: 'operations',         delta: -1, label: 'الجدولة اليدويّة' },
  // Q4 ممارسات جيّدة ↑
  proj_methodology:   { activity: 'operations',         delta: +2, label: 'منهجيّة واضحة مطبّقة' },
  proj_risk_register: { activity: 'firmInfrastructure', delta: +2, label: 'سجلّ مخاطر منتظم' },
  proj_lessons:       { activity: 'hrManagement',       delta: +1, label: 'دروس مستفادة موثّقة' },
  proj_reporting:     { activity: 'firmInfrastructure', delta: +1, label: 'تقارير حالة دوريّة' },
  proj_mature_pmo:    { activity: 'firmInfrastructure', delta: +2, label: 'PMO ناضج' },
  proj_resource_plan: { activity: 'hrManagement',       delta: +1, label: 'تخطيط موارد مسبق' },
}

// نصوص جاهزة لكل نشاط بحسب النضج المُقترح — يوفّر توضيحاً للمدير.
const TEXT_TEMPLATES: Record<string, Record<number, string>> = {
  inboundLogistics:   { 1: 'استلام يدوي بلا نظام تتبّع', 2: 'تتبّع بسيط (Excel)', 3: 'نظام ERP للمخزون', 4: 'ERP متكامل + رمز شريطي', 5: 'أتمتة كاملة (RFID/IoT)' },
  operations:         { 1: 'عمليات يدوية بلا SOPs',      2: 'SOPs مكتوبة غير مطبّقة', 3: 'SOPs مطبّقة مع مراقبة', 4: 'Lean/Six Sigma + OEE', 5: 'أتمتة صناعيّة + Andon' },
  outboundLogistics:  { 1: 'تسليم يدوي بلا تتبّع',        2: 'جدولة أساسيّة', 3: 'شحن رقمي', 4: 'تحسين مسارات', 5: 'تسليم في نفس اليوم' },
  marketingSales:     { 1: 'اعتماد على العلاقات فقط',    2: 'حضور رقمي محدود', 3: 'CRM أساسي', 4: 'CRM متقدّم + قمع مقاس', 5: 'أتمتة تسويق كاملة' },
  service:            { 1: 'لا دعم مخصّص',                2: 'دعم بلا SLA', 3: 'نظام تذاكر + SLA', 4: 'دعم متعدّد القنوات', 5: 'دعم استباقي + AI' },
  firmInfrastructure: { 1: 'حوكمة غير رسميّة',           2: 'مجلس اسمي + ميزانيّة', 3: 'مجلس + لجان + تقارير', 4: 'حوكمة معتمَدة + مراجعة', 5: 'حوكمة رفيعة + إفصاح' },
  hrManagement:       { 1: 'توظيف حسب الحاجة',           2: 'خطة توظيف بسيطة', 3: 'خطة سنويّة + تقييم', 4: 'مسارات + تعاقب', 5: 'HR رقمي شامل' },
  tech:               { 1: 'أدوات مكتبيّة فقط',           2: 'برامج معزولة', 3: 'تكامل أنظمة', 4: 'سحابة + أتمتة', 5: 'AI + تحليلات متقدّمة' },
  procurement:        { 1: 'شراء عشوائي',                2: 'موردون معتمدون', 3: 'تقييم دوري', 4: 'SCM متكامل', 5: 'شراكات + JIT' },
}

// الدالة الجوهريّة: يقرأ DEPT_DEEP_ANSWERS ويُنتج توصيات VC.
export function analyzeDeepAnswers(deep: DeepAnswers | null): VCSuggestion[] {
  if (!deep?.answers) return []

  // نجمع كل الأكواد المُختارة عبر الأسئلة الأربعة.
  const allCodes: string[] = []
  for (const raw of Object.values(deep.answers)) {
    if (typeof raw === 'string') continue
    if (raw?.selected) allCodes.push(...raw.selected)
  }

  // نبدأ بتقييم افتراضي 3 لكل نشاط، ثم نطبّق الـdeltas.
  const baseRating = 3
  const activityAcc: Record<string, { delta: number; labels: string[] }> = {}

  for (const code of allCodes) {
    const map = CONSTRAINT_MAP[code]
    if (!map) continue
    const entry = activityAcc[map.activity] ?? { delta: 0, labels: [] }
    entry.delta += map.delta
    entry.labels.push(map.label)
    activityAcc[map.activity] = entry
  }

  // نحوّل التراكم إلى VCSuggestion.
  const suggestions: VCSuggestion[] = []
  for (const [activity, agg] of Object.entries(activityAcc)) {
    const rawRating = baseRating + agg.delta
    const clamped = Math.max(1, Math.min(5, rawRating)) as 1 | 2 | 3 | 4 | 5
    const text = TEXT_TEMPLATES[activity]?.[clamped] ?? ''
    const reason = agg.labels.length === 1
      ? `مبنيّ على: ${agg.labels[0]}`
      : `مبنيّ على ${agg.labels.length} إشارة من التحليل العميق (${agg.labels.slice(0, 2).join(' + ')}${agg.labels.length > 2 ? ' + ...' : ''})`
    suggestions.push({
      activityKey: activity,
      suggestedRating: clamped,
      suggestedText: text,
      reason,
      sourceAnswers: agg.labels,
    })
  }

  return suggestions
}
