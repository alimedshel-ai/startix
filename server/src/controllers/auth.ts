import { RequestHandler, CookieOptions } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { signAuthToken, AuthPayload } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import {
  generateRefreshToken,
  generateVerificationToken,
  hashToken,
  REFRESH_TOKEN_TTL_MS,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from '../lib/tokens';
import { sendEmail, verificationEmail, passwordResetEmail } from '../lib/ses';

const isProd = process.env.NODE_ENV === 'production';
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';

// In production the API and the web app live on different sites (Render and
// Vercel), so cookies must be SameSite=None + Secure for the browser to send
// them on cross-site XHR. In dev (localhost) we keep Lax for the simpler flow.
const accessCookie: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 1000 * 60 * 15,
};

const refreshCookie: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: REFRESH_TOKEN_TTL_MS,
};

// أنواع الأقسام المسموحة كتخصّص للمدير المستقل — تطابق DeptType enum في Prisma.
const DEPT_TYPES = [
  'HR', 'FINANCE', 'SALES', 'MARKETING', 'OPERATIONS', 'IT',
  'CUSTOMER_SERVICE', 'SUPPORT', 'LOGISTICS', 'QUALITY',
  'PROJECTS', 'GOVERNANCE', 'COMPLIANCE',
] as const;
type DeptTypeStr = (typeof DEPT_TYPES)[number];

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  userType: 'OWNER' | 'MANAGER' | 'INVESTOR';
  managerType: 'INTERNAL' | 'INDEPENDENT_PRO' | null;
  specialtyDeptType: DeptTypeStr | null;
  phone: string | null;
  avatarUrl: string | null;
  plan: 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
  isVerified: boolean;
  isAdmin: boolean;
  pains: string[];
  goals: string[];
  createdAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    userType: u.userType,
    managerType: u.managerType,
    specialtyDeptType: u.specialtyDeptType,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    plan: u.plan,
    isVerified: u.isVerified,
    isAdmin: u.isAdmin,
    pains: u.pains,
    goals: u.goals,
    createdAt: u.createdAt,
  };
}

// R1 — بوّابة الأهداف والآلام. الأكواد الحرّة تُقيَّم في الـUI
// (client/src/lib/onboardingOptions.ts) — السيرفر يقبل أي strings قصيرة
// لأنه لا يفرض قائمة محدّدة (قد تتوسّع دون سرفير migration).
const painsGoalsSchema = z.array(z.string().min(1).max(64)).max(20).optional();

// R1 — بيانات الشركة الأولى (OPEX/قطاع/نوع كيان) عند bootstrap
// المدير المستقل مع firstClientName. كلها اختيارية لعدم كسر التسجيل القديم.
const firstClientMetaSchema = z.object({
  sector: z.string().min(1).max(80).optional(),
  subsector: z.string().min(1).max(80).optional(),
  entityType: z.string().min(1).max(40).optional(),
  size: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE']).optional(),
  opex: z.object({
    team: z.number().int().min(0).max(100000).optional(),
    budget: z.number().min(0).optional(),
    target: z.number().min(0).optional(),
    avgSalary: z.number().min(0).optional(),
  }).optional(),
}).optional();

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
  userType: z.enum(['OWNER', 'MANAGER', 'INVESTOR']),
  managerType: z.enum(['INTERNAL', 'INDEPENDENT_PRO']).optional(),
  // مطلوب فقط عندما userType=MANAGER و managerType=INDEPENDENT_PRO.
  // يفرضه الكونترولر أدناه (Zod لا يعبّر عن التبعية بين حقلين بسهولة).
  specialtyDeptType: z.enum(DEPT_TYPES).optional(),
  // PRO-1 — اسم أوّل عميل يخدمه المدير المستقل. اختياري لكن مُقترَح: يجعل
  // الحساب فاعلاً من اللحظة الأولى بدل الهبوط على قائمة عملاء فارغة، ويتيح
  // للصفحات المُقيَّدة بعميل أن تشتغل مباشرة على أوّل شركة موجودة.
  firstClientName: z.string().min(1).max(120).optional(),
  firstClientMeta: firstClientMetaSchema,
  phone: z.string().max(40).optional(),
  // R1 — الآلام (6 أكواد) والأهداف (7 أكواد) المُختارة في /onboarding.
  // تُخزَّن على User لأنها ثابتة على مستوى المدير لا العميل.
  pains: painsGoalsSchema,
  goals: painsGoalsSchema,
});

