export type UserType = 'OWNER' | 'MANAGER' | 'INVESTOR'
export type ManagerType = 'INTERNAL' | 'INDEPENDENT_PRO'
export type PlanTier = 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'

// المسار الاستراتيجي المُختار في onboarding (شريحة ٤) — يقود:
//   • فلترة السايدبار (المراحل الخارجة عن المسار تُطوى مع hint).
//   • إبراز الأفق المطابق في /three-horizons و /choices.
//   • ترتيب "التالي لك الآن" في السايدبار.
// null → قدماء بلا اختيار → يُعامَلون كـ LONG (كل شيء ظاهر).
export type StrategyPath = 'QUICK' | 'MEDIUM' | 'LONG'

// تخصّص الإدارة للمدير المستقل — يطابق DeptType في Prisma / DeptCode في deptApi.
export type SpecialtyDeptType =
  | 'HR' | 'FINANCE' | 'SALES' | 'MARKETING' | 'OPERATIONS' | 'IT'
  | 'CUSTOMER_SERVICE' | 'SUPPORT' | 'LOGISTICS' | 'QUALITY'
  | 'PROJECTS' | 'GOVERNANCE' | 'COMPLIANCE'

// R1 — أكواد الآلام والأهداف من /onboarding.
// pains: 6 أكواد ("no_kpis" | "no_alignment" | "team_lost" | "no_data" | "no_time" | "no_budget")
// goals: 7 أكواد ("improve" | "reports" | "plan" | "kpis" | "alignment" | "team" | "swot")
export type PainCode = 'no_kpis' | 'no_alignment' | 'team_lost' | 'no_data' | 'no_time' | 'no_budget'
export type GoalCode = 'improve' | 'reports' | 'plan' | 'kpis' | 'alignment' | 'team' | 'swot'

// R1 — OPEX (رأس مال تشغيلي) على مستوى الشركة.
export interface OpexData {
  team?: number      // عدد أعضاء الفريق
  budget?: number    // الميزانية السنوية (SAR)
  target?: number    // المستهدف السنوي (SAR أو %)
  avgSalary?: number // متوسط الراتب الشهري (SAR)
}

export interface User {
  id: string
  email: string
  name: string
  userType: UserType
  managerType: ManagerType | null
  specialtyDeptType: SpecialtyDeptType | null
  phone: string | null
  avatarUrl: string | null
  plan: PlanTier
  isVerified: boolean
  isAdmin: boolean
  pains: string[]
  goals: string[]
  strategyPath: StrategyPath | null
  pathChosenAt: string | null
  createdAt: string
}
