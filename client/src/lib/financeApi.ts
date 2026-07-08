import { api } from './api'

// ─── C12 — نقطة التعادل ─────────────────────────────────────────────────────
// المصدر الوحيد للحقيقة = القاعدة عبر API. لا localStorage.

export type BreakEvenSeverity = 'GOOD' | 'WARNING' | 'CRITICAL'

export interface BreakEvenInsight {
  severity: BreakEvenSeverity
  message: string
  action?: string
}

export interface BreakEvenResult {
  contributionMargin: number
  contributionMarginPct: number | null
  breakEvenUnits: number | null
  breakEvenRevenue: number | null
  safetyMarginPct: number | null
  headline: string
  insights: BreakEvenInsight[]
}

export interface BreakEven {
  id: string
  companyId: string
  fixedCosts: number
  variableCostPerUnit: number
  pricePerUnit: number
  currentRevenue: number | null
  result: BreakEvenResult
  createdAt: string
}

export interface BreakEvenInputs {
  companyId: string
  fixedCosts: number
  variableCostPerUnit: number
  pricePerUnit: number
  currentRevenue?: number
}

export async function createBreakEven(payload: BreakEvenInputs): Promise<BreakEven> {
  const { data } = await api.post('/api/finance/break-even', payload)
  return data
}

export async function getLatestBreakEven(companyId: string): Promise<BreakEven | null> {
  const { data } = await api.get(`/api/finance/break-even/${companyId}/latest`)
  return data.breakEven as BreakEven | null
}

export async function getBreakEvenHistory(companyId: string): Promise<BreakEven[]> {
  const { data } = await api.get(`/api/finance/break-even/${companyId}/history`)
  return data
}
