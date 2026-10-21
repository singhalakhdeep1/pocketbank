import type { Request } from 'express';
import { z } from 'zod';
import { badRequest } from '../lib/errors.js';

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest(
      'Validation failed',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

export const body = <T extends z.ZodType>(req: Request, schema: T) => parse(schema, req.body ?? {});
export const query = <T extends z.ZodType>(req: Request, schema: T) => parse(schema, req.query ?? {});

/** Positive amount with at most two decimals. */
export const money = z.coerce
  .number()
  .positive()
  .max(1_000_000)
  .refine((v) => Math.round(v * 100) === Number((v * 100).toFixed(6)), 'At most 2 decimal places');
