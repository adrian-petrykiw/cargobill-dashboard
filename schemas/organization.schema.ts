// schemas/organization.schema.ts
import { z } from 'zod';
import { jsonSchema } from './common';

// Define ISO country code validation for consistency
const iso3CountryCode = z.string().length(3, 'Country code must be 3 characters');

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  country: iso3CountryCode,
  business_details: jsonSchema,
  entity_type: z.string(),
  account_status: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  data_vault_id: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  global_organization_id: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  invited_at: z.string().nullable().optional(),
  invited_by: z.string().nullable().optional(),
  last_verified_at: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  operational_wallet: jsonSchema.nullable().optional(),
  preferences: jsonSchema.nullable().optional(),
  primary_address: jsonSchema.nullable().optional(),
  ramping_entity_id: z.string().nullable().optional(),
  subscription_tier: z.string().default('free'),
  treasury_wallet: jsonSchema.nullable().optional(),
  updated_at: z.string().nullable().optional(),
  verification_provider: z.string().nullable().optional(),
  verification_status: z.string(),
  website: z.string().nullable().optional(),
  yield_wallet: jsonSchema.nullable().optional(),
});

export type Organization = z.infer<typeof organizationSchema>;

export const createOrganizationSchema = organizationSchema
  .omit({
    id: true,
    created_at: true,
    created_by: true,
    updated_at: true,
    data_vault_id: true,
    global_organization_id: true,
    invited_at: true,
    invited_by: true,
    last_verified_at: true,
    ramping_entity_id: true,
    treasury_wallet: true,
    yield_wallet: true,
  })
  .extend({
    verification_status: z.enum(['unverified']),
    subscription_tier: z.string().default('free'),
    entity_type: z.string().default('standalone'),
    account_status: z.string().default('active'),
    verification_provider: z.string().default('footprint'),
  });

export type CreateOrganizationRequest = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = organizationSchema
  .omit({
    created_at: true,
    created_by: true,
    invited_at: true,
    invited_by: true,
  })
  .partial()
  .required({ id: true });

export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationSchema>;

export const onboardingOrganizationSchema = z.object({
  business_name: z.string().min(1, 'Business name is required'),
  country: iso3CountryCode,
  business_email: z.string().email('Valid business email required'),
});

export type OnboardingOrganizationRequest = z.infer<typeof onboardingOrganizationSchema>;
