import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
} from '../controllers/companies';

const router = Router();

router.get('/', requireAuth, listCompanies);
router.post('/', requireAuth, createCompany);
router.get('/:id', requireAuth, getCompany);
router.patch('/:id', requireAuth, updateCompany);
router.delete('/:id', requireAuth, deleteCompany);

export default router;
