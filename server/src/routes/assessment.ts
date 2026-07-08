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
  listTemplates,
  createFromTemplate,
  buildAssessment,
} from '../controllers/assessment';

// خريطة الحماية: كل مسارات /api/assessments BASIC+.
// الوصول للشركة يُفرَض داخل الكونترولر عبر assertCompanyAccess (مباشرة أو
// بالصعود عبر شجرة العلاقات لـ Dimension/Criterion/Indicator).
// ملاحظة: توليد المعايير بالـ AI (POST /api/ai/generate-assessment) خلف
// PROFESSIONAL+، أما إنشاء التقييم يدوياً/عبر القوالب/عبر build فمتاح للجميع.
const router = Router();

// C19 — Templates (يجب تسجيل المسارات الثابتة قبل :id لتفادي التصادم)
router.get('/templates', requireAuth, listTemplates);
router.post('/from-template', requireAuth, createFromTemplate);
// C20 — Build from wizard draft (nested nested create)
router.post('/build', requireAuth, buildAssessment);

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
