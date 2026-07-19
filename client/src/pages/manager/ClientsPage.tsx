import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { PlanningJourneyCard } from '@/components/manager/PlanningJourneyCard'
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
  // مدير جديد بلا تدقيقات → نُظهر «رحلة التخطيط» كدليل تعليمي.
  const isNewUser = summary.total === 0 || summary.unaudited === summary.total

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="عملائي"
        description={`تشرف على إدارة ${specialtyLabel} عبر ${summary.total} عميلاً.`}
        actions={
          <Link
            to="/manager/clients/add"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            ➕ أضف عميلاً
          </Link>
        }
      />

      {/* 🧭 «إلى أين أذهب الآن؟» — بطاقة توجيه ذكيّة أعلى الصفحة */}
      <NextActionHero data={data} sortedClients={sortedClients} />

      {/* 🗺️ للمدير الجديد — يشرح رحلة التخطيط قبل ما يشوف الأرقام */}
      {isNewUser && (
        <PlanningJourneyCard />
      )}

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

// ─── حالة الإنجاز لكل عميل ─────────────────────────────────────
// جديد: لا تدقيق. في تقدّم: تدقيق + منطقة غير خضراء. منجز: منطقة خضراء.
type ClientStatus = 'new' | 'inProgress' | 'completed'

function statusOf(c: OverviewClient): ClientStatus {
  if (!c.hasAnyAudit) return 'new'
  if (c.dangerZone === 'GREEN' && (c.healthPct ?? 0) >= 70) return 'completed'
  return 'inProgress'
}

const STATUS_META: Record<ClientStatus, {
  labelAr: string
  emoji: string
  chipClass: string
  cardClass: string
  buttonClass: string
  buttonLabel: string
  hintAr: string
}> = {
  new: {
    labelAr: 'ابدأ الرحلة',
    emoji: '🚀',
    chipClass: 'border-sky-400 bg-sky-100 text-sky-800',
    cardClass: 'border-sky-200',
    buttonClass: 'bg-primary text-primary-foreground hover:bg-primary/90',
    buttonLabel: '🚀 ابدأ الرحلة',
    hintAr: 'عميل جديد — يحتاج تدقيقاً أوّلياً لتبدأ خطته.',
  },
  inProgress: {
    labelAr: 'قيد العمل',
    emoji: '▶',
    chipClass: 'border-amber-400 bg-amber-100 text-amber-800',
    cardClass: 'border-amber-200',
    buttonClass: 'border bg-card hover:bg-accent',
    buttonLabel: '▶ متابعة',
    hintAr: 'العمل جارٍ — أكمِل مراحل الخطّة أو حسّن الصحّة.',
  },
  completed: {
    labelAr: 'منجز',
    emoji: '✅',
    chipClass: 'border-emerald-500 bg-emerald-100 text-emerald-900',
    cardClass: 'border-emerald-300 bg-emerald-50/30',
    buttonClass: 'border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50',
    buttonLabel: '📝 عرض / تحرير',
    hintAr: 'الإدارة في المنطقة الخضراء — الخطّة منجزة. تُفتَح للتحرير فقط.',
  },
}

