import { RequestHandler } from 'express';
import { HttpError } from './error';
import { AuthPayload } from './auth';

type Role = AuthPayload['userType'];

export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new HttpError(401, 'Not authenticated'));
    if (!allowed.includes(req.auth.userType)) {
      return next(new HttpError(403, 'Forbidden for your role'));
    }
    next();
  };
}
