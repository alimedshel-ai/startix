import { api } from './api'
import type { DangerZone, DeptCode } from './deptApi'

// ─── PRO-B — عملاء المدير المستقل ─────────────────────────────────────────────
// wrapper مُصغّر لـ /api/pro/*: يخدم شاشة "عملائي" للمدير المستقل فقط.
// المرجع (السيرفر): server/src/controllers/pro.ts

export interface ProClientCompany {
  id: string
  name: string
  sector?: string | null
  size: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE'
  stage?: string | null
}

export interface ProClientLatestAudit {
  id: string
  auditType: string
  healthPct: number
  dangerZone: DangerZone | null
  createdAt: string
}

export interface ProClient {
  company: ProClientCompany
  role: string
  department: { id: string; type: DeptCode } | null
  latestAudit: ProClientLatestAudit | null
}

export interface ProClientsResponse {
  specialty: DeptCode
  clients: ProClient[]
}

export async function listMyClients(): Promise<ProClientsResponse> {
  const { data } = await api.get<ProClientsResponse>('/api/pro/clients')
  return data
}

// ─── PRO-2 — /api/pro/overview ────────────────────────────────────────────
// تجميع موحّد للوحة "محفظتي": مقاييس + رؤى + تنبيهات في طلب واحد.

export type PortfolioSeverity = 'info' | 'warning' | 'critical' | 'positive'

export interface OverviewClient {
  companyId: string
  companyName: string
  sector: string | null
  size: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE'
  stage: string | null
  specialty: DeptCode
  hasDepartment: boolean
  hasAnyAudit: boolean
  healthPct: number | null
  dangerZone: DangerZone | null
  lastAuditAt: string | null
  latestHealthPct: number | null
  previousHealthPct: number | null
  delta: number | null
  daysSinceLastAudit: number | null
  isStale: boolean
}

export interface PortfolioSummary {
  total: number
  avgHealth: number | null
  distribution: { GREEN: number; YELLOW: number; ORANGE: number; RED: number; NONE: number }
  staleCount: number
  redCount: number
  unaudited: number
}

export interface PortfolioInsight {
  code:
    | 'empty_portfolio'
    | 'no_audit_yet'
    | 'stale_coverage'
    | 'risk_concentration'
    | 'practice_gap'
    | 'expansion_ready'
  severity: PortfolioSeverity
  message: string
  affectedClientIds?: string[]
}

export interface PortfolioAlert {
  code: 'health_decline'
  companyId: string
  companyName: string
  delta: number
  previousHealthPct: number
  latestHealthPct: number
}

export interface ProOverviewResponse {
  specialty: DeptCode
  clients: OverviewClient[]
  summary: PortfolioSummary
  insights: PortfolioInsight[]
  alerts: PortfolioAlert[]
}

export async function getProOverview(): Promise<ProOverviewResponse> {
  const { data } = await api.get<ProOverviewResponse>('/api/pro/overview')
  return data
}
