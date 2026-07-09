import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { getProOverview, listMyClients } from '../controllers/pro';

// خريطة الحماية:
//   GET /clients   — BASIC+ (مقيّد بـ INDEPENDENT_PRO في المتحكّم نفسه)
//   GET /overview  — BASIC+ (مقيّد بـ INDEPENDENT_PRO في المتحكّم نفسه)
const router = Router();

router.get('/clients', requireAuth, listMyClients);
router.get('/overview', requireAuth, getProOverview);

export default router;
