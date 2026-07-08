import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import {
  createInvitation,
  listCompanyInvitations,
  acceptInvitation,
} from '../controllers/invitations';

// خريطة الحماية:
//   POST /                     — BASIC+  (يتحقّق assertCompanyAccess)
//   GET  /company/:companyId   — BASIC+  (يتحقّق assertCompanyAccess)
//   POST /:token/accept        — BASIC+  (يتحقّق مطابقة البريد داخل الكونترولر)
const router = Router();

router.post('/', requireAuth, createInvitation);
router.get('/company/:companyId', requireAuth, listCompanyInvitations);
router.post('/:token/accept', requireAuth, acceptInvitation);

export default router;
