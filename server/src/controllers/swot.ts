import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { assertCompanyAccess, paramOf } from '../lib/companyGuard';

const itemArray = z.array(z.string().min(1).max(500));
const swotSchema = z.object({
  strengths: itemArray,
  weaknesses: itemArray,
  opportunities: itemArray,
  threats: itemArray,
});

const towsSchema = z.object({
  so: z.array(z.string()).optional(),
  wo: z.array(z.string()).optional(),
  st: z.array(z.string()).optional(),
  wt: z.array(z.string()).optional(),
});

async function getOrCreateSWOT(companyId: string) {
  const existing = await prisma.sWOT.findFirst({ where: { companyId }, orderBy: { updatedAt: 'desc' } });
  if (existing) return existing;
  return prisma.sWOT.create({
    data: {
      companyId,
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: [],
    },
  });
}

// ─── PUT /api/swot/:companyId — upsert the SWOT ─────────────────────────────
export const upsertSWOT: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const body = swotSchema.parse(req.body);

    const existing = await prisma.sWOT.findFirst({ where: { companyId }, orderBy: { updatedAt: 'desc' } });
    const data = {
      strengths: body.strengths as unknown as object,
      weaknesses: body.weaknesses as unknown as object,
      opportunities: body.opportunities as unknown as object,
      threats: body.threats as unknown as object,
    };
    const swot = existing
      ? await prisma.sWOT.update({ where: { id: existing.id }, data })
      : await prisma.sWOT.create({ data: { companyId, ...data } });
    res.json(swot);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/swot/:companyId ──────────────────────────────────────────────
export const getSWOT: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const swot = await getOrCreateSWOT(companyId);
    res.json(swot);
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/swot/:companyId/tows — update TOWS strategies ────────────────
export const upsertTOWS: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const body = towsSchema.parse(req.body);
    const swot = await getOrCreateSWOT(companyId);
    const updated = await prisma.sWOT.update({
      where: { id: swot.id },
      data: { tows: body as unknown as object },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/swot/:companyId/tows/suggest — auto-fill TOWS from SWOT ─────
export const suggestTOWS: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const swot = await getOrCreateSWOT(companyId);
    const strengths = (swot.strengths as unknown as string[]) ?? [];
    const weaknesses = (swot.weaknesses as unknown as string[]) ?? [];
    const opportunities = (swot.opportunities as unknown as string[]) ?? [];
    const threats = (swot.threats as unknown as string[]) ?? [];
    const cross = (a: string[], b: string[], joiner: string) =>
      a.flatMap((x) => b.map((y) => `${x} — ${joiner} — ${y}`));
    const suggestion = {
      so: cross(strengths, opportunities, 'leverage to seize'),
      wo: cross(weaknesses, opportunities, 'fix to seize'),
      st: cross(strengths, threats, 'leverage to defend'),
      wt: cross(weaknesses, threats, 'fix to defend'),
    };
    res.json(suggestion);
  } catch (err) {
    next(err);
  }
};
