import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import {
  listPlans,
  createCheckout,
  billingPortal,
  // stripeWebhook is mounted separately in index.ts because it needs raw body
} from '../controllers/payments';

const router = Router();
router.get('/plans', listPlans); // public
router.post('/create-checkout', requireAuth, createCheckout);
router.get('/portal', requireAuth, billingPortal);
export default router;
