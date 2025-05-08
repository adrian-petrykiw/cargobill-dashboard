// pages/api/_middleware/rateLimiter.ts
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import type { NextApiRequest, NextApiResponse } from 'next';
import logger from '@/pages/api/_config/logger';
import { AuthenticatedRequest } from '@/types/api/requests';

export type RateLimitType = 'standard' | 'auth' | 'payment' | 'public';

const rateLimitConfigs: Record<RateLimitType, { limit: number; windowSeconds: number }> = {
  standard: { limit: 500, windowSeconds: 60 }, // 60 requests per minute
  auth: { limit: 200, windowSeconds: 60 }, // 10 login attempts per minute
  payment: { limit: 50, windowSeconds: 60 }, // 5 payment operations per minute
  public: { limit: 1000, windowSeconds: 60 }, // 120 requests per minute for public endpoints
};

// Mock rate limiter for development when Redis is not available
const createMockRateLimiter = (type: RateLimitType) => ({
  limit: async (identifier: string) => {
    console.log(`[DEV MODE] Mock rate limit check for ${type}: ${identifier}`);
    return {
      success: true,
      limit: rateLimitConfigs[type].limit,
      reset: Date.now() + rateLimitConfigs[type].windowSeconds * 1000,
      remaining: rateLimitConfigs[type].limit - 1,
    };
  },
});

// Initialize Redis client
// Prioritize standard Upstash environment variables, fall back to the ones provided by Vercel
const getRedisClient = () => {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }

  return null;
};

const redis = getRedisClient();
const isRedisAvailable = !!redis;

// Initialize rate limiters
const rateLimiters: Record<RateLimitType, any> = {
  standard: undefined,
  auth: undefined,
  payment: undefined,
  public: undefined,
};

if (isRedisAvailable) {
  // Production rate limiters using Upstash Redis
  rateLimiters.standard = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.standard.limit,
      `${rateLimitConfigs.standard.windowSeconds} s`,
    ),
    analytics: true,
    prefix: 'ratelimit:standard',
  });

  rateLimiters.auth = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.auth.limit,
      `${rateLimitConfigs.auth.windowSeconds} s`,
    ),
    analytics: true,
    prefix: 'ratelimit:auth',
  });

  rateLimiters.payment = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.payment.limit,
      `${rateLimitConfigs.payment.windowSeconds} s`,
    ),
    analytics: true,
    prefix: 'ratelimit:payment',
  });

  rateLimiters.public = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      rateLimitConfigs.public.limit,
      `${rateLimitConfigs.public.windowSeconds} s`,
    ),
    analytics: true,
    prefix: 'ratelimit:public',
  });
} else {
  // Development fallback using mock rate limiters
  logger.warn('[DEV MODE] Using mock rate limiters - Redis connection not available');
  rateLimiters.standard = createMockRateLimiter('standard');
  rateLimiters.auth = createMockRateLimiter('auth');
  rateLimiters.payment = createMockRateLimiter('payment');
  rateLimiters.public = createMockRateLimiter('public');
}

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

type ApiHandler<T extends NextApiRequest = NextApiRequest> = (
  req: T,
  res: NextApiResponse,
) => Promise<void>;

export function withRateLimit<T extends NextApiRequest = NextApiRequest>(
  handler: ApiHandler<T>,
  type: RateLimitType = 'standard',
) {
  return async function rateProtectedHandler(req: T, res: NextApiResponse) {
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
