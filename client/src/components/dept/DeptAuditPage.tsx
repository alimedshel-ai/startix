import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DeptAuditWizard } from '@/components/dept/DeptAuditWizard'
import {
  DEPT_ICON,
  DEPT_LABEL,
  createDepartment,
  getMyFirstCompany,
  submitDeptSmart,
  type Company,
  type DeptCode,
} from '@/lib/deptApi'

interface Props {
  deptCode: DeptCode
  variant?: 'basic' | 'pro'
  /** Optional extra content rendered after the wizard finishes (e.g. dept-specific tool). */
  afterResult?: (deptId: string) => React.ReactNode
}

export function DeptAuditPage({ deptCode, variant = 'basic', afterResult }: Props) {
  const [company, setCompany] = useState<Company | null>(null)
  const [deptId, setDeptId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestingSmart, setRequestingSmart] = useState(false)
  const [score, setScore] = useState<unknown>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setError(null)
    setDeptId(null)
    ;(async () => {
      try {
        const { company } = await getMyFirstCompany()
        if (cancel) return
        if (!company) {
          setError('No company linked yet. Complete the manager diagnostic first.')
          setLoading(false)
          return
        }
        setCompany(company)
        const dept = await createDepartment({ companyId: company.id, type: deptCode })
        if (cancel) return
        setDeptId(dept.id)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not load department'
        setError(msg)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [deptCode])

  async function requestSmart() {
    if (!deptId) return
    setRequestingSmart(true)
    try {
      const { recommendations } = await submitDeptSmart(deptId)
      toast.success(`${recommendations.kpis.length} KPI targets generated`)
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not generate KPIs'
      toast.error(msg)
    } finally {
      setRequestingSmart(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${DEPT_ICON[deptCode]} ${DEPT_LABEL[deptCode]} audit${variant === 'pro' ? ' (Pro)' : ''}`}
        description={`4-axis maturity assessment for ${company?.name ?? 'your company'}.`}
        breadcrumbs={[
          { label: 'Departments', to: '/manager/select-dept' },
          { label: DEPT_LABEL[deptCode] },
        ]}
        actions={
          score && deptId ? (
            <Button variant="outline" onClick={requestSmart} disabled={requestingSmart}>
              {requestingSmart ? 'Generating…' : 'Generate KPI targets'}
            </Button>
          ) : null
        }
      />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>Loading…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Cannot start audit</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild={false} onClick={() => (window.location.href = '/manager/diagnostic')}>
              Run manager diagnostic
            </Button>
          </CardContent>
        </Card>
      )}

      {deptId && !error && (
        <>
          <DeptAuditWizard
            deptId={deptId}
            deptCode={deptCode}
            variant={variant}
            onComplete={(s) => setScore(s)}
          />
          {score && afterResult ? afterResult(deptId) : null}
        </>
      )}
    </div>
  )
}
