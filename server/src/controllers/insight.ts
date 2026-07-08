import { RequestHandler } from 'express';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { assertCompanyAccess, paramOf } from '../lib/companyGuard';

// ─── C16 — محرك الاستدلال (Recommendations) ────────────────────────────────
// قواعد حتمية تقرأ من نماذج قائمة فقط:
//   - آخر Diagnostic للشركة (maturityScore, weaknesses)
//   - أقسام الشركة وتدقيقاتها (Department + DeptAudit) — نمط C10
//   - آخر BreakEven (نتيجة C12: result.safetyMarginPct)
//
// كل توصية تُنسَب لـ source ∈ { Diagnostic, DeptAudit, BreakEven, Composite }.
// عند كل استدعاء POST /generate:
//   1) نحذف كل التوصيات الحالية بنفس الـ sources الأربعة (تفادي التكرار)
//   2) نُنشئ التوصيات الجديدة الناتجة عن القواعد
//   3) نعيد القائمة الكاملة

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

type Severity = 'info' | 'warning' | 'critical';
type Source = 'Diagnostic' | 'DeptAudit' | 'BreakEven' | 'Composite';

interface DraftRec {
  kind: string;
  message: string;
  severity: Severity;
  source: Source;
}

function extractWeaknessesArray(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

// safetyMarginPct موجود داخل BreakEven.result بالشكل الذي أنتجته C12.
function extractSafetyMargin(result: unknown): number | null {
  if (!result || typeof result !== 'object') return null;
  const v = (result as { safetyMarginPct?: unknown }).safetyMarginPct;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ─── POST /api/insight/:companyId/generate ─────────────────────────────────
export const generateRecommendations: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);

    // 1) جلب المصادر الثلاثة بالتوازي.
    const [diagnostic, departments, breakEven] = await Promise.all([
      prisma.diagnostic.findFirst({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.department.findMany({
        where: { companyId },
        include: { audits: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      prisma.breakEven.findFirst({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const drafts: DraftRec[] = [];

    // ── قواعد BreakEven (1، 2) ──
    const safetyMargin = breakEven ? extractSafetyMargin(breakEven.result) : null;
    if (safetyMargin !== null) {
      if (safetyMargin < 0) {
        drafts.push({
          kind: 'break_even_below',
          severity: 'critical',
          source: 'BreakEven',
          message: 'الشركة تحت نقطة التعادل — إعادة هيكلة عاجلة للتكاليف.',
        });
      } else if (safetyMargin < 15) {
        drafts.push({
          kind: 'break_even_thin_margin',
          severity: 'warning',
          source: 'BreakEven',
          message: 'هامش أمان منخفض — نوّع مصادر الدخل وابنِ احتياطياً.',
        });
      }
    }

    // ── قواعد DeptAudit (3، 4) ──
    const departmentsWithAudit = departments
      .map((d) => ({ dept: d, audit: d.audits[0] }))
      .filter((x) => x.audit !== undefined);
    const avgHealth =
      departmentsWithAudit.length > 0
        ? departmentsWithAudit.reduce((sum, x) => sum + x.audit!.healthPct, 0) / departmentsWithAudit.length
        : null;

    if (avgHealth !== null && avgHealth < 50) {
      drafts.push({
        kind: 'departments_unhealthy',
        severity: 'critical',
        source: 'DeptAudit',
        message: `صحة الأقسام متدنّية (متوسط ${Math.round(avgHealth)}%) — راجع الأقسام الأضعف.`,
      });
    }
    for (const { dept, audit } of departmentsWithAudit) {
      if (audit!.healthPct < 40) {
        const name = DEPT_LABEL_AR[dept.type] ?? dept.type;
        const pct = Math.round(audit!.healthPct);
        drafts.push({
          kind: 'department_critical',
          severity: 'warning',
          source: 'DeptAudit',
          message: `قسم ${name} حرج (${pct}%) — خطة إنقاذ خلال أسبوعين.`,
        });
      }
    }

    // ── قواعد Diagnostic (5، 6) ──
    if (diagnostic) {
      // maturityScore عادة موجود لتشخيص المالك؛ نتحقّق دفاعياً لأنه Float? في المخطط.
      if (diagnostic.maturityScore !== null && diagnostic.maturityScore < 40) {
        drafts.push({
          kind: 'low_maturity',
          severity: 'warning',
          source: 'Diagnostic',
          message: `نضج استراتيجي منخفض (${Math.round(diagnostic.maturityScore)}/100) — أكمل مراحل الخيط الذهبي.`,
        });
      }
      const weaknesses = extractWeaknessesArray(diagnostic.weaknesses);
      if (weaknesses.length >= 3) {
        drafts.push({
          kind: 'weaknesses_stack',
          severity: 'info',
          source: 'Diagnostic',
          message: `${weaknesses.length} نقاط ضعف مرصودة — حوّلها لأهداف عبر SWOT.`,
        });
      }
    }

    // ── قاعدة Composite (7) ──
    if (safetyMargin !== null && safetyMargin >= 15 && avgHealth !== null && avgHealth >= 70) {
      drafts.push({
        kind: 'expansion_ready',
        severity: 'info',
        source: 'Composite',
        message: 'مؤشرات إيجابية — جاهزية للتوسّع، ادرس سوقاً جديداً.',
      });
    }

    // 2) احذف التوصيات القديمة بنفس المصادر الأربعة (تفادي التكرار).
    await prisma.recommendation.deleteMany({
      where: {
        companyId,
        source: { in: ['Diagnostic', 'DeptAudit', 'BreakEven', 'Composite'] },
      },
    });

    // 3) أدرِج الجديدة.
    if (drafts.length > 0) {
      await prisma.recommendation.createMany({
        data: drafts.map((d) => ({
          companyId,
          kind: d.kind,
          message: d.message,
          severity: d.severity,
          source: d.source,
        })),
      });
    }

    const rows = await prisma.recommendation.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ recommendations: rows, generated: drafts.length });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/insight/:companyId ──────────────────────────────────────────
export const listRecommendations: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const rows = await prisma.recommendation.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
