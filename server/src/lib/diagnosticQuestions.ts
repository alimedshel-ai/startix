// Owner diagnostic question bank. Q1 is identification (company name + sector,
// not weighted). Q3–Q10 carry the points used by services/diagnosticEngine.ts.
// The 9-step wizard maps to: 1× identification + 8× weighted.

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

interface Option<V extends string> {
  value: V
  label: string
  points: number
}

interface QuestionDef<K extends keyof OwnerAnswers, V extends string> {
  key: K
  label: string
  prompt: string
  maxPoints: number
  options: Option<V>[]
}

export const STAGE_Q: QuestionDef<'stage', StageOption> = {
  key: 'stage',
  label: 'Business stage',
  prompt: 'Which stage best describes your company today?',
  maxPoints: 40,
  options: [
    { value: 'struggle', label: 'Struggling — survival mode', points: 0 },
    { value: 'startup', label: 'Startup — under 2 years', points: 10 },
    { value: 'scaling', label: 'Scaling — growing rapidly', points: 25 },
    { value: 'stable', label: 'Stable — established and profitable', points: 40 },
  ],
}

export const SIZE_Q: QuestionDef<'size', SizeOption> = {
  key: 'size',
  label: 'Entity size',
  prompt: 'How large is the team?',
  maxPoints: 15,
  options: [
    { value: 'micro', label: 'Micro — 1–9', points: 0 },
    { value: 'small', label: 'Small — 10–49', points: 5 },
    { value: 'medium', label: 'Medium — 50–249', points: 10 },
    { value: 'large', label: 'Large — 250+', points: 15 },
  ],
}

export const DEPENDENCY_Q: QuestionDef<'ownerDependency', DependencyOption> = {
  key: 'ownerDependency',
  label: 'Owner dependency',
  prompt: 'How much does the company depend on you personally?',
  maxPoints: 15,
  options: [
    { value: 'total', label: 'Total — nothing happens without me', points: 0 },
    { value: 'high', label: 'High — major decisions only', points: 5 },
    { value: 'low', label: 'Low — runs without me for weeks', points: 15 },
  ],
}

export const FINANCIAL_TRACKING_Q: QuestionDef<'financialTracking', FinancialTrackingOption> = {
  key: 'financialTracking',
  label: 'Financial tracking',
  prompt: 'How do you track financials?',
  maxPoints: 20,
  options: [
    { value: 'none', label: 'No tracking', points: 0 },
    { value: 'manual', label: 'Manual / spreadsheets', points: 7 },
    { value: 'good', label: 'Accounting system, monthly closes', points: 14 },
    { value: 'perfect', label: 'Real-time dashboards + audited statements', points: 20 },
  ],
}

export const LIQUIDITY_Q: QuestionDef<'liquidity', LiquidityOption> = {
  key: 'liquidity',
  label: 'Liquidity status',
  prompt: 'How healthy is the cash runway?',
  maxPoints: 40,
  options: [
    { value: 'critical', label: 'Critical — under 1 month', points: 0 },
    { value: 'low', label: 'Low — 1–3 months', points: 13 },
    { value: 'mid', label: 'Mid — 3–6 months', points: 26 },
    { value: 'high', label: 'High — 6+ months', points: 40 },
  ],
}

export const GOVERNANCE_Q: QuestionDef<'governance', GovernanceOption> = {
  key: 'governance',
  label: 'Governance level',
  prompt: 'How is decision-making governed?',
  maxPoints: 30,
  options: [
    { value: 'none', label: 'No formal governance', points: 0 },
    { value: 'partial', label: 'Partial — some written processes', points: 10 },
    { value: 'system', label: 'Established system + delegations', points: 20 },
    { value: 'board', label: 'Active board + formal committees', points: 30 },
  ],
}

export const SCALABILITY_Q: QuestionDef<'scalability', ScalabilityOption> = {
  key: 'scalability',
  label: 'Scalability',
  prompt: 'How easily can the business grow without breaking?',
  maxPoints: 10,
  options: [
    { value: 'none', label: 'Not scalable today', points: 0 },
    { value: 'mid', label: 'Some scalability with effort', points: 5 },
    { value: 'easy', label: 'Easily scalable — systems in place', points: 10 },
  ],
}

export const EXIT_Q: QuestionDef<'exitStrategy', ExitOption> = {
  key: 'exitStrategy',
  label: 'Exit strategy',
  prompt: 'What is the long-term exit plan?',
  maxPoints: 10,
  options: [
    { value: 'none', label: 'No exit plan yet', points: 0 },
    { value: 'family', label: 'Pass to family', points: 5 },
    { value: 'mna', label: 'Acquisition (M&A)', points: 8 },
    { value: 'ipo', label: 'IPO / public listing', points: 10 },
  ],
}

export const WEIGHTED_QUESTIONS = [
  STAGE_Q,
  SIZE_Q,
  DEPENDENCY_Q,
  FINANCIAL_TRACKING_Q,
  LIQUIDITY_Q,
  GOVERNANCE_Q,
  SCALABILITY_Q,
  EXIT_Q,
] as const

export const TOTAL_MAX_POINTS = WEIGHTED_QUESTIONS.reduce(
  (sum, q) => sum + q.maxPoints,
  0
)

export type DiagnosticQuestion = (typeof WEIGHTED_QUESTIONS)[number]
