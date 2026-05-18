// Mirror of server/src/lib/diagnosticQuestions.ts kept in sync by hand —
// the server is the authoritative scoring engine; this file just drives
// the wizard UI and Zod validation on the client.

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

interface QOption<V extends string> {
  value: V
  label: string
}

export interface OwnerQuestion<K extends keyof OwnerAnswers, V extends string> {
  key: K
  label: string
  prompt: string
  options: QOption<V>[]
}

export const OWNER_QUESTIONS = [
  {
    key: 'stage',
    label: 'مرحلة العمل',
    prompt: 'أي مرحلة تصف شركتك اليوم؟',
    options: [
      { value: 'struggle', label: 'متعثرة — في وضع البقاء' },
      { value: 'startup',  label: 'ناشئة — أقل من سنتين' },
      { value: 'scaling',  label: 'متوسعة — تنمو بسرعة' },
      { value: 'stable',   label: 'مستقرة — راسخة ومربحة' },
    ],
  },
  {
    key: 'size',
    label: 'حجم الكيان',
    prompt: 'ما حجم الفريق؟',
    options: [
      { value: 'micro',  label: 'متناهية الصغر — 1–9 موظفين' },
      { value: 'small',  label: 'صغيرة — 10–49 موظفاً' },
      { value: 'medium', label: 'متوسطة — 50–249 موظفاً' },
      { value: 'large',  label: 'كبيرة — 250+ موظفاً' },
    ],
  },
  {
    key: 'ownerDependency',
    label: 'مدى الاعتماد على المالك',
    prompt: 'إلى أي حد تعتمد الشركة عليك شخصياً؟',
    options: [
      { value: 'total', label: 'تام — لا شيء يحدث بدوني' },
      { value: 'high',  label: 'عالٍ — أتدخل في القرارات الرئيسية فقط' },
      { value: 'low',   label: 'منخفض — تعمل دوني لأسابيع' },
    ],
  },
  {
    key: 'financialTracking',
    label: 'تتبع المالية',
    prompt: 'كيف تتابع البيانات المالية؟',
    options: [
      { value: 'none',    label: 'لا يوجد تتبع' },
      { value: 'manual',  label: 'يدوي / جداول إكسل' },
      { value: 'good',    label: 'نظام محاسبي مع إقفال شهري' },
      { value: 'perfect', label: 'لوحات لحظية + قوائم مدققة' },
    ],
  },
  {
    key: 'liquidity',
    label: 'حالة السيولة',
    prompt: 'كم احتياطي السيولة لديك؟',
    options: [
      { value: 'critical', label: 'حرجة — أقل من شهر' },
      { value: 'low',      label: 'منخفضة — 1–3 أشهر' },
      { value: 'mid',      label: 'متوسطة — 3–6 أشهر' },
      { value: 'high',     label: 'مرتفعة — 6+ أشهر' },
    ],
  },
  {
    key: 'governance',
    label: 'مستوى الحوكمة',
    prompt: 'كيف تُدار القرارات في الشركة؟',
    options: [
      { value: 'none',    label: 'لا توجد حوكمة رسمية' },
      { value: 'partial', label: 'جزئية — بعض الإجراءات المكتوبة' },
      { value: 'system',  label: 'نظام راسخ + تفويضات' },
      { value: 'board',   label: 'مجلس نشط + لجان رسمية' },
    ],
  },
  {
    key: 'scalability',
    label: 'القابلية للتوسع',
    prompt: 'ما مدى قدرة العمل على النمو دون أن ينهار؟',
    options: [
      { value: 'none', label: 'غير قابل للتوسع حالياً' },
      { value: 'mid',  label: 'قابل للتوسع مع جهد' },
      { value: 'easy', label: 'سهل التوسع — الأنظمة جاهزة' },
    ],
  },
  {
    key: 'exitStrategy',
    label: 'استراتيجية الخروج',
    prompt: 'ما خطة الخروج طويلة المدى؟',
    options: [
      { value: 'none',   label: 'لا توجد خطة بعد' },
      { value: 'family', label: 'انتقال للعائلة' },
      { value: 'mna',    label: 'استحواذ (دمج وشراء)' },
      { value: 'ipo',    label: 'طرح عام / إدراج' },
    ],
  },
] as const satisfies ReadonlyArray<
  | OwnerQuestion<'stage', StageOption>
  | OwnerQuestion<'size', SizeOption>
  | OwnerQuestion<'ownerDependency', DependencyOption>
  | OwnerQuestion<'financialTracking', FinancialTrackingOption>
  | OwnerQuestion<'liquidity', LiquidityOption>
  | OwnerQuestion<'governance', GovernanceOption>
  | OwnerQuestion<'scalability', ScalabilityOption>
  | OwnerQuestion<'exitStrategy', ExitOption>
>

export const STRATEGIC_PATHS = [
  'EMERGENCY_RISK',
  'NASCENT_CAUTIOUS',
  'GROWING_CHAOTIC',
  'MATURE_COMPETITIVE',
  'DEFAULT_STRATEGIC',
] as const
export type StrategicPath = (typeof STRATEGIC_PATHS)[number]

export interface OwnerDiagnosticResult {
  strategicPath: StrategicPath
  pathScores: Record<StrategicPath, number>
  maturityScore: number
  pointsBreakdown: { key: keyof OwnerAnswers; label: string; points: number; max: number }[]
  radarData: { axis: 'Governance' | 'Financial' | 'Team' | 'Digital'; value: number }[]
  weaknesses: { key: keyof OwnerAnswers; label: string; pct: number }[]
  roadmap: { title: string; detail: string; source: keyof OwnerAnswers }[]
  scenarios: { name: 'optimistic' | 'pessimistic'; headline: string; detail: string }[]
}
