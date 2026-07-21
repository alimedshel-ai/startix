import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import { requirePlan } from '../middleware/planGuard';
import {
  advisorChat,
  towsSuggestions,
  generatePresentation,
  painScreen,
  smartGuide,
  getPredictions,
  runSimulation,
  generateAssessment,
  initiativeBreakdown,
} from '../controllers/ai';

// خريطة الحماية:
//   جميع مسارات الـ AI  — PROFESSIONAL+  (عبر requirePlan)
//   /smart-guide        — BASIC+  (استثناء وحيد، يتحلل بأمان بلا مفتاح Claude)
const router = Router();

const pro = requirePlan('PROFESSIONAL');

router.post('/advisor', requireAuth, pro, advisorChat);
router.post('/tows-suggestions', requireAuth, pro, towsSuggestions);
router.post('/presentation', requireAuth, pro, generatePresentation);
router.post('/pain-screen', requireAuth, pro, painScreen);
router.post('/smart-guide', requireAuth, smartGuide); // free hint
router.get('/predictions/:companyId', requireAuth, pro, getPredictions);
router.post('/simulate', requireAuth, pro, runSimulation);
router.post('/generate-assessment', requireAuth, pro, generateAssessment);
// في صميم مسار تنفيذ المدير المستقلّ (مبادرة→مشروع→مهام) — متاح للمصادَق حتى
// BASIC (كـ smart-guide) لتفادي حائط دفع وسط التدفّق؛ ensureClaude يتحلّل بأمان.
router.post('/initiative-breakdown', requireAuth, initiativeBreakdown);

export default router;
