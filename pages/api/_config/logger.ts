// pages/api/_config/logger.ts
import pino from 'pino';
import path from 'path';
import fs from 'fs';

// For your case, this check is sufficient since you only deploy to Vercel in production
const isServerlessProduction = process.env.NODE_ENV === 'production';

// In development, use local logs directory; in production (Vercel), use /tmp
const logDir = isServerlessProduction ? '/tmp/logs' : path.join(process.cwd(), 'logs');

// Create log directory in development
if (!isServerlessProduction && !fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (error) {
    console.warn(`Unable to create log directory: ${error}`);
  }
}

// Logger options
const baseLoggerOptions = {
  level: process.env.LOG_LEVEL || (isServerlessProduction ? 'info' : 'debug'),
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'cargobill-api',
    env: process.env.NODE_ENV || 'development',
  },
  redact: [
    'password',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'cookie',
    '*.password',
    '*.token',
    '*.key',
    '*.secret',
  ],
  formatters: {
    level: (label: any) => ({ level: label }),
  },
};

// Create logger with appropriate transport
const logger = pino({
  ...baseLoggerOptions,
  transport: isServerlessProduction
    ? {
        // Production (Vercel): Use stdout only
        target: 'pino/file',
        options: { destination: 1 },
      }
    : {
        // Development: Pretty printing to console
        target: 'pino-pretty',
        options: { colorize: true },
      },
});

// Request context logger creator
export function createRequestLogger(req: any, extraContext: Record<string, any> = {}) {
  const crypto = require('crypto');
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  return logger.child({
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    userId: (req as any).user?.id,
    ...extraContext,
  });
}

export default logger;
