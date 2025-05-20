// pages/api/ramp/onramp/simulate.ts
import type { NextApiResponse } from 'next';
import { withAuthMiddleware } from '../../_middleware/withAuth';
import { AuthenticatedRequest } from '@/types/api/requests';
import { withRateLimit } from '../../_middleware/rateLimiter';
import { ApiError } from '@/types/api/errors';
import { supabaseAdmin } from '../../_config/supabase';
import zynkService from '../../_services/zynkService';
import { v4 as uuidv4 } from 'uuid';
import { SimulateTransferParams } from '@/types/zynk';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    const { organizationId, amount, token, paymentMethodId, destinationAddress } = req.body;

    if (!organizationId || !amount || !token || !paymentMethodId || !destinationAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Missing required parameters',
        },
      });
    }

    // Check if user is member of the organization
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

    // Get organization data
    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (orgError || !organization) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORGANIZATION_NOT_FOUND',
          message: 'Organization not found',
        },
      });
    }

    // Check if organization has a ramping entity ID
    if (!organization.ramping_entity_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_RAMPING_ENTITY',
          message:
            'Organization does not have a Zynk entity. Please complete business verification first.',
        },
      });
    }

    // First, we need to get the entity accounts to find the correct accountIds
    const accountsResult = await zynkService.getEntityAccounts(organization.ramping_entity_id);

    if (!accountsResult.success || !accountsResult.data || !accountsResult.data.accounts) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'ACCOUNTS_FETCH_FAILED',
          message: 'Failed to fetch entity accounts',
        },
      });
    }

    // Find the bank account that matches the paymentMethodId
    const bankAccount = accountsResult.data.accounts.find((acc: any) => {
      // Match based on account number (last 4 digits match)
      return (
        acc.account &&
        acc.account.accountNumber &&
        acc.account.accountNumber.endsWith(paymentMethodId.slice(-4))
      );
    });

    // Find the wallet account that matches the destination address
    let walletAccount = accountsResult.data.accounts.find((acc: any) => {
      return (
        acc.wallet && acc.wallet.walletAddress && acc.wallet.walletAddress === destinationAddress
      );
    });

    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'BANK_ACCOUNT_NOT_FOUND',
          message: 'Bank account not found in Zynk',
        },
      });
    }

    if (!walletAccount) {
      // If wallet account doesn't exist yet, we need to create it
      const jurisdictionsResult = await zynkService.getJurisdictions();
      if (!jurisdictionsResult.success || !jurisdictionsResult.data) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'JURISDICTIONS_FETCH_FAILED',
            message: 'Failed to fetch jurisdictions',
          },
        });
      }

      // Find blockchain jurisdiction for the token
      const blockchainJurisdiction = jurisdictionsResult.data.find(
        (j: any) => j.type === 'BLOCKCHAIN' && j.currency === token,
      );

      if (!blockchainJurisdiction) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BLOCKCHAIN_JURISDICTION_NOT_FOUND',
            message: `No blockchain jurisdiction found for ${token}`,
          },
        });
      }

      // Add the wallet as an entity account
      const addWalletResult = await zynkService.addEntityAccount(organization.ramping_entity_id, {
        jurisdictionID: blockchainJurisdiction.jurisdictionId,
        wallet: {
          walletAddress: destinationAddress,
        },
      });

      if (!addWalletResult.success || !addWalletResult.data) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'WALLET_ADDITION_FAILED',
            message: 'Failed to add wallet to entity',
          },
        });
      }

      // Get the accounts again to get the new wallet account
      const updatedAccountsResult = await zynkService.getEntityAccounts(
        organization.ramping_entity_id,
      );
      if (
        updatedAccountsResult.success &&
        updatedAccountsResult.data &&
        updatedAccountsResult.data.accounts
      ) {
        // Find the newly added wallet account
        const newWalletAccount = updatedAccountsResult.data.accounts.find((acc: any) => {
          return (
            acc.wallet &&
            acc.wallet.walletAddress &&
            acc.wallet.walletAddress === destinationAddress
          );
        });

        if (newWalletAccount) {
          walletAccount = newWalletAccount;
        } else {
          return res.status(500).json({
            success: false,
            error: {
              code: 'WALLET_NOT_FOUND',
              message: 'Wallet was added but could not be retrieved',
            },
          });
        }
      } else {
        return res.status(500).json({
          success: false,
          error: {
            code: 'ACCOUNTS_FETCH_FAILED',
            message: 'Failed to fetch updated entity accounts',
          },
        });
      }
    }

    // Generate a transaction ID
    const transactionId = uuidv4();

    // Define simulate transfer parameters with correct property names
    const simulateParams: SimulateTransferParams = {
      transactionId,
      fromEntityId: organization.ramping_entity_id,
      fromAccountId: bankAccount.accountId,
      toEntityId: organization.ramping_entity_id,
      toAccountId: walletAccount.accountId,
      exactAmountIn: parseFloat(amount),
    };

    // Call Zynk to simulate the transfer
    const simulationResult = await zynkService.simulateTransfer(simulateParams);

    if (!simulationResult || !simulationResult.data || !simulationResult.data.executionId) {
      console.error('Failed to simulate transfer:', simulationResult);
      return res.status(500).json({
        success: false,
        error: {
          code: 'SIMULATION_FAILED',
          message: 'Failed to simulate transfer with Zynk',
          details: simulationResult?.error || 'Unknown error',
        },
      });
    }

    const { executionId, fee, netAmount, provider, estimatedArrival } = simulationResult.data;

    // Store simulation data in transactions table
    const { error: storeError } = await supabaseAdmin.from('transactions').insert({
      id: transactionId, // Use same ID for our DB and Zynk
      organization_id: organizationId,
      user_id: req.user.id,
      created_by: req.user.id,
      amount: parseFloat(amount),
      currency: token,
      fee_amount: fee ? parseFloat(fee) : 0,
      token_mint: '', // This will be populated when the transfer completes
      transaction_type: 'deposit',
      status: 'simulated',
      sender_name: 'Bank Account', // Placeholder for bank deposit
      recipient_name: 'Business Wallet',
      recipient_organization_id: organizationId,
      sender_organization_id: organizationId,
      invoices: {}, // Empty JSON object for invoices
      proof_data: {}, // Empty JSON object for proof data
      metadata: {
        execution_id: executionId,
        simulation_data: simulationResult.data,
        provider_details: provider || {},
        payment_method_id: paymentMethodId,
        destination_address: destinationAddress,
        from_account_id: bankAccount.accountId,
        to_account_id: walletAccount.accountId,
      },
    });

    if (storeError) {
      console.error('Error storing transaction data:', storeError);
      // Continue anyway since we have the execution ID
    }

    return res.status(200).json({
      success: true,
      data: {
        executionId,
        amount: amount.toString(),
        fee: fee || '0',
        netAmount: netAmount || amount.toString(),
        token,
        providerName: provider?.name || 'Zynk',
        estimatedArrival: estimatedArrival || 'Instant',
      },
    });
  } catch (error) {
    console.error('Error simulating transfer:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit((req, res) => withAuthMiddleware(handler)(req, res), 'standard');
