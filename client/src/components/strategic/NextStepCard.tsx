import { Link, useLocation } from 'react-router-dom'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { JOURNEY_STAGES, type JourneyStage } from '@/lib/journeyStages'

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
  const cur = findStage(pathname)
  if (!cur) return null

  // الأولوية 1: الأداة التالية في نفس المرحلة (إن وُجدت).
  let nextPath: string | null = null
  let stageIcon = cur.stage.icon
  let stageLabel = 'داخل نفس المرحلة'

  if (cur.index + 1 < cur.stage.toolPaths.length) {
    nextPath = cur.stage.toolPaths[cur.index + 1]
  } else {
    // الأولوية 2: أوّل أداة نجمية في المرحلة التالية.
    const next = JOURNEY_STAGES.find((s) => s.order === cur.stage.order + 1)
    if (next) {
      nextPath = next.starredPaths[0] ?? next.toolPaths[0]
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
