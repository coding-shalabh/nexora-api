import { Router } from 'express';
import { tenantMiddleware } from '../../common/middleware/tenant.js';
import { seedIndustryData } from './seed-industry.service.js';

const router = Router();

/**
 * POST /api/v1/admin/seed-industry
 *
 * Seeds industry-specific demo data (contacts, pipeline, stages, deals)
 * for the authenticated tenant.
 *
 * Body:
 *   - industryId {string}  One of the 28 supported industry keys (e.g. 'saas', 'healthcare').
 *                          Falls back to 'other' if not provided or unrecognised.
 *   - recommendations {any} (ignored — reserved for future use from onboarding flow)
 *
 * Response on success:
 *   { success: true, data: { seeded: true, industry: '...', counts: { contacts, stages, deals, pipeline } } }
 *
 * Response when already seeded (idempotent):
 *   { success: true, data: { seeded: false, reason: 'already_seeded', existingCount: N } }
 */
router.post('/seed-industry', tenantMiddleware, async (req, res, next) => {
  try {
    const { industryId, recommendations } = req.body; // eslint-disable-line no-unused-vars

    const result = await seedIndustryData(req.tenantId, industryId || 'other');

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export { router as adminRouter };
