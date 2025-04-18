// pages/api/ramp/initiate_onramp.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as zynkService from '../_services/zynkService';
import * as privyService from '../_services/privyService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Initiate the onramp process after user has selected jurisdiction and amount
 *
 * This endpoint:
 * 1. Verifies the user (authentication only)
 * 2. Validates the business entity exists
 * 3. Ensures the entity has necessary accounts
 * 4. Simulates the transfer
 * 5. Returns execution data for client to complete the transfer
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const headerAuthToken = req.headers.authorization?.replace(/^Bearer /, '');
    const cookieAuthToken = req.cookies['privy-token'];
    const authToken = cookieAuthToken || headerAuthToken;

    if (!authToken) {
      return res.status(401).json({ error: 'Missing authentication token' });
    }

    await privyService.verifyToken(authToken);

    const {
      entityId,
      jurisdictionId,
      amount,
      walletAddress,
      transactionId = uuidv4(), // Generate a unique ID if not provided
      // Bank account details for non-blockchain jurisdictions
      accountNumber,
      accountHolderName,
      bankName,
      bankCountry,
      bankAddress,
      bankSwiftCode,
      bankRoutingNumber,
      bankIban,
      bankBic,
      branchCode,
      accountType,
      // Optional callback URL for notifications
      callbackUrl,
      // Optional exact amount out (alternative to exactAmountIn)
      exactAmountOut,
      // Optional flag for counterparty risk acknowledgment
      counterPartyRiskAcknowledged = false,
    } = req.body;

    if (!entityId || !jurisdictionId || (!amount && !exactAmountOut)) {
      return res.status(400).json({
        error: 'Missing required parameters',
        requiredFields: ['entityId', 'jurisdictionId', 'amount or exactAmountOut'],
      });
    }

    // Verify entity exists by ID and is a business
    try {
      const entityResult = await zynkService.getEntityById(entityId);
      if (!entityResult.success) {
        return res.status(404).json({
          error: 'Entity not found',
          message: 'The specified entity could not be found.',
        });
      }

      if (entityResult.data.entity.type !== 'business') {
        return res.status(400).json({
          error: 'Entity is not a business',
          message: 'Only business entities can initiate onramps in this application.',
        });
      }
    } catch (error) {
      console.error('Error verifying entity:', error);
      return res.status(500).json({
        error: 'Failed to verify entity',
        message: 'Unable to verify the specified entity.',
      });
    }

    let accountId;
    const accountsResult = await zynkService.getEntityAccounts(entityId);

    if (!accountsResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch entity accounts',
        details: accountsResult.data,
      });
    }

    // Look for an existing account with the specified jurisdiction
    const existingAccount = accountsResult.data.accounts.find(
      (account: any) => account.jurisdictionId === jurisdictionId,
    );

    if (existingAccount) {
      accountId = existingAccount.accountId;
    } else {
      // Create a new account for this jurisdiction
      const jurisdictionsResult = await zynkService.getJurisdictions();

      if (!jurisdictionsResult.success) {
        return res.status(500).json({
          error: 'Failed to fetch jurisdictions',
          details: jurisdictionsResult.data,
        });
      }

      const jurisdiction = jurisdictionsResult.data.find(
        (j: any) => j.jurisdictionId === jurisdictionId,
      );

      if (!jurisdiction) {
        return res.status(400).json({
          error: 'Invalid jurisdiction ID',
          message: 'The provided jurisdiction ID is not valid or not available.',
        });
      }

      const accountParams: any = {
        jurisdictionID: jurisdictionId,
      };

      if (jurisdiction.jurisdictionType === 'blockchain') {
        // Validate wallet address for blockchain jurisdictions
        if (!walletAddress) {
          return res.status(400).json({
            error: 'Missing wallet address',
            message: 'A wallet address is required for blockchain jurisdictions.',
          });
        }

        accountParams.wallet = {
          walletAddress,
        };
      } else {
        // Validate bank account details for non-blockchain jurisdictions
        if (!accountNumber || !accountHolderName || !bankName || !bankCountry) {
          return res.status(400).json({
            error: 'Missing bank account details',
            message: 'Bank account details are required for non-blockchain jurisdictions.',
            requiredFields: ['accountNumber', 'accountHolderName', 'bankName', 'bankCountry'],
          });
        }

        accountParams.account = {
          accountNumber,
          accountHolderName,
          bankName,
          bankCountry,
          // Optional bank details
          bankAddress,
          bankSwiftCode,
          bankRoutingNumber,
          bankIban,
          bankBic,
          branchCode,
          accountType,
        };
      }

      // Create the account
      const createAccountResult = await zynkService.addEntityAccount(entityId, accountParams);

      if (!createAccountResult.success) {
        return res.status(500).json({
          error: 'Failed to create entity account',
          details: createAccountResult.data,
        });
      }

      accountId = createAccountResult.data.accountId;
    }

    const kycStatusResult = await zynkService.getKycStatus(entityId);

    if (!kycStatusResult.success) {
      return res.status(500).json({
        error: 'Failed to fetch KYC status',
        details: kycStatusResult.data,
      });
    }

    const kycStatus = kycStatusResult.data.status;
    const routeApproved = kycStatus.some(
      (status: any) =>
        status.kycStatus === 'approved' &&
        status.routingEnabled &&
        status.supportedRoutes.some(
          (route: any) =>
            route.to.jurisdictionId === jurisdictionId ||
            route.from.jurisdictionId === jurisdictionId,
        ),
    );

    if (!routeApproved) {
      // Find the appropriate routing provider for this jurisdiction
      const routingProvider = kycStatus.find((status: any) =>
        status.supportedRoutes.some(
          (route: any) =>
            route.to.jurisdictionId === jurisdictionId ||
            route.from.jurisdictionId === jurisdictionId,
        ),
      );

      if (routingProvider) {
        const routingId = routingProvider.routingId;

        const requirementsResult = await zynkService.getKycRequirements(entityId, routingId);

        if (!requirementsResult.success) {
          return res.status(500).json({
            error: 'Failed to fetch KYC requirements',
            details: requirementsResult.data,
          });
        }

        return res.status(200).json({
          success: true,
          data: {
            kycRequired: true,
            kycRequirements: requirementsResult.data.kycRequirements,
            routingId,
            entityId,
            jurisdictionId,
            feeDetails: routingProvider.kycFees,
            supportedRoutes: routingProvider.supportedRoutes,
          },
        });
      } else {
        return res.status(400).json({
          error: 'No routing provider available for this jurisdiction',
          message: 'We currently do not support onramping for the selected jurisdiction.',
        });
      }
    }

    // Get available providers for this simulation
    const allProviders = kycStatus.filter(
      (status: any) =>
        status.kycStatus === 'approved' &&
        status.routingEnabled &&
        status.supportedRoutes.some(
          (route: any) =>
            route.to.jurisdictionId === jurisdictionId ||
            route.from.jurisdictionId === jurisdictionId,
        ),
    );

    if (allProviders.length === 0) {
      return res.status(400).json({
        error: 'No enabled providers found',
        message: 'There are no enabled providers for the selected jurisdiction.',
      });
    }

    // Use the first available provider
    const selectedProvider = allProviders[0];

    // Prepare the simulation parameters
    const simulateParams = {
      transactionId,
      fromEntityId: entityId,
      fromAccountId: accountId,
      toEntityId: entityId, // For a real implementation, this would likely be a different entity
      toAccountId: accountId, // For a real implementation, this would be a different account
      exactAmountIn: amount,
      exactAmountOut: exactAmountOut,
    };

    const simulateResult = await zynkService.simulateTransfer(simulateParams);

    if (!simulateResult.success) {
      return res.status(500).json({
        error: 'Failed to simulate transfer',
        details: simulateResult.data,
      });
    }

    // Return the execution data for the client to proceed
    return res.status(200).json({
      success: true,
      data: {
        executionId: simulateResult.data.executionId,
        transactionId: transactionId,
        quote: simulateResult.data.quote,
        depositAccount: simulateResult.data.depositAccount,
        providerDetails: {
          routingId: selectedProvider.routingId,
          supportedRoutes: selectedProvider.supportedRoutes,
        },
        nextStep: 'execute_transfer',
        transferParams: {
          executionId: simulateResult.data.executionId,
          transferAcknowledgement: 'I acknowledge this transfer',
          callbackUrl: callbackUrl,
          counterPartyRiskAcknowledged: counterPartyRiskAcknowledged,
        },
      },
    });
  } catch (error: any) {
    console.error('Onramp initiation error:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
    });
  }
}
