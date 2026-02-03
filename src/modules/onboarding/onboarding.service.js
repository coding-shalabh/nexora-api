/**
 * Onboarding Service
 * Handles the complete onboarding flow for new tenants
 *
 * Flow:
 * 1. Initialize - Create tenant, onboarding session
 * 2. Capture Data - Company, Admin, Team, Email, CRM, etc.
 * 3. Complete - Create all records, send invites, finalize
 */

import { prisma } from '@crm360/database';
import { hashPassword } from '../../common/utils/auth.js';
import { logger } from '../../common/logger.js';
import { generateToken } from '../../common/utils/jwt.js';
import {
  DEFAULT_PIPELINE_STAGES,
  DEFAULT_TICKET_STAGES,
  DEFAULT_ROLES,
  DEFAULT_LIFECYCLE_STAGES,
} from './onboarding.schema.js';

class OnboardingService {
  constructor() {
    this.logger = logger.child({ service: 'OnboardingService' });
  }

  // ================================
  // Plans Methods (Public)
  // ================================

  /**
   * Get all available pricing plans
   */
  async getAvailablePlans() {
    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
        isPublic: true,
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        monthlyPrice: true,
        yearlyPrice: true,
        currency: true,
        maxUsers: true,
        maxContacts: true,
        maxCompanies: true,
        maxDeals: true,
        maxPipelines: true,
        maxAutomations: true,
        maxEmailsPerDay: true,
        maxSmsPerDay: true,
        maxWhatsAppPerDay: true,
        storageGb: true,
        modules: true,
        features: true,
        badge: true,
        sortOrder: true,
      },
    });

    // Format for frontend display
    return plans.map(plan => ({
      ...plan,
      monthlyPrice: Number(plan.monthlyPrice),
      yearlyPrice: Number(plan.yearlyPrice),
      yearlyMonthly: Math.round(Number(plan.yearlyPrice) / 12),
      yearlySavings: Math.round((Number(plan.monthlyPrice) * 12) - Number(plan.yearlyPrice)),
    }));
  }

  /**
   * Get single plan by ID or name
   */
  async getPlanById(planIdOrName) {
    const plan = await prisma.plan.findFirst({
      where: {
        OR: [
          { id: planIdOrName },
          { name: planIdOrName },
        ],
        isActive: true,
      },
    });

    if (!plan) return null;

    return {
      ...plan,
      monthlyPrice: Number(plan.monthlyPrice),
      yearlyPrice: Number(plan.yearlyPrice),
      yearlyMonthly: Math.round(Number(plan.yearlyPrice) / 12),
      yearlySavings: Math.round((Number(plan.monthlyPrice) * 12) - Number(plan.yearlyPrice)),
    };
  }

  /**
   * Get plan features by ID (from database)
   */
  async getPlanFeaturesFromDb(planIdOrName) {
    const plan = await prisma.plan.findFirst({
      where: {
        OR: [
          { id: planIdOrName },
          { name: planIdOrName },
        ],
      },
      select: {
        modules: true,
        features: true,
      },
    });

    if (!plan) {
      return { modules: [], features: {} };
    }

    return {
      modules: plan.modules || [],
      features: plan.features || {},
    };
  }

  // ================================
  // Onboarding Flow Methods
  // ================================

  /**
   * Initialize onboarding session after purchase
   */
  async initialize(data) {
    const { orderId, planId, billingCycle, email, firstName, lastName } = data;

    this.logger.info({ orderId, planId, email }, 'Initializing onboarding');

    // 1. Fetch plan from database
    const plan = await this.getPlanById(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // 2. Create tenant (inactive until onboarding complete)
    const tenantSlug = `tenant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tenant = await prisma.tenant.create({
      data: {
        name: `Tenant-${orderId}`, // Will be updated with company name
        slug: tenantSlug,
        status: 'ONBOARDING',
        settings: {
          planId: plan.id,
          planName: plan.name,
          billingCycle,
        },
      },
    });

    // 3. Create onboarding session
    const session = await prisma.onboardingSession.create({
      data: {
        orderId,
        planId: plan.id,
        billingCycle,
        tenantId: tenant.id,
        email: email.toLowerCase(),
        firstName,
        lastName,
        status: 'IN_PROGRESS',
        currentStep: 'company',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // 4. Generate onboarding token
    const onboardingToken = await generateToken({
      onboardingId: session.id,
      tenantId: tenant.id,
      email,
      type: 'onboarding',
    }, '24h');

    return {
      onboardingId: session.id,
      onboardingToken,
      tenantId: tenant.id,
      expiresAt: session.expiresAt,
      plan: {
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        modules: plan.modules,
        features: plan.features,
      },
    };
  }

  /**
   * Save company information
   */
  async saveCompany(onboardingId, data) {
    const session = await this.getSession(onboardingId);

    // Update session with company data
    await prisma.onboardingSession.update({
      where: { id: onboardingId },
      data: {
        companyData: data,
        currentStep: 'admin',
        updatedAt: new Date(),
      },
    });

    return { success: true, nextStep: 'admin' };
  }

  /**
   * Save admin account details
   */
  async saveAdmin(onboardingId, data) {
    const session = await this.getSession(onboardingId);

    // Hash password before storing
    const passwordHash = await hashPassword(data.password);

    // Store admin data (password hashed)
    const adminData = {
      ...data,
      password: undefined,
      passwordHash,
    };

    await prisma.onboardingSession.update({
      where: { id: onboardingId },
      data: {
        adminData,
        currentStep: 'team',
        updatedAt: new Date(),
      },
    });

    return { success: true, nextStep: 'team' };
  }

  /**
   * Save team setup (optional)
   */
  async saveTeam(onboardingId, data) {
    const session = await this.getSession(onboardingId);

    await prisma.onboardingSession.update({
      where: { id: onboardingId },
      data: {
        teamData: data,
        currentStep: 'email',
        updatedAt: new Date(),
      },
    });

    return { success: true, nextStep: 'email' };
  }

  /**
   * Save email configuration
   */
  async saveEmail(onboardingId, data) {
    const session = await this.getSession(onboardingId);

    // Encrypt SMTP password if provided
    let emailData = { ...data };
    if (data.smtp?.password) {
      // TODO: Encrypt SMTP password
      emailData.smtp = {
        ...data.smtp,
        password: data.smtp.password, // Should be encrypted
      };
    }

    await prisma.onboardingSession.update({
      where: { id: onboardingId },
      data: {
        emailData,
        currentStep: 'crm',
        updatedAt: new Date(),
      },
    });

    return { success: true, nextStep: 'crm' };
  }

  /**
   * Save CRM configuration
   */
  async saveCRM(onboardingId, data) {
    const session = await this.getSession(onboardingId);
    const planFeatures = this.getPlanFeatures(session.planId);

    await prisma.onboardingSession.update({
      where: { id: onboardingId },
      data: {
        crmData: data,
        currentStep: planFeatures.includes('ticketing') ? 'ticketing' : 'complete',
        updatedAt: new Date(),
      },
    });

    const nextStep = planFeatures.includes('ticketing') ? 'ticketing' : 'complete';
    return { success: true, nextStep };
  }

  /**
   * Save ticketing configuration
   */
  async saveTicketing(onboardingId, data) {
    const session = await this.getSession(onboardingId);
    const planFeatures = this.getPlanFeatures(session.planId);

    await prisma.onboardingSession.update({
      where: { id: onboardingId },
      data: {
        ticketingData: data,
        currentStep: planFeatures.includes('marketing') ? 'marketing' : 'complete',
        updatedAt: new Date(),
      },
    });

    const nextStep = planFeatures.includes('marketing') ? 'marketing' : 'complete';
    return { success: true, nextStep };
  }

  /**
   * Save marketing configuration
   */
  async saveMarketing(onboardingId, data) {
    const session = await this.getSession(onboardingId);

    await prisma.onboardingSession.update({
      where: { id: onboardingId },
      data: {
        marketingData: data,
        currentStep: 'complete',
        updatedAt: new Date(),
      },
    });

    return { success: true, nextStep: 'complete' };
  }

  /**
   * Complete onboarding - Create all records
   */
  async complete(onboardingId, data) {
    const session = await this.getSession(onboardingId);

    this.logger.info({ onboardingId }, 'Completing onboarding');

    // Use transaction to create everything
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update tenant with company info
      // Generate slug from company name
      const companySlug = session.companyData.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
      const uniqueSlug = `${companySlug}-${Date.now().toString(36)}`;

      const tenant = await tx.tenant.update({
        where: { id: session.tenantId },
        data: {
          name: session.companyData.companyName,
          slug: uniqueSlug,
          status: 'ACTIVE',
          settings: {
            timezone: session.adminData.timezone,
            language: session.adminData.language,
            currency: session.crmData?.defaultCurrency || 'INR',
          },
        },
      });

      // 2. Create workspace
      const workspace = await tx.workspace.create({
        data: {
          tenantId: tenant.id,
          name: 'Main Workspace',
          isDefault: true,
        },
      });

      // 3. Create company record
      const company = await tx.company.create({
        data: {
          tenantId: tenant.id,
          name: session.companyData.companyName,
          domain: session.companyData.domain,
          industry: session.companyData.industry,
          employeeCount: session.companyData.companySize,
          phone: session.companyData.phone,
          email: session.adminData.email,
          address: session.companyData.address,
          city: session.companyData.city,
          state: session.companyData.state,
          country: session.companyData.country,
          postalCode: session.companyData.postalCode,
          isGstRegistered: session.companyData.isGstRegistered,
          gstin: session.companyData.gstin,
          pan: session.companyData.pan,
          legalName: session.companyData.legalName,
          websiteUrl: session.companyData.website,
        },
      });

      // 4. Create default roles
      const roles = await this.createDefaultRoles(tx, tenant.id);

      // 5. Create admin user
      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: session.adminData.email.toLowerCase(),
          firstName: session.adminData.firstName,
          lastName: session.adminData.lastName,
          phone: session.adminData.phone,
          passwordHash: session.adminData.passwordHash,
          status: 'ACTIVE',
          emailVerified: true,
          settings: {
            timezone: session.adminData.timezone,
            language: session.adminData.language,
          },
        },
      });

      // 6. Link admin to workspace and admin role
      await tx.userWorkspace.create({
        data: {
          userId: adminUser.id,
          workspaceId: workspace.id,
        },
      });

      const adminRole = roles.find(r => r.name === 'Admin');
      if (adminRole) {
        await tx.userRole.create({
          data: {
            userId: adminUser.id,
            roleId: adminRole.id,
          },
        });
      }

      // 7. Create sales pipeline
      const pipeline = await this.createSalesPipeline(tx, tenant.id, session.crmData);

      // 8. Create ticket pipeline (if enabled)
      let ticketPipeline = null;
      if (session.ticketingData?.enableTicketing) {
        ticketPipeline = await this.createTicketPipeline(tx, tenant.id, session.ticketingData);
      }

      // 9. Create email account (if configured)
      if (session.emailData && !session.emailData.skipEmailSetup) {
        await this.createEmailAccount(tx, tenant.id, workspace.id, session.emailData);
      }

      // 10. Send team invites (if any)
      const invitesSent = await this.sendTeamInvites(tx, tenant.id, workspace.id, session.teamData);

      // 11. Create subscription
      const billingCycle = session.billingCycle || 'MONTHLY';
      const trialDays = 14; // 14-day trial for new signups
      const subscription = await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: session.planId,
          status: 'TRIALING',
          billingCycle: billingCycle.toUpperCase(),
          startDate: new Date(),
          trialEndsAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
          seats: 1,
        },
      });

      // 12. Update onboarding session as complete
      await tx.onboardingSession.update({
        where: { id: onboardingId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      return {
        tenant,
        workspace,
        company,
        adminUser,
        pipeline,
        ticketPipeline,
        invitesSent,
        subscription,
      };
    });

    this.logger.info({
      onboardingId,
      tenantId: result.tenant.id,
      userId: result.adminUser.id,
    }, 'Onboarding completed successfully');

    return {
      tenantId: result.tenant.id,
      workspaceId: result.workspace.id,
      user: {
        id: result.adminUser.id,
        email: result.adminUser.email,
      },
      loginUrl: process.env.APP_URL || 'http://localhost:3000/login',
      summary: {
        company: result.company.name,
        usersInvited: result.invitesSent,
        pipelineStages: result.pipeline.stages.length,
        ticketStages: result.ticketPipeline?.stages?.length || 0,
        emailConfigured: !!session.emailData && !session.emailData.skipEmailSetup,
      },
    };
  }

  /**
   * Get onboarding status
   */
  async getStatus(onboardingId) {
    const session = await prisma.onboardingSession.findUnique({
      where: { id: onboardingId },
    });

    if (!session) {
      throw new Error('Onboarding session not found');
    }

    const planFeatures = this.getPlanFeatures(session.planId);

    return {
      onboardingId: session.id,
      status: session.status,
      steps: {
        company: session.companyData ? 'completed' : 'pending',
        admin: session.adminData ? 'completed' : 'pending',
        team: session.teamData ? 'completed' : (session.adminData ? 'pending' : 'pending'),
        email: session.emailData ? 'completed' : 'pending',
        crm: session.crmData ? 'completed' : 'pending',
        ticketing: planFeatures.includes('ticketing')
          ? (session.ticketingData ? 'completed' : 'pending')
          : 'not_included',
        marketing: planFeatures.includes('marketing')
          ? (session.marketingData ? 'completed' : 'pending')
          : 'not_included',
      },
      currentStep: session.currentStep,
      completedAt: session.completedAt,
      expiresAt: session.expiresAt,
    };
  }

  // ================================
  // Helper Methods
  // ================================

  async getSession(onboardingId) {
    const session = await prisma.onboardingSession.findUnique({
      where: { id: onboardingId },
    });

    if (!session) {
      throw new Error('Onboarding session not found');
    }

    if (session.status === 'COMPLETED') {
      throw new Error('Onboarding already completed');
    }

    if (session.status === 'EXPIRED' || new Date() > session.expiresAt) {
      throw new Error('Onboarding session expired');
    }

    return session;
  }

  async createDefaultRoles(tx, tenantId) {
    const roles = [];

    for (const roleData of DEFAULT_ROLES) {
      const role = await tx.role.create({
        data: {
          tenantId,
          name: roleData.name,
          description: roleData.description,
          isSystem: true,
          // Note: permissions are stored in roleData.permissions but not used here
          // as they require a separate RolePermission relation table
          // Level is inferred from role name in the permission middleware
        },
      });
      roles.push(role);
    }

    return roles;
  }

  async createSalesPipeline(tx, tenantId, crmData) {
    const stages = crmData?.useDefaultPipeline
      ? DEFAULT_PIPELINE_STAGES
      : (crmData?.customStages || DEFAULT_PIPELINE_STAGES);

    const pipeline = await tx.pipeline.create({
      data: {
        tenantId,
        name: crmData?.pipelineName || 'Sales Pipeline',
        type: 'DEAL',
        isDefault: true,
      },
    });

    const createdStages = [];
    for (const stage of stages) {
      const s = await tx.stage.create({
        data: {
          tenantId,
          pipelineId: pipeline.id,
          name: stage.name,
          order: stage.order,
          probability: stage.probability,
          color: stage.color,
          isWon: stage.isWonStage || false,
          isLost: stage.isLostStage || false,
        },
      });
      createdStages.push(s);
    }

    return { ...pipeline, stages: createdStages };
  }

  async createTicketPipeline(tx, tenantId, ticketingData) {
    const stages = ticketingData?.useDefaultTicketPipeline
      ? DEFAULT_TICKET_STAGES
      : (ticketingData?.customStages || DEFAULT_TICKET_STAGES);

    const pipeline = await tx.pipeline.create({
      data: {
        tenantId,
        name: 'Ticket Pipeline',
        type: 'TICKET',
        isDefault: true,
      },
    });

    const createdStages = [];
    for (const stage of stages) {
      const s = await tx.stage.create({
        data: {
          tenantId,
          pipelineId: pipeline.id,
          name: stage.name,
          order: stage.order,
          color: stage.color,
          isWon: stage.isClosedStage || false, // For tickets, closed = won
          isLost: false,
        },
      });
      createdStages.push(s);
    }

    // Create ticket categories
    if (ticketingData?.categories) {
      for (const category of ticketingData.categories) {
        await tx.ticketCategory.create({
          data: {
            tenantId,
            name: category,
          },
        });
      }
    }

    return { ...pipeline, stages: createdStages };
  }

  async createEmailAccount(tx, tenantId, workspaceId, emailData) {
    return tx.emailAccount.create({
      data: {
        tenantId,
        workspaceId,
        email: emailData.primaryEmail,
        displayName: emailData.emailDisplayName,
        replyTo: emailData.replyToEmail,
        provider: emailData.emailProvider.toUpperCase(),
        // SMTP settings (encrypted in production)
        smtpHost: emailData.smtp?.host,
        smtpPort: emailData.smtp?.port,
        smtpUser: emailData.smtp?.user,
        smtpPassword: emailData.smtp?.password, // Should be encrypted
        smtpSecure: emailData.smtp?.secure,
        status: 'ACTIVE',
      },
    });
  }

  async sendTeamInvites(tx, tenantId, workspaceId, teamData) {
    if (!teamData?.inviteUsers?.length) {
      return 0;
    }

    let invitesSent = 0;

    for (const invite of teamData.inviteUsers) {
      // Create invite record
      await tx.userInvite.create({
        data: {
          tenantId,
          workspaceId,
          email: invite.email.toLowerCase(),
          firstName: invite.firstName,
          lastName: invite.lastName,
          role: invite.role,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      // TODO: Send invite email
      // await emailService.sendInvite(invite);

      invitesSent++;
    }

    return invitesSent;
  }

  /**
   * Get plan features (sync version for backward compatibility)
   * Maps database modules to feature list
   */
  getPlanFeatures(planId) {
    // Fallback for legacy hardcoded plans
    const legacyPlans = {
      basic: ['crm'],
      starter: ['crm', 'inbox', 'pipeline'],
      professional: ['crm', 'ticketing', 'inbox'],
      growth: ['crm', 'inbox', 'pipeline', 'automation', 'analytics'],
      enterprise: ['crm', 'ticketing', 'inbox', 'marketing', 'automation'],
    };
    return legacyPlans[planId] || legacyPlans.basic;
  }

  /**
   * Get plan name (sync version for backward compatibility)
   */
  getPlanName(planId) {
    const names = {
      basic: 'Basic',
      starter: 'Starter',
      growth: 'Growth',
      professional: 'Professional',
      enterprise: 'Enterprise',
    };
    return names[planId] || 'Basic';
  }

  /**
   * Check if plan has a specific module
   */
  async planHasModule(planIdOrName, moduleName) {
    const planFeatures = await this.getPlanFeaturesFromDb(planIdOrName);
    const modules = (planFeatures.modules || []).map(m => m.toLowerCase());
    return modules.includes(moduleName.toLowerCase());
  }

  /**
   * Check if plan has a specific feature
   */
  async planHasFeature(planIdOrName, featureName) {
    const planFeatures = await this.getPlanFeaturesFromDb(planIdOrName);
    return planFeatures.features?.[featureName] === true;
  }
}

export const onboardingService = new OnboardingService();
