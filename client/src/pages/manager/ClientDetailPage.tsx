import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_ICON, DEPT_LABEL, dangerZoneColor, type DangerZone, type DeptCode } from '@/lib/deptApi'
import { getProOverview, type OverviewClient } from '@/lib/proApi'
import { useAuthStore } from '@/store/authStore'

// ─── PRO-5 — لوحة العميل الواحد (workspace) ──────────────────────────────────
// المسار: /manager/clients/:companyId. يعرض:
//   • رأس بيانات الشركة + التخصّص + شارة الصحّة
//   • بطاقة "آخر تدقيق" (healthPct + zone + متى)
//   • شبكة أدوات مفتوحة على هذا العميل عبر ?client=X:
//       – تدقيق أساسي        (/manager/{dept}/audit)
//       – تحليل عميق         (/manager/dept-deep)
//       – تحليل SMART        (/manager/dept-smart)
//       – نقطة التعادل       (للـ FINANCE فقط)
//       – خطة الإصلاح        (للـ LOGISTICS/COMPLIANCE)
//       – مركز الحوكمة       (للـ GOVERNANCE)
//
// المصدر: /api/pro/overview → find(companyId). لا endpoint جديد.

// ⚠️ يجب أن يبقى مطابقاً لخريطة الـ nav.ts / router للـ dept audits.
const DEPT_AUDIT_ROUTE: Record<DeptCode, string> = {
  HR:                '/manager/hr/audit',
  FINANCE:           '/manager/finance/audit',
  SALES:             '/manager/sales/audit',
  MARKETING:         '/manager/marketing/audit',
  OPERATIONS:        '/manager/operations/audit',
  IT:                '/manager/it/audit',
  CUSTOMER_SERVICE:  '/manager/cs/audit',
  SUPPORT:           '/manager/cs/audit',
  LOGISTICS:         '/manager/logistics/audit',
  QUALITY:           '/manager/quality/audit',
  PROJECTS:          '/manager/projects/audit',
  GOVERNANCE:        '/manager/governance/audit',
  COMPLIANCE:        '/manager/compliance/audit',
}

// أدوات إضافية تخصّصية — تُعرض فقط إذا التخصّص يدعمها.
const DEPT_EXTRA_TOOLS: Partial<Record<DeptCode, { label: string; to: string; icon: string }[]>> = {
  FINANCE:    [{ label: 'حاسبة نقطة التعادل', to: '/manager/finance/break-even', icon: '⚖️' }],
  LOGISTICS:  [{ label: 'خطة إصلاح اللوجستيات', to: '/manager/logistics/reform',   icon: '🔧' }],
  GOVERNANCE: [{ label: 'مركز الحوكمة',        to: '/manager/governance/hub',      icon: '🏛️' }],
  COMPLIANCE: [
    { label: 'تدقيق احترافي', to: '/manager/compliance/audit-pro', icon: '🛡️' },
    { label: 'خطة الإصلاح',   to: '/manager/compliance/reform',    icon: '🔧' },
  ],
}

