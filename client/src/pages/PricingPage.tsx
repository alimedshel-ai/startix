import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const TIERS = [
  {
    name: 'Basic',
    price: 'Free',
    period: '',
    blurb: 'Diagnostic engine + 1 strategic path. Perfect for trying Startix.',
    features: [
      'Owner / Manager / Investor diagnostic',
      '1 strategic path',
      'Up to 1 company',
      'Email support',
    ],
    cta: 'Start free',
    href: '/select-type',
    highlight: false,
  },
  {
    name: 'Professional',
    price: '199 SAR',
    period: '/ month',
    blurb: 'Full lifecycle, 13 department audits, AI analysis, exports.',
    features: [
      'All Basic features',
      '5 strategic paths',
      '13 department audits',
      'AI advisor (Claude)',
      'PDF + Excel exports',
      'Up to 5 companies',
    ],
    cta: 'Choose Professional',
    href: '/select-type',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    blurb: 'Multi-entity portfolios, SSO, dedicated success manager.',
    features: [
      'Unlimited companies',
      'Multi-entity dashboards',
      'SSO + custom roles',
      'Compliance audit (Pro)',
      'Dedicated onboarding',
    ],
    cta: 'Contact sales',
    href: '/select-type',
    highlight: false,
  },
]

export function PricingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-16">
      <header className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Simple pricing for serious strategy</h1>
        <p className="mt-3 text-muted-foreground">
          All prices in SAR. Switch or cancel any time.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {TIERS.map((t) => (
          <Card
            key={t.name}
            className={t.highlight ? 'border-primary shadow-lg' : undefined}
          >
            <CardHeader>
              <CardTitle>{t.name}</CardTitle>
              <CardDescription>{t.blurb}</CardDescription>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-foreground">{t.price}</span>
                {t.period && <span className="text-muted-foreground">{t.period}</span>}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                    {f}
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
