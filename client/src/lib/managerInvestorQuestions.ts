// بنوك أسئلة وأنواع نتائج المدير + المستثمر — كلّها enums بلا حقول يدوية.
// تطابق server/src/services/managerInvestorEngine.ts.

export type DeptType =
  | 'HR' | 'FINANCE' | 'SALES' | 'MARKETING' | 'OPERATIONS' | 'IT'
  | 'CUSTOMER_SERVICE' | 'SUPPORT' | 'LOGISTICS' | 'QUALITY'
  | 'PROJECTS' | 'GOVERNANCE' | 'COMPLIANCE'

export const DEPT_OPTIONS: { value: DeptType; label: string }[] = [
  { value: 'HR', label: 'الموارد البشرية' },
  { value: 'FINANCE', label: 'المالية' },
  { value: 'SALES', label: 'المبيعات' },
  { value: 'MARKETING', label: 'التسويق' },
  { value: 'OPERATIONS', label: 'العمليات' },
  { value: 'IT', label: 'تقنية المعلومات' },
  { value: 'CUSTOMER_SERVICE', label: 'خدمة العملاء' },
  { value: 'SUPPORT', label: 'الإمداد والدعم' },
  { value: 'LOGISTICS', label: 'اللوجستيات' },
  { value: 'QUALITY', label: 'الجودة' },
  { value: 'PROJECTS', label: 'المشاريع' },
  { value: 'GOVERNANCE', label: 'الحوكمة' },
  { value: 'COMPLIANCE', label: 'الامتثال' },
]

export type TeamSize = 'micro' | 'small' | 'medium' | 'large'
export const TEAM_SIZE_OPTIONS: { value: TeamSize; label: string }[] = [
  { value: 'micro', label: 'متناهي الصغر · 1–4' },
  { value: 'small', label: 'صغير · 5–25' },
  { value: 'medium', label: 'متوسط · 26–100' },
  { value: 'large', label: 'كبير · أكثر من 100' },
]

export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'expert'
export const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'junior', label: 'مبتدئ · أقل من 3 سنوات' },
  { value: 'mid', label: 'متوسط · 3–7 سنوات' },
  { value: 'senior', label: 'متقدّم · 8–15 سنة' },
  { value: 'expert', label: 'خبير · أكثر من 15 سنة' },
]

export type MaturityLikert = 'none' | 'partial' | 'good' | 'great'
export const OPERATIONAL_OPTIONS: { value: MaturityLikert; label: string }[] = [
  { value: 'none', label: 'لا توجد إجراءات موثّقة' },
  { value: 'partial', label: 'إجراءات جزئية وغير منتظمة' },
  { value: 'good', label: 'إجراءات موثّقة ومطبّقة' },
  { value: 'great', label: 'محسّنة ومُقاسة باستمرار' },
]

export type ToolingOption = 'none' | 'basic' | 'modern' | 'advanced'
export const TOOLING_OPTIONS: { value: ToolingOption; label: string }[] = [
  { value: 'none', label: 'لا يوجد — يدوي بالكامل' },
  { value: 'basic', label: 'أساسي — جداول إكسل' },
  { value: 'modern', label: 'حديث — برامج سحابية' },
  { value: 'advanced', label: 'متقدّم — منظومة متكاملة' },
]

export const REPORTING_OPTIONS: { value: MaturityLikert; label: string }[] = [
  { value: 'none', label: 'لا توجد تقارير' },
  { value: 'partial', label: 'تقارير متفرّقة عند الطلب' },
  { value: 'good', label: 'تقارير شهرية منتظمة' },
  { value: 'great', label: 'لوحات لحظية + تقارير مدقّقة' },
]

export type DecisionAuthority = 'operational' | 'tactical' | 'strategic'
export const DECISION_OPTIONS: { value: DecisionAuthority; label: string }[] = [
  { value: 'operational', label: 'تشغيلية فقط — كل قرار يصعّد' },
  { value: 'tactical', label: 'تكتيكية — أقرّر ضمن حدود محدّدة' },
  { value: 'strategic', label: 'استراتيجية — أقرّر باستقلالية واسعة' },
]

