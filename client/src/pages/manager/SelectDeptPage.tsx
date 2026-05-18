import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { DEPT_ICON, DEPT_LABEL, type DeptCode } from '@/lib/deptApi'

interface DeptLink {
  code: DeptCode
  audit: string
  extras?: { label: string; to: string }[]
}

const DEPTS: DeptLink[] = [
  { code: 'HR',                audit: '/manager/hr/audit' },
  { code: 'FINANCE',           audit: '/manager/finance/audit',         extras: [{ label: 'Break-even calculator', to: '/manager/finance/break-even' }] },
  { code: 'SALES',             audit: '/manager/sales/audit' },
  { code: 'MARKETING',         audit: '/manager/marketing/audit' },
  { code: 'OPERATIONS',        audit: '/manager/operations/audit' },
  { code: 'IT',                audit: '/manager/it/audit' },
  { code: 'CUSTOMER_SERVICE',  audit: '/manager/cs/audit' },
  { code: 'SUPPORT',           audit: '/manager/cs/audit' }, // shares the customer-service module per plan
  { code: 'LOGISTICS',         audit: '/manager/logistics/audit',       extras: [{ label: 'Reform plan', to: '/manager/logistics/reform' }] },
  { code: 'QUALITY',           audit: '/manager/quality/audit' },
  { code: 'PROJECTS',          audit: '/manager/projects/audit',        extras: [{ label: 'Gantt chart', to: '/gantt-chart' }] },
  { code: 'GOVERNANCE',        audit: '/manager/governance/audit',      extras: [{ label: 'Governance hub', to: '/manager/governance/hub' }] },
  { code: 'COMPLIANCE',        audit: '/manager/compliance/audit',      extras: [
    { label: 'Pro audit', to: '/manager/compliance/audit-pro' },
    { label: 'Reform plan', to: '/manager/compliance/reform' },
  ] },
]

export function SelectDeptPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Departments"
        description="Pick a department to start its audit. Compliance is the deepest module — see plan §5.3."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEPTS.map((d) => (
          <Card key={`${d.code}-${d.audit}`} className="transition hover:shadow-md">
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-2xl" aria-hidden>{DEPT_ICON[d.code]}</span>
                <h3 className="text-base font-semibold">{DEPT_LABEL[d.code]}</h3>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Link to={d.audit} className="rounded border px-2 py-1 hover:bg-accent">Audit →</Link>
                {(d.extras ?? []).map((x) => (
                  <Link key={x.to} to={x.to} className="rounded border px-2 py-1 hover:bg-accent">
                    {x.label} →
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
