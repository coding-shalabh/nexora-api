/**
 * Fast2SMS Service
 * SMS messaging service for India using Fast2SMS API
 * Supports Quick SMS, OTP, and DLT template-based messaging
 */

import { prisma } from '@crm360/database';
import { logger } from '../common/logger.js';

const FAST2SMS_BASE_URL = 'https://www.fast2sms.com/dev/bulkV2';
const FAST2SMS_OTP_URL = 'https://www.fast2sms.com/dev/otp';
const FAST2SMS_BALANCE_URL = 'https://www.fast2sms.com/dev/wallet';

// Default API key from environment or provided key
const DEFAULT_API_KEY =
  process.env.FAST2SMS_API_KEY ||
  'PcEKxgjQsToMJ632wnW5DOuGdqHIV1980CatBRkLZeXl7YSFAUeklzDAyLxMu8V4WgHFGpm5OJvrC9Ss';

/**
 * Send Quick SMS (promotional/transactional)
 * Route: 'q' for quick, 'dlt' for DLT registered
 */
export async function sendQuickSMS(options) {
  const {
    phone,
    message,
    senderId = 'FSTSMS',
    route = 'q', // 'q' for quick, 'dlt' for DLT
    language = 'english',
    flash = 0,
    apiKey = DEFAULT_API_KEY,
  } = options;

  try {
    // Format phone number (remove country code if present)
    const formattedPhone = formatPhoneNumber(phone);

    const params = new URLSearchParams({
      authorization: apiKey,
      route,
      message,
      language,
      flash: flash.toString(),
      numbers: formattedPhone,
    });

    // Add sender ID for DLT route
    if (route === 'dlt') {
      params.append('sender_id', senderId);
    }

    const response = await fetch(`${FAST2SMS_BASE_URL}?${params.toString()}`, {
      method: 'GET',
    });

    const data = await response.json();

    if (data.return === true) {
      logger.info('SMS sent successfully via Fast2SMS', {
        requestId: data.request_id,
        phone: formattedPhone,
      });

      return {
        success: true,
        requestId: data.request_id,
        message: data.message,
        credits: data.wallet,
      };
    } else {
      logger.error('Fast2SMS send failed', {
        error: data.message,
        statusCode: data.status_code,
      });

      return {
        success: false,
        error: data.message || 'Failed to send SMS',
        statusCode: data.status_code,
      };
    }
  } catch (error) {
    logger.error('Fast2SMS API error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send OTP via Fast2SMS
 * Uses dedicated OTP route with auto-generated OTP
 */
export async function sendOTP(options) {
  const {
    phone,
    otp, // If not provided, Fast2SMS generates one
    expiry = 5, // minutes
    apiKey = DEFAULT_API_KEY,
  } = options;

  try {
    const formattedPhone = formatPhoneNumber(phone);

    const params = new URLSearchParams({
      authorization: apiKey,
      variables_values: otp || Math.floor(100000 + Math.random() * 900000).toString(),
      route: 'otp',
      numbers: formattedPhone,
    });

    const response = await fetch(`${FAST2SMS_BASE_URL}?${params.toString()}`, {
      method: 'GET',
    });

    const data = await response.json();

    if (data.return === true) {
      logger.info('OTP sent successfully via Fast2SMS', {
        requestId: data.request_id,
        phone: formattedPhone,
      });

      return {
        success: true,
        requestId: data.request_id,
        otp: otp || data.otp,
        message: data.message,
      };
    } else {
      logger.error('Fast2SMS OTP send failed', {
        error: data.message,
      });

      return {
        success: false,
        error: data.message || 'Failed to send OTP',
      };
    }
  } catch (error) {
    logger.error('Fast2SMS OTP API error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send DLT registered template SMS
 * Required for commercial SMS in India
 */
export async function sendDLTTemplateSMS(options) {
  const { phone, templateId, variables = [], senderId, apiKey = DEFAULT_API_KEY } = options;

  try {
    const formattedPhone = formatPhoneNumber(phone);

    const params = new URLSearchParams({
      authorization: apiKey,
      route: 'dlt',
      sender_id: senderId,
      message: templateId, // DLT Template ID
      variables_values: variables.join('|'),
      numbers: formattedPhone,
    });

    const response = await fetch(`${FAST2SMS_BASE_URL}?${params.toString()}`, {
      method: 'GET',
    });

    const data = await response.json();

    if (data.return === true) {
      logger.info('DLT SMS sent successfully via Fast2SMS', {
        requestId: data.request_id,
        phone: formattedPhone,
        templateId,
      });

      return {
        success: true,
        requestId: data.request_id,
        message: data.message,
      };
    } else {
      logger.error('Fast2SMS DLT send failed', {
        error: data.message,
      });

      return {
        success: false,
        error: data.message || 'Failed to send DLT SMS',
      };
    }
  } catch (error) {
    logger.error('Fast2SMS DLT API error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send bulk SMS to multiple recipients
 */
export async function sendBulkSMS(options) {
  const {
    phones, // Array of phone numbers
    message,
    senderId = 'FSTSMS',
    route = 'q',
    apiKey = DEFAULT_API_KEY,
  } = options;

  try {
    // Format and join phone numbers
    const formattedPhones = phones.map(formatPhoneNumber).join(',');

    const params = new URLSearchParams({
      authorization: apiKey,
      route,
      message,
      numbers: formattedPhones,
    });

    if (route === 'dlt') {
      params.append('sender_id', senderId);
    }

    const response = await fetch(`${FAST2SMS_BASE_URL}?${params.toString()}`, {
      method: 'GET',
    });

    const data = await response.json();

    if (data.return === true) {
      logger.info('Bulk SMS sent successfully via Fast2SMS', {
        requestId: data.request_id,
        recipientCount: phones.length,
      });

      return {
        success: true,
        requestId: data.request_id,
        message: data.message,
        recipientCount: phones.length,
      };
    } else {
      return {
        success: false,
        error: data.message || 'Failed to send bulk SMS',
      };
    }
  } catch (error) {
    logger.error('Fast2SMS bulk API error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get wallet balance
 */
export async function getBalance(apiKey = DEFAULT_API_KEY) {
  try {
    // Fast2SMS wallet endpoint requires POST method with authorization header
    const response = await fetch(FAST2SMS_BALANCE_URL, {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.return === true) {
      return {
        success: true,
        balance: data.wallet,
        currency: 'INR',
      };
    } else {
      return {
        success: false,
        error: data.message || 'Failed to fetch balance',
      };
    }
  } catch (error) {
    logger.error('Fast2SMS balance API error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Test API connection
 */
export async function testConnection(apiKey = DEFAULT_API_KEY) {
  try {
    const balanceResult = await getBalance(apiKey);

    if (balanceResult.success) {
      return {
        success: true,
        message: 'Fast2SMS connection successful',
        balance: balanceResult.balance,
      };
    } else {
      return {
        success: false,
        error: balanceResult.error || 'Connection test failed',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get SMS delivery status
 */
export async function getDeliveryStatus(requestId, apiKey = DEFAULT_API_KEY) {
  try {
    const response = await fetch(`https://www.fast2sms.com/dev/delivery?request_id=${requestId}`, {
      method: 'GET',
      headers: {
        authorization: apiKey,
      },
    });

    const data = await response.json();

    if (data.return === true) {
      return {
        success: true,
        status: data.data,
      };
    } else {
      return {
        success: false,
        error: data.message || 'Failed to fetch delivery status',
      };
    }
  } catch (error) {
    logger.error('Fast2SMS delivery status error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Store SMS record in database
 */
export async function recordSMS(tenantId, data) {
  try {
    // Check if SMS model exists, create in Activity log otherwise
    const record = await prisma.activity.create({
      data: {
        tenantId,
        type: 'SMS',
        subject: `SMS to ${data.phone}`,
        description: data.message?.substring(0, 200),
        metadata: {
          requestId: data.requestId,
          phone: data.phone,
          route: data.route,
          status: data.status,
          provider: 'fast2sms',
        },
      },
    });

    return record;
  } catch (error) {
    logger.error('Failed to record SMS', { error: error.message });
    return null;
  }
}

// Helper Functions

/**
 * Format phone number for Fast2SMS (Indian format, 10 digits)
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';

  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');

  // Remove country code if present
  if (cleaned.startsWith('91') && cleaned.length > 10) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Return last 10 digits
  return cleaned.slice(-10);
}

/**
 * Validate Indian phone number
 */
export function validatePhoneNumber(phone) {
  const formatted = formatPhoneNumber(phone);
  // Indian mobile numbers start with 6-9 and are 10 digits
  return /^[6-9]\d{9}$/.test(formatted);
}

export const fast2smsService = {
  sendQuickSMS,
  sendOTP,
  sendDLTTemplateSMS,
  sendBulkSMS,
  getBalance,
  testConnection,
  getDeliveryStatus,
  recordSMS,
  validatePhoneNumber,
};

export default fast2smsService;
