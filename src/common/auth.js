import * as jose from 'jose';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';

const secret = new TextEncoder().encode(config.jwtSecret);

export async function generateAccessToken(payload, expiresIn = null) {
  const jwt = new jose.SignJWT({ type: 'access', ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn || config.jwtAccessExpiry);
  return jwt.sign(secret);
}

export async function generateRefreshToken(payload) {
  return new jose.SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.jwtRefreshExpiry)
    .sign(secret);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateApiKey() {
  const prefix = 'crm360_';
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Buffer.from(randomBytes).toString('base64url');
  return `${prefix}${key}`;
}
