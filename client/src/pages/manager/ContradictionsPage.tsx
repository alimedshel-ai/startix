import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_ICON, DEPT_LABEL } from '@/lib/deptApi'
import {
  getContradictions,
  type ContradictionInsight,
  type ContradictionSeverity,
  type ContradictionsResponse,
  type DeptContradictionSnapshot,
} from '@/lib/proApi'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'

// ─── A4 — تحليل التناقضات بين الأقسام ────────────────────────────────────────
// المسار: /manager/contradictions?client=X. يستهلك /api/pro/contradictions/:id.
// يعرض snapshots الأقسام (درجات ٤ محاور لكل قسم) + insights ملوّنة بالشدّة +
// اقتراح OKR جاهز لكل تناقض. أداة تسويقية قوية للمستشار: تُظهر له فوراً
// أين تختلف بيانات الأقسام لدى عميله.

const SEVERITY_ORDER: Record<ContradictionSeverity, number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
}

const SEVERITY_STYLE: Record<
  ContradictionSeverity,
  { label: string; border: string; bg: string; chip: string; icon: string }
> = {
  CRITICAL: {
    label: 'حرج',
    border: 'border-rose-300',
    bg: 'bg-rose-50',
    chip: 'bg-rose-600 text-white',
    icon: '🔴',
  },
  HIGH: {
    label: 'مرتفع',
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    chip: 'bg-orange-500 text-white',
    icon: '🟠',
  },
  MEDIUM: {
    label: 'متوسط',
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    chip: 'bg-amber-400 text-amber-900',
    icon: '🟡',
  },
  LOW: {
    label: 'منخفض',
    border: 'border-sky-200',
    bg: 'bg-sky-50',
    chip: 'bg-sky-500 text-white',
    icon: '🔵',
  },
}

type SeverityFilter = 'ALL' | ContradictionSeverity

