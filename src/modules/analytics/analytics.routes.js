const express = require('express');
const { ipLookupService } = require('../../services/ip-lookup.service');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

/**
 * @route GET /api/v1/analytics/ip-lookup
 * @desc Look up IP address details (company, location, ASN)
 * @access Private
 */
router.get('/ip-lookup', authenticate, async (req, res) => {
  try {
    const { ip } = req.query;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'IP address is required' },
      });
    }

    // Validate IP format
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$/;

    if (!ipRegex.test(ip) && !ipv6Regex.test(ip)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid IP address format' },
      });
    }

    const result = await ipLookupService.lookup(ip);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('IP lookup error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'LOOKUP_FAILED', message: error.message },
    });
  }
});

/**
 * @route GET /api/v1/analytics/ip-lookup/identify
 * @desc Identify company from visitor IP address
 * @access Private
 */
router.get('/ip-lookup/identify', authenticate, async (req, res) => {
  try {
    const { ip } = req.query;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'IP address is required' },
      });
    }

    const result = await ipLookupService.identifyCompany(ip);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Company identification error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'IDENTIFICATION_FAILED', message: error.message },
    });
  }
});

/**
 * @route POST /api/v1/analytics/ip-lookup/batch
 * @desc Batch lookup multiple IP addresses
 * @access Private
 */
router.post('/ip-lookup/batch', authenticate, async (req, res) => {
  try {
    const { ips } = req.body;

    if (!ips || !Array.isArray(ips) || ips.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Array of IP addresses is required' },
      });
    }

    if (ips.length > 100) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Maximum 100 IPs per batch' },
      });
    }

    const results = await ipLookupService.batchLookup(ips);

    return res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Batch lookup error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'BATCH_LOOKUP_FAILED', message: error.message },
    });
  }
});

/**
 * @route GET /api/v1/analytics/visitor-info
 * @desc Get current visitor's IP info (auto-detects IP from request)
 * @access Private
 */
router.get('/visitor-info', authenticate, async (req, res) => {
  try {
    // Get IP from request (handle proxies)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               req.socket?.remoteAddress ||
               req.ip;

    // Skip localhost/private IPs
    const privateIpRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|::1|localhost)/;
    if (privateIpRegex.test(ip)) {
      return res.json({
        success: true,
        data: {
          ip,
          isPrivate: true,
          message: 'Private/localhost IP detected',
        },
      });
    }

    const result = await ipLookupService.lookup(ip);

    return res.json({
      success: true,
      data: {
        ...result,
        detectedFrom: 'request',
      },
    });
  } catch (error) {
    console.error('Visitor info error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'VISITOR_INFO_FAILED', message: error.message },
    });
  }
});

module.exports = router;
