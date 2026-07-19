// ─── تشخيص المبيعات التكيّفي — النموذج + محرّك التسجيل (المرحلة ١) ──────
// يحلّ محلّ التحليل العميق **للمبيعات فقط**. ٥ محاور × ٣ مستويات، كل إجابة
// تفتح التالي شرطياً (unlocks). أسئلة «القياس» تحمل درجة؛ أسئلة «السبب»
// تحمل حلّاً فقط (score=null). درجة المحور = أعمق إجابة قياس أُجيبت.
//
// المحتوى منقول حرفياً من أفكار المستخدم (٥ محاور: استراتيجي/مالي/تشغيلي/
// بشري/تقني). هذا الملف بيانات ودوال نقيّة — بلا واجهة ولا مساس بالتدقيق.

export type SalesAxisKey = 'strategic' | 'financial' | 'operational' | 'human' | 'technical'

export interface DiagOption {
  value: string
  label: string
  /** درجة صحّة المحور لهذا الخيار (٠-١٠٠). null = سؤال «سبب» لا يغيّر الدرجة. */
  score: number | null
  /** تشخيص/حالة تُعرض بعد الاختيار. */
  hint?: string
  /** الحلّ المقترح — يُستخدم لاحقاً لتوليد مبادرة. */
  solution?: string
  /** معرّف السؤال التالي الذي يُفتح عند اختيار هذا الخيار. */
  unlocks?: string
}

export interface DiagQuestion {
  id: string
  axis: SalesAxisKey
  level: 1 | 2 | 3
  prompt: string
  options: DiagOption[]
}

export interface SalesAxis {
  key: SalesAxisKey
  labelAr: string
  icon: string
  /** سؤال المستوى الأول (نقطة البداية). */
  root: string
}

export const SALES_AXES: SalesAxis[] = [
  { key: 'strategic',   labelAr: 'الاستراتيجي', icon: '🔭', root: 'strat_model' },
  { key: 'financial',   labelAr: 'المالي',      icon: '💰', root: 'fin_contract' },
  { key: 'operational', labelAr: 'التشغيلي',    icon: '⚙️', root: 'ops_cycle' },
  { key: 'human',       labelAr: 'البشري',      icon: '👥', root: 'hr_size' },
  { key: 'technical',   labelAr: 'التقني',      icon: '🔧', root: 'tech_crm' },
]

