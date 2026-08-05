import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { assertCompanyAccess, paramOf } from '../lib/companyGuard';

// ─── Objectives ─────────────────────────────────────────────────────────────
const objectiveCreate = z.object({
  companyId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.string().min(1).max(80),
  status: z.string().optional(),
  dueDate: z.string().datetime().nullish(),
});
const objectiveUpdate = objectiveCreate.partial().omit({ companyId: true });

export const listObjectives: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const rows = await prisma.objective.findMany({
      where: { companyId },
      include: { okrs: true, initiatives: true },
    });
    res.json(rows);
  } catch (err) { next(err); }
};

export const createObjective: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = objectiveCreate.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);
    const row = await prisma.objective.create({
      data: { ...body, dueDate: body.dueDate ? new Date(body.dueDate) : null },
    });
    res.status(201).json(row);
  } catch (err) { next(err); }
};

export const updateObjective: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const body = objectiveUpdate.parse(req.body);
    const found = await prisma.objective.findUnique({ where: { id } });
    if (!found) throw new HttpError(404, 'الهدف غير موجود');
    await assertCompanyAccess(req.auth.sub, found.companyId);
    const row = await prisma.objective.update({
      where: { id },
      data: { ...body, dueDate: body.dueDate ? new Date(body.dueDate) : undefined },
    });
    res.json(row);
  } catch (err) { next(err); }
};

export const deleteObjective: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const found = await prisma.objective.findUnique({ where: { id } });
    if (!found) throw new HttpError(404, 'الهدف غير موجود');
    await assertCompanyAccess(req.auth.sub, found.companyId);
    await prisma.objective.delete({ where: { id } });
    res.status(204).end();
  } catch (err) { next(err); }
};

// ─── OKRs (nested under Objective) ──────────────────────────────────────────
const okrCreate = z.object({
  objectiveId: z.string().uuid(),
  keyResult: z.string().min(1).max(200),
  targetValue: z.number(),
  currentValue: z.number().optional(),
  unit: z.string().optional(),
  dueDate: z.string().datetime().nullish(),
});
const okrUpdate = okrCreate.partial().omit({ objectiveId: true });

export const createOKR: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = okrCreate.parse(req.body);
    const obj = await prisma.objective.findUnique({ where: { id: body.objectiveId } });
    if (!obj) throw new HttpError(404, 'الهدف غير موجود');
    await assertCompanyAccess(req.auth.sub, obj.companyId);
    const row = await prisma.oKR.create({
      data: { ...body, currentValue: body.currentValue ?? 0, dueDate: body.dueDate ? new Date(body.dueDate) : null },
    });
    res.status(201).json(row);
  } catch (err) { next(err); }
};

export const updateOKR: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const body = okrUpdate.parse(req.body);
    const found = await prisma.oKR.findUnique({ where: { id }, include: { objective: true } });
    if (!found) throw new HttpError(404, 'هدف OKR غير موجود');
    await assertCompanyAccess(req.auth.sub, found.objective.companyId);
    const row = await prisma.oKR.update({
      where: { id },
      data: { ...body, dueDate: body.dueDate ? new Date(body.dueDate) : undefined },
    });
    res.json(row);
  } catch (err) { next(err); }
};

export const deleteOKR: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const found = await prisma.oKR.findUnique({ where: { id }, include: { objective: true } });
    if (!found) throw new HttpError(404, 'هدف OKR غير موجود');
    await assertCompanyAccess(req.auth.sub, found.objective.companyId);
    await prisma.oKR.delete({ where: { id } });
    res.status(204).end();
  } catch (err) { next(err); }
};

// ─── KPIs ───────────────────────────────────────────────────────────────────
// Phase 1 — عمود القياس:
//   baselineValue: نقطة انطلاق منحنى S (اختياريّة، افتراضياً = currentValue).
//   expectedPath:  مصفوفة نقاط شهريّة { month, value } مولّدة آليّاً بمنحنى S،
//                  قابلة للتعديل يدوياً محطّةً بمحطّة.
//   startedAt:     تاريخ بدء المسار — يحدّد الشهر «الحالي» على المنحنى.
const kpiCreate = z.object({
  companyId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  objectiveId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(40),
  targetValue: z.number(),
  currentValue: z.number().optional(),
  frequency: z.string().min(1).max(40),
  baselineValue: z.number().optional(),
  expectedPath: z.array(z.object({ month: z.number().int().min(0), value: z.number() })).optional(),
  startedAt: z.string().datetime().optional(),
});
const kpiUpdate = kpiCreate.partial().omit({ companyId: true });

