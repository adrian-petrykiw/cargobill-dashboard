// schemas/organizationMember.schema.ts
import { z } from 'zod';
import { jsonSchema } from './common';

export const organizationMemberSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  role: z.string(),
  created_at: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  invited_at: z.string().nullable().optional(),
  invited_by: z.string().nullable().optional(),
  joined_at: z.string().nullable().optional(),
  permissions: jsonSchema.nullable().optional(),
  status: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  user_id: z.string().uuid().nullable().optional(),
});

export type OrganizationMember = z.infer<typeof organizationMemberSchema>;

export const createOrganizationMemberSchema = organizationMemberSchema
  .omit({
    id: true,
    created_at: true,
    joined_at: true,
    updated_at: true,
  })
  .extend({
    status: z.enum(['pending', 'active', 'suspended']).default('pending'),
  });

export type CreateOrganizationMemberRequest = z.infer<typeof createOrganizationMemberSchema>;

export const updateOrganizationMemberSchema = organizationMemberSchema
  .omit({
    created_at: true,
    invited_at: true,
    invited_by: true,
  })
  .partial()
  .required({ id: true });

export type UpdateOrganizationMemberRequest = z.infer<typeof updateOrganizationMemberSchema>;
