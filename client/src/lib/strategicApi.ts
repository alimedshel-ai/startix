import { api } from './api'
import type { Company, DeptCode } from './deptApi'

// ─── PESTEL/Gap على مستوى الإدارة — أدوات المدير المستقل الخبير ─
// المفاتيح `PESTEL_<DEPT>` و `GAP_ANALYSIS_<DEPT>` تعمل بمنهجية القديم
// (pestel.html و gap-analysis.html) — كل إدارة تحتفظ بمخرَجها الخاص.
type DeptScopedArtifactType =
  | `PESTEL_${DeptCode}`
  | `GAP_ANALYSIS_${DeptCode}`
  | `VALUE_CHAIN_${DeptCode}`
  | `INTERNAL_ENV_${DeptCode}`

export type ArtifactType =
  | 'PESTEL'
  | 'PORTER'
  | 'BENCHMARK'
  | 'STAKEHOLDERS'
  | 'COMPANY_HEALTH'
  | 'ORG_DNA'
  | 'VALUE_CHAIN'
  | 'CORE_CAPABILITIES'
  | 'GAP_ANALYSIS'
  | 'RISK_REGISTER'
  | 'AMBITION_GAP'
  | 'STRATEGIC_TENSIONS'
  | 'DIRECTIONS'
  | 'CHOICES'
  | 'ANSOFF'
  | 'BCG'
  | 'SPACE'
  | 'QSPM'
  | 'THREE_HORIZONS'
  | 'PRIORITY_MATRIX'
  | 'OGSM'
  | 'ANNUAL_PLAN'
  | 'DEPT_DEEP_ANSWERS'
  | 'DEPT_DEEP_FULL'
  // R6 — الأدوات الأربع الأساسية المفقودة.
  | 'BMC' | 'BSC' | 'RACI' | 'EISENHOWER'
  // البيئة الداخلية (٧S) — على مستوى شركة.
  | 'INTERNAL_ENV'
  | DeptScopedArtifactType

export interface Artifact<T = unknown> {
  id: string
  companyId: string
  type: ArtifactType
  data: T
  updatedAt: string
  createdAt: string
}

export async function getArtifact<T = unknown>(companyId: string, type: ArtifactType): Promise<Artifact<T> | null> {
  const { data } = await api.get(`/api/strategic/artifacts/${companyId}/${type}`)
  return data.artifact as Artifact<T> | null
}

export async function upsertArtifact<T>(companyId: string, type: ArtifactType, payload: T): Promise<Artifact<T>> {
  const { data } = await api.put(`/api/strategic/artifacts/${companyId}/${type}`, { data: payload })
  return data
}

// R5 — قائمة كل الـartifacts لشركة (يستهلكها /journey لحساب اكتمال المراحل).
// السيرفر يرجّع array مباشرة، لا لفافة {artifacts:...}.
export async function listAllArtifacts(companyId: string): Promise<Artifact[]> {
  const { data } = await api.get<Artifact[]>(`/api/strategic/artifacts/${companyId}`)
  return data
}

// ─── SWOT / TOWS ───────────────────────────────────────────────────────────

export interface SWOT {
  id: string
  companyId: string
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
  tows?: { so?: string[]; wo?: string[]; st?: string[]; wt?: string[] } | null
  updatedAt: string
}

