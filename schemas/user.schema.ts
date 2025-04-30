// schemas/user.schema.ts
import { z } from 'zod';
import { jsonSchema } from './common';

export const userSchema = z.object({
  id: z.string().uuid(),
  auth_id: z.string(),
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  wallet_address: z.string(),
  created_at: z.string().nullable().optional(),
  last_sign_in: z.string().nullable().optional(),
  mailing_address: jsonSchema.nullable().optional(),
  phone_number: z.string().nullable().optional(),
  preferences: jsonSchema.nullable().optional(),
  primary_address: jsonSchema.nullable().optional(),
  profile_image_url: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export type User = z.infer<typeof userSchema>;

export const createUserSchema = userSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  last_sign_in: true,
});

export type CreateUserRequest = z.infer<typeof createUserSchema>;

export const updateUserSchema = userSchema
  .omit({
    created_at: true,
    auth_id: true,
  })
  .partial()
  .required({ id: true });

export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
