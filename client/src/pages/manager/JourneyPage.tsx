import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { deepHasContent } from '@/lib/artifactContent'
import { getProOverview, type OverviewClient } from '@/lib/proApi'
import { buildJourneyPayload, type JourneyPayload } from '@/lib/journeyPayload'
import {
  JOURNEY_STAGES, artifactSatisfies, canOpenStage, overallProgressPct, isStageInPath,
  type StageId, type JourneyStage,
} from '@/lib/journeyStages'

// أسماء ودّية لمصادر الاكتمال (بدل الأنواع الخام مثل STAKEHOLDERS).
const ARTIFACT_LABEL: Record<string, string> = {
  INTERNAL_ENV: 'البيئة الداخلية 7S', PESTEL: 'PESTEL', PORTER: 'بورتر',
  BENCHMARK: 'المقارنة المرجعية', STAKEHOLDERS: 'أصحاب المصلحة', ORG_DNA: 'DNA المنظّمة',
  VALUE_CHAIN: 'سلسلة القيمة', CORE_CAPABILITIES: 'القدرات الجوهرية',
  DEPT_DEEP_ANSWERS: 'التحليل العميق', DEPT_DEEP_FULL: 'التحليل العميق',
  DIRECTIONS: 'التوجّهات', BMC: 'BMC', GAP_ANALYSIS: 'تحليل الفجوة',
  THREE_HORIZONS: 'الآفاق الثلاثة', CHOICES: 'الخيارات', BCG: 'BCG', ANSOFF: 'أنسوف',
  OGSM: 'OGSM', ANNUAL_PLAN: 'الخطة السنوية', BSC: 'BSC',
  PRIORITY_MATRIX: 'مصفوفة الأولوية', RISK_REGISTER: 'سجل المخاطر',
  EISENHOWER: 'أيزنهاور', RACI: 'RACI',
}
import { getSWOT } from '@/lib/strategicApi'
import { listAllArtifacts } from '@/lib/strategicApi'
import { listObjectives, listKPIs } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

// ─── R5.3 — /manager/clients/:id/journey ────────────────────────────
// صفحة التسلسل الاستراتيجي المقفل. تجمع كل شيء في مكان واحد:
//   • Payload الحقن (buildJourneyPayload) — يُعرض في الأعلى.
//   • شريط تقدّم عام (نسبة اكتمال المراحل الأربع المقفلة).
//   • 6 كروت مراحل بترتيبها، كل واحدة تُظهر حالتها (مقفلة/مفتوحة/مكتَملة)
//     + قائمة أدواتها بروابط ?client=X.
//
// الاكتمال يُحسَب من: StrategicArtifact + SWOT + Objectives/KPIs بحسب المرحلة.

interface StageStatus {
  stage: JourneyStage
  complete: boolean
  canOpen: boolean
  matched: string[] // مفاتيح الاكتمال التي وُجدت
}

