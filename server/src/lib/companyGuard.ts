// Shared helper used by Phase 5/6 controllers to enforce that the caller has a
// CompanyUser link before reading or writing strategic data.

import type { RequestHandler } from 'express';

import { prisma } from './prisma';
import { HttpError } from '../middleware/error';

export async function assertCompanyAccess(userId: string, companyId: string): Promise<void> {
  const link = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId, companyId } },
  });
  if (!link) throw new HttpError(403, 'You do not have access to this company');
}

export function paramOf(req: Parameters<RequestHandler>[0], key: string): string {
  return (req.params as Record<string, string>)[key];
}

export async function ensureCompanyForUser(userId: string, fallbackName = 'My company'): Promise<string> {
  const link = await prisma.companyUser.findFirst({
    where: { userId },
    orderBy: { id: 'asc' },
    include: { company: true },
  });
  if (link?.company) return link.company.id;
  const created = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name: fallbackName, size: 'SMALL' } });
    await tx.companyUser.create({ data: { userId, companyId: company.id, role: 'owner' } });
    return company;
  });
  return created.id;
}
