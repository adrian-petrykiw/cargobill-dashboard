// pages/api/footprint/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { supabaseAdmin } from '../_config/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify the webhook signature
    const signature = req.headers['x-footprint-signature'] as string;
    const webhookSecret = process.env.FOOTPRINT_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      console.error('Missing signature header or webhook secret');
      return res.status(400).json({ error: 'Missing signature header or webhook secret' });
    }

    // Get the raw body
    const rawBody = JSON.stringify(req.body);

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook event
    const event = req.body;
    console.log('Received Footprint webhook event:', event.type);

    switch (event.type) {
      case 'footprint.onboarding.completed': {
        // Check if this is a business verification
        if (event.data.business) {
          const businessId = event.data.business.fp_id;
          const status = event.data.business.status; // 'pass', 'fail', 'pending', 'none'
          const requiresManualReview = event.data.business.requires_manual_review;

          console.log(`Business onboarding completed: ${businessId}, status: ${status}`);

          // Find organization by footprint_business_id
          const { data: organizations, error: findError } = await supabaseAdmin
            .from('organizations')
            .select('id, name')
            .eq('footprint_business_id', businessId);

          if (findError || !organizations || organizations.length === 0) {
            // Try finding by external_id if provided in onboarding session
            const businessExternalId = event.data.business.external_id;

            if (businessExternalId) {
              const { data: orgsByExternalId, error: externalIdError } = await supabaseAdmin
                .from('organizations')
                .select('id, name')
                .eq('id', businessExternalId);

              if (externalIdError || !orgsByExternalId || orgsByExternalId.length === 0) {
                console.error(
                  'Organization not found for business verification:',
                  businessId,
                  businessExternalId,
                );
                return res
                  .status(200)
                  .json({ received: true, processed: false, reason: 'Organization not found' });
              }

              // Found by external ID
              const org = orgsByExternalId[0];

              // Update organization verification status
              const verificationStatus =
                status === 'pass' ? 'verified' : status === 'fail' ? 'failed' : 'pending';

              const { error: updateError } = await supabaseAdmin
                .from('organizations')
                .update({
                  footprint_business_id: businessId,
                  verification_status: verificationStatus,
                  requires_manual_review: requiresManualReview,
                  last_verified_at: new Date().toISOString(),
                  verification_provider: 'footprint',
                })
                .eq('id', org.id);

              if (updateError) {
                console.error('Error updating organization verification status:', updateError);
                return res.status(500).json({ error: 'Failed to update organization' });
              }

              console.log(
                `Updated organization ${org.name} (${org.id}) verification status to ${verificationStatus}`,
              );
            }
          } else {
            // Found by footprint_business_id
            const org = organizations[0];

            // Update organization verification status
            const verificationStatus =
              status === 'pass' ? 'verified' : status === 'fail' ? 'failed' : 'pending';

            const { error: updateError } = await supabaseAdmin
              .from('organizations')
              .update({
                verification_status: verificationStatus,
                requires_manual_review: requiresManualReview,
                last_verified_at: new Date().toISOString(),
                verification_provider: 'footprint',
              })
              .eq('id', org.id);

            if (updateError) {
              console.error('Error updating organization verification status:', updateError);
              return res.status(500).json({ error: 'Failed to update organization' });
            }

            console.log(
              `Updated organization ${org.name} (${org.id}) verification status to ${verificationStatus}`,
            );
          }
        }
        break;
      }

      case 'footprint.user.manual_review': {
        // Handle manual review events
        const userId = event.data.fp_id;
        const manualStatus = event.data.status; // 'pass', 'fail'

        console.log(`User manual review completed: ${userId}, status: ${manualStatus}`);

        // Find organizations associated with this user's Footprint ID
        // First try looking for organizations where the user is the primary owner
        const { data: organizations, error: findError } = await supabaseAdmin
          .from('organizations')
          .select('id, name')
          .eq('owner_footprint_id', userId);

        if (!findError && organizations && organizations.length > 0) {
          const org = organizations[0];
          const verificationStatus = manualStatus === 'pass' ? 'verified' : 'failed';

          const { error: updateError } = await supabaseAdmin
            .from('organizations')
            .update({
              verification_status: verificationStatus,
              requires_manual_review: false,
              last_verified_at: new Date().toISOString(),
              verification_provider: 'footprint',
            })
            .eq('id', org.id);

          if (updateError) {
            console.error('Error updating organization after manual review:', updateError);
            return res.status(500).json({ error: 'Failed to update organization' });
          }

          console.log(
            `Updated organization ${org.name} (${org.id}) after manual review to ${verificationStatus}`,
          );
        }
        break;
      }

      case 'footprint.watchlist_check.completed': {
        // Handle watchlist check events
        const userId = event.data.fp_id;
        const watchlistResult = event.data.result; // 'found', 'not_found', 'inconclusive'

        console.log(`Watchlist check completed for user: ${userId}, result: ${watchlistResult}`);

        // Only proceed if the result is found or inconclusive
        if (watchlistResult === 'found' || watchlistResult === 'inconclusive') {
          // Find organizations associated with this user's Footprint ID
          const { data: organizations, error: findError } = await supabaseAdmin
            .from('organizations')
            .select('id, name')
            .eq('owner_footprint_id', userId);

          if (!findError && organizations && organizations.length > 0) {
            const org = organizations[0];

            // Set verification status to pending for further review
            const { error: updateError } = await supabaseAdmin
              .from('organizations')
              .update({
                verification_status: 'pending',
                requires_manual_review: true,
              })
              .eq('id', org.id);

            if (updateError) {
              console.error('Error updating organization after watchlist check:', updateError);
              return res.status(500).json({ error: 'Failed to update organization' });
            }

            console.log(
              `Updated organization ${org.name} (${org.id}) to pending status due to watchlist match/inconclusive result`,
            );
          }
        }
        break;
      }

      // Add other event types as needed
      default:
        console.log(`Unhandled Footprint event type: ${event.type}`);
    }

    return res.status(200).json({ received: true, processed: true });
  } catch (error) {
    console.error('Error processing Footprint webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
