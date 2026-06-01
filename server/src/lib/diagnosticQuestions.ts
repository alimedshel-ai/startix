// بنك أسئلة تشخيص المالك. س1 للتعريف (اسم الشركة + القطاع، غير موزّن).
// الأسئلة س3–س10 تحمل النقاط المستخدمة في services/diagnosticEngine.ts.
// المعالج 9 خطوات: تعريف واحد + 8 موزّنة.

export type StageOption = 'struggle' | 'startup' | 'scaling' | 'stable'
export type SizeOption = 'micro' | 'small' | 'medium' | 'large'
export type DependencyOption = 'total' | 'high' | 'low'
export type FinancialTrackingOption = 'none' | 'manual' | 'good' | 'perfect'
export type LiquidityOption = 'critical' | 'low' | 'mid' | 'high'
export type GovernanceOption = 'none' | 'partial' | 'system' | 'board'
export type ScalabilityOption = 'none' | 'mid' | 'easy'
export type ExitOption = 'none' | 'ipo' | 'mna' | 'family'

export interface OwnerAnswers {
  companyName: string
  sector: string
  stage: StageOption
  size: SizeOption
  ownerDependency: DependencyOption
  financialTracking: FinancialTrackingOption
  liquidity: LiquidityOption
  governance: GovernanceOption
  scalability: ScalabilityOption
  exitStrategy: ExitOption
}

interface Option<V extends string> {
  value: V
  label: string
  points: number
}

interface QuestionDef<K extends keyof OwnerAnswers, V extends string> {
  key: K
  label: string
  prompt: string
  maxPoints: number
  options: Option<V>[]
}

export const STAGE_Q: QuestionDef<'stage', StageOption> = {
  key: 'stage',
  label: 'مرحلة العمل',
  prompt: 'أي مرحلة تصف شركتك اليوم؟',
  maxPoints: 40,
  options: [
    { value: 'struggle', label: 'متعثرة — في وضع البقاء', points: 0 },
    { value: 'startup', label: 'ناشئة — أقل من سنتين', points: 10 },
    { value: 'scaling', label: 'في نموّ — تتوسّع بسرعة', points: 25 },
    { value: 'stable', label: 'مستقرّة — راسخة ومربحة', points: 40 },
  ],
}

export const SIZE_Q: QuestionDef<'size', SizeOption> = {
  key: 'size',
  label: 'حجم المنشأة',
  prompt: 'ما حجم الفريق؟',
  maxPoints: 15,
  options: [
    { value: 'micro', label: 'متناهية الصغر — 1–9', points: 0 },
    { value: 'small', label: 'صغيرة — 10–49', points: 5 },
    { value: 'medium', label: 'متوسطة — 50–249', points: 10 },
    { value: 'large', label: 'كبيرة — 250+', points: 15 },
  ],
}

export const DEPENDENCY_Q: QuestionDef<'ownerDependency', DependencyOption> = {
  key: 'ownerDependency',
  label: 'الاعتماد على المالك',
  prompt: 'إلى أيّ مدى تعتمد الشركة عليك شخصياً؟',
  maxPoints: 15,
  options: [
    { value: 'total', label: 'كلّي — لا شيء يحدث بدوني', points: 0 },
    { value: 'high', label: 'عالٍ — القرارات الكبرى فقط', points: 5 },
    { value: 'low', label: 'منخفض — تعمل بدوني لأسابيع', points: 15 },
  ],
}

export const FINANCIAL_TRACKING_Q: QuestionDef<'financialTracking', FinancialTrackingOption> = {
  key: 'financialTracking',
  label: 'المتابعة المالية',
  prompt: 'كيف تتابع الأرقام المالية؟',
  maxPoints: 20,
  options: [
    { value: 'none', label: 'بدون متابعة', points: 0 },
    { value: 'manual', label: 'يدوية / جداول إكسل', points: 7 },
    { value: 'good', label: 'نظام محاسبة وإقفال شهري', points: 14 },
    { value: 'perfect', label: 'لوحات لحظية + قوائم مدققة', points: 20 },
  ],
}

export const LIQUIDITY_Q: QuestionDef<'liquidity', LiquidityOption> = {
  key: 'liquidity',
  label: 'حالة السيولة',
  prompt: 'ما مدى صحة الاحتياطي النقدي؟',
  maxPoints: 40,
  options: [
    { value: 'critical', label: 'حرجة — أقل من شهر', points: 0 },
    { value: 'low', label: 'منخفضة — 1–3 أشهر', points: 13 },
    { value: 'mid', label: 'متوسطة — 3–6 أشهر', points: 26 },
    { value: 'high', label: 'عالية — 6 أشهر فأكثر', points: 40 },
  ],
}

export const GOVERNANCE_Q: QuestionDef<'governance', GovernanceOption> = {
  key: 'governance',
  label: 'مستوى الحوكمة',
  prompt: 'كيف تُدار اتخاذ القرارات؟',
  maxPoints: 30,
  options: [
    { value: 'none', label: 'لا توجد حوكمة رسمية', points: 0 },
    { value: 'partial', label: 'جزئية — بعض الإجراءات المكتوبة', points: 10 },
    { value: 'system', label: 'نظام معتمد + تفويضات', points: 20 },
    { value: 'board', label: 'مجلس إدارة فعّال + لجان رسمية', points: 30 },
  ],
}

export const SCALABILITY_Q: QuestionDef<'scalability', ScalabilityOption> = {
  key: 'scalability',
  label: 'قابلية التوسّع',
  prompt: 'هل تستطيع الشركة النموّ بدون أن تنكسر؟',
  maxPoints: 10,
  options: [
    { value: 'none', label: 'غير قابلة للتوسّع حالياً', points: 0 },
    { value: 'mid', label: 'قابلة للتوسّع بجهد', points: 5 },
    { value: 'easy', label: 'سهلة التوسّع — الأنظمة جاهزة', points: 10 },
  ],
}

export const EXIT_Q: QuestionDef<'exitStrategy', ExitOption> = {
  key: 'exitStrategy',
  label: 'استراتيجية الخروج',
  prompt: 'ما خطة الخروج على المدى الطويل؟',
  maxPoints: 10,
  options: [
    { value: 'none', label: 'لا توجد خطة خروج بعد', points: 0 },
    { value: 'family', label: 'انتقال للعائلة', points: 5 },
    { value: 'mna', label: 'استحواذ (M&A)', points: 8 },
    { value: 'ipo', label: 'طرح عام (IPO)', points: 10 },
  ],
}

export const WEIGHTED_QUESTIONS = [
  STAGE_Q,
  SIZE_Q,
  DEPENDENCY_Q,
  FINANCIAL_TRACKING_Q,
  LIQUIDITY_Q,
  GOVERNANCE_Q,
  SCALABILITY_Q,
  EXIT_Q,
] as const

export const TOTAL_MAX_POINTS = WEIGHTED_QUESTIONS.reduce(
  (sum, q) => sum + q.maxPoints,
  0
)

export type DiagnosticQuestion = (typeof WEIGHTED_QUESTIONS)[number]
