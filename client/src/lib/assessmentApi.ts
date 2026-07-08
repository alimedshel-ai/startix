import { api } from './api'

// ─── C18–C20 — محرك التقييم (كلاينت) ───────────────────────────────────────

export type AssessmentModelType = 'BSC' | 'EFQM' | 'PESTEL' | 'PORTER' | 'OKR' | 'CUSTOM'
export type AssessmentStatus = 'draft' | 'active' | 'completed' | 'archived'

export interface Indicator {
  id: string
  criterionId: string
  name: string
  value: number | null
  target: number | null
  unit: string | null
}

export interface Criterion {
  id: string
  dimensionId: string
  name: string
  weight: number
  score: number | null
  indicators?: Indicator[]
}

export interface Dimension {
  id: string
  assessmentId: string
  name: string
  weight: number
  order: number
  criteria?: Criterion[]
}

export interface Assessment {
  id: string
  companyId: string
  name: string
  modelType: AssessmentModelType
  status: AssessmentStatus
  maturityScore: number | null
  startDate: string | null
  endDate: string | null
  createdAt: string
  dimensions?: Dimension[]
}

// ─── C19 — Templates ───────────────────────────────────────────────────────

export interface TemplateSummary {
  modelType: Exclude<AssessmentModelType, 'CUSTOM'>
  displayName: string
  description: string
  dimensionsCount: number
  criteriaCount: number
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  const { data } = await api.get('/api/assessments/templates')
  return data
}

export async function createFromTemplate(payload: {
  companyId: string
  modelType: Exclude<AssessmentModelType, 'CUSTOM'>
  name?: string
  status?: AssessmentStatus
}): Promise<Assessment> {
  const { data } = await api.post('/api/assessments/from-template', payload)
  return data
}

// ─── C20 — Build from wizard draft ────────────────────────────────────────

export interface WizardCriterionDraft {
  name: string
  weight: number
  score?: number
}

export interface WizardDimensionDraft {
  name: string
  weight: number
  order?: number
  criteria: WizardCriterionDraft[]
}

export interface BuildAssessmentPayload {
  companyId: string
  name: string
  modelType: AssessmentModelType
  status?: AssessmentStatus
  dimensions: WizardDimensionDraft[]
}

export async function buildAssessment(payload: BuildAssessmentPayload): Promise<Assessment> {
  const { data } = await api.post('/api/assessments/build', payload)
  return data
}

// ─── C20 — AI generate criteria ────────────────────────────────────────────

export interface AIGeneratedDimension {
  name: string
  weight: number
  order: number
  criteria: { name: string; weight: number }[]
}

export interface AIGeneratedAssessment {
  modelType: Exclude<AssessmentModelType, 'CUSTOM'>
  dimensions: AIGeneratedDimension[]
}

export async function generateAssessmentAI(payload: {
  companyId: string
  modelType: Exclude<AssessmentModelType, 'CUSTOM'>
}): Promise<AIGeneratedAssessment> {
  const { data } = await api.post('/api/ai/generate-assessment', payload)
  return data
}

// ─── C18 — CRUD helpers used by the wizard result view ─────────────────────

export async function listAssessments(companyId: string): Promise<Assessment[]> {
  const { data } = await api.get(`/api/assessments/company/${companyId}`)
  return data
}

export async function getAssessment(id: string): Promise<Assessment> {
  const { data } = await api.get(`/api/assessments/${id}`)
  return data
}

export async function updateCriterion(id: string, payload: { score?: number | null }): Promise<Criterion> {
  const { data } = await api.patch(`/api/assessments/criteria/${id}`, payload)
  return data
}

export async function calculateMaturity(id: string): Promise<{
  assessment: Assessment
  breakdown: { dimensionId: string; dimensionName: string; weight: number; dimensionAvg: number; contribution: number }[]
  maturityScore: number
}> {
  const { data } = await api.post(`/api/assessments/${id}/calculate`, {})
  return data
}
