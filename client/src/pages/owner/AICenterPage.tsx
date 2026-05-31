import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
