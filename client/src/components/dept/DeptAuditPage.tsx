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
          setError('لم تربط شركة بعد. أكمل تشخيص المدير أولاً.')
          setLoading(false)
          return
        }
        setCompany(company)
        const dept = await createDepartment({ companyId: company.id, type: deptCode })
        if (cancel) return
        setDeptId(dept.id)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر تحميل بيانات الإدارة'
        setError(msg)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [deptCode])

  async function requestSmart() {
    if (!deptId) return
    setRequestingSmart(true)
    try {
      const { recommendations } = await submitDeptSmart(deptId)
      toast.success(`تم توليد ${recommendations.kpis.length} مؤشر أداء`)
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر توليد المؤشرات'
      toast.error(msg)
    } finally {
      setRequestingSmart(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${DEPT_ICON[deptCode]} تدقيق ${DEPT_LABEL[deptCode]}${variant === 'pro' ? ' (احترافي)' : ''}`}
        description={`تقييم نضج عبر ٤ محاور لـ${company?.name ?? 'شركتك'}.`}
        breadcrumbs={[
          { label: 'الإدارات', to: '/manager/select-dept' },
          { label: DEPT_LABEL[deptCode] },
        ]}
        actions={
          score && deptId ? (
            <Button variant="outline" onClick={requestSmart} disabled={requestingSmart}>
              {requestingSmart ? 'جاري التوليد…' : 'توليد مؤشرات الأداء'}
            </Button>
          ) : null
        }
      />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>جاري التحميل…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {error && (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader>
            <CardTitle className="text-rose-900">تعذّر بدء التدقيق</CardTitle>
            <CardDescription className="text-rose-700">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => (window.location.href = '/manager/diagnostic')}>
              تشغيل تشخيص المدير
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
