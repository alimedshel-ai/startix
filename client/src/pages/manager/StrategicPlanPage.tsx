import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NextActionCard } from '@/components/manager/NextActionCard'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_ICON, DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { getProOverview, type OverviewClient } from '@/lib/proApi'
import {
  listAllArtifacts, listInitiatives, listKPIs, listObjectives, listProjects,
  type ArtifactType,
} from '@/lib/strategicApi'
import {
  PATH_ACCENT_STYLES,
  pickStrategicPath,
  specialtyKPIHints,
  type StrategicPath,
  type StrategicPathKey,
} from '@/lib/strategicPath'
import { useAuthStore } from '@/store/authStore'

// ─── الخطة الاستراتيجية — يختار المدير نوعها (طوارئ/تأسيس/نمو/تميز) ───
// السلوك:
//   • المنصّة تُوصي بمسار افتراضي بناءً على صحّة الإدارة (recommendedPath).
//   • المدير يستطيع تعديل الاختيار — يظهر لأي مسار سبب اختياره لكل حالة.
//   • تحت المسار المختار: أولوياته + مبادراته + KPIs + مخاطر + خارطة زمنيّة
//     + قائمة الأدوات المستخدمة داخل المنصّة لدعم هذا المسار.

// ─── أدوات موصى بها لكل نوع خطة ─────────────────────────────────
// تُوجّه المدير للأداة الصحيحة داخل المنصّة بحسب طبيعة الخطة.
interface RecommendedTool {
  icon: string
  labelAr: string
  to: string
  whyAr: string
}

function toolsForPath(key: StrategicPathKey, companyId: string): RecommendedTool[] {
  const q = `?client=${companyId}`
  const common: RecommendedTool[] = [
    { icon: '💡', labelAr: 'المبادرات', to: `/initiatives${q}`, whyAr: 'كل ما تحتاج تنفيذه — يُحوَّل إلى خطوات تنفيذ' },
    { icon: '📊', labelAr: 'مؤشرات الأداء (KPIs)', to: `/kpis${q}`, whyAr: 'قياس التقدّم بأرقام محدَّدة' },
  ]
  if (key === 'EMERGENCY') {
    return [
      { icon: '⚠️', labelAr: 'خريطة المخاطر', to: `/risk-map${q}`, whyAr: 'حصر المخاطر الحرجة قبل أي شيء آخر' },
      { icon: '🎯', labelAr: 'مصفوفة أيزنهاور', to: `/eisenhower${q}`, whyAr: 'فرز المهام: افعل الآن / فوّض / احذف' },
      { icon: '👥', labelAr: 'مصفوفة RACI', to: `/raci${q}`, whyAr: 'من مسؤول عن كل تحرّك عاجل — بلا فراغ' },
      { icon: '📅', labelAr: 'مخطّط جانت', to: `/gantt-chart${q}`, whyAr: 'خطّ زمنيّ للأسابيع الـ١٢' },
      ...common,
      { icon: '✍️', labelAr: 'إدخالات KPIs', to: `/kpi-entries${q}`, whyAr: 'قياس أسبوعي لتتبّع التعافي' },
    ]
  }
  if (key === 'FOUNDATION') {
    return [
      { icon: '🎯', labelAr: 'الأهداف الاستراتيجية', to: `/objectives${q}`, whyAr: 'صياغة أهداف SMART أساسيّة' },
      { icon: '⚖️', labelAr: 'Balanced Scorecard', to: `/bsc${q}`, whyAr: 'أساس القياس المتوازن ٤ أبعاد' },
      { icon: '👥', labelAr: 'مصفوفة RACI', to: `/raci${q}`, whyAr: 'وضوح الأدوار — أساس السقف التنظيمي' },
      { icon: '🎯', labelAr: 'الأولوية (أثر × جهد)', to: `/priority-matrix${q}`, whyAr: 'ترتيب المبادرات لبناء الأساسات' },
      ...common,
      { icon: '📁', labelAr: 'متابعة المبادرات', to: `/projects${q}`, whyAr: 'تحويل التأسيس إلى خطوات تنفيذ بمدد ٦ أشهر' },
    ]
  }
  if (key === 'GROWTH') {
    return [
      { icon: '🧭', labelAr: 'التوجّه الاستراتيجي', to: `/directions${q}`, whyAr: 'اختيار اتجاه للنموّ' },
      { icon: '📐', labelAr: 'مصفوفة أنسوف', to: `/ansoff${q}`, whyAr: 'خدمة × جمهور: أين تنمو؟' },
      { icon: '🧩', labelAr: 'نموذج الأعمال Canvas', to: `/bmc${q}`, whyAr: 'إعادة تصميم نموذج عملك' },
      { icon: '🔭', labelAr: 'الآفاق الثلاثة', to: `/three-horizons${q}`, whyAr: 'توزيع المبادرات: نمو اليوم + الغد + المستقبل' },
      { icon: '🧩', labelAr: 'إطار OGSM', to: `/ogsm${q}`, whyAr: 'أهداف/إستراتيجيات/مقاييس متدرّجة' },
      ...common,
      { icon: '🗓️', labelAr: 'الخطة السنويّة', to: `/annual-plan${q}`, whyAr: 'تحويل النموّ إلى خطة سنة كاملة' },
    ]
  }
  if (key === 'EXCELLENCE') {
    return [
      { icon: '🔭', labelAr: 'الآفاق الثلاثة', to: `/three-horizons${q}`, whyAr: 'تركيز على H٣ — رهانات المستقبل' },
      { icon: '🔮', labelAr: 'السيناريوهات', to: `/scenarios${q}`, whyAr: 'استكشاف مسارات متعدّدة للتميّز' },
      { icon: '🔍', labelAr: 'المقارنة المرجعيّة', to: `/benchmarking${q}`, whyAr: 'قياس نضج إدارتك ضد الأفضل' },
      { icon: '⚖️', labelAr: 'Balanced Scorecard', to: `/bsc${q}`, whyAr: 'قياس التميّز في الأبعاد الأربعة' },
      { icon: '📐', labelAr: 'التحليل المالي المتقدّم', to: `/financial-analysis${q}`, whyAr: 'Dupont + Monte Carlo لقيادة القرار' },
      { icon: '🧪', labelAr: 'مختبر المحاكاة', to: `/ai/simulation${q}`, whyAr: 'اختبار سيناريوهات ابتكار' },
      ...common,
    ]
  }
  // DEFAULT
  return [
    { icon: '📋', labelAr: 'التدقيق الأساسي', to: `/manager/dept-deep${q}`, whyAr: 'التقييم السريع لبدء التخطيط' },
    { icon: '🔬', labelAr: 'التحليل العميق', to: `/manager/deep-analysis${q}`, whyAr: 'تحليل ٦٠ سؤالاً لتخصّصك' },
    { icon: '🌐', labelAr: 'PESTEL للإدارة', to: `/manager/dept-pestel${q}`, whyAr: 'مسح البيئة الخارجيّة' },
  ]
}

