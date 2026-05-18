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
  governance: 'الحوكمة',
  financial: 'الضوابط المالية',
  team: 'مجلس الإدارة / المديرون',
  digital: 'الأدلة الرقمية',
}

const TOP_RISK: Record<string, string> = {
  governance: 'لا يوجد مجلس رسمي / قرارات ارتجالية',
  financial: 'فجوات في التدقيق / الضوابط',
  team: 'مديرون عديمو الخبرة',
  digital: 'لا توجد بوابة آمنة لمجلس الإدارة',
}

const ZONE_LABEL: Record<string, string> = {
  GREEN: 'آمنة',
  YELLOW: 'تحذير',
  ORANGE: 'خطر',
  RED: 'حرجة',
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
          toast.error('أكمل تشخيص المدير أولاً')
          setLoading(false)
          return
        }
        const dept = await createDepartment({ companyId: company.id, type: 'GOVERNANCE' })
        const { audit } = await getLatestDeptAudit(dept.id)
        if (cancel) return
        if (audit) setScore(audit.scores)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر تحميل بيانات الحوكمة'
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
        title="مركز الحوكمة"
        description="الصحة والمخاطر والإجراءات الموصى بها عبر قسم الحوكمة."
        breadcrumbs={[
          { label: 'الأقسام', to: '/manager/select-dept' },
          { label: 'الحوكمة', to: '/manager/governance/audit' },
          { label: 'المركز' },
        ]}
        actions={
          <Link to="/manager/governance/audit" className={buttonVariants({ variant: 'outline' })}>
            إعادة التدقيق
          </Link>
        }
      />

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>جاري التحميل…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {!loading && !score && (
        <Card className="bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-200">
          <CardHeader>
            <CardTitle>لم يتم العثور على تدقيق</CardTitle>
            <CardDescription>نفّذ تدقيق الحوكمة أولاً لتعبئة المركز.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {score && (
        <>
          <Card className="overflow-hidden bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-200">
            <div className="h-1.5 bg-gradient-to-l from-yellow-500 via-amber-500 to-orange-500" />
            <CardHeader>
              <CardTitle>صحة الحوكمة</CardTitle>
              <CardDescription>النضج الإجمالي من أحدث تدقيق.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl font-semibold tabular-nums">{score.healthPct}%</div>
                <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${dangerZoneColor(score.dangerZone)}`}>{ZONE_LABEL[score.dangerZone] ?? score.dangerZone}</span>
              </div>
              <Progress value={score.healthPct} className="h-2" />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-amber-200">
            <CardHeader>
              <CardTitle>مصفوفة المخاطر</CardTitle>
              <CardDescription>الاحتمالية × الأثر لكل محور.</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-muted-foreground">
                    <th className="py-2">المحور</th>
                    <th className="py-2">الاحتمالية</th>
                    <th className="py-2">الأثر</th>
                    <th className="py-2">الخطورة</th>
                    <th className="py-2">أبرز خطر محدد</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row.axis} className="border-b">
                      <td className="py-2 font-medium">{AXIS_LABEL[row.axis] ?? row.axis}</td>
                      <td className="py-2 tabular-nums">{row.probability}</td>
                      <td className="py-2 tabular-nums">{row.impact}</td>
                      <td className="py-2 font-semibold tabular-nums">{row.risk}</td>
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
