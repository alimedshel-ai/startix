import { Link, useLocation } from 'react-router-dom'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { filterToolsForUser, JOURNEY_STAGES, type JourneyStage } from '@/lib/journeyStages'
import { useAuthStore } from '@/store/authStore'

// ─── S3 — بطاقة «الخطوة التالية» أسفل كل أداة استراتيجية ──────────
// تُوصي بالأداة التالية في نفس المرحلة إذا كانت موجودة، وإلا بالأداة
// النجمية (⭐) من المرحلة التالية. نقاط الاتصال:
//   • داخل المرحلة: نستخدم toolPaths كتسلسل صريح.
//   • بين المراحل: نستخدم starredPaths[0] من المرحلة اللاحقة.

interface Props {
  clientQuery?: string
}

function findStage(pathname: string): { stage: JourneyStage; index: number } | null {
  for (const s of JOURNEY_STAGES) {
    const idx = s.toolPaths.findIndex((p) => pathname === p || pathname.startsWith(p + '/'))
    if (idx >= 0) return { stage: s, index: idx }
  }
  return null
}

export function NextStepCard({ clientQuery = '' }: Props) {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    user?.specialtyDeptType != null
  const cur = findStage(pathname)
  if (!cur) return null

  // نُصفّي أدوات المرحلة الحالية حسب السياق (نحذف نسخ الشركة للمدير المستقل).
  const filteredPaths = filterToolsForUser(cur.stage.toolPaths, isDeptScoped)
  const currentIdx = filteredPaths.indexOf(cur.stage.toolPaths[cur.index])
  // لو المسار الحالي غير موجود في المُصفَّى (لا يجب أن يحدث بعد التصفية)، نستخدم index=-1.

  let nextPath: string | null = null
  let stageIcon = cur.stage.icon
  let stageLabel = 'داخل نفس المرحلة'

  // الأولوية 1: الأداة التالية في نفس المرحلة (بعد التصفية).
  if (currentIdx >= 0 && currentIdx + 1 < filteredPaths.length) {
    nextPath = filteredPaths[currentIdx + 1]
  } else {
    // الأولوية 2: أوّل أداة نجمية (مُصفَّاة) في المرحلة التالية.
    const next = JOURNEY_STAGES.find((s) => s.order === cur.stage.order + 1)
    if (next) {
      const nextFiltered = filterToolsForUser(next.starredPaths, isDeptScoped)
      const nextAll = filterToolsForUser(next.toolPaths, isDeptScoped)
      nextPath = nextFiltered[0] ?? nextAll[0] ?? null
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
