import { api } from './api'

export type DeptCode =
  | 'HR'
  | 'FINANCE'
  | 'SALES'
  | 'MARKETING'
  | 'OPERATIONS'
  | 'IT'
  | 'CUSTOMER_SERVICE'
  | 'SUPPORT'
  | 'LOGISTICS'
  | 'QUALITY'
  | 'PROJECTS'
  | 'GOVERNANCE'
  | 'COMPLIANCE'

export type AuditAxis = 'governance' | 'financial' | 'team' | 'digital'
export type DangerZone = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'

export interface DeptQOption {
  value: string
  label: string
  score: 0 | 1 | 2 | 3
}

export interface DeptQuestion {
  id: string
  axis: AuditAxis
  prompt: string
  options: DeptQOption[]
}

export interface AxisBreakdown {
  axis: AuditAxis
  raw: number
  rawMax: number
  score: number
  cap: number
}

export interface AuditScore {
  byAxis: AxisBreakdown[]
  governance: number
  financial: number
  team: number
  digital: number
  total: number
  healthPct: number
  dangerZone: DangerZone
}

export interface Department {
  id: string
  companyId: string
  type: DeptCode
  managerId?: string | null
  auditScore?: number | null
  auditData?: AuditScore | null
  kpiData?: unknown
  smartData?: unknown
  createdAt: string
  updatedAt: string
}

export const DEPT_LABEL: Record<DeptCode, string> = {
  HR: 'الموارد البشرية',
  FINANCE: 'المالية',
  SALES: 'المبيعات',
  MARKETING: 'التسويق',
  OPERATIONS: 'العمليات',
  IT: 'تقنية المعلومات',
  CUSTOMER_SERVICE: 'خدمة العملاء',
  SUPPORT: 'الإمداد والدعم',
  LOGISTICS: 'اللوجستيات',
  QUALITY: 'الجودة',
  PROJECTS: 'المشاريع',
  GOVERNANCE: 'الحوكمة',
  COMPLIANCE: 'الامتثال',
}

export const DEPT_ICON: Record<DeptCode, string> = {
  HR: '👤',
  FINANCE: '💰',
  SALES: '💼',
  MARKETING: '📢',
  OPERATIONS: '⚙️',
  IT: '💻',
  CUSTOMER_SERVICE: '📞',
  SUPPORT: '🚚',
  LOGISTICS: '📦',
  QUALITY: '✅',
  PROJECTS: '📋',
  GOVERNANCE: '🏛️',
  COMPLIANCE: '⚖️',
}

export function dangerZoneColor(zone: DangerZone): string {
  switch (zone) {
    case 'GREEN':  return 'text-emerald-700 bg-emerald-100 border-emerald-200'
    case 'YELLOW': return 'text-yellow-800 bg-yellow-100 border-yellow-200'
    case 'ORANGE': return 'text-orange-800 bg-orange-100 border-orange-200'
    case 'RED':    return 'text-red-800 bg-red-100 border-red-200'
  }
}

// ─── Endpoints ─────────────────────────────────────────────────────────────

export async function listDepartments(companyId: string): Promise<Department[]> {
  const { data } = await api.get(`/api/departments/company/${companyId}`)
  return data
}

// R4 — OPEX على Company (تشغيلي، يُستخدم لتغذية Gap/KPIs/Ansoff/Financial).
export interface CompanyOpex {
  team?: number
  budget?: number
  target?: number
  avgSalary?: number
}

// تعريف العميل (اختياريّ) — يُدخَل عند الإضافة، يُغذّي تكييف التحليل لاحقاً.
export interface CompanyProfile {
  serviceType?: string
  pricingModel?: string[]   // متعدّد: قد تجمع الشركة مشاريع + اشتراكات
  customerType?: string
  // إشارات الوضع/النطاق/الهيكل (اختياريّة، عرض/تخزين فقط الآن — الوصل بالمنطق مؤجَّل).
  trajectory?: string        // اتجاه الأداء: fast_growth/slow_growth/flat/decline/crisis
  runway?: string            // البقاء المالي: 12plus/6to12/3to6/under3
  marketScope?: string       // نطاق العمل: local/regional/international
  geoSpread?: string         // حجم النطاق: one_city/multi_city/national/multinational
  deptCount?: string         // عدد الإدارات: 1/2-3/4-6/7plus
  systemsMaturity?: string   // ERP/CRM: full/partial/none/excel
}

export interface Company {
  id: string
  name: string
  sector?: string | null
  subsector?: string | null
  entityType?: string | null
  opex?: CompanyOpex | null
  profile?: CompanyProfile | null
  size: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE'
  stage?: string | null
  country: string
}

export interface CompanyWithRole extends Company {
  role: string
  logoUrl?: string | null
  createdAt?: string
}

