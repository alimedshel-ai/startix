import { RequestHandler } from 'express';
import { HttpError } from './error';
import { AuthPayload } from './auth';

type Plan = AuthPayload['plan'];

const RANK: Record<Plan, number> = {
  BASIC: 0,
  PROFESSIONAL: 1,
  ENTERPRISE: 2,
};

export function requirePlan(minimum: Plan): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new HttpError(401, 'Not authenticated'));
    if (RANK[req.auth.plan] < RANK[minimum]) {
      return next(new HttpError(402, `This feature requires the ${minimum} plan`));
    }
    next();
  };
}
