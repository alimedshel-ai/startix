import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useCompany } from '@/hooks/useCompany'
import { apiErrorMessage } from '@/lib/api'
import {
  DEPT_ICON, DEPT_LABEL, dangerZoneColor,
  listDepartments, type Department,
} from '@/lib/deptApi'
import {
  listAllArtifacts, listInitiatives, listKPIs,
  type Artifact, type Initiative, type KPI,
} from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

// ─── /manager/dept-dashboard — لوحة قيادة الإدارة ─────────────────────
// المدير المستقل يفتحها عبر ?client=<id> (useCompany يقرأها). المدير الداخلي
// يفتحها بلا معلمة → useCompany يرجع أول شركة.
//
// أقسام اللوحة:
//   1. Hero: اسم الشركة + الإدارة (تخصّص المدير) + شارة الصحة + OPEX
//   2. أدوات سريعة: ٦ روابط أساسية (تدقيق / تحليل عميق / SWOT / KPIs / خطة / تسلسل)
//   3. نظرة سريعة: آخر تدقيق، فجوات، مبادرات، KPIs، عدد artifacts
//   4. الخطوة التالية: ما يجب فعله الآن حسب البيانات المتاحة

const ZONE_LABEL: Record<string, string> = {
  GREEN: 'آمنة', YELLOW: 'تحذير', ORANGE: 'خطر', RED: 'حرجة',
}

