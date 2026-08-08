// ─── ح٦: بنك التنظيم الإداري والحوكمة للإدارة المالية (ورقة ٨) — ٢٥ سؤالًا ──────
// قرار المالك (2026-08-09): بنك مستقل (الخيار أ) — لا يُدمج في القسم العاشر من الـ١٠٠
// ولا يستبدله. الـ١٠٠ تقيس «هل الممارسة تُمارَس؟»؛ هذا يقيس «كيف الإدارة منظّمة».
// إجابة نعم/جزئياً/لا كبنك النضج. لا يمسّ المحرّك الحيّ (ق٧/ق٩).

export type Ypn = 'yes' | 'partial' | 'no'
export const GOV_POINTS: Record<Ypn, number> = { yes: 10, partial: 5, no: 0 }

export interface GovQuestion {
  id: string
  text: string
  /** ق١٠: أسئلة «الأفضل المطلق» — تُستبعد من مقام الشركة الصغيرة (لا من بسطها). */
  sizeML?: boolean
}
export interface GovGroup {
  key: string
  label: string
  icon: string
  questions: GovQuestion[]
}

export const GOVERNANCE_BANK: GovGroup[] = [
  { key: 't1', label: 'الهيكل والوظائف', icon: '🏢', questions: [
    { id: 't1_1', text: 'هل للإدارة المالية هيكل تنظيمي موثّق يوضّح وحداتها وتبعيتها؟' },
    { id: 't1_2', text: 'هل لكل وظيفة مالية وصف وظيفي محدّث يحدّد المهام والمؤهلات؟' },
    { id: 't1_3', text: 'هل توجد خطة تعاقب (خلافة) للمناصب المالية الحرجة؟', sizeML: true },
    { id: 't1_4', text: 'هل عدد العاملين في المالية كافٍ لحجم العمليات؟' },
    { id: 't1_5', text: 'هل يقود الإدارة المالية شخص مؤهل محاسبياً/مالياً (CFO أو مدير مالي)؟' },
  ] },
  { key: 't2', label: 'الصلاحيات ومصفوفة القرار', icon: '🗝️', questions: [
    { id: 't2_1', text: 'هل توجد مصفوفة صلاحيات مالية موثّقة (من يعتمد ماذا وبأي حدّ)؟' },
    { id: 't2_2', text: 'هل حدود الاعتماد المالي متدرّجة حسب المبلغ (مدير ← مدير عام ← مالك/مجلس)؟' },
    { id: 't2_3', text: 'هل يملك المدير المالي صلاحية الاعتراض على مصروف يخالف السياسة؟' },
    { id: 't2_4', text: 'هل قرارات التمويل والاقتراض تمر باعتماد موثّق من المالك/المجلس؟' },
    { id: 't2_5', text: 'هل تُراجَع الصلاحيات الممنوحة دورياً وتُسحب عند تغيير المسؤوليات؟', sizeML: true },
  ] },
  { key: 't3', label: 'الإجراءات ودورة المستند', icon: '📋', questions: [
    { id: 't3_1', text: 'هل توجد إجراءات عمل موثّقة (SOP) للعمليات المالية الأساسية؟' },
    { id: 't3_2', text: 'هل دورة المستند محددة: من الإصدار إلى الاعتماد إلى القيد إلى الأرشفة؟' },
    { id: 't3_3', text: 'هل يوجد مسار تصعيد واضح عند تجاوز المصروف للميزانية؟' },
    { id: 't3_4', text: 'هل الإغلاق الشهري للحسابات يتم بجدول ثابت وموعد معلوم؟' },
    { id: 't3_5', text: 'هل تُحفظ المستندات المالية بنظام أرشفة يسمح باسترجاعها عند المراجعة؟' },
  ] },
  { key: 't4', label: 'التواصل والتقارير الإدارية', icon: '📣', questions: [
    { id: 't4_1', text: 'هل يرفع المدير المالي تقريراً دورياً للمالك/الإدارة العليا بموعد ثابت؟' },
    { id: 't4_2', text: 'هل توجد اجتماعات دورية بين المالية والإدارات الأخرى؟' },
    { id: 't4_3', text: 'هل تُوزَّع الميزانيات المعتمدة على أصحاب الإدارات ويُحاسَبون عليها؟' },
    { id: 't4_4', text: 'هل يشارك المدير المالي في القرارات الاستراتيجية (توسع/تسعير/توظيف كبير)؟' },
    { id: 't4_5', text: 'هل توجد قناة واضحة يبلغ بها الموظف عن ملاحظة مالية؟' },
  ] },
  { key: 't5', label: 'الحوكمة والرقابة الداخلية', icon: '🛡️', questions: [
    { id: 't5_1', text: 'هل توجد جردات/مراجعات مفاجئة على الصندوق والمخزون المالي؟' },
    { id: 't5_2', text: 'هل تُسوَّى الحسابات البنكية شهرياً من شخص غير منفّذ العمليات؟' },
    { id: 't5_3', text: 'هل يُراجَع عمل المدير المالي نفسه من جهة مستقلة (مالك/مراجع)؟' },
    { id: 't5_4', text: 'هل توجد لجنة أو مجلس يتابع الأداء المالي دورياً؟', sizeML: true },
    { id: 't5_5', text: 'هل تُوثَّق قرارات المالك المالية الاستثنائية (سحوبات/ضمانات شخصية)؟' },
  ] },
]

export const GOVERNANCE_QUESTION_COUNT = GOVERNANCE_BANK.reduce((n, g) => n + g.questions.length, 0)

/**
 * يقيّم نضج التنظيم: نعم=١٠/جزئياً=٥/لا=٠. غير المُجاب = صفر في المقام الكامل.
 * ق١٠: للشركة الصغيرة تُستبعد أسئلة sizeML من المقام (لا تُنقص الدرجة).
 */
export function scoreGovernance(
  answers: Record<string, Ypn>,
  opts?: { isSmall?: boolean },
): { overallPct: number; byGroup: Record<string, number>; answered: number; applicable: number } {
  const applies = (q: GovQuestion) => !(opts?.isSmall && q.sizeML)
  const byGroup: Record<string, number> = {}
  let totalPts = 0
  let applicable = 0
  let answered = 0
  for (const g of GOVERNANCE_BANK) {
    const qs = g.questions.filter(applies)
    let gPts = 0
    for (const q of qs) {
      const a = answers[q.id]
      if (a) { answered += 1; gPts += GOV_POINTS[a] }
    }
    byGroup[g.key] = qs.length ? Math.round((gPts / (qs.length * 10)) * 100) : 0
    totalPts += gPts
    applicable += qs.length
  }
  return {
    overallPct: applicable ? Math.round((totalPts / (applicable * 10)) * 100) : 0,
    byGroup,
    answered,
    applicable,
  }
}
