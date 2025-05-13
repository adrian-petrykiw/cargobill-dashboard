// schemas/multisig.schema.ts

import { z } from 'zod';
import { onboardingOrganizationSchema } from './organization.schema';

// Basic schema for completing multisig registration
export const createOrgWithMultisigSchema = z.object({
  organizationData: onboardingOrganizationSchema,
  signature: z.string(),
  multisigPda: z.string(),
  createKey: z.string(),
});

export type CreateOrgWithMultisigRequest = z.infer<typeof createOrgWithMultisigSchema>;
