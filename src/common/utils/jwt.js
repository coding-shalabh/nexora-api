/**
 * JWT Utilities
 * Re-exports from auth.js for backward compatibility
 */

import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken as verifyJwtToken
} from '../auth.js'

// Alias for generateAccessToken
export const generateToken = generateAccessToken

// Re-export verifyToken
export const verifyToken = verifyJwtToken

// Re-export others
export { generateAccessToken, generateRefreshToken }