export function JourneyPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [client, setClient] = useState<OverviewClient | null>(null)
  const [nonEmptyArtifactTypes, setNonEmptyArtifactTypes] = useState<Set<string>>(new Set())
  const [hasSwot, setHasSwot] = useState(false)
  const [hasObjectives, setHasObjectives] = useState(false)
  const [hasKpis, setHasKpis] = useState(false)

  const isPro = user?.userType === 'MANAGER' && user?.managerType === 'INDEPENDENT_PRO'

  useEffect(() => {
    if (!isPro || !companyId) return
    let alive = true
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const overview = await getProOverview()
        const found = overview.clients.find((c) => c.companyId === companyId) ?? null
        if (!alive) return
        if (!found) {
          setError('العميل غير موجود.')
          return
        }
        setClient(found)
        // نُحمّل مصادر الاكتمال بالتوازي.
        const [artifacts, swot, objectives, kpis] = await Promise.allSettled([
          listAllArtifacts(companyId),
          getSWOT(companyId).catch(() => null),
          listObjectives(companyId).catch(() => []),
          listKPIs(companyId).catch(() => []),
        ])
        if (!alive) return
        if (artifacts.status === 'fulfilled') {
          // القلب (D1 §٤): مصدر الإكمال واعٍ بالمحتوى — نُرشّح بـ deepHasContent
          // (selector المحرّك، لا فحص فراغٍ محلّيّ). أداةٌ موجودةٌ فارغة {} لا تُحسب مكتملة.
          setNonEmptyArtifactTypes(new Set(artifacts.value.filter((a) => deepHasContent(a.data)).map((a) => a.type)))
        }
        if (swot.status === 'fulfilled' && swot.value) {
          const s = swot.value
          setHasSwot(
            Array.isArray(s.strengths) && s.strengths.length > 0 ||
            Array.isArray(s.weaknesses) && s.weaknesses.length > 0,
          )
        }
        if (objectives.status === 'fulfilled') setHasObjectives(objectives.value.length > 0)
        if (kpis.status === 'fulfilled') setHasKpis(kpis.value.length > 0)
      } catch (err) {
        if (alive) setError(apiErrorMessage(err, 'تعذّر تحميل صفحة التسلسل'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [isPro, companyId])

  // ─── حسابات ─────────────────────────────────────────────────────
  const payload: JourneyPayload | null = useMemo(() => {
    if (!user || !client) return null
    return buildJourneyPayload(user, client)
  }, [user, client])

  const stageStatuses: StageStatus[] = useMemo(() => {
    // نُحضّر خريطة الاكتمال أولاً.
    const completionMap: Record<StageId, boolean> = {
      environment: false, synthesis: false, directions: false,
      indicators: false, initiatives: false, execution: false,
    }
    const matchedMap: Record<StageId, string[]> = {
      environment: [], synthesis: [], directions: [],
      indicators: [], initiatives: [], execution: [],
    }

    for (const stage of JOURNEY_STAGES) {
      const matched: string[] = []
      for (const t of stage.completionArtifacts) {
        // واعٍ بالإدارة: PESTEL_HR يُرضي PESTEL (المدير المستقل يخزّن مقيّداً).
        if (artifactSatisfies(nonEmptyArtifactTypes, t)) matched.push(ARTIFACT_LABEL[t] ?? t)
      }
      // مصادر خاصة لكل مرحلة (SWOT/Objectives/KPIs):
      if (stage.id === 'synthesis' && hasSwot) matched.push('SWOT')
      if (stage.id === 'indicators' && hasObjectives) matched.push('Objectives')
      if (stage.id === 'indicators' && hasKpis) matched.push('KPIs')
      completionMap[stage.id] = matched.length > 0
      matchedMap[stage.id] = matched
    }

    return JOURNEY_STAGES.map((stage) => ({
      stage,
      complete: completionMap[stage.id],
      canOpen: canOpenStage(stage.id, completionMap, user?.strategyPath ?? null),
      matched: matchedMap[stage.id],
    }))
  }, [nonEmptyArtifactTypes, hasSwot, hasObjectives, hasKpis, user?.strategyPath])

  const progressPct = useMemo(() => {
    const map: Record<StageId, boolean> = Object.fromEntries(
      stageStatuses.map((s) => [s.stage.id, s.complete]),
    ) as Record<StageId, boolean>
    return overallProgressPct(map, user?.strategyPath ?? null)
  }, [stageStatuses, user?.strategyPath])

  // ─── حالات فشل ─────────────────────────────────────────────────
  if (!isPro) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="التسلسل الاستراتيجي" />
        <EmptyState title="هذه الصفحة للمدير المستقل" />
      </div>
    )
  }
  if (loading) return <LoadingSpinner fullPage label="جاري تحميل التسلسل…" />
  if (error || !client || !payload) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="التسلسل الاستراتيجي" />
        <EmptyState
          title={error ?? 'خطأ'}
          description="عُد إلى قائمة عملائك."
          action={
            <button
              onClick={() => navigate('/manager/clients')}
              className="rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-accent"
            >
              عملائي ←
            </button>
          }
        />
      </div>
    )
  }

  const clientQ = `?client=${client.companyId}`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`التسلسل الاستراتيجي — ${client.companyName}`}
        description={`٦ مراحل: ٤ مقفلة تعمل بالترتيب، ثم ٢ مفتوحتان للتنفيذ.`}
        breadcrumbs={[
          { label: 'عملائي', to: '/manager/clients' },
          { label: client.companyName, to: `/manager/clients/${client.companyId}` },
          { label: 'التسلسل' },
        ]}
      />

      {/* Payload الحقن — للمرجعية */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">📦 حقن Payload التسلسل</CardTitle>
          <CardDescription>البيانات المحقونة من التسجيل + التشخيص — تُقرأ في كل الأدوات.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs">
          <Pill icon="🏢" label={`إدارة ${payload.specialty}`} />
          <Pill icon="🏭" label={`قطاع: ${payload.sector ?? 'غير محدّد'}`} />
          <Pill icon="📏" label={`حجم: ${payload.size}`} />
          <Pill icon="😤" label={`آلام: ${payload.pains.length}`} />
          <Pill icon="🎯" label={`أهداف: ${payload.goals.length}`} />
          {payload.healthPct != null && (
            <Pill icon="❤️" label={`الصحة: ${payload.healthPct}%`} />
          )}
        </CardContent>
      </Card>

      {/* شريط تقدّم عام */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>التقدّم الكلّي في المراحل المقفلة</span>
            <span className="text-2xl font-bold tabular-nums text-primary">{progressPct}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            {JOURNEY_STAGES.filter((s) => s.locked).map((s) => (
              <span key={s.id}>{s.icon}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* المراحل الست */}
      <div className="grid gap-4">
        {stageStatuses.map((st) => (
          <StageCard
            key={st.stage.id}
            status={st}
            clientQ={clientQ}
            inPath={isStageInPath(st.stage.id, user?.strategyPath ?? null)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── مكوّنات فرعية ─────────────────────────────────────────────────

function Pill({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1">
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  )
}

function StageCard({ status, clientQ, inPath }: { status: StageStatus; clientQ: string; inPath: boolean }) {
  const { stage, complete, canOpen, matched } = status
  // قفلان مختلفان:
  //   • قفل التسلسل (داخل المسار، لم تكتمل السابقة) → يُفتَح تلقائياً.
  //   • قفل المسار (خارج مسارك، غير مطلوبة) → مقفل اختيارياً مع فتح يدوي.
  const [unlocked, setUnlocked] = useState(false)
  const pathLocked = !inPath && !unlocked

  // ─── بطاقة «غير مطلوبة لمسارك» — مطويّة مع خيار فتح القفل ─────────
  if (pathLocked) {
    return (
      <Card className="overflow-hidden border-dashed opacity-70">
        <div className="h-1 bg-muted" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
              <span aria-hidden>{stage.icon}</span>
              {stage.labelAr}
            </CardTitle>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              🔒 غير مطلوبة لمسارك
            </span>
          </div>
          <CardDescription>خارج مسارك المُختار — لا تحتاجها لإكمال خطتك.</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={() => setUnlocked(true)}
            className="rounded-md border border-dashed bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            🔓 افتحها إن احتجتها
          </button>
        </CardContent>
      </Card>
    )
  }

  const stateLabel =
    complete   ? { text: '✓ مكتَملة', class: 'bg-emerald-500 text-white' }
  : !inPath    ? { text: '🔓 مفتوحة يدوياً', class: 'bg-muted text-muted-foreground' }
  : canOpen    ? { text: 'متاحة',      class: 'bg-primary/10 text-primary' }
  : { text: '🔒 مقفلة',    class: 'bg-muted text-muted-foreground' }

  // المكتملة تبرز بإطار أخضر بدل التلاشي؛ المقفلة بالتسلسل تبقى باهتة.
  const cardClass = complete
    ? 'overflow-hidden border-2 border-emerald-400 bg-emerald-50/40'
    : `overflow-hidden ${canOpen ? '' : 'opacity-60'}`

  return (
    <Card className={cardClass}>
      <div className={`h-1 ${complete ? 'bg-emerald-400' : canOpen ? 'bg-primary/50' : 'bg-muted'}`} />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span aria-hidden>{stage.icon}</span>
            {stage.labelAr}
          </CardTitle>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateLabel.class}`}>
            {stateLabel.text}
          </span>
        </div>
        <CardDescription>{stage.descAr}</CardDescription>
        {!inPath && (
          <button
            type="button"
            onClick={() => setUnlocked(false)}
            className="mt-1 w-fit text-[10px] text-muted-foreground underline-offset-2 hover:underline"
          >
            ↩︎ أعِدها للقفل (خارج مسارك)
          </button>
        )}
      </CardHeader>
      <CardContent>
        {matched.length > 0 && (
          <div className="mb-3 text-[10px] text-emerald-700">
            ✓ مصادر الاكتمال: {matched.join(' · ')}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {stage.toolPaths.map((path) => {
            const isStarred = stage.starredPaths.includes(path)
            const disabled = !canOpen
            if (disabled) {
              return (
                <span
                  key={path}
                  className="rounded-md border border-dashed bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground"
                  title="ستُفتَح بعد اكتمال المرحلة السابقة."
                >
                  {isStarred && '⭐ '}{shortLabel(path)}
                </span>
              )
            }
            return (
              <Link
                key={path}
                to={`${path}${clientQ}`}
                className={`rounded-md border px-2.5 py-1 text-xs hover:bg-accent ${
                  isStarred ? 'border-primary/40 bg-primary/5 font-medium' : 'bg-card'
                }`}
              >
                {isStarred && '⭐ '}{shortLabel(path)}
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ⚠️ لا نُدخل قاموس ترجمة كامل — نستنتج الاسم من الجزء الأخير من المسار.
// كافية لتظهر الأداة، والوصول عبر الرابط الفعلي.
function shortLabel(path: string): string {
  const map: Record<string, string> = {
    '/pestel': 'PESTEL', '/porter': 'Porter', '/benchmarking': 'المقارنة المرجعية',
    '/value-chain': 'سلسلة القيمة', '/core-capabilities': 'القدرات',
    '/org-dna': 'DNA', '/stakeholders': 'أصحاب المصلحة',
    '/manager/dept-pestel': 'PESTEL للإدارة', '/manager/dept-gap': 'فجوات الإدارة',
    '/manager/dept-deep': 'تحليل عميق مبسّط', '/manager/deep-analysis': 'التحليل العميق',
    '/swot': 'SWOT', '/tows': 'TOWS', '/gap-analysis': 'تحليل الفجوة',
    '/directions': 'التوجهات', '/scenarios': 'السيناريوهات', '/choices': 'الخيارات',
    '/ansoff': 'أنسوف', '/bcg': 'BCG', '/space': 'SPACE', '/qspm': 'QSPM',
    '/three-horizons': 'الآفاق الثلاثة',
    '/ambition-gap': 'فجوة الطموح', '/strategic-tensions': 'التوترات',
    '/objectives': 'الأهداف', '/okrs': 'OKRs', '/ogsm': 'OGSM',
    '/kpis': 'KPIs', '/kpi-entries': 'إدخالات KPI', '/annual-plan': 'الخطة السنوية',
    '/initiatives': 'المبادرات', '/priority-matrix': 'مصفوفة الأولوية',
    '/risk-map': 'خريطة المخاطر', '/ai/simulation': 'محاكاة', '/projects': 'المشاريع',
    '/gantt-chart': 'جانت', '/tasks': 'المهام', '/ai-center': 'مركز الذكاء',
    '/bmc': 'نموذج الأعمال Canvas', '/bsc': 'Balanced Scorecard',
    '/raci': 'RACI', '/eisenhower': 'أيزنهاور',
  }
  return map[path] ?? path
}