export const listKPIs: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const rows = await prisma.kPI.findMany({ where: { companyId } });
    res.json(rows);
  } catch (err) { next(err); }
};

export const createKPI: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = kpiCreate.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);
    const row = await prisma.kPI.create({
      data: {
        ...body,
        currentValue: body.currentValue ?? 0,
        // JSON column يحتاج صياغة خاصّة للـ null vs undefined.
        expectedPath: body.expectedPath ?? undefined,
        startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
      },
    });
    res.status(201).json(row);
  } catch (err) { next(err); }
};

export const updateKPI: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const body = kpiUpdate.parse(req.body);
    const found = await prisma.kPI.findUnique({ where: { id } });
    if (!found) throw new HttpError(404, 'مؤشر الأداء غير موجود');
    await assertCompanyAccess(req.auth.sub, found.companyId);
    const row = await prisma.kPI.update({
      where: { id },
      data: {
        ...body,
        expectedPath: body.expectedPath ?? undefined,
        startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
      },
    });
    res.json(row);
  } catch (err) { next(err); }
};

export const deleteKPI: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const found = await prisma.kPI.findUnique({ where: { id } });
    if (!found) throw new HttpError(404, 'مؤشر الأداء غير موجود');
    await assertCompanyAccess(req.auth.sub, found.companyId);
    await prisma.kPI.delete({ where: { id } });
    res.status(204).end();
  } catch (err) { next(err); }
};

// ─── KPI entries (history) ──────────────────────────────────────────────────
const entryCreate = z.object({
  kpiId: z.string().uuid(),
  value: z.number(),
  notes: z.string().max(500).optional(),
});

export const listKPIEntries: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const kpiId = paramOf(req, 'kpiId');
    const kpi = await prisma.kPI.findUnique({ where: { id: kpiId } });
    if (!kpi) throw new HttpError(404, 'مؤشر الأداء غير موجود');
    await assertCompanyAccess(req.auth.sub, kpi.companyId);
    const rows = await prisma.kPIEntry.findMany({ where: { kpiId }, orderBy: { enteredAt: 'desc' } });
    res.json(rows);
  } catch (err) { next(err); }
};

export const createKPIEntry: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = entryCreate.parse(req.body);
    const kpi = await prisma.kPI.findUnique({ where: { id: body.kpiId } });
    if (!kpi) throw new HttpError(404, 'مؤشر الأداء غير موجود');
    await assertCompanyAccess(req.auth.sub, kpi.companyId);
    const [, entry] = await prisma.$transaction([
      prisma.kPI.update({ where: { id: kpi.id }, data: { currentValue: body.value } }),
      prisma.kPIEntry.create({ data: body }),
    ]);
    res.status(201).json(entry);
  } catch (err) { next(err); }
};

// ─── Initiatives ────────────────────────────────────────────────────────────
const initiativeCreate = z.object({
  companyId: z.string().uuid(),
  // الجسر الاستراتيجي: ربط المبادرة بهدف علوي (اختياري — nullable لفكّ الربط).
  objectiveId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  status: z.string().optional(),
  priority: z.string().min(1).max(40),
  // المستوى (من يخطّط) والتكلفة المقدّرة (SAR) — اختياريان.
  level: z.enum(['operational', 'tactical', 'strategic']).nullish(),
  cost: z.number().min(0).max(1e12).nullish(),
  // مصدر الإنشاء: 'rescue' = أُنشئت inline من شاشة الإنقاذ (خطوة ٣) مع ربطها
  // بالإجراء التصحيحيّ (خطوة ٢)؛ 'manual' الافتراض. يُستعلم لحساب اكتمال الإنقاذ.
  source: z.enum(['rescue', 'manual']).nullish(),
  linkedActionId: z.string().max(200).nullish(),
});
const initiativeUpdate = initiativeCreate.partial().omit({ companyId: true });

