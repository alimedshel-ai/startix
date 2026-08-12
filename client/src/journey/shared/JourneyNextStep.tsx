import { Link } from 'react-router-dom'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useGuidedNext } from '@/hooks/useGuidedNext'

// ─── بطاقة «الخطوة التالية في مسارك» للأدوات المساندة (خارج المراحل) ──
// مصدر واحد: تقرأ من useGuidedNext (نفس ما تقرأه القمرة · السايد بار · NextStepCard)
// بدل useJourney — فلا «خطوة تالية» بمنطقٍ مختلف عن بقيّة المنصّة. الوجهة next.to
// كاملةٌ (تتضمّن ?client) فلا نُلحِق clientQuery. لا رابط ⇒ لا بطاقة (كـNextStepCard).

interface Props {
  companyId: string | null
  /** موروثٌ للتوافق مع مواضع الاستدعاء — الوجهة تأتي كاملةً من useGuidedNext.to. */
  clientQuery?: string
}

export function JourneyNextStep({ companyId }: Props) {
  const { loading, next } = useGuidedNext(companyId)
  if (loading || !next || !next.to) return null

  return (
    <Card className="border-primary/30 bg-gradient-to-l from-primary/10 to-primary/5">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs">الخطوة التالية في مسارك</CardDescription>
        <CardTitle className="flex items-center gap-2 text-base">
          <span aria-hidden>{next.icon}</span>
          <span>{next.label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="max-w-md text-xs text-muted-foreground">{next.reason}</p>
        <Link
          to={next.to}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
        >
          افتحها الآن ←
        </Link>
      </CardContent>
    </Card>
  )
}
