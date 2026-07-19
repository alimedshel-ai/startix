import { Link } from 'react-router-dom'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useJourney } from '@/hooks/useJourney'
import { JOURNEY_STAGES } from '@/lib/journeyStages'

// ─── بطاقة «الخطوة التالية في مسارك» للأدوات المساندة (خارج المراحل) ──
// أدوات مثل التحليل المالي ليست مرحلةً في المسار، فبطاقة NextStepCard
// المعتمدة على المرحلة لا تظهر عليها — فيتوه المستخدم «وش يجي بعدها؟».
// هذه البطاقة تقرأ من useJourney() وتعرض المرحلة التالية غير المكتملة في
// مسار خطة المستخدم (أو التنفيذ/المتابعة إن اكتمل المسار) — إجراء واحد واضح.

const STAGE_ICON: Record<string, string> = Object.fromEntries(
  JOURNEY_STAGES.map((s) => [s.id, s.icon]),
)

interface Props {
  companyId: string | null
  /** لتمرير سياق العميل في الرابط (?client=<id>). */
  clientQuery?: string
}

export function JourneyNextStep({ companyId, clientQuery = '' }: Props) {
  const { loading, nextStage } = useJourney(companyId)
  if (loading) return null

  // المسار مكتمل → لا مرحلة تالية: وجّه للتنفيذ/المتابعة كخطوة مستمرّة.
  const done = !nextStage
  const href = nextStage?.href ?? '/execute'
  const icon = nextStage ? STAGE_ICON[nextStage.stageId] ?? '🚀' : '🚀'
  const title = nextStage?.titleAr ?? '⑥ التنفيذ والمتابعة'
  const emphasis = nextStage?.emphasisAr
    ?? 'أكملت مراحل مسارك — تابِع التنفيذ وراقب المؤشّرات باستمرار.'

  return (
    <Card className="border-primary/30 bg-gradient-to-l from-primary/10 to-primary/5">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs">
          {done ? 'أكملت مسارك — الخطوة المستمرّة' : 'الخطوة التالية في مسارك'}
        </CardDescription>
        <CardTitle className="flex items-center gap-2 text-base">
          <span aria-hidden>{icon}</span>
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="max-w-md text-xs text-muted-foreground">{emphasis}</p>
        <Link
          to={`${href}${clientQuery}`}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
        >
          افتحها الآن ←
        </Link>
      </CardContent>
    </Card>
  )
}
