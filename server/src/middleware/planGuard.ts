import { RequestHandler } from 'express';
import { HttpError } from './error';
import { AuthPayload } from './auth';

type Plan = AuthPayload['plan'];

const RANK: Record<Plan, number> = {
  BASIC: 0,
  PROFESSIONAL: 1,
  ENTERPRISE: 2,
};

const AR_LABEL: Record<Plan, string> = {
  BASIC: 'الأساسية',
  PROFESSIONAL: 'الاحترافية',
  ENTERPRISE: 'المؤسسية',
};

/**
 * 402 if the authenticated user's plan is below the required tier.
 * Use AFTER requireAuth: `router.post(..., requireAuth, requirePlan('PROFESSIONAL'), handler)`.
 */
export function requirePlan(minimum: Plan): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new HttpError(401, 'Not authenticated'));
    if (RANK[req.auth.plan] < RANK[minimum]) {
      return next(new HttpError(
        402,
        `هذه الميزة تتطلب الباقة ${AR_LABEL[minimum]}`,
        { requiredPlan: minimum, currentPlan: req.auth.plan, upgradeUrl: '/pricing' },
      ));
    }
    next();
  };
}
