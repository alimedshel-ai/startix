import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { assertCompanyAccess, paramOf } from '../lib/companyGuard';

// حقل SWOT مخزَّن كـJson مرن. يقبل شكلين:
//   • قديم: string[] (نصوص فقط) — توافق خلفي.
//   • جديد: TaggedListStorage { values, meta } — يحمل الأصل (auto/user:<id>)
//     والمصدر والسبب لكل بند (يُشتقّ منه شارة 🤖 عند العرض).
// كلاهما يُخزَّن كما هو في نفس عمود الـJson — بلا migration.
const taggedListStorage = z.object({
  values: z.array(z.string().max(2000)),
  meta: z.record(z.string(), z.any()).optional(),
});
const swotField = z.union([z.array(z.string().max(2000)), taggedListStorage]);
const swotSchema = z.object({
  strengths: swotField,
  weaknesses: swotField,
  opportunities: swotField,
  threats: swotField,
});

// كل ربع TOWS يقبل string[] (قديم) أو {values,meta} (TaggedListStorage الجديد) —
// نفس مرونة حقول SWOT، مخزَّن في نفس عمود tows الـJson بلا migration.
const towsSchema = z.object({
  so: swotField.optional(),
  wo: swotField.optional(),
  st: swotField.optional(),
  wt: swotField.optional(),
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

// ─── POST /api/strategic/swot/:companyId/seed-from-diagnostic ──────────────
// يبذر SWOT من آخر تشخيص للشركة:
//   - نقاط ضعف التشخيص → عناصر weaknesses (نصوص).
//   - محاور رسم الرادار ذات القيم ≥ 70 → عناصر strengths.
// لا يطمس مدخلات المستخدم؛ يدمج فقط ما هو جديد وينزع التكرار بالنص.
// المسار الكامل من الكلاينت: /api/strategic/swot/:companyId/seed-from-diagnostic.

// خرائط ترجمة محاور الرادار من الإنجليزية إلى العربية (كما تُخزَّن في التشخيص).
const AXIS_LABEL_AR: Record<string, string> = {
  Governance: 'الحوكمة',
  Financial: 'المالية',
  Team: 'الفريق',
  Digital: 'الرقمي',
};

// Diagnostic.weaknesses من نوع Json? — قد يكون مصفوفة كائنات فيها label، أو
// مصفوفة نصوص، أو null. نستخرج string[] بشكل دفاعي.
function extractWeaknessLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim().length > 0) {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === 'object' && 'label' in item) {
      const label = (item as { label: unknown }).label;
      if (typeof label === 'string' && label.trim().length > 0) {
        out.push(label.trim());
      }
    }
  }
  return out;
}

// Diagnostic.radarData من نوع Json? — نتوقع { axis: string, value: number }[]
// لكن نحمي من أي شكل غير متوقّع.
function extractStrengthsFromRadar(raw: unknown, threshold = 70): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const axis = (item as { axis?: unknown }).axis;
    const value = (item as { value?: unknown }).value;
    if (typeof axis !== 'string' || typeof value !== 'number') continue;
    if (value >= threshold) {
      const label = AXIS_LABEL_AR[axis] ?? axis;
      out.push(`محور ${label} قوي (${Math.round(value)}%)`);
    }
  }
  return out;
}

// يقرأ حقل SWOT من الشكلين: string[] (قديم) أو {values,meta} (TaggedListStorage
// الجديد) → نصوص نظيفة. ضروري لأن الكلاينت صار يحفظ {values,meta}، ودوال
// السيرفر (suggestTOWS/الدمج) كانت تفترض string[] فتنكسر (.flatMap على كائن).
function swotList(field: unknown): string[] {
  if (Array.isArray(field)) return field.filter((x): x is string => typeof x === 'string');
  const values = (field as { values?: unknown })?.values;
  if (Array.isArray(values)) return values.filter((x): x is string => typeof x === 'string');
  return [];
}

function mergeUnique(existing: unknown, incoming: string[]): string[] {
  const current = swotList(existing);
  const seen = new Set(current.map((x) => x.trim()));
  const merged = [...current];
  for (const item of incoming) {
    const key = item.trim();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    merged.push(key);
  }
  return merged;
}

// ─── POST /api/strategic/swot/:companyId/synthesize-from-audits ────────────
// يشتقّ SWOT من آخر تدقيق لكل قسم:
//   - healthPct ≥ 70 → نقطة قوة (نص عربي يذكر اسم القسم والنسبة).
//   - healthPct < 50 → نقطة ضعف (نص عربي يذكر اسم القسم والنسبة).
// الأقسام بين 50 و70 تُترك (خارج المنطقتين). يدمج مع SWOT القائم بلا طمس.
// المسار الكامل من الكلاينت: /api/strategic/swot/:companyId/synthesize-from-audits.

const DEPT_LABEL_AR: Record<string, string> = {
  HR: 'الموارد البشرية',
  FINANCE: 'المالية',
  SALES: 'المبيعات',
  MARKETING: 'التسويق',
  OPERATIONS: 'العمليات',
  IT: 'تقنية المعلومات',
  CUSTOMER_SERVICE: 'خدمة العملاء',
  SUPPORT: 'الإمداد والدعم',
  LOGISTICS: 'اللوجستيات',
  QUALITY: 'الجودة',
  PROJECTS: 'المشاريع',
  GOVERNANCE: 'الحوكمة',
  COMPLIANCE: 'الامتثال',
};

export const synthesizeSwotFromAudits: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);

    // DeptAudit لا يملك companyId — الربط عبر Department.
    const departments = await prisma.department.findMany({
      where: { companyId },
      include: {
        audits: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const newStrengths: string[] = [];
    const newWeaknesses: string[] = [];
    for (const dept of departments) {
      const latest = dept.audits[0];
      if (!latest) continue;
      const pct = Math.round(latest.healthPct);
      const label = DEPT_LABEL_AR[dept.type] ?? dept.type;
      if (latest.healthPct >= 70) {
        newStrengths.push(`قسم ${label} صحّي — ${pct}%`);
      } else if (latest.healthPct < 50) {
        newWeaknesses.push(`قسم ${label} حرج — ${pct}%`);
      }
    }

    const swot = await getOrCreateSWOT(companyId);
    const strengths = mergeUnique(swot.strengths, newStrengths);
    const weaknesses = mergeUnique(swot.weaknesses, newWeaknesses);

    const updated = await prisma.sWOT.update({
      where: { id: swot.id },
      data: {
        strengths: strengths as unknown as object,
        weaknesses: weaknesses as unknown as object,
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

export const seedSwotFromDiagnostic: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);

    const diagnostic = await prisma.diagnostic.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    if (!diagnostic) throw new HttpError(404, 'لا يوجد تشخيص لهذه الشركة');

    const newWeaknesses = extractWeaknessLabels(diagnostic.weaknesses);
    const newStrengths = extractStrengthsFromRadar(diagnostic.radarData);

    const swot = await getOrCreateSWOT(companyId);
    const strengths = mergeUnique(swot.strengths, newStrengths);
    const weaknesses = mergeUnique(swot.weaknesses, newWeaknesses);

    const updated = await prisma.sWOT.update({
      where: { id: swot.id },
      data: {
        strengths: strengths as unknown as object,
        weaknesses: weaknesses as unknown as object,
      },
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
    const strengths = swotList(swot.strengths);
    const weaknesses = swotList(swot.weaknesses);
    const opportunities = swotList(swot.opportunities);
    const threats = swotList(swot.threats);
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
