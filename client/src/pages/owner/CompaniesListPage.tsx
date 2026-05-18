import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { deleteCompanyById, listMyCompanies, type CompanyWithRole } from '@/lib/deptApi'

const SIZE_LABEL: Record<string, string> = {
  MICRO: 'متناهية الصغر',
  SMALL: 'صغيرة',
  MEDIUM: 'متوسطة',
  LARGE: 'كبيرة',
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'مالك',
  manager: 'مدير',
  member: 'عضو',
}

export function CompaniesListPage() {
  const [companies, setCompanies] = useState<CompanyWithRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listMyCompanies()
      .then(setCompanies)
      .catch((err) => {
        toast.error(apiErrorMessage(err, 'تعذّر تحميل الشركات'))
      })
      .finally(() => setLoading(false))
  }, [])

  async function remove(id: string) {
    if (!confirm('حذف هذه الشركة؟ سيتم فقدان جميع بياناتها.')) return
    try {
      await deleteCompanyById(id)
      setCompanies((prev) => prev.filter((c) => c.id !== id))
      toast.success('تم حذف الشركة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الحذف'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الشركات"
        description="جميع الشركات التي تديرها أو تستشير فيها."
        actions={
          <Link to="/companies/add" className={buttonVariants()}>
            + إضافة شركة
          </Link>
        }
      />

      {loading && (
        <Card>
          <CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader>
        </Card>
      )}

      {!loading && companies.length === 0 && (
        <Card className="overflow-hidden border-dashed">
          <div className="h-1.5 bg-gradient-to-l from-indigo-500 via-sky-500 to-teal-500" />
          <CardHeader>
            <CardTitle>لا توجد شركات بعد</CardTitle>
            <CardDescription>أنشئ أول شركة لبدء التشخيص والتدقيقات.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/companies/add" className={buttonVariants()}>إضافة شركة</Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <Card key={c.id} className="transition hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">{c.name}</CardTitle>
              <CardDescription>
                {c.sector ?? '—'} · {SIZE_LABEL[c.size] ?? c.size}{c.stage ? ` · ${c.stage}` : ''} · {c.country}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center rounded-md border bg-primary/5 px-2 py-0.5 text-xs text-primary">
                {ROLE_LABEL[c.role] ?? c.role}
              </span>
              <Button variant="ghost" size="sm" onClick={() => remove(c.id)}>حذف</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
