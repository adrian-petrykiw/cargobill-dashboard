// lib/middleware/rateLimiter.ts
import { kv } from '@vercel/kv';
import { Ratelimit } from '@upstash/ratelimit';
import type { NextApiRequest, NextApiResponse } from 'next';
import logger from '@/pages/api/_config/logger';

export type RateLimitType = 'standard' | 'auth' | 'payment' | 'public';

const rateLimitConfigs: Record<RateLimitType, { limit: number; windowSeconds: number }> = {
  standard: { limit: 60, windowSeconds: 60 }, // 60 requests per minute
  auth: { limit: 10, windowSeconds: 60 }, // 10 login attempts per minute
  payment: { limit: 5, windowSeconds: 60 }, // 5 payment operations per minute
  public: { limit: 120, windowSeconds: 60 }, // 120 requests per minute for public endpoints
};

// Initialize with Vercel KV
const rateLimiters: Record<RateLimitType, Ratelimit> = {
  standard: new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.standard.limit,
      `${rateLimitConfigs.standard.windowSeconds} s`,
    ),
    analytics: true,
    prefix: 'ratelimit:standard',
  }),
  auth: new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.auth.limit,
      `${rateLimitConfigs.auth.windowSeconds} s`,
    ),
    analytics: true,
    prefix: 'ratelimit:auth',
  }),
  payment: new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.payment.limit,
      `${rateLimitConfigs.payment.windowSeconds} s`,
    ),
    analytics: true,
    prefix: 'ratelimit:payment',
  }),
  public: new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.public.limit,
      `${rateLimitConfigs.public.windowSeconds} s`,
    ),
    analytics: true,
    prefix: 'ratelimit:public',
  }),
};

function getIdentifier(req: NextApiRequest): string {
  // For authenticated routes, use user ID if available
  const userId = (req as any).user?.id;

  const ip =
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress ||
    'unknown';

  // If user authenticated, rate limit by user ID
  if (userId) {
    return `user_${userId}`;
  }

  // Else rate limit by IP
  return `ip_${Array.isArray(ip) ? ip[0] : ip}`;
}

export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  type: RateLimitType = 'standard',
) {
  return async function rateProtectedHandler(req: NextApiRequest, res: NextApiResponse) {
    const identifier = getIdentifier(req);
    const rateLimiter = rateLimiters[type];

    try {
      const { success, limit, reset, remaining } = await rateLimiter.limit(identifier);

      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', reset.toString());

      if (!success) {
        logger.warn({
          message: 'Rate limit exceeded',
          type,
          ip: getIdentifier(req),
          userId: (req as any).user?.id,
          path: req.url,
          method: req.method,
        });

        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later.',
            retryAfter: Math.ceil((reset - Date.now()) / 1000),
          },
        });
      }

      return handler(req, res);
    } catch (error) {
      logger.error({
        message: 'Rate limiting error',
        error: error instanceof Error ? error.message : String(error),
        path: req.url,
      });

      // Fail open to prevent blocking legitimate traffic if rate limiter fails
      return handler(req, res);
    }
  };
}
