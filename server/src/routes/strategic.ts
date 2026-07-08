import { Router } from 'express';

import { requireAuth } from '../middleware/auth';
import {
  upsertArtifact,
  getArtifact,
  listArtifacts,
} from '../controllers/strategic';
import {
  upsertSWOT,
  getSWOT,
  upsertTOWS,
  suggestTOWS,
  seedSwotFromDiagnostic,
  synthesizeSwotFromAudits,
} from '../controllers/swot';
import {
  listObjectives, createObjective, updateObjective, deleteObjective,
  createOKR, updateOKR, deleteOKR,
  listKPIs, createKPI, updateKPI, deleteKPI,
  listKPIEntries, createKPIEntry,
  listInitiatives, createInitiative, updateInitiative, deleteInitiative,
  listProjects, createProject, updateProject, deleteProject,
  listTasks, createTask, updateTask, deleteTask,
  listScenarios, createScenario, deleteScenario,
  listReviews, createReview,
  listCorrections, updateCorrection,
  activityFeed,
  alertsList,
} from '../controllers/lifecycle';

// خريطة الحماية: كل مسارات /api/strategic BASIC+.
// (Artifacts، SWOT/TOWS، Objectives، KPIs، Projects، Tasks، Reviews،
// Corrections، Activity، Alerts.) الوصول للشركة يُفرَض داخل الكونترولرز.
// TOWS suggestion يقرأ من Claude داخل الكلاينت عبر /api/ai/tows-suggestions
// (خلف PROFESSIONAL) — أما /swot/:companyId/tows/suggest هنا فقواعد
// حتمية بسيطة، متاحة للجميع.
const router = Router();

// Strategic artifacts (generic JSON)
router.get('/artifacts/:companyId', requireAuth, listArtifacts);
router.get('/artifacts/:companyId/:type', requireAuth, getArtifact);
router.put('/artifacts/:companyId/:type', requireAuth, upsertArtifact);

// SWOT + TOWS
router.get('/swot/:companyId', requireAuth, getSWOT);
router.put('/swot/:companyId', requireAuth, upsertSWOT);
router.put('/swot/:companyId/tows', requireAuth, upsertTOWS);
router.post('/swot/:companyId/tows/suggest', requireAuth, suggestTOWS);
router.post('/swot/:companyId/seed-from-diagnostic', requireAuth, seedSwotFromDiagnostic);
router.post('/swot/:companyId/synthesize-from-audits', requireAuth, synthesizeSwotFromAudits);

// Objectives + OKRs
router.get('/objectives/:companyId', requireAuth, listObjectives);
router.post('/objectives', requireAuth, createObjective);
router.patch('/objectives/:id', requireAuth, updateObjective);
router.delete('/objectives/:id', requireAuth, deleteObjective);

router.post('/okrs', requireAuth, createOKR);
router.patch('/okrs/:id', requireAuth, updateOKR);
router.delete('/okrs/:id', requireAuth, deleteOKR);

// KPIs
router.get('/kpis/:companyId', requireAuth, listKPIs);
router.post('/kpis', requireAuth, createKPI);
router.patch('/kpis/:id', requireAuth, updateKPI);
router.delete('/kpis/:id', requireAuth, deleteKPI);

router.get('/kpis/:kpiId/entries', requireAuth, listKPIEntries);
router.post('/kpi-entries', requireAuth, createKPIEntry);

// Initiatives
router.get('/initiatives/:companyId', requireAuth, listInitiatives);
router.post('/initiatives', requireAuth, createInitiative);
router.patch('/initiatives/:id', requireAuth, updateInitiative);
router.delete('/initiatives/:id', requireAuth, deleteInitiative);

// Projects
router.get('/projects/:companyId', requireAuth, listProjects);
router.post('/projects', requireAuth, createProject);
router.patch('/projects/:id', requireAuth, updateProject);
router.delete('/projects/:id', requireAuth, deleteProject);

// Tasks
router.get('/tasks/:companyId', requireAuth, listTasks);
router.post('/tasks', requireAuth, createTask);
router.patch('/tasks/:id', requireAuth, updateTask);
router.delete('/tasks/:id', requireAuth, deleteTask);

// Scenarios
router.get('/scenarios/:companyId', requireAuth, listScenarios);
router.post('/scenarios', requireAuth, createScenario);
router.delete('/scenarios/:id', requireAuth, deleteScenario);

// Reviews & corrections
router.get('/reviews/:companyId', requireAuth, listReviews);
router.post('/reviews', requireAuth, createReview);
router.get('/corrections/:companyId', requireAuth, listCorrections);
router.patch('/corrections/:id', requireAuth, updateCorrection);

// Activity feed
router.get('/activity/:companyId', requireAuth, activityFeed);

// Alerts aggregator
router.get('/alerts/:companyId', requireAuth, alertsList);

export default router;
