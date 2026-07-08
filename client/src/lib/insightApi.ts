import { api } from './api'

// ─── C16 — محرك الاستدلال (توصيات حتمية) ──────────────────────────────────

export type RecommendationSeverity = 'info' | 'warning' | 'critical'

export type RecommendationSource = 'Diagnostic' | 'DeptAudit' | 'BreakEven' | 'Composite'

export const SOURCE_LABEL: Record<RecommendationSource, string> = {
  Diagnostic: 'التشخيص',
  DeptAudit: 'تدقيق الأقسام',
  BreakEven: 'نقطة التعادل',
  Composite: 'قراءة مركّبة',
}

export interface Recommendation {
  id: string
  companyId: string
  kind: string
  message: string
  severity: RecommendationSeverity
  source: RecommendationSource
  createdAt: string
}

export interface GenerateResponse {
  recommendations: Recommendation[]
  generated: number
}

export async function generateRecommendations(companyId: string): Promise<GenerateResponse> {
  const { data } = await api.post(`/api/insight/${companyId}/generate`, {})
  return data
}

export async function listRecommendations(companyId: string): Promise<Recommendation[]> {
  const { data } = await api.get(`/api/insight/${companyId}`)
  return data
}
