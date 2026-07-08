import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { listMyNotifications, markNotificationRead } from '../controllers/notifications';

// كل endpoints خلف requireAuth. الملكية تُتحقَّق داخل الكونترولر (المستخدم = userId).
const router = Router();

router.get('/me', requireAuth, listMyNotifications);
router.patch('/:id/read', requireAuth, markNotificationRead);

export default router;