export function ContradictionsPage() {
  const scope = useClientScopedCompany()
  const [data, setData] = useState<ContradictionsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<SeverityFilter>('ALL')

  useEffect(() => {
    if (!scope.companyId) return
    let alive = true
    setLoading(true)
    setError(null)
    getContradictions(scope.companyId)
      .then((res) => {
        if (!alive) return
        setData(res)
      })
      .catch((err) => {
        if (!alive) return
        setError(apiErrorMessage(err, 'تعذّر تحميل تحليل التناقضات'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [scope.companyId])

  const filtered = useMemo(() => {
    if (!data) return []
    const arr = filter === 'ALL' ? data.insights : data.insights.filter((i) => i.severity === filter)
    return [...arr].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  }, [data, filter])

  const counts = useMemo(() => {
    const base = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<ContradictionSeverity, number>
    if (!data) return base
    for (const i of data.insights) base[i.severity] += 1
    return base
  }, [data])

  if (scope.loading || loading) return <LoadingSpinner fullPage label="جاري تحليل بيانات الأقسام…" />

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="تحليل التناقضات" />
        <EmptyState title="حدث خطأ" description={error} />
      </div>
    )
  }

  if (!scope.company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="تحليل التناقضات" />
        <EmptyState
          title={scope.error ?? 'لا توجد شركة نشطة'}
          description="عُد إلى «عملائي» واختر عميلاً قبل بدء التحليل."
          action={
            <Link to="/manager/clients" className="rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-accent">
              الذهاب لعملائي
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`تحليل التناقضات — ${scope.company.name}`}
        description="مقارنة تلقائية بين درجات الأقسام على ٤ محاور، مع اقتراح OKR لكل تناقض."
      />

      {/* Snapshots — درجات الأقسام */}
      {data && data.snapshots.length > 0 && (
        <SnapshotsCard snapshots={data.snapshots} />
      )}

      {/* رسالة "بيانات غير كافية" */}
      {data && data.message && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <span className="text-2xl" aria-hidden>ℹ️</span>
            <div className="flex-1">
              <p className="font-semibold text-amber-900">{data.message}</p>
              <p className="mt-1 text-amber-800">
                اطلب من المسؤولين ملء التدقيقات الأساسية لأقسام إضافية، ثم أعد التحليل.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* شريط الإحصاء + الفلترة */}
      {data && data.insights.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-card p-2">
          <div className="flex items-center gap-3 px-2 text-sm">
            <span className="text-muted-foreground">{data.insights.length} تناقض مكتشف</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <FilterButton active={filter === 'ALL'} onClick={() => setFilter('ALL')}>
              الكل
            </FilterButton>
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as ContradictionSeverity[]).map((s) => (
              <FilterButton
                key={s}
                active={filter === s}
                onClick={() => setFilter(s)}
                disabled={counts[s] === 0}
                variant={s}
              >
                {SEVERITY_STYLE[s].icon} {SEVERITY_STYLE[s].label} ({counts[s]})
              </FilterButton>
            ))}
          </div>
        </div>
      )}

      {/* لا تناقضات */}
      {data && data.insights.length === 0 && !data.message && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="text-3xl" aria-hidden>✅</span>
            <div>
              <p className="font-semibold text-emerald-900">لا تناقضات مكتشفة بين الأقسام</p>
              <p className="mt-1 text-sm text-emerald-800">
                بيانات الأقسام متّسقة نسبياً. تابع التدقيقات الدورية للحفاظ على المستوى.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* قائمة التناقضات */}
      <div className="grid gap-3">
        {filtered.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  )
}

// ─── snapshots — درجات الأقسام على المحاور الأربعة ─────────────────────

function SnapshotsCard({ snapshots }: { snapshots: DeptContradictionSnapshot[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">درجات الأقسام على المحاور الأربعة</CardTitle>
        <CardDescription>
          {snapshots.length} قسم مدقّق · الحوكمة / المالية / الفريق / الرقمي
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right text-xs text-muted-foreground">
                <th className="py-2">القسم</th>
                <th className="py-2">الصحة</th>
                <th className="py-2">الحوكمة</th>
                <th className="py-2">المالية</th>
                <th className="py-2">الفريق</th>
                <th className="py-2">الرقمي</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.code} className="border-b last:border-b-0">
                  <td className="py-2 font-medium">
                    <span className="ml-1" aria-hidden>{DEPT_ICON[s.code]}</span>
                    {DEPT_LABEL[s.code]}
                  </td>
                  <td className="py-2 tabular-nums font-semibold">{s.healthPct}٪</td>
                  <td className="py-2 tabular-nums text-muted-foreground">{Math.round(s.axes.governance)}٪</td>
                  <td className="py-2 tabular-nums text-muted-foreground">{Math.round(s.axes.financial)}٪</td>
                  <td className="py-2 tabular-nums text-muted-foreground">{Math.round(s.axes.team)}٪</td>
                  <td className="py-2 tabular-nums text-muted-foreground">{Math.round(s.axes.digital)}٪</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── بطاقة تناقض واحد ──────────────────────────────────────────────

function InsightCard({ insight }: { insight: ContradictionInsight }) {
  const style = SEVERITY_STYLE[insight.severity]
  return (
    <Card className={`${style.border} ${style.bg}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl" aria-hidden>{style.icon}</span>
              <CardTitle className="text-base">{insight.title}</CardTitle>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${style.chip}`}>
                {style.label}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed">{insight.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 pt-2">
          {insight.affectedDepts.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs"
            >
              <span aria-hidden>{DEPT_ICON[code]}</span>
              {DEPT_LABEL[code]}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span aria-hidden>🎯</span>
            OKR مقترح · {insight.suggestedOKR.timeline}
          </div>
          <p className="text-sm font-semibold">{insight.suggestedOKR.objective}</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {insight.suggestedOKR.keyResults.map((kr, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-muted-foreground">{i + 1}.</span>
                <span className="flex-1 leading-snug">{kr}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

function FilterButton({
  active, onClick, disabled, variant, children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  variant?: ContradictionSeverity
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-2.5 py-1 text-xs transition ${
        active
          ? variant
            ? SEVERITY_STYLE[variant].chip
            : 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted disabled:opacity-40'
      }`}
    >
      {children}
    </button>
  )
}
