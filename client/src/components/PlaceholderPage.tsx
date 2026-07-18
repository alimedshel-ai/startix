import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// ─── PlaceholderPage — صفحة موحّدة للعناصر المخطّطة بلا بناء ────────
// المبدأ (SIDEBAR-STRUCTURE.md): بادج «⏳ قريباً» يحجز المكان الذهني
// بلا كسر. لا رمادي (يُقرأ «مقفلٌ لصلاحيّة»)، ولا 404 (يُقرأ «مفقود»).
// صفحة الشرح تُثبّت الوعد بلا فقدان الثقة.

export function PlaceholderPage({
  title,
  reason,
  icon = '⏳',
  backTo = '/',
  backLabel = '← عد',
  relatedLinks = [],
}: {
  title: string
  reason: string
  icon?: string
  backTo?: string
  backLabel?: string
  relatedLinks?: { to: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description="مخطّطة عن قصد — قريباً" />

      <Card className="border-2 border-indigo-300 bg-gradient-to-l from-indigo-500/10 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <span className="text-3xl">{icon}</span>
            <span>قريباً</span>
            <span className="rounded-full border border-indigo-400 bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
              مخطّطة عن قصد
            </span>
          </CardTitle>
          <CardDescription className="mt-2 text-sm leading-relaxed">
            {reason}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed bg-white/70 p-3 text-xs leading-relaxed text-muted-foreground">
            <b className="text-foreground">💡 لماذا نُظهرها الآن؟</b>{' '}
            «لا شيء يُدفَن» — نُبقي الوعد ظاهراً حتّى تجد مكانه الذهني قبل أن يصل الكود.
            هذا يمنع تشتّت الأدوات لاحقاً ويحفظ الاتّساق الاستراتيجي.
          </div>

          {relatedLinks.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                روابط ذات صلة (متاحة الآن)
              </div>
              <div className="flex flex-wrap gap-2">
                {relatedLinks.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
                  >
                    {l.label} →
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Link
              to={backTo}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-muted"
            >
              {backLabel}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
