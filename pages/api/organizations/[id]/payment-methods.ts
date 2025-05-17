// pages/api/organizations/[id]/payment-methods.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../../_middleware/withAuth';
import { AuthenticatedRequest } from '@/types/api/requests';
import { withRateLimit } from '../../_middleware/rateLimiter';
import { footprintService } from '../../_services/footprintService';
import { ApiError } from '@/types/api/errors';
import { supabaseAdmin } from '../../_config/supabase';
import { mapToZynkAccountFormat } from '@/schemas/payment-method.schema';
import { convertToAlpha2 } from '@/lib/helpers/countryCodeUtils';
import { getBankingFieldsForCountry } from '@/schemas/banking-fields.schema';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Get organization ID from the request
  const organizationId = req.query.id as string;

  try {
    // Check if user is a member of the specified organization
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .single();

    if (memberError || !memberData) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this organization',
        },
      });
    }

    // Fetch organization data from Supabase
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (orgError || !organization) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Organization not found',
        },
      });
    }

    // Check if organization is verified
    const isVerified = !!(
      organization &&
      organization.last_verified_at !== null &&
      organization.verification_status === 'verified'
    );

    if (!isVerified) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ORGANIZATION_NOT_VERIFIED',
          message: 'Business verification is required to manage payment methods',
        },
      });
    }

    // Get Footprint business ID
    const footprintBusinessId = organization.data_vault_id;

    if (!footprintBusinessId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FOOTPRINT_ID',
          message: 'Organization does not have a Footprint business ID',
        },
      });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        // Get payment methods from Footprint
        const paymentMethods = await footprintService.getBusinessPaymentMethods(
          footprintBusinessId,
          `Payment methods view by ${req.user.id}`,
        );

        return res.status(200).json({
          success: true,
          data: paymentMethods,
        });

      case 'POST':
        // Add a new payment method
        const { type, ...paymentData } = req.body;

        if (!type || (type !== 'bank_account' && type !== 'card')) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PAYMENT_TYPE',
              message: 'Invalid payment method type',
            },
          });
        }

        if (type === 'bank_account') {
          // Get bank country and validate required fields
          const bankCountry = paymentData.bankCountry || 'US';
          const alpha2Country = convertToAlpha2(bankCountry);

          // Get banking field configuration for this country
          const config = getBankingFieldsForCountry(alpha2Country);

          // Check for required fields based on country
          const missingFields = config.required.filter((field: string) => !paymentData[field]);

          if (missingFields.length > 0) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'MISSING_FIELDS',
                message: `Missing required fields for bank account: ${missingFields.join(', ')}`,
              },
            });
          }

          // Directly use the bank account storage method
          await footprintService.storeBusinessBankAccount(footprintBusinessId, {
            accountNumber: paymentData.accountNumber || '',
            routingNumber: paymentData.routingNumber || '',
            accountHolderName: paymentData.accountHolderName,
            bankName: paymentData.bankName || '',
            accountType: paymentData.accountType,
            bankCountry: alpha2Country,
          });

          // For bank accounts, also add to Zynk if organization has a ramping entity ID
          if (organization.ramping_entity_id) {
            try {
              const zynkService = require('../../_services/zynkService').default;

              // Get all jurisdictions to find the right one for the bank country
              const jurisdictionsResult = await zynkService.getJurisdictions();
              let jurisdictionId = '';

              if (jurisdictionsResult.success && jurisdictionsResult.data) {
                // Find jurisdiction for the bank's country
                const matchingJurisdiction = jurisdictionsResult.data.find(
                  (j: any) => j.type === 'COUNTRY' && j.countryCode === alpha2Country,
                );

                if (matchingJurisdiction) {
                  jurisdictionId = matchingJurisdiction.jurisdictionId;
                } else {
                  // Default to first country jurisdiction if no match (or US if available)
                  const usJurisdiction = jurisdictionsResult.data.find(
                    (j: any) => j.type === 'COUNTRY' && j.countryCode === 'US',
                  );
                  const anyCountryJurisdiction = jurisdictionsResult.data.find(
                    (j: any) => j.type === 'COUNTRY',
                  );
                  jurisdictionId =
                    usJurisdiction?.jurisdictionId || anyCountryJurisdiction?.jurisdictionId || '';
                }
              }

              if (!jurisdictionId) {
                throw new Error('No valid jurisdiction found for bank country');
              }

              // Map our data to Zynk's expected format
              const zynkAccountData = mapToZynkAccountFormat(paymentData, alpha2Country);

              // Add account to Zynk
              const addAccountParams = {
                jurisdictionID: jurisdictionId,
                account: zynkAccountData,
              };

              await zynkService.addEntityAccount(organization.ramping_entity_id, addAccountParams);
            } catch (zynkError) {
              console.error('Error adding bank account to Zynk:', zynkError);
              // Don't fail the request if Zynk integration fails, just log it
            }
          }

          return res.status(201).json({
            success: true,
            data: {
              message: 'Bank account added successfully',
            },
          });
        } else if (type === 'card') {
          // Required fields for card
          const { cardholderName, cardNumber, expiryDate, cvv, billingZip, billingCountry } =
            paymentData;

          if (!cardholderName || !cardNumber || !expiryDate || !cvv) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'MISSING_FIELDS',
                message: 'Missing required fields for card',
              },
            });
          }

          // Store card in Footprint vault with correctly formatted field names
          await footprintService.storeBusinessCard(footprintBusinessId, {
            cardholderName,
            cardNumber,
            expiryDate,
            cvv,
            cardType: paymentData.cardType,
            billingZip, // Optional billing address fields
            billingCountry,
          });

          return res.status(201).json({
            success: true,
            data: {
              message: 'Card added successfully',
            },
          });
        }

        break;

      case 'DELETE':
        // Remove a payment method
        const { methodType, methodId } = req.query;

        if (!methodType || (methodType !== 'bank_account' && methodType !== 'payment_card')) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_PAYMENT_METHOD_TYPE',
              message: 'Invalid payment method type',
            },
          });
        }

        // Map old method types to new format
        const vaultMethodType = methodType === 'bank_account' ? 'bank' : 'card';

        // Remove from Footprint vault
        await footprintService.removeBusinessPaymentMethod(
          footprintBusinessId,
          vaultMethodType,
          methodId as string,
        );

        // If it's a bank account and we have a ramping entity ID, remove from Zynk too
        if (methodType === 'bank_account' && organization.ramping_entity_id) {
          try {
            const zynkService = require('../../_services/zynkService').default;

            // Get the account from Zynk by querying all accounts and matching by footprint ID
            const accountsResult = await zynkService.getEntityAccounts(
              organization.ramping_entity_id,
            );

            if (accountsResult.success && accountsResult.data && accountsResult.data.accounts) {
              // We need to find the account to delete based on some matching criteria
              // This is simplified - you may need a more robust matching strategy
              const account = accountsResult.data.accounts.find((acc: any) => {
                // Match based on what data is available. For example:
                // - Match the last 4 digits of account number if available
                // - Match bank name if available
                // - etc.
                return true; // This is a placeholder - implement the actual matching logic
              });

              if (account) {
                await zynkService.removeEntityAccount(
                  organization.ramping_entity_id,
                  account.accountId,
                );
              }
            }
          } catch (zynkError) {
            console.error('Error removing bank account from Zynk:', zynkError);
            // Don't fail the request if Zynk integration fails, just log it
          }
        }

        return res.status(200).json({
          success: true,
          data: {
            message: 'Payment method removed successfully',
          },
        });

      default:
        return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
    }
  } catch (error) {
    console.error('Error managing payment methods:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit((req, res) => withAuthMiddleware(handler)(req, res), 'standard');
