// ─── نضج المبيعات الموزون (منقول من ملف المستخدم) ───────────────────
// يحلّ محلّ تشخيص المبيعات السابق. البنية: تصنيف تكيّفي (قطاع → نوع →
// عميل، بلا نقاط) ثم ١٧ سؤال مُسجَّل على ٥ محاور **بأوزان**. النضج الكلّي =
// مجموع (نسبة المحور × وزنه). التصنيف: بداية/نمو/متقدّم/متميّز.
//
// ملف بيانات ودوال نقيّة — بلا واجهة، بلا مساس بالتدقيق/الخطط.

export type SalesAxisKey = 'strategic' | 'financial' | 'operational' | 'human' | 'technical'

export interface SmOption { label: string; points: number }
export interface SmQuestion {
  id: string
  axis: SalesAxisKey
  prompt: string
  /** صياغة بديلة لعميل B2C (مثل «قيمة الطلب» بدل «قيمة العقد»). */
  promptB2C?: string
  options: SmOption[]
}

export interface SmAxis {
  key: SalesAxisKey
  labelAr: string
  icon: string
  /** الوزن في النضج الكلّي (المجموع = ١٠٠). */
  weight: number
  questionIds: string[]
  recommendation: string
}

export type SmAnswers = Record<string, number> // questionId → option index

// ─── التصنيف التكيّفي (قطاع → نوع → عميل) — بلا نقاط، للتشخيص فقط ────
export interface SmClassOption { value: string; label: string }
export interface SmClassQuestion {
  id: string
  prompt: string
  /** خيارات ثابتة، أو دالة تعتمد على إجابات سابقة (نوع النشاط حسب القطاع). */
  optionsFor: (answers: SmAnswers) => SmClassOption[]
}

const SECTOR_SUBTYPES: Record<string, SmClassOption[]> = {
  services: [
    { value: 'consulting', label: 'استشارات' },
    { value: 'tech', label: 'تقنية / SaaS' },
    { value: 'training', label: 'تدريب' },
  ],
  commercial: [
    { value: 'retail', label: 'تجزئة' },
    { value: 'wholesale', label: 'جملة' },
  ],
  industrial: [
    { value: 'manufacturing', label: 'تصنيع' },
    { value: 'supply', label: 'توريد' },
  ],
}

export const SM_CLASSIFY: SmClassQuestion[] = [
  {
    id: 'sector', prompt: 'قطاع نشاطك؟',
    optionsFor: () => [
      { value: 'services', label: 'خدمات' },
      { value: 'commercial', label: 'تجاري' },
      { value: 'industrial', label: 'صناعي' },
    ],
  },
  {
    id: 'subtype', prompt: 'نوع النشاط؟',
    optionsFor: (a) => {
      const sectorIdx = a['sector']
      const sectorVal = SM_CLASSIFY[0].optionsFor(a)[sectorIdx]?.value
      return sectorVal ? SECTOR_SUBTYPES[sectorVal] ?? [] : []
    },
  },
  {
    id: 'client', prompt: 'نوع العميل؟',
    optionsFor: () => [
      { value: 'b2b', label: 'B2B (شركات)' },
      { value: 'b2c', label: 'B2C (أفراد)' },
      { value: 'gov', label: 'حكومة' },
    ],
  },
]

/** هل العميل B2C؟ (لتبديل صياغة أسئلة القيمة). */
export function isB2C(answers: SmAnswers): boolean {
  const idx = answers['client']
  return SM_CLASSIFY[2].optionsFor(answers)[idx]?.value === 'b2c'
}

export function classifyComplete(answers: SmAnswers): boolean {
  return SM_CLASSIFY.every((q) => answers[q.id] != null)
}

// ─── الأسئلة المُسجَّلة (Q4-Q20) ────────────────────────────────────
const YN5: SmOption[] = [{ label: 'نعم', points: 5 }, { label: 'لا', points: 1 }]
const YN4: SmOption[] = [{ label: 'نعم', points: 4 }, { label: 'لا', points: 1 }]

