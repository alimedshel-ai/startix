import { api } from './api'

export type ReportType = 'strategic' | 'compliance' | 'department' | 'annual' | 'executive'

export interface ReportSummary {
  id: string
  type: string
  title: string
  fileUrl: string | null
  createdAt: string
}

export interface Report {
  id: string
  companyId: string
  type: string
  title: string
  fileUrl: string | null
  data: unknown
  createdAt: string
}

export async function generateReport(payload: { companyId: string; type: ReportType; departmentId?: string }): Promise<Report> {
  const { data } = await api.post('/api/reports', payload)
  return data
}

export async function listReports(companyId: string): Promise<ReportSummary[]> {
  const { data } = await api.get(`/api/reports/company/${companyId}`)
  return data
}

export async function getReport(id: string): Promise<Report> {
  const { data } = await api.get(`/api/reports/${id}`)
  return data
}

export async function deleteReport(id: string): Promise<void> {
  await api.delete(`/api/reports/${id}`)
}

// ─── مشاركة عامّة ────────────────────────────────────────────────────────────
export interface ShareResult {
  url: string
  shareToken: string
  shareExpires: string
  emailed: boolean
}

/** سكّ رابط مشاركة عامّ (PROFESSIONAL+). recipientEmail اختياريّ → يُرسِله بريديّاً. */
export async function shareReport(
  id: string,
  opts: { recipientEmail?: string; expiresInDays?: number } = {},
): Promise<ShareResult> {
  const { data } = await api.post(`/api/reports/${id}/share`, opts)
  return data
}

/** قراءة عامّة بالتوكن — بلا مصادقة (404 على منتهٍ/مفقود، لا 401). */
export async function getSharedReport(token: string): Promise<{ type: string; title: string; data: unknown; createdAt: string }> {
  const { data } = await api.get(`/api/reports/shared/${token}`)
  return data
}
