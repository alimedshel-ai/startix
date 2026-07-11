import { useEffect, useMemo, useState } from 'react'
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
  listDepartments, type Department, type DeptCode,
} from '@/lib/deptApi'
import {
  getSWOT, listAllArtifacts, listInitiatives, listKPIs, listObjectives,
  type Artifact, type Initiative, type KPI, type Objective,
} from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'
import type { StrategyPath } from '@/types/user'

// ─── لوحة الإدارة — منظّمة بمراحل استراتيجيّة مع فلاتر ذكيّة ─────
// إعادة تصميم:
//   ١. Hero: هوية + صحّة
//   ٢. فلاتر ثلاثة: مسار المدير · نوع الخطّة · نطاق العمل
//   ٣. لوحة تعارضات — تكشف اختيارات متضاربة قبل ما تُنفَق الجهد
//   ٤. ٦ مراحل مرقّمة (تحليل بيئة → توليف → توجّه → مؤشرات → مبادرات → تنفيذ)
//      كل مرحلة بأيقونة موحّدة قابلة للطيّ، تعرض شارة تقدّم N/M
//   ٥. الخطوة التالية (بطاقة موحّدة)
//   ٦. إدارات الشركة (نظرة مقارَنة)

type PlanLevel = 'operational' | 'tactical' | 'strategic'
type WorkScope = 'small' | 'medium'

const ZONE_LABEL: Record<string, string> = {
  GREEN: 'آمنة', YELLOW: 'تحذير', ORANGE: 'خطر', RED: 'حرجة',
}

// ─── ٦ مراحل مع أدواتها الأساسيّة + ألوانها ──────────────────────
interface StageDef {
  key: 'env' | 'synth' | 'dir' | 'kpi' | 'init' | 'exec'
  order: number
  labelAr: string
  descAr: string
  icon: string
  color: { border: string; bg: string; text: string; ring: string; dot: string }
  tools: { icon: string; labelAr: string; to: (q: string, deptSlug?: string) => string; artifactType?: string; note?: string }[]
  // نوع الخطّة التي تحتاج هذه المرحلة (لفلترة PlanLevel).
  planLevels: PlanLevel[]
}