// ─── حالة استخدام الأداة ────────────────────────────────────────
// لكل أداة نعرف طريقة اكتمالها: artifact ثابت، artifact مقيّد بالإدارة،
// أو دالة قوائم (Objectives/KPIs/Initiatives/Projects).
type UsageCheck =
  | { kind: 'artifact'; types: ArtifactType[] }
  | { kind: 'deptArtifact'; prefix: string; fallback?: ArtifactType }
  | { kind: 'list'; source: 'objectives' | 'kpis' | 'initiatives' | 'projects' }
  | { kind: 'derived'; source: 'projects' /* Gantt يعتمد على المشاريع */ }
  | { kind: 'external' /* لا artifact — لا نعرض حالة */ }

// خريطة path prefix → check. يجب أن تُطابق roads في toolsForPath.
const TOOL_USAGE: Record<string, UsageCheck> = {
  '/objectives':      { kind: 'list', source: 'objectives' },
  '/okrs':            { kind: 'list', source: 'objectives' },
  '/ogsm':            { kind: 'artifact', types: ['OGSM'] },
  '/kpis':            { kind: 'list', source: 'kpis' },
  '/kpi-entries':     { kind: 'list', source: 'kpis' /* الإدخالات تعتمد على وجود KPI */ },
  '/annual-plan':     { kind: 'artifact', types: ['ANNUAL_PLAN'] },
  '/bsc':             { kind: 'deptArtifact', prefix: 'BSC_', fallback: 'BSC' },
  '/initiatives':     { kind: 'list', source: 'initiatives' },
  '/priority-matrix': { kind: 'artifact', types: ['PRIORITY_MATRIX'] },
  '/eisenhower':      { kind: 'artifact', types: ['EISENHOWER'] },
  '/risk-map':        { kind: 'artifact', types: ['RISK_REGISTER'] },
  '/raci':            { kind: 'artifact', types: ['RACI'] },
  '/projects':        { kind: 'list', source: 'projects' },
  '/gantt-chart':     { kind: 'derived', source: 'projects' },
  '/tasks':           { kind: 'derived', source: 'projects' },
  '/directions':      { kind: 'artifact', types: ['DIRECTIONS'] },
  '/choices':         { kind: 'artifact', types: ['CHOICES'] },
  '/ansoff':          { kind: 'deptArtifact', prefix: 'ANSOFF_', fallback: 'ANSOFF' },
  '/bcg':             { kind: 'artifact', types: ['BCG'] },
  '/bmc':             { kind: 'deptArtifact', prefix: 'BMC_', fallback: 'BMC' },
  '/three-horizons':  { kind: 'deptArtifact', prefix: 'THREE_HORIZONS_', fallback: 'THREE_HORIZONS' },
  '/scenarios':       { kind: 'external' },
  '/benchmarking':    { kind: 'deptArtifact', prefix: 'BENCHMARK_', fallback: 'BENCHMARK' },
  '/financial-analysis': { kind: 'external' },
  '/ai/simulation':   { kind: 'external' },
  '/manager/dept-deep':     { kind: 'artifact', types: ['DEPT_DEEP_ANSWERS'] },
  '/manager/deep-analysis': { kind: 'artifact', types: ['DEPT_DEEP_FULL', 'DEPT_DEEP_ANSWERS'] },
  '/manager/dept-pestel':   { kind: 'deptArtifact', prefix: 'PESTEL_', fallback: 'PESTEL' },
}

interface ToolUsageData {
  artifactTypes: Set<string>
  objectivesCount: number
  kpisCount: number
  initiativesCount: number
  projectsCount: number
}

function toolStatus(to: string, dept: DeptCode | null, data: ToolUsageData): { done: boolean; detail: string | null; hideStatus: boolean } {
  const prefix = to.split('?')[0]
  const check = TOOL_USAGE[prefix]
  if (!check) return { done: false, detail: null, hideStatus: true }
  if (check.kind === 'external') return { done: false, detail: null, hideStatus: true }
  if (check.kind === 'artifact') {
    const done = check.types.some((t) => data.artifactTypes.has(t))
    return { done, detail: null, hideStatus: false }
  }
  if (check.kind === 'deptArtifact') {
    const primary = dept ? `${check.prefix}${dept}` : null
    const done = (primary && data.artifactTypes.has(primary)) || (check.fallback ? data.artifactTypes.has(check.fallback) : false)
    return { done, detail: null, hideStatus: false }
  }
  if (check.kind === 'list') {
    const count = check.source === 'objectives' ? data.objectivesCount
      : check.source === 'kpis' ? data.kpisCount
      : check.source === 'initiatives' ? data.initiativesCount
      : data.projectsCount
    const done = count > 0
    const suffix = check.source === 'objectives' ? 'هدف'
      : check.source === 'kpis' ? 'مؤشّر'
      : check.source === 'initiatives' ? 'مبادرة'
      : 'مشروع'
    return { done, detail: done ? `${count} ${suffix}` : null, hideStatus: false }
  }
  if (check.kind === 'derived') {
    // Gantt/Tasks تعتمد على وجود مشاريع.
    const done = data.projectsCount > 0
    return { done, detail: done ? `${data.projectsCount} مشروع` : null, hideStatus: false }
  }
  return { done: false, detail: null, hideStatus: true }
}