export async function getSWOT(companyId: string): Promise<SWOT> {
  const { data } = await api.get(`/api/strategic/swot/${companyId}`)
  return data
}
export async function putSWOT(companyId: string, payload: Pick<SWOT, 'strengths' | 'weaknesses' | 'opportunities' | 'threats'>): Promise<SWOT> {
  const { data } = await api.put(`/api/strategic/swot/${companyId}`, payload)
  return data
}
export async function putTOWS(companyId: string, payload: NonNullable<SWOT['tows']>): Promise<SWOT> {
  const { data } = await api.put(`/api/strategic/swot/${companyId}/tows`, payload)
  return data
}
export async function suggestTOWS(companyId: string): Promise<NonNullable<SWOT['tows']>> {
  const { data } = await api.post(`/api/strategic/swot/${companyId}/tows/suggest`, {})
  return data
}
// يبذر SWOT من آخر تشخيص للشركة (يدمج بلا طمس، بلا تكرار).
// السيرفر يعيد 404 إن لم يوجد تشخيص — نتركه للـ apiErrorMessage.
export async function seedSwotFromDiagnostic(companyId: string): Promise<SWOT> {
  const { data } = await api.post(`/api/strategic/swot/${companyId}/seed-from-diagnostic`, {})
  return data
}

// ─── Objectives + OKRs ─────────────────────────────────────────────────────
export interface OKR {
  id: string
  objectiveId: string
  keyResult: string
  targetValue: number
  currentValue: number
  unit?: string | null
  dueDate?: string | null
}
export interface Objective {
  id: string
  companyId: string
  title: string
  description?: string | null
  type: string
  status: string
  dueDate?: string | null
  okrs?: OKR[]
}

export async function listObjectives(companyId: string): Promise<Objective[]> {
  const { data } = await api.get(`/api/strategic/objectives/${companyId}`)
  return data
}
export async function createObjective(payload: Omit<Objective, 'id' | 'okrs' | 'status'> & { status?: string }): Promise<Objective> {
  const { data } = await api.post('/api/strategic/objectives', payload)
  return data
}
export async function updateObjective(id: string, payload: Partial<Objective>): Promise<Objective> {
  const { data } = await api.patch(`/api/strategic/objectives/${id}`, payload)
  return data
}
export async function deleteObjective(id: string): Promise<void> {
  await api.delete(`/api/strategic/objectives/${id}`)
}

export async function createOKR(payload: Omit<OKR, 'id' | 'currentValue'> & { currentValue?: number }): Promise<OKR> {
  const { data } = await api.post('/api/strategic/okrs', payload)
  return data
}
export async function updateOKR(id: string, payload: Partial<OKR>): Promise<OKR> {
  const { data } = await api.patch(`/api/strategic/okrs/${id}`, payload)
  return data
}
export async function deleteOKR(id: string): Promise<void> {
  await api.delete(`/api/strategic/okrs/${id}`)
}

// ─── KPIs ──────────────────────────────────────────────────────────────────
export interface KPI {
  id: string
  companyId: string
  departmentId?: string | null
  objectiveId?: string | null
  name: string
  unit: string
  targetValue: number
  currentValue: number
  frequency: string
}
export async function listKPIs(companyId: string): Promise<KPI[]> {
  const { data } = await api.get(`/api/strategic/kpis/${companyId}`)
  return data
}
export async function createKPI(payload: Omit<KPI, 'id' | 'currentValue'> & { currentValue?: number }): Promise<KPI> {
  const { data } = await api.post('/api/strategic/kpis', payload)
  return data
}
export async function updateKPI(id: string, payload: Partial<KPI>): Promise<KPI> {
  const { data } = await api.patch(`/api/strategic/kpis/${id}`, payload)
  return data
}
export async function deleteKPI(id: string): Promise<void> {
  await api.delete(`/api/strategic/kpis/${id}`)
}

export interface KPIEntry {
  id: string
  kpiId: string
  value: number
  notes?: string | null
  enteredAt: string
}
export async function listKPIEntries(kpiId: string): Promise<KPIEntry[]> {
  const { data } = await api.get(`/api/strategic/kpis/${kpiId}/entries`)
  return data
}
export async function createKPIEntry(payload: { kpiId: string; value: number; notes?: string }): Promise<KPIEntry> {
  const { data } = await api.post('/api/strategic/kpi-entries', payload)
  return data
}