// يتحقّق أنّ الهدف المُراد ربطه موجود ويخصّ نفس الشركة (منع ربط هدف شركة أخرى).
async function assertObjectiveInCompany(objectiveId: string, companyId: string) {
  const obj = await prisma.objective.findUnique({ where: { id: objectiveId } });
  if (!obj || obj.companyId !== companyId) {
    throw new HttpError(400, 'الهدف المُختار غير موجود في هذه الشركة.');
  }
}

export const listInitiatives: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const rows = await prisma.initiative.findMany({
      where: { companyId },
      // حلقة التقدّم: نكشف حالات مهامّ كل مشروع (id+status فقط) ليحسب العميل
      // شريط تقدّم المبادرة (منجزة ÷ الكلّ) دون نداء إضافيّ.
      include: { projects: { include: { tasks: { select: { id: true, status: true } } } }, objective: true },
    });
    res.json(rows);
  } catch (err) { next(err); }
};

export const createInitiative: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = initiativeCreate.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);
    if (body.objectiveId) await assertObjectiveInCompany(body.objectiveId, body.companyId);
    const row = await prisma.initiative.create({ data: body, include: { objective: true } });
    res.status(201).json(row);
  } catch (err) { next(err); }
};

export const updateInitiative: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const body = initiativeUpdate.parse(req.body);
    const found = await prisma.initiative.findUnique({ where: { id } });
    if (!found) throw new HttpError(404, 'المبادرة غير موجودة');
    await assertCompanyAccess(req.auth.sub, found.companyId);
    if (body.objectiveId) await assertObjectiveInCompany(body.objectiveId, found.companyId);
    const row = await prisma.initiative.update({ where: { id }, data: body, include: { objective: true } });
    res.json(row);
  } catch (err) { next(err); }
};

export const deleteInitiative: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const found = await prisma.initiative.findUnique({ where: { id } });
    if (!found) throw new HttpError(404, 'المبادرة غير موجودة');
    await assertCompanyAccess(req.auth.sub, found.companyId);
    await prisma.initiative.delete({ where: { id } });
    res.status(204).end();
  } catch (err) { next(err); }
};

// ─── Projects ───────────────────────────────────────────────────────────────
const projectCreate = z.object({
  companyId: z.string().uuid(),
  initiativeId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  status: z.string().optional(),
  startDate: z.string().datetime().nullish(),
  endDate: z.string().datetime().nullish(),
});
const projectUpdate = projectCreate.partial().omit({ companyId: true });

export const listProjects: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const rows = await prisma.project.findMany({ where: { companyId }, include: { tasks: true } });
    res.json(rows);
  } catch (err) { next(err); }
};

export const createProject: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = projectCreate.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);
    const row = await prisma.project.create({
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    });
    res.status(201).json(row);
  } catch (err) { next(err); }
};

export const updateProject: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const body = projectUpdate.parse(req.body);
    const found = await prisma.project.findUnique({ where: { id } });
    if (!found) throw new HttpError(404, 'المشروع غير موجود');
    await assertCompanyAccess(req.auth.sub, found.companyId);
    const row = await prisma.project.update({
      where: { id },
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
    });
    res.json(row);
  } catch (err) { next(err); }
};

export const deleteProject: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const found = await prisma.project.findUnique({ where: { id } });
    if (!found) throw new HttpError(404, 'المشروع غير موجود');
    await assertCompanyAccess(req.auth.sub, found.companyId);
    await prisma.project.delete({ where: { id } });
    res.status(204).end();
  } catch (err) { next(err); }
};

