import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getLatestCompliance,
  getMyFirstCompany,
} from '@/lib/deptApi'

interface PlanRow {
  week: number
  axis: string
  action: string
  owner: string
}

export function ComplianceReformPage() {
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<PlanRow[] | null>(null)
  const [penalty, setPenalty] = useState<number | null>(null)

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
        const { audit } = await getLatestCompliance(company.id)
        if (cancel) return
        if (!audit) {
          setLoading(false)
          return
        }
        // Pro audits store the reform plan; basic audits don't.
        const reform = (audit.reformPlan as PlanRow[] | null) ?? null
        setPlan(reform)
        setPenalty(audit.penaltyEstimate ?? null)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not load reform plan'
        toast.error(msg)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Compliance reform plan"
        description="12-week action plan auto-generated from the lowest-scoring compliance axes."
        breadcrumbs={[
          { label: 'Departments', to: '/manager/select-dept' },
          { label: 'Compliance', to: '/manager/compliance/audit' },
          { label: 'Reform' },
        ]}
        actions={
          <Link to="/manager/compliance/audit-pro" className={buttonVariants({ variant: 'outline' })}>
            Re-take Pro audit
          </Link>
        }
      />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>Loading reform plan…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {!loading && !plan && (
        <Card>
          <CardHeader>
            <CardTitle>No reform plan available</CardTitle>
            <CardDescription>Run the Pro compliance audit first — the reform plan is generated from it.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/manager/compliance/audit-pro" className={buttonVariants()}>
              Run Pro audit
            </Link>
          </CardContent>
        </Card>
      )}

      {plan && plan.length > 0 && (
        <>
          {penalty != null && (
            <Card>
              <CardHeader>
                <CardTitle>Estimated penalty exposure</CardTitle>
                <CardDescription>The reform plan below targets the axes driving this exposure.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-red-700">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(penalty)}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>12-week schedule</CardTitle>
              <CardDescription>{plan.length} actions. Owners are department leads — adjust to your team.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {plan.map((row) => (
                  <li key={`${row.week}-${row.action}`} className="grid grid-cols-[70px_140px_1fr] items-start gap-3 border-b pb-2">
                    <span className="font-semibold">Week {row.week}</span>
                    <span className="text-muted-foreground text-xs uppercase">{row.axis}</span>
                    <span>
                      {row.action}
                      <span className="ml-2 text-xs text-muted-foreground">({row.owner})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
