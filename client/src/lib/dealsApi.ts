import { api } from './api'

// ─── C14 — صفقات المستثمر ───────────────────────────────────────────────────
// كل شيء عبر API. الشركة الهدف اسم حرّ بلا FK (اعتبار MVP في الخطة).

export type DealStatus = 'lead' | 'due_diligence' | 'term_sheet' | 'closed_won' | 'closed_lost'

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  lead: 'عميل محتمل',
  due_diligence: 'دراسة تفصيلية',
  term_sheet: 'ورقة شروط',
  closed_won: 'أُنجزت',
  closed_lost: 'خسِرت',
}

export const DEAL_STATUS_ORDER: DealStatus[] = [
  'lead',
  'due_diligence',
  'term_sheet',
  'closed_won',
  'closed_lost',
]

export interface Deal {
  id: string
  investorUserId: string
  targetCompanyName: string
  sector: string | null
  stage: string | null
  valuation: number | null
  status: DealStatus
  createdAt: string
  updatedAt: string
}

export interface DealCreatePayload {
  targetCompanyName: string
  sector?: string
  stage?: string
  valuation?: number
  status?: DealStatus
}

export type DealUpdatePayload = Partial<{
  targetCompanyName: string
  sector: string | null
  stage: string | null
  valuation: number | null
  status: DealStatus
}>

export async function listDeals(): Promise<Deal[]> {
  const { data } = await api.get('/api/deals')
  return data
}

export async function createDeal(payload: DealCreatePayload): Promise<Deal> {
  const { data } = await api.post('/api/deals', payload)
  return data
}

export async function updateDeal(id: string, payload: DealUpdatePayload): Promise<Deal> {
  const { data } = await api.patch(`/api/deals/${id}`, payload)
  return data
}

export async function deleteDeal(id: string): Promise<void> {
  await api.delete(`/api/deals/${id}`)
}