// ─── Initiatives / Projects / Tasks ────────────────────────────────────────
export interface Initiative {
  id: string
  companyId: string
  title: string
  description?: string | null
  status: string
  priority: string
}
export interface Project {
  id: string
  companyId: string
  initiativeId?: string | null
  title: string
  description?: string | null
  status: string
  startDate?: string | null
  endDate?: string | null
  tasks?: Task[]
}
export interface Task {
  id: string
  companyId: string
  projectId?: string | null
  assigneeId?: string | null
  title: string
  description?: string | null
  status: string
  priority: string
  dueDate?: string | null
  completedAt?: string | null
  createdAt: string
}

export async function listInitiatives(companyId: string): Promise<Initiative[]> {
  const { data } = await api.get(`/api/strategic/initiatives/${companyId}`)
  return data
}
export async function createInitiative(p: Omit<Initiative, 'id' | 'status'> & { status?: string }) { const { data } = await api.post('/api/strategic/initiatives', p); return data as Initiative }
export async function updateInitiative(id: string, p: Partial<Initiative>) { const { data } = await api.patch(`/api/strategic/initiatives/${id}`, p); return data as Initiative }
export async function deleteInitiative(id: string) { await api.delete(`/api/strategic/initiatives/${id}`) }

export async function listProjects(companyId: string): Promise<Project[]> {
  const { data } = await api.get(`/api/strategic/projects/${companyId}`)
  return data
}
export async function createProject(p: Omit<Project, 'id' | 'status' | 'tasks'> & { status?: string }) { const { data } = await api.post('/api/strategic/projects', p); return data as Project }
export async function updateProject(id: string, p: Partial<Project>) { const { data } = await api.patch(`/api/strategic/projects/${id}`, p); return data as Project }
export async function deleteProject(id: string) { await api.delete(`/api/strategic/projects/${id}`) }

export async function listTasks(companyId: string): Promise<Task[]> {
  const { data } = await api.get(`/api/strategic/tasks/${companyId}`)
  return data
}
export async function createTask(p: Omit<Task, 'id' | 'status' | 'priority' | 'createdAt' | 'completedAt'> & { status?: string; priority?: string }) {
  const { data } = await api.post('/api/strategic/tasks', p)
  return data as Task
}
export async function updateTask(id: string, p: Partial<Task>) { const { data } = await api.patch(`/api/strategic/tasks/${id}`, p); return data as Task }
export async function deleteTask(id: string) { await api.delete(`/api/strategic/tasks/${id}`) }

// ─── Scenarios ─────────────────────────────────────────────────────────────
export interface ScenarioProjection { year: number; revenue: number; profit: number }
export interface Scenario {
  id: string
  companyId: string
  name: string
  assumptions: string[]
  projections: ScenarioProjection[]
  createdAt: string
}
export async function listScenarios(companyId: string): Promise<Scenario[]> {
  const { data } = await api.get(`/api/strategic/scenarios/${companyId}`)
  return data
}
export async function createScenario(p: Omit<Scenario, 'id' | 'createdAt'>) {
  const { data } = await api.post('/api/strategic/scenarios', p)
  return data as Scenario
}
export async function deleteScenario(id: string) { await api.delete(`/api/strategic/scenarios/${id}`) }

// ─── Reviews & corrections ─────────────────────────────────────────────────
export interface Review {
  id: string
  companyId: string
  type: string
  outcome?: string | null
  notes?: string | null
  corrections?: unknown
  reviewedAt: string
}
export interface Correction {
  id: string
  companyId: string
  reviewId?: string | null
  title: string
  description?: string | null
  owner?: string | null
  status: string
  dueDate?: string | null
  createdAt: string
}

export async function listReviews(companyId: string): Promise<Review[]> {
  const { data } = await api.get(`/api/strategic/reviews/${companyId}`)
  return data
}
export async function createReview(p: { companyId: string; type: string; outcome?: string; notes?: string; corrections?: { title: string; description?: string; owner?: string; dueDate?: string | null }[] }) {
  const { data } = await api.post('/api/strategic/reviews', p)
  return data as Review
}
export async function listCorrections(companyId: string): Promise<Correction[]> {
  const { data } = await api.get(`/api/strategic/corrections/${companyId}`)
  return data
}
export async function updateCorrection(id: string, p: Partial<Correction>) { const { data } = await api.patch(`/api/strategic/corrections/${id}`, p); return data as Correction }

