import type { UserType } from '@/types/user'

export interface NavItem {
  to: string
  label: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

const ownerNav: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/ceo-dashboard', label: 'CEO dashboard' },
      { to: '/live-board', label: 'Live board' },
      { to: '/analytics-dashboard', label: 'Analytics' },
      { to: '/activity-feed', label: 'Activity feed' },
    ],
  },
  {
    title: 'Companies',
    items: [
      { to: '/companies', label: 'Companies' },
      { to: '/companies/add', label: 'Add company' },
    ],
  },
  {
    title: 'Diagnostic',
    items: [
      { to: '/diagnostic/owner', label: 'Owner diagnostic' },
      { to: '/diagnostic/result', label: 'Diagnostic result' },
      { to: '/company-health', label: 'Company health' },
    ],
  },
  {
    title: 'Strategic analysis',
    items: [
      { to: '/pestel', label: 'PESTEL' },
      { to: '/porter', label: 'Porter Five Forces' },
      { to: '/benchmarking', label: 'Benchmarking' },
      { to: '/stakeholders', label: 'Stakeholders' },
      { to: '/org-dna', label: 'Org DNA' },
    ],
  },
  {
    title: 'Strategy',
    items: [
      { to: '/swot', label: 'SWOT' },
      { to: '/tows', label: 'TOWS' },
      { to: '/gap-analysis', label: 'Gap analysis' },
      { to: '/risk-map', label: 'Risk map' },
    ],
  },
  {
    title: 'Direction',
    items: [
      { to: '/directions', label: 'Strategic directions' },
      { to: '/scenarios', label: 'Scenarios' },
      { to: '/choices', label: 'Choices' },
      { to: '/priority-matrix', label: 'Priority matrix' },
    ],
  },
  {
    title: 'Execution',
    items: [
      { to: '/objectives', label: 'Objectives' },
      { to: '/okrs', label: 'OKRs' },
      { to: '/kpis', label: 'KPIs' },
      { to: '/kpi-entries', label: 'KPI entries' },
      { to: '/initiatives', label: 'Initiatives' },
      { to: '/projects', label: 'Projects' },
      { to: '/gantt-chart', label: 'Gantt chart' },
      { to: '/tasks', label: 'Tasks' },
    ],
  },
  {
    title: 'Reviews & reports',
    items: [
      { to: '/strategic-calendar', label: 'Strategic calendar' },
      { to: '/reviews', label: 'Reviews' },
      { to: '/reports', label: 'Reports' },
    ],
  },
  {
    title: 'AI',
    items: [{ to: '/ai-center', label: 'AI center' }],
  },
]

const managerNav: NavSection[] = [
  {
    title: 'Diagnostic',
    items: [{ to: '/manager/diagnostic', label: 'Manager diagnostic' }],
  },
  {
    title: 'Department',
    items: [
      { to: '/manager/select-dept', label: 'Select department' },
      { to: '/manager/dept-dashboard', label: 'Department dashboard' },
      { to: '/manager/pro-dashboard', label: 'Pro dashboard' },
      { to: '/manager/dept-questionnaire', label: 'Questionnaire' },
      { to: '/manager/dept-deep', label: 'Deep dive' },
      { to: '/manager/dept-smart', label: 'SMART analysis' },
    ],
  },
  {
    title: 'Department audits',
    items: [
      { to: '/manager/hr/audit', label: 'HR' },
      { to: '/manager/finance/audit', label: 'Finance' },
      { to: '/manager/finance/break-even', label: 'Finance — break-even' },
      { to: '/manager/sales/audit', label: 'Sales' },
      { to: '/manager/marketing/audit', label: 'Marketing' },
      { to: '/manager/operations/audit', label: 'Operations' },
      { to: '/manager/it/audit', label: 'IT' },
      { to: '/manager/cs/audit', label: 'Customer service' },
      { to: '/manager/logistics/audit', label: 'Logistics' },
      { to: '/manager/logistics/reform', label: 'Logistics reform' },
      { to: '/manager/quality/audit', label: 'Quality' },
      { to: '/manager/projects/audit', label: 'Projects' },
      { to: '/manager/governance/audit', label: 'Governance' },
      { to: '/manager/governance/hub', label: 'Governance hub' },
    ],
  },
  {
    title: 'Compliance',
    items: [
      { to: '/manager/compliance/audit', label: 'Compliance — basic' },
      { to: '/manager/compliance/audit-pro', label: 'Compliance — pro' },
      { to: '/manager/compliance/reform', label: 'Compliance reform plan' },
    ],
  },
]

const investorNav: NavSection[] = [
  {
    title: 'Diagnostic',
    items: [{ to: '/investor/diagnostic', label: 'Investor diagnostic' }],
  },
  {
    title: 'Portfolio',
    items: [
      { to: '/investor/dashboard', label: 'Investor dashboard' },
      { to: '/investor/portfolio', label: 'Portfolio' },
    ],
  },
]

export function navFor(userType: UserType | null | undefined): NavSection[] {
  if (userType === 'OWNER') return ownerNav
  if (userType === 'MANAGER') return managerNav
  if (userType === 'INVESTOR') return investorNav
  return []
}

export function homeFor(userType: UserType | null | undefined): string {
  if (userType === 'MANAGER') return '/manager/dept-dashboard'
  if (userType === 'INVESTOR') return '/investor/dashboard'
  return '/dashboard'
}
