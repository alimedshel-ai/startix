import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { assertCompanyAccess, paramOf } from '../lib/companyGuard';

const ARTIFACT_TYPES = [
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
] as const;

const typeSchema = z.enum(ARTIFACT_TYPES);
const upsertSchema = z.object({
  data: z.record(z.string(), z.unknown()).or(z.array(z.unknown())),
});

// ─── PUT /api/strategic/:companyId/:type — upsert ───────────────────────────
export const upsertArtifact: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
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
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
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
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
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
