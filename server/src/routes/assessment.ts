import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import {
  listAssessments,
  getAssessment,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  calculateMaturity,
  createDimension,
  updateDimension,
  deleteDimension,
  createCriterion,
  updateCriterion,
  deleteCriterion,
  createIndicator,
  updateIndicator,
  deleteIndicator,
} from '../controllers/assessment';

// كل endpoints خلف requireAuth. الوصول للشركة يُفرَض داخل الكونترولر
// عبر assertCompanyAccess (مباشرة أو بالصعود عبر شجرة العلاقات).
const router = Router();

// Assessment
router.get('/company/:companyId', requireAuth, listAssessments);
router.get('/:id', requireAuth, getAssessment);
router.post('/', requireAuth, createAssessment);
router.patch('/:id', requireAuth, updateAssessment);
router.delete('/:id', requireAuth, deleteAssessment);
router.post('/:id/calculate', requireAuth, calculateMaturity);

// Dimension
router.post('/dimensions', requireAuth, createDimension);
router.patch('/dimensions/:id', requireAuth, updateDimension);
router.delete('/dimensions/:id', requireAuth, deleteDimension);

// Criterion
router.post('/criteria', requireAuth, createCriterion);
router.patch('/criteria/:id', requireAuth, updateCriterion);
router.delete('/criteria/:id', requireAuth, deleteCriterion);

// Indicator
router.post('/indicators', requireAuth, createIndicator);
router.patch('/indicators/:id', requireAuth, updateIndicator);
router.delete('/indicators/:id', requireAuth, deleteIndicator);

export default router;
