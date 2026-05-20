import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { adminStats } from '../controllers/admin';

const router = Router();
router.get('/stats', requireAuth, adminStats);
export default router;