// ─── Tasks ──────────────────────────────────────────────────────────────────
const taskCreate = z.object({
  companyId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  // مهمة فرعية: معرّف الأب (اختياريّ). null/غياب = مهمة رئيسيّة.
  parentTaskId: z.string().uuid().nullish(),
  // الجهة المنفّذة (نصّ حرّ) — nullable ليُمكن مسحها في التحديث.
  owner: z.string().max(120).nullish(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().datetime().nullish(),
  // المستوى والتكلفة المقدّرة (SAR) — اختياريان.
  level: z.enum(['operational', 'tactical', 'strategic']).nullish(),
  cost: z.number().min(0).max(1e12).nullish(),
});
const taskUpdate = taskCreate.partial().omit({ companyId: true });

export const listTasks: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    // نُرجِع المهام الرئيسيّة فقط (parentTaskId=null) مع فروعها مضمَّنةً — فلا تظهر
    // الفروع مرّتين (رئيسيّةً وفرعيّة). الفروع بترتيب إنشائها.
    const rows = await prisma.task.findMany({
      where: { companyId, parentTaskId: null },
      orderBy: { createdAt: 'desc' },
      include: { subtasks: { orderBy: { createdAt: 'asc' } } },
    });
    res.json(rows);
  } catch (err) { next(err); }
};

// ─── حلقة تقدّم المبادرة: المهام تحرّك حالة مبادرتها آليّاً ────────────────────
// المهمّة ← المشروع ← المبادرة. عند تغيّر مهمة (إنشاء/تحديث/حذف) نُعيد حساب حالة
// المبادرة المرتبطة: كلّها منجزة → done · بعضها بدأ → in_progress · لا شيء → planned.
// نُدير الحالات {planned,in_progress,done} فقط — لا نلمس suggested (مقترحة/الرقعة A)
// ولا cancelled. فشل الحساب لا يُسقط عمليّة المهمّة (best-effort).
const AUTO_INITIATIVE_STATES = new Set(['planned', 'in_progress', 'done']);

async function initiativeIdForProject(projectId: string | null | undefined): Promise<string | null> {
  if (!projectId) return null;
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { initiativeId: true } });
  return p?.initiativeId ?? null;
}

async function recomputeInitiativeStatus(initiativeId: string): Promise<void> {
  const init = await prisma.initiative.findUnique({ where: { id: initiativeId }, select: { id: true, status: true } });
  if (!init || !AUTO_INITIATIVE_STATES.has(init.status)) return;
  const tasks = await prisma.task.findMany({ where: { project: { initiativeId } }, select: { status: true } });
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const started = tasks.some((t) => t.status !== 'todo'); // in_progress/done/blocked = انطلقت المبادرة
  const next = total === 0 ? 'planned' : done === total ? 'done' : started ? 'in_progress' : 'planned';
  if (next !== init.status) await prisma.initiative.update({ where: { id: initiativeId }, data: { status: next } });
}

/** يُعيد حساب حالة مبادرة المهمّة (وأيّ مشروع قديم إن تغيّر) — بلا إسقاط الطلب. */
async function bubbleTaskToInitiative(...projectIds: (string | null | undefined)[]): Promise<void> {
  try {
    const initIds = new Set<string>();
    for (const pid of projectIds) {
      const initId = await initiativeIdForProject(pid);
      if (initId) initIds.add(initId);
    }
    for (const initId of initIds) await recomputeInitiativeStatus(initId);
  } catch { /* best-effort: تقدّم الحالة لا يُسقط عمليّة المهمّة */ }
}

export const createTask: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = taskCreate.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);
    const row = await prisma.task.create({
      data: { ...body, dueDate: body.dueDate ? new Date(body.dueDate) : null },
    });
    await bubbleTaskToInitiative(row.projectId);
    res.status(201).json(row);
  } catch (err) { next(err); }
};

export const updateTask: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const body = taskUpdate.parse(req.body);
    const found = await prisma.task.findUnique({ where: { id } });
    if (!found) throw new HttpError(404, 'المهمة غير موجودة');
    await assertCompanyAccess(req.auth.sub, found.companyId);
    const completedAt = body.status === 'done' && !found.completedAt ? new Date() : undefined;
    const row = await prisma.task.update({
      where: { id },
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        completedAt: completedAt ?? (body.status && body.status !== 'done' ? null : undefined),
      },
    });
    await bubbleTaskToInitiative(row.projectId, found.projectId);
    res.json(row);
  } catch (err) { next(err); }
};

