import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import {
  listPlans,
  createCheckout,
  billingPortal,
  // stripeWebhook is mounted separately in index.ts because it needs raw body
} from '../controllers/payments';

// خريطة الحماية:
//   GET /plans              — عام (كتالوج الباقات)
//   POST /create-checkout   — BASIC+  (يبدأ ترقية عبر Stripe)
//   GET /portal             — BASIC+  (Stripe Billing Portal)
//   POST /webhook           — عام (يُسجَّل في index.ts قبل express.json،
//                                    التحقّق عبر توقيع Stripe لا auth)
const router = Router();
router.get('/plans', listPlans);
router.post('/create-checkout', requireAuth, createCheckout);
router.get('/portal', requireAuth, billingPortal);
export default router;
