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