export const SM_QUESTIONS: SmQuestion[] = [
  // استراتيجي
  { id: 'q4_value', axis: 'strategic', prompt: 'متوسّط قيمة العقد؟', promptB2C: 'متوسّط قيمة الطلب؟',
    options: [{ label: 'صغير', points: 1 }, { label: 'متوسّط', points: 2 }, { label: 'كبير', points: 3 }] },
  { id: 'q5_model', axis: 'strategic', prompt: 'هل تبيع ساعات أم نتيجة؟',
    options: [{ label: 'نتيجة', points: 5 }, { label: 'ساعات', points: 2 }] },
  // مالي
  { id: 'q6_renewal', axis: 'financial', prompt: 'نسبة تجديد العقود؟',
    options: [{ label: 'أكثر من ٧٥٪', points: 5 }, { label: '٥٠-٧٥٪', points: 4 }, { label: '٢٥-٥٠٪', points: 2 }, { label: 'أقل من ٢٥٪', points: 1 }] },
  { id: 'q7_auto', axis: 'financial', prompt: 'هل العقد يتجدّد تلقائياً؟', options: YN5 },
  { id: 'q8_cac', axis: 'financial', prompt: 'هل تعرف CAC (تكلفة اكتساب العميل)؟', options: YN5 },
  { id: 'q9_ltv', axis: 'financial', prompt: 'هل تعرف LTV (قيمة العميل مدى الحياة)؟', options: YN5 },
  // تشغيلي
  { id: 'q10_cycle', axis: 'operational', prompt: 'مدّة دورة البيع؟',
    options: [{ label: 'أقل من ٧ أيام', points: 5 }, { label: '١-٤ أسابيع', points: 4 }, { label: '١-٣ أشهر', points: 2 }, { label: 'أكثر من ٣ أشهر', points: 1 }] },
  { id: 'q11_leak', axis: 'operational', prompt: 'أين يتسرّب العملاء؟',
    options: [{ label: 'العقد (سهل الإصلاح)', points: 4 }, { label: 'التفاوض', points: 3 }, { label: 'الاجتماع الأول', points: 2 }, { label: 'بعد البيع', points: 1 }] },
  { id: 'q12_templates', axis: 'operational', prompt: 'هل عندك قوالب بيع جاهزة؟',
    options: [{ label: 'كاملة', points: 5 }, { label: 'بعضها', points: 3 }, { label: 'لا', points: 1 }] },
  // بشري
  { id: 'q13_path', axis: 'human', prompt: 'هل يوجد مسار وظيفي واضح للفريق؟', options: YN4 },
  { id: 'q14_sat', axis: 'human', prompt: 'هل تقيس رضا الفريق؟', options: YN4 },
  { id: 'q15_commission', axis: 'human', prompt: 'هل العمولة مرتبطة بالأداء؟', options: YN4 },
  { id: 'q16_retention', axis: 'human', prompt: 'معدّل الاحتفاظ بالمندوبين؟',
    options: [{ label: 'أكثر من ٨٥٪', points: 4 }, { label: '٧٠-٨٥٪', points: 3 }, { label: '٥٠-٧٠٪', points: 2 }, { label: 'أقل من ٥٠٪', points: 1 }] },
  // تقني
  { id: 'q17_crm', axis: 'technical', prompt: 'هل CRM يتتبّع كل عميل؟', options: YN5 },
  { id: 'q18_reports', axis: 'technical', prompt: 'هل التقارير تُولَّد تلقائياً؟', options: YN5 },
  { id: 'q19_profit', axis: 'technical', prompt: 'هل تحلّل ربحية كل قناة؟',
    options: [{ label: 'دائماً', points: 5 }, { label: 'أحياناً', points: 3 }, { label: 'لا', points: 1 }] },
  { id: 'q20_budget', axis: 'technical', prompt: 'هل الميزانية مرتبطة بالأهداف؟', options: YN5 },
]

