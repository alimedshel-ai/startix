import Stripe from 'stripe';

import type { PlanTier } from '@prisma/client';

type StripeClient = InstanceType<typeof Stripe>;

const secretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

let client: StripeClient | null = null;

export function stripe(): StripeClient {
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY must be set');
  }
  if (!client) {
    client = new Stripe(secretKey, { typescript: true });
  }
  return client;
}

export function stripeConfigured(): boolean {
  return Boolean(secretKey);
}

export function stripeWebhookConfigured(): boolean {
  return Boolean(webhookSecret);
}

export function verifyStripeSignature(rawBody: Buffer, signature: string) {
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET must be set');
  }
  return stripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
}

// ─── Plan configuration ──────────────────────────────────────────────────────
// Prices are configured via env vars (set in Stripe dashboard and copied here).
// During dev / before Stripe is wired, plan info is still useful for the UI.

export interface PlanSpec {
  tier: PlanTier;
  labelAr: string;
  priceLabelAr: string;
  priceSARMonthly: number | null; // null = free / custom
  priceId: string | null;
  features: string[];
  /** Whether checkout is supported (Stripe price exists). */
  selfServe: boolean;
}

export const PLANS: PlanSpec[] = [
  {
    tier: 'BASIC',
    labelAr: 'الأساسي',
    priceLabelAr: 'مجاناً',
    priceSARMonthly: 0,
    priceId: null,
    selfServe: false,
    features: [
      'تشخيص: مالك / مدير / مستثمر',
      'مسار استراتيجي واحد',
      'حتى شركة واحدة',
      'دعم عبر البريد',
    ],
  },
  {
    tier: 'PROFESSIONAL',
    labelAr: 'الاحترافي',
    priceLabelAr: '199 ر.س / شهرياً',
    priceSARMonthly: 199,
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL ?? null,
    selfServe: Boolean(secretKey && process.env.STRIPE_PRICE_PROFESSIONAL),
    features: [
      'كل ميزات الأساسي',
      '5 مسارات استراتيجية',
      'تدقيق 13 إدارة',
      'مستشار ذكي (Claude)',
      'تصدير PDF و Excel',
      'حتى 5 شركات',
    ],
  },
  {
    tier: 'ENTERPRISE',
    labelAr: 'المؤسسي',
    priceLabelAr: 'مخصص',
    priceSARMonthly: null,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
    selfServe: Boolean(secretKey && process.env.STRIPE_PRICE_ENTERPRISE),
    features: [
      'شركات غير محدودة',
      'لوحات متعددة الكيانات',
      'تسجيل دخول موحّد (SSO) + أدوار مخصصة',
      'تدقيق الامتثال (احترافي)',
      'إعداد مخصص',
    ],
  },
];

export function planFromPriceId(priceId: string | null | undefined): PlanTier | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) return 'PROFESSIONAL';
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return 'ENTERPRISE';
  return null;
}

export function planFromTier(tier: string | null | undefined): PlanSpec | null {
  return PLANS.find((p) => p.tier === tier) ?? null;
}