export async function listMyCompanies(): Promise<CompanyWithRole[]> {
  const { data } = await api.get('/api/companies')
  return data
}

export async function createCompany(payload: { name: string; sector?: string; size: Company['size']; stage?: string; country?: string; logoUrl?: string; profile?: CompanyProfile }): Promise<Company> {
  const { data } = await api.post('/api/companies', payload)
  return data
}

export async function updateCompany(id: string, payload: Partial<{ name: string; sector: string; size: Company['size']; stage: string; country: string; logoUrl: string }>): Promise<Company> {
  const { data } = await api.patch(`/api/companies/${id}`, payload)
  return data
}

export async function deleteCompanyById(id: string): Promise<void> {
  await api.delete(`/api/companies/${id}`)
}

export async function getMyFirstCompany(): Promise<{ company: Company | null }> {
  const { data } = await api.get('/api/departments/me/first-company')
  return data
}

export async function createDepartment(payload: { companyId: string; type: DeptCode }): Promise<Department> {
  const { data } = await api.post('/api/departments', payload)
  return data
}

export async function getDeptQuestions(deptId: string, variant: 'basic' | 'pro' = 'basic'): Promise<{ deptType: DeptCode; variant: string; questions: DeptQuestion[] }> {
  const { data } = await api.get(`/api/departments/${deptId}/questions`, { params: { variant } })
  return data
}

export async function submitDeptAudit(deptId: string, answers: { questionId: string; value: string }[]): Promise<{ deptType: DeptCode; score: AuditScore }> {
  const { data } = await api.post(`/api/departments/${deptId}/audit`, { answers })
  return data
}

export async function submitDeptAuditPro(deptId: string, answers: { questionId: string; value: string }[]): Promise<{ deptType: DeptCode; score: AuditScore }> {
  const { data } = await api.post(`/api/departments/${deptId}/audit-pro`, { answers })
  return data
}

export async function getLatestDeptAudit(deptId: string): Promise<{ deptType: DeptCode; audit: { id: string; auditType: string; scores: AuditScore; healthPct: number; createdAt: string } | null }> {
  const { data } = await api.get(`/api/departments/${deptId}/audit/latest`)
  return data
}

export async function submitDeptSmart(deptId: string): Promise<{ deptType: DeptCode; recommendations: { kpis: { name: string; unit: string; targetValue: number; frequency: string }[]; insights: { axis: string; severity: string; insight: string }[] } }> {
  const { data } = await api.post(`/api/departments/${deptId}/smart`, {})
  return data
}

// ─── Compliance ────────────────────────────────────────────────────────────

export interface ComplianceMeta {
  axes: { key: string; label: string; regulator: string; mandatory: boolean; sectors?: string[] }[]
  koLicenses: { key: string; label: string; axis: string; appliesWhen?: string; sectors?: string[] }[]
}

export async function getComplianceMeta(): Promise<ComplianceMeta> {
  const { data } = await api.get('/api/compliance/meta')
  return data
}

export async function getComplianceQuestions(companyId: string, variant: 'basic' | 'pro' = 'basic') {
  const { data } = await api.get(`/api/compliance/${companyId}/questions`, { params: { variant } })
  return data
}

export interface ComplianceBasicResult {
  rawScore: number
  maxScore: number
  maturityPct: number
  dangerZone: DangerZone
}

export async function submitComplianceBasic(companyId: string, answers: { questionId: string; value: string }[]): Promise<{ result: ComplianceBasicResult; auditId: string }> {
  const { data } = await api.post(`/api/compliance/${companyId}/audit`, { answers })
  return data
}

export interface ComplianceProResult {
  overallMaturityPct: number
  dangerZone: DangerZone
  axes: {
    axis: string
    label: string
    regulator: string
    maturityPct: number
    dangerZone: DangerZone
    koFlag: boolean
    warnings: string[]
  }[]
  riskMatrix: { axis: string; label: string; probability: number; impact: number; risk: number; topRisk: string }[]
  penaltyEstimate: { currency: string; maxPenalty: number; estimate: number; perAxis: { axis: string; share: number; estimate: number }[] }
  reformPlan: { week: number; axis: string; action: string; owner: string }[]
  koLicenses: { key: string; label: string; daysUntilExpiry: number | null; warning: 'OK' | '90_DAYS' | '30_DAYS' | 'EXPIRED' }[]
}

export async function submitCompliancePro(
  companyId: string,
  payload: { answers: { questionId: string; value: string }[]; koLicenses?: { key: string; expiresAt: string | null }[] }
): Promise<{ result: ComplianceProResult; auditId: string }> {
  const { data } = await api.post(`/api/compliance/${companyId}/audit-pro`, payload)
  return data
}

export async function getLatestCompliance(companyId: string) {
  const { data } = await api.get(`/api/compliance/${companyId}/latest`)
  return data
}
