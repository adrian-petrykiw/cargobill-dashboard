// schemas/kyb.schema.ts
import { z } from 'zod';

// Document types enum
export const DocumentType = {
  BUSINESS_FORMATION: 'business_formation',
  BUSINESS_OWNERSHIP: 'business_ownership',
  PROOF_OF_ADDRESS: 'proof_of_address',
  TAX_ID: 'tax_id',
  BENEFICIAL_OWNER_ID: 'beneficial_owner_id',
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

// Basic information form schema
export const businessBasicInfoSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  businessType: z.string({
    required_error: 'Please select your business type',
  }),
  businessDescription: z.string().min(10, 'Please provide a detailed business description'),
  isIntermediary: z.enum(['yes', 'no'], {
    required_error: 'Please specify if you are an intermediary',
  }),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Please enter a valid email'),
  countriesOfOperation: z.array(z.string()).min(1, 'Please select at least one country'),
});

export type BusinessBasicInfoFormData = z.infer<typeof businessBasicInfoSchema>;

// Document token request schema
export const documentTokenRequestSchema = z.object({
  organizationId: z.string(),
  documentType: z.string(),
  fields: z.array(z.string()),
});

export type DocumentTokenRequest = z.infer<typeof documentTokenRequestSchema>;

// Beneficial owner token request schema
export const beneficialOwnerTokenRequestSchema = z.object({
  organizationId: z.string(),
  ownerIndex: z.number(),
  fields: z.array(z.string()),
});

export type BeneficialOwnerTokenRequest = z.infer<typeof beneficialOwnerTokenRequestSchema>;

// Verification initiation request schema
export const verificationInitiationRequestSchema = z.object({
  organizationId: z.string(),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms to proceed',
  }),
});

export type VerificationInitiationRequest = z.infer<typeof verificationInitiationRequestSchema>;

// Verification status response schema
export const verificationStatusResponseSchema = z.object({
  status: z.enum(['pass', 'fail', 'pending', 'pending_review', 'none']),
  requires_manual_review: z.boolean().optional(),
});

export type VerificationStatusResponse = z.infer<typeof verificationStatusResponseSchema>;
