import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { billingPortal, createCheckout, listPlans, type PlanSummary, type PlanTier } from '@/lib/paymentsApi'
import { useAuthStore } from '@/store/authStore'

const TIER_GRADIENT: Record<PlanTier, string> = {
  BASIC:        'from-sky-500/10 to-transparent border-sky-200',
  PROFESSIONAL: 'from-primary/15 to-violet-500/10 border-primary',
  ENTERPRISE:   'from-emerald-500/10 to-transparent border-emerald-200',
}

const TIER_BLURB: Record<PlanTier, string> = {
  BASIC:        'محرك التشخيص + مسار استراتيجي واحد. مثالي لتجربة ستارتكس.',
  PROFESSIONAL: 'دورة كاملة، 13 إدارة، تحليل ذكي، وتصدير التقارير.',
  ENTERPRISE:   'محافظ متعددة الكيانات، تسجيل دخول موحّد، ومدير نجاح مخصّص.',
}

export function PricingPage() {
  const user = useAuthStore((s) => s.user)
  const isAuthed = useAuthStore((s) => s.isAuthenticated)
  const [plans, setPlans] = useState<PlanSummary[] | null>(null)
  const [stripeReady, setStripeReady] = useState(false)
  const [checkingOut, setCheckingOut] = useState<PlanTier | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    listPlans().then((r) => { setPlans(r.plans); setStripeReady(r.stripeReady) }).catch(() => undefined)
  }, [])

  useEffect(() => {
    const status = searchParams.get('status')
    if (status === 'success') {
      toast.success('تمت ترقية باقتك — قد يستغرق التحديث ثوانٍ.')
      searchParams.delete('status')
      searchParams.delete('session_id')
      setSearchParams(searchParams, { replace: true })
    } else if (status === 'cancelled') {
      toast.message('تم إلغاء عملية الدفع.')
      searchParams.delete('status')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  async function upgrade(tier: PlanTier) {
    if (tier === 'BASIC') return
    if (!isAuthed) {
      toast.message('سجّل الدخول أولاً ليتم ربط الباقة بحسابك.')
      return
    }
    setCheckingOut(tier)
    try {
      const { url } = await createCheckout(tier as 'PROFESSIONAL' | 'ENTERPRISE')
      if (url) {
        window.location.href = url
      } else {
        throw new Error('لم يصل رابط الدفع من الخادم')
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر فتح صفحة الدفع'))
    } finally {
      setCheckingOut(null)
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    try {
      const { url } = await billingPortal()
      window.location.href = url
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر فتح بوابة الفوترة'))
    } finally {
      setPortalLoading(false)
    }
  }

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
        {user && user.plan !== 'BASIC' && (
          <Button variant="outline" className="mt-4" onClick={openPortal} disabled={portalLoading}>
            {portalLoading ? 'جاري الفتح…' : '⚙️ إدارة الاشتراك في بوابة Stripe'}
          </Button>
        )}
      </header>

      {!plans && (
        <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>
      )}

      {plans && (
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((p) => {
            const tier = p.tier
            const isCurrent = user?.plan === tier
            const isHighlighted = tier === 'PROFESSIONAL'
            const canCheckout = stripeReady && p.selfServe && !isCurrent && tier !== 'BASIC'

            const cta = isCurrent
              ? 'باقتك الحالية'
              : tier === 'BASIC'
                ? 'ابدأ مجاناً'
                : tier === 'ENTERPRISE' && !p.selfServe
                  ? 'تواصل مع المبيعات'
                  : 'اختر هذه الباقة'

            return (
              <Card
                key={tier}
                className={`overflow-hidden bg-gradient-to-br ${TIER_GRADIENT[tier]} ${isHighlighted ? 'shadow-lg ring-2 ring-primary/20' : ''} ${isCurrent ? 'ring-2 ring-emerald-500/40' : ''}`}
              >
                {isHighlighted && !isCurrent && (
                  <div className="bg-primary px-4 py-1 text-center text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                    الأكثر اختياراً
                  </div>
                )}
                {isCurrent && (
                  <div className="bg-emerald-500 px-4 py-1 text-center text-xs font-semibold uppercase tracking-wider text-white">
                    باقتك الحالية ✓
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{p.labelAr}</CardTitle>
                  <CardDescription className="leading-relaxed">{TIER_BLURB[tier]}</CardDescription>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground tabular-nums">{p.priceLabelAr}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-2 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span aria-hidden className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {canCheckout ? (
                    <Button
                      className="w-full"
                      variant={isHighlighted ? 'default' : 'outline'}
                      onClick={() => upgrade(tier)}
                      disabled={checkingOut !== null}
                    >
                      {checkingOut === tier ? 'جاري الفتح…' : cta}
                    </Button>
                  ) : tier === 'BASIC' && !isCurrent ? (
                    <Link
                      to={isAuthed ? '/dashboard' : '/select-type'}
                      className={buttonVariants({ variant: 'outline', className: 'w-full' })}
                    >
                      {cta}
                    </Link>
                  ) : tier === 'ENTERPRISE' ? (
                    <a
                      href="mailto:sales@startix.sa?subject=باقة%20مؤسسية"
                      className={buttonVariants({ variant: 'outline', className: 'w-full' })}
                    >
                      {cta}
                    </a>
                  ) : (
                    <Button className="w-full" variant="outline" disabled>{cta}</Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {!stripeReady && (
        <p className="text-center text-xs text-muted-foreground">
          ⚠️ ميزة الدفع غير مفعّلة — أضف <code className="rounded bg-card px-1">STRIPE_SECRET_KEY</code> ومعرّفات الأسعار في <code className="rounded bg-card px-1">server/.env</code> لتفعيلها.
        </p>
      )}
    </div>
  )
}
