import { Link } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { pickStrategicPath, PATH_ACCENT_STYLES } from '@/lib/strategicPath'
import type { DangerZone } from '@/lib/deptApi'

// ─── بطاقة المسار الاستراتيجي على ClientDetailPage ─────────────────────
// تُقدّم توصية سريعة بأي خطة يجب اتّباعها لهذه الإدارة بناءً على صحّتها.
// المدير الخبير يفتحها → يدخل صفحة الخطة الكاملة `/manager/strategic-plan`.

interface Props {
  companyId: string
  companyName: string
  healthPct: number | null
  dangerZone: DangerZone | null
  hasAnyAudit: boolean
}

export function StrategicPathCard({
  companyId, companyName, healthPct, dangerZone, hasAnyAudit,
}: Props) {
  const path = pickStrategicPath({ healthPct, dangerZone, hasAnyAudit })
  const style = PATH_ACCENT_STYLES[path.accent]
  const planUrl = `/manager/strategic-plan?client=${companyId}`

  return (
    <Card className={`overflow-hidden ${style.border} ${style.bg}`}>
      <CardContent className="grid gap-4 p-5 md:grid-cols-[auto_1fr_auto] md:items-center">
        <div className="flex items-center gap-3">
          <span className="text-5xl leading-none" aria-hidden>{path.icon}</span>
          <div>
            <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${style.chip}`}>
              {path.urgencyLabel}
            </span>
            <h2 className={`mt-1 text-lg font-bold ${style.text}`}>{path.name}</h2>
            <p className="text-xs text-muted-foreground">
              {path.duration} · بناءً على صحة إدارة {companyName}
              {healthPct != null ? ` (${Math.round(healthPct)}٪)` : ''}
            </p>
          </div>
        </div>

        <div className="text-sm leading-relaxed md:mx-4">
          {path.description}
        </div>

        <Link
          to={planUrl}
          className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition ${style.chip} hover:opacity-90`}
        >
          {path.cta} ←
        </Link>
      </CardContent>
    </Card>
  )
}