// ─── سبب اختيار كل مسار ─────────────────────────────────────────
function pathReason(key: StrategicPathKey): string {
  switch (key) {
    case 'EMERGENCY':  return 'صحّة الإدارة أقل من ٤٠٪ أو منطقة خطر حمراء — تحتاج تدخّلاً فورياً قبل التخطيط طويل الأمد.'
    case 'FOUNDATION': return 'صحّة الإدارة بين ٤٠-٥٩٪ — الإجراءات ضعيفة وتحتاج بناء أساسات (SOPs + قياس + أدوار).'
    case 'GROWTH':     return 'صحّة الإدارة بين ٦٠-٧٩٪ — الأساسات موجودة، والفرصة الآن للنموّ وتوسّع الأثر.'
    case 'EXCELLENCE': return 'صحّة الإدارة ٨٠٪+ — إدارتك ناضجة، والوقت مناسب لبناء قيادة قطاعيّة وابتكار.'
    default:           return 'لم يتمّ تدقيق الإدارة بعد — ابدأ بالتشخيص لاختيار المسار الصحيح.'
  }
}

// جميع المسارات الممكن اختيارها (ما عدا DEFAULT).
const SELECTABLE_KEYS: StrategicPathKey[] = ['EMERGENCY', 'FOUNDATION', 'GROWTH', 'EXCELLENCE']

// نُنشئ نسخة من كل مسار للعرض في المُبدّل.
function allPaths(): Record<StrategicPathKey, StrategicPath> {
  return {
    EMERGENCY:  pickStrategicPath({ healthPct: 20, dangerZone: 'RED', hasAnyAudit: true }),
    FOUNDATION: pickStrategicPath({ healthPct: 50, dangerZone: 'ORANGE', hasAnyAudit: true }),
    GROWTH:     pickStrategicPath({ healthPct: 70, dangerZone: 'YELLOW', hasAnyAudit: true }),
    EXCELLENCE: pickStrategicPath({ healthPct: 85, dangerZone: 'GREEN', hasAnyAudit: true }),
    DEFAULT:    pickStrategicPath({ healthPct: null, dangerZone: null, hasAnyAudit: false }),
  }
}

