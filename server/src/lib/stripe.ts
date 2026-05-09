import Stripe from 'stripe';

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

export function verifyStripeSignature(rawBody: Buffer, signature: string) {
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET must be set');
  }
  return stripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
}
