import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'body.password',
      'body.currentPassword',
      'body.newPassword',
      'body.secret',
      'body.token',
      'body.refreshToken',
      'body.apiKey',
      'body.apiSecret',
      'req.headers.authorization',
      'headers.authorization',
    ],
    censor: '[REDACTED]',
  },
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    env: process.env.NODE_ENV,
  },
});