export const register: RequestHandler = async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // فرض تخصّص الإدارة على المدير المستقل — لأنه يخدم عملاء متعدّدين
    // في نطاق إدارة واحدة، فبدون التخصّص لا نعرف أي إدارة يُشرف عليها.
    if (data.userType === 'MANAGER' && data.managerType === 'INDEPENDENT_PRO' && !data.specialtyDeptType) {
      throw new HttpError(400, 'يجب اختيار التخصّص (الإدارة) للمدير المستقل');
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new HttpError(409, 'البريد الإلكتروني مسجّل مسبقاً');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const verificationToken = generateVerificationToken();

    // PRO-1 — للمدير المستقل مع اسم أوّل عميل: أنشئ (User + Company + CompanyUser)
    // في transaction واحدة. هذا يجعل getMyFirstCompany() يعمل فوراً وينهي
    // مشكلة "لوحة الإدارة تعرض بيانات فارغة". الحقل اختياري: بدونه ينشأ
    // المستخدم وحده كما في السابق.
    const shouldBootstrapClient =
      data.userType === 'MANAGER' &&
      data.managerType === 'INDEPENDENT_PRO' &&
      typeof data.firstClientName === 'string' &&
      data.firstClientName.trim().length > 0;

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          name: data.name,
          userType: data.userType,
          managerType: data.managerType,
          specialtyDeptType: data.specialtyDeptType,
          phone: data.phone,
          pains: data.pains ?? [],
          goals: data.goals ?? [],
          emailVerificationToken: verificationToken,
          emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        },
      });
      if (shouldBootstrapClient) {
        const meta = data.firstClientMeta;
        const company = await tx.company.create({
          data: {
            name: data.firstClientName!.trim(),
            size: meta?.size ?? 'SMALL',
            sector: meta?.sector,
            subsector: meta?.subsector,
            entityType: meta?.entityType,
            opex: meta?.opex ?? undefined,
            country: 'SA',
          },
        });
        await tx.companyUser.create({
          data: { userId: created.id, companyId: company.id, role: 'manager' },
        });
      }
      return created;
    });

    const verifyLink = `${CLIENT_URL}/verify-email/${verificationToken}`;
    const email = verificationEmail(user.name, verifyLink);
    await sendEmail({ ...email, to: user.email });

    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

async function issueSession(
  res: Parameters<RequestHandler>[1],
  user: {
    id: string;
    email: string;
    name: string;
    userType: 'OWNER' | 'MANAGER' | 'INVESTOR';
    managerType: 'INTERNAL' | 'INDEPENDENT_PRO' | null;
    specialtyDeptType: DeptTypeStr | null;
    phone: string | null;
    avatarUrl: string | null;
    plan: 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
    isVerified: boolean;
    isAdmin: boolean;
    pains: string[];
    goals: string[];
    createdAt: Date;
  },
  ipAddress: string | undefined,
  userAgent: string | undefined
) {
  const payload: AuthPayload = { sub: user.id, userType: user.userType, plan: user.plan };
  const accessToken = signAuthToken(payload, '15m');
  const refreshToken = generateRefreshToken();

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      ipAddress,
      userAgent,
    },
  });

  res.cookie('access_token', accessToken, accessCookie);
  res.cookie('refresh_token', refreshToken, refreshCookie);
  return { accessToken, refreshToken };
}

