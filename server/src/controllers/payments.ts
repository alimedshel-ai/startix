import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import {
  PLANS,
  planFromPriceId,
  stripe,
  stripeConfigured,
  stripeWebhookConfigured,
  verifyStripeSignature,
} from '../lib/stripe';

const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';

function ensureStripe(): void {
  if (!stripeConfigured()) {
    throw new HttpError(503, 'لم يُعدّ مفتاح Stripe — أضف STRIPE_SECRET_KEY في server/.env');
  }
}

const checkoutSchema = z.object({
  plan: z.enum(['PROFESSIONAL', 'ENTERPRISE']),
});

// ─── GET /api/payments/plans — public plan catalog ──────────────────────────
export const listPlans: RequestHandler = async (_req, res) => {
  res.json({
    plans: PLANS.map((p) => ({
      tier: p.tier,
      labelAr: p.labelAr,
      priceLabelAr: p.priceLabelAr,
      priceSARMonthly: p.priceSARMonthly,
      features: p.features,
      selfServe: p.selfServe,
    })),
    stripeReady: stripeConfigured(),
  });
};

// ─── POST /api/payments/create-checkout ─────────────────────────────────────
export const createCheckout: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    ensureStripe();
    const body = checkoutSchema.parse(req.body);
    const plan = PLANS.find((p) => p.tier === body.plan);
    if (!plan?.priceId) {
      throw new HttpError(404, 'هذه الباقة غير قابلة للحجز ذاتياً — تواصل مع المبيعات');
    }

    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } });
    if (!user) throw new HttpError(404, 'المستخدم غير موجود');

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: plan.priceId, quantity: 1 }],
      customer_email: user.email,
      success_url: `${CLIENT_URL}/pricing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/pricing?status=cancelled`,
      client_reference_id: user.id,
      metadata: { userId: user.id, plan: plan.tier },
      subscription_data: {
        metadata: { userId: user.id, plan: plan.tier },
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/payments/portal — Stripe Billing Portal ───────────────────────
export const billingPortal: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    ensureStripe();
    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } });
    if (!user) throw new HttpError(404, 'المستخدم غير موجود');

    // Find existing customer by email (one customer per email is fine for v1)
    const customers = await stripe().customers.list({ email: user.email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) {
      throw new HttpError(404, 'لا يوجد اشتراك مرتبط بهذا الحساب');
    }

    const session = await stripe().billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${CLIENT_URL}/pricing`,
    });
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/payments/webhook ────────────────────────────────────────────
// Note: this handler expects `express.raw({ type: 'application/json' })` to be
// mounted *before* the global JSON parser. See server/src/index.ts.
export const stripeWebhook: RequestHandler = async (req, res) => {
  if (!stripeConfigured() || !stripeWebhookConfigured()) {
    res.status(503).json({ error: 'Stripe غير مفعّل على السيرفر' });
    return;
  }
  const signature = req.headers['stripe-signature'];
  if (!signature || Array.isArray(signature)) {
    res.status(400).send('Missing stripe-signature header');
    return;
  }

  let event: ReturnType<typeof verifyStripeSignature>;
  try {
    event = verifyStripeSignature(req.body as Buffer, signature);
  } catch (err) {
    res.status(400).send(`Webhook signature failed: ${(err as Error).message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as { metadata?: { userId?: string; plan?: string }; client_reference_id?: string | null }
        const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
        const plan = session.metadata?.plan;
        if (userId && (plan === 'PROFESSIONAL' || plan === 'ENTERPRISE')) {
          await prisma.user.update({
            where: { id: userId },
            data: { plan, planExpiresAt: null },
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as { metadata?: { userId?: string }; items: { data: { price: { id: string } }[] }; cancel_at: number | null }
        const userId = sub.metadata?.userId ?? null;
        if (userId) {
          const priceId = sub.items.data[0]?.price?.id;
          const newPlan = planFromPriceId(priceId);
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: newPlan ?? 'BASIC',
              planExpiresAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
            },
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as { metadata?: { userId?: string } }
        const userId = sub.metadata?.userId ?? null;
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: { plan: 'BASIC', planExpiresAt: null },
          });
        }
        break;
      }
      default:
        // Acknowledge unhandled events
        break;
    }
    res.json({ received: true });
  } catch (err) {
    // Log but acknowledge the event — Stripe retries on 5xx
    if (process.env.NODE_ENV !== 'production') {
      console.error('[stripe webhook]', err);
    }
    res.status(500).json({ error: 'خطأ في معالج الـ webhook' });
  }
};