// ─── Activity ──────────────────────────────────────────────────────────────
export interface ActivityRow {
  type: 'task' | 'kpi_entry' | 'review' | 'correction'
  at: string
  title: string
  status?: string
  outcome?: string
  value?: number
  id: string
}
export async function listActivity(companyId: string): Promise<ActivityRow[]> {
  const { data } = await api.get(`/api/strategic/activity/${companyId}`)
  return data
}

export interface Alert {
  id: string
  kind: 'kpi_at_risk' | 'overdue_task' | 'overdue_correction' | 'no_review'
  severity: 'low' | 'medium' | 'high'
  title: string
  detail: string
  at: string
}

export async function listAlerts(companyId: string): Promise<Alert[]> {
  const { data } = await api.get(`/api/strategic/alerts/${companyId}`)
  return data
}

// ─── Journey progress (المراحل 1→6) ───────────────────────────────────────
// خرائط المراحل الست حسب خطة الخيط الذهبي:
//   1) تشخيص     — وجود Diagnostic
//   2) بيئة      — وجود PESTEL أو PORTER
//   3) تركيب     — SWOT.strengths.length > 0
//   4) مسار      — وجود DIRECTIONS أو CHOICES
//   5) بناء      — objectives.length > 0
//   6) تنفيذ     — tasks.length > 0
// كل الاستدعاءات endpoints قائمة؛ لا تجميع سيرفري جديد.
export interface JourneyProgress {
  stage1: boolean
  stage2: boolean
  stage3: boolean
  stage4: boolean
  stage5: boolean
  stage6: boolean
  /** 1..6 أول مرحلة غير مكتملة، null لو الرحلة كلها مكتملة. */
  nextStage: 1 | 2 | 3 | 4 | 5 | 6 | null
}

async function hasDiagnostic(companyId: string): Promise<boolean> {
  try {
    await api.get(`/api/diagnostic/${companyId}/latest`)
    return true
  } catch {
    // 404 = لا تشخيص بعد. أي خطأ آخر نتعامل معه دفاعياً كـ "غير مكتمل".
    return false
  }
}

export async function getJourneyProgress(companyId: string): Promise<JourneyProgress> {
  const [diag, pestel, porter, swot, directions, choices, objectives, tasks] = await Promise.all([
    hasDiagnostic(companyId),
    getArtifact(companyId, 'PESTEL').catch(() => null),
    getArtifact(companyId, 'PORTER').catch(() => null),
    getSWOT(companyId).catch(() => null),
    getArtifact(companyId, 'DIRECTIONS').catch(() => null),
    getArtifact(companyId, 'CHOICES').catch(() => null),
    listObjectives(companyId).catch(() => [] as Objective[]),
    listTasks(companyId).catch(() => [] as Task[]),
  ])
  const stage1 = diag
  const stage2 = pestel !== null || porter !== null
  const stage3 = (swot?.strengths?.length ?? 0) > 0
  const stage4 = directions !== null || choices !== null
  const stage5 = objectives.length > 0
  const stage6 = tasks.length > 0

  const stages: boolean[] = [stage1, stage2, stage3, stage4, stage5, stage6]
  const firstIncomplete = stages.findIndex((s) => !s)
  const nextStage = firstIncomplete === -1 ? null : ((firstIncomplete + 1) as 1 | 2 | 3 | 4 | 5 | 6)

  return { stage1, stage2, stage3, stage4, stage5, stage6, nextStage }
}

// ─── Helpers shared with Phase 5 ───────────────────────────────────────────
export type { Company }
export { getMyFirstCompany } from './deptApi'
