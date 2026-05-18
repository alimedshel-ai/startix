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
        title="لوحة الاحترافي"
        description="وحدات أعمق — تدقيق احترافي، امتثال حسب القطاع، وتقدير الغرامات السعودية."
      />

      {!proAllowed && (
        <Card className="bg-gradient-to-br from-violet-500/10 to-transparent border-violet-200">
          <CardHeader>
            <CardTitle>الترقية مطلوبة</CardTitle>
            <CardDescription>تتطلب الوحدات الاحترافية خطة احترافية.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/pricing" className={buttonVariants()}>عرض الأسعار</Link>
          </CardContent>
        </Card>
      )}

      {proAllowed && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ProCard title="الموارد البشرية — تدقيق احترافي" to="/manager/hr/audit" description="التعاقب الوظيفي، خط القيادة، وتحليلات الموظفين." />
          <ProCard title="المبيعات — تدقيق احترافي" to="/manager/sales/audit" description="التجزئة، الهامش، وتقييم العملاء المحتملين التنبؤي." />
          <ProCard title="التسويق — تدقيق احترافي" to="/manager/marketing/audit" description="تسويق المنتج، تحويل MQL إلى SQL، وCDP." />
          <ProCard title="الامتثال — تدقيق احترافي" to="/manager/compliance/audit-pro" description="64 عنصر إلزامي + محاور حسب القطاع + تراخيص KO." />
          <ProCard title="خطة الإصلاح للامتثال" to="/manager/compliance/reform" description="جدول تصحيحي مدّته 12 أسبوعاً." />
          <ProCard title="مركز الحوكمة" to="/manager/governance/hub" description="مصفوفة المخاطر + صحة الحوكمة." />
        </div>
      )}
    </div>
  )
}

function ProCard({ title, description, to }: { title: string; description: string; to: string }) {
  return (
    <Card className="bg-gradient-to-br from-violet-500/10 to-transparent border-violet-200 transition hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link to={to} className={buttonVariants({ variant: 'outline' })}>فتح ←</Link>
      </CardContent>
    </Card>
  )
}