export const SALES_QUESTIONS: Record<string, DiagQuestion> = {
  // ─── المحور الاستراتيجي ───────────────────────────────────────
  strat_model: {
    id: 'strat_model', axis: 'strategic', level: 1, prompt: 'نموذج البيع الأساسي:',
    options: [
      { value: 'once', label: 'مشروع لمرة (صفقة واحدة وانتهت)', score: null, unlocks: 'strat_projcount',
        hint: 'نموذج «مشروع لمرة» يعني كل سنة تبدأ من الصفر.' },
      { value: 'subscription', label: 'اشتراك سنوي (عقد متجدّد)', score: null, unlocks: 'strat_renewal' },
      { value: 'mix', label: 'مزيج (بعضهم مشروع + بعضهم اشتراك)', score: null, unlocks: 'strat_renewal' },
    ],
  },
  strat_projcount: {
    id: 'strat_projcount', axis: 'strategic', level: 2, prompt: 'متوسط عدد المشاريع السنوية:',
    options: [
      { value: '1_5',  label: '١-٥',  score: 40, hint: '🟡 اعتماد على قلّة مشاريع = تذبذب عالٍ.', solution: 'أضِف باقة «صيانة/دعم سنوي» تتجدّد تلقائياً لتثبيت الإيراد.' },
      { value: '6_20', label: '٦-٢٠', score: 60, solution: 'أضِف طبقة إيراد متكرّر (دعم/اشتراك) فوق المشاريع.' },
      { value: '20p',  label: '٢٠+',  score: 75, solution: 'حوّل نسبة من العملاء إلى عقود صيانة متجدّدة.' },
    ],
  },
  strat_renewal: {
    id: 'strat_renewal', axis: 'strategic', level: 2, prompt: 'نسبة العملاء الذين يجدّدون السنة الثانية:',
    options: [
      { value: 'lt25',  label: 'أقل من ٢٥٪',  score: 20, hint: '🔴 خطر — كل عميل جديد = تكلفة اكتساب من جديد.', unlocks: 'strat_reason' },
      { value: '25_50', label: '٢٥-٥٠٪',      score: 45, hint: '🟡 يحتاج تحسين.', unlocks: 'strat_reason' },
      { value: '50_75', label: '٥٠-٧٥٪',      score: 75, hint: '✅ جيّد.' },
      { value: 'gt75',  label: 'أكثر من ٧٥٪',  score: 95, hint: '🌟 ممتاز — هذا أغلى أصل عندك.' },
    ],
  },
  strat_reason: {
    id: 'strat_reason', axis: 'strategic', level: 3, prompt: 'لماذا لا يجدّد العميل؟',
    options: [
      { value: 'price',   label: 'السعر مرتفع', score: null, solution: 'جرّب باقات أصغر أو دفعاً ربع سنوي.' },
      { value: 'service', label: 'الخدمة لم تصل لتوقّعاته', score: null, solution: 'استبيان رضا بعد ٣٠ يوماً من البيع.' },
      { value: 'value',   label: 'لا يشعر بقيمة مستمرّة', score: null, solution: 'تقرير شهري يوضّح ما تحقّق للعميل.' },
      { value: 'contact', label: 'لا يوجد تواصل دوري بعد البيع', score: null, solution: 'مدير حساب مخصّص لكل ٥٠ عميلاً.' },
      { value: 'unknown', label: 'لا أعرف (لا نسأل)', score: null, solution: 'exit interview قبل انتهاء العقد.' },
    ],
  },

  // ─── المحور المالي ────────────────────────────────────────────
  fin_contract: {
    id: 'fin_contract', axis: 'financial', level: 1, prompt: 'متوسط قيمة العقد:',
    options: [
      { value: 'lt5',    label: 'أقل من ٥ آلاف', score: null, unlocks: 'fin_cac' },
      { value: '5_20',   label: '٥-٢٠ ألف',      score: null, unlocks: 'fin_cac' },
      { value: '20_100', label: '٢٠-١٠٠ ألف',    score: 80, hint: '✅ حجم عقد صحّي.' },
      { value: 'gt100',  label: 'أكثر من ١٠٠ ألف', score: 90, hint: '🌟 عقود استراتيجيّة.' },
    ],
  },
  fin_cac: {
    id: 'fin_cac', axis: 'financial', level: 2, prompt: 'تكلفة اكتساب العميل (CAC) كنسبة من قيمة العقد:',
    options: [
      { value: 'lt20',  label: 'أقل من ٢٠٪', score: 90, hint: '✅ كفاءة اكتساب ممتازة.' },
      { value: '20_50', label: '٢٠-٥٠٪',    score: 50, hint: '🟡 قابل للتحسين.', unlocks: 'fin_source' },
      { value: 'gt50',  label: 'أكثر من ٥٠٪', score: 20, hint: '🔴 خطر — تخسر على الاكتساب.', unlocks: 'fin_source' },
    ],
  },
  fin_source: {
    id: 'fin_source', axis: 'financial', level: 3, prompt: 'مصدر العملاء الجدد الأساسي:',
    options: [
      { value: 'referral', label: 'إحالات (عملاء يجيبون عملاء)', score: null, solution: 'أرخص CAC — وسّع نظام الإحالات.', unlocks: 'fin_referral_pct' },
      { value: 'digital',  label: 'تسويق رقمي (إعلانات/محتوى)', score: null, unlocks: 'fin_referral_pct' },
      { value: 'direct',   label: 'بيع مباشر (مكالمات/زيارات)', score: null, solution: 'أغلى CAC — أضِف قناة إحالات لخفضه.', unlocks: 'fin_referral_pct' },
      { value: 'tenders',  label: 'مناقصات / عطاءات', score: null, unlocks: 'fin_referral_pct' },
      { value: 'mix',      label: 'مزيج', score: null, unlocks: 'fin_referral_pct' },
    ],
  },
  fin_referral_pct: {
    id: 'fin_referral_pct', axis: 'financial', level: 3, prompt: 'كم % من العملاء الجدد من الإحالات؟',
    options: [
      { value: 'lt20',  label: 'أقل من ٢٠٪', score: null, solution: 'فرصة ضخمة: ابنِ نظام إحالات مجزٍ (خصم ١٠٪ أو شهر مجاني لكل عميل يجيب عميلاً) — CAC ≈ صفر.' },
      { value: '20_50', label: '٢٠-٥٠٪',    score: null, solution: 'جيّد — حفّز الإحالات لرفع النسبة.' },
      { value: 'gt50',  label: 'أكثر من ٥٠٪', score: null, solution: 'ممتاز — حافظ عليه وكافئ المُحيلين أكثر.' },
    ],
  },

  // ─── المحور التشغيلي ──────────────────────────────────────────
  ops_cycle: {
    id: 'ops_cycle', axis: 'operational', level: 1, prompt: 'من أول اتصال إلى توقيع العقد:',
    options: [
      { value: 'lt7',   label: 'أقل من ٧ أيام', score: 95, hint: '⚡ سريع.' },
      { value: '1_4w',  label: '١-٤ أسابيع',    score: 80, hint: '✅ طبيعي.' },
      { value: '1_3m',  label: '١-٣ أشهر',      score: 45, hint: '🟡 بطيء.', unlocks: 'ops_stage' },
      { value: 'gt3m',  label: 'أكثر من ٣ أشهر', score: 25, hint: '⚠️ يحتاج تدخّلاً فورياً.', unlocks: 'ops_stage' },
    ],
  },
  ops_stage: {
    id: 'ops_stage', axis: 'operational', level: 2, prompt: 'أطول مرحلة في البيع:',
    options: [
      { value: 'prospecting', label: 'إيجاد عميل محتمل', score: null, solution: 'حسّن استهداف القنوات وجودة العملاء المحتملين.' },
      { value: 'discovery',   label: 'الاجتماع الأول', score: null, solution: 'أعِدّ أجندة اكتشاف موحّدة تختصر الوقت.' },
      { value: 'proposal',    label: 'إعداد العرض', score: null, solution: 'قوالب عروض جاهزة قابلة للتخصيص.' },
      { value: 'negotiation', label: 'التفاوض', score: null, solution: 'حدود تفاوض وصلاحيات واضحة مسبقاً.' },
      { value: 'internal',    label: 'الموافقة الداخليّة (لدى العميل)', score: null, solution: 'حدّد صاحب القرار مبكراً وجهّز ملف أعمال مقنع.' },
      { value: 'legal',       label: 'العقد القانوني', score: null, unlocks: 'ops_legal' },
    ],
  },
  ops_legal: {
    id: 'ops_legal', axis: 'operational', level: 3, prompt: 'لماذا يطول العقد القانوني؟',
    options: [
      { value: 'complex',    label: 'العقد ١٠+ صفحات معقّد', score: null, solution: 'جرّب قالب عقد صفحة واحدة.' },
      { value: 'lawyer',     label: 'محامي العميل بطيء', score: null, solution: 'قالب موحّد + توقيع إلكتروني (DocuSign/HelloSign).' },
      { value: 'strict',     label: 'شروطنا صارمة تُخيف العميل', score: null, solution: '٨٠٪ شروط موحّدة + ٢٠٪ قابلة للتفاوض.' },
      { value: 'notemplate', label: 'لا يوجد قالب موحّد', score: null, solution: 'أنشئ قالب عقد موحّداً اليوم.' },
    ],
  },

  // ─── المحور البشري ────────────────────────────────────────────
  hr_size: {
    id: 'hr_size', axis: 'human', level: 1, prompt: 'حجم فريق المبيعات:',
    options: [
      { value: 'solo',   label: 'أنا فقط (مدير + بائع)', score: 70, hint: 'فرد واحد — لا انطباق لمعدّل الاحتفاظ.' },
      { value: '2_3',    label: '٢-٣ مندوبين', score: 75 },
      { value: '4_10',   label: '٤-١٠ مندوبين', score: null, unlocks: 'hr_retention' },
      { value: '11p',    label: '١١+ مع مشرفين', score: null, unlocks: 'hr_retention' },
    ],
  },
  hr_retention: {
    id: 'hr_retention', axis: 'human', level: 2, prompt: 'معدّل الاحتفاظ بالمندوبين (سنة كاملة):',
    options: [
      { value: 'lt50',  label: 'أقل من ٥٠٪', score: 20, hint: '🔴 خطر — تدريب مهدور وتكلفة استبدال ضخمة (٦-٩ أشهر راتب).', unlocks: 'hr_reason' },
      { value: '50_70', label: '٥٠-٧٠٪',    score: 45, hint: '🟡 مقبول.', unlocks: 'hr_reason' },
      { value: '70_85', label: '٧٠-٨٥٪',    score: 78, hint: '✅ جيّد.' },
      { value: 'gt85',  label: 'أكثر من ٨٥٪', score: 95, hint: '🌟 ممتاز.' },
    ],
  },
  hr_reason: {
    id: 'hr_reason', axis: 'human', level: 3, prompt: 'سبب استقالة آخر المندوبين:',
    options: [
      { value: 'salary',  label: 'الراتب أقل من السوق', score: null, solution: 'مراجعة سنوية للرواتب + عمولة مجزية.' },
      { value: 'path',    label: 'لا مسار وظيفي واضح', score: null, solution: 'ارسم مساراً: مندوب → كبير مندوبين → مشرف.' },
      { value: 'manager', label: 'المدير لا يدعمه', score: null, solution: 'اجتماع ١:١ أسبوعي (٣٠ دقيقة) لكل مندوب.' },
      { value: 'targets', label: 'ضغط أهداف غير واقعي', score: null, solution: 'أهداف SMART بمشاركة المندوب في وضعها.' },
      { value: 'tools',   label: 'لا أدوات تُنجحه', score: null, solution: 'CRM + تدريب + قوالب جاهزة.' },
    ],
  },

  // ─── المحور التقني ────────────────────────────────────────────
  tech_crm: {
    id: 'tech_crm', axis: 'technical', level: 1, prompt: 'نظام تتبّع العملاء:',
    options: [
      { value: 'excel',    label: 'Excel / Google Sheets', score: 40, hint: '🟡 يكبر معه الفوضى.', unlocks: 'tech_speed' },
      { value: 'simple',   label: 'CRM بسيط (HubSpot Free / Zoho)', score: 75, hint: '✅ أساس جيّد.' },
      { value: 'advanced', label: 'CRM متقدّم (Salesforce / Dynamics)', score: 90, hint: '🌟 ممتاز.' },
      { value: 'local',    label: 'نظام مخصّص محلي', score: 70 },
      { value: 'none',     label: 'لا شيء (ذاكرة + ورق)', score: 15, hint: '🔴 خطر — معلومات مفقودة.', unlocks: 'tech_speed' },
    ],
  },
  tech_speed: {
    id: 'tech_speed', axis: 'technical', level: 2, prompt: 'سرعة الوصول للمعلومة (كم عميلاً نشطاً · أي مرحلة · آخر تواصل):',
    options: [
      { value: 'instant', label: 'فوراً (أقل من دقيقة)', score: 70, hint: '✅' },
      { value: '5_15',    label: '٥-١٥ دقيقة', score: 40, hint: '🟡 كل دقيقة بحث = دقيقة بيع ضائعة.', unlocks: 'tech_barrier' },
      { value: 'unknown', label: 'لا أعرف / لا أقدر', score: 20, hint: '🔴 خطر.', unlocks: 'tech_barrier' },
    ],
  },
  tech_barrier: {
    id: 'tech_barrier', axis: 'technical', level: 3, prompt: 'ما الذي يمنعك من استخدام CRM أفضل؟',
    options: [
      { value: 'cost',        label: 'التكلفة', score: null, solution: 'HubSpot Free (صفر ريال).' },
      { value: 'complexity',  label: 'التعقيد (الفريق لا يستخدمه)', score: null, solution: 'Pipedrive — أبسط من Excel.' },
      { value: 'trust',       label: 'لا أثق بالسحابة', score: null, solution: 'ERPNext محلي مفتوح المصدر.' },
      { value: 'excelenough', label: 'Excel يكفي حالياً', score: null, solution: 'جرّب CRM أسبوعاً وقارن الوقت الموفَّر.' },
      { value: 'notime',      label: 'لا وقت للتنفيذ', score: null, solution: 'استعانة خارجية للتنفيذ (يومان).' },
    ],
  },
}

