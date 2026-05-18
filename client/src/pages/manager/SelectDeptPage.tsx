import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { DEPT_ICON, DEPT_LABEL, type DeptCode } from '@/lib/deptApi'

interface DeptLink {
  code: DeptCode
  audit: string
  accent: string
  extras?: { label: string; to: string }[]
}

const DEPTS: DeptLink[] = [
  { code: 'HR',                audit: '/manager/hr/audit',                accent: 'from-rose-500/15 to-rose-500/0 border-rose-200' },
  { code: 'FINANCE',           audit: '/manager/finance/audit',           accent: 'from-amber-500/15 to-amber-500/0 border-amber-200', extras: [{ label: 'حاسبة نقطة التعادل', to: '/manager/finance/break-even' }] },
  { code: 'SALES',             audit: '/manager/sales/audit',             accent: 'from-emerald-500/15 to-emerald-500/0 border-emerald-200' },
  { code: 'MARKETING',         audit: '/manager/marketing/audit',         accent: 'from-fuchsia-500/15 to-fuchsia-500/0 border-fuchsia-200' },
  { code: 'OPERATIONS',        audit: '/manager/operations/audit',        accent: 'from-indigo-500/15 to-indigo-500/0 border-indigo-200' },
  { code: 'IT',                audit: '/manager/it/audit',                accent: 'from-sky-500/15 to-sky-500/0 border-sky-200' },
  { code: 'CUSTOMER_SERVICE',  audit: '/manager/cs/audit',                accent: 'from-teal-500/15 to-teal-500/0 border-teal-200' },
  { code: 'SUPPORT',           audit: '/manager/cs/audit',                accent: 'from-cyan-500/15 to-cyan-500/0 border-cyan-200' },
  { code: 'LOGISTICS',         audit: '/manager/logistics/audit',         accent: 'from-orange-500/15 to-orange-500/0 border-orange-200', extras: [{ label: 'خطة الإصلاح', to: '/manager/logistics/reform' }] },
  { code: 'QUALITY',           audit: '/manager/quality/audit',           accent: 'from-emerald-500/15 to-emerald-500/0 border-emerald-200' },
  { code: 'PROJECTS',          audit: '/manager/projects/audit',          accent: 'from-violet-500/15 to-violet-500/0 border-violet-200', extras: [{ label: 'مخطط جانت', to: '/gantt-chart' }] },
  { code: 'GOVERNANCE',        audit: '/manager/governance/audit',        accent: 'from-yellow-500/15 to-yellow-500/0 border-yellow-200', extras: [{ label: 'مركز الحوكمة', to: '/manager/governance/hub' }] },
  { code: 'COMPLIANCE',        audit: '/manager/compliance/audit',        accent: 'from-rose-500/15 to-rose-500/0 border-rose-200', extras: [
    { label: 'تدقيق احترافي', to: '/manager/compliance/audit-pro' },
    { label: 'خطة الإصلاح', to: '/manager/compliance/reform' },
  ] },
]

export function SelectDeptPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الإدارات"
        description="اختر إدارة لبدء تدقيقها. الامتثال هو الإدارة الأعمق في النظام."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEPTS.map((d) => (
          <Card key={`${d.code}-${d.audit}`} className={`bg-gradient-to-br ${d.accent} transition hover:-translate-y-0.5 hover:shadow-md`}>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-3xl" aria-hidden>{DEPT_ICON[d.code]}</span>
                <h3 className="text-base font-semibold">{DEPT_LABEL[d.code]}</h3>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Link to={d.audit} className="rounded-md border bg-card px-2.5 py-1.5 transition hover:bg-accent">
                  ابدأ التدقيق ←
                </Link>
                {(d.extras ?? []).map((x) => (
                  <Link key={x.to} to={x.to} className="rounded-md border bg-card px-2.5 py-1.5 transition hover:bg-accent">
                    {x.label} ←
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
