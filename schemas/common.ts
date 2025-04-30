// schemas/common.ts
import { z } from 'zod';

// Define explicitly typed recursive schema
export type JsonSchema = z.ZodType<any, any, any>;

export const jsonSchema: JsonSchema = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(
      z.string(),
      z.lazy(() => jsonSchema),
    ),
    z.array(z.lazy(() => jsonSchema)),
  ]),
);
