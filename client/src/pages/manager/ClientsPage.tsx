import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_ICON, DEPT_LABEL, dangerZoneColor, type DangerZone } from '@/lib/deptApi'
import {
  getProOverview,
  type OverviewClient,
  type PortfolioAlert,
  type PortfolioInsight,
  type PortfolioSeverity,
  type PortfolioSummary,
  type ProOverviewResponse,
} from '@/lib/proApi'
import { useAuthStore } from '@/store/authStore'

// ─── PRO-3 — لوحة "محفظتي" الغنيّة للمدير المستقل ─────────────────────────────
// تستهلك /api/pro/overview (طلب واحد) وتعرض:
//   ١. شريط ٦ مقاييس (عدد، متوسط صحة، RED، staleness، unaudited، last activity)
//   ٢. بطاقات تنبيهات بارزة (تراجع صحة > 15%)
//   ٣. بطاقات رؤى ملوّنة بحسب severity
//   ٤. شبكة كروت العملاء مع ترتيب قابل للتبديل + شارة RED واضحة

type SortKey = 'health' | 'name' | 'lastAudit'

export function ClientsPage() {
  const user = useAuthStore((s) => s.user)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ProOverviewResponse | null>(null)
  const [sort, setSort] = useState<SortKey>('health')

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    getProOverview()
      .then((res) => {
        if (!alive) return
        setData(res)
      })
      .catch((err: unknown) => {
        if (!alive) return
        setError(apiErrorMessage(err, 'تعذّر تحميل لوحة المحفظة'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const isPro = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'

  const sortedClients = useMemo(() => {
    if (!data) return []
    const clients = [...data.clients]
    switch (sort) {
      case 'name':
        return clients.sort((a, b) => a.companyName.localeCompare(b.companyName, 'ar'))
      case 'lastAudit':
        // العملاء بلا تدقيق يأتون آخراً؛ الأحدث أوّلاً.
        return clients.sort((a, b) => {
          if (!a.lastAuditAt && !b.lastAuditAt) return 0
          if (!a.lastAuditAt) return 1
          if (!b.lastAuditAt) return -1
          return new Date(b.lastAuditAt).getTime() - new Date(a.lastAuditAt).getTime()
        })
      case 'health':
      default:
        // الأقل صحة أوّلاً — يحتاج انتباهك أوّلاً.
        return clients.sort((a, b) => {
          if (a.healthPct == null && b.healthPct == null) return 0
          if (a.healthPct == null) return -1
          if (b.healthPct == null) return 1
          return a.healthPct - b.healthPct
        })
    }
  }, [data, sort])

  if (!isPro) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="عملائي" description="مسار مخصّص للمدير المستقل." />
        <EmptyState
          title="هذه الشاشة للمدير المستقل"
          description="خصّص حسابك كمدير مستقل واختر تخصّصاً واحداً لعرض قائمة عملائك هنا."
        />
      </div>
    )
  }

  if (loading) return <LoadingSpinner fullPage label="جاري تحميل محفظتك…" />

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="عملائي" />
        <EmptyState title="حدث خطأ" description={error} />
      </div>
    )
  }

  if (!data) return null

  const { specialty, summary, insights, alerts } = data
  const specialtyLabel = DEPT_LABEL[specialty]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="عملائي"
        description={`تشرف على إدارة ${specialtyLabel} عبر ${summary.total} عميلاً.`}
      />

      <SummaryStrip summary={summary} specialtyLabel={specialtyLabel} />

      {alerts.length > 0 && (
        <div className="grid gap-2">
          {alerts.map((a) => (
            <AlertCard key={a.companyId} alert={a} />
          ))}
        </div>
      )}

      {insights.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {insights.map((i) => (
            <InsightCard key={i.code} insight={i} />
          ))}
        </div>
      )}

      {summary.total > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-card p-2">
          <span className="px-2 text-sm text-muted-foreground">ترتيب</span>
          <div className="flex gap-1">
            <SortButton active={sort === 'health'} onClick={() => setSort('health')}>
              الأدنى صحة
            </SortButton>
            <SortButton active={sort === 'lastAudit'} onClick={() => setSort('lastAudit')}>
              أحدث تدقيق
            </SortButton>
            <SortButton active={sort === 'name'} onClick={() => setSort('name')}>
              أبجدياً
            </SortButton>
          </div>
        </div>
      )}

      {summary.total === 0 ? (
        <EmptyState
          title="لا يوجد عملاء بعد"
          description="عندما يدعوك مالك شركة أو تُربَط بشركة عبر إدارتك ستظهر هنا. اطلب من المالك دعوتك من صفحة الدعوات."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedClients.map((c) => (
            <ClientCard key={c.companyId} client={c} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── مكوّنات فرعية ────────────────────────────────────────────────────────

function SummaryStrip({
  summary, specialtyLabel,
}: { summary: PortfolioSummary; specialtyLabel: string }) {
  const health = summary.avgHealth
  const healthColor =
    health == null ? 'text-muted-foreground'
    : health >= 70 ? 'text-emerald-600'
    : health >= 50 ? 'text-amber-600'
    : 'text-rose-600'
  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatBox label="عملاء" value={String(summary.total)} sub={specialtyLabel} />
      <StatBox
        label="متوسط الصحة"
        value={health == null ? '—' : `${health}٪`}
        valueClass={healthColor}
      />
      <StatBox
        label="المنطقة الحمراء"
        value={String(summary.redCount)}
        valueClass={summary.redCount > 0 ? 'text-rose-600' : 'text-muted-foreground'}
      />
      <StatBox
        label="بدون تدقيق"
        value={String(summary.unaudited)}
        valueClass={summary.unaudited > 0 ? 'text-amber-600' : 'text-muted-foreground'}
      />
      <StatBox
        label="تدقيق قديم (>30 يوم)"
        value={String(summary.staleCount)}
        valueClass={summary.staleCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}
      />
      <ZoneDistribution distribution={summary.distribution} total={summary.total} />
    </div>
  )
}

function StatBox({
  label, value, sub, valueClass,
}: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${valueClass ?? ''}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

function ZoneDistribution({
  distribution, total,
}: { distribution: PortfolioSummary['distribution']; total: number }) {
  if (total === 0) return <StatBox label="التوزيع" value="—" />
  const zones: { key: keyof typeof distribution; label: string; color: string }[] = [
    { key: 'GREEN',  label: 'أخضر',   color: 'bg-emerald-500' },
    { key: 'YELLOW', label: 'أصفر',   color: 'bg-yellow-400' },
    { key: 'ORANGE', label: 'برتقالي', color: 'bg-orange-500' },
    { key: 'RED',    label: 'أحمر',   color: 'bg-rose-500' },
    { key: 'NONE',   label: 'بدون',   color: 'bg-muted-foreground/40' },
  ]
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">التوزيع</div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
        {zones.map((z) => {
          const n = distribution[z.key]
          const pct = (n / total) * 100
          if (pct === 0) return null
          return <div key={z.key} className={z.color} style={{ width: `${pct}%` }} title={`${z.label}: ${n}`} />
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
        {zones.filter((z) => distribution[z.key] > 0).map((z) => (
          <span key={z.key}>{z.label}: {distribution[z.key]}</span>
        ))}
      </div>
    </div>
  )
}

function AlertCard({ alert }: { alert: PortfolioAlert }) {
  return (
    <Card className="border-rose-300 bg-rose-50">
      <CardContent className="flex items-center gap-3 p-3 text-sm">
        <span className="text-2xl" aria-hidden>⚠️</span>
        <div className="flex-1">
          <span className="font-semibold text-rose-900">تراجع في صحة {alert.companyName}</span>
          <span className="mr-2 text-rose-800">
            انخفضت من {alert.previousHealthPct}٪ إلى {alert.latestHealthPct}٪ (فارق {alert.delta}٪)
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

const SEVERITY_STYLES: Record<PortfolioSeverity, { border: string; bg: string; icon: string }> = {
  info:     { border: 'border-sky-200',     bg: 'bg-sky-50/60',      icon: 'ℹ️' },
  warning:  { border: 'border-amber-300',   bg: 'bg-amber-50',       icon: '⚡' },
  critical: { border: 'border-rose-300',    bg: 'bg-rose-50',        icon: '🔴' },
  positive: { border: 'border-emerald-300', bg: 'bg-emerald-50',     icon: '✅' },
}

function InsightCard({ insight }: { insight: PortfolioInsight }) {
  const s = SEVERITY_STYLES[insight.severity]
  return (
    <Card className={`${s.border} ${s.bg}`}>
      <CardContent className="flex items-start gap-3 p-3 text-sm">
        <span className="text-xl leading-none" aria-hidden>{s.icon}</span>
        <p className="flex-1 leading-relaxed">{insight.message}</p>
      </CardContent>
    </Card>
  )
}

function SortButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs transition ${
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  )
}

function ClientCard({ client }: { client: OverviewClient }) {
  const zoneClass = client.dangerZone ? dangerZoneColor(client.dangerZone) : 'text-muted-foreground bg-muted border-border'
  return (
    <Card
      className={`transition hover:-translate-y-0.5 hover:shadow-md ${
        client.dangerZone === 'RED' ? 'border-rose-300 shadow-rose-100/60' : ''
      }`}
    >
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{client.companyName}</h3>
            <p className="text-xs text-muted-foreground">
              {client.sector ?? 'قطاع غير محدّد'} · {sizeLabel(client.size)}
              {client.stage ? ` · ${client.stage}` : ''}
            </p>
          </div>
          <span className="text-2xl" aria-hidden>
            {DEPT_ICON[client.specialty]}
          </span>
        </div>

        {client.dangerZone === 'RED' && (
          <div className="rounded-md bg-rose-100 px-2 py-1 text-center text-xs font-semibold text-rose-900">
            🔴 تدخّل عاجل مطلوب
          </div>
        )}

        {client.hasAnyAudit ? (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2 text-xs">
            <div className="flex flex-col">
              <span className="text-muted-foreground">آخر تدقيق</span>
              {client.daysSinceLastAudit != null && (
                <span className="text-[10px] text-muted-foreground">
                  قبل {client.daysSinceLastAudit} يوم
                </span>
              )}
            </div>
            <span className={`rounded-md border px-2 py-0.5 font-medium ${zoneClass}`}>
              {client.healthPct}٪
              {client.dangerZone ? ` · ${zoneLabel(client.dangerZone)}` : ''}
            </span>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
            {client.hasDepartment ? 'لم يُجرَ تدقيق بعد لهذه الإدارة.' : 'الإدارة غير مُنشأة في هذه الشركة بعد.'}
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{DEPT_LABEL[client.specialty]}</span>
          <Link
            to={`/manager/clients/${client.companyId}`}
            className="rounded-md border bg-card px-2.5 py-1.5 transition hover:bg-accent"
          >
            فتح العميل ←
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function sizeLabel(size: OverviewClient['size']): string {
  switch (size) {
    case 'MICRO':  return 'متناهية الصغر'
    case 'SMALL':  return 'صغيرة'
    case 'MEDIUM': return 'متوسطة'
    case 'LARGE':  return 'كبيرة'
  }
}

function zoneLabel(zone: DangerZone): string {
  switch (zone) {
    case 'GREEN':  return 'أخضر'
    case 'YELLOW': return 'أصفر'
    case 'ORANGE': return 'برتقالي'
    case 'RED':    return 'أحمر'
  }
}
