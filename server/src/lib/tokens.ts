import crypto from 'node:crypto';

const REFRESH_TOKEN_BYTES = 48;
const VERIFICATION_TOKEN_BYTES = 32;

export const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const ACCESS_TOKEN_TTL = '15m';
export const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
export const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60; // 1 hour

export function generateRefreshToken(): string {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(VERIFICATION_TOKEN_BYTES).toString('base64url');
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