// ─── محرّك التسلسل التكيّفي ────────────────────────────────────────
export type DiagAnswers = Record<string, string> // questionId → option.value

function optionOf(qid: string, value: string): DiagOption | undefined {
  return SALES_QUESTIONS[qid]?.options.find((o) => o.value === value)
}

/** تسلسل أسئلة المحور المرئيّة الآن: من الجذر، نتبع unlocks حسب الإجابات. */
export function axisFlow(axis: SalesAxisKey, answers: DiagAnswers): DiagQuestion[] {
  const root = SALES_AXES.find((a) => a.key === axis)?.root
  if (!root) return []
  const out: DiagQuestion[] = []
  let currentId: string | undefined = root
  const guard = new Set<string>()
  while (currentId && SALES_QUESTIONS[currentId] && !guard.has(currentId)) {
    guard.add(currentId)
    const q = SALES_QUESTIONS[currentId]
    out.push(q)
    const answered: string | undefined = answers[currentId]
    if (!answered) break // لم يُجَب بعد → نتوقّف (لا نكشف التالي)
    currentId = optionOf(currentId, answered)?.unlocks
  }
  return out
}

/** درجة المحور = أعمق إجابة قياس (score غير null) أُجيبت. لا شيء → null. */
export function axisScore(axis: SalesAxisKey, answers: DiagAnswers): number | null {
  const flow = axisFlow(axis, answers)
  let score: number | null = null
  for (const q of flow) {
    const val = answers[q.id]
    if (!val) continue
    const opt = optionOf(q.id, val)
    if (opt && opt.score != null) score = opt.score
  }
  return score
}

