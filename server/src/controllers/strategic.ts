import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { assertCompanyAccess, paramOf } from '../lib/companyGuard';

// ─── أنواع مخرجات استراتيجية ثابتة على مستوى الشركة ────────────────
const BASE_ARTIFACT_TYPES = [
  'PESTEL',
  'PORTER',
  'BENCHMARK',
  'STAKEHOLDERS',
  'COMPANY_HEALTH',
  'ORG_DNA',
  'VALUE_CHAIN',
  'CORE_CAPABILITIES',
  'GAP_ANALYSIS',
  'RISK_REGISTER',
  'AMBITION_GAP',
  'STRATEGIC_TENSIONS',
  'DIRECTIONS',
  'CHOICES',
  'ANSOFF',
  'BCG',
  'SPACE',
  'QSPM',
  'THREE_HORIZONS',
  'PRIORITY_MATRIX',
  'OGSM',
  'ANNUAL_PLAN',
  // إجابات تحليل قسم عميق — 4 أسئلة نصّية مفتوحة على /manager/dept-deep.
  // Data shape: { answers: Record<string, string> } — المفتاح فهرس السؤال.
  'DEPT_DEEP_ANSWERS',
  // إجابات التحليل العميق الكامل (بنك ٣٣٠ سؤالاً على 6 أقسام) —
  // /manager/deep-analysis. Data shape: { deptCode, answers: Record<string,
  // string | string[]> }. مستقلّ عن DEPT_DEEP_ANSWERS الأخف.
  'DEPT_DEEP_FULL',
  // R6 — الأدوات الأربع الأساسية المفقودة (ملف الاقتراح).
  'BMC',          // نموذج الأعمال Canvas (٩ كتل)
  'BSC',          // Balanced Scorecard (٤ أبعاد)
  'RACI',         // مصفوفة المسؤوليات (Task × Role)
  'EISENHOWER',   // مصفوفة عاجل × مهم (٢×٢)
  // البيئة الداخلية (٧S — Strategy/Structure/Systems/…).
  'INTERNAL_ENV',
] as const;

// ─── PESTEL/Gap على مستوى الإدارة (المدير المستقل الخبير) ───────
// أدوات مصغّرة تعمل لكل إدارة على حِدَة بمنهجية القديم (pestel.html و
// gap-analysis.html). المفاتيح: `PESTEL_<DEPT>` و `GAP_ANALYSIS_<DEPT>`.
const DEPT_CODES = [
  'HR', 'FINANCE', 'SALES', 'MARKETING', 'OPERATIONS', 'IT',
  'CUSTOMER_SERVICE', 'SUPPORT', 'LOGISTICS', 'QUALITY',
  'PROJECTS', 'COMPLIANCE', 'GOVERNANCE',
] as const;

const DEPT_SCOPED_TYPES = DEPT_CODES.flatMap((d) => [
  `PESTEL_${d}` as const,
  `GAP_ANALYSIS_${d}` as const,
  `VALUE_CHAIN_${d}` as const,
  `INTERNAL_ENV_${d}` as const,
  `PORTER_${d}` as const,
  `BENCHMARK_${d}` as const,
  `ORG_DNA_${d}` as const,
  `STAKEHOLDERS_${d}` as const,
  `BMC_${d}` as const,
  `THREE_HORIZONS_${d}` as const,
  `ANSOFF_${d}` as const,
]);

const ARTIFACT_TYPES = [...BASE_ARTIFACT_TYPES, ...DEPT_SCOPED_TYPES] as const;

const typeSchema = z.enum(ARTIFACT_TYPES);
const upsertSchema = z.object({
  data: z.record(z.string(), z.unknown()).or(z.array(z.unknown())),
});

// ─── PUT /api/strategic/:companyId/:type — upsert ───────────────────────────
export const upsertArtifact: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    const type = typeSchema.parse(paramOf(req, 'type'));
    await assertCompanyAccess(req.auth.sub, companyId);
    const body = upsertSchema.parse(req.body);
    const artifact = await prisma.strategicArtifact.upsert({
      where: { companyId_type: { companyId, type } },
      update: { data: body.data as unknown as object },
      create: { companyId, type, data: body.data as unknown as object },
    });
    res.json(artifact);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/strategic/:companyId/:type ───────────────────────────────────
export const getArtifact: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    const type = typeSchema.parse(paramOf(req, 'type'));
    await assertCompanyAccess(req.auth.sub, companyId);
    const artifact = await prisma.strategicArtifact.findUnique({
      where: { companyId_type: { companyId, type } },
    });
    res.json({ artifact });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/strategic/:companyId ── list all ─────────────────────────────
export const listArtifacts: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const artifacts = await prisma.strategicArtifact.findMany({
      where: { companyId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(artifacts);
  } catch (err) {
    next(err);
  }
};

export const ARTIFACT_TYPE_VALUES = ARTIFACT_TYPES;