function ClientCard({ client }: { client: OverviewClient }) {
  const zoneClass = client.dangerZone ? dangerZoneColor(client.dangerZone) : 'text-muted-foreground bg-muted border-border'
  const status = statusOf(client)
  const sm = STATUS_META[status]
  return (
    <Card
      className={`transition hover:-translate-y-0.5 hover:shadow-md ${sm.cardClass} ${
        client.dangerZone === 'RED' ? 'border-rose-300 shadow-rose-100/60' : ''
      }`}
    >
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${sm.chipClass}`}>
                {sm.emoji} {sm.labelAr}
              </span>
              {status === 'completed' && (
                <span className="text-[10px] text-emerald-700">لا حاجة لإجراء</span>
              )}
            </div>
            <h3 className="mt-1 truncate text-base font-semibold">{client.companyName}</h3>
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

        <div className="rounded-md border border-dashed bg-card/40 px-2 py-1 text-[10px] text-muted-foreground">
          {sm.hintAr}
        </div>

        <div className="flex flex-col gap-2 text-xs">
          <span className="text-muted-foreground">{DEPT_LABEL[client.specialty]}</span>
          <div className="flex items-center gap-2">
            {/* زر «المراحل» — يفتح صفحة مراحل هذا العميل (أين أنت + الخطوة القادمة) */}
            <Link
              to={`/manager/clients/${client.companyId}/journey`}
              className="flex-1 rounded-md border bg-card px-2.5 py-1.5 text-center font-medium transition hover:bg-accent"
              title="اعرض مراحل خطّة هذا العميل وأين وصلت"
            >
              🗺️ المراحل
            </Link>
            <Link
              to={`/manager/clients/${client.companyId}`}
              className={`flex-1 rounded-md px-2.5 py-1.5 text-center font-medium transition ${sm.buttonClass}`}
            >
              {sm.buttonLabel}
            </Link>
          </div>
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

// ─── NextActionHero — «إلى أين أذهب الآن؟» ───────────────────────
// بطاقة توجيه ذكيّة أعلى الصفحة. تقرأ حالة كل العملاء وتقترح
// خطوة *واحدة* واضحة — بدلاً من ترك المدير أمام قائمة بلا سياق.
//
// المنطق (بالأولويّة):
//   1. لا عملاء       → أضف أوّل عميل (البداية)
//   2. منطقة حمراء    → تدخّل عاجل على العميل الأخطر
//   3. بلا تدقيق      → ابدأ رحلة العميل الأوّل بلا تدقيق
//   4. تدقيق قديم     → راجع أقدم عميل مُدقَّق
//   5. الكل بخير      → مراجعة أسبوعيّة أو إضافة عميل جديد

function NextActionHero({
  data, sortedClients,
}: { data: ProOverviewResponse; sortedClients: OverviewClient[] }) {
  const suggestion = deriveNextAction(data, sortedClients)
  return (
    <Card className={`overflow-hidden border-2 ${suggestion.borderClass} ${suggestion.bgClass}`}>
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="text-4xl">{suggestion.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            🧭 إلى أين أذهب الآن؟
          </div>
          <div className="mt-0.5 text-base font-bold">{suggestion.title}</div>
          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {suggestion.reason}
          </div>
        </div>
        <Link
          to={suggestion.to}
          className={`inline-flex shrink-0 items-center gap-1 rounded-md px-4 py-2 text-sm font-medium shadow-sm transition ${suggestion.buttonClass}`}
        >
          {suggestion.cta} ←
        </Link>
      </CardContent>
    </Card>
  )
}

interface NextAction {
  icon: string
  title: string
  reason: string
  to: string
  cta: string
  borderClass: string
  bgClass: string
  buttonClass: string
}

function deriveNextAction(data: ProOverviewResponse, sortedClients: OverviewClient[]): NextAction {
  const { summary } = data

  // ١) لا عملاء
  if (summary.total === 0) {
    return {
      icon: '🚀',
      title: 'ابدأ بإضافة عميلك الأوّل',
      reason: 'المنصّة مصمّمة لتُدير عدّة عملاء. لكن قبل كل شيء — عميل واحد ابتداءً يفتح كل الأدوات.',
      to: '/manager/clients/add',
      cta: 'أضف عميلاً',
      borderClass: 'border-sky-400',
      bgClass: 'bg-gradient-to-l from-sky-100 to-sky-50/40',
      buttonClass: 'bg-sky-600 text-white hover:bg-sky-700',
    }
  }

  // ٢) منطقة حمراء — الأولويّة القصوى
  const redClient = sortedClients.find((c) => c.dangerZone === 'RED')
  if (redClient) {
    return {
      icon: '🔴',
      title: `تدخّل عاجل: ${redClient.companyName}`,
      reason: `صحّة الإدارة ${redClient.healthPct}٪ — المنطقة الحمراء تستلزم خطّة إنقاذ فوريّة. لا تؤجّل.`,
      to: `/manager/clients/${redClient.companyId}`,
      cta: 'افتح لوحة العميل',
      borderClass: 'border-rose-500',
      bgClass: 'bg-gradient-to-l from-rose-100 to-rose-50/40',
      buttonClass: 'bg-rose-600 text-white hover:bg-rose-700',
    }
  }

  // ٣) بلا تدقيق
  if (summary.unaudited > 0) {
    const noAudit = sortedClients.find((c) => !c.hasAnyAudit)
    if (noAudit) {
      return {
        icon: '🎯',
        title: `ابدأ رحلة ${noAudit.companyName}`,
        reason: `${summary.unaudited} عميل بلا تدقيق. عميل غير مُدقَّق = بيانات مفقودة = قرارات ضبابيّة.`,
        to: `/manager/clients/${noAudit.companyId}`,
        cta: 'ابدأ التدقيق',
        borderClass: 'border-amber-400',
        bgClass: 'bg-gradient-to-l from-amber-100 to-amber-50/40',
        buttonClass: 'bg-amber-600 text-white hover:bg-amber-700',
      }
    }
  }

  // ٤) تدقيق قديم
  if (summary.staleCount > 0) {
    const stale = sortedClients.find((c) => c.daysSinceLastAudit != null && c.daysSinceLastAudit > 30)
    if (stale) {
      return {
        icon: '⏰',
        title: `تدقيق قديم: ${stale.companyName}`,
        reason: `آخر تدقيق قبل ${stale.daysSinceLastAudit} يوم. ${summary.staleCount} عملاء بحاجة إعادة تدقيق دوري.`,
        to: `/manager/clients/${stale.companyId}`,
        cta: 'أعد التدقيق',
        borderClass: 'border-orange-400',
        bgClass: 'bg-gradient-to-l from-orange-100 to-orange-50/40',
        buttonClass: 'bg-orange-600 text-white hover:bg-orange-700',
      }
    }
  }

  // ٥) الكل بخير — تابع تنفيذ المبادرات
  return {
    icon: '✅',
    title: 'كل عملائك في وضع جيّد',
    reason: `صحّة متوسّطة ${summary.avgHealth ?? '—'}٪ عبر ${summary.total} عميلاً. الوقت مناسب لمتابعة تنفيذ المبادرات الجارية.`,
    to: '/execute',
    cta: 'متابعة المبادرات',
    borderClass: 'border-emerald-400',
    bgClass: 'bg-gradient-to-l from-emerald-100 to-emerald-50/40',
    buttonClass: 'bg-emerald-600 text-white hover:bg-emerald-700',
  }
}
