// بنوك أسئلة وأنواع نتائج المدير + المستثمر — تطابق
// server/src/services/managerInvestorEngine.ts (مرآة يدوية كما في
// diagnosticQuestions.ts).

export type DeptType =
  | 'HR' | 'FINANCE' | 'SALES' | 'MARKETING' | 'OPERATIONS' | 'IT'
  | 'CUSTOMER_SERVICE' | 'SUPPORT' | 'LOGISTICS' | 'QUALITY'
  | 'PROJECTS' | 'GOVERNANCE' | 'COMPLIANCE'

export type ToolingOption = 'none' | 'basic' | 'modern' | 'advanced'

export interface ManagerAnswers {
  departmentType: DeptType
  experienceYears: number
  teamSize: number
  toolingMaturity: ToolingOption
  topChallenge: string
}

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

export const TOOLING_OPTIONS: { value: ToolingOption; label: string }[] = [
  { value: 'none', label: 'لا يوجد — يدوي' },
  { value: 'basic', label: 'أساسي — جداول إكسل' },
  { value: 'modern', label: 'حديث — برامج سحابية' },
  { value: 'advanced', label: 'متقدّم — منظومة متكاملة' },
]

export interface ManagerResult {
  departmentLabel: string
  capacityScore: number
  toolingScore: number
  experienceScore: number
  overallScore: number
  band: 'متعثّر' | 'يحتاج تطوير' | 'فعّال' | 'متقدّم'
  insights: { axis: 'الفريق' | 'الأدوات' | 'الخبرة'; pct: number }[]
  recommendations: { title: string; detail: string }[]
}

// ─── المستثمر ───────────────────────────────────────────────────────────────

export type PortfolioOption = '1' | '2-5' | '6-15' | '16+'
export type StageOption = 'seed' | 'early' | 'growth' | 'late'
export type CadenceOption = 'monthly' | 'quarterly' | 'annual'

export interface InvestorAnswers {
  portfolioSize: PortfolioOption
  investmentStage: StageOption
  monitoringCadence: CadenceOption
}

export const PORTFOLIO_OPTIONS: { value: PortfolioOption; label: string }[] = [
  { value: '1', label: 'شركة واحدة' },
  { value: '2-5', label: '٢–٥ شركات' },
  { value: '6-15', label: '٦–١٥ شركة' },
  { value: '16+', label: '١٦+ شركة' },
]

export const STAGE_OPTIONS: { value: StageOption; label: string }[] = [
  { value: 'seed', label: 'تأسيس' },
  { value: 'early', label: 'مرحلة مبكرة' },
  { value: 'growth', label: 'نموّ' },
  { value: 'late', label: 'متأخرة / مدرجة' },
]

export const CADENCE_OPTIONS: { value: CadenceOption; label: string }[] = [
  { value: 'monthly', label: 'شهري' },
  { value: 'quarterly', label: 'ربعي' },
  { value: 'annual', label: 'سنوي' },
]

export interface InvestorResult {
  breadthScore: number
  disciplineScore: number
  riskAppetiteLabel: string
  overallScore: number
  band: 'مبتدئ' | 'متطوّر' | 'متقدّم' | 'مؤسسي'
  insights: { axis: 'اتّساع المحفظة' | 'انضباط المتابعة' | 'مرحلة الاستثمار'; pct: number }[]
  recommendations: { title: string; detail: string }[]
}