export const login: RequestHandler = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) throw new HttpError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) throw new HttpError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');

    const { accessToken } = await issueSession(
      res,
      user,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ user: publicUser(user), accessToken });
  } catch (err) {
    next(err);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const cookies = (req as { cookies?: Record<string, string> }).cookies ?? {};
    const refresh = cookies.refresh_token;
    if (refresh) {
      await prisma.session.deleteMany({ where: { tokenHash: hashToken(refresh) } });
    }
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const cookies = (req as { cookies?: Record<string, string> }).cookies ?? {};
    const refresh = cookies.refresh_token ?? (req.body as { refreshToken?: string })?.refreshToken;
    if (!refresh) throw new HttpError(401, 'رمز التحديث مفقود');

    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(refresh) },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new HttpError(401, 'رمز التحديث غير صالح أو منتهي');
    }

    await prisma.session.delete({ where: { id: session.id } });
    const { accessToken } = await issueSession(
      res,
      session.user,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ user: publicUser(session.user), accessToken });
  } catch (err) {
    next(err);
  }
};

const forgotSchema = z.object({ email: z.string().email().toLowerCase() });

export const forgotPassword: RequestHandler = async (req, res, next) => {
  try {
    const { email } = forgotSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Don't reveal whether the email exists.
    if (user) {
      const token = generateVerificationToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });
      const link = `${CLIENT_URL}/reset-password/${token}`;
      const msg = passwordResetEmail(user.name, link);
      await sendEmail({ ...msg, to: user.email });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

const resetSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128),
});

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const data = resetSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: data.token },
    });
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new HttpError(400, 'رمز إعادة التعيين غير صالح أو منتهي');
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      }),
      // Invalidate every existing session — force re-login everywhere.
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const verifyEmail: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.token;
    const token = Array.isArray(raw) ? raw[0] : raw;
    if (!token) throw new HttpError(400, 'رمز التحقق مفقود');

    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });
    if (
      !user ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt < new Date()
    ) {
      throw new HttpError(400, 'رمز التحقق غير صالح أو منتهي');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } });
    if (!user) throw new HttpError(404, 'المستخدم غير موجود');
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};

const updateMeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export const updateMe: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const data = updateMeSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.auth.sub },
      data,
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};

// ─── R1.3 — POST /api/auth/onboarding ────────────────────────────────
// إثراء بيانات المدير بعد التسجيل: pains/goals على User + opex/sector/
// subsector/entityType على أوّل شركة (Company). طلب واحد اختياري كامل —
// يمكن تخطّي أي جزء (كل الحقول optional). يبحث عن أوّل شركة يديرها المستخدم
// عبر CompanyUser بترتيب createdAt تصاعدياً؛ إذا لم يوجد → يتخطّى تحديث OPEX.
const onboardingSchema = z.object({
  pains: painsGoalsSchema,
  goals: painsGoalsSchema,
  firstCompany: z.object({
    sector: z.string().min(1).max(80).optional(),
    subsector: z.string().min(1).max(80).optional(),
    entityType: z.string().min(1).max(40).optional(),
    size: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE']).optional(),
    opex: z.object({
      team: z.number().int().min(0).max(100000).optional(),
      budget: z.number().min(0).optional(),
      target: z.number().min(0).optional(),
      avgSalary: z.number().min(0).optional(),
    }).optional(),
  }).optional(),
});

export const onboardingEnrich: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const data = onboardingSchema.parse(req.body);
    const userId = req.auth.sub;

    const user = await prisma.$transaction(async (tx) => {
      const patch: { pains?: string[]; goals?: string[] } = {};
      if (data.pains !== undefined) patch.pains = data.pains;
      if (data.goals !== undefined) patch.goals = data.goals;
      const updatedUser = Object.keys(patch).length
        ? await tx.user.update({ where: { id: userId }, data: patch })
        : await tx.user.findUniqueOrThrow({ where: { id: userId } });

      if (data.firstCompany) {
        const link = await tx.companyUser.findFirst({
          where: { userId },
          orderBy: { company: { createdAt: 'asc' } },
          include: { company: true },
        });
        if (link) {
          const c = data.firstCompany;
          await tx.company.update({
            where: { id: link.companyId },
            data: {
              sector: c.sector ?? undefined,
              subsector: c.subsector ?? undefined,
              entityType: c.entityType ?? undefined,
              size: c.size ?? undefined,
              opex: c.opex ?? undefined,
            },
          });
        }
      }
      return updatedUser;
    });

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};