export const deleteTask: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const found = await prisma.task.findUnique({ where: { id } });
    if (!found) throw new HttpError(404, 'المهمة غير موجودة');
    await assertCompanyAccess(req.auth.sub, found.companyId);
    await prisma.task.delete({ where: { id } });
    await bubbleTaskToInitiative(found.projectId);
    res.status(204).end();
  } catch (err) { next(err); }
};

// ─── Scenarios ──────────────────────────────────────────────────────────────
const scenarioCreate = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(80),
  assumptions: z.array(z.string()),
  projections: z.array(z.object({ year: z.number(), revenue: z.number(), profit: z.number() })),
});

export const listScenarios: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const rows = await prisma.scenario.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } });
    res.json(rows);
  } catch (err) { next(err); }
};

export const createScenario: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = scenarioCreate.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);
    const row = await prisma.scenario.create({
      data: {
        companyId: body.companyId,
        name: body.name,
        assumptions: body.assumptions as unknown as object,
        projections: body.projections as unknown as object,
      },
    });
    res.status(201).json(row);
  } catch (err) { next(err); }
};

export const deleteScenario: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const found = await prisma.scenario.findUnique({ where: { id } });
    if (!found) throw new HttpError(404, 'السيناريو غير موجود');
    await assertCompanyAccess(req.auth.sub, found.companyId);
    await prisma.scenario.delete({ where: { id } });
    res.status(204).end();
  } catch (err) { next(err); }
};

// ─── Reviews & Corrections ─────────────────────────────────────────────────
const reviewCreate = z.object({
  companyId: z.string().uuid(),
  type: z.string().min(1).max(40),
  outcome: z.string().optional(),
  notes: z.string().max(2000).optional(),
  corrections: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    owner: z.string().optional(),
    dueDate: z.string().datetime().nullish(),
  })).optional(),
});

export const listReviews: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const rows = await prisma.review.findMany({ where: { companyId }, orderBy: { reviewedAt: 'desc' } });
    res.json(rows);
  } catch (err) { next(err); }
};

export const createReview: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = reviewCreate.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);
    const review = await prisma.review.create({
      data: {
        companyId: body.companyId,
        type: body.type,
        outcome: body.outcome,
        notes: body.notes,
        corrections: (body.corrections ?? []) as unknown as object,
      },
    });
    if (body.corrections?.length) {
      await prisma.correction.createMany({
        data: body.corrections.map((c) => ({
          companyId: body.companyId,
          reviewId: review.id,
          title: c.title,
          description: c.description,
          owner: c.owner,
          dueDate: c.dueDate ? new Date(c.dueDate) : null,
        })),
      });
    }
    res.status(201).json(review);
  } catch (err) { next(err); }
};

const correctionUpdate = z.object({
  status: z.string().optional(),
  owner: z.string().optional(),
  dueDate: z.string().datetime().nullish(),
  description: z.string().optional(),
});

export const listCorrections: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const rows = await prisma.correction.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
    res.json(rows);
  } catch (err) { next(err); }
};

export const updateCorrection: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    const body = correctionUpdate.parse(req.body);
    const found = await prisma.correction.findUnique({ where: { id } });
    if (!found) throw new HttpError(404, 'الإجراء التصحيحي غير موجود');
    await assertCompanyAccess(req.auth.sub, found.companyId);
    const row = await prisma.correction.update({
      where: { id },
      data: { ...body, dueDate: body.dueDate ? new Date(body.dueDate) : undefined },
    });
    res.json(row);
  } catch (err) { next(err); }
};

