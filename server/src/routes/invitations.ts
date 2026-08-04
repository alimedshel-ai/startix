import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import {
  createInvitation,
  listCompanyInvitations,
  acceptInvitation,
  checkInvitation,
  registerViaInvitation,
} from '../controllers/invitations';

// خريطة الحماية:
//   POST /                     — BASIC+  (يتحقّق assertCompanyAccess)
//   GET  /company/:companyId   — BASIC+  (يتحقّق assertCompanyAccess)
//   POST /:token/accept        — BASIC+  (يتحقّق مطابقة البريد داخل الكونترولر)
//   GET  /:token/check         — عامّ    (D-٢: قبل التسجيل — التوكن هو السرّ)
//   POST /:token/register      — عامّ    (D-٢: مسار المدعوّ — مُبوَّب بالتوكن داخلياً)
const router = Router();

router.post('/', requireAuth, createInvitation);
router.get('/company/:companyId', requireAuth, listCompanyInvitations);
router.post('/:token/accept', requireAuth, acceptInvitation);
// عامّان (بلا requireAuth): الحماية بالتوكن نفسه عبر invitationGateReason داخل الكونترولر.
router.get('/:token/check', checkInvitation);
router.post('/:token/register', registerViaInvitation);

export default router;
