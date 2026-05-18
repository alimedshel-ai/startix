import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'

export function ProDashboardPage() {
  const plan = useAuthStore((s) => s.user?.plan ?? 'BASIC')
  const proAllowed = plan === 'PROFESSIONAL' || plan === 'ENTERPRISE'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pro dashboard"
        description="Deeper modules — audit-pro, sector-contextual compliance, Saudi penalty exposure."
      />

      {!proAllowed && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade required</CardTitle>
            <CardDescription>Pro modules require a Professional plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/pricing" className={buttonVariants()}>See pricing</Link>
          </CardContent>
        </Card>
      )}

      {proAllowed && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ProCard title="HR — Pro audit" to="/manager/hr/audit" description="Succession, leadership pipeline, people analytics." />
          <ProCard title="Sales — Pro audit" to="/manager/sales/audit" description="Segmentation, margin, predictive lead scoring." />
          <ProCard title="Marketing — Pro audit" to="/manager/marketing/audit" description="Product marketing, MQL→SQL, CDP." />
          <ProCard title="Compliance — Pro audit" to="/manager/compliance/audit-pro" description="64 mandatory elements + sector axes + KO licenses." />
          <ProCard title="Compliance reform plan" to="/manager/compliance/reform" description="12-week corrective schedule." />
          <ProCard title="Governance hub" to="/manager/governance/hub" description="Risk matrix + governance health." />
        </div>
      )}
    </div>
  )
}

function ProCard({ title, description, to }: { title: string; description: string; to: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link to={to} className={buttonVariants({ variant: 'outline' })}>Open →</Link>
      </CardContent>
    </Card>
  )
}