export type Zone = 'red' | 'yellow' | 'green'
export function zoneOf(score: number | null): Zone | null {
  if (score == null) return null
  if (score < 40) return 'red'
  if (score <= 70) return 'yellow'
  return 'green'
}
export const ZONE_META: Record<Zone, { emoji: string; labelAr: string; cls: string }> = {
  red:    { emoji: '🔴', labelAr: 'ضعيف',  cls: 'border-rose-300 bg-rose-50/60 text-rose-800' },
  yellow: { emoji: '🟡', labelAr: 'متوسّط', cls: 'border-amber-300 bg-amber-50/60 text-amber-800' },
  green:  { emoji: '✅', labelAr: 'جيّد',   cls: 'border-emerald-300 bg-emerald-50/60 text-emerald-800' },
}

/** هل اكتمل المحور؟ (آخر سؤال مرئيّ مُجاب ولا يفتح تالياً). */
export function axisComplete(axis: SalesAxisKey, answers: DiagAnswers): boolean {
  const flow = axisFlow(axis, answers)
  if (flow.length === 0) return false
  const last = flow[flow.length - 1]
  const val = answers[last.id]
  if (!val) return false
  return !optionOf(last.id, val)?.unlocks
}

export interface AxisResult {
  axis: SalesAxisKey
  labelAr: string
  icon: string
  score: number | null
  zone: Zone | null
  /** الحلول المُجمّعة من إجابات هذا المحور (للتقرير وتوليد المبادرات). */
  solutions: string[]
}

export function computeResults(answers: DiagAnswers): AxisResult[] {
  return SALES_AXES.map((a) => {
    const score = axisScore(a.key, answers)
    const solutions: string[] = []
    for (const q of axisFlow(a.key, answers)) {
      const opt = answers[q.id] ? optionOf(q.id, answers[q.id]) : undefined
      if (opt?.solution) solutions.push(opt.solution)
    }
    return { axis: a.key, labelAr: a.labelAr, icon: a.icon, score, zone: zoneOf(score), solutions }
  })
}

/** الدرجة الكليّة = متوسّط المحاور المُسجَّلة (تتجاهل غير المُجابة). */
export function overallScore(answers: DiagAnswers): number | null {
  const scored = computeResults(answers).map((r) => r.score).filter((s): s is number => s != null)
  if (scored.length === 0) return null
  return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
}

export function allAxesComplete(answers: DiagAnswers): boolean {
  return SALES_AXES.every((a) => axisComplete(a.key, answers))
}
