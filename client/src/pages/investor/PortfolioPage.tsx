import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { PathBadge } from '@/components/PathBadge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, apiErrorMessage } from '@/lib/api'
import { listMyCompanies, type CompanyWithRole } from '@/lib/deptApi'
import type { OwnerDiagnosticResult, StrategicPath } from '@/lib/diagnosticQuestions'

const SIZE_LABEL: Record<CompanyWithRole['size'], string> = {
  MICRO: 'متناهية الصغر',
  SMALL: 'صغيرة',
  MEDIUM: 'متوسطة',
  LARGE: 'كبيرة',
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'مالك',
  manager: 'مدير',
  investor: 'مستثمر',
  member: 'عضو',
}

interface PortfolioEntry extends CompanyWithRole {
  strategicPath: StrategicPath | null
}

export function PortfolioPage() {
  return (
    <ErrorBoundary>
      <PortfolioContent />
    </ErrorBoundary>
  )
}

function PortfolioContent() {
  const [entries, setEntries] = useState<PortfolioEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const companies = await listMyCompanies()
        // نطلب آخر تشخيص لكل شركة بالتوازي. غياب التشخيص = 404 نتعامل معه
        // برفق (null) بدل رمي الخطأ للأعلى.
        const results = await Promise.all(
          companies.map(async (c) => {
            try {
              const { data } = await api.get<{ result: OwnerDiagnosticResult | null }>(
                `/api/diagnostic/${c.id}/latest`
              )
              return { ...c, strategicPath: data.result?.strategicPath ?? null }
            } catch {
              return { ...c, strategicPath: null }
            }
          })
        )
        if (!cancel) setEntries(results)
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل المحفظة'))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="المحفظة" description="شركات محفظتك مع مقاييس صحّتها الاستراتيجية." />
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="جاري تحميل المحفظة…" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="المحفظة"
        description={
          entries.length === 0
            ? 'شركات محفظتك مع مقاييس صحّتها الاستراتيجية.'
            : `${entries.length} شركة في محفظتك.`
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          title="محفظتك فارغة"
          description="لم يتم ربطك بأي شركة بعد. سيظهر شركاؤك ومحفظتك هنا فور ربطك بشركة."
          icon={<span className="text-4xl">💼</span>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e) => (
            <Link
              key={e.id}
              to={`/investor/company/${e.id}`}
              className="block transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{e.name}</CardTitle>
                    <span className="inline-flex items-center rounded-md border bg-primary/5 px-2 py-0.5 text-xs text-primary">
                      {ROLE_LABEL[e.role] ?? e.role}
                    </span>
                  </div>
                  <CardDescription>
                    {e.sector ?? '—'} · {SIZE_LABEL[e.size]}
                    {e.stage ? ` · ${e.stage}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {e.strategicPath ? (
                    <PathBadge path={e.strategicPath} />
                  ) : (
                    <span className="inline-flex items-center rounded-full border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                      لم يُجرَ تشخيص بعد
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
