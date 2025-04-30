// schemas/verificationCode.schema.ts
import { z } from 'zod';
import { jsonSchema } from './common';

export const verificationCodeSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  expires_at: z.string(),
  purpose: z.string(),
  created_at: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  metadata: jsonSchema.nullable().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  used: z.boolean().nullable().optional(),
  used_at: z.string().nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
});

export type VerificationCode = z.infer<typeof verificationCodeSchema>;

export const createVerificationCodeSchema = verificationCodeSchema.omit({
  id: true,
  created_at: true,
  used: true,
  used_at: true,
});

export type CreateVerificationCodeRequest = z.infer<typeof createVerificationCodeSchema>;

export const updateVerificationCodeSchema = verificationCodeSchema
  .omit({
    created_at: true,
    code: true,
    purpose: true,
  })
  .partial()
  .required({ id: true });

export type UpdateVerificationCodeRequest = z.infer<typeof updateVerificationCodeSchema>;
