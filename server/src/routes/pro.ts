import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { listMyClients } from '../controllers/pro';

// خريطة الحماية:
//   GET /clients — BASIC+ (مقيّد بـ INDEPENDENT_PRO في المتحكّم نفسه)
const router = Router();

router.get('/clients', requireAuth, listMyClients);

export default router;
