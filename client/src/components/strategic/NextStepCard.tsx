import { Link, useLocation } from 'react-router-dom'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useJourneyCompletions } from '@/hooks/useJourneyCompletions'
import { filterToolsForUser, isStageInPath, JOURNEY_STAGES, type JourneyStage } from '@/lib/journeyStages'
import { useAuthStore } from '@/store/authStore'

// ─── S3 — بطاقة «الخطوة التالية» أسفل كل أداة استراتيجية ──────────
// المبدأ: نتقدّم دائماً للأمام — لا نُعيد المدير لأدوات مُتوازية في
// نفس المرحلة. مثال: /porter و /pestel كلتاهما "عدسات استكشاف" في
// المرحلة ①، فالانتقال من إحداهما للأخرى ليس تقدّماً — الأدوات
// المُتوازية يصل إليها المدير عبر السايدبار.
//
// المنطق:
//   ١) إذا كانت الأداة الحالية ⭐ (starred): جرّب الأداة ⭐ التالية في
//      نفس المرحلة (مثل SWOT→TOWS، directions→BMC→choices، KPIs→OGSM).
//   ٢) وإلا (الأداة الحالية غير ⭐، أي "عدسة مساندة"): اقفز إلى ⭐ الأولى
//      في المرحلة التالية. هذا يمنع الدوّامات بين الأدوات المتوازية.
//   ٣) إذا لا مرحلة تالية → لا نعرض شيئاً.

interface Props {
  clientQuery?: string
  /** معرّف العميل/الشركة — لفحص اكتمال التحليل قبل فتح التوليف (SWOT). */
  companyId?: string
}

function findStage(pathname: string): { stage: JourneyStage; index: number } | null {
  for (const s of JOURNEY_STAGES) {
    const idx = s.toolPaths.findIndex((p) => pathname === p || pathname.startsWith(p + '/'))
    if (idx >= 0) return { stage: s, index: idx }
  }
  return null
}

// ─── تسلسل أدوات التحليل الكامل لمرحلة ① (بالترتيب) ─────────────────
// «التالي» يمرّ المستخدم عبر كل الأدوات واحدة واحدة. القفل على التوليف
// (SWOT) يُفكّ بعد حدّ أدنى (٣) من التحاليل القابلة للتتبّع.
// match: يتعرّف على الـartifact المحفوظ (يشمل نسخ الإدارة مثل PESTEL_<dept>).
const SWOT_MIN_ANALYSES = 3

interface AnalysisTool {
  key: string
  label: string
  deptPath: string
  ownerPath: string
  /** يتعرّف على artifact الأداة — إن وُجد تُحسب ضمن عدّاد فتح التوليف. */
  match?: (t: string) => boolean
}

const ANALYSIS_SEQUENCE: AnalysisTool[] = [
  { key: 'deep',        label: 'التحليل العميق',        deptPath: '/manager/dept-deep',    ownerPath: '/manager/dept-deep',
    match: (t) => t === 'DEPT_DEEP_ANSWERS' || t === 'DEPT_DEEP_FULL' },
  { key: 'value-chain', label: 'سلسلة القيمة',          deptPath: '/value-chain',          ownerPath: '/value-chain',
    match: (t) => t === 'VALUE_CHAIN' || t.startsWith('VALUE_CHAIN_') },
  { key: 'pestel',      label: 'PESTEL',                deptPath: '/manager/dept-pestel',  ownerPath: '/pestel',
    match: (t) => t === 'PESTEL' || t.startsWith('PESTEL_') },
  { key: 'internal',    label: 'البيئة الداخلية (7S)',  deptPath: '/internal-environment', ownerPath: '/internal-environment',
    match: (t) => t === 'INTERNAL_ENV' },
  { key: 'porter',      label: 'قوى بورتر الخمس',       deptPath: '/porter',               ownerPath: '/porter',
    match: (t) => t === 'PORTER' },
  { key: 'core-cap',    label: 'القدرات الجوهريّة',      deptPath: '/core-capabilities',    ownerPath: '/core-capabilities',
    match: (t) => t === 'CORE_CAPABILITIES' },
  { key: 'benchmark',   label: 'المقارنة المرجعيّة',     deptPath: '/benchmarking',         ownerPath: '/benchmarking',
    match: (t) => t === 'BENCHMARK' },
  { key: 'org-dna',     label: 'DNA المنظّمة',           deptPath: '/org-dna',              ownerPath: '/org-dna',
    match: (t) => t === 'ORG_DNA' },
  { key: 'stakeholders',label: 'أصحاب المصلحة',         deptPath: '/stakeholders',         ownerPath: '/stakeholders',
    match: (t) => t === 'STAKEHOLDERS' },
]