const STAGES: StageDef[] = [
  {
    key: 'env', order: 1,
    labelAr: 'تحليل البيئة',
    descAr: 'رصد الوضع الحالي — تدقيق + بيئة داخليّة + PESTEL + منافسين + سلسلة قيمة.',
    icon: '🌐',
    color: { border: 'border-sky-400', bg: 'bg-sky-50/70', text: 'text-sky-900', ring: 'ring-sky-400', dot: 'bg-sky-500' },
    tools: [
      { icon: '📋', labelAr: 'تدقيق الإدارة',      to: (q, s) => `/manager/${s}/audit${q}`, note: 'أساسي' },
      { icon: '🔬', labelAr: 'التحليل العميق',    to: (q) => `/manager/deep-analysis${q}`,      artifactType: 'DEPT_DEEP_FULL', note: 'أساسي' },
      { icon: '🌐', labelAr: 'PESTEL للإدارة',      to: (q) => `/manager/dept-pestel${q}`,        artifactType: 'PESTEL_MARKETING' /* fallback */ },
      { icon: '🎯', labelAr: 'البيئة الداخليّة',    to: (q) => `/internal-environment${q}`,       artifactType: 'INTERNAL_ENV' },
      { icon: '⚔️', labelAr: 'قوى بورتر الخمس',    to: (q) => `/porter${q}`,                     artifactType: 'PORTER' },
      { icon: '🔗', labelAr: 'سلسلة القيمة',       to: (q) => `/value-chain${q}`,                artifactType: 'VALUE_CHAIN' },
      { icon: '🔍', labelAr: 'المقارنة المرجعيّة', to: (q) => `/benchmarking${q}`,               artifactType: 'BENCHMARK' },
    ],
    planLevels: ['operational', 'tactical', 'strategic'],
  },
  {
    key: 'synth', order: 2,
    labelAr: 'التوليف',
    descAr: 'اجمع المخرجات في ٤ محاور SWOT ثم استخرج استراتيجيات TOWS.',
    icon: '🧭',
    color: { border: 'border-amber-400', bg: 'bg-amber-50/70', text: 'text-amber-900', ring: 'ring-amber-400', dot: 'bg-amber-500' },
    tools: [
      { icon: '🧭', labelAr: 'SWOT',              to: (q) => `/swot${q}`,          note: 'أساسي' },
      { icon: '🔄', labelAr: 'TOWS',              to: (q) => `/tows${q}`,          note: 'أساسي' },
      { icon: '📐', labelAr: 'فجوة الطموح',       to: (q) => `/ambition-gap${q}`,  artifactType: 'AMBITION_GAP' },
      { icon: '⚡', labelAr: 'التوترات الاستراتيجيّة', to: (q) => `/strategic-tensions${q}`, artifactType: 'STRATEGIC_TENSIONS' },
    ],
    planLevels: ['tactical', 'strategic'],
  },
  {
    key: 'dir', order: 3,
    labelAr: 'التوجّه والخيارات',
    descAr: 'حدّد الاتجاهات، ثبّت القرار، ورتّبه على الأفق (BMC + Ansoff + BCG + …).',
    icon: '🎯',
    color: { border: 'border-purple-400', bg: 'bg-purple-50/70', text: 'text-purple-900', ring: 'ring-purple-400', dot: 'bg-purple-500' },
    tools: [
      { icon: '🎯', labelAr: 'الاتجاهات',        to: (q) => `/directions${q}`, artifactType: 'DIRECTIONS', note: 'أساسي' },
      { icon: '✅', labelAr: 'القرار الاستراتيجي', to: (q) => `/choices${q}`,    artifactType: 'CHOICES',    note: 'أساسي' },
      { icon: '🧩', labelAr: 'نموذج الأعمال Canvas', to: (q) => `/bmc${q}`,     artifactType: 'BMC_MARKETING' },
      { icon: '📐', labelAr: 'مصفوفة أنسوف',      to: (q) => `/ansoff${q}`,    artifactType: 'ANSOFF_MARKETING' },
      { icon: '⭐', labelAr: 'مصفوفة BCG',        to: (q) => `/bcg${q}`,       artifactType: 'BCG' },
      { icon: '🔭', labelAr: 'الآفاق الثلاثة',    to: (q) => `/three-horizons${q}`, artifactType: 'THREE_HORIZONS_MARKETING' },
      { icon: '🔮', labelAr: 'السيناريوهات',      to: (q) => `/scenarios${q}` },
    ],
    planLevels: ['tactical', 'strategic'],
  },
  {
    key: 'kpi', order: 4,
    labelAr: 'المؤشرات والأهداف',
    descAr: 'حوّل الاتّجاه إلى أهداف SMART + مؤشرات قياس + خطط سنوية.',
    icon: '📊',
    color: { border: 'border-emerald-400', bg: 'bg-emerald-50/70', text: 'text-emerald-900', ring: 'ring-emerald-400', dot: 'bg-emerald-500' },
    tools: [
      { icon: '📊', labelAr: 'مؤشرات KPIs',       to: (q) => `/kpis${q}`,        note: 'أساسي' },
      { icon: '🎯', labelAr: 'الأهداف الاستراتيجيّة', to: (q) => `/objectives${q}` },
      { icon: '🏆', labelAr: 'OKRs',              to: (q) => `/okrs${q}`,        artifactType: 'OGSM' },
      { icon: '⚖️', labelAr: 'Balanced Scorecard', to: (q) => `/bsc${q}`,        artifactType: 'BSC_MARKETING' },
      { icon: '✍️', labelAr: 'إدخالات KPIs',       to: (q) => `/kpi-entries${q}` },
      { icon: '🗓️', labelAr: 'الخطة السنويّة',     to: (q) => `/annual-plan${q}`, artifactType: 'ANNUAL_PLAN' },
    ],
    planLevels: ['operational', 'tactical', 'strategic'],
  },
  {
    key: 'init', order: 5,
    labelAr: 'المبادرات والمخاطر',
    descAr: 'حوّل الأهداف إلى مبادرات ملموسة، ورتّبها بالأولويّة، وارصد مخاطرها.',
    icon: '💡',
    color: { border: 'border-orange-400', bg: 'bg-orange-50/70', text: 'text-orange-900', ring: 'ring-orange-400', dot: 'bg-orange-500' },
    tools: [
      { icon: '💡', labelAr: 'المبادرات',          to: (q) => `/initiatives${q}`, note: 'أساسي' },
      { icon: '⚡', labelAr: 'مصفوفة الأولويّة',   to: (q) => `/priority-matrix${q}`, artifactType: 'PRIORITY_MATRIX' },
      { icon: '🎯', labelAr: 'مصفوفة أيزنهاور',    to: (q) => `/eisenhower${q}`,   artifactType: 'EISENHOWER' },
      { icon: '⚠️', labelAr: 'خريطة المخاطر',      to: (q) => `/risk-map${q}`,     artifactType: 'RISK_REGISTER' },
      { icon: '👥', labelAr: 'مصفوفة RACI',        to: (q) => `/raci${q}`,         artifactType: 'RACI' },
    ],
    planLevels: ['operational', 'tactical'],
  },
  {
    key: 'exec', order: 6,
    labelAr: 'التنفيذ والمتابعة',
    descAr: 'حوّل المبادرات لمشاريع بتواريخ، رتّبها على جانت، وتابع مالياً.',
    icon: '🚀',
    color: { border: 'border-rose-400', bg: 'bg-rose-50/70', text: 'text-rose-900', ring: 'ring-rose-400', dot: 'bg-rose-500' },
    tools: [
      { icon: '📁', labelAr: 'المشاريع',           to: (q) => `/projects${q}`, note: 'أساسي' },
      { icon: '📅', labelAr: 'مخطّط جانت',          to: (q) => `/gantt-chart${q}` },
      { icon: '✓',  labelAr: 'المهام',              to: (q) => `/tasks${q}` },
      { icon: '📐', labelAr: 'التحليل المالي',     to: (q) => `/financial-analysis${q}` },
      { icon: '🗺️', labelAr: 'الخطّة الاستراتيجيّة', to: (q) => `/manager/strategic-plan${q}` },
    ],
    planLevels: ['operational'],
  },
]

