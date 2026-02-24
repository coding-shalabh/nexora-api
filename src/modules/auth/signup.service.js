import { prisma } from '@crm360/database';
import bcrypt from 'bcrypt';
import { generateToken } from '../../common/utils/jwt.js';
import { logger } from '../../common/logger.js';
import { SESService } from '../../services/aws-ses.service.js';
import { config } from '../../config/index.js';

/**
 * Complete tenant onboarding - creates everything needed for a new organization
 */
export class SignupService {
  /**
   * Register new tenant and admin user
   */
  static async register(signupData) {
    const {
      email,
      password,
      name,
      companyName,
      companySize,
      industry,
      timezone = 'Asia/Kolkata',
      currency = 'INR',
      sampleData = false,
    } = signupData;

    // Validate email doesn't exist (use findFirst since email alone is not unique - tenantId_email is compound unique)
    const existingUser = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error('Email already exists');
    }

    // Generate domain from company name
    const domain = this.generateDomain(companyName);

    // Check if domain is taken
    let finalDomain = domain;
    let counter = 2;
    while (await this.domainExists(finalDomain)) {
      finalDomain = `${domain}-${counter}`;
      counter++;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    logger.info({ email, companyName }, 'Starting tenant registration');

    // Create tenant + user + defaults in transaction (all or nothing!)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Tenant (THE ROOT ELEMENT)
      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
          slug: finalDomain, // URL-safe identifier like "acme" for acme.nexora.pro
          domain: `${finalDomain}.nexora.pro`, // Full custom domain
          status: 'ACTIVE',
          timezone,
          currency,
          settings: {
            dateFormat: 'DD/MM/YYYY',
            language: 'en',
            companySize,
            industry,
          },
        },
      });

      logger.info({ tenantId: tenant.id }, 'Tenant created');

      // 2. Create Admin User
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || '';

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: email.toLowerCase(),
          passwordHash: hashedPassword,
          firstName,
          lastName,
          displayName: name,
          status: 'ACTIVE',
          emailVerified: false,
        },
      });

      logger.info({ userId: user.id, tenantId: tenant.id }, 'Admin user created');

      // 3. Create Default Sales Pipeline
      const salesPipeline = await tx.pipeline.create({
        data: {
          tenantId: tenant.id,
          name: 'Sales Pipeline',
          type: 'DEAL',
          isDefault: true,
        },
      });

      // 4. Create Pipeline Stages
      await tx.stage.createMany({
        data: [
          {
            tenantId: tenant.id,
            pipelineId: salesPipeline.id,
            name: 'Lead',
            order: 1,
            probability: 10,
            color: '#94A3B8',
          },
          {
            tenantId: tenant.id,
            pipelineId: salesPipeline.id,
            name: 'Qualified',
            order: 2,
            probability: 25,
            color: '#3B82F6',
          },
          {
            tenantId: tenant.id,
            pipelineId: salesPipeline.id,
            name: 'Proposal',
            order: 3,
            probability: 50,
            color: '#F59E0B',
          },
          {
            tenantId: tenant.id,
            pipelineId: salesPipeline.id,
            name: 'Negotiation',
            order: 4,
            probability: 75,
            color: '#8B5CF6',
          },
          {
            tenantId: tenant.id,
            pipelineId: salesPipeline.id,
            name: 'Won',
            order: 5,
            probability: 100,
            color: '#10B981',
            isWon: true,
          },
          {
            tenantId: tenant.id,
            pipelineId: salesPipeline.id,
            name: 'Lost',
            order: 6,
            probability: 0,
            color: '#EF4444',
            isLost: true,
          },
        ],
      });

      // 5. Create Ticket Support Pipeline
      const ticketPipeline = await tx.pipeline.create({
        data: {
          tenantId: tenant.id,
          name: 'Support Tickets',
          type: 'TICKET',
          isDefault: true,
        },
      });

      // 6. Create Ticket Stages
      await tx.stage.createMany({
        data: [
          {
            tenantId: tenant.id,
            pipelineId: ticketPipeline.id,
            name: 'Open',
            order: 1,
            color: '#3B82F6',
          },
          {
            tenantId: tenant.id,
            pipelineId: ticketPipeline.id,
            name: 'In Progress',
            order: 2,
            color: '#F59E0B',
          },
          {
            tenantId: tenant.id,
            pipelineId: ticketPipeline.id,
            name: 'Waiting on Customer',
            order: 3,
            color: '#8B5CF6',
          },
          {
            tenantId: tenant.id,
            pipelineId: ticketPipeline.id,
            name: 'Resolved',
            order: 4,
            color: '#10B981',
            isClosed: true,
          },
          {
            tenantId: tenant.id,
            pipelineId: ticketPipeline.id,
            name: 'Closed',
            order: 5,
            color: '#6B7280',
            isClosed: true,
          },
        ],
      });

      // 7. Create Default Tags
      await tx.tag.createMany({
        data: [
          { tenantId: tenant.id, name: 'Hot Lead', color: '#EF4444' },
          { tenantId: tenant.id, name: 'Cold Lead', color: '#3B82F6' },
          { tenantId: tenant.id, name: 'Customer', color: '#10B981' },
          { tenantId: tenant.id, name: 'Partner', color: '#8B5CF6' },
          { tenantId: tenant.id, name: 'VIP', color: '#F59E0B' },
        ],
      });

      // NOTE: Templates are channel-specific and require channelId,
      // so they're created later when channels are set up, not during signup

      /* // 8. Create Default Email Templates (SKIP - requires channelId)
      await tx.template.createMany({
        data: [
          {
            tenantId: tenant.id,
            name: 'Welcome Email',
            type: 'email',
            subject: 'Welcome to {{company_name}}!',
            body: `Hi {{contact_name}},

Welcome aboard! We're excited to have you with us.

If you have any questions, feel free to reach out.

Best regards,
{{user_name}}
{{company_name}}`,
            category: 'onboarding',
          },
          {
            tenantId: tenant.id,
            name: 'Follow Up',
            type: 'email',
            subject: 'Following up on our conversation',
            body: `Hi {{contact_name}},

It was great talking to you earlier! I wanted to follow up on our discussion.

Looking forward to hearing from you.

Best regards,
{{user_name}}`,
            category: 'sales',
          },
        ],
      }); */

      // 8. If sample data requested, create demo contacts & deals
      // TODO: Fix Contact and Deal schema mismatches before enabling sample data
      if (false && sampleData) {
        const sampleContacts = await tx.contact.createMany({
          data: [
            {
              tenantId: tenant.id,
              name: 'John Smith',
              email: 'john.smith@example.com',
              company: 'Tech Startup Inc',
              jobTitle: 'CEO',
              phone: '+91 98765 43210',
              source: 'Website',
              status: 'lead',
              ownerId: user.id,
            },
            {
              tenantId: tenant.id,
              name: 'Sarah Johnson',
              email: 'sarah.johnson@bigcorp.com',
              company: 'Big Corp Ltd',
              jobTitle: 'Marketing Director',
              phone: '+91 98765 43211',
              source: 'Referral',
              status: 'customer',
              ownerId: user.id,
            },
            {
              tenantId: tenant.id,
              name: 'Mike Brown',
              email: 'mike.brown@startup.io',
              company: 'Startup.io',
              jobTitle: 'CTO',
              phone: '+91 98765 43212',
              source: 'Cold Call',
              status: 'lead',
              ownerId: user.id,
            },
          ],
        });

        // Get created contacts to link deals
        const contacts = await tx.contact.findMany({
          where: { tenantId: tenant.id },
          select: { id: true, name: true },
        });

        // Create sample deals
        if (contacts.length > 0) {
          await tx.deal.createMany({
            data: [
              {
                tenantId: tenant.id,
                title: 'Website Redesign Project',
                value: 50000,
                stage: 'Proposal',
                probability: 50,
                contactId: contacts[0].id,
                ownerId: user.id,
                expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
              },
              {
                tenantId: tenant.id,
                title: 'CRM Implementation',
                value: 120000,
                stage: 'Negotiation',
                probability: 75,
                contactId: contacts[1].id,
                ownerId: user.id,
                expectedCloseDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
              },
            ],
          });
        }

        logger.info({ tenantId: tenant.id }, 'Sample data created');
      }

      logger.info({ tenantId: tenant.id }, 'Tenant initialization complete');

      return { tenant, user };
    });

    // Generate JWT token
    const token = await generateToken({
      userId: result.user.id,
      tenantId: result.tenant.id,
      role: result.user.role,
    });

    // Send welcome email via AWS SES (async, don't block signup)
    this.sendWelcomeEmail(result.user, result.tenant).catch((error) => {
      logger.error({ error, email: result.user.email }, 'Failed to send welcome email');
      // Don't fail signup if email fails
    });

    // TODO: Track signup in analytics
    // analytics.track('User Signed Up', { ... });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        domain: result.tenant.domain,
        status: result.tenant.status,
      },
      token,
      onboardingComplete: false,
    };
  }

  /**
   * Generate URL-safe domain from company name
   */
  static generateDomain(companyName) {
    return companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dash
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
      .substring(0, 30); // Max length 30
  }

  /**
   * Check if domain is already taken
   */
  static async domainExists(domain) {
    const existing = await prisma.tenant.findUnique({
      where: { domain },
      select: { id: true },
    });
    return !!existing;
  }

  /**
   * Send welcome email after successful signup
   */
  static async sendWelcomeEmail(user, tenant) {
    try {
      const userName = user.displayName || user.firstName || 'there';
      const tenantDomain = tenant.domain;

      await SESService.sendWelcomeEmail(user.email, userName, tenantDomain);

      logger.info({ email: user.email, tenantId: tenant.id }, 'Welcome email sent successfully');
    } catch (error) {
      logger.error({ error, email: user.email }, 'Failed to send welcome email');
      throw error;
    }
  }

  /**
   * Send email verification link
   */
  static async sendVerificationEmail(email, userId, tenantDomain) {
    try {
      // Generate verification token
      const verificationToken = await generateToken(
        { userId, purpose: 'email-verification' },
        '24h'
      );

      // Create verification link
      const verificationLink = `${config.appUrl || 'https://nexoraos.pro'}/verify?token=${verificationToken}`;

      // Get user name for personalization
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, firstName: true },
      });

      const userName = user?.displayName || user?.firstName || 'there';

      await SESService.sendVerificationEmail(email, verificationLink, userName);

      logger.info({ email, userId }, 'Verification email sent successfully');
    } catch (error) {
      logger.error({ error, email, userId }, 'Failed to send verification email');
      throw error;
    }
  }
}
