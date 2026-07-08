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
    createdAt: u.createdAt,
  };
}

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
  userType: z.enum(['OWNER', 'MANAGER', 'INVESTOR']),
  managerType: z.enum(['INTERNAL', 'INDEPENDENT_PRO']).optional(),
  // مطلوب فقط عندما userType=MANAGER و managerType=INDEPENDENT_PRO.
  // يفرضه الكونترولر أدناه (Zod لا يعبّر عن التبعية بين حقلين بسهولة).
  specialtyDeptType: z.enum(DEPT_TYPES).optional(),
  phone: z.string().max(40).optional(),
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

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        userType: data.userType,
        managerType: data.managerType,
        specialtyDeptType: data.specialtyDeptType,
        phone: data.phone,
        emailVerificationToken: verificationToken,
        emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
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
