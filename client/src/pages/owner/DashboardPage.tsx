import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { NextStepCard } from '@/components/strategic/NextStepCard'
import { DashboardTabs } from '@/components/strategic/DashboardTabs'
import { listMyCompanies, listDepartments, dangerZoneColor, type CompanyWithRole, type Department } from '@/lib/deptApi'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type { OwnerDiagnosticResult } from '@/lib/diagnosticQuestions'
import { useDiagnosticStore } from '@/store/diagnosticStore'

interface StatCard {
  label: string
  value: string
  helper: string
  accent: 'teal' | 'indigo' | 'amber' | 'emerald' | 'rose' | 'violet'
  icon: string
}

const ACCENT_BG: Record<StatCard['accent'], string> = {
  teal:    'from-teal-500/10 to-teal-500/0 border-teal-200',
  indigo:  'from-indigo-500/10 to-indigo-500/0 border-indigo-200',
  amber:   'from-amber-500/10 to-amber-500/0 border-amber-200',
  emerald: 'from-emerald-500/10 to-emerald-500/0 border-emerald-200',
  rose:    'from-rose-500/10 to-rose-500/0 border-rose-200',
  violet:  'from-violet-500/10 to-violet-500/0 border-violet-200',
}
const ACCENT_TEXT: Record<StatCard['accent'], string> = {
  teal: 'text-teal-700', indigo: 'text-indigo-700', amber: 'text-amber-700',
  emerald: 'text-emerald-700', rose: 'text-rose-700', violet: 'text-violet-700',
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const storeResult = useDiagnosticStore((s) => s.ownerResult)
  const setResult = useDiagnosticStore((s) => s.setOwnerResult)

  const [companies, setCompanies] = useState<CompanyWithRole[]>([])
  const [depts, setDepts] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const co = await listMyCompanies()
        if (cancel) return
        setCompanies(co)
        if (co[0]) {
          const d = await listDepartments(co[0].id)
          if (!cancel) setDepts(d)
        }
        if (!storeResult) {
          const { data } = await api.get<{ result: OwnerDiagnosticResult | null }>('/api/diagnostic/me/latest')
          if (!cancel && data.result) setResult(data.result)
        }
      } catch {
        // ignore — dashboard tiles handle empty gracefully
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [storeResult, setResult])

  const result = storeResult
  const audited = depts.filter((d) => d.auditScore != null)
  const avgHealth = audited.length === 0 ? 0 : Math.round(audited.reduce((s, d) => s + (d.auditScore ?? 0), 0) / audited.length)

  const stats: StatCard[] = [
    { label: 'الشركات', value: companies.length.toString(), helper: 'شركة في حسابك', accent: 'indigo', icon: '🏢' },
    { label: 'إدارات مدققة', value: `${audited.length}/${depts.length || 13}`, helper: 'إدارة مكتملة', accent: 'teal', icon: '✅' },
    { label: 'الصحة العامة', value: `${result?.maturityScore ?? avgHealth}%`, helper: 'نضج استراتيجي', accent: 'emerald', icon: '❤️' },
    { label: 'المسار', value: pathLabel(result?.strategicPath), helper: 'المسار الموصى به', accent: 'violet', icon: '🎯' },
  ]

  const quickStart = [
    { to: '/diagnostic/owner', title: 'ابدأ تشخيص جديد', desc: 'حدد مسارك الاستراتيجي خلال ٥ دقائق.', icon: '🎯', accent: 'sky' },
    { to: '/companies/add', title: 'أضف شركة', desc: 'سجل كيان جديد لتدير استراتيجيته.', icon: '➕', accent: 'indigo' },
    { to: '/objectives', title: 'حدد أهدافك', desc: 'أنشئ ٥-٧ أهداف SMART مرتبطة بالاتجاه.', icon: '🏆', accent: 'amber' },
    { to: '/kpis', title: 'عرّف مؤشرات الأداء', desc: 'KPIs لكل إدارة + لكل هدف.', icon: '📊', accent: 'emerald' },
  ] as const

  return (
    <div className="flex flex-col gap-6">
      {/* Hero greeting */}
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-bl from-primary/10 via-card to-violet-500/5 p-6 sm:p-8">
        <div className="pointer-events-none absolute -left-10 -top-10 size-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 -bottom-10 size-40 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-primary">مرحباً بعودتك 👋</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{user?.name ?? '—'}</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              لوحة قيادتك الاستراتيجية. تابع صحة الشركة، نفذ مبادراتك، وراجع الأداء.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/diagnostic/owner" className={buttonVariants()}>ابدأ التشخيص</Link>
            <Link to="/company-health" className={buttonVariants({ variant: 'outline' })}>
              لوحة الصحة
            </Link>
          </div>
        </div>
      </section>

      {/* أ٣ — شريط التبويبات الموحّد: نظرة عامّة + لوحات القيادة كتبويبات
          داخل بيت واحد بدل ست وجهات متنافسة في السايدبار. */}
      <DashboardTabs />

      {/* أ١ — منارة «خطوتك التالية»: مصدر واحد (useGuidedNext) يعرض خطوة
          واحدة بالأولوية فوق الأرقام، فلا يهبط المالك على أصفار وأزرار
          متساوية بلا معرفة أيّها أوّلاً. المكوّن نفسه المستخدَم في القمرة
          والسايدبار — إعادة استخدام لا استنساخ. */}
      {companies[0] && <NextStepCard companyId={companies[0].id} />}

      {/* Stat cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-bl ${ACCENT_BG[s.accent]} p-4 transition hover:shadow-md`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
                <div className={`mt-2 text-3xl font-bold tabular-nums ${ACCENT_TEXT[s.accent]}`}>
                  {loading ? '—' : s.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{s.helper}</div>
              </div>
              <div className="text-2xl opacity-80">{s.icon}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick start */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>ابدأ بسرعة</CardTitle>
            <CardDescription>الخطوات الموصى بها لإكمال إعداد منصتك.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {quickStart.map((q) => (
                <Link
                  key={q.to}
                  to={q.to}
                  className="group flex items-start gap-3 rounded-xl border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-xl">
                    {q.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold transition group-hover:text-primary">{q.title}</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{q.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Health snapshot */}
        <Card>
          <CardHeader>
            <CardTitle>صحة الإدارات</CardTitle>
            <CardDescription>{audited.length} مدققة من {depts.length || 13}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums text-primary">{avgHealth}%</span>
              <span className="text-xs text-muted-foreground">المتوسط</span>
            </div>
            <Progress value={avgHealth} className="h-2" />
            <ul className="space-y-1.5 pt-2 text-sm">
              {audited.slice(0, 4).map((d) => (
                <li key={d.id} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{d.type}</span>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${dangerZoneColor(d.auditData?.dangerZone ?? 'GREEN')}`}>
                    {Math.round(d.auditScore ?? 0)}%
                  </span>
                </li>
              ))}
              {audited.length === 0 && (
                <li className="text-xs text-muted-foreground">
                  لا توجد إدارات مدققة بعد. <Link to="/manager/select-dept" className="text-primary underline">ابدأ التدقيق</Link>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Footer prompts */}
      <section className="grid gap-3 sm:grid-cols-3">
        <PromoCard
          accent="from-teal-500 to-emerald-500"
          icon="🤖"
          title="مركز الذكاء الاصطناعي"
          desc="استشر Claude في تحليلاتك وتقاريرك."
          to="/ai-center"
        />
        <PromoCard
          accent="from-amber-500 to-orange-500"
          icon="📊"
          title="عرض التحليلات"
          desc="رسوم بيانية متقدمة عبر المحفظة."
          to="/analytics-dashboard"
        />
        <PromoCard
          accent="from-violet-500 to-fuchsia-500"
          icon="📑"
          title="التقارير"
          desc="تصدير PDF/Excel للأطراف المعنية."
          to="/reports"
        />
      </section>
    </div>
  )
}

function PromoCard({ accent, icon, title, desc, to }: { accent: string; icon: string; title: string; desc: string; to: string }) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={`pointer-events-none absolute -left-4 -top-4 size-20 rounded-full bg-gradient-to-bl ${accent} opacity-20 blur-2xl transition group-hover:opacity-40`} />
      <div className="relative">
        <div className="text-2xl">{icon}</div>
        <div className="mt-2 text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </Link>
  )
}

function pathLabel(p?: string): string {
  switch (p) {
    case 'EMERGENCY_RISK': return 'إنقاذ'
    case 'NASCENT_CAUTIOUS': return 'نشأة'
    case 'GROWING_CHAOTIC': return 'نمو'
    case 'MATURE_COMPETITIVE': return 'نضج'
    case 'DEFAULT_STRATEGIC': return 'افتراضي'
    default: return '—'
  }
}