export const SM_AXES: SmAxis[] = [
  { key: 'strategic', labelAr: 'الاستراتيجي', icon: '🔭', weight: 20, questionIds: ['q4_value', 'q5_model'],
    recommendation: 'حدّد قيمة العقد وحوّل البيع من ساعات إلى نتيجة.' },
  { key: 'financial', labelAr: 'المالي', icon: '💰', weight: 25, questionIds: ['q6_renewal', 'q7_auto', 'q8_cac', 'q9_ltv'],
    recommendation: 'احسب CAC وLTV، وفعّل التجديد التلقائي للعقود.' },
  { key: 'operational', labelAr: 'التشغيلي', icon: '⚙️', weight: 25, questionIds: ['q10_cycle', 'q11_leak', 'q12_templates'],
    recommendation: 'حدّد أين يتسرّب العملاء، جهّز قوالب، وقصّر دورة البيع.' },
  { key: 'human', labelAr: 'البشري', icon: '👥', weight: 20, questionIds: ['q13_path', 'q14_sat', 'q15_commission', 'q16_retention'],
    recommendation: 'وضّح المسار الوظيفي، اربط العمولة بالأداء، وقِس الرضا.' },
  { key: 'technical', labelAr: 'التقني', icon: '🔧', weight: 10, questionIds: ['q17_crm', 'q18_reports', 'q19_profit', 'q20_budget'],
    recommendation: 'CRM يتتبّع كل عميل + تقارير آليّة + تحليل ربحية القنوات.' },
]

// ─── محرّك التسجيل ─────────────────────────────────────────────────
const Q_BY_ID: Record<string, SmQuestion> = Object.fromEntries(SM_QUESTIONS.map((q) => [q.id, q]))

function questionMax(q: SmQuestion): number {
  return Math.max(...q.options.map((o) => o.points))
}

/** نقاط سؤال مُجاب (٠ إن لم يُجَب). */
function questionPoints(qid: string, answers: SmAnswers): number {
  const q = Q_BY_ID[qid]
  const idx = answers[qid]
  if (!q || idx == null) return 0
  return q.options[idx]?.points ?? 0
}

export type SmLevel = 'start' | 'growth' | 'advanced' | 'excellent'
export function smLevelOf(pct: number): SmLevel {
  if (pct < 25) return 'start'
  if (pct < 50) return 'growth'
  if (pct < 75) return 'advanced'
  return 'excellent'
}
export const SM_LEVEL_META: Record<SmLevel, { emoji: string; labelAr: string; cls: string }> = {
  start:     { emoji: '🔴', labelAr: 'بداية',   cls: 'border-rose-300 bg-rose-50/60 text-rose-800' },
  growth:    { emoji: '🟡', labelAr: 'نمو',     cls: 'border-amber-300 bg-amber-50/60 text-amber-800' },
  advanced:  { emoji: '🟢', labelAr: 'متقدّم',  cls: 'border-emerald-300 bg-emerald-50/60 text-emerald-800' },
  excellent: { emoji: '⭐', labelAr: 'متميّز',  cls: 'border-violet-300 bg-violet-50/60 text-violet-800' },
}

export interface SmAxisResult {
  key: SalesAxisKey
  labelAr: string
  icon: string
  weight: number
  points: number
  max: number
  pct: number
  level: SmLevel
  answered: number
  total: number
  recommendation: string
}

export function smResults(answers: SmAnswers): SmAxisResult[] {
  return SM_AXES.map((axis) => {
    const points = axis.questionIds.reduce((s, qid) => s + questionPoints(qid, answers), 0)
    const max = axis.questionIds.reduce((s, qid) => s + questionMax(Q_BY_ID[qid]), 0)
    const answered = axis.questionIds.filter((qid) => answers[qid] != null).length
    const pct = max > 0 ? Math.round((points / max) * 100) : 0
    return {
      key: axis.key, labelAr: axis.labelAr, icon: axis.icon, weight: axis.weight,
      points, max, pct, level: smLevelOf(pct),
      answered, total: axis.questionIds.length, recommendation: axis.recommendation,
    }
  })
}

/** النضج الكلّي الموزون (٠-١٠٠). */
export function smOverall(answers: SmAnswers): number {
  const results = smResults(answers)
  const weighted = results.reduce((s, r) => s + (r.pct * r.weight) / 100, 0)
  return Math.round(weighted)
}

export function smAllAnswered(answers: SmAnswers): boolean {
  return classifyComplete(answers) && SM_QUESTIONS.every((q) => answers[q.id] != null)
}

export function smAnsweredScored(answers: SmAnswers): number {
  return SM_QUESTIONS.filter((q) => answers[q.id] != null).length
}
