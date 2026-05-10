// Mirror of server/src/lib/diagnosticQuestions.ts kept in sync by hand —
// the server is the authoritative scoring engine; this file just drives
// the wizard UI and Zod validation on the client.

export type StageOption = 'struggle' | 'startup' | 'scaling' | 'stable'
export type SizeOption = 'micro' | 'small' | 'medium' | 'large'
export type DependencyOption = 'total' | 'high' | 'low'
export type FinancialTrackingOption = 'none' | 'manual' | 'good' | 'perfect'
export type LiquidityOption = 'critical' | 'low' | 'mid' | 'high'
export type GovernanceOption = 'none' | 'partial' | 'system' | 'board'
export type ScalabilityOption = 'none' | 'mid' | 'easy'
export type ExitOption = 'none' | 'ipo' | 'mna' | 'family'

export interface OwnerAnswers {
  companyName: string
  sector: string
  stage: StageOption
  size: SizeOption
  ownerDependency: DependencyOption
  financialTracking: FinancialTrackingOption
  liquidity: LiquidityOption
  governance: GovernanceOption
  scalability: ScalabilityOption
  exitStrategy: ExitOption
}

interface QOption<V extends string> {
  value: V
  label: string
}

export interface OwnerQuestion<K extends keyof OwnerAnswers, V extends string> {
  key: K
  label: string
  prompt: string
  options: QOption<V>[]
}

export const OWNER_QUESTIONS = [
  {
    key: 'stage',
    label: 'Business stage',
    prompt: 'Which stage best describes your company today?',
    options: [
      { value: 'struggle', label: 'Struggling — survival mode' },
      { value: 'startup', label: 'Startup — under 2 years' },
      { value: 'scaling', label: 'Scaling — growing rapidly' },
      { value: 'stable', label: 'Stable — established and profitable' },
    ],
  },
  {
    key: 'size',
    label: 'Entity size',
    prompt: 'How large is the team?',
    options: [
      { value: 'micro', label: 'Micro — 1–9' },
      { value: 'small', label: 'Small — 10–49' },
      { value: 'medium', label: 'Medium — 50–249' },
      { value: 'large', label: 'Large — 250+' },
    ],
  },
  {
    key: 'ownerDependency',
    label: 'Owner dependency',
    prompt: 'How much does the company depend on you personally?',
    options: [
      { value: 'total', label: 'Total — nothing happens without me' },
      { value: 'high', label: 'High — major decisions only' },
      { value: 'low', label: 'Low — runs without me for weeks' },
    ],
  },
  {
    key: 'financialTracking',
    label: 'Financial tracking',
    prompt: 'How do you track financials?',
    options: [
      { value: 'none', label: 'No tracking' },
      { value: 'manual', label: 'Manual / spreadsheets' },
      { value: 'good', label: 'Accounting system, monthly closes' },
      { value: 'perfect', label: 'Real-time dashboards + audited statements' },
    ],
  },
  {
    key: 'liquidity',
    label: 'Liquidity status',
    prompt: 'How healthy is the cash runway?',
    options: [
      { value: 'critical', label: 'Critical — under 1 month' },
      { value: 'low', label: 'Low — 1–3 months' },
      { value: 'mid', label: 'Mid — 3–6 months' },
      { value: 'high', label: 'High — 6+ months' },
    ],
  },
  {
    key: 'governance',
    label: 'Governance level',
    prompt: 'How is decision-making governed?',
    options: [
      { value: 'none', label: 'No formal governance' },
      { value: 'partial', label: 'Partial — some written processes' },
      { value: 'system', label: 'Established system + delegations' },
      { value: 'board', label: 'Active board + formal committees' },
    ],
  },
  {
    key: 'scalability',
    label: 'Scalability',
    prompt: 'How easily can the business grow without breaking?',
    options: [
      { value: 'none', label: 'Not scalable today' },
      { value: 'mid', label: 'Some scalability with effort' },
      { value: 'easy', label: 'Easily scalable — systems in place' },
    ],
  },
  {
    key: 'exitStrategy',
    label: 'Exit strategy',
    prompt: 'What is the long-term exit plan?',
    options: [
      { value: 'none', label: 'No exit plan yet' },
      { value: 'family', label: 'Pass to family' },
      { value: 'mna', label: 'Acquisition (M&A)' },
      { value: 'ipo', label: 'IPO / public listing' },
    ],
  },
] as const satisfies ReadonlyArray<
  | OwnerQuestion<'stage', StageOption>
  | OwnerQuestion<'size', SizeOption>
  | OwnerQuestion<'ownerDependency', DependencyOption>
  | OwnerQuestion<'financialTracking', FinancialTrackingOption>
  | OwnerQuestion<'liquidity', LiquidityOption>
  | OwnerQuestion<'governance', GovernanceOption>
  | OwnerQuestion<'scalability', ScalabilityOption>
  | OwnerQuestion<'exitStrategy', ExitOption>
>

export const STRATEGIC_PATHS = [
  'EMERGENCY_RISK',
  'NASCENT_CAUTIOUS',
  'GROWING_CHAOTIC',
  'MATURE_COMPETITIVE',
  'DEFAULT_STRATEGIC',
] as const
export type StrategicPath = (typeof STRATEGIC_PATHS)[number]

export interface OwnerDiagnosticResult {
  strategicPath: StrategicPath
  pathScores: Record<StrategicPath, number>
  maturityScore: number
  pointsBreakdown: { key: keyof OwnerAnswers; label: string; points: number; max: number }[]
  radarData: { axis: 'Governance' | 'Financial' | 'Team' | 'Digital'; value: number }[]
  weaknesses: { key: keyof OwnerAnswers; label: string; pct: number }[]
  roadmap: { title: string; detail: string; source: keyof OwnerAnswers }[]
  scenarios: { name: 'optimistic' | 'pessimistic'; headline: string; detail: string }[]
}
