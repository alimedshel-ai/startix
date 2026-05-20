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
} from '../controllers/ai';

const router = Router();

// AI features are PROFESSIONAL+ across the board; Smart Guide is the only
// always-available bonus (it degrades gracefully when no API key is present).
const pro = requirePlan('PROFESSIONAL');

router.post('/advisor', requireAuth, pro, advisorChat);
router.post('/tows-suggestions', requireAuth, pro, towsSuggestions);
router.post('/presentation', requireAuth, pro, generatePresentation);
router.post('/pain-screen', requireAuth, pro, painScreen);
router.post('/smart-guide', requireAuth, smartGuide); // free hint
router.get('/predictions/:companyId', requireAuth, pro, getPredictions);
router.post('/simulate', requireAuth, pro, runSimulation);

export default router;
