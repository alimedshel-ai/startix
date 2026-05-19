import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import {
  advisorChat,
  towsSuggestions,
  generatePresentation,
  painScreen,
  getPredictions,
  runSimulation,
} from '../controllers/ai';

const router = Router();

router.post('/advisor', requireAuth, advisorChat);
router.post('/tows-suggestions', requireAuth, towsSuggestions);
router.post('/presentation', requireAuth, generatePresentation);
router.post('/pain-screen', requireAuth, painScreen);
router.get('/predictions/:companyId', requireAuth, getPredictions);
router.post('/simulate', requireAuth, runSimulation);

export default router;