export function ClientDetailPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [client, setClient] = useState<OverviewClient | null>(null)

  const isPro = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'

  useEffect(() => {
    if (!isPro || !companyId) return
    let alive = true
    setLoading(true)
    setError(null)
    getProOverview()
      .then((res) => {
        if (!alive) return
        const found = res.clients.find((c) => c.companyId === companyId) ?? null
        setClient(found)
        if (!found) setError('لم نجد هذا العميل في قائمتك.')
      })
      .catch((err: unknown) => {
        if (!alive) return
        setError(apiErrorMessage(err, 'تعذّر تحميل بيانات العميل'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [isPro, companyId])

  if (!isPro) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="لوحة العميل" />
        <EmptyState
          title="هذه الشاشة للمدير المستقل"
          description="سجّل كمدير مستقل واختر تخصّصاً لعرض عملائك."
        />
      </div>
    )
  }

  if (loading) return <LoadingSpinner fullPage label="جاري تحميل العميل…" />

  if (error || !client) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="لوحة العميل" />
        <EmptyState
          title={error ?? 'العميل غير موجود'}
          description="عُد إلى قائمة عملائك أو تحقّق من الرابط."
          action={
            <button
              onClick={() => navigate('/manager/clients')}
              className="rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-accent"
            >
              العودة لعملائي
            </button>
          }
        />
      </div>
    )
  }

  const { companyName, specialty, sector, size, stage, healthPct, dangerZone, lastAuditAt, daysSinceLastAudit, hasAnyAudit, hasDepartment } = client
  const clientQ = `?client=${client.companyId}`
  const extras = DEPT_EXTRA_TOOLS[specialty] ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`🏢 ${companyName}`}
        description={`${sector ?? 'قطاع غير محدّد'} · ${sizeLabel(size)}${stage ? ` · ${stage}` : ''} · إدارة ${DEPT_LABEL[specialty]}`}
        breadcrumbs={[
          { label: 'عملائي', to: '/manager/clients' },
          { label: companyName },
        ]}
      />

      <HealthCard
        specialty={specialty}
        healthPct={healthPct}
        dangerZone={dangerZone}
        lastAuditAt={lastAuditAt}
        daysSince={daysSinceLastAudit}
        hasAnyAudit={hasAnyAudit}
        hasDepartment={hasDepartment}
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">أدوات العمل على هذا العميل</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ToolCard
            icon={DEPT_ICON[specialty]}
            title={`تدقيق ${DEPT_LABEL[specialty]}`}
            description="12-15 سؤالاً على ٤ محاور. النتيجة تحفظ آلياً."
            to={`${DEPT_AUDIT_ROUTE[specialty]}${clientQ}`}
            primary
          />
          <ToolCard
            icon="🔬"
            title="التحليل العميق المخصّص"
            description="بنك أسئلة عميق لتخصّصك (~٦٠ سؤال على ٦ أقسام) — من stratix legacy."
            to={`/manager/deep-analysis${clientQ}`}
          />
          <ToolCard
            icon="📝"
            title="تحليل عميق مبسّط"
            description="٤ أسئلة سريعة عامّة (القيود / الهشاشة / الأتمتة / الممارسات)."
            to={`/manager/dept-deep${clientQ}`}
          />
          <ToolCard
            icon="⚡"
            title="تحليل التناقضات"
            description="يقارن بيانات الأقسام ويكشف التناقضات + يقترح OKR جاهز لكل تناقض."
            to={`/manager/contradictions${clientQ}`}
          />
        </div>
      </div>

      {/* العمل التشغيلي — أدوات جمع البيانات والتنفيذ اليومي للمدير الخبير */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          العمل التشغيلي
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ToolCard
            icon="📊"
            title="مؤشرات الأداء"
            description="تعريف KPIs التخصّصية والمعايير القطاعية للعميل."
            to={`/kpis${clientQ}`}
          />
          <ToolCard
            icon="✍️"
            title="إدخالات المؤشرات"
            description="تسجيل قراءات المؤشرات الدورية."
            to={`/kpi-entries${clientQ}`}
          />
          <ToolCard
            icon="💡"
            title="المبادرات"
            description="مبادرات تحسين تشغيلي على مستوى الإدارة."
            to={`/initiatives${clientQ}`}
          />
          <ToolCard
            icon="📁"
            title="المشاريع"
            description="مشاريع تنفيذية للعميل."
            to={`/projects${clientQ}`}
          />
          <ToolCard
            icon="✓"
            title="المهام"
            description="متابعة المهام اليومية."
            to={`/tasks${clientQ}`}
          />
          <ToolCard
            icon="⚖️"
            title="نقطة التعادل"
            description="حاسبة تشغيلية للسيولة وهامش الأمان."
            to={`/manager/finance/break-even${clientQ}`}
          />
          <ToolCard
            icon="✨"
            title="تحليل SMART"
            description="توليد مؤشرات أداء وتوصيات تنفيذية بناءً على درجات التدقيق."
            to={`/manager/dept-smart${clientQ}`}
          />
          {extras.map((ex) => (
            <ToolCard
              key={ex.to}
              icon={ex.icon}
              title={ex.label}
              description="أداة مخصّصة لتخصّصك."
              to={`${ex.to}${clientQ}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── مكوّنات فرعية ────────────────────────────────────────────────────────

function HealthCard({
  specialty, healthPct, dangerZone, lastAuditAt, daysSince, hasAnyAudit, hasDepartment,
}: {
  specialty: DeptCode
  healthPct: number | null
  dangerZone: DangerZone | null
  lastAuditAt: string | null
  daysSince: number | null
  hasAnyAudit: boolean
  hasDepartment: boolean
}) {
  if (!hasAnyAudit) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">لم يُجرَ تدقيق بعد لإدارة {DEPT_LABEL[specialty]}</CardTitle>
          <CardDescription>
            {hasDepartment
              ? 'ابدأ التدقيق من الأداة أدناه لتظهر مؤشرات الصحة هنا.'
              : 'الإدارة لم تُنشأ بعد لهذا العميل — إنشاؤها يتم تلقائياً عند بدء أوّل تدقيق.'}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }
  const zoneClass = dangerZone ? dangerZoneColor(dangerZone) : 'text-muted-foreground bg-muted border-border'
  const date = lastAuditAt ? new Date(lastAuditAt).toLocaleDateString('ar-SA') : null
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-gradient-to-l from-primary to-violet-500" />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              صحّة إدارة {DEPT_LABEL[specialty]}
              {dangerZone && (
                <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${zoneClass}`}>
                  {zoneLabel(dangerZone)}
                </span>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {date ? `آخر تدقيق: ${date}` : ''}
              {daysSince != null ? ` · قبل ${daysSince} يوم` : ''}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold tabular-nums text-primary">
              {healthPct}<span className="text-lg">٪</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">الصحة الإجمالية</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full ${
              (healthPct ?? 0) >= 70 ? 'bg-emerald-500'
              : (healthPct ?? 0) >= 50 ? 'bg-amber-500'
              : 'bg-rose-500'
            }`}
            style={{ width: `${healthPct ?? 0}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ToolCard({
  icon, title, description, to, primary,
}: { icon: string; title: string; description: string; to: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`group rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
        primary ? 'border-primary/40 bg-primary/5' : 'bg-card'
      }`}
    >
      <div className="mb-2 text-2xl" aria-hidden>{icon}</div>
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
      <div className="mt-3 text-xs text-primary opacity-0 transition group-hover:opacity-100">
        فتح ←
      </div>
    </Link>
  )
}

function sizeLabel(size: string): string {
  switch (size) {
    case 'MICRO':  return 'متناهية الصغر'
    case 'SMALL':  return 'صغيرة'
    case 'MEDIUM': return 'متوسطة'
    case 'LARGE':  return 'كبيرة'
    default:       return size
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