// أيّ مسار استراتيجي يشمل أيّ مرحلة (للفلترة)
function stagesInPath(path: StrategyPath | null): Set<StageDef['key']> {
  if (!path || path === 'LONG') return new Set(STAGES.map((s) => s.key))
  if (path === 'MEDIUM') return new Set<StageDef['key']>(['env', 'synth', 'dir', 'init', 'exec'])
  return new Set<StageDef['key']>(['env', 'synth', 'init', 'exec'])   // QUICK
}

export function DeptDashboardPage() {
  const scope = useCompany()
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const strategyPath = user?.strategyPath ?? null

  const [departments, setDepartments] = useState<Department[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [kpis, setKpis] = useState<KPI[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [hasSwotState, setHasSwotState] = useState(false)
  const [loading, setLoading] = useState(true)

  // فلاتر
  const [planLevel, setPlanLevel] = useState<PlanLevel | null>(null)
  const [workScope, setWorkScope] = useState<WorkScope | null>(null)
  const [expandedStages, setExpandedStages] = useState<Set<StageDef['key']>>(new Set())

  useEffect(() => {
    if (!scope.company) return
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const cid = scope.company!.id
        const [deps, arts, inits, ks, obs, swot] = await Promise.allSettled([
          listDepartments(cid),
          listAllArtifacts(cid),
          listInitiatives(cid),
          listKPIs(cid),
          listObjectives(cid),
          getSWOT(cid).catch(() => null),
        ])
        if (!alive) return
        if (deps.status === 'fulfilled') setDepartments(deps.value)
        if (arts.status === 'fulfilled') setArtifacts(arts.value)
        if (inits.status === 'fulfilled') setInitiatives(inits.value)
        if (ks.status === 'fulfilled') setKpis(ks.value)
        if (obs.status === 'fulfilled') setObjectives(obs.value)
        if (swot.status === 'fulfilled' && swot.value) {
          const s = swot.value
          const filled = (s.strengths?.length ?? 0) + (s.weaknesses?.length ?? 0)
            + (s.opportunities?.length ?? 0) + (s.threats?.length ?? 0)
          setHasSwotState(filled > 0)
        }
      } catch (err) {
        toast.error(apiErrorMessage(err, 'تعذّر تحميل اللوحة'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [scope.company])

  const artifactTypes = useMemo(() => new Set(artifacts.map((a) => a.type)), [artifacts])
  // نطاق العمل الفعلي — يُشتقّ من حجم الشركة إن لم يختره المدير.
  const effectiveScope: WorkScope = workScope ?? (
    scope.company?.size === 'MICRO' || scope.company?.size === 'SMALL' ? 'small' : 'medium'
  )
  const pathStages = stagesInPath(strategyPath)

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
  const myDept = specialty ? departments.find((d) => d.type === specialty) : null
  const myScore = myDept?.auditData?.healthPct ?? myDept?.auditScore ?? null
  const myZone = (myDept?.auditData?.dangerZone as string | undefined) ?? null
  const deptSlug = specialty ? deptRoute(specialty) : undefined

  // ─── حساب اكتمال المرحلة ─────────────────────────────
  function stageCompletion(stage: StageDef): { done: number; total: number; pct: number } {
    let done = 0
    for (const t of stage.tools) {
      if (stage.key === 'env' && t.icon === '📋' && !!myDept) { done++; continue }
      if (stage.key === 'synth' && t.icon === '🧭' && hasSwotState) { done++; continue }
      if (stage.key === 'kpi' && t.icon === '📊' && kpis.length > 0) { done++; continue }
      if (stage.key === 'kpi' && t.icon === '🎯' && objectives.length > 0) { done++; continue }
      if (stage.key === 'init' && t.icon === '💡' && initiatives.length > 0) { done++; continue }
      if (t.artifactType && artifactTypes.has(t.artifactType as ReturnType<typeof String>)) done++
      // artifact types with generic fallback (checking prefix)
      else if (t.artifactType) {
        const prefix = t.artifactType.split('_')[0]
        if ([...artifactTypes].some((a) => a.startsWith(prefix))) done++
      }
    }
    return { done, total: stage.tools.length, pct: Math.round((done / stage.tools.length) * 100) }
  }

  // ─── لوحة التعارضات ─────────────────────────────
  const conflicts: { icon: string; title: string; hint: string; severity: 'warn' | 'critical' }[] = []
  if (strategyPath === 'QUICK' && planLevel === 'strategic') {
    conflicts.push({ icon: '⚠️', title: 'مسار سريع (٣ شهر) + خطّة استراتيجيّة (١+ سنة) — تعارض واضح', hint: 'إمّا اختر خطّة تشغيليّة/تكتيكيّة، أو غيّر مسارك إلى طويل.', severity: 'critical' })
  }
  if (effectiveScope === 'small' && planLevel === 'strategic') {
    conflicts.push({ icon: '⚡', title: 'نطاق صغير + خطّة استراتيجيّة — يحتاج تكيّف', hint: 'الشركات الصغيرة عادة تتحرّك عبر خطط تكتيكيّة ٦-١٢ شهر — قلّل عمق الخطّة أو اقصر أفقها.', severity: 'warn' })
  }
  if (!myDept && planLevel) {
    conflicts.push({ icon: '📋', title: 'بلا تدقيق أساسي — أيّ خطّة ستكون بلا سياق حقيقي', hint: 'ابدأ التدقيق قبل اختيار مستوى الخطّة.', severity: 'critical' })
  }
  if (strategyPath === 'LONG' && effectiveScope === 'small' && (myScore ?? 0) < 50) {
    conflicts.push({ icon: '🚨', title: 'مسار طويل + نطاق صغير + صحّة أقلّ من ٥٠٪', hint: 'ابدأ بمسار سريع لاستعادة الاستقرار قبل التخطيط للتميّز.', severity: 'critical' })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="لوحة الإدارة"
        description={specialty
          ? `${DEPT_ICON[specialty]} إدارة ${DEPT_LABEL[specialty]} — ${company.name}`
          : company.name}
      />

      {/* ─── Hero: صحة + هوية ────────────────────────────────── */}
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
              {' · '}
              <span className="font-medium">
                {company.size === 'MICRO' ? 'متناهية الصغر' : company.size === 'SMALL' ? 'صغيرة' : company.size === 'MEDIUM' ? 'متوسطة' : 'كبيرة'}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-4">
            <OpexStat label="عدد الفريق" value={opex.team} icon="👥" />
            <OpexStat label="الميزانية" value={opex.budget} icon="💰" suffix="ر.س" />
            <OpexStat label="المستهدف" value={opex.target} icon="🎯" suffix="ر.س" />
            <OpexStat label="متوسط الراتب" value={opex.avgSalary} icon="💵" suffix="/شهر" />
          </CardContent>
        </Card>

        <Card className={`overflow-hidden ${myScore != null ? healthTint(myScore) : ''}`}>
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
              {myDept ? 'من آخر تدقيق أُجري.' : '⚠️ لم يبدأ التدقيق بعد.'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── فلاتر ذكيّة ───────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">🎛️ اختر ما يناسبك — الأدوات تُبرز حسب اختيارك</CardTitle>
          <CardDescription className="text-xs">
            يمكنك تغيير الفلاتر لتخصيص ما يظهر — الأدوات الأساسيّة تبقى ظاهرة دائماً.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <FilterGroup
            label="مسارك (يحدّد الأفق الزمني)"
            hint={strategyPath === 'QUICK' ? '⚡ سريع ٠-٣ شهر' : strategyPath === 'MEDIUM' ? '🎯 متوسط ٣-١٢ شهر' : strategyPath === 'LONG' ? '🔭 طويل ١٢-٣٦+ شهر' : 'لم يُختَر — يمكن ضبطه من /settings/path'}
          />
          <FilterGroup label="نوع الخطّة (يحدّد عمق الأدوات)">
            <FilterChip active={planLevel === 'operational'} onClick={() => setPlanLevel(planLevel === 'operational' ? null : 'operational')} icon="⚙️" color="emerald">
              تشغيليّة (يوم/شهر)
            </FilterChip>
            <FilterChip active={planLevel === 'tactical'} onClick={() => setPlanLevel(planLevel === 'tactical' ? null : 'tactical')} icon="🎯" color="sky">
              تكتيكيّة (٣-١٢ شهر)
            </FilterChip>
            <FilterChip active={planLevel === 'strategic'} onClick={() => setPlanLevel(planLevel === 'strategic' ? null : 'strategic')} icon="🔭" color="purple">
              استراتيجيّة (١+ سنة)
            </FilterChip>
          </FilterGroup>
          <FilterGroup label="نطاق العمل" hint={workScope === null ? `الافتراضي: ${effectiveScope === 'small' ? 'صغير' : 'متوسط'} (من حجم الشركة)` : undefined}>
            <FilterChip active={workScope === 'small'} onClick={() => setWorkScope(workScope === 'small' ? null : 'small')} icon="🏭" color="amber">
              صغير (فريق ≤ ٥)
            </FilterChip>
            <FilterChip active={workScope === 'medium'} onClick={() => setWorkScope(workScope === 'medium' ? null : 'medium')} icon="🏢" color="sky">
              متوسّط (فريق &gt; ٥)
            </FilterChip>
          </FilterGroup>
        </CardContent>
      </Card>

      {/* ─── لوحة التعارضات ───────────────────────────────── */}
      {conflicts.length > 0 && (
        <Card className="border-2 border-amber-400 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">⚠️ لدينا تعارضات في خياراتك — راجعها</CardTitle>
            <CardDescription className="text-xs">
              هذه الملاحظات تحميك من هدر الجهد — عالجها أوّلاً.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {conflicts.map((c, i) => (
              <div key={i} className={`rounded-lg border p-3 text-xs ${
                c.severity === 'critical' ? 'border-rose-400 bg-rose-50' : 'border-amber-400 bg-amber-50'
              }`}>
                <div className={`flex items-center gap-2 font-bold ${c.severity === 'critical' ? 'text-rose-800' : 'text-amber-800'}`}>
                  <span>{c.icon}</span>
                  <span>{c.title}</span>
                </div>
                <div className="mt-1 leading-relaxed text-muted-foreground">{c.hint}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ─── ٦ مراحل — مجموعة بأيقونة موحّدة قابلة للطيّ ───── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-semibold text-muted-foreground">🗺️ مراحل التخطيط الست — بالترتيب</h2>
          <div className="flex gap-2 text-[10px]">
            <button
              type="button"
              onClick={() => setExpandedStages(new Set(STAGES.map((s) => s.key)))}
              className="rounded-md border bg-card px-2 py-0.5 hover:bg-muted"
            >
              فتح الكلّ
            </button>
            <button
              type="button"
              onClick={() => setExpandedStages(new Set())}
              className="rounded-md border bg-card px-2 py-0.5 hover:bg-muted"
            >
              طيّ الكلّ
            </button>
          </div>
        </div>

        {STAGES.map((s) => {
          const comp = stageCompletion(s)
          const inPath = pathStages.has(s.key)
          const inPlanLevel = !planLevel || s.planLevels.includes(planLevel)
          const dimmed = !inPath || !inPlanLevel
          const expanded = expandedStages.has(s.key)
          return (
            <div key={s.key} className={`rounded-xl border-2 transition ${dimmed ? 'opacity-60 hover:opacity-100' : ''} ${
              comp.pct === 100 ? 'border-emerald-400 bg-emerald-50/40' : `${s.color.border} ${s.color.bg}`
            }`}>
              <button
                type="button"
                onClick={() => setExpandedStages((prev) => {
                  const next = new Set(prev)
                  if (next.has(s.key)) next.delete(s.key)
                  else next.add(s.key)
                  return next
                })}
                className="flex w-full items-center gap-3 p-4 text-right"
              >
                <span className={`inline-flex size-12 items-center justify-center rounded-full text-2xl text-white shadow-sm ${
                  comp.pct === 100 ? 'bg-emerald-500' : s.color.dot
                }`}>
                  {comp.pct === 100 ? '✓' : s.icon}
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-base font-bold ${s.color.text}`}>
                      المرحلة {s.order}: {s.labelAr}
                    </span>
                    <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] font-medium tabular-nums">
                      {comp.done}/{comp.total} ({comp.pct}٪)
                    </span>
                    {comp.pct === 100 && (
                      <span className="rounded-full border border-emerald-400 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">✓ مكتَملة</span>
                    )}
                    {!inPath && (
                      <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">خارج مسارك</span>
                    )}
                    {planLevel && !inPlanLevel && (
                      <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">لا يخصّ خطّتك</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{s.descAr}</p>
                  <div className="mt-1.5"><Progress value={comp.pct} className="h-1.5" /></div>
                </div>
                <span className={`text-2xl leading-none transition ${expanded ? 'rotate-180' : ''}`}>⌄</span>
              </button>

              {expanded && (
                <div className="border-t bg-card/40 p-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {s.tools.map((t) => {
                      // اكتمال أداة فرديّة (تقريبي)
                      const isDone = !!(
                        (t.artifactType && artifactTypes.has(t.artifactType as ReturnType<typeof String>)) ||
                        (t.icon === '📋' && myDept) ||
                        (t.icon === '🧭' && s.key === 'synth' && hasSwotState) ||
                        (t.icon === '📊' && s.key === 'kpi' && kpis.length > 0) ||
                        (t.icon === '💡' && s.key === 'init' && initiatives.length > 0)
                      )
                      const to = t.to(clientQ, deptSlug)
                      return (
                        <Link
                          key={t.labelAr}
                          to={to}
                          className={`flex items-center gap-2 rounded-lg border p-2.5 transition hover:-translate-y-0.5 hover:shadow ${
                            isDone ? 'border-emerald-300 bg-emerald-50/50' : 'bg-card'
                          }`}
                        >
                          <span className="text-lg">{t.icon}</span>
                          <span className="flex-1 text-sm">{t.labelAr}</span>
                          {t.note === 'أساسي' && !isDone && (
                            <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">⭐ أساسي</span>
                          )}
                          {isDone && <span className="text-emerald-600">✓</span>}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ─── إدارات الشركة (نظرة مقارَنة) ───────────────── */}
      {departments.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">🏢 إدارات الشركة — مقارنة</h2>
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
                  <Card className={`transition hover:-translate-y-0.5 hover:shadow-md ${healthTint(score)}`}>
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

      {loading && <p className="text-center text-xs text-muted-foreground">جاري تحميل البيانات…</p>}
    </div>
  )
}

// ─── مكوّنات فرعية ────────────────────────────────────────────────

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

function FilterGroup({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-foreground">{label}</span>
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
      {children && <div className="flex flex-wrap gap-1.5">{children}</div>}
    </div>
  )
}

function FilterChip({
  active, onClick, icon, color, children,
}: {
  active: boolean
  onClick: () => void
  icon: string
  color: 'emerald' | 'sky' | 'purple' | 'amber'
  children: React.ReactNode
}) {
  const colors: Record<string, string> = {
    emerald: active ? 'border-emerald-500 bg-emerald-100 text-emerald-900 ring-2 ring-emerald-300' : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    sky:     active ? 'border-sky-500 bg-sky-100 text-sky-900 ring-2 ring-sky-300' : 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100',
    purple:  active ? 'border-purple-500 bg-purple-100 text-purple-900 ring-2 ring-purple-300' : 'border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100',
    amber:   active ? 'border-amber-500 bg-amber-100 text-amber-900 ring-2 ring-amber-300' : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-medium transition ${colors[color]}`}
    >
      <span>{icon}</span>
      <span>{children}</span>
      {active && <span>✓</span>}
    </button>
  )
}

function healthTint(score: number): string {
  if (score >= 80) return 'border-emerald-300 bg-emerald-50/40'
  if (score >= 60) return 'border-sky-300 bg-sky-50/40'
  if (score >= 40) return 'border-amber-300 bg-amber-50/40'
  return 'border-rose-300 bg-rose-50/40'
}

// ─── خريطة الإدارة → مسار التدقيق ──────────────────────────────
function deptRoute(dept: DeptCode): string {
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
