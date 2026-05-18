import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  DEPT_ICON,
  DEPT_LABEL,
  dangerZoneColor,
  getMyFirstCompany,
  listDepartments,
  type Department,
} from '@/lib/deptApi'

export function DeptDashboardPage() {
  const [departments, setDepartments] = useState<Department[]>([])
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
        const list = await listDepartments(company.id)
        if (cancel) return
        setDepartments(list)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not load departments'
        toast.error(msg)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const average = departments.length === 0
    ? 0
    : Math.round(departments.reduce((s, d) => s + (d.auditScore ?? 0), 0) / departments.length)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Department dashboard"
        description="Audited departments across this company — health, danger zones and quick links."
        actions={
          <Link to="/manager/select-dept" className={buttonVariants({ variant: 'outline' })}>
            Add / audit department
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Overall health</CardTitle>
          <CardDescription>{departments.length} audited departments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-3xl font-semibold">{average}%</div>
          <Progress value={average} />
        </CardContent>
      </Card>

      {loading && <Card><CardHeader><CardTitle>Loading…</CardTitle></CardHeader></Card>}

      {!loading && departments.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No departments yet</CardTitle>
            <CardDescription>Pick a department and run its audit.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/manager/select-dept" className={buttonVariants()}>Select department</Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => {
          const zone = d.auditData?.dangerZone ?? 'GREEN'
          const score = d.auditData?.healthPct ?? d.auditScore ?? 0
          return (
            <Card key={d.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span aria-hidden>{DEPT_ICON[d.type]}</span>
                  {DEPT_LABEL[d.type]}
                </CardTitle>
                <CardDescription>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${dangerZoneColor(zone)}`}>{zone}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold">{Math.round(score)}%</div>
                <Progress value={score} />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
