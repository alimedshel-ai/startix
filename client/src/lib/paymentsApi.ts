import { api } from './api'

export type PlanTier = 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE'

export interface PlanSummary {
  tier: PlanTier
  labelAr: string
  priceLabelAr: string
  priceSARMonthly: number | null
  features: string[]
  selfServe: boolean
}

export async function listPlans(): Promise<{ plans: PlanSummary[]; stripeReady: boolean }> {
  const { data } = await api.get('/api/payments/plans')
  return data
}

export async function createCheckout(plan: 'PROFESSIONAL' | 'ENTERPRISE'): Promise<{ url: string }> {
  const { data } = await api.post('/api/payments/create-checkout', { plan })
  return data
}

export async function billingPortal(): Promise<{ url: string }> {
  const { data } = await api.get('/api/payments/portal')
  return data
}
