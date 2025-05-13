// pages/api/_config/logger.ts
import pino from 'pino';
import path from 'path';
import fs from 'fs';

// Determine if we're in a serverless environment (Vercel)
const isServerless = process.env.VERCEL === '1';

// Use /tmp directory in serverless environments, otherwise use process.cwd()
const logDir = isServerless ? '/tmp/logs' : path.join(process.cwd(), 'logs');

// Only try to create directory if we're not in a serverless environment or using /tmp
if ((!isServerless || logDir.startsWith('/tmp')) && !fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (error) {
    console.warn(`Unable to create log directory: ${error}`);
    // Continue execution even if directory creation fails
  }
}

let transport: any;
if (process.env.NODE_ENV !== 'production') {
  // Development: console output
  transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  };
} else {
  // Production: Use console logging in serverless environments
  if (isServerless) {
    transport = {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    };
  } else {
    // Production non-serverless: multiple targets
    transport = {
      targets: [
        {
          target: 'pino/file',
          options: { destination: 1 },
          level: 'info',
        },
        {
          target: 'pino/file',
          level: 'error',
          options: { destination: path.join(logDir, 'error.log') },
        },
      ],
    };
  }
}

// Log levels
const levels = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
};

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport,
  levels,
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
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'cargobill-api',
    env: process.env.NODE_ENV || 'development',
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
