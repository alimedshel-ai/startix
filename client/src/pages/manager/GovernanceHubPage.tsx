import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  createDepartment,
  getLatestDeptAudit,
  getMyFirstCompany,
  dangerZoneColor,
  type AuditScore,
} from '@/lib/deptApi'

interface RiskRow {
  axis: string
  probability: number
  impact: number
  risk: number
  topRisk: string
}

const AXIS_LABEL: Record<string, string> = {
  governance: 'Governance',
  financial: 'Financial controls',
  team: 'Board / directors',
  digital: 'Digital evidence',
}

const TOP_RISK: Record<string, string> = {
  governance: 'No formal board / decisions ad-hoc',
  financial: 'Audit / control gaps',
  team: 'Inexperienced directors',
  digital: 'No secure board portal',
}

export function GovernanceHubPage() {
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
        const dept = await createDepartment({ companyId: company.id, type: 'GOVERNANCE' })
        const { audit } = await getLatestDeptAudit(dept.id)
        if (cancel) return
        if (audit) setScore(audit.scores)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not load governance data'
        toast.error(msg)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const matrix: RiskRow[] = (() => {
    if (!score) return []
    return score.byAxis.map((row) => {
      const pct = row.cap === 0 ? 0 : (row.score / row.cap) * 100
      const probability = pct >= 80 ? 1 : pct >= 60 ? 2 : pct >= 40 ? 3 : pct >= 20 ? 4 : 5
      const impact = 4
      return { axis: row.axis, probability, impact, risk: probability * impact, topRisk: TOP_RISK[row.axis] ?? '—' }
    })
  })()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Governance hub"
        description="Health, risks and recommended actions across the governance department."
        breadcrumbs={[
          { label: 'Departments', to: '/manager/select-dept' },
          { label: 'Governance', to: '/manager/governance/audit' },
          { label: 'Hub' },
        ]}
        actions={
          <Link to="/manager/governance/audit" className={buttonVariants({ variant: 'outline' })}>
            Re-take audit
          </Link>
        }
      />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {!loading && !score && (
        <Card>
          <CardHeader>
            <CardTitle>No audit found</CardTitle>
            <CardDescription>Run the governance audit first to populate the hub.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {score && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Governance health</CardTitle>
              <CardDescription>Overall maturity from the most recent audit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl font-semibold">{score.healthPct}%</div>
                <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${dangerZoneColor(score.dangerZone)}`}>{score.dangerZone}</span>
              </div>
              <Progress value={score.healthPct} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk matrix</CardTitle>
              <CardDescription>Probability × impact per axis.</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">Axis</th>
                    <th className="py-2">Probability</th>
                    <th className="py-2">Impact</th>
                    <th className="py-2">Risk</th>
                    <th className="py-2">Top risk identified</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row.axis} className="border-b">
                      <td className="py-2 font-medium">{AXIS_LABEL[row.axis] ?? row.axis}</td>
                      <td className="py-2">{row.probability}</td>
                      <td className="py-2">{row.impact}</td>
                      <td className="py-2 font-semibold">{row.risk}</td>
                      <td className="py-2 text-muted-foreground">{row.topRisk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
