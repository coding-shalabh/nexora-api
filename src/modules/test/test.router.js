/**
 * Test Utilities Router
 * API endpoints for testing and debugging
 */

import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import mockAccountsRouter from './mock-accounts.router.js';

const router = Router();

// Mount mock accounts router
router.use('/mock-accounts', mockAccountsRouter);

/**
 * Get test utilities status
 * GET /api/v1/test
 */
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        available: true,
        message: 'Test utilities API is available',
        endpoints: {
          msg91: '/msg91',
          health: '/health',
          mockAccounts: '/mock-accounts',
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
});

/**
 * Health check endpoint
 * GET /api/v1/test/health
 */
router.get('/health', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
});

export default router;
