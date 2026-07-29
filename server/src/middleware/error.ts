import { Prisma } from '@prisma/client';
import { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not Found' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', issues: err.issues });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  // مدخلات مشوّهة تصل Prisma (UUID غير صالح، حقل خاطئ) → 400 لا 500.
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: 'طلب غير صالح' });
    return;
  }
  // أخطاء معروفة: سجلّ غير موجود (P2025) → 404 · تعارض تفرّد (P2002) → 409.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'العنصر غير موجود' }); return; }
    if (err.code === 'P2002') { res.status(409).json({ error: 'قيمة مكرّرة تخالف قيد التفرّد' }); return; }
    res.status(400).json({ error: 'طلب غير صالح' });
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    console.error('[error]', err);
  }
  res.status(500).json({ error: 'Internal Server Error' });
};
