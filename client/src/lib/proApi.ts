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
