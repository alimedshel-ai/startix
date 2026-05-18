import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const TIERS = [
  {
    name: 'الأساسي',
    price: 'مجاناً',
    period: '',
    blurb: 'محرك التشخيص + مسار استراتيجي واحد. مثالي لتجربة ستارتكس.',
    features: [
      'تشخيص: مالك / مدير / مستثمر',
      'مسار استراتيجي واحد',
      'حتى شركة واحدة',
      'دعم عبر البريد',
    ],
    cta: 'ابدأ مجاناً',
    href: '/select-type',
    highlight: false,
    gradient: 'from-sky-500/10 to-transparent border-sky-200',
  },
  {
    name: 'الاحترافي',
    price: '199 ر.س',
    period: '/ شهرياً',
    blurb: 'دورة كاملة، 13 إدارة، تحليل ذكي، وتصدير التقارير.',
    features: [
      'كل ميزات الأساسي',
      '5 مسارات استراتيجية',
      'تدقيق 13 إدارة',
      'مستشار ذكي (Claude)',
      'تصدير PDF و Excel',
      'حتى 5 شركات',
    ],
    cta: 'اختر الاحترافي',
    href: '/select-type',
    highlight: true,
    gradient: 'from-primary/15 to-violet-500/10 border-primary',
  },
  {
    name: 'المؤسسي',
    price: 'مخصص',
    period: '',
    blurb: 'محافظ متعددة الكيانات، تسجيل دخول موحّد، ومدير نجاح مخصّص.',
    features: [
      'شركات غير محدودة',
      'لوحات متعددة الكيانات',
      'SSO + أدوار مخصصة',
      'تدقيق الامتثال (احترافي)',
      'إعداد مخصص',
    ],
    cta: 'تواصل مع المبيعات',
    href: '/select-type',
    highlight: false,
    gradient: 'from-emerald-500/10 to-transparent border-emerald-200',
  },
]

export function PricingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-16">
      <header className="text-center">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← العودة للصفحة الرئيسية
        </Link>
        <h1 className="text-balance text-4xl font-bold tracking-tight">أسعار بسيطة لاستراتيجية جادة</h1>
        <p className="mt-3 text-muted-foreground">
          جميع الأسعار بالريال السعودي. تستطيع التبديل أو الإلغاء في أي وقت.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {TIERS.map((t) => (
          <Card
            key={t.name}
            className={`overflow-hidden bg-gradient-to-br ${t.gradient} ${t.highlight ? 'shadow-lg ring-2 ring-primary/20' : ''}`}
          >
            {t.highlight && (
              <div className="bg-primary px-4 py-1 text-center text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                الأكثر اختياراً
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-xl">{t.name}</CardTitle>
              <CardDescription className="leading-relaxed">{t.blurb}</CardDescription>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground tabular-nums">{t.price}</span>
                {t.period && <span className="text-sm text-muted-foreground">{t.period}</span>}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span aria-hidden className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Link
                to={t.href}
                className={buttonVariants({
                  variant: t.highlight ? 'default' : 'outline',
                  className: 'w-full',
                })}
              >
                {t.cta}
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
