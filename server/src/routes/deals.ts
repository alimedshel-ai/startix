import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { listDeals, createDeal, updateDeal, deleteDeal } from '../controllers/deals';

// كل endpoints خلف requireAuth. الملكية تُتحقَّق داخل الكونترولر
// عبر assertDealOwnership (المستخدم = investorUserId).
const router = Router();

router.get('/', requireAuth, listDeals);
router.post('/', requireAuth, createDeal);
router.patch('/:id', requireAuth, updateDeal);
router.delete('/:id', requireAuth, deleteDeal);

export default router;