export function NextStepCard({ clientQuery = '', companyId }: Props) {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    user?.specialtyDeptType != null
  const cur = findStage(pathname)
  if (!cur) return null

  // ─── مرحلة ① التحليل = قائمة عدسات اختياريّة، لا تسلسل صارم ──────
  // نستخرجها لمكوّن مستقل كي لا يعمل فحص الاكتمال (API) إلا على صفحات
  // التحليل — لا على الأربعين صفحة الأخرى.
  if (cur.stage.id === 'environment') {
    return <AnalysisStageNextStep pathname={pathname} clientQuery={clientQuery} companyId={companyId} isDeptScoped={isDeptScoped} />
  }

  // أدوات المرحلة النجمية (⭐) — الترتيب الحقيقي للتقدّم.
  const starredFiltered = filterToolsForUser(cur.stage.starredPaths, isDeptScoped)
  const currentPath = cur.stage.toolPaths[cur.index]
  const starredIdx = starredFiltered.indexOf(currentPath)

  let nextPath: string | null = null
  let stageIcon = cur.stage.icon
  let stageLabel = 'داخل نفس المرحلة'

  if (starredIdx >= 0 && starredIdx + 1 < starredFiltered.length) {
    // ١) الأداة الحالية ⭐ ولها ⭐ تالية → اقتراح خطي طبيعي (SWOT→TOWS، …).
    nextPath = starredFiltered[starredIdx + 1]
  } else {
    // ٢) الحالية عدسة مساندة (أو آخر ⭐ في المرحلة) → اقفز للمرحلة التالية
    //    **داخل مسار خطة المستخدم** (لا مجرّد order+1): مستخدم QUICK ينتقل من
    //    التوليف مباشرةً للمبادرات متجاوزاً ③④ الخارجتين عن مساره (§٤-٥).
    const next = JOURNEY_STAGES.find(
      (s) => s.order > cur.stage.order && isStageInPath(s.id, user?.strategyPath ?? null),
    )
    if (next) {
      const nextStarred = filterToolsForUser(next.starredPaths, isDeptScoped)
      const nextAll = filterToolsForUser(next.toolPaths, isDeptScoped)
      nextPath = nextStarred[0] ?? nextAll[0] ?? null
      stageIcon = next.icon
      stageLabel = next.labelAr
    }
  }

  if (!nextPath) return null

  const label = TOOL_LABELS[nextPath] ?? nextPath.split('/').pop() ?? nextPath

  return (
    <Card className="border-primary/30 bg-gradient-to-l from-primary/10 to-primary/5">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs">التالي في التسلسل</CardDescription>
        <CardTitle className="flex items-center gap-2 text-base">
          <span aria-hidden>{stageIcon}</span>
          <span>{label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3 pt-1 text-sm">
        <p className="text-xs text-muted-foreground">{stageLabel}</p>
        <Link
          to={`${nextPath}${clientQuery}`}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:opacity-90"
        >
          افتحها الآن ←
        </Link>
      </CardContent>
    </Card>
  )
}

// ─── بطاقة «① التحليل» — عدسات اختياريّة + بوّابة التوليف ──────────
// SWOT يُوَلّف مخرجات التحليل، فلا يُفتح قبل حفظ تحليل واحد على الأقل.
// نفحص completions.environment (يصير true بمجرّد حفظ أول artifact تحليل:
// DEPT_DEEP_ANSWERS / VALUE_CHAIN / PESTEL / …).
function AnalysisStageNextStep({
  pathname, clientQuery, companyId, isDeptScoped,
}: { pathname: string; clientQuery: string; companyId?: string; isDeptScoped: boolean }) {
  const { loading, artifactTypes } = useJourneyCompletions(companyId ?? null)
  const types = [...artifactTypes]
  const pathOf = (a: AnalysisTool) => (isDeptScoped ? a.deptPath : a.ownerPath)
  const isDone = (a: AnalysisTool) => !!a.match && types.some(a.match)

  // عدّاد فتح التوليف — التحاليل القابلة للتتبّع المُنجَزة (يكفي ٣).
  const doneCount = ANALYSIS_SEQUENCE.filter(isDone).length
  const unlocked = doneCount >= SWOT_MIN_ANALYSES
  const remaining = Math.max(0, SWOT_MIN_ANALYSES - doneCount)

  // «التالي» يمرّ عبر كل الأدوات بالتسلسل — الأداة التالية في القائمة بعد الحاليّة.
  const curIdx = ANALYSIS_SEQUENCE.findIndex((a) => pathOf(a) === pathname)
  const nextTool = curIdx >= 0 ? ANALYSIS_SEQUENCE[curIdx + 1] : ANALYSIS_SEQUENCE[0]
  const swotLabel = TOOL_LABELS['/swot'] ?? 'SWOT'

  return (
    <Card className="border-primary/30 bg-gradient-to-l from-primary/10 to-primary/5">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs">
          🧭 ① التحليل — أنجزت <b className="tabular-nums text-primary">{doneCount}</b> من {ANALYSIS_SEQUENCE.length} عدسة · التوليف يفتح بعد {SWOT_MIN_ANALYSES}
        </CardDescription>
        <CardTitle className="text-sm font-medium leading-relaxed text-muted-foreground">
          امضِ عبر الأدوات بالتسلسل — كل أداة تقرأ من سابقتها. {unlocked
            ? 'لديك سياق كافٍ للتوليف متى شئت.'
            : `التوليف (SWOT) يُفتح بعد ${SWOT_MIN_ANALYSES} تحاليل.`}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 pt-1">
        {nextTool && (
          <Link
            to={`${pathOf(nextTool)}${clientQuery}`}
            className="rounded-md border border-primary/40 bg-card px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
            title="الأداة التالية في تسلسل التحليل — تقرأ ناتج ما سبقها"
          >
            التالي: {nextTool.label}{isDone(nextTool) ? ' ✓' : ''} ←
          </Link>
        )}
        {unlocked ? (
          <Link
            to={`/swot${clientQuery}`}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:opacity-90"
            title="تقدّم لمرحلة التوليف — تجمع مخرجات التحليل في SWOT"
          >
            جاهز؟ انتقل للتوليف → {swotLabel}
          </Link>
        ) : (
          <span
            className="rounded-md border border-dashed bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
            title="التوليف يقرأ مخرجات التحليل — أكمل الحدّ الأدنى أوّلاً"
          >
            🔒 {loading ? 'جارٍ التحقّق…' : `أكمل ${remaining} تحليلاً بعد لفتح التوليف (SWOT)`}
          </span>
        )}
      </CardContent>
    </Card>
  )
}

// خريطة تسميات مختصرة — مطابقة لـJourneyPage.shortLabel.
const TOOL_LABELS: Record<string, string> = {
  '/pestel': 'PESTEL', '/porter': 'Porter', '/benchmarking': 'المقارنة المرجعية',
  '/value-chain': 'سلسلة القيمة', '/core-capabilities': 'القدرات الجوهرية',
  '/org-dna': 'DNA المنظمة', '/stakeholders': 'أصحاب المصلحة',
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
