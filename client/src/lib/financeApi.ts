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

// ─── C13 — تحليل Dupont ────────────────────────────────────────────────────

export interface DupontAnalysis {
  id: string
  companyId: string
  netMargin: number
  assetTurnover: number
  equityMultiplier: number
  roe: number
  createdAt: string
}

export interface DupontInputs {
  companyId: string
  netIncome: number
  revenue: number
  totalAssets: number
  equity: number
}

export async function createDupont(payload: DupontInputs): Promise<DupontAnalysis> {
  const { data } = await api.post('/api/finance/dupont', payload)
  return data
}

export async function getLatestDupont(companyId: string): Promise<DupontAnalysis | null> {
  const { data } = await api.get(`/api/finance/dupont/${companyId}/latest`)
  return data.dupont as DupontAnalysis | null
}

// ─── C13 — محاكاة Monte Carlo ──────────────────────────────────────────────

export interface TriangularDist {
  min: number
  likely: number
  max: number
}

export interface MonteCarloInputs {
  companyId: string
  revenue: TriangularDist
  variableCostPct: TriangularDist
  fixedCosts: TriangularDist
  iterations?: number
}

export interface MonteCarloResults {
  iterations: number
  mean: number
  p10: number
  p50: number
  p90: number
  /** احتمالية الخسارة كنسبة بين 0 و1 (مثلاً 0.14 = 14%). */
  probLoss: number
}

export interface MonteCarloRun {
  id: string
  companyId: string
  inputs: {
    revenue: TriangularDist
    variableCostPct: TriangularDist
    fixedCosts: TriangularDist
  }
  iterations: number
  results: MonteCarloResults
  createdAt: string
}

export async function createMonteCarloRun(payload: MonteCarloInputs): Promise<MonteCarloRun> {
  const { data } = await api.post('/api/finance/monte-carlo', payload)
  return data
}

export async function getLatestMonteCarloRun(companyId: string): Promise<MonteCarloRun | null> {
  const { data } = await api.get(`/api/finance/monte-carlo/${companyId}/latest`)
  return data.monteCarlo as MonteCarloRun | null
}
