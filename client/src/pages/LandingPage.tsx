import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'

const FEATURES = [
  {
    title: 'تشخيص استراتيجي',
    body: 'تشخيص من ثلاث زوايا — مالك، مدير، مستثمر — مع تحليل ذكي مدعوم بالذكاء الاصطناعي.',
    icon: '🎯',
  },
  {
    title: '١٣ إدارة في مكان واحد',
    body: 'تدقيق وتقييم الموارد البشرية والمالية والمبيعات والامتثال وعشر إدارات أخرى.',
    icon: '🏢',
  },
  {
    title: 'الامتثال السعودي',
    body: 'منظمون سعوديون محملون مسبقاً، مع تقدير دقيق للعقوبات وخطة إصلاح ١٢ أسبوعاً.',
    icon: '⚖️',
  },
  {
    title: 'مؤشرات أداء حية',
    body: 'مؤشرات تحدّث آنياً، مع لوحات قيادة لكل قسم وتنبيهات تلقائية.',
    icon: '📊',
  },
]

const STATS = [
  { value: '٧٢', label: 'نقطة في تقييم النضج' },
  { value: '١٣', label: 'إدارة مدققة' },
  { value: '٥', label: 'مسارات استراتيجية' },
  { value: '٧', label: 'مراحل دورة حياة' },
]

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">س</div>
            <span className="text-lg font-semibold tracking-tight">ستارتكس</span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link to="/pricing" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              الأسعار
            </Link>
            <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              تسجيل الدخول
            </Link>
            <Link to="/select-type" className={buttonVariants({ size: 'sm' })}>
              ابدأ الآن
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--color-accent)_0%,transparent_50%)] opacity-60" />
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="inline-block size-1.5 rounded-full bg-primary" />
              منصة الإدارة الاستراتيجية للسوق السعودي
            </div>
            <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              الاستراتيجية التي تدير أعمالك،
              <br />
              لا التي تديرك.
            </h1>
            <p className="max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              ستارتكس تساعد الشركات السعودية على التشخيص والتخطيط والتنفيذ عبر ١٣ إدارة — مع امتثال مدمج،
              تحليل ذكي، ومراجعات ربعية.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link to="/diagnostic/try" className={buttonVariants({ size: 'lg' })}>
                جرّب التشخيص · بدون تسجيل
              </Link>
              <Link to="/pricing" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
                عرض الأسعار
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              9 خطوات · نتيجة فورية · تنحفظ في حسابك عند التسجيل
            </p>

            <div className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-1">
                  <div className="text-3xl font-bold text-primary tabular-nums">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-secondary/30 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-2xl font-semibold sm:text-3xl">كل ما تحتاجه لإدارة استراتيجية حديثة</h2>
              <p className="mt-3 text-muted-foreground">
                من التشخيص إلى التنفيذ — نظام متكامل يربط الإدارات بالأهداف بالنتائج.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="group relative rounded-xl border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-3 text-2xl">{f.icon}</div>
                  <h3 className="mb-2 text-base font-semibold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA strip */}
        <section className="border-t py-16">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">جاهز تنقل شركتك للمرحلة التالية؟</h2>
            <p className="max-w-xl text-muted-foreground">
              ابدأ بتشخيص مجاني واكتشف مسارك الاستراتيجي خلال خمس دقائق.
            </p>
            <Link to="/diagnostic/try" className={buttonVariants({ size: 'lg' })}>
              ابدأ التشخيص المجاني
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} ستارتكس. جميع الحقوق محفوظة.</span>
          <div className="flex gap-4">
            <Link to="/pricing" className="hover:text-foreground">الأسعار</Link>
            <Link to="/login" className="hover:text-foreground">تسجيل الدخول</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
