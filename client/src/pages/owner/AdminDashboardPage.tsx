import { useEffect, useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

interface AdminStats {
  users: { total: number; byPlan: Record<string, number>; byType: Record<string, number> }
  companies: { total: number; activeLast30Days: number }
  activity: {
    diagnosticsLast30: number
    auditsLast30: number
    reportsLast30: number
    kpiEntriesLast30: number
  }
  content: { objectives: number; kpis: number }
}

const PLAN_LABEL: Record<string, string> = { BASIC: 'أساسي', PROFESSIONAL: 'احترافي', ENTERPRISE: 'مؤسسي' }
const TYPE_LABEL: Record<string, string> = { OWNER: 'صاحب أعمال', MANAGER: 'مدير', INVESTOR: 'مستثمر' }

export function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<AdminStats>('/api/admin/stats')
      .then((r) => setStats(r.data))
      .catch((err) => setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'تعذّر التحميل'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="لوحة المسؤول"
        description="إحصاءات النظام: المستخدمون، الباقات، الشركات النشطة، ونمط الاستخدام."
      />

      {loading && <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>}
      {error && (
        <Card className="border-rose-200 bg-rose-50/60">
          <CardHeader><CardTitle>تعذّر التحميل</CardTitle><CardDescription>{error}</CardDescription></CardHeader>
        </Card>
      )}

      {stats && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="إجمالي المستخدمين" value={String(stats.users.total)} accent="indigo" />
            <Stat label="إجمالي الشركات" value={String(stats.companies.total)} accent="emerald" />
            <Stat label="شركات نشطة (30 يوم)" value={String(stats.companies.activeLast30Days)} accent="sky" />
            <Stat label="تقارير منشأة (30 يوم)" value={String(stats.activity.reportsLast30)} accent="orange" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-500/10 to-transparent">
              <CardHeader>
                <CardTitle>توزيع الباقات</CardTitle>
                <CardDescription>{stats.users.total} مستخدم</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {['BASIC', 'PROFESSIONAL', 'ENTERPRISE'].map((plan) => {
                    const n = stats.users.byPlan[plan] ?? 0
                    const pct = stats.users.total === 0 ? 0 : Math.round((n / stats.users.total) * 100)
                    return (
                      <li key={plan}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{PLAN_LABEL[plan]}</span>
                          <span className="tabular-nums text-muted-foreground">{n} ({pct}%)</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${plan === 'ENTERPRISE' ? 'bg-violet-500' : plan === 'PROFESSIONAL' ? 'bg-primary' : 'bg-sky-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-transparent">
              <CardHeader>
                <CardTitle>توزيع الأدوار</CardTitle>
                <CardDescription>كل المستخدمين حسب النوع</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {['OWNER', 'MANAGER', 'INVESTOR'].map((t) => {
                    const n = stats.users.byType[t] ?? 0
                    const pct = stats.users.total === 0 ? 0 : Math.round((n / stats.users.total) * 100)
                    return (
                      <li key={t}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{TYPE_LABEL[t]}</span>
                          <span className="tabular-nums text-muted-foreground">{n} ({pct}%)</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${t === 'OWNER' ? 'bg-emerald-500' : t === 'MANAGER' ? 'bg-teal-500' : 'bg-amber-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>نشاط آخر 30 يوماً</CardTitle>
              <CardDescription>مؤشرات استخدام الميزات.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Mini label="تشخيصات جديدة" value={stats.activity.diagnosticsLast30} />
                <Mini label="تدقيقات إدارات" value={stats.activity.auditsLast30} />
                <Mini label="إدخالات مؤشرات" value={stats.activity.kpiEntriesLast30} />
                <Mini label="تقارير صدرت" value={stats.activity.reportsLast30} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>محتوى المنصة</CardTitle>
              <CardDescription>إجماليات تراكمية.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Mini label="أهداف استراتيجية" value={stats.content.objectives} />
                <Mini label="مؤشرات أداء" value={stats.content.kpis} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: 'indigo' | 'emerald' | 'sky' | 'orange' }) {
  const palette: Record<typeof accent, string> = {
    indigo:  'border-indigo-200 bg-gradient-to-br from-indigo-500/10 to-transparent text-indigo-700',
    emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-transparent text-emerald-700',
    sky:     'border-sky-200 bg-gradient-to-br from-sky-500/10 to-transparent text-sky-700',
    orange:  'border-orange-200 bg-gradient-to-br from-orange-500/10 to-transparent text-orange-700',
  }
  return (
    <Card className={palette[accent]}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <div className="text-2xl font-bold tabular-nums">{value.toLocaleString('en-US')}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}
