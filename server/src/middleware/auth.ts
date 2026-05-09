import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { HttpError } from './error';

export interface AuthPayload {
  sub: string;
  userType: 'OWNER' | 'MANAGER' | 'INVESTOR';
  plan: 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Missing bearer token'));
  }
  const token = header.slice('Bearer '.length);
  const secret = process.env.JWT_SECRET;
  if (!secret) return next(new HttpError(500, 'JWT_SECRET not configured'));

  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload & AuthPayload;
    req.auth = { sub: decoded.sub!, userType: decoded.userType, plan: decoded.plan };
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
};

export function signAuthToken(payload: AuthPayload, expiresIn: string = '7d'): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new HttpError(500, 'JWT_SECRET not configured');
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}
