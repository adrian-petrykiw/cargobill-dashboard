// pages/api/offramp/execute.ts
import type { NextApiResponse } from 'next';
import { AuthenticatedRequest } from '@/types/api/requests';
import { ApiError } from '@/types/api/errors';
import { supabaseAdmin } from '../../_config/supabase';
import zynkService from '../../_services/zynkService';
import { withRateLimit } from '../../_middleware/rateLimiter';
import { withAuthMiddleware } from '../../_middleware/withAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiError.methodNotAllowed(req.method || 'unknown'));
  }

  try {
    const { organizationId, simulationId } = req.body;

    if (!organizationId || !simulationId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Organization ID and simulation ID are required',
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

    // Get the simulation data from transactions table
    const { data: txData, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('metadata->execution_id', simulationId)
      .eq('status', 'simulated')
      .eq('transaction_type', 'withdrawal') // Make sure we're dealing with a withdrawal
      .single();

    if (txError || !txData) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SIMULATION_NOT_FOUND',
          message: 'Withdrawal simulation data not found',
        },
      });
    }

    // Execute the transfer using the stored execution ID
    const transferParams = {
      executionId: simulationId,
      transferAcknowledgement: 'I acknowledge this transfer',
      counterPartyRiskAcknowledged: false,
    };

    const executeResult = await zynkService.executeTransfer(transferParams);

    if (!executeResult || !executeResult.success) {
      console.error('Failed to execute withdrawal:', executeResult);
      return res.status(500).json({
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: 'Failed to execute withdrawal with Zynk',
          details: executeResult?.error || 'Unknown error',
        },
      });
    }

    // Safely handle metadata merging to avoid the spread type error
    const currentMetadata = txData.metadata || {};
    let updatedMetadata;

    if (typeof currentMetadata === 'object' && currentMetadata !== null) {
      updatedMetadata = {
        ...currentMetadata,
        execution_data: executeResult.data,
      };
    } else {
      updatedMetadata = {
        execution_data: executeResult.data,
      };
    }

    // Update the transaction status in our database
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({
        status: 'processing', // Change to processing since the transfer is initiated but not settled
        executed_at: new Date().toISOString(),
        metadata: updatedMetadata,
      })
      .eq('id', txData.id);

    if (updateError) {
      console.error('Error updating transaction status:', updateError);
      // Continue anyway since the transfer was executed
    }

    return res.status(200).json({
      success: true,
      data: {
        message: 'Withdrawal executed successfully',
        transactionId: txData.id,
        amount: txData.amount,
        currency: txData.currency,
        status: 'processing',
      },
    });
  } catch (error) {
    console.error('Error executing withdrawal:', error);
    return res.status(500).json(ApiError.internalServerError(error));
  }
}

export default withRateLimit((req, res) => withAuthMiddleware(handler)(req, res), 'standard');
