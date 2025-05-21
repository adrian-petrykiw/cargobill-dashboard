// schemas/organization.schema.ts
import { z } from 'zod';
import { jsonSchema } from './common';

// Define ISO country code validation for consistency
const iso3CountryCode = z.string().length(3, 'Country code must be 3 characters');

// Define business details schema with specific vendor-related fields
export const businessDetailsSchema = z
  .object({
    companyName: z.string().optional(),
    companyAddress: z.string().optional(),
    companyPhone: z.string().optional(),
    companyEmail: z.string().optional(),
    email: z.string().optional(),
    customFields: z
      .array(
        z.object({
          key: z.string(),
          name: z.string(),
          type: z.string(),
          required: z.boolean(),
          defaultValue: z.any().optional(),
        }),
      )
      .optional(),
  })
  .catchall(z.any())
  .optional();

export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  country: iso3CountryCode,
  business_details: jsonSchema, // Keep this as jsonSchema for flexibility
  entity_type: z.string(),
  account_status: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  data_vault_id: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  fbo_account_id: z.string().nullable().optional(), // New field
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

export const vendorSchema = organizationSchema;

// Simple vendor list item schema
export const vendorListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email().optional(),
  status: z.string().optional(),
});

export type VendorDetails = z.infer<typeof vendorSchema>;
export type VendorListItem = z.infer<typeof vendorListItemSchema>;

export const createOrganizationSchema = organizationSchema
  .omit({
    id: true,
    created_at: true,
    created_by: true,
    updated_at: true,
    data_vault_id: true,
    fbo_account_id: true, // Add this to omitted fields for create schema
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
