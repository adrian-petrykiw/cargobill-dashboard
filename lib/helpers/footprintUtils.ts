// lib/helpers/footprintUtils.ts
import crypto from 'crypto';

export function verifyFootprintWebhookSignature(
  signature: string,
  payload: string,
  secret: string,
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}
