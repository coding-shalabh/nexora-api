/**
 * Feature Access Service
 * Handles plan-based feature access control
 */

import { prisma } from '@crm360/database';

class FeatureAccessService {
  /**
   * Get tenant's current subscription with plan details
   */
  async getSubscription(tenantId) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return subscription;
  }

  /**
   * Get tenant's plan features
   */
  async getPlanFeatures(tenantId) {
    const subscription = await this.getSubscription(tenantId);

    if (!subscription) {
      // Return default/free tier features
      return {
        planName: 'free',
        modules: [],
        features: {},
        limits: {
          maxUsers: 1,
          maxContacts: 100,
          maxCompanies: 10,
          maxDeals: 10,
        },
        subscription: null,
      };
    }

    const plan = subscription.plan;

    return {
      planId: plan.id,
      planName: plan.name,
      displayName: plan.displayName,
      modules: plan.modules || [],
      features: plan.features || {},
      limits: {
        maxUsers: plan.maxUsers,
        maxContacts: plan.maxContacts,
        maxCompanies: plan.maxCompanies,
        maxDeals: plan.maxDeals,
        maxPipelines: plan.maxPipelines,
        maxAutomations: plan.maxAutomations,
        maxEmailsPerDay: plan.maxEmailsPerDay,
        maxSmsPerDay: plan.maxSmsPerDay,
        maxWhatsAppPerDay: plan.maxWhatsAppPerDay,
        storageGb: plan.storageGb,
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        trialEndsAt: subscription.trialEndsAt,
        seats: subscription.seats,
      },
    };
  }

  /**
   * Check if tenant has access to a specific module
   */
  async hasModuleAccess(tenantId, moduleName) {
    const features = await this.getPlanFeatures(tenantId);
    const modules = (features.modules || []).map(m => m.toUpperCase());
    return modules.includes(moduleName.toUpperCase());
  }

  /**
   * Check if tenant has access to a specific feature
   */
  async hasFeatureAccess(tenantId, featureName) {
    const features = await this.getPlanFeatures(tenantId);
    return features.features?.[featureName] === true;
  }

  /**
   * Check usage limits for a tenant
   */
  async checkLimit(tenantId, limitType) {
    const features = await this.getPlanFeatures(tenantId);
    const limit = features.limits[limitType];

    if (limit === null || limit === undefined) {
      // Unlimited
      return { allowed: true, limit: null, current: null };
    }

    let current = 0;

    switch (limitType) {
      case 'maxUsers':
        current = await prisma.user.count({ where: { tenantId, status: 'ACTIVE' } });
        break;
      case 'maxContacts':
        current = await prisma.contact.count({ where: { tenantId } });
        break;
      case 'maxCompanies':
        current = await prisma.company.count({ where: { tenantId } });
        break;
      case 'maxDeals':
        current = await prisma.deal.count({ where: { tenantId } });
        break;
      case 'maxPipelines':
        current = await prisma.pipeline.count({ where: { tenantId } });
        break;
      case 'maxAutomations':
        current = await prisma.automation.count({ where: { tenantId, isActive: true } });
        break;
      default:
        return { allowed: true, limit, current: 0 };
    }

    return {
      allowed: current < limit,
      limit,
      current,
      remaining: Math.max(0, limit - current),
    };
  }

  /**
   * Get full access control info for a tenant
   */
  async getAccessControl(tenantId) {
    const features = await this.getPlanFeatures(tenantId);

    // Get current usage counts
    const [userCount, contactCount, companyCount, dealCount] = await Promise.all([
      prisma.user.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.contact.count({ where: { tenantId } }),
      prisma.company.count({ where: { tenantId } }),
      prisma.deal.count({ where: { tenantId } }),
    ]);

    return {
      plan: {
        id: features.planId,
        name: features.planName,
        displayName: features.displayName,
      },
      subscription: features.subscription,
      modules: features.modules,
      features: features.features,
      limits: features.limits,
      usage: {
        users: userCount,
        contacts: contactCount,
        companies: companyCount,
        deals: dealCount,
      },
    };
  }
}

export const featureAccessService = new FeatureAccessService();
