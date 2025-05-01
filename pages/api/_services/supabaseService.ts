// pages/api/_services/supabaseService.ts
import { organizationRepository } from './repositories/organizationRepository';
import { transactionRepository } from './repositories/transactionRepository';
import { userRepository } from './repositories/userRepository';
import { verificationCodeRepository } from './repositories/verificationCodeRepository';

export const supabaseService = {
  organizations: organizationRepository,
  users: userRepository,
  transactions: transactionRepository,
  verificationCodes: verificationCodeRepository,
  // TODO Add other repositories
};
