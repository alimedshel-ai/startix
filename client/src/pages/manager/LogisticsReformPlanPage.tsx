import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createDepartment,
  getLatestDeptAudit,
  getMyFirstCompany,
  type AuditScore,
} from '@/lib/deptApi'

interface ReformAction {
  week: number
  area: string
  action: string
  owner: string
}

const ACTIONS_BY_AREA: Record<string, string[]> = {
  governance: [
    'Document inventory policy + cycle counts',
    'Renew carrier contracts and SLAs',
    'Stand up returns / reverse-logistics policy',
  ],
  financial: [
    'Track shipping cost per order weekly',
    'Monitor inventory-carrying cost',
    'Publish OTIF KPI dashboard',
  ],
  team: [
    'Run warehouse-safety refresher',
    'Roll out picker / driver performance reviews',
    'Establish a cross-shift handover ritual',
  ],
  digital: [
    'Deploy or fully roll out the WMS',
    'Implement route optimization',
    'Turn on real-time shipment tracking',
  ],
}

export function LogisticsReformPlanPage() {
  const [score, setScore] = useState<AuditScore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const { company } = await getMyFirstCompany()
        if (!company) {
          toast.error('Complete the manager diagnostic first')
          setLoading(false)
          return
        }
        const dept = await createDepartment({ companyId: company.id, type: 'LOGISTICS' })
        const { audit } = await getLatestDeptAudit(dept.id)
        if (cancel) return
        if (audit) setScore(audit.scores)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not load audit'
        toast.error(msg)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const plan: ReformAction[] = (() => {
    if (!score) return []
    const ordered = [...score.byAxis].sort((a, b) => a.score / a.cap - b.score / b.cap)
    const out: ReformAction[] = []
    let week = 1
    for (const axis of ordered) {
      const actions = ACTIONS_BY_AREA[axis.axis] ?? []
      for (const action of actions) {
        if (week > 12) break
        out.push({ week, area: axis.axis, action, owner: 'Logistics manager' })
        week += 1
      }
      if (week > 12) break
    }
    return out
  })()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Logistics reform plan"
        description="12-week corrective plan generated from the lowest-scoring axes of the logistics audit."
        breadcrumbs={[
          { label: 'Departments', to: '/manager/select-dept' },
          { label: 'Logistics', to: '/manager/logistics/audit' },
          { label: 'Reform plan' },
        ]}
      />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>Loading audit…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {!loading && !score && (
        <Card>
          <CardHeader>
            <CardTitle>No audit found</CardTitle>
            <CardDescription>Run the logistics audit first to generate a reform plan.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {plan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Weekly plan</CardTitle>
            <CardDescription>{plan.length} actions over the next 12 weeks.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {plan.map((p) => (
                <li key={`${p.week}-${p.action}`} className="grid grid-cols-[60px_120px_1fr] items-start gap-3 border-b pb-2">
                  <span className="font-semibold">Week {p.week}</span>
                  <span className="text-muted-foreground uppercase text-xs">{p.area}</span>
                  <span>
                    {p.action}
                    <span className="ml-2 text-xs text-muted-foreground">({p.owner})</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