// ─── Alerts aggregator — auto-generated warnings ────────────────────────────
export const alertsList: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

    const [kpis, tasks, corrections, latestReview] = await Promise.all([
      prisma.kPI.findMany({ where: { companyId } }),
      prisma.task.findMany({ where: { companyId, status: { not: 'done' } } }),
      prisma.correction.findMany({ where: { companyId, status: { not: 'done' } } }),
      prisma.review.findFirst({ where: { companyId }, orderBy: { reviewedAt: 'desc' } }),
    ]);

    interface Alert {
      id: string;
      kind: 'kpi_at_risk' | 'overdue_task' | 'overdue_correction' | 'no_review';
      severity: 'low' | 'medium' | 'high';
      title: string;
      detail: string;
      at: string;
    }

    const alerts: Alert[] = [];

    // KPIs below 50% of target
    for (const k of kpis) {
      if (!k.targetValue) continue;
      const pct = (k.currentValue / k.targetValue) * 100;
      if (pct < 50) {
        alerts.push({
          id: `kpi-${k.id}`,
          kind: 'kpi_at_risk',
          severity: pct < 30 ? 'high' : 'medium',
          title: `مؤشر ${k.name} تحت الحد`,
          detail: `القيمة الحالية ${k.currentValue} ${k.unit}، الهدف ${k.targetValue} (${Math.round(pct)}%).`,
          at: now.toISOString(),
        });
      }
    }

    // Overdue tasks
    for (const t of tasks) {
      if (!t.dueDate) continue;
      if (new Date(t.dueDate).getTime() < now.getTime()) {
        const daysOverdue = Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / 86400000);
        alerts.push({
          id: `task-${t.id}`,
          kind: 'overdue_task',
          severity: daysOverdue > 14 ? 'high' : daysOverdue > 7 ? 'medium' : 'low',
          title: `مهمة متأخرة: ${t.title}`,
          detail: `متأخرة منذ ${daysOverdue} يوم.`,
          at: t.dueDate.toISOString(),
        });
      }
    }

    // Overdue corrections
    for (const c of corrections) {
      if (!c.dueDate) continue;
      if (new Date(c.dueDate).getTime() < now.getTime()) {
        const daysOverdue = Math.floor((now.getTime() - new Date(c.dueDate).getTime()) / 86400000);
        alerts.push({
          id: `corr-${c.id}`,
          kind: 'overdue_correction',
          severity: daysOverdue > 14 ? 'high' : 'medium',
          title: `إجراء تصحيحي متأخر: ${c.title}`,
          detail: `متأخر منذ ${daysOverdue} يوم${c.owner ? ` — مسؤول: ${c.owner}` : ''}.`,
          at: c.dueDate.toISOString(),
        });
      }
    }

    // No review in last 90 days
    if (!latestReview || latestReview.reviewedAt < ninetyDaysAgo) {
      alerts.push({
        id: 'no-review',
        kind: 'no_review',
        severity: 'medium',
        title: 'لم تجرَ مراجعة دورية',
        detail: latestReview
          ? `آخر مراجعة في ${latestReview.reviewedAt.toISOString().slice(0, 10)}.`
          : 'لم تُسجّل أي مراجعة بعد.',
        at: (latestReview?.reviewedAt ?? ninetyDaysAgo).toISOString(),
      });
    }

    // Sort: high → medium → low, then newest
    const severityOrder = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => {
      if (a.severity !== b.severity) return severityOrder[a.severity] - severityOrder[b.severity];
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });

    res.json(alerts);
  } catch (err) {
    next(err);
  }
};

// ─── Activity feed — aggregated stream ──────────────────────────────────────
export const activityFeed: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const [tasks, kpiEntries, reviews, corrections] = await Promise.all([
      prisma.task.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 25 }),
      prisma.kPIEntry.findMany({ where: { kpi: { companyId } }, orderBy: { enteredAt: 'desc' }, take: 25, include: { kpi: true } }),
      prisma.review.findMany({ where: { companyId }, orderBy: { reviewedAt: 'desc' }, take: 10 }),
      prisma.correction.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 25 }),
    ]);
    const stream = [
      ...tasks.map((t) => ({ type: 'task' as const, at: t.createdAt, title: t.title, status: t.status, id: t.id })),
      ...kpiEntries.map((e) => ({ type: 'kpi_entry' as const, at: e.enteredAt, title: e.kpi.name, value: e.value, id: e.id })),
      ...reviews.map((r) => ({ type: 'review' as const, at: r.reviewedAt, title: `${r.type} review`, outcome: r.outcome, id: r.id })),
      ...corrections.map((c) => ({ type: 'correction' as const, at: c.createdAt, title: c.title, status: c.status, id: c.id })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 60);
    res.json(stream);
  } catch (err) { next(err); }
};
