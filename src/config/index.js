import { z } from 'zod';

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'staging', 'production']).default('development'),
  port: z.coerce.number().default(4000),

  // Database
  databaseUrl: z.string().url(),

  // Redis
  redisUrl: z.string().url().optional(),

  // Auth
  jwtSecret: z.string().min(32),
  jwtAccessExpiry: z.string().default('1y'), // 1 year for testing/crawling
  jwtRefreshExpiry: z.string().default('1y'), // 1 year for testing/crawling

  // System Email (SMTP)
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().default(465),
  smtpSecure: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  systemEmailFrom: z.string().email().optional(),
  systemEmailReplyTo: z.string().email().optional(),

  // AWS
  awsRegion: z.string().default('us-east-1'),
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),
  s3BucketName: z.string().optional(),
  sqsQueueUrl: z.string().optional(),

  // CORS
  corsOrigins: z.string().transform((val) => val.split(',').map((s) => s.trim())),

  // Messaging Providers
  msg91AuthKey: z.string().optional(),
  msg91SenderId: z.string().optional(),

  // Rate Limiting
  rateLimitWindowMs: z.coerce.number().default(60000),
  rateLimitMax: z.coerce.number().default(1000), // Increased for development
});

function loadConfig() {
  const result = configSchema.safeParse({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY,
    jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpSecure: process.env.SMTP_SECURE,
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    systemEmailFrom: process.env.SYSTEM_EMAIL_FROM,
    systemEmailReplyTo: process.env.SYSTEM_EMAIL_REPLY_TO,
    awsRegion: process.env.AWS_REGION,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3BucketName: process.env.S3_BUCKET_NAME,
    sqsQueueUrl: process.env.SQS_QUEUE_URL,
    corsOrigins: process.env.CORS_ORIGINS || 'http://localhost:3000',
    msg91AuthKey: process.env.MSG91_AUTH_KEY,
    msg91SenderId: process.env.MSG91_SENDER_ID,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: process.env.RATE_LIMIT_MAX,
  });

  if (!result.success) {
    console.error('Invalid configuration:', result.error.format());
    throw new Error('Invalid configuration');
  }

  return result.data;
}

export const config = loadConfig();