export function StrategicPlanPage() {
  const user = useAuthStore((s) => s.user)
  const scope = useClientScopedCompany()
  const [client, setClient] = useState<OverviewClient | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // اختيار المدير — يُهيّأ لأول مرّة من التوصية.
  const [selectedKey, setSelectedKey] = useState<StrategicPathKey | null>(null)
  // بيانات استخدام الأدوات — تُقرأ مرة واحدة للعميل النشط.
  const [usageData, setUsageData] = useState<ToolUsageData>({
    artifactTypes: new Set(),
    objectivesCount: 0, kpisCount: 0, initiativesCount: 0, projectsCount: 0,
  })
  const [usageLoading, setUsageLoading] = useState(false)

  useEffect(() => {
    if (!scope.companyId) return
    let alive = true
    setLoading(true)
    setError(null)
    getProOverview()
      .then((res) => {
        if (!alive) return
        const found = res.clients.find((c) => c.companyId === scope.companyId) ?? null
        setClient(found)
        if (!found) setError('لم نجد هذا العميل في قائمتك.')
      })
      .catch((err) => {
        if (!alive) return
        setError(apiErrorMessage(err, 'تعذّر تحميل الخطة'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [scope.companyId])

  // قراءة بيانات استخدام الأدوات للعميل النشط.
  useEffect(() => {
    if (!scope.companyId) return
    let alive = true
    setUsageLoading(true)
    Promise.allSettled([
      listAllArtifacts(scope.companyId),
      listObjectives(scope.companyId),
      listKPIs(scope.companyId),
      listInitiatives(scope.companyId),
      listProjects(scope.companyId),
    ]).then(([arts, objs, kpis, inits, projs]) => {
      if (!alive) return
      setUsageData({
        artifactTypes: new Set(arts.status === 'fulfilled' ? arts.value.map((a) => a.type) : []),
        objectivesCount: objs.status === 'fulfilled' ? objs.value.length : 0,
        kpisCount:       kpis.status === 'fulfilled' ? kpis.value.length : 0,
        initiativesCount: inits.status === 'fulfilled' ? inits.value.length : 0,
        projectsCount:    projs.status === 'fulfilled' ? projs.value.length : 0,
      })
    }).finally(() => {
      if (alive) setUsageLoading(false)
    })
    return () => { alive = false }
  }, [scope.companyId])

  const paths = useMemo(() => allPaths(), [])

  const recommendedPath = useMemo<StrategicPath | null>(() => {
    if (!client) return null
    return pickStrategicPath({
      healthPct: client.healthPct,
      dangerZone: client.dangerZone,
      hasAnyAudit: client.hasAnyAudit,
    })
  }, [client])

  // عند تحميل العميل لأول مرة — نُطابق اختيار المدير مع التوصية.
  useEffect(() => {
    if (recommendedPath && !selectedKey) setSelectedKey(recommendedPath.key)
  }, [recommendedPath, selectedKey])

  if (scope.loading || loading) {
    return <LoadingSpinner fullPage label="جاري إعداد الخطة الاستراتيجية…" />
  }

  if (error || !client) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="الخطة الاستراتيجية" />
        <EmptyState
          title={error ?? 'اختر عميلاً أوّلاً'}
          description="افتح لوحة العميل من «عملائي» ثم اختر «الخطة الاستراتيجية»."
          action={
            <Link to="/manager/clients" className="rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-accent">
              الذهاب لعملائي
            </Link>
          }
        />
      </div>
    )
  }

  const path = selectedKey ? paths[selectedKey] : recommendedPath!
  const style = PATH_ACCENT_STYLES[path.accent]
  const specialty = user?.specialtyDeptType ?? client.specialty
  const specialtyLabel = specialty ? DEPT_LABEL[specialty] : 'الإدارة'
  const kpiHints = specialtyKPIHints(specialty)
  const tools = toolsForPath(path.key, client.companyId)
  const isRecommended = recommendedPath?.key === path.key

  // ─── حساب الخطوة التالية — أوّل أداة غير مُستخدَمة في المسار المختار
  const nextUnusedTool: RecommendedTool | null = (() => {
    if (usageLoading) return null
    for (const t of tools) {
      const st = toolStatus(t.to, specialty ?? null, usageData)
      if (!st.done && !st.hideStatus) return t
    }
    return null
  })()
  const totalTrackable = tools.filter((t) => !toolStatus(t.to, specialty ?? null, usageData).hideStatus).length
  const doneTrackable = tools.filter((t) => toolStatus(t.to, specialty ?? null, usageData).done).length
  const pct = totalTrackable > 0 ? Math.round((doneTrackable / totalTrackable) * 100) : 0

  const isEmergency = path.key === 'EMERGENCY'
  const isCriticalHealth = client.healthPct != null && client.healthPct < 40

  // ─── وضع المتابعة (Monitoring Mode) — عندما البناء مكتمل بشكل كبير
  // يُخفي التوصيات والاختيارات ويُظهر لوحة نبض أسبوعيّة مُبسّطة.
  const isSetupComplete = pct >= 80 && !isEmergency

  // تقدّم خطّة الإنقاذ الرباعيّة — لكل خطوة artifact معيّن
  const rescueDoneCount = [
    usageData.artifactTypes.has('RISK_REGISTER'),
    usageData.artifactTypes.has('EISENHOWER'),
    usageData.artifactTypes.has('RACI'),
    usageData.projectsCount > 0, // جانت يعتمد على المشاريع
  ].filter(Boolean).length
  const rescuePct = Math.round((rescueDoneCount / 4) * 100)

  return (
    <div className={`flex flex-col gap-6 ${isEmergency ? 'bg-gradient-to-b from-rose-50/40 to-transparent -mx-6 -my-6 px-6 py-6' : ''}`}>
      <PageHeader
        title={`الخطة الاستراتيجية — ${client.companyName}`}
        description={`إدارة ${specialtyLabel} · مدّة الخطة ${path.duration}`}
        breadcrumbs={[
          { label: 'عملائي', to: '/manager/clients' },
          { label: client.companyName, to: `/manager/clients/${client.companyId}` },
          { label: 'الخطة' },
        ]}
      />

      {/* 🚨 بانر الطوارئ — يظهر عند EMERGENCY أو صحّة حرجة */}
      {(isEmergency || isCriticalHealth) && (
        <Card className="overflow-hidden border-2 border-rose-500 bg-gradient-to-l from-rose-500/15 via-rose-500/5 to-transparent shadow-lg">
          <div className="h-1.5 animate-pulse bg-gradient-to-l from-rose-600 via-rose-500 to-rose-400" />
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start gap-4">
              <div className="text-5xl leading-none">🚨</div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-rose-400 bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-900">
                    حالة حرجة — تدخّل فوريّ
                  </span>
                  {client.healthPct != null && (
                    <span className="rounded-full border border-rose-300 bg-white px-2 py-0.5 text-[10px] font-bold text-rose-900 tabular-nums">
                      صحّة {client.healthPct}٪
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold text-rose-900">خطّة إنقاذ ٩٠ يوم — أولويّاتك الأربع</h2>
                  <span className="rounded-full border border-rose-400 bg-white px-2 py-0.5 text-[10px] font-bold tabular-nums text-rose-800">
                    {rescueDoneCount}/٤ · {rescuePct}٪ مكتَملة
                  </span>
                </div>
                {/* شريط تقدّم بصريّ للخطوات الأربع */}
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-rose-100">
                  <div
                    className="h-full bg-gradient-to-l from-emerald-500 to-emerald-400 transition-all"
                    style={{ width: `${rescuePct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-rose-800/80">
                  الإدارة في المنطقة الحمراء. الأولويّة القصوى: <b>إيقاف النزيف واستعادة الاستقرار</b> قبل أي تخطيط طويل المدى.
                  اتّبع الترتيب: مخاطر → أيزنهاور → RACI → جانت.
                </p>
                {/* ٤ خطوات إنقاذ عاجلة — مع علامة ✓ عند الاكتمال */}
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {([
                    { step: 1, to: 'risk-map', icon: '⚠️', label: 'أوقف النزيف', tool: 'خريطة المخاطر', desc: 'حصر ما يستنزفك الآن', done: usageData.artifactTypes.has('RISK_REGISTER') },
                    { step: 2, to: 'eisenhower', icon: '🎯', label: 'اُفرز فوراً', tool: 'أيزنهاور', desc: 'افعل / فوّض / احذف', done: usageData.artifactTypes.has('EISENHOWER') },
                    { step: 3, to: 'raci', icon: '👥', label: 'حدّد المسؤول', tool: 'RACI', desc: 'بلا فراغ في المسؤوليّة', done: usageData.artifactTypes.has('RACI') },
                    { step: 4, to: 'gantt-chart', icon: '📅', label: 'راقب أسبوعياً', tool: 'جانت ١٢ أسبوع', desc: 'أفعال قصيرة متسلسلة', done: usageData.projectsCount > 0 },
                  ] as const).map((s) => (
                    <Link
                      key={s.step}
                      to={`/${s.to}?client=${client.companyId}&from=emergency`}
                      className={`group relative flex items-start gap-2 rounded-lg border-2 p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        s.done
                          ? 'border-emerald-400 bg-emerald-50 hover:border-emerald-500'
                          : 'border-rose-300 bg-white hover:border-rose-500'
                      }`}
                    >
                      {s.done && (
                        <span className="absolute -top-2 -right-2 inline-flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-sm">
                          ✓
                        </span>
                      )}
                      <span className="text-2xl">{s.icon}</span>
                      <div className="min-w-0">
                        <div className={`text-[10px] font-bold ${s.done ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {s.step === 1 ? '١' : s.step === 2 ? '٢' : s.step === 3 ? '٣' : '٤'}. {s.label}
                        </div>
                        <div className={`text-xs font-semibold ${s.done ? 'text-emerald-900' : 'text-rose-900'}`}>{s.tool}</div>
                        <div className={`text-[9px] ${s.done ? 'text-emerald-800/70' : 'text-rose-800/70'}`}>{s.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-3 rounded-lg border border-rose-300 bg-rose-100/60 p-2 text-[11px] text-rose-900">
                  <b>💡 نصيحة:</b> تجنّب التخطيط طويل الأمد (نموّ / تميّز / SWOT الموسّع) حتى تخرج من المنطقة الحمراء.
                  الأدوات أدناه مرتَّبة بحسب أثرها العاجل.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🏆 وضع المتابعة — يظهر عندما البناء مكتمل ≥٨٠٪ */}
      {isSetupComplete && (
        <Card className="overflow-hidden border-2 border-emerald-500 bg-gradient-to-l from-emerald-50 via-emerald-50/50 to-transparent shadow-lg">
          <div className="h-1.5 bg-gradient-to-l from-emerald-600 via-emerald-500 to-emerald-400" />
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start gap-4">
              <div className="text-5xl">🏆</div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-500 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                    وضع المتابعة الأسبوعيّة
                  </span>
                  <span className="rounded-full border border-emerald-400 bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-800 tabular-nums">
                    البناء {pct}٪ · {doneTrackable}/{totalTrackable} أداة مُستخدَمة
                  </span>
                </div>
                <h2 className="text-lg font-bold text-emerald-900">خطّتك مبنيّة — الآن تحتاج فقط <b>المتابعة الأسبوعيّة</b></h2>
                <p className="mt-1 text-xs leading-relaxed text-emerald-800/80">
                  انتهيتَ من مرحلة البناء (اختيار المسار + الأدوات + التخطيط). لم تعد الصفحة بحاجة لتوصيات جديدة —
                  <b> ركّز أسبوعياً على ٣ أشياء فقط:</b> KPIs · جانت · المهام المتأخّرة.
                </p>

                {/* شريط النبض الأسبوعي — ٣ روابط مُبسَّطة */}
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <Link
                    to={`/measure?tab=kpis&client=${client.companyId}`}
                    className="group flex items-start gap-2 rounded-lg border-2 border-emerald-300 bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md"
                  >
                    <span className="text-2xl">📊</span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-emerald-700">اليوم — ٥ دقائق</div>
                      <div className="text-xs font-semibold text-emerald-900">تحديث قراءات KPIs</div>
                      <div className="text-[9px] text-emerald-800/70">قيمة أسبوعيّة لكل مؤشّر</div>
                    </div>
                  </Link>
                  <Link
                    to={`/execute?tab=gantt&client=${client.companyId}`}
                    className="group flex items-start gap-2 rounded-lg border-2 border-emerald-300 bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md"
                  >
                    <span className="text-2xl">📅</span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-emerald-700">أسبوعيّاً — ١٠ دقائق</div>
                      <div className="text-xs font-semibold text-emerald-900">مراجعة جانت</div>
                      <div className="text-[9px] text-emerald-800/70">أيّ خطوة متأخّرة؟</div>
                    </div>
                  </Link>
                  <Link
                    to={`/execute?tab=tasks&client=${client.companyId}`}
                    className="group flex items-start gap-2 rounded-lg border-2 border-emerald-300 bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md"
                  >
                    <span className="text-2xl">✓</span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-emerald-700">يوميّاً — ٥ دقائق</div>
                      <div className="text-xs font-semibold text-emerald-900">تقدّم المهام</div>
                      <div className="text-[9px] text-emerald-800/70">حدّث الحالة والانتقال</div>
                    </div>
                  </Link>
                </div>

                <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-100/50 p-2 text-[11px] text-emerald-900">
                  <b>💡 التوصيات أدناه مُخفّضة</b> — الأدوات الاستراتيجيّة (SWOT/التوجّه/BSC) مبنيّة ولا تحتاج تعديلاً دورياً.
                  استخدمها للمراجعة الربعيّة/السنويّة عندما تُخطّط لدورة تحسين جديدة.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🧭 «إلى أين أذهب الآن؟» — بناءً على استخدام أدوات المسار.
          مُخفى في وضع الطوارئ + وضع المتابعة لتجنّب الضجيج. */}
      {!usageLoading && !isEmergency && !isSetupComplete && (
        nextUnusedTool ? (
          <NextActionCard
            icon={isEmergency ? '🚨' : doneTrackable === 0 ? '🚀' : '➡️'}
            title={
              isEmergency && doneTrackable === 0
                ? `ابدأ الإنقاذ فوراً بـ«${nextUnusedTool.labelAr}»`
                : doneTrackable === 0
                  ? `ابدأ خطتك بـ«${nextUnusedTool.labelAr}»`
                  : `تقدّمك ${pct}٪ — التالي: ${nextUnusedTool.labelAr}`
            }
            reason={nextUnusedTool.whyAr}
            to={nextUnusedTool.to}
            cta={isEmergency ? 'ابدأ الآن ←' : 'افتح الأداة'}
            variant={isEmergency ? 'rose' : doneTrackable === 0 ? 'sky' : 'indigo'}
          />
        ) : totalTrackable > 0 ? (
          <NextActionCard
            icon="🏆"
            title="اكتملت أدوات هذه الخطة"
            reason={`استخدمت ${doneTrackable}/${totalTrackable} أداة. راجع النتائج على مخطّط جانت وتتبّع خطط التنفيذ.`}
            to={`/execute?client=${client.companyId}`}
            cta="راجع التنفيذ"
            variant="emerald"
          />
        ) : null
      )}

      {/* بطاقة التعريف — تُخفى في الحالة الطارئة أو وضع المتابعة */}
      {!isEmergency && !isSetupComplete && (
        <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
          <CardContent className="p-4 text-xs leading-relaxed">
            <div className="flex items-start gap-3">
              <div className="text-2xl leading-none">🗺️</div>
              <div className="flex-1">
                <div className="text-sm font-bold text-foreground">لكل حالة نوع خطة يناسبها</div>
                <p className="mt-1 text-muted-foreground">
                  المنصّة تُوصي بمسار بناءً على صحّة الإدارة الحالية، لكن <b className="text-foreground">القرار لك</b>.
                  اختر بين ٤ خطط: 🚨 عاجلة (٩٠ يوم) · 🌱 تأسيسيّة (٦ أشهر) · 🚀 نموّ (١٢ شهر) · 🏆 تميّز (١٨ شهر).
                </p>
                <p className="mt-1 text-muted-foreground">
                  كل خطة تعرض <b className="text-foreground">الأدوات الفعليّة داخل المنصّة</b> التي تدعمها.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* مُبدّل نوع الخطة — يُخفى في وضع المتابعة (اخترت المسار سلفاً) */}
      {!isSetupComplete && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">🎯 اختر نوع الخطة</CardTitle>
          <CardDescription>
            {isEmergency ? (
              <>
                المنصّة تُلزم بـ <b className="text-rose-800">{recommendedPath?.shortName}</b> بناءً على صحّة إدارتك
                ({client.healthPct}٪). الخطط الأخرى غير مناسبة للمنطقة الحمراء — <b>لا تُنشئ نموّاً بينما تنزف</b>.
              </>
            ) : (
              <>
                المنصّة تُوصي بـ <b className="text-foreground">{recommendedPath?.shortName}</b> بناءً على صحّة إدارتك
                ({client.healthPct != null ? `${client.healthPct}٪` : 'بلا تدقيق'}) — لكن يمكنك اختيار مسار آخر.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-4">
          {SELECTABLE_KEYS.map((k) => {
            const p = paths[k]
            const s = PATH_ACCENT_STYLES[p.accent]
            const isSelected = selectedKey === k
            const isRec = recommendedPath?.key === k
            // في الحالة الطارئة: الخيارات غير الموصى بها مُعتَّمة (لكنها قابلة للاختيار)
            const isDimmedByEmergency = isEmergency && !isRec && !isSelected
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedKey(k)}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-right transition ${
                  isSelected ? `${s.border} ${s.bg} shadow-md ring-2 ${s.ring}` : `${s.border} bg-card hover:shadow`
                } ${isDimmedByEmergency ? 'opacity-40 grayscale' : ''}`}
                title={isDimmedByEmergency ? 'غير مناسب أثناء المنطقة الحمراء — انتقل للإنقاذ أوّلاً' : undefined}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-2xl">{p.icon}</span>
                  {isRec && (
                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${s.chip}`}>
                      ⭐ توصية
                    </span>
                  )}
                  {isDimmedByEmergency && (
                    <span className="rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">
                      🔒 لاحقاً
                    </span>
                  )}
                </div>
                <div className={`text-sm font-bold ${s.text}`}>{p.shortName}</div>
                <div className="text-[10px] text-muted-foreground">{p.duration}</div>
                <div className="text-[10px] leading-relaxed text-muted-foreground line-clamp-2">
                  {p.urgencyLabel}
                </div>
                {isSelected && <div className="mt-1 text-[10px] font-medium text-primary">✓ مُختار</div>}
              </button>
            )
          })}
        </CardContent>
        {/* سبب توصية المسار المُختار */}
        <CardContent className="pt-0">
          <div className={`rounded-lg border-2 border-dashed p-3 text-xs ${
            isRecommended ? 'border-emerald-300 bg-emerald-50/40' : 'border-amber-300 bg-amber-50/40'
          }`}>
            <b className="text-foreground">
              {isRecommended ? '⭐ لماذا نوصي بهذا المسار؟' : 'ℹ️ ملاحظة — هذا ليس المسار الموصى به'}
            </b>
            <p className="mt-0.5 text-muted-foreground">{pathReason(path.key)}</p>
            {!isRecommended && recommendedPath && (
              <button
                type="button"
                onClick={() => setSelectedKey(recommendedPath.key)}
                className="mt-1 text-[10px] text-primary underline-offset-2 hover:underline"
              >
                عد إلى التوصية «{recommendedPath.shortName}» ←
              </button>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* رأس المسار المختار */}
      <Card className={`overflow-hidden ${style.border} ${style.bg}`}>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-6xl leading-none" aria-hidden>{path.icon}</span>
              <div>
                <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${style.chip}`}>
                  {path.urgencyLabel}
                </span>
                <h2 className={`mt-1 text-2xl font-bold ${style.text}`}>{path.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  مدّة الخطة {path.duration} · لإدارة {DEPT_ICON[specialty!]} {specialtyLabel} في {client.companyName}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">صحة الإدارة</div>
              <div className={`text-4xl font-bold tabular-nums ${style.text}`}>
                {client.healthPct != null ? `${client.healthPct}٪` : '—'}
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed">{path.description}</p>
        </CardContent>
      </Card>

      {/* 🛠️ الأدوات الفعليّة التي تدعم هذا المسار — مع حالة الاستخدام */}
      {(() => {
        const statuses = tools.map((t) => toolStatus(t.to, specialty ?? null, usageData))
        const trackable = statuses.filter((s) => !s.hideStatus)
        const doneCount = trackable.filter((s) => s.done).length
        const trackableCount = trackable.length
        const pct = trackableCount > 0 ? Math.round((doneCount / trackableCount) * 100) : 0
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                🛠️ الأدوات المستخدمة في هذه الخطة
                {trackableCount > 0 && (
                  <span className="rounded-full border bg-card px-2 py-0.5 text-xs font-medium tabular-nums">
                    {doneCount}/{trackableCount} مُستخدَمة ({pct}٪)
                  </span>
                )}
                {usageLoading && <span className="text-[10px] text-muted-foreground">جاري قراءة الاستخدام…</span>}
              </CardTitle>
              <CardDescription>
                {tools.length} أداة داخل المنصّة مُختارة خصيصاً لمسار {path.shortName}.
                {' '}الشارة الخضراء «✓ مُستخدَمة» تعني أنّ الأداة حُفظ فيها بيانات لهذا العميل.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {tools.map((t, idx) => {
                  const st = statuses[idx]
                  // في وضع الطوارئ: أضف &from=emergency لتفعيل RescueContextBanner في الوجهة
                  const linkTo = isEmergency && !t.to.includes('from=') ? `${t.to}&from=emergency` : t.to
                  return (
                    <Link
                      key={t.to}
                      to={linkTo}
                      className={`relative flex items-start gap-2 rounded-lg border p-3 transition hover:-translate-y-0.5 hover:shadow ${
                        st.done ? 'border-emerald-300 bg-emerald-50/40' : isEmergency ? 'border-rose-200 bg-rose-50/30' : 'bg-card'
                      }`}
                    >
                      {/* في الطوارئ: ترقيم أولويّة العلاج (١، ٢، ٣، ٤) */}
                      {isEmergency && idx < 4 && (
                        <span className="absolute -top-2 -right-2 inline-flex size-5 items-center justify-center rounded-full border-2 border-rose-500 bg-white text-[10px] font-bold text-rose-700 shadow-sm">
                          {idx + 1}
                        </span>
                      )}
                      <span className="text-xl leading-none">{t.icon}</span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold">{t.labelAr}</span>
                          {!st.hideStatus && (st.done ? (
                            <span className="rounded-full border border-emerald-400 bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                              ✓ مُستخدَمة{st.detail ? ` · ${st.detail}` : ''}
                            </span>
                          ) : (
                            <span className="rounded-full border bg-card px-1.5 py-0.5 text-[9px] text-muted-foreground">
                              ○ لم تُستخدَم بعد
                            </span>
                          ))}
                          {st.hideStatus && (
                            <span className="rounded-full border bg-card px-1.5 py-0.5 text-[9px] text-muted-foreground/70">
                              — لا حالة
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{t.whyAr}</div>
                      </div>
                      <span className="text-xs text-primary">←</span>
                    </Link>
                  )
                })}
              </div>
              {trackableCount > 0 && (
                <div className="mt-3 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
                  <b className="text-foreground">💡 كيف نحسب؟</b> «مُستخدَمة» = وُجد artifact محفوظ أو
                  سجلّ بيانات (أهداف/مؤشّرات/مبادرات/خطوات تنفيذ) للأداة على هذا العميل.
                  الأدوات «بلا حالة» (مثل التحليل المالي، السيناريوهات) لا تُخزّن مخرَجاً قابلاً للقياس.
                </div>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* ─── توصيات المسار — شبكة عمودين لتنظيم أوضح ─── */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-sm font-bold">📋 توصيات مسار {path.shortName}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
      {/* الأولويات — الآن ترتبط بأيزنهاور لفرزها كمهام */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🎯 الأولويات — ما يجب التركيز عليه</CardTitle>
          <CardDescription>مرتّبة حسب الأثر على مسار {path.shortName}.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 text-sm">
            {path.priorities.map((p, i) => (
              <li key={i} className="flex items-start gap-3 rounded-md border bg-card p-3">
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${style.chip}`}>
                  {i + 1}
                </span>
                <span className="flex-1 leading-relaxed">{p}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex justify-end">
            <Link
              to={`/eisenhower?client=${client.companyId}${isEmergency ? '&from=emergency' : ''}`}
              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
            >
              🎯 افرز هذه الأولويّات في مصفوفة أيزنهاور ←
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* المبادرات المقترحة */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">💡 المبادرات المقترحة</CardTitle>
          <CardDescription>مبادرات ملموسة تفعّلها من صفحة "المبادرات".</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {path.initiatives.map((it, i) => (
              <li key={i} className="rounded-md border bg-card p-3 leading-relaxed">
                {it}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-end">
            <Link
              to={`/initiatives?client=${client.companyId}${isEmergency ? '&from=emergency' : ''}`}
              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
            >
              💡 افتح صفحة المبادرات ←
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* KPIs — الآن يرتبط بمركز القياس */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📊 مؤشرات الأداء الموصى بها</CardTitle>
          <CardDescription>
            مقترحات لمسار {path.shortName}
            {kpiHints.length > 0 ? ' + معايير خاصّة بتخصّصك' : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">لهذا المسار</div>
              <ul className="grid gap-1.5 text-sm">
                {path.suggestedKPIs.map((k) => (
                  <li key={k} className="rounded-md border bg-card px-3 py-2">📈 {k}</li>
                ))}
              </ul>
            </div>
            {kpiHints.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  خاصّة بتخصّصك ({specialtyLabel})
                </div>
                <ul className="grid gap-1.5 text-sm">
                  {kpiHints.map((k) => (
                    <li key={k} className="rounded-md border bg-card px-3 py-2">⚡ {k}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <Link
              to={`/measure?client=${client.companyId}${isEmergency ? '&from=emergency' : ''}`}
              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
            >
              📊 افتح مركز القياس (KPIs + BSC + OKRs) ←
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* المخاطر — الآن ترتبط بخريطة المخاطر مباشرةً */}
      <Card className={isEmergency ? 'border-rose-300 bg-rose-50/40' : 'border-amber-200 bg-amber-50/40'}>
        <CardHeader>
          <CardTitle className="text-base">⚠️ مخاطر ينبغي الانتباه لها</CardTitle>
          <CardDescription>راقب هذه المؤشرات أثناء تنفيذ الخطة.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm">
            {path.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden>⚠️</span>
                <span className="flex-1 leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-end">
            <Link
              to={`/risk-map?client=${client.companyId}${isEmergency ? '&from=emergency' : ''}`}
              className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                isEmergency
                  ? 'border-rose-400 bg-rose-100 text-rose-800 hover:bg-rose-200'
                  : 'border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200'
              }`}
            >
              ⚠️ {isEmergency ? 'سجّلها فوراً في خريطة المخاطر (الخطوة ١)' : 'افتح خريطة المخاطر'} ←
            </Link>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* خارطة زمنية — الآن ترتبط بمخطّط جانت */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🗓️ خارطة زمنية مقترحة</CardTitle>
          <CardDescription>ملخص المراحل الرئيسية للـ{path.duration}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Timeline days={path.durationDays} pathName={path.shortName} accent={style.chip} />
          <div className="mt-3 flex justify-end">
            <Link
              to={`/gantt-chart?client=${client.companyId}${isEmergency ? '&from=emergency' : ''}`}
              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
            >
              📅 ابنِ هذه الخارطة على مخطّط جانت ←
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="flex flex-wrap justify-end gap-3">
        <Link
          to={`/annual-plan?client=${client.companyId}`}
          className="rounded-md border bg-card px-4 py-2 text-sm hover:bg-accent"
        >
          خطة سنوية مفصّلة
        </Link>
        <Link
          to={`/manager/clients/${client.companyId}`}
          className={`rounded-md px-4 py-2 text-sm ${style.chip} hover:opacity-90`}
        >
          عودة إلى لوحة العميل
        </Link>
      </div>
    </div>
  )
}

// ─── خارطة زمنية بسيطة ─────────────────────────────────────────────

function Timeline({
  days, pathName, accent,
}: { days: number; pathName: string; accent: string }) {
  const phases = phaseLabels(days, pathName)
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {phases.map((p, i) => (
        <div key={i} className="rounded-lg border bg-card p-3">
          <div className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${accent}`}>
            المرحلة {i + 1}
          </div>
          <div className="mt-2 text-xs font-semibold text-muted-foreground">{p.range}</div>
          <div className="mt-1 text-sm font-medium">{p.title}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
        </div>
      ))}
    </div>
  )
}

function phaseLabels(days: number, pathName: string): { range: string; title: string; desc: string }[] {
  void pathName
  if (days <= 90) {
    return [
      { range: 'أسبوع ١',       title: 'التحرّك الفوري',  desc: 'تحديد المشاكل الحرجة وإيقاف النزيف.' },
      { range: 'أسبوع ٢-٤',     title: 'الاستقرار',       desc: 'استعادة العمليات الأساسية.' },
      { range: 'أسبوع ٥-٨',     title: 'التعافي',         desc: 'بناء إجراءات وقائية.' },
      { range: 'أسبوع ٩-١٢',    title: 'التحوّل',        desc: 'الانتقال لخطة تأسيسية طويلة.' },
    ]
  }
  if (days <= 180) {
    return [
      { range: 'شهر ١',         title: 'الترتيب والتوثيق', desc: 'رسم الوضع الحالي وتحديد الفجوات.' },
      { range: 'شهر ٢-٣',       title: 'البناء',           desc: 'إنشاء SOPs وأنظمة قياس.' },
      { range: 'شهر ٤-٥',       title: 'التطبيق',         desc: 'تدريب الفريق وتفعيل الأنظمة.' },
      { range: 'شهر ٦',         title: 'المراجعة',         desc: 'قياس الأثر وتعديل الخطة.' },
    ]
  }
  if (days <= 365) {
    return [
      { range: 'ربع ١',         title: 'التخطيط',          desc: 'مراجعة الأداء وتحديد فرص النمو.' },
      { range: 'ربع ٢',         title: 'التسريع',         desc: 'أتمتة وتوسّع مبكر.' },
      { range: 'ربع ٣',         title: 'التوسّع',          desc: 'إطلاق ٢-٣ مبادرات ابتكار.' },
      { range: 'ربع ٤',         title: 'التقييم',          desc: 'مراجعة النتائج وتخطيط العام التالي.' },
    ]
  }
  return [
    { range: 'أشهر ١-٤',    title: 'التأسيس المتقدّم', desc: 'مراجعة الوضع وإطلاق مبادرات الابتكار.' },
    { range: 'أشهر ٥-٩',    title: 'الاعتماد',          desc: 'العمل نحو شهادات قطاعية.' },
    { range: 'أشهر ١٠-١٤',  title: 'التميّز',           desc: 'مشاركة أفضل الممارسات.' },
    { range: 'أشهر ١٥-١٨',  title: 'القيادة',            desc: 'بناء علامة تجارية للإدارة.' },
  ]
}
