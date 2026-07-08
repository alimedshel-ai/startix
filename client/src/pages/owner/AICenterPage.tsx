import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { getMyFirstCompany } from '@/lib/deptApi'
import {
  generateRecommendations,
  listRecommendations,
  SOURCE_LABEL,
  type Recommendation,
  type RecommendationSeverity,
} from '@/lib/insightApi'

const SEVERITY_TONE: Record<RecommendationSeverity, string> = {
  info: 'border-sky-500/30 bg-sky-500/5 text-sky-800 dark:text-sky-200',
  warning: 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200',
  critical: 'border-rose-500/30 bg-rose-500/5 text-rose-800 dark:text-rose-200',
}

const SEVERITY_ICON: Record<RecommendationSeverity, string> = {
  info: '💡',
  warning: '⚠️',
  critical: '🔴',
}

const SEVERITY_LABEL: Record<RecommendationSeverity, string> = {
  info: 'إشارة',
  warning: 'تحذير',
  critical: 'حرج',
}

interface Tool {
  to: string
  title: string
  desc: string
  icon: string
  accent: string
  badge?: string
}

const TOOLS: Tool[] = [
  {
    to: '/ai/advisor',
    title: 'المستشار الاستراتيجي',
    desc: 'محادثة مفتوحة مع Claude — اسأل عن استراتيجيتك، عملياتك، أو خياراتك القادمة.',
    icon: '💬',
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    to: '/ai/presentation',
    title: 'مولّد العروض التقديمية',
    desc: 'توليد محتوى عرض احترافي من بيانات شركتك بضغطة زر.',
    icon: '🎞️',
    accent: 'from-rose-500 to-orange-500',
    badge: 'دفعة 2',
  },
  {
    to: '/ai/pain-screen',
    title: 'فحص نقاط الألم',
    desc: '٥ أسئلة سريعة → Claude يحدد أهم ٣ نقاط ألم في عملك ويوصي بأدوات حلها.',
    icon: '🩺',
    accent: 'from-amber-500 to-orange-500',
    badge: 'دفعة 2',
  },
  {
    to: '/tows',
    title: 'توليد استراتيجيات TOWS',
    desc: 'يمزج SWOT الحالي وينتج 8-12 استراتيجية تنفيذية موزّعة على الأرباع الأربعة.',
    icon: '🔄',
    accent: 'from-sky-500 to-indigo-500',
  },
  {
    to: '/ai/simulation',
    title: 'مختبر المحاكاة',
    desc: 'سيناريوهات "ماذا لو" — اضبط معدلات النمو والتكاليف لرؤية العائد ونقطة التعادل.',
    icon: '🧪',
    accent: 'from-emerald-500 to-teal-500',
    badge: 'دفعة 3',
  },
  {
    to: '/analytics-dashboard',
    title: 'التوقعات والتحليلات',
    desc: 'تنبؤ 90 يوم لكل مؤشر + خريطة حرارية للمخاطر + تنبيهات تلقائية.',
    icon: '🔮',
    accent: 'from-indigo-500 to-violet-500',
    badge: 'دفعة 3',
  },
]

export function AICenterPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="مركز الذكاء الاصطناعي"
        description="مجموعة أدوات تعتمد على Claude لمساعدتك في اتخاذ قرارات أسرع وأذكى."
      />

      <Card className="overflow-hidden border-violet-200 bg-gradient-to-bl from-violet-500/10 via-fuchsia-500/5 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-violet-500 via-fuchsia-500 to-rose-500" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            مدعومة بـ Claude
          </CardTitle>
          <CardDescription>
            كل الطلبات تمرّ بالخادم لحماية مفتاح API. تأكد من ضبط <code className="rounded bg-card px-1">ANTHROPIC_API_KEY</code> في <code className="rounded bg-card px-1">server/.env</code>.
          </CardDescription>
        </CardHeader>
      </Card>

      <InsightPanel />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className={`pointer-events-none absolute -left-6 -top-6 size-24 rounded-full bg-gradient-to-bl ${t.accent} opacity-20 blur-2xl transition group-hover:opacity-40`} />
            <div className="relative">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-3xl">{t.icon}</span>
                {t.badge && (
                  <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                    {t.badge}
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold transition group-hover:text-primary">{t.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── لوحة توصيات محرك الاستدلال (C16) ──────────────────────────────────────
// توصيات حتمية من قواعد تقرأ Diagnostic + DeptAudit + BreakEven.
function InsightPanel() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Recommendation[]>([])
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const { company } = await getMyFirstCompany()
        if (cancel || !company) return
        setCompanyId(company.id)
        const rows = await listRecommendations(company.id)
        if (!cancel) setItems(rows)
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل التوصيات'))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [])

  async function generate() {
    if (!companyId) return
    setRunning(true)
    try {
      const res = await generateRecommendations(companyId)
      setItems(res.recommendations)
      toast.success(
        res.generated === 0
          ? 'لا توصيات جديدة — أضف تشخيصاً أو تدقيقاً لتفعيل القواعد.'
          : `تم توليد ${res.generated} توصية`
      )
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر توليد التوصيات'))
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <LoadingSpinner size="md" label="جاري تحميل التوصيات…" />
        </CardContent>
      </Card>
    )
  }

  if (!companyId) return null

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xl">🧭</span>
            توصيات محرك الاستدلال
          </CardTitle>
          <CardDescription>
            قواعد حتمية تربط تشخيصك بتدقيق الأقسام والنتائج المالية — بلا حاجة لمفتاح AI.
          </CardDescription>
        </div>
        <Button onClick={generate} disabled={running}>
          {running ? 'جاري التحليل…' : items.length === 0 ? 'شغّل التحليل' : 'تحديث'}
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            title="لا توجد توصيات بعد"
            description="اضغط «شغّل التحليل» بعد إكمال تشخيصك أو تدقيق قسم واحد على الأقل."
            icon={<span className="text-4xl">🧭</span>}
          />
        ) : (
          <ul className="grid gap-2">
            {items.map((r) => (
              <li key={r.id} className={`rounded-xl border p-3 text-sm ${SEVERITY_TONE[r.severity]}`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none">{SEVERITY_ICON[r.severity]}</span>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium leading-snug">{r.message}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] opacity-80">
                      <span className="rounded-full border px-2 py-0.5">{SEVERITY_LABEL[r.severity]}</span>
                      <span className="rounded-full border px-2 py-0.5">مصدر: {SOURCE_LABEL[r.source]}</span>
                      <span>{new Date(r.createdAt).toLocaleString('ar-SA')}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
