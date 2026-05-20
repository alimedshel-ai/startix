import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { listDepartments, listMyCompanies, type CompanyWithRole, type Department } from '@/lib/deptApi'

interface CompanyHealth {
  company: CompanyWithRole
  audited: number
  total: number
  avgScore: number
  redFlags: number
}

function classifyCompany(c: CompanyWithRole, depts: Department[]): CompanyHealth {
  const audited = depts.filter((d) => d.auditScore != null)
  const total = depts.length
  const avgScore = audited.length === 0 ? 0 : audited.reduce((s, d) => s + (d.auditScore ?? 0), 0) / audited.length
  const redFlags = audited.filter((d) => (d.auditData?.dangerZone === 'RED' || d.auditData?.dangerZone === 'ORANGE')).length
  return { company: c, audited: audited.length, total, avgScore, redFlags }
}

function healthTint(score: number): string {
  if (score >= 75) return 'border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-transparent'
  if (score >= 50) return 'border-sky-200 bg-gradient-to-br from-sky-500/10 to-transparent'
  if (score >= 25) return 'border-amber-200 bg-gradient-to-br from-amber-500/10 to-transparent'
  return 'border-rose-200 bg-gradient-to-br from-rose-500/10 to-transparent'
}

export function InvestorDashboardPage() {
  const [companies, setCompanies] = useState<CompanyWithRole[]>([])
  const [perCompany, setPerCompany] = useState<Record<string, Department[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    listMyCompanies().then(async (co) => {
      if (cancel) return
      setCompanies(co)
      // Fetch dept lists in parallel
      const depts = await Promise.all(co.map((c) => listDepartments(c.id).catch(() => [] as Department[])))
      if (cancel) return
      const map: Record<string, Department[]> = {}
      co.forEach((c, i) => { map[c.id] = depts[i] })
      setPerCompany(map)
    }).catch(() => undefined).finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [])

  const healthList: CompanyHealth[] = useMemo(
    () => companies.map((c) => classifyCompany(c, perCompany[c.id] ?? [])),
    [companies, perCompany],
  )

  const portfolioAvg = healthList.length === 0 ? 0 : Math.round(healthList.reduce((s, h) => s + h.avgScore, 0) / healthList.length)
  const totalRedFlags = healthList.reduce((s, h) => s + h.redFlags, 0)
  const totalAudited = healthList.reduce((s, h) => s + h.audited, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="لوحة المستثمر"
        description="نظرة عامة على المحفظة، صحة كل شركة، والإنذارات الحمراء."
      />

      {loading && <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>}

      {!loading && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="شركات المحفظة" value={String(companies.length)} accent="emerald" />
            <Stat label="متوسط الصحة" value={`${portfolioAvg}%`} accent="sky" />
            <Stat label="إدارات مدققة" value={String(totalAudited)} accent="violet" />
            <Stat label="إنذارات حمراء" value={String(totalRedFlags)} accent="rose" sub="مناطق RED/ORANGE" />
          </div>

          {companies.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                <p>لا توجد شركات في محفظتك بعد.</p>
                <p className="mt-1 text-xs">شغّل تشخيص المستثمر أو أضف شركة من إدارة الشركات.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>شركات المحفظة</CardTitle>
                <CardDescription>اضغط شركة لرؤية تفاصيلها.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {healthList.map((h) => (
                    <Link
                      key={h.company.id}
                      to={`/investor/company/${h.company.id}`}
                      className={`rounded-xl border p-3 text-right transition hover:-translate-y-0.5 hover:shadow-md ${healthTint(h.avgScore)}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{h.company.name}</span>
                        {h.redFlags > 0 && (
                          <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                            {h.redFlags} 🚨
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {h.company.sector ?? '—'} · {h.company.size}
                      </div>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tabular-nums">{Math.round(h.avgScore)}%</span>
                        <span className="text-[10px] text-muted-foreground">
                          {h.audited}/{h.total || 13} مدققة
                        </span>
                      </div>
                      <Progress value={h.avgScore} className="mt-1 h-1.5" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {totalRedFlags > 0 && (
            <Card className="border-rose-200 bg-rose-50/60">
              <CardHeader>
                <CardTitle>تحذيرات تحتاج مراجعة</CardTitle>
                <CardDescription>
                  {totalRedFlags} إدارة في منطقة حمراء/برتقالية عبر محفظتك.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {healthList.filter((h) => h.redFlags > 0).map((h) => (
                    <li key={h.company.id} className="rounded-lg border bg-card p-3">
                      <div className="flex items-center justify-between">
                        <Link to={`/investor/company/${h.company.id}`} className="font-medium text-rose-700 hover:underline">
                          {h.company.name}
                        </Link>
                        <span className="tabular-nums text-xs text-muted-foreground">{h.redFlags} إدارة</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Link to="/investor/portfolio" className={buttonVariants({ variant: 'outline' })}>
              عرض المحفظة الكاملة ←
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, accent, sub }: { label: string; value: string; accent: 'emerald' | 'sky' | 'violet' | 'rose'; sub?: string }) {
  const palette: Record<typeof accent, string> = {
    emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-transparent text-emerald-700',
    sky:     'border-sky-200 bg-gradient-to-br from-sky-500/10 to-transparent text-sky-700',
    violet:  'border-violet-200 bg-gradient-to-br from-violet-500/10 to-transparent text-violet-700',
    rose:    'border-rose-200 bg-gradient-to-br from-rose-500/10 to-transparent text-rose-700',
  }
  return (
    <Card className={palette[accent]}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  )
}
