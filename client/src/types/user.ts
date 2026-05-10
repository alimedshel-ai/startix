export type UserType = 'OWNER' | 'MANAGER' | 'INVESTOR'
export type ManagerType = 'INTERNAL' | 'INDEPENDENT_PRO'
export type PlanTier = 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'

export interface User {
  id: string
  email: string
  name: string
  userType: UserType
  managerType: ManagerType | null
  phone: string | null
  avatarUrl: string | null
  plan: PlanTier
  isVerified: boolean
  createdAt: string
}