export interface ManagerAnswers {
  departmentType: DeptType
  teamSize: TeamSize
  experienceLevel: ExperienceLevel
  operationalMaturity: MaturityLikert
  toolingMaturity: ToolingOption
  reportingQuality: MaturityLikert
  decisionAuthority: DecisionAuthority
}

export interface ManagerResult {
  departmentLabel: string
  capacityScore: number
  toolingScore: number
  experienceScore: number
  governanceScore: number
  overallScore: number
  band: 'متعثّر' | 'يحتاج تطوير' | 'فعّال' | 'متقدّم'
  insights: { axis: 'الفريق' | 'الأدوات' | 'الخبرة' | 'الحوكمة'; pct: number }[]
  recommendations: { title: string; detail: string }[]
}

// ─── المستثمر ───────────────────────────────────────────────────────────────

export type PortfolioOption = '1' | '2-5' | '6-15' | '16+'
export const PORTFOLIO_OPTIONS: { value: PortfolioOption; label: string }[] = [
  { value: '1', label: 'شركة واحدة' },
  { value: '2-5', label: '٢–٥ شركات' },
  { value: '6-15', label: '٦–١٥ شركة' },
  { value: '16+', label: '١٦ شركة فأكثر' },
]

export type StageOption = 'seed' | 'early' | 'growth' | 'late'
export const STAGE_OPTIONS: { value: StageOption; label: string }[] = [
  { value: 'seed', label: 'تأسيس · pre-seed / seed' },
  { value: 'early', label: 'مرحلة مبكّرة · Series A/B' },
  { value: 'growth', label: 'نموّ · Series C+' },
  { value: 'late', label: 'متأخّرة / مدرجة في السوق' },
]

export type CadenceOption = 'monthly' | 'quarterly' | 'annual'
export const CADENCE_OPTIONS: { value: CadenceOption; label: string }[] = [
  { value: 'monthly', label: 'شهرياً' },
  { value: 'quarterly', label: 'ربعياً' },
  { value: 'annual', label: 'سنوياً' },
]

export type SectorFocus = 'single' | 'diverse' | 'opportunistic'
export const SECTOR_FOCUS_OPTIONS: { value: SectorFocus; label: string }[] = [
  { value: 'single', label: 'قطاع واحد — متخصّص' },
  { value: 'diverse', label: 'محفظة متنوّعة — 3+ قطاعات' },
  { value: 'opportunistic', label: 'انتهازي — حسب الفرصة' },
]

export type InvolvementType = 'active_board' | 'observer' | 'passive'
export const INVOLVEMENT_OPTIONS: { value: InvolvementType; label: string }[] = [
  { value: 'active_board', label: 'فعّال — مقعد مجلس وقرارات' },
  { value: 'observer', label: 'مراقب — مقعد مراقبة وتقارير' },
  { value: 'passive', label: 'سلبي — استثمار ومتابعة فقط' },
]

export type TicketSize = 'under_100k' | '100k_1m' | '1m_10m' | '10m_plus'
export const TICKET_SIZE_OPTIONS: { value: TicketSize; label: string }[] = [
  { value: 'under_100k', label: 'أقل من 100 ألف ريال' },
  { value: '100k_1m', label: '100 ألف – 1 مليون ريال' },
  { value: '1m_10m', label: '1 – 10 مليون ريال' },
  { value: '10m_plus', label: 'أكثر من 10 مليون ريال' },
]

export interface InvestorAnswers {
  portfolioSize: PortfolioOption
  investmentStage: StageOption
  monitoringCadence: CadenceOption
  sectorFocus: SectorFocus
  involvementType: InvolvementType
  ticketSize: TicketSize
}

export interface InvestorResult {
  breadthScore: number
  disciplineScore: number
  involvementScore: number
  capitalScore: number
  riskAppetiteLabel: string
  overallScore: number
  band: 'مبتدئ' | 'متطوّر' | 'متقدّم' | 'مؤسسي'
  insights: {
    axis: 'اتّساع المحفظة' | 'انضباط المتابعة' | 'مستوى المشاركة' | 'حجم رأس المال'
    pct: number
  }[]
  recommendations: { title: string; detail: string }[]
}
