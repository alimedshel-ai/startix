import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { listMyNotifications, markNotificationRead } from '../controllers/notifications';

// خريطة الحماية: كل مسارات /api/notifications BASIC+.
// الملكية شخصية للمستخدم — تُتحقَّق داخل الكونترولر (userId = req.auth.sub).
const router = Router();

router.get('/me', requireAuth, listMyNotifications);
router.patch('/:id/read', requireAuth, markNotificationRead);

export default router;
