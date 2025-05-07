// pages/api/compliance/checkWalletAddress.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '../api/_services/privyService';
import circleComplianceService from '../api/_services/circleComplianceService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authToken = req.headers.authorization?.replace(/^Bearer /, '');
  if (!authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const claims = await verifyToken(authToken);
    const userId = claims.userId;

    const { walletAddress, chain = 'SOL' } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    const screeningResult = await circleComplianceService.screenWalletAddress(walletAddress, chain);

    // await supabaseAdmin.from('compliance_wallet_screenings').insert({
    //   user_id: userId,
    //   wallet_address: walletAddress,
    //   chain,
    //   result: screeningResult.result,
    //   decision: screeningResult.decision,
    //   timestamp: new Date(),
    // });

    return res.status(200).json({
      walletAddress,
      chain,
      screeningResult,
      isAllowed: screeningResult.result !== 'DENIED',
      requiresReview: screeningResult.result === 'REVIEW',
    });
  } catch (error: any) {
    console.error('Wallet screening error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
