import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { deleteCompanyById, listMyCompanies, type CompanyWithRole } from '@/lib/deptApi'

export function CompaniesListPage() {
  const [companies, setCompanies] = useState<CompanyWithRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listMyCompanies()
      .then(setCompanies)
      .catch((err) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not load companies'
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }, [])

  async function remove(id: string) {
    if (!confirm('Delete this company? All its data will be lost.')) return
    try {
      await deleteCompanyById(id)
      setCompanies((prev) => prev.filter((c) => c.id !== id))
      toast.success('Company deleted')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Delete failed')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Companies"
        description="All companies you operate or advise."
        actions={
          <Link to="/companies/add" className={buttonVariants()}>
            + Add company
          </Link>
        }
      />

      {loading && (
        <Card>
          <CardHeader><CardTitle>Loading…</CardTitle></CardHeader>
        </Card>
      )}

      {!loading && companies.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No companies yet</CardTitle>
            <CardDescription>Create your first company to start the diagnostic and audits.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/companies/add" className={buttonVariants()}>Add company</Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-base">{c.name}</CardTitle>
              <CardDescription>
                {c.sector ?? '—'} · {c.size}{c.stage ? ` · ${c.stage}` : ''} · {c.country}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm">
              <span className="text-xs uppercase text-muted-foreground">{c.role}</span>
              <Button variant="ghost" size="sm" onClick={() => remove(c.id)}>Delete</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