export function DeptDashboardPage() {
  const scope = useCompany()
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null

  const [departments, setDepartments] = useState<Department[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [kpis, setKpis] = useState<KPI[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!scope.company) return
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const cid = scope.company!.id
        const [deps, arts, inits, ks] = await Promise.allSettled([
          listDepartments(cid),
          listAllArtifacts(cid),
          listInitiatives(cid),
          listKPIs(cid),
        ])
        if (!alive) return
        if (deps.status === 'fulfilled') setDepartments(deps.value)
        if (arts.status === 'fulfilled') setArtifacts(arts.value)
        if (inits.status === 'fulfilled') setInitiatives(inits.value)
        if (ks.status === 'fulfilled') setKpis(ks.value)
      } catch (err) {
        toast.error(apiErrorMessage(err, 'تعذّر تحميل اللوحة'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [scope.company])

  if (scope.loading) return <LoadingSpinner fullPage label="جاري تحميل الشركة…" />
  if (!scope.company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="لوحة الإدارة" />
        <EmptyState title={scope.error ?? 'لا شركة نشطة'} description="أكمل التسجيل أو اختر عميلاً." />
      </div>
    )
  }

  const company = scope.company
  const opex = company.opex ?? {}
  const clientQ = `?client=${company.id}`

  // إدارة تخصّص المدير (إن وُجدت)
  const myDept = specialty ? departments.find((d) => d.type === specialty) : null
  const myScore = myDept?.auditData?.healthPct ?? myDept?.auditScore ?? null
  const myZone = (myDept?.auditData?.dangerZone as string | undefined) ?? null

  const artifactTypes = new Set(artifacts.map((a) => a.type))
  const hasSwot = artifactTypes.has('GAP_ANALYSIS') // بديل، بما أن SWOT جدول منفصل
  const activeInitiatives = initiatives.filter((i) => i.status === 'planned' || i.status === 'in_progress')
  const kpisAtRisk = kpis.filter((k) => k.targetValue > 0 && k.currentValue / k.targetValue < 0.7).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="لوحة الإدارة"
        description={specialty
          ? `${DEPT_ICON[specialty]} إدارة ${DEPT_LABEL[specialty]} — ${company.name}`
          : company.name}
      />

      {/* ─── Hero: صحة + هوية ─────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-bl from-primary/10 to-transparent md:col-span-2">
          <div className="h-1 bg-gradient-to-l from-primary to-violet-500" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              🏢 {company.name}
              {specialty && (
                <span className="rounded-md border bg-card px-2 py-0.5 text-xs font-normal">
                  {DEPT_ICON[specialty]} {DEPT_LABEL[specialty]}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {company.sector ?? 'قطاع غير محدّد'}
              {company.subsector ? ` · ${company.subsector}` : ''}
              {company.entityType ? ` · ${company.entityType}` : ''}
              {' · '}
              {company.size === 'MICRO' ? 'متناهية الصغر' : company.size === 'SMALL' ? 'صغيرة' : company.size === 'MEDIUM' ? 'متوسطة' : 'كبيرة'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-4">
            <OpexStat label="عدد الفريق" value={opex.team} icon="👥" />
            <OpexStat label="الميزانية" value={opex.budget} icon="💰" suffix="ر.س" />
            <OpexStat label="المستهدف" value={opex.target} icon="🎯" suffix="ر.س" />
            <OpexStat label="متوسط الراتب" value={opex.avgSalary} icon="💵" suffix="/شهر" />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-l from-emerald-500 to-teal-500" />
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">صحة الإدارة</CardDescription>
            <CardTitle className="flex items-center justify-between text-3xl tabular-nums">
              {myScore != null ? `${Math.round(myScore)}%` : '—'}
              {myZone && (
                <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${dangerZoneColor(myZone as 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED')}`}>
                  {ZONE_LABEL[myZone] ?? myZone}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={myScore ?? 0} className="h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {myDept ? 'من آخر تدقيق أُجري.' : 'لم يبدأ التدقيق بعد.'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── أدوات سريعة ─────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">ابدأ من هنا</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <QuickTool
            to={`/manager/deep-analysis${clientQ}`}
            icon="🔬"
            title="التحليل العميق"
            desc={artifactTypes.has('DEPT_DEEP_FULL') ? '✓ مبدوء' : 'ابدأ التحليل (٣٣٠ سؤال)'}
            done={artifactTypes.has('DEPT_DEEP_FULL')}
          />
          {specialty && (
            <QuickTool
              to={`/manager/${deptRoute(specialty)}/audit${clientQ}`}
              icon={DEPT_ICON[specialty]}
              title="تدقيق أساسي"
              desc={myDept ? '✓ مُدقَّق' : 'ابدأ التدقيق'}
              done={!!myDept}
            />
          )}
          <QuickTool
            to={`/swot${clientQ}`}
            icon="🧭"
            title="SWOT"
            desc="نقاط القوة والضعف"
            done={hasSwot}
          />
          <QuickTool
            to={`/kpis${clientQ}`}
            icon="📊"
            title="KPIs"
            desc={kpis.length > 0 ? `${kpis.length} مؤشر` : 'أنشئ مؤشرات'}
            done={kpis.length > 0}
          />
          <QuickTool
            to={`/manager/strategic-plan${clientQ}`}
            icon="🗺️"
            title="الخطة الاستراتيجية"
            desc="المسار الموصى به"
          />
          <QuickTool
            to={`/manager/clients/${company.id}/journey`}
            icon="🎯"
            title="التسلسل الكامل"
            desc="٦ مراحل مقفلة"
            primary
          />
        </div>
      </div>

      {/* ─── نظرة سريعة على البيانات ───────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">نظرة سريعة</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniCard
            icon="📦"
            label="مخرجات محفوظة"
            value={artifacts.length}
            hint={`${artifactTypes.size} أداة`}
            to={`/manager/clients/${company.id}/journey`}
          />
          <MiniCard
            icon="💡"
            label="مبادرات نشطة"
            value={activeInitiatives.length}
            hint={initiatives.length > 0 ? `${initiatives.length} إجمالاً` : 'لا مبادرات'}
            to={`/initiatives${clientQ}`}
          />
          <MiniCard
            icon="📊"
            label="KPIs عالية الخطر"
            value={kpisAtRisk}
            hint={kpis.length > 0 ? `${kpis.length} إجمالاً` : 'لا مؤشرات'}
            to={`/kpis${clientQ}`}
            tint={kpisAtRisk > 0 ? 'rose' : 'default'}
          />
          <MiniCard
            icon="🏢"
            label="إدارات مُدقَّقة"
            value={departments.length}
            hint={departments.length === 0 ? 'ابدأ إدارتك' : ''}
            to={`/manager/select-dept${clientQ}`}
          />
        </div>
      </div>

      {/* ─── الخطوة التالية ─────────────────────────────────────── */}
      <NextStepBanner
        loading={loading}
        hasAudit={!!myDept}
        hasDeep={artifactTypes.has('DEPT_DEEP_FULL')}
        hasSwot={hasSwot}
        hasKpis={kpis.length > 0}
        hasInitiatives={initiatives.length > 0}
        clientQ={clientQ}
        companyId={company.id}
        specialty={specialty}
      />

      {/* ─── إدارات الشركة ─────────────────────────────────────── */}
      {departments.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">إدارات الشركة</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => {
              const zone = d.auditData?.dangerZone ?? 'GREEN'
              const score = d.auditData?.healthPct ?? d.auditScore ?? 0
              return (
                <Link
                  key={d.id}
                  to={`/manager/${deptRoute(d.type)}/audit${clientQ}`}
                  className="block"
                >
                  <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span aria-hidden>{DEPT_ICON[d.type]}</span>
                        {DEPT_LABEL[d.type]}
                      </CardTitle>
                      <CardDescription>
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${dangerZoneColor(zone as 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED')}`}>
                          {ZONE_LABEL[zone] ?? zone}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-2xl font-semibold tabular-nums">{Math.round(score)}%</div>
                      <Progress value={score} className="h-2" />
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── مكوّنات فرعية ────────────────────────────────────────────────────

function OpexStat({ label, value, icon, suffix }: { label: string; value?: number; icon: string; suffix?: string }) {
  return (
    <div className="rounded-lg border bg-card/70 p-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span aria-hidden>{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums">
        {value != null ? value.toLocaleString('ar-SA') : '—'}
        {suffix && value != null && <span className="mr-1 text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  )
}

function QuickTool({
  to, icon, title, desc, done, primary,
}: { to: string; icon: string; title: string; desc: string; done?: boolean; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`group flex flex-col rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-md ${
        primary ? 'border-primary/40 bg-primary/10' : done ? 'border-emerald-300 bg-emerald-50/60' : 'bg-card'
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xl" aria-hidden>{icon}</span>
        {done && <span className="text-xs text-emerald-600">✓</span>}
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-[11px] text-muted-foreground">{desc}</div>
    </Link>
  )
}

function MiniCard({
  icon, label, value, hint, to, tint = 'default',
}: {
  icon: string; label: string; value: number; hint: string; to: string
  tint?: 'default' | 'rose'
}) {
  return (
    <Link to={to}>
      <Card className={`transition hover:-translate-y-0.5 hover:shadow-md ${
        tint === 'rose' && value > 0 ? 'border-rose-200 bg-rose-50/50' : ''
      }`}>
        <CardContent className="flex items-center gap-3 p-3">
          <div className="text-2xl" aria-hidden>{icon}</div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold tabular-nums">{value}</div>
            {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function NextStepBanner(props: {
  loading: boolean
  hasAudit: boolean
  hasDeep: boolean
  hasSwot: boolean
  hasKpis: boolean
  hasInitiatives: boolean
  clientQ: string
  companyId: string
  specialty: string | null
}) {
  if (props.loading) return null

  // ترتيب الأولويات: تدقيق → تحليل عميق → SWOT → KPIs → مبادرات → التسلسل الكامل.
  let title = 'التسلسل الاستراتيجي جاهز'
  let desc = 'كل المرحل مبدوءة — تابع في صفحة التسلسل.'
  let cta = 'افتح التسلسل ←'
  let to = `/manager/clients/${props.companyId}/journey`
  let icon = '🎯'

  if (!props.hasAudit && props.specialty) {
    title = 'ابدأ بتدقيق أساسي'
    desc = 'قبل أي شيء، أجرِ تدقيقاً سريعاً على إدارتك (١٢-١٥ سؤالاً).'
    cta = 'ابدأ التدقيق'
    to = `/manager/${deptRoute(props.specialty as import('@/lib/deptApi').DeptCode)}/audit${props.clientQ}`
    icon = '🚀'
  } else if (!props.hasDeep) {
    title = 'أكمل التحليل العميق'
    desc = 'بنك ٣٣٠ سؤالاً على ٦ أقسام — يُغذّي كل الأدوات التالية.'
    cta = 'افتح التحليل'
    to = `/manager/deep-analysis${props.clientQ}`
    icon = '🔬'
  } else if (!props.hasSwot) {
    title = 'حوّل التحليل إلى SWOT'
    desc = 'اضغط زر «استخرج من التحليل العميق» في SWOT — الفرص والتهديدات تأتيك جاهزة.'
    cta = 'افتح SWOT'
    to = `/swot${props.clientQ}`
    icon = '🧭'
  } else if (!props.hasKpis) {
    title = 'أنشئ مؤشرات KPIs'
    desc = 'حوّل الأهداف الاستراتيجية إلى قياسات دورية.'
    cta = 'أنشئ KPIs'
    to = `/kpis${props.clientQ}`
    icon = '📊'
  } else if (!props.hasInitiatives) {
    title = 'أضف مبادرات تنفيذية'
    desc = 'استورد استراتيجيات TOWS/Ansoff كمبادرات جاهزة.'
    cta = 'المبادرات'
    to = `/initiatives${props.clientQ}`
    icon = '💡'
  }

  return (
    <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
      <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="text-3xl" aria-hidden>{icon}</div>
          <div>
            <div className="text-xs font-semibold text-primary">الخطوة التالية</div>
            <div className="text-base font-bold">{title}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
        </div>
        <Link
          to={to}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
        >
          {cta}
        </Link>
      </CardContent>
    </Card>
  )
}

// ─── خريطة الإدارة → مسار التدقيق ──────────────────────────────────
function deptRoute(dept: import('@/lib/deptApi').DeptCode): string {
  switch (dept) {
    case 'HR':                return 'hr'
    case 'FINANCE':           return 'finance'
    case 'SALES':             return 'sales'
    case 'MARKETING':         return 'marketing'
    case 'OPERATIONS':        return 'operations'
    case 'IT':                return 'it'
    case 'CUSTOMER_SERVICE':  return 'cs'
    case 'SUPPORT':           return 'cs'
    case 'LOGISTICS':         return 'logistics'
    case 'QUALITY':           return 'quality'
    case 'PROJECTS':          return 'projects'
    case 'GOVERNANCE':        return 'governance'
    case 'COMPLIANCE':        return 'compliance'
  }
}
