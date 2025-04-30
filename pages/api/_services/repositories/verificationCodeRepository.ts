// pages/api/_services/repositories/verificationCodeRepository.ts
import { supabaseAdmin } from '../../_config/supabase';
import {
  createVerificationCodeSchema,
  type VerificationCode,
} from '@/schemas/verificationCode.schema';
import { generateRandomCode, constantTimeCompare } from '../../_utils/securityUtils';
import { logger } from '../../_config/logger';

/**
 * Repository for handling verification code operations
 * Follows security best practices for financial applications
 */
export const verificationCodeRepository = {
  /**
   * Retrieves an active verification code by its value and purpose
   *
   * @param code - The verification code to look up
   * @param purpose - The purpose of the verification code
   * @returns The verification code object if found and valid, null otherwise
   */
  async getByCode(code: string, purpose: string): Promise<VerificationCode | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('verification_codes')
        .select('*')
        .eq('code', code)
        .eq('purpose', purpose)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error) {
        logger.error({
          message: 'Failed to retrieve verification code',
          purpose,
          error: error.message,
          code: error.code,
        });
        throw new Error(`Failed to get verification code: ${error.message}`);
      }

      return data;
    } catch (error) {
      logger.error({
        message: 'Exception in getByCode',
        purpose,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Creates a new verification code
   *
   * @param purpose - The purpose of the verification code (e.g., 'email_verification', 'password_reset')
   * @param expiresInMinutes - Minutes until the code expires (default: 30)
   * @param metadata - Additional data to store with the code
   * @param userId - Associated user ID (optional)
   * @param email - Associated email (optional)
   * @param organizationId - Associated organization ID (optional)
   * @returns The created verification code
   */
  async create(
    purpose: string,
    expiresInMinutes: number = 30,
    metadata: Record<string, any> | null = null,
    userId: string | null = null,
    email: string | null = null,
    organizationId: string | null = null,
  ): Promise<VerificationCode> {
    try {
      // Generate a cryptographically secure random code
      const codeType = purpose === 'totp_verification' ? 'numeric' : 'alphanumeric';
      const codeLength = purpose === 'totp_verification' ? 6 : 8;
      const code = generateRandomCode(codeLength, codeType);

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

      const verificationData = {
        code,
        purpose,
        expires_at: expiresAt.toISOString(),
        metadata,
        user_id: userId,
        email,
        organization_id: organizationId,
        used: false,
      };

      // Validate with Zod schema
      const validData = createVerificationCodeSchema.parse(verificationData);

      // Insert record with transaction pattern
      const { data, error } = await supabaseAdmin
        .from('verification_codes')
        .insert(validData)
        .select()
        .single();

      if (error) {
        logger.error({
          message: 'Failed to create verification code',
          purpose,
          error: error.message,
          userId,
          email,
        });
        throw new Error(`Failed to create verification code: ${error.message}`);
      }

      if (!data) {
        logger.error({
          message: 'No data returned after verification code creation',
          purpose,
          userId,
          email,
        });
        throw new Error('Failed to retrieve created verification code');
      }

      logger.info({
        message: 'Verification code created successfully',
        purpose,
        id: data.id,
        userId,
        email,
        expiresAt: expiresAt.toISOString(),
      });

      return data;
    } catch (error) {
      logger.error({
        message: 'Exception in create verification code',
        purpose,
        userId,
        email,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to create verification code: ${String(error)}`);
    }
  },

  /**
   * Marks a verification code as used
   *
   * @param id - The ID of the verification code
   */
  async markAsUsed(id: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('verification_codes')
        .update({
          used: true,
          used_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        logger.error({
          message: 'Failed to mark verification code as used',
          id,
          error: error.message,
        });
        throw new Error(`Failed to mark verification code as used: ${error.message}`);
      }

      logger.info({
        message: 'Verification code marked as used',
        id,
      });
    } catch (error) {
      logger.error({
        message: 'Exception in markAsUsed',
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Validates a verification code for a specific purpose
   * Uses constant-time comparison to prevent timing attacks
   *
   * @param code - The verification code to validate
   * @param purpose - The purpose of the verification code
   * @returns Object with validation result and code data if valid
   */
  async validateCode(
    code: string,
    purpose: string,
  ): Promise<{ valid: boolean; data?: VerificationCode }> {
    try {
      // Fetch valid codes for this purpose
      const { data, error } = await supabaseAdmin
        .from('verification_codes')
        .select('*')
        .eq('purpose', purpose)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString());

      if (error) {
        logger.error({
          message: 'Error retrieving verification codes for validation',
          purpose,
          error: error.message,
        });
        throw new Error(`Failed to validate code: ${error.message}`);
      }

      // Find matching code using constant-time comparison to prevent timing attacks
      const matchingCode = data?.find((item) => constantTimeCompare(item.code, code));

      if (!matchingCode) {
        logger.info({
          message: 'Invalid verification code attempt',
          purpose,
        });
        return { valid: false };
      }

      // Mark code as used
      await this.markAsUsed(matchingCode.id);

      logger.info({
        message: 'Verification code validated successfully',
        purpose,
        id: matchingCode.id,
      });

      return {
        valid: true,
        data: matchingCode,
      };
    } catch (error) {
      logger.error({
        message: 'Exception in validateCode',
        purpose,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Cleans up expired verification codes
   * This method should be called periodically, e.g., via a cron job
   */
  async cleanupExpiredCodes(): Promise<number> {
    try {
      const { data, error } = await supabaseAdmin
        .from('verification_codes')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .eq('used', false)
        .select(); // Add this to get the deleted rows with correct typing

      if (error) {
        logger.error({
          message: 'Failed to clean up expired verification codes',
          error: error.message,
        });
        throw new Error(`Failed to clean up expired codes: ${error.message}`);
      }

      // Now TypeScript knows data is an array
      const count = data?.length || 0;
      logger.info({
        message: 'Cleaned up expired verification codes',
        count,
      });

      return count;
    } catch (error) {
      logger.error({
        message: 'Exception in cleanupExpiredCodes',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};
