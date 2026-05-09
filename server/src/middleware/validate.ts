import { RequestHandler } from 'express';
import { ZodTypeAny, infer as ZodInfer } from 'zod';

type Source = 'body' | 'query' | 'params';

export function validate<T extends ZodTypeAny>(schema: T, source: Source = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    (req as unknown as Record<Source, ZodInfer<T>>)[source] = result.data;
    next();
  };
}
