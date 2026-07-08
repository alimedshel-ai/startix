export type UserType = 'OWNER' | 'MANAGER' | 'INVESTOR'
export type ManagerType = 'INTERNAL' | 'INDEPENDENT_PRO'
export type PlanTier = 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'

// تخصّص الإدارة للمدير المستقل — يطابق DeptType في Prisma / DeptCode في deptApi.
export type SpecialtyDeptType =
  | 'HR' | 'FINANCE' | 'SALES' | 'MARKETING' | 'OPERATIONS' | 'IT'
  | 'CUSTOMER_SERVICE' | 'SUPPORT' | 'LOGISTICS' | 'QUALITY'
  | 'PROJECTS' | 'GOVERNANCE' | 'COMPLIANCE'

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
  createdAt: string
}
